'use strict';
// Native CLI protocol double; exercises actual gateway, paused supervisor and sealed receipt.
const fs=require('fs'),path=require('path'),w=require('../../scripts/improve-worker.cjs'),gateway=require('../../scripts/improve-controller-provider.cjs'),{recoveryFixture}=require('../helpers/improve-recovery.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
function setup(mode){
 f=recoveryFixture();f.claim();const cycle=f.serviceV2().reserveCycle({...f.req,binding:{job_id:'gateway-job',operation_id:'gateway-op',core_run_id:'gateway-core'}}).cycle;
 const ctx={uid:process.getuid(),principal:'owner',ownerPrincipal:'owner',store:f.rootV2,registry:f.registryV2,host:f.host,...f.req,cycle_id:cycle.id,profile_revision:f.revision,cli:f.cli,require_stage:false,routing:{builder:'fixture-builder',oracle:'fixture-oracle',peer:'fixture-peer',judge:'fixture-judge'},requested_models:{builder:'sonnet',oracle:'sonnet',peer:'sonnet',judge:'sonnet'},recovery:{format:2,lockTool:f.recovery.lockTool,assignment:f.current(),generation:1,routes:f.actualRoutes}};
 const executable=gateway.writeGateway(path.join(f.root,'gateway'),ctx),cwd=path.join(f.root,'empty'),evidence=path.join(f.root,'role-evidence');fs.mkdirSync(cwd,{mode:0o700});fs.mkdirSync(evidence,{mode:0o700});fs.writeFileSync(path.join(f.root,'provider-mode.json'),JSON.stringify({mode}),{mode:0o600});
 return {ctx,call:()=>w.roleCall({role:'builder',model:'sonnet',effectiveModel:'fixture-builder',prompt:'Protocol fixture only',schema:{type:'object',properties:{}},cwd,evidence,claude:executable})};
}
test.each([['success',null],['quota','provider_quota'],['auth','provider_auth'],['binding','protocol_failure']])('REC-FENCE/RECEIPT actual v2 gateway %s preserves verified route and sealed result', (mode,reason)=>{
 const {call}=setup(mode);if(reason)expect(call).toThrow();else expect(call().provenance.model).toBe('fixture-builder');
 const r=f.serviceV2().status(f.req).runs[0];expect(r.consumed_attempts).toBe(1);expect(r.operations[0].state).toBe('complete');expect(r.operations[0].result.reason_code).toBe(reason);expect(r.operations[0].process_identity.boot_id).toBeTruthy();expect(r.operations[0].receipt_seal).toMatch(/^[a-f0-9]{64}$/);expect(r.evidence.every(v=>/^[a-f0-9]{64}$/.test(v))).toBe(true);
},20000);
test('REC-FENCE actual stale gateway context makes zero outbound calls',()=>{
 const {call}=setup('success'),next=f.successor({...f.current(),holder:'replacement',revision:'assignment-2'});f.serviceV2().assign(f.command({principal:'owner',holder:next.holder,assignment_revision:next.revision}));expect(call).toThrow();expect(fs.existsSync(path.join(f.root,'provider-started.json'))).toBe(false);expect(f.serviceV2().status(f.req).runs[0].consumed_attempts).toBe(0);
},20000);
test('EFFORT-V2 repeated diagnosed protocol repairs do not acquire a default no-progress ceiling',()=>{
 const {call}=setup('binding');for(let i=0;i<5;i++)expect(call).toThrow();
 let r=f.serviceV2().status(f.req).runs[0];expect(r.no_progress).toBe(5);expect(r.remaining.consecutive_no_progress).toBe(null);expect(r.reasons).toEqual(['protocol_failure']);expect(r.retryable).toBe(true);expect(r.reasons).not.toContain('no_progress');
 fs.writeFileSync(path.join(f.root,'provider-mode.json'),JSON.stringify({mode:'success'}));expect(call().provenance.model).toBe('fixture-builder');r=f.serviceV2().status(f.req).runs[0];expect(r.consumed_attempts).toBe(6);expect(r.last_failure).toBe(null);
},30000);
