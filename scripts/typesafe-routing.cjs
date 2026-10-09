#!/usr/bin/env node
'use strict';
// Private, opt-in observations. Nothing in this module changes a worker policy.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const client = require('./typesafe-client.cjs');
const { hash, noLinks, atomic } = client;
const VERSION = 'routing-1';
const MODEL = 'claude-opus-5-5';
const choice = (instructions, criteria) => ({ type: 'choice', instructions, criteria });
const questions = {
  ambiguity: choice('Does task.acceptance leave product or technical decisions unresolved? Judge the supplied facts, not task length.', { bounded: 'Acceptance and the relevant constraints determine the intended outcome.', unresolved: 'Material competing interpretations or unresolved decisions remain.', insufficient: 'The supplied facts cannot establish ambiguity.' }),
  coupling: choice('How much cross-component reasoning does task.context show this stage needs?', { local: 'A bounded change with established interfaces.', cross_component: 'Correctness depends on interactions across multiple components or rules.', insufficient: 'Relevant relationships are missing.' }),
  risk: choice('Would an incorrect result materially affect permissions, persisted data or customer-visible calculations in task?', { ordinary: 'No such material consequence is evidenced.', material: 'Permissions, persisted data or customer-visible calculations could be wrong.', insufficient: 'Consequences cannot be determined.' }),
  evidence: choice('Is task.context and task.acceptance enough to begin this stage without inventing required facts?', { sufficient: 'Required facts are supplied or named retrievable artifacts.', missing: 'A required fact or artifact is explicitly absent.', insufficient: 'Cannot tell whether the facts are sufficient.' }),
  failure: choice('What does task.recentEvidence establish about a prior failure? Hypotheses are not confirmed causes.', { none: 'No prior failure is supplied.', reasoning: 'Evidence establishes a code or reasoning error.', environment: 'Evidence establishes an environment, fixture, permission or authentication failure.', insufficient: 'There is a failure but no established cause.' }),
};
function guard() { if (process.env.SPECFLOW_DUO_REVIEWER) throw Error('Reviewer cannot run routing studies'); }
const read = file => JSON.parse(fs.readFileSync(noLinks(file), 'utf8'));
const integer = n => Number.isSafeInteger(n) && n >= 0;
function privateDirectory(dir) {
  dir = noLinks(dir); let parent = dir;
  while (!fs.existsSync(parent)) parent = path.dirname(parent);
  if (spawnSync('git', ['-C', parent, 'rev-parse', '--show-toplevel'], { stdio: 'ignore' }).status === 0) throw Error('Study must be outside a Git worktree');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 }); fs.chmodSync(dir, 0o700); return dir;
}
function validateManifest(m) {
  if (m.version !== 1 || !/^[a-z0-9-]+$/.test(m.id || '') || !Array.isArray(m.projects) || !m.projects.length || new Set(m.projects).size !== m.projects.length || !m.projects.every(p => typeof p === 'string' && p.trim())) throw Error('Invalid study identity/projects');
  if (!/^jev-\d+\.\d+\.\d+$/.test(m.jevModel || '') || m.model !== MODEL || JSON.stringify(m.efforts) !== '["medium","high"]') throw Error('Pin Jev, Opus 5.5 and medium/high');
  if (!['medium', 'high'].includes(m.baseline?.['spec-build']) || !['medium', 'high'].includes(m.baseline?.['feature-build'])) throw Error('Explicit baseline effort required');
  for (const key of ['typesafe', 'native']) if (!integer(m.budget?.[key]) || !integer(m.maxPerRun?.[key])) throw Error('Explicit study-wide call caps required');
  if (!integer(m.timeoutMs) || m.timeoutMs < 1 || m.timeoutMs > 60000 || !integer(m.nativeTimeoutMs) || m.nativeTimeoutMs < 1 || m.nativeTimeoutMs > 1800000) throw Error('Invalid timeouts');
  if (!integer(m.seed) || !integer(m.resamples) || m.resamples < 1000 || m.resamples > 100000 || m.primaryMetric !== 'elapsedMs') throw Error('Freeze seed, bootstrap count and elapsedMs metric');
  if (!Array.isArray(m.calibrationFamilies) || !Array.isArray(m.heldoutFamilies) || m.calibrationFamilies.some(f => m.heldoutFamilies.includes(f)) || new Set([...m.calibrationFamilies, ...m.heldoutFamilies]).size !== m.calibrationFamilies.length + m.heldoutFamilies.length) throw Error('Disjoint unique calibration/heldout families required');
  if (!integer(m.maxOutputBytes) || m.maxOutputBytes < 1024 || m.maxOutputBytes > 4 * 1024 * 1024 || !m.reviewer?.model || m.reviewer.effort !== 'medium' || m.taskClass !== 'bounded-file-change' || m.maxRepairRounds !== 0) throw Error('Freeze bounded output, task class, zero-repair trial and independent reviewer policy');
  if (m.maxBilledCost !== undefined) throw Error('Billed-cost hard limits unavailable; use enforceable call caps');
  if (client.sensitive(m)) throw Error('Sensitive study manifest');
}
function init(dir, manifest) {
  guard(); validateManifest(manifest); dir = privateDirectory(dir);
  const m = { ...manifest, implementationHash: implementationHash(), questionVersion: VERSION, questionHash: hash(questions), policy: 'sufficient-nonfailed-context-v1', analysis: 'family-exact-binomial-paired-bootstrap-100-v1' };
  const cohortId = hash(m), file = path.join(dir, 'manifest.json');
  if (fs.existsSync(file)) { if (read(file).cohortId !== cohortId) throw Error('Changed cohort requires a new study directory'); return load(dir); }
  fs.mkdirSync(path.join(dir, 'events'), { mode: 0o700 });
  fs.mkdirSync(path.join(dir, 'reports'), { mode: 0o700 });
  fs.mkdirSync(path.join(dir, 'runtime'), { mode: 0o700 });
  for (const name of ['typesafe-routing.cjs','typesafe-routing-bridge.cjs','typesafe-effort-analysis.cjs','typesafe-effort-trial.cjs','typesafe-client.cjs','duo-review-receipts.cjs']) fs.copyFileSync(path.join(__dirname, name), path.join(dir, 'runtime', name));
  fs.writeFileSync(file, JSON.stringify({ ...m, cohortId }, null, 2), { flag: 'wx', mode: 0o600 });
  return load(dir);
}
function load(dir) {
  dir = noLinks(dir); const m = read(path.join(dir, 'manifest.json'));
  const { cohortId, ...body } = m;
  if (m.implementationHash !== implementationHash()) throw Error('Study runtime changed; report with PRIVATE_STUDY/runtime/typesafe-routing.cjs or start a new cohort');
  if (hash(body) !== cohortId || m.questionHash !== hash(questions) || m.questionVersion !== VERSION) throw Error('Study identity changed; create a new cohort');
  validateManifest(m); return { dir, manifest: m };
}
function lock(study, fn) {
  const file = path.join(study.dir, 'lock'); noLinks(file);
  try { fs.mkdirSync(file, { mode: 0o700 }); } catch { throw Error('Study lock busy; retry status, never duplicate an uncertain call'); }
  try { fs.writeFileSync(path.join(file, 'owner.json'), JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); return fn(); }
  finally { fs.rmSync(file, { recursive: true }); }
}
function events(study) { return fs.readdirSync(path.join(study.dir, 'events')).filter(f => f.endsWith('.json')).sort().map(f => read(path.join(study.dir, 'events', f))); }
function put(study, type, key, data) {
  const file = path.join(study.dir, 'events', hash({ type, key }) + '.json');
  if (fs.existsSync(file)) return read(file);
  const value = { ...data, type, key, at: new Date().toISOString() };
  fs.writeFileSync(noLinks(file), JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 }); return value;
}
function reserve(study, kind, key, context = {}) {
  guard();
  return lock(study, () => {
    const rows = events(study), prior = rows.find(e => e.type === 'reservation' && e.key === key);
    if (prior) return { admitted: false, reason: 'already_reserved', prior };
    const used = rows.filter(e => e.type === 'reservation' && e.kind === kind).length;
    const runUsed = rows.filter(e => e.type === 'reservation' && e.kind === kind && e.repository === context.repository && e.runId === context.runId).length;
    if (!['typesafe', 'native'].includes(kind) || used >= study.manifest.budget[kind] || runUsed >= study.manifest.maxPerRun[kind]) {
      put(study, 'budget-stop', kind, { kind, used }); return { admitted: false, reason: 'budget_exhausted' };
    }
    put(study, 'reservation', key, { kind, repository: context.repository || null, runId: context.runId || null });
    if (used + 1 === study.manifest.budget[kind]) put(study, 'budget-stop', kind, { kind, used: used + 1 });
    return { admitted: true };
  });
}
function propose(answers, baseline) {
  const values = Object.values(answers);
  if (values.some(a => a.confidence < .8 || a.choice === 'insufficient') || answers.evidence.choice !== 'sufficient' || answers.failure.choice === 'environment') return { effort: baseline, abstained: true };
  const high = answers.ambiguity.choice === 'unresolved' || answers.coupling.choice === 'cross_component' || answers.risk.choice === 'material' || answers.failure.choice === 'reasoning';
  return { effort: high ? 'high' : 'medium', abstained: false };
}
function canonicalTaskFamily(value) {
  const text = String(value).trim();
  if (!text) throw Error('Task family must be nonempty');
  const match = /^(?:#|issue\s+)(\d+)$/i.exec(text) || /^https:\/\/github\.com\/[^/\s?#]+\/[^/\s?#]+\/issues\/(\d+)$/.exec(text);
  return match ? 'issue:' + match[1].replace(/^0+(?=\d)/, '') : text;
}
function familyKey(repository, taskFamilyId) { return JSON.stringify([repository, canonicalTaskFamily(taskFamilyId)]); }
function implementationHash() {
  return hash(['typesafe-routing.cjs', 'typesafe-routing-bridge.cjs', 'typesafe-effort-analysis.cjs', 'typesafe-effort-trial.cjs', 'typesafe-client.cjs'].map(name => [name, hash(fs.readFileSync(path.join(__dirname, name), 'utf8'))]));
}
function validateTask(study, t) {
  if (!study.manifest.projects.includes(t.repository) || !['spec-build', 'feature-build'].includes(t.loop)) throw Error('Project/loop is not registered');
  for (const k of ['taskFamilyId', 'runId', 'stage', 'snapshotHash', 'goal', 'acceptance', 'context']) if (typeof t[k] !== 'string' || !t[k].trim()) throw Error('Missing task field: ' + k);
  if (!integer(t.attempt) || !Array.isArray(t.evidenceRefs) || !t.configured?.model || !t.requested?.model) throw Error('Invalid task provenance');
  if (Buffer.byteLength(JSON.stringify(t)) > 48000 || client.sensitive(t)) throw Error('Task is sensitive or exceeds input bound');
}
async function observe(dir, task, options = {}) {
  guard(); const study = load(dir); validateTask(study, task);
  const decisionId = hash({ cohort: study.manifest.cohortId, repository: task.repository, run: task.runId, stage: task.stage, attempt: task.attempt, snapshot: task.snapshotHash });
  const input = { snapshotHash: task.snapshotHash, questionSetId: 'specflow-routing', questionVersion: VERSION, model: study.manifest.jevModel, state: { task }, questions };
  const inputHash = hash(input);
  const prior = events(study).find(e => e.type === 'observation' && e.key === decisionId);
  if (prior) { if (prior.inputHash !== inputHash) throw Error('Decision input changed'); return { decisionId, status: prior.status, reason: prior.reason }; }
  const admitted = reserve(study, 'typesafe', decisionId, task);
  const file = path.join(study.dir, 'provider', decisionId + '.json');
  let result;
  if (!admitted.admitted) result = { status: 'unavailable', reason: admitted.reason === 'already_reserved' ? 'interrupted' : admitted.reason };
  else {
    atomic(path.join(study.dir, 'inputs', decisionId + '.json'), input);
    try { result = await client.evaluate(input, { file, envFile: options.envFile, timeoutMs: study.manifest.timeoutMs, ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}) }); }
    catch { result = { status: 'unavailable', reason: 'recording_failure' }; }
  }
  const baseline = study.manifest.baseline[task.loop];
  const proposed = result.status === 'completed' ? { model: MODEL, policyId: study.manifest.policy, ...propose(result.response.answers, baseline) } : null;
  const data = { schemaVersion: 1, decisionId, cohortId: study.manifest.cohortId, ...task, goalHash: hash(task.goal), inputHash, questionHash: hash(questions), policyHash: hash({ policy: study.manifest.policy, baseline: study.manifest.baseline, implementationHash: study.manifest.implementationHash }), catalogueHash: hash({ model: MODEL, efforts: study.manifest.efforts }), jevModel: study.manifest.jevModel, mode: 'shadow', status: result.status === 'completed' ? 'recorded' : 'unavailable', reason: result.reason || null, proposed, providerRecordRef: fs.existsSync(file) ? file : null, overheadMs: result.elapsedMs || 0, transport: options.fetchImpl ? 'simulated' : 'live' };
  // Reserve recovery may race the original completion. First persisted outcome wins;
  // never expose a late answer after an interrupted observation has been recorded.
  const saved = lock(study, () => put(study, 'observation', decisionId, data));
  return { decisionId, status: saved.status, reason: saved.reason };
}
function outcome(dir, decisionId, value) {
  guard(); const study = load(dir);
  if (!['completed', 'failed', 'blocked', 'interrupted'].includes(value.status) || !Array.isArray(value.evidenceRefs) || client.sensitive(value)) throw Error('Invalid routing outcome');
  lock(study, () => {
    const observation = events(study).find(e => e.type === 'observation' && e.key === decisionId);
    if (!observation || !study.manifest.projects.includes(observation.repository)) throw Error('Unknown routing decision/project');
    const prior = events(study).find(e => e.type === 'outcome' && e.key === decisionId);
    if (prior && hash(prior.value) !== hash(value)) throw Error('Outcome is immutable');
    put(study, 'outcome', decisionId, { value });
  });
  return reports(dir);
}
function coverage(rows) {
  const loops = {}, projects = {};
  for (const r of rows) { loops[r.loop] = (loops[r.loop] || 0) + 1; projects[r.repository] = (projects[r.repository] || 0) + 1; }
  return { loops, projects, sufficient: ['spec-build', 'feature-build'].every(l => loops[l] >= 10) && Object.values(projects).filter(n => n >= 5).length >= 3 };
}
function summary(study) {
  const rows = events(study), outcomes = new Map(rows.filter(e => e.type === 'outcome').map(e => [e.key, e.value]));
  const terminals = new Map(rows.filter(e => e.type === 'terminal').map(e => [e.key, e.value]));
  const families = new Map();
  for (const row of rows.filter(e => e.type === 'observation' && (terminals.has(familyKey(e.repository, e.runId)) || outcomes.get(e.key)?.terminal === true)).sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key))) {
    const key = familyKey(row.repository, row.taskFamilyId);
    if (!families.has(key)) families.set(key, { ...row, outcome: terminals.get(familyKey(row.repository, row.runId)) || outcomes.get(row.key) });
  }
  const all = [...families.values()], counts = {};
  for (const r of all) counts[r.outcome.status] = (counts[r.outcome.status] || 0) + 1;
  return { rows, families: all, counts, attemptedFamilies: all.length, unavailableFamilies: all.filter(r => r.status !== 'recorded').length, coverage: coverage(all) };
}
function terminal(dir, runId, status, evidenceRefs, repository) {
  guard(); const study = load(dir);
  if (!study.manifest.projects.includes(repository)) throw Error('Terminal repository required');
  if (!['completed', 'failed', 'blocked', 'interrupted'].includes(status)) throw Error('Invalid terminal status');
  lock(study, () => put(study, 'terminal', familyKey(repository, runId), { value: { status, evidenceRefs } }));
  return reports(dir);
}
function reports(dir, manual = false) {
  guard(); const study = load(dir);
  return lock(study, () => {
    const s = summary(study), checkpoints = [];
    const starts = s.rows.filter(e => e.type === 'pair-start').sort((a,b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));
    const pairs = starts.map(start => s.rows.find(e => e.type === 'pair' && e.key === start.key)?.value || { ...start.value, arms: {}, transport: 'live' }).map(pair => require('./typesafe-effort-trial.cjs').verifyEvidence(study, pair));
    const finished = n => starts.slice(0,n).every(start => s.rows.some(e => e.type === 'pair' && e.key === start.key) || !processAlive(start.pid));
    if (pairs.length >= 30 && finished(30)) checkpoints.push('paired-30');
    if (pairs.length >= 100 && finished(100)) checkpoints.push('paired-100');
    if (s.attemptedFamilies >= 10) checkpoints.push('shadow-10');
    if (s.attemptedFamilies >= 30) checkpoints.push('shadow-30');
    if (s.rows.some(e => e.type === 'budget-stop')) checkpoints.push('budget-stop');
    if (manual) checkpoints.push('manual-' + hash(s.rows));
    for (const checkpoint of checkpoints) {
      const reportId = hash({ cohortId: study.manifest.cohortId, checkpoint });
      const report = { schemaVersion: 1, reportId, cohortId: study.manifest.cohortId, checkpoint, recommendation: 'insufficient_evidence', collectionStatus: s.unavailableFamilies ? 'incomplete' : s.attemptedFamilies ? 'working' : 'incomplete', attemptedFamilies: s.attemptedFamilies, comparableFamilies: s.attemptedFamilies - s.unavailableFamilies, excludedFamilies: s.unavailableFamilies, unavailableFamilies: s.unavailableFamilies, counts: s.counts, coverage: s.coverage, judgmentAccuracy: labelSummary(study, s.rows), benefit: null, manifestRef: path.join(dir, 'manifest.json'), evidenceRefs: s.families.map(r => path.join(dir, 'events', hash({ type: 'observation', key: r.key }) + '.json')), outcome: 'Shadow observations recorded; routing benefit is unproven.', blocker: 'Independent labels and executed matched trials are required; shadow cannot prove effort benefit.', nextAction: checkpoint === 'shadow-10' ? 'Check collection failures; continue to 30 distinct task families.' : 'Run the registered held-out effort study within its remaining budget.' };
      const selectedPairs = checkpoint.startsWith('paired-') ? pairs.slice(0, Number(checkpoint.slice(7))) : pairs;
      if (selectedPairs.length) {
        report.effort = require('./typesafe-effort-analysis.cjs').analyze(study.manifest, selectedPairs, s.rows.filter(e => e.type === 'observation'));
        if (checkpoint.startsWith('paired-')) {
          report.recommendation = report.effort.recommendation;
          report.outcome = 'Matched effort trials recorded: ' + report.recommendation;
          report.blocker = report.recommendation === 'candidate_for_limited_adoption' ? null : 'Inspect pair exclusions, coverage and uncertainty; no automatic adoption.';
        }
      }
      report.analysisRef = path.join(dir, 'reports', reportId + '.json');
      if (!s.rows.some(e => e.type === 'report' && e.key === reportId)) {
        atomic(path.join(dir, 'reports', reportId + '.json'), report);
        put(study, 'report', reportId, { file: path.join(dir, 'reports', reportId + '.json') });
      }
    }
    return pending(study);
  });
}
function processAlive(pid) { try { if (!Number.isSafeInteger(pid) || pid <= 0) return false; process.kill(pid, 0); return true; } catch(e) { return e.code !== 'ESRCH'; } }
function pending(study) {
  const rows = events(study), delivered = new Set(rows.filter(e => e.type === 'delivered').map(e => e.key));
  return rows.filter(e => e.type === 'report').map(e => ({ reportId: e.key, file: e.file, delivery: delivered.has(e.key) ? 'delivered' : 'pending' }));
}
function acknowledge(dir, reportId) {
  guard(); const study = load(dir); return lock(study, () => {
    if (!events(study).some(e => e.type === 'report' && e.key === reportId)) throw Error('Unknown report');
    return put(study, 'delivered', reportId, {});
  });
}
function labels(dir, value) {
  guard(); const study = load(dir), row = events(study).find(e => e.type === 'observation' && e.key === value.decisionId);
  if (!row || value.inputHash !== row.inputHash || !value.reviewer || value.blinded !== true || !Array.isArray(value.evidenceRefs) || !value.evidenceRefs.length || client.sensitive(value)) throw Error('Independent blinded label provenance required');
  if (Object.keys(questions).some(q => value.labels?.[q] !== null && !Object.hasOwn(questions[q].criteria, value.labels?.[q]))) throw Error('Invalid label; use null for unresolved ambiguity');
  lock(study, () => {
    const prior = events(study).find(e => e.type === 'label' && e.key === value.decisionId);
    if (prior && hash(prior.value) !== hash(value)) throw Error('Label immutable; new rubric needs a new cohort');
    put(study, 'label', value.decisionId, { value });
  });
  return reports(dir);
}
function labelSummary(study, rows) {
  const result = { labelledDecisions: 0, correct: 0, wrong: 0, ambiguous: 0, missing: 0, provenance: 'Externally supplied blinded adjudication; independently inspect cited evidence.' };
  for (const row of rows.filter(e => e.type === 'observation')) {
    const label = rows.find(e => e.type === 'label' && e.key === row.key);
    if (!label || row.status !== 'recorded') { result.missing++; continue; }
    const provider = read(row.providerRecordRef); result.labelledDecisions++;
    for (const q of Object.keys(questions)) { const expected = label.value.labels[q]; if (expected === null) result.ambiguous++; else if (expected === provider.response.answers[q].choice) result.correct++; else result.wrong++; }
  }
  return result;
}
async function cli(args) {
  guard(); const [command, dir, file] = args;
  if (command === 'init') { const s = init(dir, read(file)); console.log(JSON.stringify({ study: s.dir, cohortId: s.manifest.cohortId })); }
  else if (command === 'enable') console.log(JSON.stringify(require('./typesafe-routing-bridge.cjs').enable(path.resolve(file), path.resolve(dir), args[3] ? read(args[3]).contextFiles || [] : [], args[3] ? read(args[3]).envFile : undefined)));
  else if (command === 'observe') console.log(JSON.stringify(await observe(dir, read(file), { envFile: args[3] })));
  else if (command === 'outcome') console.log(JSON.stringify(outcome(dir, file, read(args[3]))));
  else if (command === 'label') console.log(JSON.stringify(labels(dir, read(file))));
  else if (command === 'trial') console.log(JSON.stringify(await require('./typesafe-effort-trial.cjs').trial(dir, read(file), { envFile: args[3] })));
  else if (command === 'report') console.log(JSON.stringify(reports(dir, true)));
  else if (command === 'ack') acknowledge(dir, file);
  else throw Error('Use init PRIVATE_DIR MANIFEST | enable PRIVATE_DIR PROJECT [CONFIG] | trial PRIVATE_DIR CASE [ENV_FILE] | label PRIVATE_DIR LABELS | observe PRIVATE_DIR INPUT [ENV_FILE] | outcome PRIVATE_DIR ID RESULT | report PRIVATE_DIR | ack PRIVATE_DIR REPORT_ID');
}
module.exports = { VERSION, MODEL, questions, init, load, read, lock, events, put, reserve, propose, canonicalTaskFamily, familyKey, observe, outcome, terminal, coverage, summary, reports, pending, acknowledge, privateDirectory, labels, cli };
if (require.main === module) cli(process.argv.slice(2)).catch(e => { console.error('Routing shadow: ' + e.message); process.exitCode = 2; });
