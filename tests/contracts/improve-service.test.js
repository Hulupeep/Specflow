'use strict';
// Actual private auth registry and authoritative controller/profile/Git; no model invocation.
const fs=require('fs'),path=require('path'),{recoveryFixture}=require('../helpers/improve-recovery.cjs'),{createControllerService}=require('../../scripts/improve-controller.cjs'),{authenticator,createCredentialFile}=require('../../scripts/improve-service-auth.cjs'),{parse}=require('../../scripts/improve-service-schema.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
const task={task_id:'task-1',experiment_id:'experiment-1',source_revision:'a'.repeat(40),contract_revision:'b'.repeat(64)},actor={principal:'owner',credential_id:'client-A',role_id:'builder',holder:'agent-A',assignment_revision:'assignment-1'};
function setup(){f=recoveryFixture(); // release fixture's unused admitted job before new service task admission
 f.serviceV2().cancel(f.req);
 let resolveCount=0,currentPlan={version:1,repo_id:'fixture',profile_revision:f.revision,task,...{recipe_id:'protocol-fixture',runtime_sha256:'c'.repeat(64),driver_module:'/owner-private/test-driver.cjs',input_hashes:{},qualification_evidence_sha256:'d'.repeat(64)}};
 const service=()=>createControllerService({...f.configV2(),serviceBinding:{resolvePlan:()=>{resolveCount++;if(!currentPlan)throw Object.assign(Error('plan_preparation_required'),{code:'plan_preparation_required'});return currentPlan;}}});return {service,count:()=>resolveCount,setPlan:p=>currentPlan=p};}
test('SERVICE-SCHEMA strict versioned requests reject identity/path/commands/generation and unknown fields',()=>{
 const valid={api_version:1,repo_id:'fixture',request_id:'req-1',task};expect(parse('improve_start',valid)).toEqual(valid);
 for(const extra of [{principal:'owner'},{repo_path:'/private'},{command:'echo hacked'},{expected_generation:5},{model:'cheap'}, {api_version:2}])expect(()=>parse('improve_start',{...valid,...extra})).toThrow('invalid_request');
 expect(()=>parse('improve_start',{...valid,task:{...task,permission:'execute'}})).toThrow('invalid_request');
});
test('SERVICE-AUTH current request identity is immutable, scoped and revoked credentials cannot be relabelled as successor',()=>{
 f=recoveryFixture();const client=path.join(f.root,'client.json'),hash=createCredentialFile(client),token=JSON.parse(fs.readFileSync(client)).token,header='Bearer '+token,file=path.join(f.root,'service-auth.json');let registry={version:1,credentials:[{...actor,id:actor.credential_id,...hash,repos:['fixture'],actions:['improve_status'],revoked:false}],assignments:[actor]};const save=()=>fs.writeFileSync(file,JSON.stringify(registry),{mode:0o600});save();const auth=authenticator(file),identity=auth.authenticate(header);expect(Object.isFrozen(identity)).toBe(true);expect(identity).toEqual(actor);expect(auth.authorize(header,identity,'fixture','improve_status')).toEqual(actor);
 expect(()=>auth.authorize(header,identity,'other','improve_status')).toThrow('not_authorised');expect(()=>auth.authorize(header,identity,'fixture','improve_cancel')).toThrow('not_authorised');
 registry.assignments[0]={...actor,holder:'agent-B',assignment_revision:'assignment-2'};save();expect(()=>auth.authenticate(header)).toThrow('not_authorised');expect(identity).toEqual(actor);registry.assignments[0]=actor;registry.credentials[0].revoked=true;save();expect(()=>auth.authenticate(header)).toThrow('not_authorised');expect(()=>auth.authenticate('Bearer '+'x'.repeat(43))).toThrow('not_authorised');expect(fs.readFileSync(file,'utf8')).not.toContain(token);
});
test('SERVICE-CLAIM different watcher request IDs bind one original task/job; changed contract conflicts',()=>{
 const t=setup(),a=t.service().admitTask({repo_id:'fixture',request_id:'req-A',task},actor),b=t.service().admitTask({repo_id:'fixture',request_id:'req-B',task},{...actor,credential_id:'client-B',holder:'agent-B'});expect(a.accepted).toBe(true);expect(b).toMatchObject({accepted:true,duplicate:true,run_id:a.run_id});expect(t.count()).toBe(1);const run=t.service().store.read().runs[a.run_id];expect(run.service.origin_actor).toEqual(actor);expect(run.service.dispatch.state).toBe('pending');expect(run.operations).toHaveLength(0);
 expect(()=>t.service().admitTask({repo_id:'fixture',request_id:'req-C',task:{...task,contract_revision:'e'.repeat(64)}},actor)).toThrow('task_revision_conflict');expect(Object.values(t.service().store.read().runs).filter(r=>r.service)).toHaveLength(1);
});
test('SERVICE-RETRY unchanged canonical request returns original bound plan before mutable defaults or missing plan resolution',()=>{
 const t=setup(),req={repo_id:'fixture',request_id:'req-A',task},first=t.service().admitTask(req,actor);t.setPlan(null);const retry=t.service().admitTask(req,actor);expect(retry.run_id).toBe(first.run_id);expect(retry.duplicate).toBe(true);expect(t.count()).toBe(1);expect(()=>t.service().admitTask({...req,task:{...task,source_revision:'f'.repeat(40)}},actor)).toThrow('idempotency_conflict');
});
test('SERVICE-COMMIT admission storage failure never leaves a service claim without its original run/dispatch',()=>{
 const t=setup(),config=f.configV2();let armed=true;const svc=createControllerService({...config,fault:phase=>{if(phase==='rename'&&armed){armed=false;throw Error('actual commit fault');}},serviceBinding:{resolvePlan:()=>({version:1,repo_id:'fixture',profile_revision:f.revision,task})}});expect(()=>svc.admitTask({repo_id:'fixture',request_id:'req-fault',task},actor)).toThrow();const state=t.service().store.read();expect(Object.values(state.requests).filter(r=>r.kind==='service_task')).toHaveLength(0);expect(Object.values(state.runs).filter(r=>r.service)).toHaveLength(0);
});
test('SERVICE-AUTH transport actor cannot spoof a different controller principal',()=>{const t=setup();expect(()=>t.service().admitTask({repo_id:'fixture',request_id:'req-forged',task},{...actor,principal:'delegate'})).toThrow('service_actor_mismatch');expect(t.count()).toBe(0);});

test('SERVICE-RETRY an original busy receipt stays blocked after the repo is free and plan defaults disappear',()=>{
 const t=setup();const occupying=t.service().admit({repo_id:'fixture',request_id:'ordinary-job'});expect(occupying.allowed).toBe(true);const req={repo_id:'fixture',request_id:'blocked-service',task},first=t.service().admitTask(req,actor);expect(first).toMatchObject({accepted:false,run_id:null,reason_code:'busy'});t.service().cancel({repo_id:'fixture',run_id:occupying.run_id});t.setPlan(null);const before=t.service().store.read(),retry=t.service().admitTask(req,actor);expect(retry).toEqual({...first,duplicate:true});expect(t.service().store.read().runs).toEqual(before.runs);expect(()=>t.service().admitTask({...req,task:{...task,contract_revision:'e'.repeat(64)}},actor)).toThrow('idempotency_conflict');expect(Object.values(t.service().store.read().runs).filter(r=>r.service)).toHaveLength(0);
});
test.each(['no-plan','wrong-actor'])('SERVICE-CLAIM rejected %s leaves text requested but no admitted job/claim',mode=>{
 const t=setup();if(mode==='no-plan')t.setPlan(null);const before=t.service().store.read();expect(()=>t.service().admitTask({repo_id:'fixture',request_id:'unadmitted',task},mode==='wrong-actor'?{...actor,principal:'delegate'}:actor)).toThrow(mode==='no-plan'?'plan_preparation_required':'service_actor_mismatch');const after=t.service().store.read();expect(after.runs).toEqual(before.runs);expect(after.requests).toEqual(before.requests);expect(t.service().status({repo_id:'fixture'}).runs.filter(r=>r.service)).toEqual([]);
 // Service lifecycle begins only at admission. Requested text/task state belongs to ingress, never a fabricated running job.
});

test('SERVICE-ROLE job-scoped worker cannot admit or control another global service task',()=>{
 const t=setup(),scoped=createControllerService({...f.configV2(),recovery:{...f.recovery,scope:f.req},serviceBinding:{resolvePlan:()=>{throw Error('must not resolve');}}});expect(()=>scoped.admitTask({repo_id:'fixture',request_id:'scoped-extra',task},actor)).toThrow('scoped_execution_only');expect(()=>scoped.serviceControl({repo_id:'fixture',run_id:f.req.run_id,request_id:'scoped-control',action:'cancel'},actor)).toThrow('scoped_execution_only');
});
test('SERVICE-CANCEL commands bind original generation, survive lost ack and never derive another retry command',()=>{
 const t=setup(),admitted=t.service().admitTask({repo_id:'fixture',request_id:'control-admit',task},actor),req={repo_id:'fixture',run_id:admitted.run_id,request_id:'resume-1',action:'resume'},first=t.service().serviceControl(req,actor);expect(first).toMatchObject({allowed:true,expected_generation:0,reason_code:'resume_requested'});
 // Advance the real controller generation under the same live host, then retry the original command.
 const claim=t.service().resume({repo_id:'fixture',run_id:admitted.run_id,request_id:'actual-owner-claim',expected_generation:0});expect(claim.generation).toBe(1);expect(t.service().serviceControl(req,{...actor,credential_id:'client-B',holder:'agent-B'})).toEqual(first);expect(()=>t.service().serviceControl({...req,action:'cancel'},actor)).toThrow('idempotency_conflict');
 const cancelled=t.service().serviceControl({...req,request_id:'cancel-1',action:'cancel'},actor);expect(cancelled.reason_code).toBe('operator_cancelled');const report=t.service().report({repo_id:'fixture',run_id:admitted.run_id});expect(report.cancel_requested).toBe(true);expect(report.deadline_ms).toBe(t.service().store.read().runs[admitted.run_id].deadline_ms);expect(t.service().serviceControl({...req,request_id:'cancel-1',action:'cancel'},actor)).toEqual(cancelled);
});

test('SERVICE-AUTH credential provisioning refuses symlinked or shared parent and cannot overwrite an existing secret file',()=>{
 f=recoveryFixture();const privateFile=path.join(f.root,'secure-client.json');createCredentialFile(privateFile);const before=fs.readFileSync(privateFile);expect(()=>createCredentialFile(privateFile)).toThrow();expect(fs.readFileSync(privateFile)).toEqual(before);const shared=path.join(f.root,'shared');fs.mkdirSync(shared,{mode:0o755});expect(()=>createCredentialFile(path.join(shared,'secret.json'))).toThrow('receipt_private_source_required');const alias=path.join(f.root,'alias');fs.symlinkSync(f.root,alias,'dir');expect(()=>createCredentialFile(path.join(alias,'secret.json'))).toThrow('receipt_unsafe_source');
});
