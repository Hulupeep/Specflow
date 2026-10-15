const {fixture}=require('../helpers/duo-action-fixture.cjs');
const duo=require('../../scripts/duo-build.cjs');
let f;
beforeEach(()=>{f=fixture();});
afterEach(()=>f.close());

// Explicitly simulated provider acceptance tests the native instruction lifecycle,
// not product correctness or real owner consent.
function verified(result) {
 result.outcome='accepted';result.findings=[];
 result.assessments.forEach(row=>{row.status='verified';});
 result.resolutions.forEach(row=>{row.status='closed';});
}
function replacement(result,request) {
 verified(result);
 Object.assign(result.instruction_assessments[0],{
  outcome:'replaced_with_justification',replacementId:request.instruction_review.nextInstructionIds[0],
  reason:'Replace the compound instruction with a bounded verification before finish; no merge is claimed',
 });
 result.direction={assessment:'on_track',goal_connection:'Preserve the remaining obligation after criteria verification',preserve:[],next_steps:[{
  criterion:'AC-TOTAL',owner:'builder',action:'Independently recapture the total before finish',done_when:'Fresh captured output equals42',
 }]};
}
function prepare() {
 f.review(f.batch(f.capture()));
 f.put('display.cjs','console.log(42)');
 return f.batch(f.capture(),{criteria:['AC-TOTAL','OWNER-GATE'],resolutions:[{id:'TOTAL',change:'Correct fixture total',evidence:[f.state().lastCapture.path]}]});
}
test.each(['claude-code','codex'])('J-DUO-REPLACEMENT-COMPLETE %s: replacement remains due after all criteria verify, then can finish',host=>{
 if(host==='codex')f.transfer();
 const result=f.review(prepare(),f.peer(replacement));
 expect(result.history.at(-1).stage).toBe('validated');
 expect(Object.values(result.criteria).every(row=>row.status==='verified')).toBe(true);
 expect(result.instructions['I-R1-S1']).toMatchObject({state:'superseded',replacementId:'I-R2-S1'});
 expect(result.instructions['I-R2-S1'].state).toBe('outstanding');
 expect(()=>duo.finish(f.root,result.id,result.owner.session)).toThrow(/instruction|incomplete/i);
 const evidence=f.capture();
 const final=f.review(f.batch(evidence,{criteria:['AC-TOTAL','OWNER-GATE']}),f.peer(r=>{
  verified(r);r.direction={assessment:'complete',goal_connection:'All fixture obligations independently verified',next_steps:[],preserve:[]};
 }));
 expect(final.history.at(-1).stage).toBe('validated');
 expect(final.instructions['I-R2-S1'].state).toBe('satisfied');
 expect(duo.finish(f.root,final.id,final.owner.session).goalStatus).toBe('complete');
});
test.each(['only new work','replacement plus new work'])('fully verified scope rejects %s atomically',mode=>{
 const batch=prepare(),before=f.state();
 const result=f.review(batch,f.peer((r,req)=>{
  replacement(r,req);
  if(mode==='only new work')Object.assign(r.instruction_assessments[0],{outcome:'satisfied',replacementId:null});
  else r.direction.next_steps.push({criterion:'AC-TOTAL',owner:'builder',action:'Invent an unrelated cleanup',done_when:'Cleanup reported'});
 }));
 expect(result.history.at(-1).stage).toBe('peer_review');
 expect(result.blocker).toMatch(/fully verified scoped goal/);
 expect(result.instructions).toEqual(before.instructions);
 expect(result.criteria).toEqual(before.criteria);
});
test('a replacement cannot silently resolve the original without its new obligation',()=>{
 const batch=prepare(),before=f.state();
 const result=f.review(batch,f.peer((r,req)=>{
  replacement(r,req);r.direction={assessment:'complete',goal_connection:'Incorrect completion',next_steps:[],preserve:[]};
 }));
 expect(result.history.at(-1).stage).toBe('peer_review');
 expect(result.blocker).toMatch(/Replacement must link a new step/);
 expect(result.instructions).toEqual(before.instructions);
});
