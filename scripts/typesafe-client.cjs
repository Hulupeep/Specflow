#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const hash = x => crypto.createHash('sha256').update(typeof x === 'string' ? x : JSON.stringify(x)).digest('hex');
const object = x => x && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const probability = x => Number.isFinite(x) && x >= 0 && x <= 1;
const sameKeys = (a, b) => object(a) && object(b) && JSON.stringify(Object.keys(a).sort()) === JSON.stringify(Object.keys(b).sort());
function guard() { if (process.env.SPECFLOW_DUO_REVIEWER) throw Error('Recursive TypeSafe call forbidden in peer reviewer'); }
function noLinks(file) {
  const full = path.resolve(file); let current = path.parse(full).root;
  for (const part of full.slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw Error('Symlink in record path');
  }
  return full;
}
function atomic(file, value) {
  noLinks(file); fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${crypto.randomBytes(8).toString('hex')}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  fs.renameSync(tmp, file);
}
function credentials(env = process.env, envFile) {
  let selected = { ...env };
  if (envFile) {
    noLinks(envFile);
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?(TYPESAFE_API_KEY|TYPESAFE_API)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      else value = value.replace(/\s+#.*$/, '');
      if (!selected[m[1]]) selected[m[1]] = value;
    }
  }
  return selected.TYPESAFE_API_KEY?.trim() || selected.TYPESAFE_API?.trim() || '';
}
function sensitive(value, key = '') {
  const raw = JSON.stringify(value);
  return Boolean(key && raw.includes(key)) || /(?:-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat)[-_][a-zA-Z0-9_-]{16,}|bearer\s+[a-zA-Z0-9._-]{12,}|(?:api[_-]?key|password|secret|access[_-]?token)\s*["']?\s*[:=]\s*["']?[^\s"',}]{8,})/i.test(raw);
}
function validateInput(input) {
  if (!object(input) || !text(input.snapshotHash) || !text(input.questionSetId) || !text(input.questionVersion) || !/^jev-(?:latest|preview|\d+\.\d+\.\d+)$/.test(input.model || '') || input.state == null || !object(input.questions) || !Object.keys(input.questions).length) throw Error('invalid_input');
  for (const key of ['snapshotHash', 'questionSetId', 'questionVersion']) if (!/^[a-zA-Z0-9_.:-]{1,160}$/.test(input[key])) throw Error('invalid_input');
  if (typeof input.state !== 'string' && typeof input.state !== 'object') throw Error('invalid_input');
  for (const [id, q] of Object.entries(input.questions)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(id) || !object(q) || !text(q.instructions) || !['choice', 'score', 'noul'].includes(q.type)) throw Error('invalid_input');
    if (q.type === 'choice' && (!object(q.criteria) || Object.keys(q.criteria).length < 2 || !Object.values(q.criteria).every(x => x === null || text(x)))) throw Error('invalid_input');
    if (q.type === 'score' && (!Array.isArray(q.criteria) || q.criteria.length < 2 || !q.criteria.every(text))) throw Error('invalid_input');
    if (q.type === 'noul' && q.criteria !== undefined && !object(q.criteria)) throw Error('invalid_input');
  }
}
function validateResponse(result, input) {
  if (!object(result) || !text(result.model) || !sameKeys(result.answers, input.questions) || !object(result.usage) || !['input_tokens', 'output_tokens'].every(k => Number.isSafeInteger(result.usage[k]) && result.usage[k] >= 0)) throw Error('invalid_response');
  if (!['jev-latest', 'jev-preview'].includes(input.model) && result.model !== input.model) throw Error('invalid_response');
  const answers = {};
  for (const [id, q] of Object.entries(input.questions)) {
    const a = result.answers[id];
    if (!object(a) || a.type !== q.type) throw Error('invalid_response');
    if (q.type === 'noul') {
      if (!probability(a.noul) || a.confidence !== undefined) throw Error('invalid_response');
      answers[id] = { type: 'noul', noul: a.noul }; continue;
    }
    const choices = q.type === 'choice' ? q.criteria : Object.fromEntries(q.criteria.map((s, i) => [String(i), s]));
    if (!sameKeys(a.probabilities, choices) || !Object.values(a.probabilities).every(probability) || Math.abs(Object.values(a.probabilities).reduce((s, n) => s + n, 0) - 1) > 1e-6 || !probability(a.confidence)) throw Error('invalid_response');
    if (q.type === 'choice') {
      if (!Object.hasOwn(choices, a.choice)) throw Error('invalid_response');
      answers[id] = { type: 'choice', choice: a.choice, probabilities: a.probabilities, confidence: a.confidence };
    } else {
      if (!Number.isFinite(a.score) || a.score < 0 || a.score > q.criteria.length - 1 || !sameKeys(a.legend, choices) || Object.entries(choices).some(([k, v]) => a.legend[k] !== v)) throw Error('invalid_response');
      answers[id] = { type: 'score', score: a.score, legend: a.legend, probabilities: a.probabilities, confidence: a.confidence };
    }
  }
  return { model: result.model, answers, usage: { input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens } };
}
async function evaluate(input, options = {}) {
  guard();
  const { file, envFile, env = process.env, fetchImpl = fetch, timeoutMs = 15000 } = options;
  if (!file) throw Error('Explicit record file required');
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > 60000) throw Error('Invalid timeout');
  const inputHash = hash(input), identity = hash({ inputHash, snapshot: input.snapshotHash, set: input.questionSetId, version: input.questionVersion, model: input.model });
  noLinks(file);
  if (fs.existsSync(file)) {
    const prior = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (prior.identity !== identity) throw Error('Record identity mismatch; use a new check ID');
    if (prior.status === 'pending') { const recovered = { ...prior, status: 'unavailable', reason: 'interrupted' }; atomic(file, recovered); return recovered; }
    if (prior.status === 'completed' && prior.modelPinned) {
      validateResponse(prior.response, input);
      return { ...prior, origin: 'replay', replayOf: prior.origin, networkCalls: 0 };
    }
    return { ...prior, origin: 'replay', historical: true, networkCalls: 0 };
  }
  let key = ''; let credentialFailure = false;
  try { key = credentials(env, envFile); } catch { credentialFailure = true; }
  const safeMetadata = value => typeof value === 'string' && /^[a-zA-Z0-9_.:-]{1,160}$/.test(value) && !sensitive(value, key) ? value : undefined;
  const record = { version: 1, checkId: path.basename(file, '.json'), snapshotHash: safeMetadata(input.snapshotHash), inputHash, identity, questionSetId: safeMetadata(input.questionSetId), questionVersion: safeMetadata(input.questionVersion), requestedModel: safeMetadata(input.model), modelPinned: !['jev-latest', 'jev-preview'].includes(input.model), status: 'pending', origin: 'live', at: new Date().toISOString(), networkCalls: 0, questionCount: Object.keys(input.questions || {}).length };
  atomic(file, record);
  const started = Date.now(), controller = new AbortController(); let timer;
  try {
    validateInput(input);
    if (credentialFailure) throw Error('missing_credentials');
    if (sensitive(input, key)) throw Error('sensitive_input');
    const body = JSON.stringify({ state: input.state, questions: input.questions, model: input.model });
    if (Buffer.byteLength(body) > 65536) throw Error('input_limit');
    if (!key) throw Error('missing_credentials');
    record.networkCalls = 1; atomic(file, record);
    const operation = (async () => {
      const response = await fetchImpl('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body, signal: controller.signal, redirect: 'error' });
      if (!response.ok) { await response.body?.cancel(); throw Error([401, 403].includes(response.status) ? 'auth' : response.status === 429 ? 'rate_limit' : 'provider_error'); }
      const reader = response.body.getReader(), parts = []; let bytes = 0;
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength;
        if (bytes > 262144) { await reader.cancel(); throw Error('response_limit'); }
        parts.push(Buffer.from(value));
      }
      let parsed; try { parsed = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw Error('invalid_response'); }
      return validateResponse(parsed, input);
    })();
    const deadline = new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(Error('timeout')); }, timeoutMs); });
    record.response = await Promise.race([operation, deadline]);
    record.reportedModel = record.response.model; record.usage = record.response.usage; record.status = 'completed';
  } catch (error) {
    record.status = 'unavailable';
    record.reason = ['missing_credentials', 'invalid_input', 'sensitive_input', 'input_limit', 'auth', 'rate_limit', 'provider_error', 'response_limit', 'invalid_response', 'timeout'].includes(error.message) ? error.message : 'transport';
  } finally { clearTimeout(timer); record.elapsedMs = Date.now() - started; atomic(file, record); }
  return record;
}
async function cli(args) {
  guard(); const [input, output, envFile] = args;
  if (!input || !output) throw Error('Usage: typesafe-client.cjs input.json private-record.json [explicit-env-file]');
  const result = await evaluate(JSON.parse(fs.readFileSync(input, 'utf8')), { file: output, envFile });
  console.log(JSON.stringify({ status: result.status, reason: result.reason, record: output }));
  return result.status === 'completed' ? 0 : 2;
}
module.exports = { evaluate, validateInput, validateResponse, credentials, sensitive, atomic, noLinks, hash, cli };
if (require.main === module) cli(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(() => { console.error('TypeSafe unavailable: invalid invocation or record; inspect local configuration'); process.exitCode = 2; });
