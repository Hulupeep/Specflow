// Provider-boundary fixtures only; production code never synthesizes peer judgment.
exports.assessInstructions = (request, result) => {
  result.instruction_assessments = (request.instruction_review?.instructions || []).map(s => ({instructionId:s.id, outcome:result.assessments.find(a => a.id === s.criterion)?.status === 'verified' ? 'satisfied' : 'unproven', reason:'Explicitly simulated peer assessment; raw fixture output was inspected', snapshotHash:request.snapshot, inspected:request.batch.evidence.map(f => `tree/${f}`), evidence:request.batch.evidence, dependencyOwner:null,missingDependency:null,replacementId:null}));
};
exports.feedback = (request, result) => {
  exports.assessInstructions(request,result);
  const pending = Object.keys(request.acceptance).filter(id => (result.assessments.find(a => a.id === id)?.status || request.acceptance[id].status) !== 'verified');
  const complete = result.outcome === 'accepted' && !pending.length && !result.findings.length;
  result.direction = { assessment: complete ? 'complete' : result.outcome === 'blocked' ? 'blocked' : 'on_track', goal_connection: 'Synthetic peer direction for the observable fixture goal',
    next_steps: complete ? [] : [{ criterion: pending[0] || request.batch.criteria[0], owner: result.outcome === 'blocked' ? 'user' : 'builder', action: 'Verify the fixture output', done_when: 'The required observable fixture check passes' }], preserve: ['Preserve indexed acceptance and permissions'] };
};
exports.respond = (state, batch) => state.continuation?.direction.next_steps.length ? { ...batch, direction_response: { round: state.continuation.round, steps: state.continuation.direction.next_steps.map((_, i) => ({ step: i + 1, disposition: 'done', reason: 'Synthetic builder response; actual evidence is submitted separately' })) } } : batch;
// Explicit provider transcript substitute. Production never creates these receipts.
exports.transport = (result, exe, cwd) => {
  const fs = require('fs'), path = require('path');
  const events = (result.inspected || []).flatMap((file, i) => {
    const target = path.join(cwd, file);
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) return [];
    const content = fs.readFileSync(target, 'utf8'), id = `simulated-read-${i}`;
    if (exe === 'codex') return [{type:'item.completed',item:{id,type:'command_execution',command:`cat -- '${file}'`,aggregated_output:content,status:'completed',exit_code:0}}];
    return [{type:'assistant',message:{content:[{type:'tool_use',id,name:'Read',input:{file_path:target}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:id,content:content || 'File is empty.'}]}}];
  });
  if (exe === 'codex') fs.writeFileSync(path.join(cwd,'response.json'),JSON.stringify(result));
  events.push({type:'result',structured_output:result});
  return events.map(e => JSON.stringify(e)).join('\n');
};
