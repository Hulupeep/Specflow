'use strict';
// Bounded memory primitives. Authority and atomic commits belong to the controller.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ZERO = '0'.repeat(64);
// Only trusted-host resolvers can bind captured execution provenance. It cannot
// arrive as an extra field in a caller's JSON evidence reference.
const observations = new WeakMap();
class MemoryError extends Error {
  constructor(code) { super(code); this.code = code; }
}
const need = (v, code) => { if (!v) throw new MemoryError(code); };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
const digest = v => hash(canonical(v));
const token = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(v);
const sha = v => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const text = (v, max = 2000) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
function shape(v, allowed, required = allowed) {
  need(v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(v, k)), 'invalid_memory_request');
}
function affectedPaths(values) {
  need(Array.isArray(values) && values.length > 0 && values.length <= 32, 'invalid_memory_paths');
  for (const p of values) need(typeof p === 'string' && p.length <= 512 && !path.isAbsolute(p) &&
    !p.includes('\\') && !p.split('/').some(x => !x || x === '.' || x === '..' || x === '.git'), 'invalid_memory_paths');
  return [...new Set(values)].sort();
}
function family(value) {
  shape(value, ['affected_paths', 'observable']);
  need(text(value.observable, 160), 'invalid_memory_family');
  const observable = value.observable.normalize('NFKC').toLowerCase().replace(/[\s_.:/-]+/g, '');
  need(/^[a-z0-9]+$/.test(observable), 'invalid_memory_family');
  return { affected_paths: affectedPaths(value.affected_paths), observable };
}
function familyKey(repo, value) { return digest({ repo: hash(repo), family: family(value) }); }
function actor(value, principal) {
  shape(value, ['principal', 'holder', 'assignment_revision', 'role']);
  need(token(value.principal) && token(value.holder) && token(value.assignment_revision) &&
    ['owner', 'researcher', 'builder', 'evaluator'].includes(value.role) &&
    (!principal || principal === value.principal), 'invalid_memory_actor');
  return structuredClone(value);
}
function events(state, repo) {
  let previous = ZERO, sequence = 0;
  const rows = [];
  for (const entry of state.history) {
    if (entry.event !== 'memory') continue;
    const row = entry.memory;
    need(row && row.version === 1 && sha(row.hash), 'memory_chain_corrupt');
    if (row.canonical_repo_digest !== hash(repo)) continue;
    const { hash: saved, ...body } = row;
    need(body.previous === previous && body.sequence === ++sequence && digest(body) === saved, 'memory_chain_corrupt');
    previous = saved; rows.push(row);
  }
  for (const r of Object.values(state.runs || {})) {
    if (r.canonical_repo !== repo || !r.memory_head) continue;
    need(rows.some(e => e.sequence === r.memory_head.sequence && e.hash === r.memory_head.hash), 'memory_chain_corrupt');
  }
  return rows;
}
function revision(state, repo) { return events(state, repo).at(-1)?.hash || ZERO; }
function append(state, repo, runId, who, kind, data, now) {
  const rows = events(state, repo), r = state.runs[runId];
  need(r && r.canonical_repo === repo && token(kind), 'memory_run_unavailable');
  need(Buffer.byteLength(canonical(data)) <= 256 * 1024, 'memory_capacity');
  const body = { version: 1, canonical_repo_digest: hash(repo), sequence: rows.length + 1,
    previous: rows.at(-1)?.hash || ZERO, run_id: runId, kind, actor: actor(who), data: structuredClone(data) };
  const row = { ...body, hash: digest(body) };
  state.history.push({ event: 'memory', at_ms: now, run_id: runId, memory: row });
  r.memory_head = { sequence: row.sequence, hash: row.hash };
  return row;
}
function priorCommand(state, repo, who, request) {
  need(token(request.request_id) && sha(request.expected_revision), 'invalid_memory_request');
  const key = digest([who.principal, request.request_id]), input = digest(request);
  const row = events(state, repo).find(e => e.kind === 'command' && e.data.command_key === key);
  if (row) {
    need(row.data.input_digest === input, 'memory_idempotency_conflict');
    return { ...structuredClone(row.data.result), id: row.hash, revision: row.hash, duplicate: true };
  }
  need(revision(state, repo) === request.expected_revision, 'memory_revision_conflict');
  return null;
}
function finishCommand(state, repo, runId, who, request, type, data, result, now) {
  const row = append(state, repo, runId, who, 'command', {
    command_key: digest([who.principal, request.request_id]), input_digest: digest(request),
    type, ...data, result: structuredClone(result)
  }, now);
  return { ...result, id: row.hash, revision: row.hash, duplicate: false };
}
function pack(state, repo, repoId) {
  const rows = events(state, repo), selected = rows.slice(-128);
  return { version: 1, repo_id: repoId, revision: rows.at(-1)?.hash || ZERO,
    events: structuredClone(selected), truncated: rows.length > selected.length,
    limitations: ['advisory_untrusted', ...(rows.length > selected.length ? ['projection_truncated_history_retained'] : [])] };
}
function resolveEvidence(host, refs, { repoId, familyKey: key, paths, observable }) {
  need(Array.isArray(refs) && refs.length > 0 && refs.length <= 32 &&
    new Set(refs.map(r => r.id)).size === refs.length, 'invalid_memory_evidence');
  return refs.map(ref => {
    shape(ref, ['id', 'sha256']);
    need(token(ref.id) && sha(ref.sha256), 'invalid_memory_evidence');
    const e = host.resolveEvidence(ref);
    shape(e, ['id', 'sha256', 'repo_id', 'family_key', 'source_revision', 'affected_paths', 'actor',
      'executed', 'failed', 'skipped', 'exit_code', 'valid', 'failure_category']);
    actor(e.actor);
    const proof = observations.get(e);
    need(proof && sha(proof.key), 'memory_observation_capture_required');
    if (observable) need(proof.metric === family({affected_paths: paths, observable}).observable, 'memory_evidence_unavailable');
    const scope = affectedPaths(e.affected_paths);
    need(e.id === ref.id && e.sha256 === ref.sha256 && e.repo_id === repoId && e.family_key === key &&
      sha(e.source_revision) && scope.some(p => paths.includes(p)) &&
      e.actor.role !== 'builder' && Number.isSafeInteger(e.executed) && e.executed > 0 &&
      e.failed === 0 && e.skipped === 0 && e.exit_code === 0 && e.valid === true &&
      e.failure_category === 'none', 'memory_evidence_unavailable');
    // Export only typed provenance, never artifact contents, paths or provider text.
    return { ...ref, source_revision: e.source_revision, affected_paths: scope, actor: e.actor,
      observation_key: proof.key };
  });
}
function bindCapturedEvidence(evidence, capture) {
  const summary = require('./review-continuation.cjs').evidenceSummary([{text:JSON.stringify(capture)}]);
  need(summary.execution && capture.exitCode === 0 && capture.error === null, 'memory_observation_capture_required');
  let measurement;
  try { measurement = JSON.parse(capture.stdout); } catch { throw new MemoryError('memory_measurement_invalid'); }
  shape(measurement, ['metric', 'observed']);
  need(text(measurement.metric,160) && (typeof measurement.observed === 'boolean' ||
    (typeof measurement.observed === 'number' && Number.isFinite(measurement.observed)) ||
    text(measurement.observed)), 'memory_measurement_invalid');
  const metric = family({affected_paths:evidence.affected_paths,observable:measurement.metric}).observable;
  observations.set(evidence, { metric, key:digest({repo_id:evidence.repo_id,family_key:evidence.family_key,
    metric,observed:measurement.observed,sourceBefore:capture.sourceBefore,sourceAfter:capture.sourceAfter}) });
  return evidence;
}
function privateFile(file, directory = false) {
  need(path.isAbsolute(file), 'memory_private_source_required');
  for (let p = file; p !== path.dirname(p); p = path.dirname(p))
    if (fs.existsSync(p)) need(!fs.lstatSync(p).isSymbolicLink(), 'memory_unsafe_source');
  let s; try { s = fs.statSync(file); } catch { throw new MemoryError('memory_evidence_unavailable'); }
  need(s.uid === process.getuid() && !(s.mode & 0o077) &&
    (directory ? s.isDirectory() : s.isFile() && s.nlink === 1 && s.size <= 256 * 1024), 'memory_private_source_required');
}
function createFileEvidenceResolver(root) {
  privateFile(root, true);
  return ref => {
    need(token(ref.id) && sha(ref.sha256), 'invalid_memory_evidence');
    const file = path.join(root, ref.id + '.json');
    privateFile(file);
    const bytes = fs.readFileSync(file);
    need(hash(bytes) === ref.sha256, 'memory_evidence_changed');
    let parsed; try { parsed = JSON.parse(bytes); } catch { throw new MemoryError('memory_evidence_corrupt'); }
    const { version, capture_sha256, ...doc } = parsed;
    need(version === 1 && sha(capture_sha256) && !Object.hasOwn(doc, 'sha256'), 'memory_observation_capture_required');
    const trace = path.join(root, ref.id + '.capture.json');
    privateFile(trace);
    const raw = fs.readFileSync(trace);
    need(hash(raw) === capture_sha256, 'memory_evidence_changed');
    let capture; try { capture=JSON.parse(raw); } catch { throw new MemoryError('memory_evidence_corrupt'); }
    return bindCapturedEvidence({ ...doc, sha256: ref.sha256 },capture);
  };
}
module.exports = { ZERO, MemoryError, need, shape, token, text, sha, hash, canonical, digest,
  affectedPaths, family, familyKey, actor, events, revision, append, priorCommand, finishCommand,
  pack, resolveEvidence, bindCapturedEvidence, createFileEvidenceResolver };
