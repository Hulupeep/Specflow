'use strict';
// Native CLI protocol double; exercises actual gateway, paused supervisor and sealed receipt.
const fs=require('fs'),path=require('path'),w=require('../../scripts/improve-worker.cjs'),gateway=require('../../scripts/improve-controller-provider.cjs'),{recoveryFixture}=require('../helpers/improve-recovery.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
function setup(mode,policyOverrides={},roleOptions={}){
 f=recoveryFixture({policyOverrides});fs.copyFileSync(path.resolve('tests/fixtures/improve-worker/native-auth-refusal.json'),path.join(f.root,'native-auth-refusal.json'));f.claim();const cycle=f.serviceV2().reserveCycle({...f.req,binding:{job_id:'gateway-job',operation_id:'gateway-op',core_run_id:'gateway-core'}}).cycle;
 const ctx={uid:process.getuid(),principal:'owner',ownerPrincipal:'owner',store:f.rootV2,registry:f.registryV2,host:f.host,...f.req,cycle_id:cycle.id,profile_revision:f.revision,cli:f.cli,require_stage:false,routing:{builder:'fixture-builder',oracle:'fixture-oracle',peer:'fixture-peer',judge:'fixture-judge'},requested_models:{builder:'sonnet',oracle:'sonnet',peer:'sonnet',judge:'sonnet'},recovery:{format:2,lockTool:f.recovery.lockTool,assignment:f.current(),generation:1,routes:f.actualRoutes}};
 const executable=gateway.writeGateway(path.join(f.root,'gateway'),ctx),cwd=path.join(f.root,'empty'),evidence=path.join(f.root,'role-evidence');fs.mkdirSync(cwd,{mode:0o700});fs.mkdirSync(evidence,{mode:0o700});fs.writeFileSync(path.join(f.root,'provider-mode.json'),JSON.stringify({mode}),{mode:0o600});
 return {ctx,call:()=>w.roleCall({role:'builder',model:'sonnet',effectiveModel:'fixture-builder',prompt:'Protocol fixture only',schema:{type:'object',properties:{}},cwd,evidence,claude:executable,...roleOptions})};
}
test.each([['success',null],['quota','provider_quota'],['auth','provider_auth'],['native-auth-refusal','provider_auth'],['binding','protocol_failure']])('REC-FENCE/RECEIPT actual v2 gateway %s preserves verified route and sealed result', (mode,reason)=>{
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
test.each(['nonzero','malformed'])('REC-RECEIPT native-protocol %s exit without matching terminal proof remains unknown and cannot be retried',mode=>{
 const {call}=setup(mode);expect(call).toThrow();const r=f.serviceV2().status(f.req).runs[0],op=r.operations[0];expect(r.consumed_attempts).toBe(1);expect(op.state).toBe('reserved');expect(op.unknown_reason).toBe('external_completion_unknown');expect(r.reasons).toContain('external_completion_unknown');
 const store=new (require('../../scripts/improve-operation-receipts.cjs').OperationReceipts)({root:path.join(f.rootV2,'operation-receipts'),registry:f.registryV2,lockTool:f.recovery.lockTool});expect(()=>store.get(op.id)).toThrow();expect(store.getObservation(op.id).phase).toBe('unknown');let calls=0;expect(f.serviceV2().startAttempt({...f.req,cycle_id:op.cycle_id,role:'builder',input_sha256:op.input_sha256},()=>{calls++;}).result.allowed).toBe(false);expect(calls).toBe(0);expect(f.serviceV2().reconcile(f.command({receipt_id:op.id}))).toMatchObject({allowed:false,reason_code:'external_completion_unknown'});
},25000);
test.each(['cancel','deadline'])('REC-RECEIPT real gateway %s stops the local native child but preserves unknown remote completion',mode=>{
 const {call}=setup('hang',mode==='deadline'?{limits:{maxCycles:2,maxWallMs:8000}}:{}),original=f.serviceV2().status(f.req).runs[0];
 if(mode==='cancel'){
  const file=path.join(f.root,'cancel-host.json');fs.writeFileSync(file,JSON.stringify({root:f.rootV2,registry:f.registryV2,principal:'owner',ownerPrincipal:'owner',host:f.host,clock:f.clock,recovery:{format:2,lockTool:f.recovery.lockTool},assignment:f.current(),execution:f.execution(),request:f.req,action:'cancel',routes:f.actualRoutes,barrier:path.join(f.root,'provider-started.json')}),{mode:0o600});require('child_process').spawn(process.execPath,[path.resolve('tests/fixtures/improve-worker/recovery-command.cjs'),file],{stdio:'ignore'}).unref();
 }
 expect(call).toThrow();f.clock=Date.now();const svc=f.serviceV2(),r=svc.status(f.req).runs[0],op=r.operations[0];expect(op.state).toBe('reserved');expect(op.unknown_reason).toBe('external_completion_unknown');expect(op.local_interruption).toBe(mode==='cancel'?'operator_cancelled':'deadline');expect(r.deadline_ms).toBe(original.deadline_ms);expect(r.consumed_attempts).toBe(1);const report=svc.report(f.req);expect(report.claim).toBe('improvement not established');expect(report.next_action.owner).toBe('owner');expect(report.next_action.action).not.toMatch(/reconcile/i);expect(report.next_action.action).toMatch(/no automatic|cannot automatically/i);let calls=0;expect(svc.startAttempt({...f.req,cycle_id:op.cycle_id,role:'builder',input_sha256:op.input_sha256},()=>{calls++;}).result.allowed).toBe(false);expect(calls).toBe(0);expect(svc.reconcile(f.command({receipt_id:op.id}))).toMatchObject({allowed:false,reason_code:'external_completion_unknown'});
},25000);
test('ROLE-DEADLINE modified gateway bytes cannot supply implicit deadline authority',()=>{
 const {ctx,call}=setup('success');const executable=path.join(f.root,'gateway','controller-provider');fs.appendFileSync(executable,'\n// modified after generation\n');
 expect(call).toThrow(expect.objectContaining({code:'role_deadline_required'}));
 expect(f.serviceV2().status(f.req).runs[0].consumed_attempts).toBe(0);
 expect(fs.existsSync(path.join(f.root,'provider-started.json'))).toBe(false);
});
test('ROLE-DEADLINE verified gateway exposes the unchanged original job deadline',()=>{
 const {ctx}=setup('success'),deadline=f.serviceV2().status(f.req).runs[0].deadline_ms;
 expect(gateway.gatewayDeadline(path.join(f.root,'gateway','controller-provider'))).toBe(deadline);
 expect(f.serviceV2().status(f.req).runs[0].consumed_attempts).toBe(0);
});

test('ROLE-DEADLINE managed role request uses the unchanged job deadline plus transport grace',()=>{
 const {call}=setup('success'),deadline=f.serviceV2().status(f.req).runs[0].deadline_ms;expect(call().provenance.model).toBe('fixture-builder');
 const directory=path.join(f.root,'role-evidence'),request=JSON.parse(fs.readFileSync(path.join(directory,fs.readdirSync(directory).find(n=>n.endsWith('.request.json')))));
 expect(request.deadlineAtMs).toBe(deadline+30000);expect(f.serviceV2().status(f.req).runs[0].deadline_ms).toBe(deadline);
});

test('ROLE-DEADLINE actual observer loss retains the live operation and refuses a duplicate start',async()=>{
 const {spawn}=require('child_process'),proc=require('../../scripts/improve-process-identity.cjs');let observer;
 const {call}=setup('hang',{limits:{maxCycles:2,maxWallMs:15000}},{authorizeStart:start=>{
  const child=start(),identity=proc.identity(child.pid);
  observer=spawn(process.execPath,['-e',`const fs=require('fs'),watch=require(${JSON.stringify(require.resolve('../../scripts/improve-controller-watchdog.cjs'))});const until=Date.now()+8000;const timer=setInterval(()=>{if(fs.existsSync(process.argv[1])){clearInterval(timer);watch.signalGroup(JSON.parse(process.argv[2]));}else if(Date.now()>until){clearInterval(timer);process.exitCode=2;}},20);`,path.join(f.root,'provider-started.json'),JSON.stringify(identity)],{stdio:'ignore'});
  return child;
 }});
 let provider;
 try{
  expect(call).toThrow(expect.objectContaining({code:'role_completion_unknown'}));
  const service=f.serviceV2(),run=service.status(f.req).runs[0],op=run.operations.find(o=>o.kind==='provider');provider=op.process_identity;
  expect(op.state).toBe('reserved');expect(proc.state(provider)).toBe('live');let calls=0;
  const attempted=service.startAttempt({...f.req,cycle_id:op.cycle_id,role:'builder',input_sha256:op.input_sha256},()=>{calls++;});
  expect(attempted.result.allowed).toBe(false);expect(calls).toBe(0);expect(service.status(f.req).runs[0].consumed_attempts).toBe(1);
 }finally{
  f.serviceV2().cancel(f.req);observer?.kill('SIGKILL');
  const until=Date.now()+5000;while(provider&&proc.state(provider)==='live'&&Date.now()<until)await new Promise(r=>setTimeout(r,50));
  if(provider)expect(proc.state(provider)).toBe('dead');
 }
},25000);
