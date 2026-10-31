 'use strict';
const fs=require('fs'),path=require('path'),{recoveryFixture}=require('../helpers/improve-recovery.cjs');
const {createControllerWorker}=require('../../scripts/improve-controller-worker.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
function setup(policyOverrides={},initialProcess=null){
 f=recoveryFixture({policyOverrides,initialProcess});f.claim();const svc=f.serviceV2(),cycle=svc.reserveCycle({...f.req,binding:{job_id:'retry-job',operation_id:'retry-op',core_run_id:'retry-core'}}).cycle;
 const bin=path.join(f.root,'bin'),empty=path.join(f.root,'empty');fs.mkdirSync(bin,{mode:0o700});fs.mkdirSync(empty,{mode:0o700});
 const launcher=path.join(bin,'worker-command');fs.writeFileSync(launcher,'#!'+process.execPath+'\nconst args=JSON.parse(process.argv[4] || process.argv[3]);process.exitCode=args[0]==="fixed"?0:2;',{mode:0o700});
 const binding={...f.req,cycle_id:cycle.id},cfg={bin,launcher,emptyCwd:empty,authority:{uid:process.getuid(),principal:'owner',repo_id:'fixture',revision:f.revision,registry:f.registryV2},controller_binding:binding,recovery:{format:2,lockTool:f.recovery.lockTool,store:f.rootV2}};
 const file=path.join(bin,'job.json');fs.writeFileSync(file,JSON.stringify(cfg),{mode:0o600});
 const adapter=createControllerWorker({service:svc,binding,configFile:file,evidenceDir:path.join(f.root,'evidence')});return {svc,adapter,binding};
}
test.each(['critique','oracle','judge'])('explicit corrected %s retry retains authentic failure, original window and counters',async stage=>{
 const {svc,adapter}=setup();expect((await adapter.wait(adapter.start(stage,['broken']))).status).toBe(2);
 const before=svc.status(f.req).runs[0],failed=before.operations[0];
 expect(()=>adapter.start(stage,['fixed'])).toThrow('stage_failure');
 // Official resume is allowed to update last_completed_action, but not erase the failure.
 expect(f.claim().allowed).toBe(true);
 const child=adapter.start(stage,['fixed'],{retry:{operation_id:failed.id,reason:'Correct malformed review input'}});
 expect((await adapter.wait(child)).status).toBe(0);
 const after=svc.status(f.req).runs[0];expect(after.operations).toHaveLength(2);expect(after.operations[0]).toEqual(failed);
 expect(svc.report(f.req).review_retries).toEqual([{failed_operation_id:failed.id,replacement_operation_id:after.operations[1].id,failed_check:'stage:'+stage,reason:'Correct malformed review input'}]);
 expect(after.operations[1].retry_of).toBe(failed.id);expect(after.deadline_ms).toBe(before.deadline_ms);expect(after.consumed_attempts).toBe(before.consumed_attempts);expect(after.consumed_cycles).toBe(before.consumed_cycles);expect(after.reasons).not.toContain('stage_failure');
},25000);
test.each(['same-input','wrong-stage','wrong-operation','cancelled','expired','stale-holder'])('explicit retry rejects %s without reserving a child',async mode=>{
 const {svc,adapter}=setup();await adapter.wait(adapter.start('critique',['broken']));const before=svc.status(f.req).runs[0],failed=before.operations[0];
 if(mode==='stale-holder')f.use({...f.current(),holder:'unassigned'}, {generation:1});
 if(mode==='cancelled')svc.cancel(f.req);if(mode==='expired')f.clock=before.deadline_ms+1;
 const expected=mode==='stale-holder'?'stale_execution_generation':['cancelled','expired'].includes(mode)?'review_retry_blocked':'review_retry_unavailable';
 expect(()=>adapter.start(mode==='wrong-stage'?'oracle':'critique',[mode==='same-input'?'broken':'fixed'],{retry:{operation_id:mode==='wrong-operation'?'unknown':failed.id,reason:'Correct input'}})).toThrow(expected);
 const after=svc.status(f.req).runs[0];expect(after.operations).toHaveLength(1);expect(after.reasons).toContain('stage_failure');expect(after.failed_check).toBe(before.failed_check);expect(after.stopped_at_ms).toBe(before.stopped_at_ms);
},25000);
test('malformed critique include is rejected before reserving an operation',async()=>{
 const {svc,adapter}=setup();let error,child;try {child=adapter.start('critique',['unused',{include:'/tmp/file'}]);} catch(e) {error=e;}
 if(child)await adapter.wait(child);expect(error?.message).toBe('invalid_critique_include');expect(svc.status(f.req).runs[0].operations).toHaveLength(0);
 expect(()=>require('../../scripts/specflow-improve.cjs').critique('/missing',{include:'/tmp/file'})).toThrow('invalid_critique_include');
});

function consumePeer(binding){
 const gateway=require('../../scripts/improve-controller-provider.cjs'),worker=require('../../scripts/improve-worker.cjs');
 const ctx={uid:process.getuid(),principal:'owner',ownerPrincipal:'owner',store:f.rootV2,registry:f.registryV2,host:f.host,...binding,profile_revision:f.revision,cli:f.cli,require_stage:false,routing:{builder:'fixture-builder',oracle:'fixture-oracle',peer:'fixture-builder',judge:'fixture-judge'},requested_models:{builder:'sonnet',oracle:'sonnet',peer:'sonnet',judge:'sonnet'},recovery:{format:2,lockTool:f.recovery.lockTool,assignment:f.current(),generation:1,routes:f.actualRoutes}};
 const executable=gateway.writeGateway(path.join(f.root,'gateway'),ctx),evidence=path.join(f.root,'peer-evidence');fs.mkdirSync(evidence,{mode:0o700});fs.writeFileSync(path.join(f.root,'provider-mode.json'),JSON.stringify({mode:'success'}),{mode:0o600});
 worker.roleCall({role:'peer',model:'sonnet',effectiveModel:'fixture-builder',prompt:'Protocol fixture only',schema:{type:'object',properties:{}},cwd:path.join(f.root,'empty'),evidence,claude:executable});
}
test.each(['attempt','route'])('explicit review retry cannot bypass an exhausted %s ceiling',async mode=>{
 const policy={routes:['builder','oracle','peer','judge'].map(role=>({role,requested_model:'sonnet',effective_model:role==='peer'?'fixture-builder':'fixture-'+role,billing:'subscription_cli',cost:'ordinary',maxStarts:mode==='route'?1:null})),...(mode==='attempt'?{limits:{maxCycles:2,maxAttempts:1}}:{})};
 const {svc,adapter,binding}=setup(policy);f.actualRoutes.peer.effective_model='fixture-builder';consumePeer(binding);
 await adapter.wait(adapter.start('critique',['broken']));const before=svc.status(f.req).runs[0],failed=before.operations.at(-1);
 expect(before.consumed_attempts).toBe(1);expect(()=>adapter.start('critique',['fixed'],{retry:{operation_id:failed.id,reason:'Correct input'}})).toThrow('review_retry_blocked');
 const after=svc.status(f.req).runs[0];expect(after.operations).toEqual(before.operations);expect(after.reasons).toContain('stage_failure');expect(after.consumed_attempts).toBe(1);
},25000);

test('ledger changes cannot turn identical declared review input into a correction',async()=>{
 const {svc,adapter}=setup(),runDir=path.join(f.root,'core-run');fs.mkdirSync(runDir);fs.writeFileSync(path.join(runDir,'ledger.jsonl'),'');fs.writeFileSync(path.join(runDir,'run.json'),'{}');fs.writeFileSync(path.join(runDir,'candidates.json'),'{}');
 const args=[runDir,{include:[]}];await adapter.wait(adapter.start('critique',args));const failed=svc.status(f.req).runs[0].operations[0];fs.appendFileSync(path.join(runDir,'ledger.jsonl'),'failed review event\n');
 let child,error;try{child=adapter.start('critique',args,{retry:{operation_id:failed.id,reason:'No actual correction'}});}catch(e){error=e;}
 if(child)await adapter.wait(child);expect(error?.code).toBe('review_retry_unavailable');expect(svc.status(f.req).runs[0].operations).toHaveLength(1);
},25000);
test('review retry chains cannot cycle back to already-failed declared input',async()=>{
 const {svc,adapter}=setup();await adapter.wait(adapter.start('critique',['A']));let failed=svc.status(f.req).runs[0].operations.at(-1);
 await adapter.wait(adapter.start('critique',['B'],{retry:{operation_id:failed.id,reason:'Try corrected B'}}));failed=svc.status(f.req).runs[0].operations.at(-1);
 let child,error;try{child=adapter.start('critique',['A'],{retry:{operation_id:failed.id,reason:'Return to unchanged A'}});}catch(e){error=e;}
 if(child)await adapter.wait(child);expect(error?.code).toBe('review_retry_unavailable');expect(svc.status(f.req).runs[0].operations).toHaveLength(2);
},25000);

test('a replacement holder uses official assignment and resume before explicit review recovery',async()=>{
 const cp=require('child_process'),proc=require('../../scripts/improve-process-identity.cjs');const predecessor=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 try{
  const {svc,adapter}=setup({},proc.identity(predecessor.pid));await adapter.wait(adapter.start('critique',['broken']));const failed=svc.status(f.req).runs[0].operations[0];
  await new Promise(resolve=>{predecessor.once('exit',resolve);predecessor.kill('SIGTERM');});
  const successor=f.successor({...f.current(),holder:'replacement',revision:'assignment-2',process:proc.identity()});svc.assign(f.command({principal:successor.principal,holder:successor.holder,assignment_revision:successor.revision}));f.use(successor);expect(f.claim().allowed).toBe(true);
  expect((await adapter.wait(adapter.start('critique',['fixed'],{retry:{operation_id:failed.id,reason:'Correct input after authentic takeover'}}))).status).toBe(0);
  const after=svc.status(f.req).runs[0];expect(after.operations[0]).toEqual(failed);expect(after.operations[1].generation).toBeGreaterThan(failed.generation);
 }finally{predecessor.kill('SIGTERM');}
},25000);
