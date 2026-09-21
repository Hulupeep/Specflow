const {fixture}=require('../helpers/duo-action-fixture.cjs');const duo=require('../../scripts/duo-build.cjs');
let f;beforeEach(()=>f=fixture());afterEach(()=>f.close());
test('J-DUO-ACTION-LIMITS: malformed responses consume protocol allowance only; capture eligibility precedes execution',()=>{
 f.review(f.batch(f.capture()));const before=f.state();
 for(let i=0;i<3;i++){const e=f.capture();f.review(f.batch(e),f.peer(r=>{r.outcome='accepted';}));}
 const s=f.state();expect(s.repairCycle).toEqual(before.repairCycle);expect(s.peerFailures).toBe(3);expect(s.instructions).toEqual(before.instructions);
 const eligible=duo.eligibility(f.root,f.run.id,f.run.owner.session);expect(eligible).toMatchObject({eligible:false,blockers:[{kind:'protocol_limit',reason:expect.any(String)}]});
 expect(()=>f.capture()).toThrow(/failure limit/);const invoke=jest.fn(f.peer());f.review(f.batch(s.lastCapture.path),invoke);expect(invoke).not.toHaveBeenCalled();expect(f.state().next).toContain('No further review');
});
test('exhausted legacy run retains exact budgets across transfer and evidence remains accessible',()=>{
 const s=f.state();s.repairCycle={attempts:4};s.batchAttempts.total=4;s.peerFailures=3;delete s.runtime;f.put(`.specflow/duo/${s.id}/run.json`,s);f.transfer();const r=f.state();expect(r.repairCycle.attempts).toBe(4);expect(r.peerFailures).toBe(3);expect(r.runtime.provenance).toBe('legacy_unknown');expect(duo.eligibility(f.root,r.id,r.owner.session).blockers.map(x=>x.kind)).toEqual(['protocol_limit','repair_limit']);
});
test('eligibility reports missing evidence and response warnings together without a model call',()=>{
 f.review(f.batch(f.capture()));const r=duo.eligibility(f.root,f.run.id,f.run.owner.session,f.batch('missing.json'));expect(r.eligible).toBe(false);expect(r.responseWarnings).toEqual([{instructionId:'I-R1-S1',state:'unreported'}]);
});
test('a fresh valid review clears only the protocol streak and retains repair history and authority',()=>{
 f.review(f.batch(f.capture()));const before=f.state();
 expect(before.findings.TOTAL.status).toBe('open');
 f.review(f.batch(f.capture()),f.peer(r=>{r.outcome='accepted';}));
 const invalid=f.state();
 expect(invalid.peerFailures).toBe(1);
 expect(invalid.repairCycle).toEqual(before.repairCycle);
 expect(invalid.batchAttempts).toEqual(before.batchAttempts);
 // A newly observed wrong result is valid diagnostic progress, not acceptance.
 f.put('display.cjs','console.log(40)');const evidence=f.capture();
 f.review(f.batch(evidence),f.peer((result,request)=>{
  result.diagnostics=[{observation:'Customer total now observed as 40',evidence:request.batch.evidence}];
 }));
 const valid=f.state();
 expect(valid.history.at(-1).stage).toBe('validated');
 expect(valid.peerFailures).toBe(0);
 // The valid work review consumes its normal attempt; no previous attempt is refunded.
 expect(valid.repairCycle.attempts).toBe(before.repairCycle.attempts+1);
 expect(valid.batchAttempts.total).toBe(before.batchAttempts.total+1);
 expect(valid.owner).toEqual(before.owner);
 expect(valid.pinned).toEqual(before.pinned);
 expect(Object.values(valid.criteria).map(({id,source,anchor,kind})=>({id,source,anchor,kind})))
  .toEqual(Object.values(before.criteria).map(({id,source,anchor,kind})=>({id,source,anchor,kind})));
 expect(valid.findings.TOTAL.status).toBe('open');
 expect(valid.goalStatus).toBe('incomplete');
 expect(()=>duo.finish(f.root,f.run.id,valid.owner.session)).toThrow(/incomplete/);
});
