'use strict';
// Execution safeguards are separate from acceptance and measured monetary spend.
const crypto = require('crypto');
const nonempty = s => typeof s === 'string' && s.trim().length > 0;
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const legacyKey = refs => digest([...new Set(refs.map(r=>r.sha256))].sort());
function evidenceSummary(records) {
  const observations = new Map();
  for (const {text} of records) {
    let raw; try { raw=JSON.parse(text); } catch { continue; }
    if (raw?.duo_capture !== 1) continue;
    const finishedAt=Date.parse(raw.finishedAt);
    if (raw.stable!==true || !/^[a-f0-9]{64}$/.test(raw.sourceBefore || '') || raw.sourceBefore!==raw.sourceAfter ||
        !Array.isArray(raw.command) || !raw.command.length || raw.command.some(x=>typeof x!=='string') ||
        typeof raw.stdout!=='string' || typeof raw.stderr!=='string' ||
        !(Number.isInteger(raw.exitCode) || (raw.exitCode===null && nonempty(raw.error))) ||
        !(raw.error===null || typeof raw.error==='string') || typeof raw.finishedAt!=='string' || !Number.isFinite(finishedAt))
      throw Error('Recovery execution evidence is malformed or source-unstable');
    const key=digest({command:raw.command,exitCode:raw.exitCode,error:raw.error,stdout:raw.stdout,
      stderr:raw.stderr,sourceBefore:raw.sourceBefore,sourceAfter:raw.sourceAfter});
    const prior=observations.get(key);
    if (!prior || finishedAt>prior.finishedAt) observations.set(key,{key,finishedAt});
  }
  const facts=[...observations.values()].sort((a,b)=>a.key.localeCompare(b.key));
  return facts.length ? {key:digest(facts.map(o=>o.key)),execution:true,observations:facts,
    finishedAt:Math.max(...facts.map(o=>o.finishedAt))} : {key:legacyKey(records),execution:false,observations:[]};
}
function policy(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['usageMode','maxCalls','maxElapsedMs'].includes(k))) throw Error('Unknown review policy field; monetary cost is unmeasured here');
  const result = { usageMode: input.usageMode || 'unknown' };
  if (!['subscription','api','unknown'].includes(result.usageMode)) throw Error('Review usageMode must be subscription, api or unknown');
  for (const key of ['maxCalls','maxElapsedMs']) if (input[key] !== undefined) {
    if (!Number.isSafeInteger(input[key]) || input[key] <= 0) throw Error(`${key} must be a positive integer`);
    result[key] = input[key];
  }
  return result;
}
function create(input, now = Date.now()) {
  return { version:1, policy:policy(input), startedAt:now, calls:0, stagnant:0, protocolFailures:0, episode:0, achievements:[], recoveries:[], extensions:[] };
}
function decision(c, now = Date.now()) {
  if (c.policy.maxCalls !== undefined && c.calls >= c.policy.maxCalls) return {kind:'checkpoint',reason:`Configured maxCalls checkpoint (${c.calls}/${c.policy.maxCalls}); preserve this run and obtain owner authorization before extending it`};
  if (c.policy.maxElapsedMs !== undefined && now - c.startedAt >= c.policy.maxElapsedMs) return {kind:'checkpoint',reason:`Configured maxElapsedMs checkpoint (${c.policy.maxElapsedMs} ms); preserve this run and obtain owner authorization before extending it`};
  const kind = c.protocolFailures >= 3 ? 'protocol' : c.stagnant >= 2 ? 'stagnation' : null;
  if (!kind) return null;
  const recoveries = c.recoveries.filter(r => r.episode === c.episode && r.kind === kind);
  if (recoveries.some(r=>!r.consumed)) return null;
  return { kind, recoverable:true, reason: recoveries.length
    ? `${kind} recovery did not establish progress; diagnose the current result and choose a different action with fresh execution evidence`
    : kind === 'protocol' ? 'Repeated protocol failures: diagnose the retained response and record an evidenced recovery action'
    : 'No new evidence-backed progress: diagnose the cause and record an evidenced recovery action' };
}
function pending(c) { return c.recoveries.filter(r => r.episode === c.episode && !r.consumed); }
function beforeCall(c, validateEvidence) {
  const stop = decision(c); if (stop) throw Error(stop.reason);
  for (const r of pending(c)) {
    const summary=validateEvidence(r.evidence);
    if (r.observationKey && (summary?.key || legacyKey(r.evidence))!==r.observationKey)
      throw Error('Queued recovery observation changed');
  }
  for (const r of pending(c)) { r.consumed = true; r.consumedAt = new Date().toISOString(); }
  c.calls++; c.lastCallAt=Date.now();
}
function observe(c, { protocol = false, achievements = [] } = {}) {
  if (protocol) { c.protocolFailures++; return; }
  c.protocolFailures = 0;
  const added = [...new Set(achievements)].filter(a => !c.achievements.includes(a));
  c.achievements.push(...added);
  if (added.length) { c.stagnant = 0; c.episode++; }
  else c.stagnant++;
}
function recover(c, input, validateEvidence) {
  const stop = decision(c);
  if (!stop?.recoverable || input.kind !== stop.kind) throw Error(stop?.reason || 'No matching diagnosis guard requires recovery');
  if (!nonempty(input.cause) || !nonempty(input.action)) throw Error('Recovery requires the actual cause and a materially different action');
  if (!Array.isArray(input.evidence) || !input.evidence.length) throw Error('Recovery requires current diagnosis evidence');
  const summary=validateEvidence(input.evidence) || {key:legacyKey(input.evidence),execution:false,observations:[]};
  const prior=c.recoveries.filter(r=>r.episode===c.episode);
  const facts=summary.observations || [{key:summary.key,finishedAt:summary.finishedAt}];
  if (prior.length) {
    if (!summary.execution) throw Error('Further recovery requires fresh captured execution evidence, not reworded notes');
    const seen=new Set();
    for (const r of prior) {
      const previous=r.observationKey ? r : (()=>{
        const old=validateEvidence(r.evidence) || {key:legacyKey(r.evidence),execution:false};
        return {observationKey:old.key,executionEvidence:old.execution,observationKeys:old.observations?.map(o=>o.key)};
      })();
      if (previous.executionEvidence) for (const key of previous.observationKeys || [previous.observationKey]) seen.add(key);
    }
    const after=c.lastCallAt || Math.max(...prior.map(r=>Date.parse(r.consumedAt || r.at)));
    if (!facts.some(o=>Number.isFinite(o.finishedAt) && o.finishedAt>=after))
      throw Error('Recovery execution evidence predates the previous review attempt');
    if (!facts.some(o=>Number.isFinite(o.finishedAt) && o.finishedAt>=after && !seen.has(o.key)))
      throw Error('No new recovery observation; renamed captures, timestamps or repeated facts cannot permit another review');
  }
  const item = { kind:input.kind, cause:input.cause, action:input.action, evidence:structuredClone(input.evidence),
    observationKey:summary.key,executionEvidence:summary.execution,
    observationKeys:summary.execution?facts.map(o=>o.key):[],
    episode:c.episode, at:new Date().toISOString(), consumed:false };
  c.recoveries.push(item);
  return item;
}
function extend(c, input) {
  if (input.ownerAuthorized !== true || !nonempty(input.reason)) throw Error('Extending explicit limits requires owner authorization and a reason');
  const next = policy({...c.policy, ...input.policy});
  for (const key of ['maxCalls','maxElapsedMs']) if (c.policy[key] !== undefined && (!(next[key] >= c.policy[key]))) throw Error('Extensions cannot remove or reduce existing ceilings');
  if (JSON.stringify(next) === JSON.stringify(c.policy)) throw Error('No ceiling extension supplied');
  if (next.usageMode !== c.policy.usageMode) throw Error('A ceiling extension cannot change usage mode');
  const event = {at:new Date().toISOString(),reason:input.reason,previous:c.policy,next};
  c.extensions.push(event); c.policy=next;
  return event;
}
module.exports = {policy,create,decision,pending,beforeCall,observe,recover,extend,evidenceSummary};
