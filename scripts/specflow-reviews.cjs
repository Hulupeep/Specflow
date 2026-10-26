'use strict';
const continuation = require('./review-continuation.cjs');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const policy = require('./specflow-tier.cjs');

function statePath(root, number) {
  if (!Number.isSafeInteger(number) || number < 1) throw Error('A stable positive issue number is required');
  const file = path.join(root, '.specflow/specification', `${number}.json`);
  for (let at = path.resolve(file); at !== path.dirname(at); at = path.dirname(at)) {
    if (fs.existsSync(at) && fs.lstatSync(at).isSymbolicLink()) throw Error('Specification state cannot follow symlinks');
  }
  return file;
}
function load(root, number) {
  const file = statePath(root, number);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file)) : { version: 1, issue: number, reviews: {}, discoveries: [], experiments: [], batches: {}, events: [] };
}
function change(root, number, action) {
  const file = statePath(root, number); fs.mkdirSync(path.dirname(file), { recursive: true });
  const lock = file + '.lock';
  try { fs.mkdirSync(lock); } catch { throw Error('Specification operation is active; inspect the interrupted operation before recovering its lock'); }
  try {
    const state = load(root, number), result = action(state);
    const temporary = file + '.tmp'; fs.writeFileSync(temporary, JSON.stringify(state, null, 2)); fs.renameSync(temporary, file);
    return result;
  } finally { fs.rmSync(lock, { recursive: true }); }
}
function budget(rounds = []) {
  let protocolFailures = 0;
  for (const round of rounds.slice().reverse()) { if (round.status !== 'protocol_failed') break; protocolFailures++; }
  return { attempts: rounds.filter(r => r.status !== 'protocol_failed').length, protocolFailures };
}
const previousReview = rounds => rounds.findLast(r => r.status === 'complete');
function achievements(round) {
  if (round.progressDiscarded) return [];
  return [...(round.findings || []).filter(f => f.status === 'resolved' && f.severity !== 'P2').map(f => `finding:${f.id}`),
    ...(round.gates || []).filter(g => g.executed && !g.skipped && g.status === 'passed').map(g => `gate:${g.id}`),
    ...(round.verifiedCriteria || []).map(id => `criterion:${id}`)];
}
function control(state, tier, input) {
  state.reviewControl ||= {};
  if (!state.reviewControl[tier]) {
    const rounds = state.reviews[tier] || [];
    const c = continuation.create(input, rounds.length ? Date.parse(rounds[0].at) : Date.now());
    for (const r of rounds) { c.calls++; if (r.status !== 'pending') continuation.observe(c,{protocol:r.status === 'protocol_failed',achievements:achievements(r)}); }
    state.reviewControl[tier] = c;
  }
  return state.reviewControl[tier];
}
function validateRecovery(root, refs) {
  const errors = checkedRefs(root, refs, 'Recovery'); if (errors.length) throw Error(errors.join('; '));
  return continuation.evidenceSummary(refs.map(ref=>({...ref,text:fs.readFileSync(policy.localFile(root,ref.path),'utf8')})));
}
function recover(root, record, tier, input) {
  if (!['contracted','build-ready'].includes(tier)) throw Error('Unknown review tier');
  return change(root, record.issue.number, state => {
    if (state.reviews[tier]?.at(-1)?.status === 'pending') throw Error('Prior scoped review is unfinished');
    const result = continuation.recover(control(state,tier,record.profile?.reviewPolicy),input,refs=>validateRecovery(root,refs));
    state.events.push({...result,kind:'review-recovery',recoveryKind:result.kind,tier}); return result;
  });
}
function extendLimits(root, record, tier, input) {
  if (!['contracted','build-ready'].includes(tier)) throw Error('Unknown review tier');
  return change(root,record.issue.number,state=>{const result=continuation.extend(control(state,tier,record.profile?.reviewPolicy),input);state.events.push({kind:'review-limit-extension',tier,...result});return result;});
}
function begin(root, record, tier, builder, {criteria = [], ownerRun = null, evidenceFingerprint = null} = {}) {
  if (!['contracted', 'build-ready'].includes(tier)) throw Error('Thin work has no automatic adversary or pre-flight round');
  if (!['codex', 'claude-code'].includes(builder)) throw Error('Unknown review builder');
  return change(root, record.issue.number, state => {
    const rounds = state.reviews[tier] ||= [];
    const c = control(state,tier,record.profile?.reviewPolicy);
    const stop = continuation.decision(c);
    if (stop) throw Error(`${stop.reason}. Cause: ${cause(rounds.at(-1)) || 'Unresolved scoped findings'}`);
    const previous = previousReview(rounds), scope = policy.inputHash(record);
    if (rounds.at(-1)?.status === 'pending') throw Error('Prior scoped review is unfinished; retain it and record the failure before continuing');
    if (previous?.outcome === 'escalated') throw Error('Repair-induced findings require escalation, not another automatic review');
    if (previous?.scope === scope && (!evidenceFingerprint || previous.evidenceFingerprint === evidenceFingerprint) && rounds.at(-1)?.status !== 'protocol_failed' && !continuation.pending(c).length) throw Error('No new evidence or scope change since the last review; stop instead of repeating it');
    const reservation = { id: crypto.randomUUID(), tier, number: record.issue.number, scope, builder, criteria, ownerRun, evidenceFingerprint, findings:structuredClone(previous?.findings || []), gateIds:(record.profile?.gates || []).map(g=>g.id), at: new Date().toISOString(), status: 'pending' };
    continuation.beforeCall(c,refs=>validateRecovery(root,refs));
    rounds.push(reservation);
    return structuredClone(reservation);
  });
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function checkedRefs(root, refs, label) {
  if (!Array.isArray(refs) || !refs.length) return [`${label}: raw evidence is missing`];
  return refs.flatMap(ref => policy.referenceErrors(root, ref, label));
}
function classify(root, previous, findings, gates, identity) {
  const errors = [], protocolErrors = [], merged = new Map((previous?.findings || []).map(f => [f.id, f]));
  const ids = new Set(), newMaterial = [];
  for (let finding of findings || []) {
    if (!nonempty(finding.id) || ids.has(finding.id)) throw Error('Review findings require unique stable IDs');
    ids.add(finding.id);
    if (!['FATAL', 'SERIOUS', 'P2'].includes(finding.severity) || !['open', 'resolved', 'deferred'].includes(finding.status)) throw Error(`Invalid finding classification: ${finding.id}`);
    if (!nonempty(finding.basis) || !nonempty(finding.action)) throw Error(`Finding ${finding.id} needs violated acceptance/gate or concrete material risk and an action`);
    errors.push(...checkedRefs(root, finding.evidence, finding.id));
    if (finding.status === 'deferred') {
      const d = finding.deferral, before = errors.length;
      if (finding.impact !== 'future' || !nonempty(d?.nonimpact) || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(d?.ownerIssue || '') || !nonempty(d?.trigger)) errors.push(`${finding.id}: unbuilt dependency alone cannot justify deferral; current or unknown impact blocks`);
      errors.push(...checkedRefs(root, d?.evidence, `${finding.id} deferral`));
      // A rejected deferral remains a material obligation in every later round.
      if (errors.length > before) finding = {...finding,status:'open'};
    }
    if (!merged.has(finding.id) && finding.severity !== 'P2') newMaterial.push(finding);
    const prior = merged.get(finding.id);
    if (!prior && finding.status === 'resolved' && finding.severity !== 'P2') protocolErrors.push(`${finding.id}: cannot close an unknown finding`);
    if (prior && prior.severity !== 'P2' && finding.severity === 'P2') protocolErrors.push(`${finding.id}: cannot downgrade a material finding to optional`);
    if (prior && prior.criterion !== finding.criterion) protocolErrors.push(`${finding.id}: cannot repurpose an existing finding ID`);
    merged.set(finding.id, prior ? { ...finding, basis:prior.basis, latestBasis:finding.basis } : finding);
  }
  for (const [id,finding] of merged) if (finding.status === 'deferred') {
    const stale = checkedRefs(root,finding.deferral?.evidence,`${id} deferral`);
    if (stale.length) {errors.push(...stale);merged.set(id,{...finding,status:'open'});}
  }
  const all = [...merged.values()];
  const repairInduced = newMaterial.filter(f => f.origin === 'repair_induced' && f.repairLink && !policy.referenceErrors(root, f.repairLink).length).length;
  const unknownOrigin = newMaterial.filter(f => !['original', 'repair_induced'].includes(f.origin) || (f.origin === 'repair_induced' && (!f.repairLink || policy.referenceErrors(root, f.repairLink).length))).length;
  const counts = { newMaterial: newMaterial.length, repairInduced, unknownOrigin };
  if (!identity || !['live', 'simulated'].includes(identity.mode) || !nonempty(identity.provider) || !nonempty(identity.model) || !nonempty(identity.family)) protocolErrors.push('Reviewer identity and live/simulated provenance are required');
  for (const gate of gates || []) {
    if (!gate.executed || gate.skipped || gate.status !== 'passed') errors.push(`Required gate ${gate.id}: missing, skipped or failing execution`);
    errors.push(...checkedRefs(root, gate.evidence, `Gate ${gate.id}`));
  }
  errors.push(...protocolErrors);
  const open = all.filter(f => f.status === 'open' && f.severity !== 'P2');
  const outcome = newMaterial.length && repairInduced / newMaterial.length > 0.5 ? 'escalated' : errors.length || open.length ? 'blocked' : all.some(f => f.severity === 'P2' && f.status === 'open') ? 'passed_with_warnings' : 'passed';
  return { outcome, errors, protocolErrors, findings: all, counts, identity, gates: gates || [] };
}
function complete(root, reservation, report) {
  return change(root, reservation.number, state => {
    const rounds = state.reviews[reservation.tier] || [], round = rounds.find(r => r.id === reservation.id);
    if (!round || round.status !== 'pending' || round.scope !== reservation.scope) throw Error('No matching active scoped review reservation');
    const c = control(state,reservation.tier);
    const evidenceErrors = checkedRefs(root, report.evidence, 'Native review');
    const result = classify(root, previousReview(rounds.slice(0,-1)), report.findings, report.gates, report.identity);
    result.errors.push(...evidenceErrors);
    if (report.readinessComplete !== true) result.errors.push('Scoped preparation acceptance is incomplete; batch acceptance is not promotion');
    if (report.nativeOutcome !== 'accepted') result.errors.push('Native peer did not accept the reviewed scope');
    if (report.identity?.family === (reservation.builder === 'codex' ? 'gpt' : 'claude')) {result.protocolErrors.push('Required independent peer uses the builder model family');result.errors.push('Required independent peer uses the builder model family');}
    if ((report.verifiedCriteria || []).some(id=>!(round.criteria || []).includes(id))) {result.protocolErrors.push('Verified criterion is not in the reserved acceptance index');result.errors.push('Verified criterion is not in the reserved acceptance index');}
    if ((report.gates || []).some(g=>!(round.gateIds || []).includes(g.id))) {result.protocolErrors.push('Reported gate is not in the reserved required gates');result.errors.push('Reported gate is not in the reserved required gates');}
    if (result.errors.length) result.outcome = result.outcome === 'escalated' ? 'escalated' : 'blocked';
    const provenanceErrors = [...evidenceErrors,...(report.gates || []).flatMap(g=>checkedRefs(root,g.evidence,`Gate ${g.id}`)),...(report.findings || []).flatMap(f=>checkedRefs(root,f.evidence,f.id))];
    const protocol = provenanceErrors.length > 0 || result.protocolErrors.length > 0;
    const progressDiscarded = report.nativeOutcome === 'accepted' && report.readinessComplete === true && !['passed','passed_with_warnings'].includes(result.outcome);
    Object.assign(round, result, { progressDiscarded, status: protocol ? 'protocol_failed' : 'complete', verifiedCriteria:protocol||progressDiscarded?[]:(report.verifiedCriteria || []), evidence: report.evidence || [], atEnd: new Date().toISOString() });
    if (protocol) round.findings = structuredClone(previousReview(rounds.slice(0,-1))?.findings || []);
    continuation.observe(c,{protocol,achievements:protocol?[]:achievements(round)});
    return structuredClone(round);
  });
}
function fail(root, reservation, reason, { kind = 'interrupted' } = {}) {
  if (!['interrupted', 'protocol'].includes(kind)) throw Error('Unknown review failure kind');
  return change(root, reservation.number, state => {
    const round = state.reviews[reservation.tier]?.find(r => r.id === reservation.id);
    if (!round || round.status !== 'pending') throw Error('No matching unfinished review');
    const c = control(state,reservation.tier);
    const prior = state.reviews[reservation.tier][state.reviews[reservation.tier].indexOf(round)-1];
    Object.assign(round, { status: 'protocol_failed', failureKind:kind, outcome: 'blocked', errors: [reason], findings: structuredClone(prior?.findings || []), identity: null, atEnd: new Date().toISOString() });
    continuation.observe(c,{protocol:true});
    return structuredClone(round);
  });
}
function latest(root, record, tier) {
  const rounds = load(root, record.issue.number).reviews[tier] || [];
  const review = rounds.at(-1);
  if (!review || review.scope !== policy.inputHash(record)) throw Error('No scoped review of the current specification; fixes without regrade remain ungraded');
  if (!['passed', 'passed_with_warnings'].includes(review.outcome)) throw Error(`Scoped review is ${review.outcome || 'unfinished'}`);
  const errors = checkedRefs(root, review.evidence, 'Scoped review');
  if (errors.length) throw Error(errors.join('; '));
  return review;
}
function cause(round) { return [...(round?.findings || []).filter(f=>f.status==='open'&&f.severity!=='P2').map(f=>`${f.id}: ${f.basis}; ${f.action}`),...(round?.errors || [])].join('; '); }
function status(root, record, tier) {
  const state = load(root, record.issue.number), rounds = state.reviews[tier] || [], round = rounds.at(-1);
  const c = control(state,tier,record.profile?.reviewPolicy), allowance = budget(rounds);
  const detail = { ...allowance, guard:continuation.decision(c), usageMode:c.policy.usageMode, monetaryCost:null, calls:c.calls, recoveries:c.recoveries,
    reviewStatus:round?.status, findings:round?.findings || [], evidence:round?.evidence || [], reason:cause(round) };
  const exception = state.events.filter(e => e.kind === 'owner-exception' && e.scope === policy.inputHash(record)).at(-1);
  if (exception) return { ...detail, status:exception.status, passed:false };
  if (round && round.scope !== policy.inputHash(record)) return {...detail,status:'fixed as specified, not re-graded',passed:false};
  try { const accepted = latest(root, record, tier); return {...detail,status:accepted.outcome,passed:accepted.identity?.mode === 'live',identity:accepted.identity}; }
  catch (error) { return {...detail,status:'blocked',passed:false,reason:[detail.reason,error.message].filter(Boolean).join('; ')}; }
}
function stageGate(root, record, stage) {
  const tier = stage === 'adversary' ? 'contracted' : 'build-ready';
  if (!record?.issue?.number) return {status:'blocked',passed:false,reason:'Bind the selected issue before scoped review'};
  const result=status(root,record,tier);
  return {...result,tier,next_action:result.passed?'Advance using the accepted scoped review':result.reviewStatus==='pending'?`${result.reason}. Wait for the active reviewer; if its process has exited, record review-failed with the owning --session token before retrying`:`${result.reason || 'Current scope needs independent regrade'}. ${result.guard?.reason || 'Correct the identified cause and run scoped Duo preparation on current evidence'}`};
}
module.exports = { statePath, load, change, begin, complete, fail, latest, classify, status, stageGate, recover, extendLimits, control };
