'use strict';
// The peer supplies judgment; code preserves, validates and delivers its handoff.
const actions = require('./duo-actions.cjs');
const text = { type: 'string', minLength: 1 };
const object = properties => ({ type: 'object', additionalProperties: false, required: Object.keys(properties), properties });
const schema = object({
  assessment: { type: 'string', enum: ['on_track', 'redirect', 'blocked', 'complete'] },
  goal_connection: text,
  next_steps: { type: 'array', maxItems: 3, items: object({
    criterion: text, owner: { type: 'string', enum: ['builder', 'user', 'external'] }, action: text, done_when: text,
  }) },
  preserve: { type: 'array', items: text },
});
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function validate(direction, state, outcome) {
  if (!direction || !['on_track', 'redirect', 'blocked', 'complete'].includes(direction.assessment) || !nonempty(direction.goal_connection)) throw Error('Peer must return goal-focused direction');
  if (!Array.isArray(direction.next_steps) || direction.next_steps.length > 3 || !Array.isArray(direction.preserve) || direction.preserve.some(s => !nonempty(s))) throw Error('Invalid direction steps or preserved constraints');
  const complete = outcome === 'accepted' && state.indexComplete && Object.keys(state.criteria).length > 0 && Object.values(state.criteria).every(c => c.status === 'verified') && !Object.values(state.findings).some(f => f.status === 'open') && !actions.pending(state).length;
  if (complete && direction.assessment !== 'complete') throw Error('A fully verified scoped goal must finish, not generate additional work');
  if (direction.assessment === 'complete') {
    if (!complete || direction.next_steps.length) throw Error('Direction cannot declare completion before all goal gates are verified');
  } else if (!direction.next_steps.length) throw Error('Unfinished direction requires a concrete next action');
  for (const step of direction.next_steps) {
    if (!step || !Object.hasOwn(state.criteria, step.criterion) || !['builder', 'user', 'external'].includes(step.owner) || !nonempty(step.action) || !nonempty(step.done_when)) throw Error('Direction step needs a known criterion, owner, action and observable success');
  }
  const builder = direction.next_steps.some(s => s.owner === 'builder');
  if (direction.assessment === 'blocked' && builder) throw Error('Direction cannot stop at an external blocker while builder work remains');
  if (direction.assessment !== 'complete' && !builder && direction.assessment !== 'blocked') throw Error('Only user/external next steps must be an explicit blocked handoff');
}
function response(state, batch) { return actions.responses(state, batch); }
function memory(state) {
  return state.history.map((r, i) => ({ r, round: i + 1 })).filter(({r}) => r.stage === 'validated' && r.review?.direction).slice(-3).map(({r, round}) => ({
    round, summary: r.summary, direction: r.review.direction, builder_response: r.directionResponse || null,
    resolutions: r.review.resolutions, diagnostics: r.review.diagnostics,
  }));
}
function next(direction) {
  if (direction.assessment === 'complete') return 'Run finish to verify the scoped goal; preserve subsequent release gates';
  // Independent builder work comes first even if an external dependency was listed first.
  const step = direction.next_steps.find(s => s.owner === 'builder') || direction.next_steps[0];
  return `${step.owner}: ${step.action} (${step.criterion}). Success: ${step.done_when}`;
}
function render(state) {
  const saved = state.continuation;
  if (!saved) return 'No validated goal-direction handoff yet. Review the next meaningful batch.\n';
  const d = saved.direction;
  const current = state.continuationFresh !== false && saved.round === state.history.length && state.history.at(-1)?.stage === 'validated';
  return [`# Builder continuation — round ${saved.round}`, '',
    current ? 'Validated direction for this reviewed snapshot.' : 'Historical direction: source/evidence changed or a later review failed. Reassess it against current facts; this is not current acceptance.',
    `Goal: ${state.context.objective}`, `Finish condition: ${state.context.finish}`, '',
    `Direction: ${d.assessment}. ${d.goal_connection}`, '',
    ...d.next_steps.map((s, i) => `${i + 1}. ${s.owner} — ${s.action}\n   Criterion: ${s.criterion}. Success: ${s.done_when}`),
    ...d.preserve.map(s => `Preserve: ${s}`), '',
    d.assessment === 'complete' ? 'The scoped criteria are satisfied. Run finish if not already complete, then report the outcome; do not add work outside this goal.' : 'Continue authorized builder work now. Keep owner/external dependencies explicit. Advice does not expand scope or permissions; select commands yourself. Record done/deferred/disputed responses in the next batch and submit raw proof separately.',
    'Use the saved goal and authoritative task. Stop only at verified completion, a specific unavoidable dependency, or an exhausted budget. Log interactions in this run directory, not a root audit file.', '',
  ].join('\n');
}
const prompt = `Act as the builder's goal-focused technical partner, not just a gate checker. Return direction: explain whether this work advances the actual customer outcome, challenge unsupported reasoning, and give up to three prioritized bounded next_steps linked to indexed criteria with owner and observable done_when. Read direction_memory and the builder's direction_response; preserve decisions and corrections across rounds, and independently assess disagreements. A response saying done is not evidence. Do not repeat settled tests solely for narrative/log updates or let evidence packaging replace useful work. Choose the smallest useful next action: a missing customer fact or external gate must not stop independent authorized engineering. Use assessment redirect for a wrong approach, on_track for useful continuation, blocked only when every next step requires a user/external dependency, and complete only when the entire indexed goal is eligible for finish. Name the exact missing fact/access and what its owner must supply. Preserve required gates and permissions; do not infer new authorization. Keep unrelated redesign/cleanup in unrelated; do not turn it into next_steps. A step may prepare a needed scope amendment but must not implement it without authorization. Write next_steps as instructions the interactive builder can follow immediately; do not address the user yourself.\n`;
module.exports = { schema, validate, response, memory, next, render, prompt };
