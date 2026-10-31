'use strict';
// Actual frozen core checks, Git and durable archive. AI remains an explicit protocol double.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const core=require('../../scripts/specflow-improve.cjs'),proc=require('../../scripts/improve-process-identity.cjs');
const {DurableStore}=require('../../scripts/improve-worker.cjs');
const {coreFixture,executeCycle}=require('../helpers/improve-memory-core.cjs');
const {configureRecovery}=require('../helpers/improve-recovery-core.cjs');
let f,holder;
afterEach(async()=>{if(holder&&holder.exitCode===null&&holder.signalCode===null){const ended=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await ended;}f?.cleanup();f=null;holder=null;});

test('PREBUILD blocked baseline can be honestly abandoned after deadline without refund, fabricated implementation or successor lock release',async()=>{
  holder=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  f=coreFixture({configure:x=>configureRecovery(x,{initialProcess:proc.identity(holder.pid)})});
  f.claimRecovery();
  const attempted=await executeCycle(f,{invalid:true,stopBeforeBuild:true});
  expect(attempted.baseline.status).toBe('baseline_blocked');
  expect(core.events(attempted.runDir).some(e=>e.event==='implementation_started')).toBe(false);
  const prefix=fs.readFileSync(path.join(attempted.runDir,'ledger.jsonl'),'utf8');
  const base=f.git('rev-parse','main');
  const stopped=f.service().stop(f.req,{reason_code:'test_failure',stage:'baseline',failed_check:'Practice expectation differs from the real frozen baseline',evidence:[]});
  expect(stopped.state).toBe('incomplete');
  expect(f.service().admit({repo_id:'fixture',request_id:'before-abandonment'}).allowed).toBe(false);
  const ended=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await ended;
  f.recovery.resolveAssignment=()=>({principal:'owner',holder:'recovery-operator',revision:'recovery-operator-1',process:proc.identity()});
  f.clock=stopped.deadline_ms+1;
  const archive=new DurableStore({root:path.join(f.root,'abandoned-archive'),sourceRoot:attempted.runDir});
  f.recovery.resolvePrebuildSource=()=>({runDir:attempted.runDir,archive});
  const request=f.recoveryCommand({cycle_id:attempted.cycle.id,reason:'Frozen baseline does not justify an implementation; retain its failure.'},'abandon-prebuild-1');
  const reconciled=f.service().reconcilePrebuild(request);
  expect(reconciled.allowed).toBe(true);
  expect(f.service().store.read().history.filter(e=>e.event==='prebuild_abandoned').at(-1).adopted_prior).toBe(false);
  const completed=f.service().status(f.req).runs[0];
  expect(completed.deadline_ms).toBe(stopped.deadline_ms);
  expect(completed.consumed_cycles).toBe(stopped.consumed_cycles);
  expect(completed.consumed_attempts).toBe(stopped.consumed_attempts);
  expect(fs.readFileSync(path.join(attempted.runDir,'ledger.jsonl'),'utf8').startsWith(prefix)).toBe(true);
  expect(f.git('rev-parse','main')).toBe(base);
  const events=core.events(attempted.runDir);
  expect(events.filter(e=>e.event==='implementation_started'||e.event==='holdout_consumed')).toHaveLength(0);
  const decision=JSON.parse(fs.readFileSync(path.join(attempted.runDir,'decision.json')));
  expect(decision).toMatchObject({decision:'INCONCLUSIVE',disposition:'abandoned_before_build',implementation_attempted:false});
  expect(decision.gains.some(g=>g.established)).toBe(false);
  f.recovery.resolveTerminalArchive=()=>archive;
  const report=f.service().report(f.req);expect(report.established).toBe(false);
  expect(report.code_results[0]).toMatchObject({disposition:'abandoned_before_build',implementation_attempted:false});
  expect(report.verification_results[0].valid).toBe(false);
  expect(report.experiment_results[0].verdict).toBe('not-attempted');
  expect(fs.readFileSync(path.join(attempted.runDir,'report.md'),'utf8')).toContain('Abandoned before implementation');
  const successor=f.service().admit({repo_id:'fixture',request_id:'after-abandonment'});
  expect(successor.allowed).toBe(true);
  const replay=f.service().reconcilePrebuild(request);
  expect(replay.duplicate).toBe(true);
  expect(f.service().store.read().owners[f.repo]).toBe(successor.run_id);
  expect(()=>f.service().reconcilePrebuild({...request,reason:'Changed explanation under the old request ID'})).toThrow('recovery_idempotency_conflict');
},45000);

