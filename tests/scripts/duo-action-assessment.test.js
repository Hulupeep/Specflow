const {fixture}=require('../helpers/duo-action-fixture.cjs');const actions=require('../../scripts/duo-actions.cjs'),duo=require('../../scripts/duo-build.cjs');
let f;beforeEach(()=>f=fixture());afterEach(()=>f.close());
test.each(['claude-code','codex'])('J-DUO-ACTION-ASSESS %s: omitted response plus green unrelated tests does not satisfy the instruction; actual correction does',host=>{
 if(host==='codex')f.transfer();let evidence=f.capture();expect(f.review(f.batch(evidence)).history.at(-1).stage).toBe('validated');evidence=f.capture('unrelated.cjs');
 const skipped=f.review(f.batch(evidence),f.peer((r,req)=>{expect(req.instruction_review.builderResponses['I-R1-S1'].state).toBe('unreported');expect(req.instruction_review.instructions[0].doneWhen).toContain('42');}));
 expect(skipped.instructions['I-R1-S1'].lastAssessment.outcome).toBe('unproven');expect(skipped.goalStatus).toBe('incomplete');
 f.put('display.cjs','console.log(42)');evidence=f.capture();
 const corrected=f.review(f.batch(evidence,{resolutions:[{id:'TOTAL',change:'Corrected total after reviewer direction',evidence:[evidence]}]}));
 expect(corrected.history.at(-1).stage).toBe('validated');expect(corrected.instructions['I-R1-S1'].state).toBe('satisfied');expect(corrected.criteria['AC-TOTAL'].status).toBe('verified');
});
test.each(['missing','duplicate','unknown','stale','uninspected','no proof','cycle'])('reject %s assessment atomically and preserve previous repair count',kind=>{
 let evidence=f.capture();f.review(f.batch(evidence));const before=f.state();evidence=f.capture('unrelated.cjs');
 const result=f.review(f.batch(evidence),f.peer((r)=>{const a=r.instruction_assessments[0];if(kind==='missing')r.instruction_assessments=[];if(kind==='duplicate')r.instruction_assessments.push(a);if(kind==='unknown')a.instructionId='UNKNOWN';if(kind==='stale')a.snapshotHash='stale';if(kind==='uninspected')a.inspected=['tree/absent'];if(kind==='no proof'){a.outcome='satisfied';a.evidence=[];}if(kind==='cycle'){a.outcome='replaced_with_justification';a.replacementId=a.instructionId;}}));
 expect(result.history.at(-1).stage).toBe('peer_review');expect(result.instructions).toEqual(before.instructions);expect(result.repairCycle).toEqual(before.repairCycle);expect(result.peerFailures).toBe(1);
});
test('satisfaction requires actual evidence; source change reopens historical satisfaction',()=>{
 let evidence=f.capture();f.review(f.batch(evidence));f.put('display.cjs','console.log(42)');evidence=f.capture();
 const result=f.review(f.batch(evidence,{resolutions:[{id:'TOTAL',change:'Corrected actual total',evidence:[evidence]}]}));expect(result.instructions['I-R1-S1'].state).toBe('satisfied');
 f.put('display.cjs','console.log(40)');const changed=duo.inspect(f.root,f.run.id);expect(changed.instructions['I-R1-S1'].state).toBe('outstanding');expect(changed.instructions['I-R1-S1'].events).toHaveLength(1);
});
test('an instruction outside narrowed criteria remains in the packet; no raw evidence blocks before peer',()=>{
 let evidence=f.capture();f.review(f.batch(evidence));const invoke=jest.fn(f.peer());const result=f.review(f.batch(evidence,{criteria:['OWNER-GATE'],evidence:[]}),invoke);expect(invoke).not.toHaveBeenCalled();expect(result.blocker).toContain('Missing raw');expect(actions.pending(result)[0].criterion).toBe('AC-TOTAL');
});
test.each(['attempted_failed','not_attempted'])('%s needs inspected raw proof and rejects atomically',outcome=>{
 f.review(f.batch(f.capture()));const before=f.state();const evidence=f.capture('unrelated.cjs');
 const result=f.review(f.batch(evidence),f.peer(r=>{Object.assign(r.instruction_assessments[0],{outcome,inspected:[],evidence:[]});}));
 expect(result.history.at(-1).stage).toBe('peer_review');expect(result.blocker).toContain('inspected raw proof');expect(result.instructions).toEqual(before.instructions);expect(result.repairCycle).toEqual(before.repairCycle);
});
test('a failed attempt and an observed non-attempt remain distinct outstanding dispositions',()=>{
 f.put('failed-attempt.cjs',"console.error('requested display probe failed');process.exit(1)");
 f.review(f.batch(f.capture()));
 for(const outcome of ['attempted_failed','not_attempted']){
  const evidence=f.capture(outcome==='attempted_failed'?'failed-attempt.cjs':'unrelated.cjs');
  expect(f.state().lastCapture.exitCode).toBe(outcome==='attempted_failed'?1:0);
  const result=f.review(f.batch(evidence),f.peer(r=>{Object.assign(r.instruction_assessments[0],{outcome,reason:outcome==='attempted_failed'?'Simulated assessment: attempted command failed':'Simulated assessment: captured attempt scope excludes required command'});}));
  expect(result.history.at(-1).stage).toBe('validated');expect(result.instructions['I-R1-S1'].state).toBe('outstanding');expect(result.instructions['I-R1-S1'].lastAssessment.outcome).toBe(outcome);expect(actions.render(result)).toContain(`outstanding; ${outcome}`);
 }
 expect(f.state().instructions['I-R1-S1'].events.map(e=>e.outcome)).toEqual(['attempted_failed','not_attempted']);
});
test('external blockage requires a named owner and dependency and directs the next action to them',()=>{
 f.review(f.batch(f.capture()));const before=f.state();let evidence=f.capture('unrelated.cjs');
 const invalid=f.review(f.batch(evidence),f.peer(r=>{r.instruction_assessments[0].outcome='externally_blocked';}));
 expect(invalid.history.at(-1).stage).toBe('peer_review');expect(invalid.blocker).toContain('dependency and owner');expect(invalid.instructions).toEqual(before.instructions);expect(invalid.repairCycle).toEqual(before.repairCycle);
 evidence=f.capture('unrelated.cjs');const valid=f.review(f.batch(evidence),f.peer(r=>{Object.assign(r.instruction_assessments[0],{outcome:'externally_blocked',dependencyOwner:'user',missingDependency:'Owner must supply the fixture input'});}));
 expect(valid.history.at(-1).stage).toBe('validated');expect(actions.next(valid)).toMatchObject({status:'blocked',instructionId:'I-R1-S1',reason:expect.stringContaining('user: Owner must supply the fixture input')});
});
