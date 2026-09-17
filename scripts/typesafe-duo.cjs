'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const client = require('./typesafe-client.cjs');
const prompts = require('./typesafe-questions.cjs');
const excluded = name => /(^|\/)(\.env(?:\.[^/]*)?|[^/]*\.(?:pem|key)|credentials(?:\.[^/]*)?)$|(^|\/)(?:production|prod)[-_/].*log|(^|\/)logs\/production|(?:production|prod)\.log$/i.test(name);
function config(previous = {}, update = {}) {
  const next = { mode: 'shadow', model: 'jev-1.13.0', maxCalls: 20, calls: 0, consecutiveFailures: 0, changes: [], ...previous, ...update };
  if (next.envFile && (typeof next.envFile !== 'string' || !/^\.env(?:\.[^/]*)?$/.test(path.basename(next.envFile)))) throw Error('Explicit credential file must use a protected .env name');
  if (!['off', 'shadow', 'advisory'].includes(next.mode) || !Number.isInteger(next.maxCalls) || next.maxCalls < 1 || next.maxCalls > 100 || !/^jev-\d+\.\d+\.\d+$/.test(next.model)) throw Error('Invalid TypeSafe configuration');
  return next;
}
function peerEnv(env) { return Object.fromEntries(Object.entries(env).filter(([key]) => !/^TYPESAFE_/i.test(key))); }
function run({ state, batch, tree, round, dir, snapshot, save, execute = spawnSync }) {
  if (process.env.SPECFLOW_DUO_REVIEWER) throw Error('Recursive TypeSafe advice forbidden');
  const cfg = state.typesafe = config(state.typesafe);
  if (cfg.mode === 'off') return { status: 'off', flags: [] };
  const outDir = path.join(dir, 'typesafe', path.basename(round));
  const recordFile = path.join(outDir, 'check.json');
  const unavailable = reason => { const r = { status: 'unavailable', reason, snapshotHash: snapshot, flags: [] }; client.atomic(recordFile, r); return r; };
  if (cfg.calls >= cfg.maxCalls) return unavailable('budget_exhausted');
  if (cfg.consecutiveFailures >= 2) return unavailable('circuit_open');
  if (!Array.isArray(batch.typesafe) || !batch.typesafe.length) return unavailable('missing_selection');
  const manifest = JSON.parse(fs.readFileSync(path.join(round, 'manifest.json')));
  const selections = []; const allQuestions = {}; const omitted = [];
  function selected(name, evidence = false) {
    if (typeof name !== 'string' || excluded(name) || name.startsWith('.specflow/') || !Object.hasOwn(manifest, name) || (evidence && !batch.evidence.includes(name))) throw Error('invalid_selection');
    const file = path.resolve(tree, name);
    if (!file.startsWith(path.resolve(tree) + path.sep)) throw Error('invalid_selection');
    client.noLinks(file);
    const bytes = fs.readFileSync(file);
    if (bytes.length > 32768) throw Error('input_limit');
    return { path: name, sha256: client.hash(bytes.toString('utf8')), text: bytes.toString('utf8') };
  }
  try {
    for (const [i, selection] of batch.typesafe.entries()) {
      if (!batch.criteria.includes(selection.criterion) || !Number.isInteger(selection.claimIndex) || typeof batch.claims[selection.claimIndex] !== 'string' || !Array.isArray(selection.evidencePaths) || !selection.evidencePaths.length) throw Error('invalid_selection');
      const item = { criterion: state.criteria[selection.criterion].anchor, criterionId: selection.criterion, claim: batch.claims[selection.claimIndex], assertion: selected(selection.assertionPath), evidence: selection.evidencePaths.map(f => selected(f, true)), objective: state.context.objective };
      if (selection.repair) {
        if (typeof selection.repair.description !== 'string' || typeof selection.repair.observation !== 'string') throw Error('invalid_selection');
        item.repair = selection.repair.description; item.observation = selection.repair.observation;
        item.finding = Object.values(state.findings).filter(f => f.status === 'open' && (f.criterion === selection.criterion || !f.criterion));
        item.priorObservations = state.history.slice(0, -1).flatMap(r => (r.review?.diagnostics || []).map((d, j) => ({ id: `round-${r.at}-${j}`, ...d })));
        Object.assign(allQuestions, prompts.repairQuestions(`q${i}_`, `items[${i}].`));
      }
      selections.push(item); Object.assign(allQuestions, prompts.questions(`q${i}_`, `items[${i}].`));
    }
    for (const id of batch.criteria) if (!batch.typesafe.some(s => s.criterion === id)) omitted.push(id);
    const input = { snapshotHash: snapshot, questionSetId: prompts.SET, questionVersion: prompts.VERSION, model: cfg.model, state: { goal: fs.readFileSync(path.join(round, 'goal.md'), 'utf8'), items: selections, omittedCriteria: omitted }, questions: allQuestions };
    const key = client.credentials(process.env, cfg.envFile);
    if (client.sensitive(input, key)) return unavailable('sensitive_input');
    if (!key) return unavailable('missing_credentials');
    if (Buffer.byteLength(JSON.stringify(input)) > 65536) return unavailable('input_limit');
    const inputFile = path.join(outDir, 'input.json'); client.atomic(inputFile, input);
    // Save reservation before crossing the process/network boundary. Crashes consume budget.
    cfg.calls++; save();
    const attempt = execute(process.execPath, [path.join(__dirname, 'typesafe-client.cjs'), inputFile, recordFile, ...(cfg.envFile ? [cfg.envFile] : [])], { encoding: 'utf8', timeout: 20000, maxBuffer: 2048, env: process.env });
    let result;
    if (fs.existsSync(recordFile)) result = JSON.parse(fs.readFileSync(recordFile));
    if (!result || result.status === 'pending') { result = { status: 'unavailable', reason: 'interrupted', snapshotHash: snapshot }; client.atomic(recordFile, result); }
    if (attempt.error && result.status === 'completed') result = { status: 'unavailable', reason: 'transport', snapshotHash: snapshot };
    cfg.consecutiveFailures = result.status === 'completed' ? 0 : cfg.consecutiveFailures + 1; save();
    const flags = Object.entries(result.response?.answers || {}).filter(([id, answer]) => {
      const kind = id.split('_').at(-1);
      return answer.confidence < 0.8 || (kind === 'support' ? answer.choice !== 'supports' : kind === 'coverage' ? answer.choice !== 'full' : kind === 'alignment' ? ['optional', 'unrelated', 'insufficient'].includes(answer.choice) : kind === 'novelty' ? answer.choice !== 'new_observation' : ['hypothesis','insufficient'].includes(answer.choice));
    }).map(([id, answer]) => ({ id, answer }));
    // 0.8 is a disclosure heuristic, never a calibrated acceptance threshold.
    const summary = { ...result, flags, omittedCriteria: omitted, selected: selections.map(s => ({ criterion: s.criterionId, assertion: s.assertion.path, evidence: s.evidence.map(e => e.path) })) };
    client.atomic(path.join(outDir, 'advice.json'), summary);
    return summary;
  } catch (error) { return unavailable(['invalid_selection', 'input_limit'].includes(error.message) ? error.message : 'invalid_selection'); }
}
function attach(request, schema, advice, round) {
  client.atomic(path.join(round, 'typesafe-advice.json'), advice);
  request.typesafe = { file: 'typesafe-advice.json', flags: advice.flags.map(f => f.id) };
  request.requiredReads.push('typesafe-advice.json');
  const modified = JSON.parse(JSON.stringify(schema));
  modified.required.push('typesafe_dispositions');
  modified.properties.typesafe_dispositions = { type: 'array', items: { type: 'object', additionalProperties: false, required: ['id', 'status', 'evidence', 'reason'], properties: { id: { type: 'string' }, status: { type: 'string', enum: ['confirmed', 'rejected', 'needs_evidence'] }, evidence: { type: 'array', items: { type: 'string' } }, reason: { type: 'string' } } } };
  return modified;
}
function validate(result, request, round) {
  if (!request.typesafe) return;
  const rows = result.typesafe_dispositions;
  if (!Array.isArray(rows) || rows.length !== request.typesafe.flags.length || new Set(rows.map(r => r.id)).size !== rows.length) throw Error('Missing TypeSafe dispositions');
  for (const r of rows) {
    if (!request.typesafe.flags.includes(r.id) || !['confirmed', 'rejected', 'needs_evidence'].includes(r.status) || !r.reason?.trim() || !Array.isArray(r.evidence) || !r.evidence.length) throw Error('TypeSafe disposition requires inspected raw evidence');
    let raw = false;
    for (const reference of r.evidence) {
      if (typeof reference !== 'string') throw Error('Invalid TypeSafe evidence reference');
      const name = reference.startsWith('tree/') ? reference.slice(5) : reference;
      if (!result.inspected.includes(`tree/${name}`)) throw Error('TypeSafe evidence was not inspected');
      if (request.batch.evidence.includes(name)) { raw = true; continue; }
      const base = path.resolve(round, 'tree'), file = path.resolve(base, name);
      if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(client.noLinks(file)).isFile()) throw Error('TypeSafe evidence is outside the snapshot');
    }
    if (!raw) throw Error('TypeSafe disposition requires inspected raw evidence');
  }
}
module.exports = { config, run, attach, validate, peerEnv, excluded };
