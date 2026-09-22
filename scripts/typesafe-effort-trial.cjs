'use strict';
// A bounded indexed stage, not another orchestration service. Native builders
// return contained file edits; only the oracle executes code, without network.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const routing = require('./typesafe-routing.cjs'), client = require('./typesafe-client.cjs');
const { collect } = require('./duo-review-receipts.cjs');
const { hash, atomic, noLinks } = client;
const patchSchema = { type: 'object', additionalProperties: false, required: ['files'], properties: { files: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['path', 'content'], properties: { path: { type: 'string' }, content: { type: 'string' } } } } } };
const reviewSchema = { type: 'object', additionalProperties: false, required: ['outcome', 'materialViolation', 'findings'], properties: { outcome: { type: 'string', enum: ['accepted', 'changes_required', 'blocked'] }, materialViolation: { type: 'boolean' }, findings: { type: 'array', items: { type: 'string' } } } };
function safeName(name) { return typeof name === 'string' && name.length && !path.isAbsolute(name) && !name.split('/').some(p => ['..', '.', ''].includes(p)) && !/(^|\/)\.|node_modules|credentials|\.(pem|key)$/.test(name); }
function validateCase(study, c) {
  if (!study.manifest.projects.includes(c.repository) || !study.manifest.heldoutFamilies.includes(routing.familyKey(c.repository, c.taskFamilyId))) throw Error('Register a held-out family first');
  if (!['spec-build', 'feature-build'].includes(c.loop) || !c.stage || !c.goal || !c.acceptance || c.independentUnit !== true) throw Error('Missing task/independence declaration');
  if (!c.files || !Object.keys(c.files).length || Object.entries(c.files).some(([name, text]) => !safeName(name) || typeof text !== 'string') || !Array.isArray(c.editable) || !c.editable.length || c.editable.some(f => !Object.hasOwn(c.files, f))) throw Error('Explicit contained text snapshot and editable paths required');
  if (!safeName(c.oracle?.path) || !Object.hasOwn(c.files, c.oracle.path) || c.editable.includes(c.oracle.path) || !Array.isArray(c.oracle.requiredChecks) || !c.oracle.requiredChecks.length || new Set(c.oracle.requiredChecks).size !== c.oracle.requiredChecks.length) throw Error('Immutable Node oracle with unique required check IDs required');
  if (Buffer.byteLength(JSON.stringify(c)) > 40000 || client.sensitive(c)) throw Error('Case contains sensitive or excessive context');
}
function native(study, id, invocation, cwd, input, options) {
  const admitted = routing.reserve(study, 'native', id, { repository: options.repository, runId: options.runId });
  if (!admitted.admitted) return { status: 'unavailable', reason: admitted.reason, elapsedMs: 0 };
  const started = Date.now();
  const r = (options.execute || spawnSync)(invocation.command, invocation.args, { cwd, input, encoding: 'utf8', timeout: study.manifest.nativeTimeoutMs, maxBuffer: study.manifest.maxOutputBytes, env: { ...process.env, SPECFLOW_DUO_REVIEWER: '1' } });
  // Credential-bearing output is never persisted, even when a native tool errs.
  const stdout = String(r.stdout || ''), stderr = String(r.stderr || '');
  const redacted = client.sensitive(stdout) || client.sensitive(stderr);
  const value = { status: r.status === 0 && !r.error && !redacted ? 'completed' : 'unavailable', reason: redacted ? 'sensitive_output' : r.error?.code || (r.status !== 0 ? 'native_failed' : null), exitCode: r.status, elapsedMs: Date.now() - started, invocation, stdout: redacted ? '' : stdout, stderr: redacted ? '' : stderr, transport: options.execute ? 'simulated' : 'live', billing: null, planQuota: null };
  const file = path.join(study.dir, 'native', id + '.json'); atomic(file, value);
  return { ...value, ref: file, receiptHash: hash(value) };
}
function parseLines(text) { return String(text || '').split('\n').filter(Boolean).flatMap(l => { try { return [JSON.parse(l)]; } catch { return []; } }); }
function metadata(raw) {
  const events = parseLines(raw.stdout), init = events.find(e => e.type === 'system' && e.subtype === 'init'), result = events.findLast(e => e.type === 'result');
  const models = [...new Set([init?.model, ...events.filter(e => e.type === 'assistant').map(e => e.message?.model), ...Object.keys(result?.modelUsage || {})].filter(Boolean))];
  const efforts = [...new Set([init?.effort, init?.effortLevel, result?.effort].filter(Boolean))];
  return { observedModel: models.length === 1 ? models[0] : null, observedEffort: efforts.length === 1 ? efforts[0] : null, reportedModels: models, reportedEfforts: efforts, usage: result?.usage || result?.modelUsage || null, estimatedCostUsd: result?.total_cost_usd ?? null, result: result?.structured_output, providerSuccess: result?.subtype === 'success' && !result?.is_error };
}
function apply(work, c, patch) {
  if (!patch || !Array.isArray(patch.files) || new Set(patch.files.map(f => f.path)).size !== patch.files.length) throw Error('Invalid native file result');
  for (const f of patch.files) {
    if (!c.editable.includes(f.path) || typeof f.content !== 'string' || Buffer.byteLength(f.content) > 40000 || client.sensitive(f.content)) throw Error('Native edit outside bounded stage');
    fs.writeFileSync(noLinks(path.join(work, f.path)), f.content);
  }
}
function oracle(work, c, study, options) {
  // Read-only host, ephemeral /tmp, only this isolated copied snapshot writable.
  const args = ['--ro-bind', '/', '/', '--unshare-net', '--tmpfs', '/tmp', '--bind', work, '/tmp/work', '--chdir', '/tmp/work', '--clearenv', '--setenv', 'PATH', path.dirname(process.execPath) + ':/usr/bin:/bin', '--', process.execPath, c.oracle.path];
  const result = (options.oracleExecute || spawnSync)('bwrap', args, { encoding: 'utf8', timeout: study.manifest.nativeTimeoutMs, maxBuffer: study.manifest.maxOutputBytes });
  let checks; try { checks = JSON.parse(result.stdout).checks; } catch { /* absent means unexecuted */ }
  const valid = Array.isArray(checks) && checks.length === c.oracle.requiredChecks.length && new Set(checks.map(r => r.id)).size === checks.length && c.oracle.requiredChecks.every(id => checks.some(r => r.id === id && ['passed', 'failed', 'skipped'].includes(r.status)));
  return { command: 'bwrap', args, exitCode: result.status, error: result.error?.code || null, stdout: String(result.stdout || ''), stderr: String(result.stderr || ''), requiredChecks: c.oracle.requiredChecks.length, executedChecks: valid ? checks.filter(r => r.status !== 'skipped').length : 0, skipped: valid ? checks.filter(r => r.status === 'skipped').length : null, passed: result.status === 0 && valid && checks.every(r => r.status === 'passed'), checks: valid ? checks : null, transport: options.oracleExecute ? 'simulated' : 'live' };
}
function review(study, id, c, after, oracleResult, options) {
  const blind = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-assess-'));
  try {
    const input = { goal: c.goal, acceptance: c.acceptance, before: c.files, after, oracle: { exitCode: oracleResult.exitCode, stdout: oracleResult.stdout, stderr: oracleResult.stderr, checks: oracleResult.checks } };
    const file = path.join(blind, 'input.json'); atomic(file, input); atomic(path.join(blind, 'schema.json'), reviewSchema);
    const prompt = 'Independently assess this bounded change against its unchanged goal and acceptance. Read input.json with one standalone cat input.json command (no shell chaining). Inspect the before/after code and raw oracle results. Green but skipped/missing required checks are not acceptance. Separate environment failures from product defects. Do not edit, use network, invoke a skill or another model. Return structured findings, tied to violated acceptance or concrete material risks. The findings array contains blocking findings only; use [] when none. Accepted requires no findings AND every required oracle check actually executed and passed. If the oracle did not execute, return blocked, even if the source looks correct. You are blinded to treatment and routing.';
    const invocation = { command: 'codex', args: ['exec', '--model', study.manifest.reviewer.model, '-c', 'model_reasoning_effort="medium"', '--sandbox', 'read-only', '--json', '--ephemeral', '--ignore-user-config', '-c', 'approval_policy="never"', '--skip-git-repo-check', '--output-schema', path.join(blind, 'schema.json'), '-'] };
    const raw = native(study, id, invocation, blind, prompt, options), events = parseLines(raw.stdout);
    const access = collect(events, blind, ['input.json']);
    const last = events.findLast(e => e.type === 'item.completed' && e.item?.type === 'agent_message');
    let value; try { value = JSON.parse(last.item.text); } catch { /* blocked below */ }
    const fullRead = access.receipts.some(r => r.path === 'input.json' && r.extent === 'full');
    const valid = raw.status === 'completed' && fullRead && ['accepted', 'changes_required', 'blocked'].includes(value?.outcome) && typeof value.materialViolation === 'boolean' && Array.isArray(value.findings) && !(value.outcome === 'accepted' && (value.findings.length || value.materialViolation));
    const record = { inputHash: hash(input), input, rawRef: raw.ref || null, receiptHash: raw.receiptHash || null, access, value: valid ? value : null, status: valid ? 'completed' : 'unavailable', reason: valid ? null : 'missing_valid_independent_review', elapsedMs: raw.elapsedMs };
    atomic(path.join(study.dir, 'reviews', id + '.json'), record);
    return { ...record, ref: path.join(study.dir, 'reviews', id + '.json') };
  } finally { fs.rmSync(blind, { recursive: true, force: true }); }
}
async function trial(dir, c, options = {}) {
  if (process.env.SPECFLOW_DUO_REVIEWER) throw Error('Reviewer cannot launch effort trials');
  const study = routing.load(dir); validateCase(study, c);
  const key = routing.familyKey(c.repository, c.taskFamilyId), caseHash = hash(c);
  const id = hash({ cohort: study.manifest.cohortId, key });
  let prior;
  routing.lock(study, () => {
    prior = routing.events(study).find(e => e.type === 'pair-start' && e.key === id);
    if (prior && prior.value.caseHash !== caseHash) throw Error('One frozen indexed stage per family; use a new cohort for changed cases');
    if (!prior) routing.put(study, 'pair-start', id, { pid: process.pid, value: { repository: c.repository, taskFamilyId: c.taskFamilyId, loop: c.loop, stage: c.stage, caseHash, independentUnit: c.independentUnit, startedAt: new Date().toISOString() } });
  });
  if (prior) { routing.reports(dir); return { pairId: id, status: routing.events(study).some(e => e.type === 'pair' && e.key === id) ? 'replay' : 'interrupted', nextAction: 'Read retained pair/attempt records; uncertain dispatch is not repeated.' }; }
  const base = path.join(dir, 'pairs', id); atomic(path.join(base, 'case.json'), c);
  const snapshotHash = hash(c.files), acceptanceHash = hash({ goal: c.goal, acceptance: c.acceptance, oracle: c.oracle });
  const configured = { model: study.manifest.model, effort: study.manifest.baseline[c.loop] };
  let receipt;
  try { receipt = await routing.observe(dir, { repository: c.repository, taskFamilyId: c.taskFamilyId, runId: id, stage: c.stage, loop: c.loop, attempt: 0, snapshotHash, goal: c.goal, acceptance: c.acceptance, context: JSON.stringify(c.files), recentEvidence: [], configured, requested: configured, evidenceRefs: [path.join(base, 'case.json')] }, options); }
  catch { receipt = { status: 'unavailable', reason: 'observation_recording_failure' }; }
  const startedAt = new Date().toISOString(), arms = {}, order = parseInt(hash({ seed: study.manifest.seed, key }).slice(0, 8), 16) % 2 ? ['medium', 'high'] : ['high', 'medium'];
  const prompt = JSON.stringify({ instruction: 'Implement the acceptance in the editable files. Return complete replacement text for changed editable files in the supplied JSON schema. No test/acceptance changes. No external actions.', goal: c.goal, acceptance: c.acceptance, files: c.files, editable: c.editable });
  // Native stdout may omit effective effort: keep that unknown, never infer it
  // from the flag or the model's own prose. Such arms cannot be comparative proof.
  for (const effort of order) {
    const start = Date.now(), work = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-trial-'));
    try {
      for (const [name, text] of Object.entries(c.files)) { const file = path.join(work, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); }
      const invocation = require('./specflow-runner.cjs').buildAdapterCommand({ provider: 'claude-print', model: study.manifest.model, effort, args: ['-p', '--output-format', 'stream-json', '--verbose', '--tools', '', '--permission-mode', 'dontAsk', '--disable-slash-commands', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}', '--no-session-persistence', '--setting-sources', '', '--safe-mode', '--json-schema', JSON.stringify(patchSchema)], prompt });
      const raw = native(study, id + '-' + effort, invocation, work, undefined, { ...options, repository: c.repository, runId: id }), meta = metadata(raw);
      if (raw.status !== 'completed' || !meta.providerSuccess) throw Object.assign(Error(raw.reason || 'missing_native_result'), { raw, meta });
      apply(work, c, meta.result);
      const after = Object.fromEntries(Object.keys(c.files).map(name => [name, fs.readFileSync(path.join(work, name), 'utf8')]));
      const check = oracle(work, c, study, options), oracleRef = path.join(base, effort + '-oracle.json');
      if (client.sensitive(check)) throw Error('Sensitive oracle output'); atomic(oracleRef, check);
      if (Object.entries(after).some(([name, text]) => fs.readFileSync(path.join(work, name), 'utf8') !== text)) throw Error('Oracle changed reviewed snapshot');
      const peer = review(study, id + '-' + effort + '-review', c, after, check, { ...options, repository: c.repository, runId: id });
      arms[effort] = { status: peer.status, requestedModel: study.manifest.model, requestedEffort: effort, observedModel: meta.observedModel, observedEffort: meta.observedEffort, deviation: meta.observedModel !== study.manifest.model || meta.observedEffort !== effort, snapshotHash, acceptanceHash, oracleRef, reviewRef: peer.ref, invocationRef: raw.ref, receiptHash: raw.receiptHash, requiredChecks: check.requiredChecks, executedChecks: check.executedChecks, skipped: check.skipped, accepted: check.passed && peer.value?.outcome === 'accepted', materialViolation: peer.value?.materialViolation ?? null, elapsedMs: Date.now() - start, usage: meta.usage, estimatedCostUsd: meta.estimatedCostUsd, billing: null, planQuota: null, repairRounds: 0, reviewRounds: 1, after };
    } catch (e) { arms[effort] = { status: 'unavailable', reason: e.message, invocationRef: e.raw?.ref || null, observedModel: e.meta?.observedModel || null, observedEffort: e.meta?.observedEffort || null, elapsedMs: Date.now() - start }; }
    finally { fs.rmSync(work, { recursive: true, force: true }); }
  }
  const value = { repository: c.repository, taskFamilyId: c.taskFamilyId, loop: c.loop, stage: c.stage, caseHash, snapshotHash, acceptanceHash, decisionId: receipt.decisionId || null, observationStatus: receipt.status, startedAt, order, independentUnit: c.independentUnit, blindedReview: true, transport: options.execute || options.oracleExecute || options.fetchImpl ? 'simulated' : 'live', arms };
  atomic(path.join(base, 'result.json'), value);
  routing.lock(study, () => routing.put(study, 'pair', id, { value }));
  routing.terminal(dir, id, 'completed', [path.join(base, 'result.json')], c.repository);
  routing.reports(dir);
  return { pairId: id, status: 'recorded', resultRef: path.join(base, 'result.json'), nextAction: 'Read the private report. Recorded trials do not establish improvement.' };
}
// Reconstruct eligibility from raw native/oracle/peer records before reporting.
// The math module also accepts synthetic objects for isolated statistical tests;
// production reports always pass this verification boundary first.
function verifyEvidence(study, pair) {
  const result = structuredClone(pair);
  try {
    const id = hash({ cohort: study.manifest.cohortId, key: routing.familyKey(pair.repository, pair.taskFamilyId) });
    const c = routing.read(path.join(study.dir, 'pairs', id, 'case.json'));
    validateCase(study, c);
    if (hash(c) !== pair.caseHash || hash(c.files) !== pair.snapshotHash || hash({goal:c.goal,acceptance:c.acceptance,oracle:c.oracle}) !== pair.acceptanceHash) throw Error('case_identity');
    for (const effort of ['medium','high']) {
      const a = result.arms[effort]; if (!a || a.status !== 'completed') continue;
      const raw = routing.read(a.invocationRef), meta = metadata(raw), peer = routing.read(a.reviewRef), check = routing.read(a.oracleRef), peerRaw = routing.read(peer.rawRef);
      const validChecks = Array.isArray(check.checks) && check.checks.length === c.oracle.requiredChecks.length && new Set(check.checks.map(r=>r.id)).size === check.checks.length && c.oracle.requiredChecks.every(id=>check.checks.some(r=>r.id===id && ['passed','failed','skipped'].includes(r.status)));
      if (hash(raw) !== a.receiptHash || hash(peerRaw) !== peer.receiptHash || raw.status !== 'completed' || peerRaw.status !== 'completed' || raw.transport !== pair.transport || peerRaw.transport !== pair.transport || !meta.providerSuccess || !validChecks || hash(peer.input) !== peer.inputHash || hash(peer.input.before) !== hash(c.files) || hash(peer.input.after) !== hash(a.after) || peer.input.goal !== c.goal || peer.input.acceptance !== c.acceptance || peer.input.oracle.stdout !== check.stdout || peer.input.oracle.exitCode !== check.exitCode || peer.status !== 'completed' || !peer.access.receipts.some(r=>r.path==='input.json' && r.extent==='full')) throw Error('raw_provenance');
      const args = raw.invocation.args, applied = args[args.indexOf('--effort')+1];
      if (applied !== effort || args[args.indexOf('--model')+1] !== study.manifest.model || args.filter(x=>x==='--effort').length!==1) throw Error('invocation_mismatch');
      a.observedModel = meta.observedModel; a.observedEffort = meta.observedEffort;
      a.deviation = meta.observedModel !== study.manifest.model || meta.observedEffort !== effort;
      a.requiredChecks = c.oracle.requiredChecks.length; a.executedChecks = check.checks.filter(r=>r.status!=='skipped').length; a.skipped = check.checks.filter(r=>r.status==='skipped').length;
      a.accepted = check.exitCode === 0 && check.checks.every(r=>r.status==='passed') && peer.value?.outcome === 'accepted' && peer.value.findings.length === 0 && peer.value.materialViolation === false;
      a.materialViolation = peer.value?.materialViolation ?? null;
    }
  } catch(e) { result.evidenceError = e.message; result.arms = {}; }
  return result;
}
module.exports = { trial, validateCase, metadata, apply, oracle, verifyEvidence };
