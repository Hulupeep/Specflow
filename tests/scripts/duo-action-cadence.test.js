const {fixture}=require('../helpers/duo-action-fixture.cjs');const cadence=require('../../scripts/duo-cadence.cjs'),duo=require('../../scripts/duo-build.cjs');
let f;beforeEach(()=>f=fixture());afterEach(()=>f.close());
test('J-DUO-ACTION-REDIRECT: bound premature stop names the actual instruction and a second ignored stop ends honestly',()=>{
 f.review(f.batch(f.capture()));f.capture('unrelated.cjs');const input={session_id:'fixture-session'};
 expect(cadence.stop(f.root,input)).toMatchObject({decision:'block',reason:expect.stringContaining('I-R1-S1')});
 expect(cadence.stop(f.root,{...input,stop_hook_active:true})).toMatchObject({continue:false,stopReason:expect.stringContaining('continuation exhausted')});
 expect(cadence.stop(f.root,{session_id:'someone-else'})).toEqual({});
});
test('verified local correction preserves owner-only dependency without endless engineering',()=>{
 f.review(f.batch(f.capture()));f.put('display.cjs','console.log(42)');const evidence=f.capture();const result=f.review(f.batch(evidence,{resolutions:[{id:'TOTAL',change:'Actual total corrected',evidence:[evidence]}]}));
 expect(result.criteria['AC-TOTAL'].status).toBe('verified');expect(cadence.assess(f.root,f.run.id)).toMatchObject({status:'blocked',reason:expect.stringContaining('owner consent')});expect(()=>duo.finish(f.root,f.run.id,f.run.owner.session)).toThrow(/OWNER-GATE/);
});