async function stoppedFixture(options={}){
  holder=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  f=coreFixture({configure:x=>configureRecovery(x,{initialProcess:proc.identity(holder.pid)})});f.claimRecovery();
  const cycle=await executeCycle(f,{invalid:true,stopBeforeBuild:true,...options});
  f.service().stop(f.req,{reason_code:'test_failure',stage:'baseline',failed_check:'Frozen baseline blocked',evidence:[]});
  const ended=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await ended;
  f.recovery.resolveAssignment=()=>({principal:'owner',holder:'recovery-operator',revision:'recovery-operator-1',process:proc.identity()});
  const archive=new DurableStore({root:path.join(f.root,'abandoned-archive'),sourceRoot:cycle.runDir});
  f.recovery.resolvePrebuildSource=()=>({runDir:cycle.runDir,archive});
  const request=f.recoveryCommand({cycle_id:cycle.cycle.id,reason:'Retain the blocked baseline without implementation.'},'abandon-prebuild-1');
  return {...cycle,archive,request};
}

test.each(['implementation','holdout','dirty_workspace','moved_base','unknown_holder','live_holder','stale_generation','unsealed_operation','reserved_operation','scoped_caller','wrong_principal','backend_unconfirmed'])('PREBUILD denies %s without releasing ownership or writing a disposition',async kind=>{
  const x=await stoppedFixture();
  if(kind==='implementation')core.append(x.runDir,'implementation_started',{fixture:true});
  if(kind==='holdout')core.append(x.runDir,'holdout_consumed',{fixture:true});
  if(kind==='dirty_workspace')fs.writeFileSync(path.join(f.root,'worktrees',x.binding.core_run_id+'-baseline','journey.json'),'changed');
  if(kind==='moved_base'){fs.writeFileSync(path.join(f.repo,'new-file'),'changed');f.git('add','new-file');f.git('commit','-m','move base');}
  if(kind==='unknown_holder')f.recovery.resolveProcess=p=>p.pid===holder.pid?'unknown':proc.state(p);
  if(kind==='live_holder')f.recovery.resolveProcess=p=>p.pid===holder.pid?'live':proc.state(p);
  if(kind==='stale_generation')x.request.expected_generation++;
  if(kind==='unsealed_operation')f.service().store.change(s=>s.runs[f.req.run_id].operations.push({id:'unsealed-op',state:'complete'}));
  if(kind==='reserved_operation')f.service().store.change(s=>s.runs[f.req.run_id].operations.push({id:'uncertain-op',state:'reserved'}));
  if(kind==='scoped_caller')f.recovery.scope={...f.req};
  if(kind==='wrong_principal'){const previous=f.config;f.config=()=>({...previous(),resolvePrincipal:()=>"intruder"});}
  if(kind==='backend_unconfirmed'){
    // Trusted-host backend resolver failure must not be treated as an empty proof.
    f.recovery.resolvePrebuildSource=()=>{throw Error('backend_cleanup_unconfirmed');};
  }
  const expected={implementation:'prebuild_work_already_started',holdout:'prebuild_work_already_started',dirty_workspace:'prebuild_workspace_changed',moved_base:'repository_mismatch',unknown_holder:'previous_holder_not_dead',live_holder:'previous_holder_not_dead',stale_generation:'recovery_generation_conflict',unsealed_operation:'receipt_binding_mismatch',reserved_operation:'reconciliation_required',scoped_caller:'scoped_execution_only',wrong_principal:'authority_revoked',backend_unconfirmed:'backend_cleanup_unconfirmed'};
  expect(()=>f.service().reconcilePrebuild(x.request)).toThrow(expected[kind]);
  expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
  expect(core.events(x.runDir).some(e=>e.event==='prebuild_abandonment_started')).toBe(false);
},45000);

test.each(['before_manifest_write','controller_write'])('PREBUILD crash at %s keeps ownership until durable retry and records one memory result',async cut=>{
  const x=await stoppedFixture();let armed=true;
  if(cut==='before_manifest_write')x.archive.fault=point=>{if(armed&&point===cut){armed=false;throw Error('controlled archive interruption');}};
  else {const original=f.config;f.config=()=>({...original(),fault:point=>{if(armed&&point==='write'){armed=false;throw Error('controlled controller interruption');}}});}
  expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('storage_commit_unconfirmed');
  expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
  expect(f.service().status(f.req).runs[0].active_cycle).toBe(x.cycle.id);
  const result=f.service().reconcilePrebuild(x.request);expect(result.allowed).toBe(true);
  expect(core.events(x.runDir).filter(e=>e.event==='decision_applied')).toHaveLength(1);
  const outcomes=f.service().decisionPack({repo_id:'fixture'}).events.filter(e=>e.kind==='outcome');
  expect(outcomes).toHaveLength(1);expect(outcomes[0].data.verification.valid).toBe(false);
  expect(f.service().reconcilePrebuild(x.request).duplicate).toBe(true);
},45000);

