'use strict';
// Obligations survive conversation windows. Only independently validated reviews
// may resolve them; this module never interprets a builder claim as proof.
const crypto = require('crypto');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const text = value => typeof value === 'string' && value.trim().length > 0;
const outcomes = ['satisfied', 'attempted_failed', 'not_attempted', 'unproven', 'externally_blocked', 'replaced_with_justification'];
const list = { type: 'array', items: { type: 'string' } };
const schema = { type: 'array', items: { type: 'object', additionalProperties: false,
  required: ['instructionId', 'outcome', 'reason', 'snapshotHash', 'inspected', 'evidence', 'dependencyOwner', 'missingDependency', 'replacementId'],
  properties: { instructionId: { type: 'string' }, outcome: { type: 'string', enum: outcomes }, reason: { type: 'string' }, snapshotHash: { type: 'string' }, inspected: list, evidence: list,
    dependencyOwner: { type: ['string', 'null'], enum: ['user', 'external', null] }, missingDependency: { type: ['string', 'null'] }, replacementId: { type: ['string', 'null'] } } } };
const pending = state => Object.values(state.instructions || {}).filter(s => s.state === 'outstanding').sort((a,b) => a.priority - b.priority || a.originRound - b.originRound || a.id.localeCompare(b.id));
function add(state, steps, round, provenance = 'validated') {
  return steps.map((s,i) => {
    const same = pending(state).find(x => x.criterion === s.criterion && x.owner === s.owner && x.action === s.action && x.doneWhen === s.done_when);
    if (same) return same.id;
    const id = `I-R${round}-S${i+1}`;
    if (!state.instructions[id]) state.instructions[id] = { id, originRound: round, criterion: s.criterion, priority: i+1, owner: s.owner, action: s.action, doneWhen: s.done_when, goalHash: state.goalHash, state: 'outstanding', provenance, events: [] };
    return id;
  });
}
function upgrade(state) {
  if (state.instructionVersion === 1) return state;
  state.instructionVersion = 1; state.instructions = {}; state.instructionRounds = []; state.everSatisfiedInstructions = [];
  const prior = state.history.map((r,i) => ({r,round:i+1})).findLast(({r}) => r.stage === 'validated' && r.review?.direction);
  if (prior) {
    add(state, prior.r.review.direction.next_steps, prior.round, 'legacy_latest_validated_direction');
    state.instructionRounds.push(prior.round);
  }
  return state;
}
function invalidate(state, source, read) {
  for (const s of Object.values(state.instructions || {})) {
    if (s.state !== 'satisfied') continue;
    const proof = s.events.at(-1);
    let fresh = proof?.sourceFingerprint === source;
    for (const [file, sha] of Object.entries(proof?.evidenceHashes || {})) {
      try { if (hash(read(file)) !== sha) fresh = false; } catch { fresh = false; }
    }
    if (!fresh) { s.state = 'outstanding'; s.reassessment = 'Source or evidence changed; prior satisfaction is historical'; state.goalStatus = 'incomplete'; }
  }
}
function responses(state, batch) {
  const result = Object.fromEntries(pending(state).map(s => [s.id, {state:'unreported'}]));
  const value = batch.direction_response, prior = state.continuation;
  if (!value) return result;
  if (!prior || value.round !== prior.round || !Array.isArray(value.steps)) throw Error('Direction response must reference the latest validated round');
  const seen = new Set();
  for (const response of value.steps) {
    const s = prior.direction.next_steps[response.step-1];
    if (!Number.isInteger(response.step) || !s || seen.has(response.step) || !['done','deferred','disputed'].includes(response.disposition) || !text(response.reason)) throw Error('Direction response needs unique step numbers, dispositions and reasons');
    seen.add(response.step);
    const match = pending(state).find(x => x.criterion === s.criterion && x.owner === s.owner && x.action === s.action && x.doneWhen === s.done_when);
    if (match) result[match.id] = {state:'reported', claim:response.reason, disposition:response.disposition};
  }
  return result;
}
function packet(state, batch, snapshotHash, artifactHashes) {
  return { version:1, snapshotHash, outstandingInstructionIds:pending(state).map(s => s.id), instructions:structuredClone(pending(state)), builderResponses:responses(state,batch), artifactHashes,
    nextInstructionIds: [1,2,3].map(i => `I-R${state.history.length}-S${i}`) };
}
function apply(state, result, request, source, round) {
  upgrade(state);
  if (state.instructionRounds.includes(round)) return 0;
  const expected = request.instruction_review, rows = result.instruction_assessments;
  if (!Array.isArray(rows) || rows.length !== expected.outstandingInstructionIds.length || new Set(rows.map(r => r.instructionId)).size !== rows.length || rows.some(r => !expected.outstandingInstructionIds.includes(r.instructionId))) throw Error('Peer must assess exactly every outstanding instruction, including outside this batch');
  const next = result.direction?.next_steps;
  if (!Array.isArray(next)) throw Error('Instruction review requires valid next steps');
  // New steps are candidates only: the caller applies this to a cloned run.
  const ids = add(state, next, round);
  let newlySatisfied = 0;
  for (const row of rows) {
    const s = state.instructions[row.instructionId];
    if (!outcomes.includes(row.outcome) || !text(row.reason) || row.snapshotHash !== expected.snapshotHash) throw Error(`Invalid instruction assessment: ${s.id}`);
    for (const field of ['inspected','evidence']) if (!Array.isArray(row[field]) || new Set(row[field]).size !== row[field].length) throw Error(`Invalid instruction ${field}`);
    if (row.inspected.some(f => !Object.hasOwn(expected.artifactHashes,f) || !result.inspected.includes(f))) throw Error('Instruction cites an artifact not independently inspected in this snapshot');
    if (row.evidence.some(f => !request.batch.evidence.includes(f) || !row.inspected.includes(`tree/${f}`))) throw Error('Instruction evidence must be submitted and independently inspected');
    if (row.outcome !== 'unproven' && (!row.inspected.length || !row.evidence.length)) throw Error('Instruction disposition requires inspected raw proof; missing visibility is unproven');
    if (row.outcome === 'externally_blocked' && (!['user','external'].includes(row.dependencyOwner) || !text(row.missingDependency))) throw Error('External instruction blocker needs dependency and owner');
    if (row.outcome !== 'externally_blocked' && (row.dependencyOwner || row.missingDependency)) throw Error('Dependency fields belong only to external blockers');
    if (row.outcome === 'replaced_with_justification') {
      const replacement = state.instructions[row.replacementId];
      if (!replacement || !ids.includes(row.replacementId) || replacement.id === s.id || replacement.criterion !== s.criterion || replacement.originRound !== round) throw Error('Replacement must link a new step under the same criterion; cycles and silent removal are forbidden');
      s.state = 'superseded'; s.replacementId = replacement.id; s.reason = row.reason;
    } else if (row.replacementId) throw Error('Replacement ID without replacement disposition');
    if (row.outcome === 'satisfied') {
      s.state = 'satisfied'; delete s.reassessment;
      if (!state.everSatisfiedInstructions.includes(s.id)) { newlySatisfied++; state.everSatisfiedInstructions.push(s.id); }
    }
    s.lastAssessment = structuredClone(row);
    s.events.push({ ...structuredClone(row), round, sourceFingerprint:source, evidenceHashes:Object.fromEntries(row.evidence.map(f => [f, expected.artifactHashes[`tree/${f}`]])) });
  }
  const oldPending = expected.outstandingInstructionIds.some(id => state.instructions[id].state === 'outstanding');
  if (!oldPending && result.outcome === 'accepted' && state.indexComplete && Object.values(state.criteria).every(c=>c.status==='verified') && !Object.values(state.findings).some(f=>f.status==='open') && next.length) throw Error('A fully verified scoped goal must finish, not generate additional work');
  state.instructionRounds.push(round);
  return newlySatisfied;
}
function next(state) {
  const rows = pending(state), builder = rows.find(s => s.owner === 'builder' && s.lastAssessment?.outcome !== 'externally_blocked');
  const s = builder || rows[0];
  if (!s) return null;
  const dependency = s.lastAssessment?.outcome === 'externally_blocked' ? `${s.lastAssessment.dependencyOwner}: ${s.lastAssessment.missingDependency}` : `${s.owner}: ${s.action}`;
  return { status:builder ? 'continue_required' : 'blocked', instructionId:s.id, reason:`${s.id} ${dependency} (${s.criterion}). Success: ${s.doneWhen}. ${s.lastAssessment?.reason || ''}` };
}
function render(state) {
  return ['## Instruction ledger', `Active run: ${state.id}`, ...Object.values(state.instructions || {}).map(s => `- ${s.id} [${s.state}; ${s.lastAssessment?.outcome || 'not assessed'}] priority ${s.priority}, ${s.owner}, ${s.criterion}: ${s.action}\n  Success: ${s.doneWhen}${s.replacementId ? `; replaced by ${s.replacementId}: ${s.reason}` : ''}${s.reassessment ? `; ${s.reassessment}` : ''}`)].join('\n');
}
const prompt = `Read instruction_review: the helper enumerates ALL outstanding instructions, regardless of batch scope or omitted builder responses. Return instruction_assessments with exactly one row per outstandingInstructionIds, even when empty. Independently inspect the frozen code/diff/raw execution results against each instruction's doneWhen and criterion. A claimed done, unrelated green tests or an absent response is never proof. Missing observation is unproven; not_attempted requires raw evidence of the bounded observed attempt scope, never a guess about unavailable activity. attempted_failed requires actual attempted execution; satisfied requires observed success. externally_blocked requires exact missingDependency and dependencyOwner and cannot conceal independent builder work. All non-unproven assessments require inspected raw evidence. Use snapshotHash from instruction_review. inspected paths must be from artifactHashes and listed in top-level inspected; evidence uses exact batch.evidence paths whose tree/ files you inspected. Disputed instructions are not unquestionable: a justified better route can use replaced_with_justification, linking replacementId to a NEW next step ID from nextInstructionIds (same criterion, explicit reason, no cycles or permission expansion). Otherwise repeat outstanding next steps verbatim to preserve their ID; do not silently replace or reprioritize them. Prioritize outstanding authorized builder actions; goal completion requires no unresolved instruction. When open findings prevent accepted, return blocked or changes_required with verified partial assessments; never accepted-plus-open findings. Return null for unused dependency/replacement fields.\n`;
module.exports = { schema, pending, upgrade, invalidate, responses, packet, apply, next, render, prompt };
