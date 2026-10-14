'use strict';
// Execution safeguards are separate from acceptance and measured monetary spend.
const nonempty = s => typeof s === 'string' && s.trim().length > 0;
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
  const recovery = c.recoveries.find(r => r.episode === c.episode && r.kind === kind);
  if (recovery && !recovery.consumed) return null;
  return { kind, recoverable:!recovery, reason: recovery
    ? `${kind} recovery did not establish progress; inspect the retained cause and recovery evidence before escalating`
    : kind === 'protocol' ? 'Three consecutive protocol failures: diagnose the retained response and record one evidenced different recovery action'
    : 'No new evidence-backed progress in two reviews: diagnose the cause and record one evidenced different recovery action' };
}
function pending(c) { return c.recoveries.filter(r => r.episode === c.episode && !r.consumed); }
function beforeCall(c, validateEvidence) {
  const stop = decision(c); if (stop) throw Error(stop.reason);
  for (const r of pending(c)) validateEvidence(r.evidence);
  for (const r of pending(c)) { r.consumed = true; r.consumedAt = new Date().toISOString(); }
  c.calls++;
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
  validateEvidence(input.evidence);
  const item = { kind:input.kind, cause:input.cause, action:input.action, evidence:structuredClone(input.evidence), episode:c.episode, at:new Date().toISOString(), consumed:false };
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
module.exports = {policy,create,decision,pending,beforeCall,observe,recover,extend};