test('PREBUILD a corrupt durable archive cannot release the still-owned repo after controller interruption',async()=>{
 const x=await stoppedFixture();let armed=true;const original=f.config;
 f.config=()=>({...original(),fault:point=>{if(armed&&point==='write'){armed=false;throw Error('controlled controller interruption');}}});
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('storage_commit_unconfirmed');
 const meta={...x.binding,principal:'owner',repo_id:'fixture',profile_revision:f.revision};
 const receipt=x.archive.recover(x.binding.job_id,meta),entry=receipt.files.find(e=>e.path==='ledger.jsonl');
 fs.appendFileSync(path.join(x.archive.root,'blobs',entry.sha256),'corrupted archive bytes');
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow();
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
 expect(f.service().status(f.req).runs[0].active_cycle).toBe(x.cycle.id);
},45000);

test('PREBUILD read-only Git checks disable repository fsmonitor execution',async()=>{
 const x=await stoppedFixture(),marker=path.join(f.root,'unexpected-hook'),hook=path.join(f.root,'fsmonitor.sh');
 fs.writeFileSync(hook,'#!/bin/sh\nprintf invoked > '+JSON.stringify(marker)+'\n',{mode:0o700});
 f.git('config','core.fsmonitor',hook);
 core.abandonBeforeBuild(x.runDir,{reason:'No implementation is justified by this baseline.',requestSha256:'f'.repeat(64)});
 expect(fs.existsSync(marker)).toBe(false);
 expect(core.status(x.runDir).terminal).toBe(true);
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id); // core disposition alone cannot release ownership
},45000);

