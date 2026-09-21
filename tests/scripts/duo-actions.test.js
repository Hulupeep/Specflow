const {fixture}=require('../helpers/duo-action-fixture.cjs');
const actions=require('../../scripts/duo-actions.cjs'),duo=require('../../scripts/duo-build.cjs');
let f;beforeEach(()=>f=fixture());afterEach(()=>f.close());
test('J-DUO-ACTION-RESUME: unresolved origin survives five useful rounds, transfer and duplicate delivery',()=>{
 const state=f.state();
 for(let n=1;n<=5;n++) {
  const b={evidence:['raw'],criteria:['AC-TOTAL']};const request={snapshot:'s'+n,batch:b,instruction_review:actions.packet({...state,history:Array(n)},b,'s'+n,{'tree/raw':'hash'})};
  const r={outcome:'blocked',inspected:['tree/raw'],direction:{next_steps:[{criterion:'AC-TOTAL',owner:'builder',action:n===1?'original':'new task '+n,done_when:'observed result'}]},instruction_assessments:request.instruction_review.instructions.map(s=>({instructionId:s.id,outcome:'unproven',reason:'Different useful batch; original not established',snapshotHash:'s'+n,inspected:[],evidence:[]}))};
  actions.apply(state,r,request,'source',n);actions.apply(state,r,request,'source',n);
 }
 f.put(`.specflow/duo/${state.id}/run.json`,state);f.transfer();expect(actions.pending(f.state()).filter(s=>s.id==='I-R1-S1')).toHaveLength(1);expect(actions.pending(f.state())).toHaveLength(5);
 expect(()=>duo.review(f.root,state.id,{},f.peer(),state.owner.session)).toThrow(/own/);
});
test('legacy imports only latest validated direction once, never unvalidated result',()=>{
 const s=f.state();delete s.instructionVersion;
 s.history=[{stage:'validated',review:{direction:{next_steps:[{criterion:'AC-TOTAL',owner:'builder',action:'old',done_when:'old proof'}]}}},{stage:'validated',review:{direction:{next_steps:[{criterion:'AC-TOTAL',owner:'builder',action:'latest',done_when:'latest proof'}]}}},{stage:'peer_review',review:{direction:{next_steps:[{action:'invalid'}]}}}];
 actions.upgrade(s);actions.upgrade(s);expect(actions.pending(s)).toMatchObject([{id:'I-R2-S1',action:'latest',provenance:'legacy_latest_validated_direction'}]);
});
test('replacement keeps both linked records and original criterion',()=>{
 let e=f.capture();f.review(f.batch(e));e=f.capture('unrelated.cjs');
 const r=f.review(f.batch(e),f.peer((r,req)=>{r.instruction_assessments[0].outcome='replaced_with_justification';r.instruction_assessments[0].replacementId=req.instruction_review.nextInstructionIds[0];r.instruction_assessments[0].reason='Equivalent narrower command checks the same total';r.direction.next_steps[0].action='Execute equivalent direct total check';}));
 expect(r.history.at(-1).stage).toBe('validated');expect(r.instructions['I-R1-S1']).toMatchObject({state:'superseded',replacementId:'I-R2-S1'});expect(r.instructions['I-R2-S1'].criterion).toBe('AC-TOTAL');
});
test('five validated useful batches may advance separate criteria without losing an old instruction or inventing a global budget',()=>{
 f.close();f=fixture('claude-code',5);
 for(let n=1;n<=5;n++) {
  const evidence=f.capture();const result=f.review(f.batch(evidence,{id:'subtask-'+n,criteria:['AC-EXTRA-'+n]}),f.peer(r=>{
   // Explicit provider simulation: each independent fixture subtask is proven,
   // while the original display instruction remains outside this partial batch.
   r.outcome='accepted';r.findings=[];r.assessments[0].status='verified';r.direction.assessment='on_track';r.diagnostics=[];
  }));expect(result.history.at(-1).stage).toBe('validated');
 }
 f.transfer();expect(f.state().instructions['I-R1-S1'].state).toBe('outstanding');expect(f.state().history).toHaveLength(5);expect(f.state().repairCycle).toBeNull();
});
