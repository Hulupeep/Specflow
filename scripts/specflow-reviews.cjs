'use strict';
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
function begin(root, record, tier, builder) {
  if (!['contracted', 'build-ready'].includes(tier)) throw Error('Thin work has no automatic adversary or pre-flight round');
  if (!['codex', 'claude-code'].includes(builder)) throw Error('Unknown review builder');
  return change(root, record.issue.number, state => {
    const rounds = state.reviews[tier] ||= [];
    if (rounds.length >= 2) throw Error(`${tier} review limit reached: initial review plus one repair/regrade. Escalate retained findings; renaming a run or switching hosts cannot reset it.`);
    const previous = rounds.at(-1), scope = policy.inputHash(record);
    if (previous?.status === 'pending') throw Error('Prior scoped review is unfinished; retain it and record the failure before continuing');
    if (previous?.outcome === 'escalated') throw Error('Repair-induced findings require escalation, not another automatic review');
    if (previous?.scope === scope) throw Error('No new evidence or scope change since the last review; stop instead of repeating it');
    const reservation = { id: crypto.randomUUID(), tier, number: record.issue.number, scope, builder, at: new Date().toISOString(), status: 'pending' };
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
  const errors = [], merged = new Map((previous?.findings || []).map(f => [f.id, f]));
  const ids = new Set(), newMaterial = [];
  for (const finding of findings || []) {
    if (!nonempty(finding.id) || ids.has(finding.id)) throw Error('Review findings require unique stable IDs');
    ids.add(finding.id);
    if (!['FATAL', 'SERIOUS', 'P2'].includes(finding.severity) || !['open', 'resolved', 'deferred'].includes(finding.status)) throw Error(`Invalid finding classification: ${finding.id}`);
    if (!nonempty(finding.basis) || !nonempty(finding.action)) throw Error(`Finding ${finding.id} needs violated acceptance/gate or concrete material risk and an action`);
    errors.push(...checkedRefs(root, finding.evidence, finding.id));
    if (finding.status === 'deferred') {
      const d = finding.deferral;
      if (finding.impact !== 'future' || !nonempty(d?.nonimpact) || !/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/\d+$/.test(d?.ownerIssue || '') || !nonempty(d?.trigger)) errors.push(`${finding.id}: unbuilt dependency alone cannot justify deferral; current or unknown impact blocks`);
      errors.push(...checkedRefs(root, d?.evidence, `${finding.id} deferral`));
    }
    if (!merged.has(finding.id) && finding.severity !== 'P2') newMaterial.push(finding);
    if (merged.has(finding.id) && merged.get(finding.id).basis !== finding.basis) errors.push(`${finding.id}: cannot repurpose an existing finding ID`);
    merged.set(finding.id, finding);
  }
  const all = [...merged.values()];
  const repairInduced = newMaterial.filter(f => f.origin === 'repair_induced' && f.repairLink && !policy.referenceErrors(root, f.repairLink).length).length;
  const unknownOrigin = newMaterial.filter(f => !['original', 'repair_induced'].includes(f.origin) || (f.origin === 'repair_induced' && (!f.repairLink || policy.referenceErrors(root, f.repairLink).length))).length;
  const counts = { newMaterial: newMaterial.length, repairInduced, unknownOrigin };
  if (!identity || !['live', 'simulated'].includes(identity.mode) || !nonempty(identity.provider) || !nonempty(identity.model) || !nonempty(identity.family)) errors.push('Reviewer identity and live/simulated provenance are required');
  for (const gate of gates || []) {
    if (!gate.executed || gate.skipped || gate.status !== 'passed') errors.push(`Required gate ${gate.id}: missing, skipped or failing execution`);
    errors.push(...checkedRefs(root, gate.evidence, `Gate ${gate.id}`));
  }
  const open = all.filter(f => f.status === 'open' && f.severity !== 'P2');
  const outcome = newMaterial.length && repairInduced / newMaterial.length > 0.5 ? 'escalated' : errors.length || open.length ? 'blocked' : all.some(f => f.severity === 'P2' && f.status === 'open') ? 'passed_with_warnings' : 'passed';
  return { outcome, errors, findings: all, counts, identity, gates: gates || [] };
}
function complete(root, reservation, report) {
  return change(root, reservation.number, state => {
    const rounds = state.reviews[reservation.tier] || [], round = rounds.find(r => r.id === reservation.id);
    if (!round || round.status !== 'pending' || round.scope !== reservation.scope) throw Error('No matching active scoped review reservation');
    const evidenceErrors = checkedRefs(root, report.evidence, 'Native review');
    const result = classify(root, rounds.at(-2), report.findings, report.gates, report.identity);
    result.errors.push(...evidenceErrors);
    if (report.readinessComplete !== true) result.errors.push('Scoped preparation acceptance is incomplete; batch acceptance is not promotion');
    if (report.nativeOutcome !== 'accepted') result.errors.push('Native peer did not accept the reviewed scope');
    if (report.identity?.family === (reservation.builder === 'codex' ? 'gpt' : 'claude')) result.errors.push('Required independent peer uses the builder model family');
    if (result.errors.length) result.outcome = result.outcome === 'escalated' ? 'escalated' : 'blocked';
    Object.assign(round, result, { status: 'complete', evidence: report.evidence || [], atEnd: new Date().toISOString() });
    return structuredClone(round);
  });
}
function fail(root, reservation, reason) {
  return change(root, reservation.number, state => {
    const round = state.reviews[reservation.tier]?.find(r => r.id === reservation.id);
    if (!round || round.status !== 'pending') throw Error('No matching unfinished review');
    const prior = state.reviews[reservation.tier][state.reviews[reservation.tier].indexOf(round)-1];
    Object.assign(round, { status: 'complete', outcome: 'blocked', errors: [reason], findings: structuredClone(prior?.findings || []), identity: null });
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
function status(root, record, tier) {
  const state = load(root, record.issue.number), round = state.reviews[tier]?.at(-1);
  const exception = state.events.filter(e => e.kind === 'owner-exception' && e.scope === policy.inputHash(record)).at(-1);
  if (exception) return { status: exception.status, passed: false, attempts: state.reviews[tier]?.length || 0 };
  if (round && round.scope !== policy.inputHash(record)) return { status: 'fixed as specified, not re-graded', passed: false, attempts: state.reviews[tier].length };
  try { const accepted = latest(root, record, tier); return { status: accepted.outcome, passed: accepted.identity?.mode === 'live', attempts: state.reviews[tier].length, identity: accepted.identity }; }
  catch (error) { return { status: 'blocked', passed: false, attempts: state.reviews[tier]?.length || 0, reason: error.message }; }
}
function stageGate(root, record, stage) {
  const tier = stage === 'adversary' ? 'contracted' : 'build-ready';
  if (!record?.issue?.number) return { status: 'blocked', passed: false, reason: 'Bind the selected issue before scoped review' };
  const result = status(root, record, tier);
  return { ...result, tier, next_action: result.passed ? 'Advance using the accepted scoped review' : result.attempts >= 2 ? 'Review budget exhausted: escalate retained findings; do not launch another reviewer' : 'The builder must run scoped Duo preparation with specification.targetTier; its native peer call consumes the shared issue/tier reservation. Return here after the receipt is recorded.' };
}
module.exports = { statePath, load, change, begin, complete, fail, latest, classify, status, stageGate };