test('PREBUILD normal completeCycle cannot bypass owner reconciliation with an abandonment archive',async()=>{
 const x=await stoppedFixture();
 core.abandonBeforeBuild(x.runDir,{reason:'No implementation attempted.',requestSha256:'e'.repeat(64)});
 x.archive.commit({...x.binding,principal:'owner',repo_id:'fixture',profile_revision:f.revision},x.runDir);
 const original=f.service().store.read().runs[f.req.run_id].recovery;
 f.recovery.resolveAssignment=()=>structuredClone(original.current.assignment);
 f.recovery.resolveExecution=()=>({...structuredClone(original.current.assignment),generation:original.generation});
 f.recovery.scope={...f.req};
 expect(()=>f.service().completeCycle({...f.req,cycle_id:x.cycle.id},x.archive)).toThrow('prebuild_reconciliation_required');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);

test.each(['after_start','after_decision'])('PREBUILD retry after %s uses its captured unchanged-state proof when main later advances',async cut=>{
 const x=await stoppedFixture(),runner=require('../../scripts/specflow-runner.cjs'),original=runner.appendLedger;
 let armed=true;const spy=jest.spyOn(runner,'appendLedger').mockImplementation((file,entry)=>{
  const value=original(file,entry);
  if(armed&&entry.event===(cut==='after_start'?'prebuild_abandonment_started':'decision_made')){armed=false;throw Error('controlled core interruption');}
  return value;
 });
 try{expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('storage_commit_unconfirmed');}finally{spy.mockRestore();}
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
 const captured=core.events(x.runDir).find(e=>e.event==='prebuild_abandonment_started').record.base;
 fs.writeFileSync(path.join(f.repo,'later-work'),'unrelated later work');f.git('add','later-work');f.git('commit','-m','advance main after disposition started');
 f.profile.repository.refs[0].commit=f.git('rev-parse','main');
 require('../../scripts/improve-profiles.cjs').registerProfile(f.registry,f.profile,{lockTool:f.recovery.lockTool});
 expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
 expect(JSON.parse(fs.readFileSync(path.join(x.runDir,'decision.json'))).base).toEqual(captured);
 expect(core.events(x.runDir).filter(e=>e.event==='prebuild_abandonment_started')).toHaveLength(1);
 expect(core.events(x.runDir).filter(e=>e.event==='decision_applied')).toHaveLength(1);
 expect(f.service().store.read().owners[f.repo]).toBeUndefined();
},45000);


test.each(['missing_workspace','stale_baseline'])('PREBUILD denies %s with a specific recovery reason',async kind=>{
 const x=await stoppedFixture();
 if(kind==='missing_workspace')fs.renameSync(path.join(f.root,'worktrees',x.binding.core_run_id+'-baseline'),path.join(f.root,'retained-baseline'));
 else {const last=core.events(x.runDir).filter(e=>e.event==='baseline_attempted').at(-1);core.append(x.runDir,'baseline_attempted',{attempt:last.attempt+1,contract_sha256:'f'.repeat(64),contract_version:last.contract_version});}
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow(kind==='missing_workspace'?'prebuild_workspace_missing':'prebuild_baseline_unresolved');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
 expect(core.events(x.runDir).some(e=>e.event==='prebuild_abandonment_started')).toBe(false);
},45000);

test('PREBUILD owner can adopt a valid core-only abandonment without its original request ID',async()=>{
 const x=await stoppedFixture();
 core.abandonBeforeBuild(x.runDir,{reason:'Original core-only disposition.',requestSha256:'e'.repeat(64)});
 expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
 expect(f.service().store.read().owners[f.repo]).toBeUndefined();
 expect(core.events(x.runDir).filter(e=>e.event==='prebuild_abandonment_started')).toHaveLength(1);
},45000);

test('PREBUILD crash retry with a new request ID can finish the same disposition',async()=>{
 const x=await stoppedFixture();let armed=true;
 x.archive.fault=point=>{if(armed&&point==='before_manifest_write'){armed=false;throw Error('controlled interruption');}};
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('storage_commit_unconfirmed');
 expect(f.service().reconcilePrebuild({...x.request,request_id:'replacement-request'}).allowed).toBe(true);
 expect(f.service().store.read().owners[f.repo]).toBeUndefined();
 expect(core.events(x.runDir).filter(e=>e.event==='prebuild_abandonment_started')).toHaveLength(1);
},45000);

test('PREBUILD closed core fences later work and its report never invents an attempted patch',async()=>{
 const x=await stoppedFixture();core.abandonBeforeBuild(x.runDir,{reason:'Retain failed baseline.',requestSha256:'a'.repeat(64)});
 const before=core.events(x.runDir);
 for(const fn of ['prepareWorkspace','freezeContract','recordOracle','critique','oracle','judge','evaluate','finalize','recordCandidates','recordRole','submitJudgment','dispute']){
  expect(()=>core[fn](x.runDir,{})).toThrow('prebuild_abandonment_started');
 }
 await expect(core.verifyPhase(x.runDir,'baseline')).rejects.toThrow('prebuild_abandonment_started');
 await expect(core.devRound(x.runDir,1)).rejects.toThrow('prebuild_abandonment_started');
 expect(core.events(x.runDir)).toEqual(before);
 const report=fs.readFileSync(path.join(x.runDir,'report.md'),'utf8');
 expect(report).not.toContain('attempted patch');expect(report).not.toContain('consumed holdout');expect(report).toContain('separate authorisation');
},45000);

test('PREBUILD an experiment observation cannot promote an abandoned outcome',async()=>{
 const x=await stoppedFixture();f.service().reconcilePrebuild(x.request);
 const r=f.service().store.read().runs[f.req.run_id].recovery;
 f.recovery.resolveAssignment=()=>structuredClone(r.current.assignment);
 f.recovery.resolveExecution=()=>({...structuredClone(r.current.assignment),generation:r.generation});
 const outcome=f.service().decisionPack({repo_id:'fixture'}).events.find(e=>e.kind==='outcome');
 expect(()=>f.service().observeMemory(f.command({outcome_id:outcome.hash,source_revision:'later-claim',evidence:[],observation:{kind:'experiment',verdict:'proven',criteria_revision:f.task.criteria_revision,rationale:'An unrelated later claim'}}))).toThrow('memory_experiment_not_attempted');
},45000);

test('PREBUILD frozen disposable baseline output is retained without staging or blocking recovery',async()=>{
 const x=await stoppedFixture({generatedOutput:true});
 const output=path.join(f.root,'worktrees',x.binding.core_run_id+'-baseline','baseline-output/result.txt');
 expect(fs.readFileSync(output,'utf8')).toBe('actual check output');
 expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
 expect(fs.readFileSync(output,'utf8')).toBe('actual check output');
},45000);

test('PREBUILD durable abandonment archive remains authoritative after live source loss',async()=>{
 const x=await stoppedFixture();let armed=true;const original=f.config;
 f.config=()=>({...original(),fault:point=>{if(armed&&point==='write'){armed=false;throw Error('controlled controller interruption');}}});
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('storage_commit_unconfirmed');
 fs.writeFileSync(path.join(x.runDir,'decision.json'),'{');
 fs.writeFileSync(path.join(x.runDir,'ledger.jsonl'),'');
 expect(f.service().reconcilePrebuild({...x.request,request_id:'archive-recovery'}).allowed).toBe(true);
 expect(fs.readFileSync(path.join(x.runDir,'decision.json'),'utf8')).toBe('{'); // never rewrite damaged evidence
 expect(f.service().store.read().owners[f.repo]).toBeUndefined();
},45000);

test('PREBUILD forged ordinary INCONCLUSIVE cannot hide that no implementation ran',async()=>{
 const x=await stoppedFixture();core.abandonBeforeBuild(x.runDir,{reason:'Unimplemented.',requestSha256:'a'.repeat(64)});
 const decisionFile=path.join(x.runDir,'decision.json'),decision=JSON.parse(fs.readFileSync(decisionFile));delete decision.disposition;delete decision.implementation_attempted;
 fs.writeFileSync(decisionFile,JSON.stringify(decision));
 const hash=require('crypto').createHash('sha256').update(fs.readFileSync(decisionFile)).digest('hex');
 const rows=core.events(x.runDir).filter(e=>e.event!=='prebuild_abandonment_started');
 fs.writeFileSync(path.join(x.runDir,'ledger.jsonl'),'');
 for(const row of rows){const {event,stage,seq,prev_sha256,...data}=row;if(event==='decision_made')data.decision_sha256=hash;if(event==='decision_applied')delete data.disposition;core.append(x.runDir,event,data);}
 const meta={...x.binding,principal:'owner',repo_id:'fixture',profile_revision:f.revision};x.archive.commit(meta,x.runDir);
 expect(()=>require('../../scripts/improve-controller.cjs').verifyTerminalArchive(x.archive,meta,f.repo)).toThrow('terminal_implementation_missing');
},45000);

test('PREBUILD a later recovery generation can finish an interrupted stable disposition',async()=>{
 const x=await stoppedFixture();let armed=true;
 x.archive.fault=point=>{if(armed&&point==='before_manifest_write'){armed=false;throw Error('controlled interruption');}};
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('storage_commit_unconfirmed');
 const successor=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 try{
  const next={principal:'owner',holder:'intervening-operator',revision:'intervening-revision',process:proc.identity(successor.pid)};
  f.recovery.resolveSuccessor=()=>structuredClone(next);
  f.service().assign(f.recoveryCommand({principal:next.principal,holder:next.holder,assignment_revision:next.revision},'assign-intervening'));
  f.recovery.resolveAssignment=()=>structuredClone(next);
  expect(f.service().resume(f.recoveryCommand({},'intervening-resume')).allowed).toBe(true);
 }finally{const ended=new Promise(r=>successor.once('exit',r));successor.kill('SIGKILL');await ended;}
 f.recovery.resolveAssignment=()=>({principal:'owner',holder:'final-operator',revision:'final-revision',process:proc.identity()});
 const request=f.recoveryCommand({cycle_id:x.cycle.id,reason:'Finish the retained disposition.'},'new-generation-request');
 expect(request.expected_generation).toBeGreaterThan(x.request.expected_generation);
 expect(f.service().reconcilePrebuild(request).allowed).toBe(true);
 expect(core.events(x.runDir).filter(e=>e.event==='prebuild_abandonment_started')).toHaveLength(1);
},45000);

test('PREBUILD actual verification_blocked baseline can be abandoned without a fictional test result',async()=>{
 const x=await stoppedFixture();
 const result=await core.verifyPhase(x.runDir,'baseline',{backendSession:{}});expect(result.status).toBe('blocked');
 expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
 expect(JSON.parse(fs.readFileSync(path.join(x.runDir,'decision.json'))).baseline.event).toBe('verification_blocked');
},45000);

test('PREBUILD dead process interrupted immediately after baseline_attempted is explicitly untested',async()=>{
 const x=await stoppedFixture();
 const program=`const runner=require(${JSON.stringify(require.resolve('../../scripts/specflow-runner.cjs'))}),core=require(${JSON.stringify(require.resolve('../../scripts/specflow-improve.cjs'))});const original=runner.appendLedger;runner.appendLedger=(file,entry)=>{const r=original(file,entry);if(entry.event==='baseline_attempted')process.exit(23);return r;};core.verifyPhase(process.argv[1],'baseline');`;
 expect(cp.spawnSync(process.execPath,['-e',program,x.runDir],{timeout:10000}).status).toBe(23);
 expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
 expect(JSON.parse(fs.readFileSync(path.join(x.runDir,'decision.json'))).baseline.event).toBe('interrupted');
},45000);

test('PREBUILD owner can adopt a core-only disposition after unrelated main advancement',async()=>{
 const x=await stoppedFixture();core.abandonBeforeBuild(x.runDir,{reason:'Original disposition.',requestSha256:'b'.repeat(64)});
 fs.writeFileSync(path.join(f.repo,'later-work'),'later');f.git('add','later-work');f.git('commit','-m','later work');
 f.profile.repository.refs[0].commit=f.git('rev-parse','main');require('../../scripts/improve-profiles.cjs').registerProfile(f.registry,f.profile,{lockTool:f.recovery.lockTool});
 expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
 expect(f.service().store.read().history.filter(e=>e.event==='prebuild_abandoned').at(-1).adopted_prior).toBe(true);
},45000);

test('PREBUILD an integrity-blocked baseline cannot turn corrupt frozen checks into valid evidence',async()=>{
 const x=await stoppedFixture(),g=core.governingContract(x.runDir),artifact=Object.keys(g.entry.artifact_sha256)[0];
 fs.appendFileSync(path.join(x.runDir,artifact),'\n// changed frozen artifact');
 expect((await core.verifyPhase(x.runDir,'baseline')).status).toBe('blocked');
 expect(core.events(x.runDir).at(-1).event).toBe('contract_integrity_failed');
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_integrity_failed');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);

test.each(['cleaned','inert','missing_release'])('PREBUILD managed contract traverses the actual signed backend bridge: %s',async kind=>{
 const managed=require('../helpers/improve-prebuild-managed.cjs');
 const x=await stoppedFixture({prepareFreeze:(f,dir,contract)=>managed.prepareFreeze(f,dir,contract,{kind}),expectedBaseline:kind==='missing_release'?'interrupted':'blocked'});
 expect(core.governingContract(x.runDir).contract.runtime.backend.constructionSha256).toMatch(/^[a-f0-9]{64}$/);
 expect(core.events(x.runDir).some(e=>e.event==='verification_receipt')).toBe(false);
 if(kind!=='missing_release')expect(core.events(x.runDir).find(e=>e.event==='verification_blocked').backendFailure.attempt.runId).toBe(x.binding.core_run_id);
 f.recovery.resolvePrebuildSource=()=>({runDir:x.runDir,archive:x.archive,backendStore:x.backendStore});
 if(kind==='missing_release'){
  expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('backend_release_incomplete');
  expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
  expect(core.events(x.runDir).some(e=>e.event==='prebuild_abandonment_started')).toBe(false);
 }else{
  expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);
  expect(f.service().store.read().owners[f.repo]).toBeUndefined();
 }
},45000);

test('PREBUILD Git clean filters cannot execute during recovery inspection',async()=>{
 const x=await stoppedFixture(),work=path.join(f.root,'worktrees',x.binding.core_run_id+'-baseline'),marker=path.join(f.root,'filter-ran'),script=path.join(f.root,'filter.sh');
 fs.writeFileSync(script,'#!/bin/sh\nprintf ran > '+JSON.stringify(marker)+'\ncat\n',{mode:0o700});f.git('config','filter.prebuild.clean',script);
 fs.writeFileSync(path.join(work,'.gitattributes'),'*.json filter=prebuild\n');
 const file=path.join(work,'journey.json');fs.utimesSync(file,new Date(),new Date(Date.now()+60000));
 let failure;try{f.service().reconcilePrebuild(x.request);}catch(e){failure=e;}
 expect(fs.existsSync(marker)).toBe(false);expect(failure?.message).toBe('prebuild_git_config_unsafe');
},45000);

test('PREBUILD released stage failure reports abandonment instead of a held repository',async()=>{
 const x=await stoppedFixture();f.service().store.change(s=>{s.runs[f.req.run_id].reasons=['stage_failure'];});
 f.service().reconcilePrebuild(x.request);f.recovery.resolveTerminalArchive=()=>x.archive;
 const report=f.service().report(f.req);expect(report.repo_owned).toBe(false);expect(report.lifecycle).toBe('completed');
 expect(report.reason_code).toBe('abandoned_before_build');expect(report.next_action.action).not.toContain('remains held');
},45000);

test('PREBUILD stale completeCycle cannot change an already released abandoned run',async()=>{
 const x=await stoppedFixture();f.service().reconcilePrebuild(x.request);
 const before=f.service().store.read(),r=before.runs[f.req.run_id].recovery;
 f.recovery.resolveAssignment=()=>structuredClone(r.current.assignment);f.recovery.resolveExecution=()=>({...structuredClone(r.current.assignment),generation:r.generation});
 try{f.service().completeCycle({...f.req,cycle_id:x.cycle.id},x.archive);}catch(e){expect(e.message).toBe('prebuild_reconciliation_required');}
 expect(f.service().store.read()).toEqual(before);
},45000);


test('PREBUILD interrupted host verification cannot infer descendant cleanup from a dead parent',async()=>{
 const x=await stoppedFixture();
 const program=`const runner=require(${JSON.stringify(require.resolve('../../scripts/specflow-runner.cjs'))}),core=require(${JSON.stringify(require.resolve('../../scripts/specflow-improve.cjs'))});const original=runner.appendLedger;runner.appendLedger=(file,entry)=>{const r=original(file,entry);if(entry.event==='verification_started')process.exit(23);return r;};core.verifyPhase(process.argv[1],'baseline');`;
 expect(cp.spawnSync(process.execPath,['-e',program,x.runDir],{timeout:10000}).status).toBe(23);
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_descendants_unproven');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
 expect(core.events(x.runDir).some(e=>e.event==='prebuild_abandonment_started')).toBe(false);
},45000);


test('PREBUILD controller requires cleanup for the exact attempt recorded by the core',async()=>{
 const managed=require('../helpers/improve-prebuild-managed.cjs');
 const x=await stoppedFixture({prepareFreeze:(f,dir,contract)=>managed.prepareFreeze(f,dir,contract),expectedBaseline:'blocked'});
 const event=core.events(x.runDir).find(e=>e.event==='verification_blocked');
 core.append(x.runDir,'verification_blocked',{...event,backendFailure:{...event.backendFailure,attempt:{...event.backendFailure.attempt,attemptSha256:'e'.repeat(64)}}});
 f.recovery.resolvePrebuildSource=()=>({runDir:x.runDir,archive:x.archive,backendStore:x.backendStore});
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('backend_attempt_proof_missing');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
 expect(core.events(x.runDir).some(e=>e.event==='prebuild_abandonment_started')).toBe(false);
},45000);


test('PREBUILD later completed baseline cannot hide an earlier interrupted verification',async()=>{
 const x=await stoppedFixture();
 const program=`const runner=require(${JSON.stringify(require.resolve('../../scripts/specflow-runner.cjs'))}),core=require(${JSON.stringify(require.resolve('../../scripts/specflow-improve.cjs'))});const original=runner.appendLedger;runner.appendLedger=(file,entry)=>{const r=original(file,entry);if(entry.event==='verification_started')process.exit(23);return r;};core.verifyPhase(process.argv[1],'baseline');`;
 expect(cp.spawnSync(process.execPath,['-e',program,x.runDir],{timeout:10000}).status).toBe(23);
 expect((await core.verifyPhase(x.runDir,'baseline')).status).toBe('baseline_blocked');
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_descendants_unproven');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);
test('PREBUILD timed-out host command remains a descendant uncertainty',async()=>{
 const x=await stoppedFixture();core.append(x.runDir,'command_run',{role:'baseline',argv:['fixture-timeout'],timed_out:true});
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_descendants_unproven');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);
test('PREBUILD abandoned work cannot acquire a delivered proposal claim',async()=>{
 const x=await stoppedFixture();f.service().reconcilePrebuild(x.request);
 const r=f.service().store.read().runs[f.req.run_id].recovery;
 f.recovery.resolveAssignment=()=>structuredClone(r.current.assignment);
 f.recovery.resolveExecution=()=>({...structuredClone(r.current.assignment),generation:r.generation});
 const outcome=f.service().decisionPack({repo_id:'fixture'}).events.find(e=>e.kind==='outcome');
 expect(()=>f.service().observeMemory(f.command({outcome_id:outcome.hash,source_revision:'later-claim',evidence:[],observation:{kind:'proposal',state:'merged'}}))).toThrow('memory_proposal_not_attempted');
},45000);


test('PREBUILD Git submodules are rejected before status can inspect their drivers',async()=>{
 const x=await stoppedFixture(),work=path.join(f.root,'worktrees',x.binding.core_run_id+'-baseline');
 cp.execFileSync('git',['-C',work,'update-index','--add','--cacheinfo','160000,'+f.git('rev-parse','main')+',nested']);
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_submodule_unavailable');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);
test('PREBUILD same core disposition retry does not inspect subsequently configured Git drivers',async()=>{
 const x=await stoppedFixture(),request={reason:'Preserve baseline.',requestSha256:'a'.repeat(64)};
 core.abandonBeforeBuild(x.runDir,request);f.git('config','filter.later.clean','false');
 expect(()=>core.abandonBeforeBuild(x.runDir,request)).not.toThrow();
},45000);


test.each([
 ['managed-to-host',{backend:{constructionSha256:'a'.repeat(64)}},{}],
 ['server-to-host',{serve:['node','server.js']},{}],
 ['host-to-managed',{}, {backend:{constructionSha256:'a'.repeat(64)}}]
])('PREBUILD runtime supersession cannot hide earlier obligations: %s',(name,first,last)=>{
 const docs=[first,last].map(runtime=>Buffer.from(JSON.stringify({contract:{runtime}}))),events=docs.map((b,i)=>({event:'contract_frozen',version:i+1,contract_sha256:require('crypto').createHash('sha256').update(b).digest('hex')}));
 expect(()=>core.prebuildRuntimeHistory(events,n=>docs[Number(/v(\d+)/.exec(n)[1])-1])).toThrow('prebuild_runtime_history_changed');
});
test('PREBUILD actual superseding runtime declaration retains controller ownership',async()=>{
 const x=await stoppedFixture(),g=core.governingContract(x.runDir),contract={...g.contract,runtime:{identity:{mutable_outputs:['new-output']}}},file=path.join(f.root,'superseding-contract.json');fs.writeFileSync(file,JSON.stringify(contract));
 expect(core.freezeContract(x.runDir,file,{supersede:'Runtime declaration changed before implementation.'}).status).toBe('frozen');
 await core.verifyPhase(x.runDir,'baseline');
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_runtime_history_changed');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);
test('PREBUILD interrupted direct exec records its start and blocks abandonment',async()=>{
 const x=await stoppedFixture();
 const program=`const runner=require(${JSON.stringify(require.resolve('../../scripts/specflow-runner.cjs'))}),core=require(${JSON.stringify(require.resolve('../../scripts/specflow-improve.cjs'))});const original=runner.appendLedger;runner.appendLedger=(file,entry)=>{const r=original(file,entry);if(entry.event==='command_started')process.exit(23);return r;};core.cli(['exec',process.argv[1],'--','node','-e','process.exit(0)']);`;
 expect(cp.spawnSync(process.execPath,['-e',program,x.runDir],{timeout:10000}).status).toBe(23);
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_descendants_unproven');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);


test.each(['ENOBUFS','SIGTERM'])('PREBUILD forced termination remains uncertain: %s',async cause=>{
 const x=await stoppedFixture();core.append(x.runDir,'command_run',{command_id:'terminated-fixture',role:'verifier',terminated:true,timed_out:false,process_error:cause==='ENOBUFS'?cause:null,process_signal:cause==='SIGTERM'?cause:null});
 expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_descendants_unproven');
 expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);
},45000);


test.each([true,false])('PREBUILD signed backend cleanup governs only confined native commands: confined=%s',async confined=>{
 const managed=require('../helpers/improve-prebuild-managed.cjs');
 const x=await stoppedFixture({prepareFreeze:(f,dir,contract)=>managed.prepareFreeze(f,dir,contract),expectedBaseline:'blocked'});
 // Native termination is a protocol input here; the backend attempt and signed
 // cleanup are actual. This does not claim a real Docker native launch failed.
 core.append(x.runDir,'command_started',{command_id:'native-termination',native:true,confined,role:'verifier'});
 core.append(x.runDir,'command_run',{command_id:'native-termination',native:true,confined,role:'verifier',terminated:true,process_error:'ENOBUFS',process_signal:'SIGTERM'});
 f.recovery.resolvePrebuildSource=()=>({runDir:x.runDir,archive:x.archive,backendStore:x.backendStore});
 if(confined){expect(f.service().reconcilePrebuild(x.request).allowed).toBe(true);expect(f.service().store.read().owners[f.repo]).toBeUndefined();}
 else{expect(()=>f.service().reconcilePrebuild(x.request)).toThrow('prebuild_descendants_unproven');expect(f.service().store.read().owners[f.repo]).toBe(f.req.run_id);}
},45000);
