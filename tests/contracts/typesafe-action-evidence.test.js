const fs=require('fs'),path=require('path');const {fixture}=require('../helpers/duo-action-fixture.cjs');const advice=require('../../scripts/typesafe-actions.cjs'),typesafe=require('../../scripts/typesafe-duo.cjs'),duo=require('../../scripts/duo-build.cjs'),client=require('../../scripts/typesafe-client.cjs');
let f;beforeEach(()=>{f=fixture();f.review(f.batch(f.capture()));});afterEach(()=>f.close());
function selected(extra={},paths=['scoped.json']) {
 const record={instructionId:'I-R1-S1',criterion:'AC-TOTAL',snapshotHash:'snapshot',observation:'Executed display.cjs and observed 41',expected:42,actual:41,exitCode:0,sourceEvidence:'source.json',...extra};f.put('scoped.json',record);
 f.put('source.json',{duo_capture:1,stable:true,sourceAfter:'snapshot',exitCode:0,stdout:JSON.stringify({status:200,actual:41})});
 const state=f.state(),batch={...f.batch('scoped.json'),evidence:['scoped.json','source.json'],typesafe_actions:[{instructionId:'I-R1-S1',claim:'Total is correct',evidencePaths:paths}]};
 return {state,batch,tree:f.root,manifest:duo.manifest(f.root),snapshot:'snapshot',excluded:typesafe.excluded};
}
test('J-DUO-ACTION-ADVICE: scoped state retains instruction, claim and failed actual result; relevance and support separate',()=>{
 const result=advice.select(selected());expect(result.items[0]).toMatchObject({instruction:{id:'I-R1-S1',doneWhen:'Raw display output equals42'},evidence:[{value:{actual:41}}]});expect(Object.keys(result.questions)).toEqual(['a0_relevance','a0_support']);expect(result.questions.a0_support.criteria.contradicts).toContain('incompatible');
});
test.each(['absent','stale','mailbox','owner token'])('withholds %s evidence without a paid judgment',kind=>{
 const input=selected(kind==='stale'?{snapshotHash:'old'}:kind==='mailbox'?{mailbox:'private body'}:kind==='owner token'?{observation:f.run.owner.session}:{},kind==='absent'?[]:['scoped.json']);
 const result=advice.select(input);expect(result.items).toHaveLength(0);expect(Object.keys(result.questions)).toHaveLength(0);expect(result.skipped.at(-1).reason).toBe('insufficient_input');expect(JSON.stringify(result)).not.toContain(f.run.owner.session);
});
test('wrong TypeSafe advice can only be rejected using independently inspected raw evidence',()=>{
 const request={typesafe:{flags:['a0_support']},batch:{evidence:['scoped.json']}};const r={inspected:['tree/scoped.json'],typesafe_dispositions:[{id:'a0_support',status:'rejected',reason:'Raw actual result proves the claim',evidence:['scoped.json']}]};
 expect(()=>typesafe.validate(r,request,f.root)).not.toThrow();r.inspected=[];expect(()=>typesafe.validate(r,request,f.root)).toThrow('not inspected');
});
test.each(['missing source','stale source','mailbox under permitted field'])('does not replace actual source proof with a builder summary: %s',kind=>{
 const input=selected();
 if(kind==='missing source')input.batch.evidence=['scoped.json'];
 else f.put('source.json',{duo_capture:1,stable:true,sourceAfter:kind==='stale source'?'previous':'snapshot',exitCode:0,stdout:JSON.stringify(kind==='mailbox under permitted field'?{providerReason:'From: private@example.test\nMessage body'}:{actual:42})});
 const result=advice.select(input);expect(result.items).toHaveLength(0);expect(result.skipped.at(-1).reason).toBe('insufficient_input');
});
test('mechanical comparison recognizes empty candidate arrays without inventing semantic support',()=>{
 const {baseline}=require('../../scripts/typesafe-eval.cjs');
 expect(baseline({state:{evidence:[]}})).toMatchObject({support:'insufficient'});
 expect(baseline({state:{evidence:[{actual:42}]}})).toMatchObject({support:null});
});
