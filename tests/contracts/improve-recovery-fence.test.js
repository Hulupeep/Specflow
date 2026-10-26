'use strict';
const {recoveryFixture}=require('../helpers/improve-recovery.cjs'),m=require('../../scripts/improve-memory.cjs'),proc=require('../../scripts/improve-process-identity.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
const binding={job_id:'fence-job',operation_id:'fence-op',core_run_id:'fence-core'};
test('REC-FENCE an unclaimed v2 run cannot reserve or launch; trusted claim preserves original horizon and counters',()=>{
 f=recoveryFixture();const before=f.serviceV2().status(f.req).runs[0];
 expect(()=>f.serviceV2().reserveCycle({...f.req,binding})).toThrow('recovery_generation_required');
 expect(f.claim('initial').generation).toBe(1);expect(f.serviceV2().reserveCycle({...f.req,binding}).allowed).toBe(true);
 const after=f.serviceV2().status(f.req).runs[0];expect(after.deadline_ms).toBe(before.deadline_ms);expect(after.consumed_attempts).toBe(0);expect(after.recovery.current.assignment.holder).toBe('worker-A');
});
test('REC-FENCE assigning a successor fences the former context BEFORE protected launch without changing original authorship',()=>{
 f=recoveryFixture();f.claim();const cycle=f.serviceV2().reserveCycle({...f.req,binding}).cycle;
 const next=f.successor({...f.current(),holder:'worker-B',revision:'assignment-2'});
 expect(f.serviceV2().assign(f.command({principal:next.principal,holder:next.holder,assignment_revision:next.revision})).allowed).toBe(true);
 let calls=0;expect(()=>f.serviceV2().startStage({...f.req,cycle_id:cycle.id,stage:'build',input_sha256:m.digest({argv:'fixed fixture'})},()=>{calls++;})).toThrow('stale_execution_generation');
 expect(calls).toBe(0);expect(f.serviceV2().status(f.req).runs[0].principal).toBe('owner');
});
test('REC-FENCE stable claim retry returns original generation; conflicting input and stale commands cannot overwrite it',()=>{
 f=recoveryFixture();const request=f.command({},'stable'),first=f.serviceV2().resume(request);
 expect(f.serviceV2().resume(request)).toMatchObject({generation:first.generation,duplicate:true});
 expect(()=>f.serviceV2().resume({...request,expected_generation:1})).toThrow('recovery_idempotency_conflict');
 expect(()=>f.serviceV2().resume({...request,request_id:'stale'})).toThrow('recovery_generation_conflict');
});
test('REC-FENCE revoked, wrong-repo and forged assignment fields cannot start or assign protected work',()=>{
 f=recoveryFixture();f.claim();
 expect(()=>f.serviceV2().resume({...f.command(),principal:'owner'})).toThrow('invalid_recovery_request');
 expect(()=>f.serviceV2().resume({...f.command(),repo_id:'other'})).toThrow('authority_revoked');
 f.update(p=>{p.grants.owner=['read','preflight'];});
 // Update the current v2 registry through the same genuine authority boundary.
 require('../../scripts/improve-profiles.cjs').registerProfile(f.registryV2,f.profile,{lockTool:f.recovery.lockTool});
 expect(()=>f.serviceV2().resume(f.command())).toThrow('authority_revoked');
});
test('REC-FENCE boot and birth mismatch is observed conservatively without any signal',()=>{
 const here=proc.identity();expect(proc.state(here)).toBe('live');expect(proc.state({...here,boot_id:'different-boot'})).toBe('unknown');expect(proc.state({...here,start:here.start+'00'})).toBe('dead');
});
test('REC-FENCE different-boot prior holder stays unknown rather than becoming takeover authority',()=>{
 f=recoveryFixture();f.claim();const original=f.current();
 const next=f.successor({...original,holder:'worker-B',revision:'assignment-2',process:proc.identity()});
 // Preserve an authentic current run but qualify its stored old-holder identity
 // as a different boot; no PID is signalled and no death is invented.
 const unknown=f.serviceV2().store;unknown.change(s=>{s.runs[f.req.run_id].recovery.current.assignment.process.boot_id='not-the-current-boot';});
 f.serviceV2().assign(f.command({principal:'owner',holder:next.holder,assignment_revision:next.revision}));f.use(next);expect(f.serviceV2().resume(f.command())).toMatchObject({allowed:false,reason_code:'previous_holder_unknown'});expect(f.serviceV2().status(f.req).runs[0].recovery.generation).toBe(1);
});
