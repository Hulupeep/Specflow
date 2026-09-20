// Provider-boundary fixtures only; production code never synthesizes peer judgment.
exports.feedback = (request, result) => {
  const pending = Object.keys(request.acceptance).filter(id => (result.assessments.find(a => a.id === id)?.status || request.acceptance[id].status) !== 'verified');
  const complete = result.outcome === 'accepted' && !pending.length && !result.findings.length;
  result.direction = { assessment: complete ? 'complete' : result.outcome === 'blocked' ? 'blocked' : 'on_track', goal_connection: 'Synthetic peer direction for the observable fixture goal',
    next_steps: complete ? [] : [{ criterion: pending[0] || request.batch.criteria[0], owner: result.outcome === 'blocked' ? 'user' : 'builder', action: 'Verify the fixture output', done_when: 'The required observable fixture check passes' }], preserve: ['Preserve indexed acceptance and permissions'] };
};
exports.respond = (state, batch) => state.continuation?.direction.next_steps.length ? { ...batch, direction_response: { round: state.continuation.round, steps: state.continuation.direction.next_steps.map((_, i) => ({ step: i + 1, disposition: 'done', reason: 'Synthetic builder response; actual evidence is submitted separately' })) } } : batch;
