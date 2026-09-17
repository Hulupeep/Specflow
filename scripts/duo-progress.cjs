'use strict';
// Small, deterministic goal ledger. Sources remain authoritative; this indexes them.
const crypto = require('crypto');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const validId = id => typeof id === 'string' && /^[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+$/.test(id);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function unique(values, label) {
  if (!Array.isArray(values) || new Set(values).size !== values.length) throw Error(`${label} must be a unique array`);
}
function definitions(criteria, task, read) {
  if (!Array.isArray(criteria) || !criteria.length) throw Error('An acceptance index is required; read the task and required gates first');
  const index = {};
  for (const item of criteria) {
    if (!validId(item.id) || index[item.id] || !['acceptance', 'gate'].includes(item.kind) || !nonempty(item.anchor)) throw Error('Invalid or duplicate criterion definition');
    const source = read(item.source);
    if (!source.includes(item.anchor) || (item.kind === 'acceptance' && !new RegExp(`(^|[^A-Z0-9-])${item.id}(?![A-Z0-9-])`).test(item.anchor))) throw Error(`Criterion ${item.id} has no exact source anchor`);
    index[item.id] = { id: item.id, source: item.source, anchor: item.anchor, kind: item.kind };
  }
  const ids = new Set(read(task).match(/\bAC-[A-Z0-9]+(?:-[A-Z0-9]+)*\b/g) || []);
  for (const id of ids) if (!index[id] || index[id].kind !== 'acceptance' || index[id].source !== task) throw Error(`Task acceptance omitted from index: ${id}`);
  return index;
}
function upgrade(state) {
  if (state.version >= 2) return state;
  state.version = 2;
  state.owner = null;
  state.events = [];
  state.criteria = {};
  state.findings = {};
  state.indexComplete = false;
  state.goalStatus = 'incomplete';
  state.batchAttempts = {};
  state.repairCycle = null;
  state.stagnantRounds = 0;
  state.seenObservations = [];
  state.seenEvidence = [];
  state.everVerified = [];
  for (const round of state.history) {
    if (round.attempted || round.review) state.batchAttempts[round.batch] = (state.batchAttempts[round.batch] || 0) + 1;
    if (round.outcome === 'accepted') { state.findings = {}; state.repairCycle = null; }
    else if (round.attempted || round.review) {
      state.repairCycle ||= { attempts: 0 };
      state.repairCycle.attempts++;
      for (const f of round.review?.findings || []) state.findings[f.id] = { ...f, criterion: null, kind: 'risk', verification: f.action, status: 'open', legacy: true };
    }
  }
  return state;
}
function addIndex(state, index) {
  for (const [id, def] of Object.entries(index)) {
    const existing = state.criteria[id];
    if (existing && ['source', 'anchor', 'kind'].some(key => existing[key] !== def[key])) throw Error(`Cannot change indexed acceptance: ${id}`);
  }
  for (const id of Object.keys(state.criteria)) if (!index[id]) throw Error(`Cannot remove indexed acceptance: ${id}`);
  for (const [id, def] of Object.entries(index)) if (!Object.hasOwn(state.criteria, id)) state.criteria[id] = { ...def, status: 'unverified', evidence: [] };
  state.indexComplete = false;
  state.goalStatus = 'incomplete';
}
function own(state, session) {
  if (!session || state.owner?.session !== session) throw Error('This session does not own the run; resume with explicit takeover if appropriate');
}
function claim(state, builder, { session, takeover, reason } = {}) {
  if (state.owner && state.owner.session === session && state.owner.builder === builder) return;
  if (state.owner && (!takeover || !nonempty(reason))) throw Error('Run already owned; explicit --takeover --reason is required');
  const previous = state.owner;
  state.owner = { session: crypto.randomUUID(), builder };
  state.builder = builder;
  state.events.push({ at: new Date().toISOString(), type: previous ? 'takeover' : 'claim', from: previous?.builder || null, to: builder, reason: reason || 'start/resume' });
}
function invalidate(state, source, read) {
  for (const row of Object.values(state.criteria)) {
    if (row.status !== 'verified') continue;
    let fresh = row.sourceFingerprint === source;
    for (const entry of row.evidence) {
      try { if (digest(read(entry.path)) !== entry.sha256) fresh = false; } catch { fresh = false; }
    }
    if (!fresh) { row.status = 'unverified'; row.reason = 'Source or evidence changed since verification'; state.goalStatus = 'incomplete'; }
  }
}
function openFindings(state) { return Object.values(state.findings).filter(f => f.status === 'open'); }
function evidenceRefs(refs, hashes, label) {
  unique(refs, label);
  if (!refs.length || refs.some(p => !Object.hasOwn(hashes, p))) throw Error(`${label} must cite submitted evidence paths`);
}
function validateBatch(state, batch, hashes) {
  unique(batch.criteria, 'Batch criteria');
  if (!batch.criteria.length || batch.criteria.some(id => !Object.hasOwn(state.criteria, id))) throw Error('Batch must map to known acceptance criteria');
  if (!Array.isArray(batch.resolutions)) throw Error('Structured resolutions required');
  unique(batch.resolutions.map(r => r.id), 'Resolution IDs');
  for (const r of batch.resolutions) {
    if (!state.findings[r.id] || state.findings[r.id].status !== 'open' || !nonempty(r.change)) throw Error(`Invalid builder resolution: ${r.id}`);
    evidenceRefs(r.evidence, hashes, `Resolution ${r.id}`);
  }
  if ((state.batchAttempts[batch.id] || 0) >= 4 || (state.repairCycle?.attempts || 0) >= 4) throw Error('Maximum three repair rounds exhausted; changing batch or host cannot reset it');
  if (state.stagnantRounds >= 2) throw Error('No new evidence-backed progress in two consecutive reviews; investigate the blocker outside this exhausted run');
}
function applyReview(state, batch, result, hashes, source, sourceHashes = {}) {
  if (typeof result.index_complete !== 'boolean') throw Error('Peer must assess acceptance-index completeness');
  if (!Array.isArray(result.assessments) || !Array.isArray(result.resolutions) || !Array.isArray(result.diagnostics)) throw Error('Peer must return assessments, resolutions and diagnostics');
  unique(result.assessments.map(a => a.id), 'Assessment IDs');
  if (result.assessments.length !== batch.criteria.length || result.assessments.some(a => !batch.criteria.includes(a.id))) throw Error('Peer must assess exactly the requested criteria');
  for (const a of result.assessments) {
    if (!['verified', 'unverified', 'blocked'].includes(a.status) || !nonempty(a.reason)) throw Error('Invalid criterion assessment');
    if (a.status === 'verified') evidenceRefs(a.evidence, hashes, `Assessment ${a.id}`);
    else if (!Array.isArray(a.evidence) || a.evidence.some(p => !Object.hasOwn(hashes, p))) throw Error('Invalid assessment evidence');
  }
  unique(result.findings.map(f => f.id), 'Finding IDs');
  const candidate = structuredClone(state.findings);
  const previousOpen = openFindings(state);
  unique(result.resolutions.map(r => r.id), 'Peer disposition IDs');
  if (result.resolutions.length !== previousOpen.length || result.resolutions.some(r => !previousOpen.some(f => f.id === r.id))) throw Error('Peer must explicitly disposition every open finding');
  let closed = 0;
  for (const r of result.resolutions) {
    if (!['open', 'closed'].includes(r.status) || !nonempty(r.reason)) throw Error('Invalid peer finding disposition');
    if (r.status === 'closed') {
      evidenceRefs(r.evidence, hashes, `Finding closure ${r.id}`);
      const resolution = batch.resolutions.find(b => b.id === r.id);
      if (!resolution || r.evidence.some(p => !resolution.evidence.includes(p))) throw Error(`Closure ${r.id} lacks builder resolution evidence`);
      if (result.findings.some(f => f.id === r.id)) throw Error('Finding cannot be open and closed in the same review');
      candidate[r.id] = { ...candidate[r.id], status: 'closed', closure: r }; closed++;
    }
  }
  for (const f of result.findings) {
    if (!nonempty(f.id) || ['__proto__', 'constructor', 'prototype'].includes(f.id) || !['acceptance', 'gate', 'risk'].includes(f.kind) || !nonempty(f.verification)) throw Error('Finding needs a stable ID, basis kind and closure verification');
    if (f.criterion !== null && !Object.hasOwn(state.criteria, f.criterion)) throw Error('Finding cites unknown criterion');
    if (f.criterion === null && f.kind !== 'risk') throw Error('Only concrete material risks may lack a criterion ID');
    if (candidate[f.id] && !candidate[f.id].legacy && candidate[f.id].criterion !== f.criterion) throw Error('Cannot repurpose a finding ID');
    if (result.assessments.some(a => a.id === f.criterion && a.status === 'verified')) throw Error('Criterion cannot be verified while it has an open blocking finding');
    candidate[f.id] = { ...f, status: 'open' };
  }
  const remaining = Object.values(candidate).filter(f => f.status === 'open');
  if (result.outcome === 'accepted' && (remaining.length || !result.index_complete || result.assessments.some(a => a.status === 'blocked'))) throw Error('Acceptance cannot omit open findings, incomplete index or blocked criteria');
  const observations = [];
  for (const d of result.diagnostics) {
    if (!nonempty(d.observation)) throw Error('Diagnostic observation is required');
    unique(d.evidence, 'Diagnostic evidence');
    // Diagnostics may use conventional file:line citations; resolve only known artifacts.
    const refs = d.evidence.map(p => {
      if (typeof p !== 'string') throw Error('Invalid diagnostic citation');
      const file = Object.hasOwn(hashes, p) || Object.hasOwn(sourceHashes, p) ? p : p.replace(/:\d+(?:-\d+)?$/, '');
      if (Object.hasOwn(hashes, file)) return file;
      if (!Object.hasOwn(sourceHashes, file) || !result.inspected.includes(file)) throw Error('Diagnostic must cite submitted evidence or inspected snapshot artifacts');
      return file.startsWith('tree/') && Object.hasOwn(hashes, file.slice(5)) ? file.slice(5) : file;
    });
    if (!refs.length) throw Error('Diagnostic evidence is required');
    const key = d.observation.toLowerCase().trim().replace(/\s+/g, ' ');
    if (!state.seenObservations.includes(key) && refs.some(p => Object.hasOwn(hashes, p) && !state.seenEvidence.includes(hashes[p]))) observations.push(key);
  }
  let advanced = 0;
  for (const a of result.assessments) {
    if (a.status === 'verified' && !state.everVerified.includes(a.id)) { advanced++; state.everVerified.push(a.id); }
    Object.assign(state.criteria[a.id], { status: a.status, reason: a.reason, sourceFingerprint: source, evidence: a.evidence.map(p => ({ path: p, sha256: hashes[p] })) });
  }
  for (const f of remaining) if (f.criterion) state.criteria[f.criterion].status = 'blocked';
  state.findings = candidate;
  state.indexComplete = result.index_complete;
  state.seenObservations = [...new Set([...state.seenObservations, ...observations])];
  state.seenEvidence = [...new Set([...state.seenEvidence, ...Object.values(hashes)])];
  const progress = { newly_verified: advanced, findings_closed: closed, new_diagnostics: observations.length };
  state.stagnantRounds = advanced || closed || observations.length ? 0 : state.stagnantRounds + 1;
  if (remaining.length) state.repairCycle ||= { attempts: 1 };
  else if (result.outcome === 'accepted') state.repairCycle = null;
  state.goalStatus = 'incomplete';
  state.progress = progress;
  return progress;
}
function finish(state) {
  const pending = Object.values(state.criteria).filter(c => c.status !== 'verified');
  if (!Object.keys(state.criteria).length || pending.length || !state.indexComplete || openFindings(state).length || state.outcome !== 'accepted') throw Error(`Goal incomplete: ${pending.map(c => c.id).join(', ') || 'acceptance index, open findings or latest peer acceptance missing'}`);
  state.goalStatus = 'complete';
  state.events.push({ type: 'finished', at: new Date().toISOString() });
}
module.exports = { digest, definitions, upgrade, addIndex, own, claim, invalidate, openFindings, validateBatch, applyReview, finish };
