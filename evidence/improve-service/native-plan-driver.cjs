'use strict';
// Fixed qualified Node/backend recipe only. Normal core stages own models, acceptance, checks and decisions.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),kit=path.resolve(__dirname,'../..'),w=require('../../scripts/improve-worker.cjs'),q=require('../../scripts/improve-worker-qualify.cjs'),core=require('../../scripts/specflow-improve.cjs');
const read=f=>JSON.parse(fs.readFileSync(f)),write=(f,v)=>fs.writeFileSync(f,JSON.stringify(v,null,2)+'\n',{mode:0o600}),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fail=code=>{throw Object.assign(Error(code),{code});};
function progress(events){const frozen=events.filter(e=>e.event==='contract_frozen').at(-1),version=frozen?.version;return {baseline:events.some(e=>e.event==='baseline_recorded'&&e.contract_version===version),after:events.some(e=>e.event==='verification_completed'&&e.phase==='after'&&e.contract_version===version)};}
async function run({service,request,plan,runtimeRoot,host,generation}){
 if(fs.realpathSync(runtimeRoot)!==fs.realpathSync(kit))fail('runtime_binding_mismatch');
 const preparedFile=Object.keys(plan.input_hashes).find(f=>path.basename(f)==='qualification-plan.json');if(!preparedFile)fail('plan_binding_mismatch');const prepared=read(preparedFile),root=prepared.root,original=read(prepared.original_config),runDir=path.join(root,'core/worker-core-once');
 let current=service.status(request).runs[0],cycle=current.cycles.find(c=>c.id===current.active_cycle);
 if(current.terminal_cycles)return;
 const workerBinding={job_id:'service-'+request.run_id,operation_id:'worker-core-once',core_run_id:'worker-core-once'};
 if(!cycle&&host.memory&&!current.memory_selection){if(!prepared.memory_selection)fail('memory_selection_required');const selection=read(prepared.memory_selection),receipt=service.selectMemory({...request,request_id:'prepared-memory-selection',expected_revision:service.decisionPack({repo_id:request.repo_id}).revision,selection});if(!receipt.allowed)fail(receipt.reason_code);current=service.status(request).runs[0];}
 if(!cycle){const reserved=service.reserveCycle({...request,binding:workerBinding});if(!reserved.allowed)fail(reserved.run.reason_code||'cycle_denied');cycle=reserved.cycle;}
 const binding={...request,cycle_id:cycle.id,worker_binding:workerBinding},configFile=path.join(root,'bin/job.json');
 if(!fs.existsSync(path.join(root,'bound-configuration.json'))){
  const dynamic={format:2,lockTool:host.recovery.lockTool,ticketRoot:host.recovery.issueTicketsTo,scope:request,store:host.store,routes:host.recovery.routes,archiveStore:host.recovery.archiveStore};
  const ctx={uid:process.getuid(),principal:host.principal,ownerPrincipal:host.ownerPrincipal,store:host.store,registry:host.registry,host:host.host,...request,profile_revision:current.profile_revision,cycle_id:cycle.id,cli:original.claude,routing:original.models,requested_models:{builder:'sonnet',oracle:'opus',peer:'opus',judge:'opus'},recovery:dynamic};
  const gateway=require('../../scripts/improve-controller-provider.cjs').writeGateway(path.join(root,'gateway'),ctx);
  if(fs.existsSync(path.join(root,'bin')))fs.renameSync(path.join(root,'bin'),path.join(root,'unbound-bin'));
  fs.mkdirSync(path.join(root,'bin'),{mode:0o700});const controlled={...original,authority:{...original.authority,registry:host.registry,revision:current.profile_revision},claude:gateway,recovery:dynamic,controller_binding:binding};w.pinnedLauncher({directory:controlled.bin,config:controlled,mode:'git'});w.pinnedLauncher({directory:controlled.bin,config:controlled,mode:'worker'});write(path.join(root,'bound-configuration.json'),{binding,config_sha256:sha(fs.readFileSync(configFile))});
 }else{const old=read(path.join(root,'bound-configuration.json'));if(JSON.stringify(old.binding)!==JSON.stringify(binding)||old.config_sha256!==sha(fs.readFileSync(configFile)))fail('worker_binding_mismatch');}
 const cfg=read(configFile),adapter=require('../../scripts/improve-controller-worker.cjs').createControllerWorker({service,binding,configFile,evidenceDir:path.join(root,'stage-evidence')});
 w.startAuthorizedStage=(file,stage,args)=>{if(file!==configFile)fail('cross_job_stage');if(stage==='oracle')fs.appendFileSync(args[1].prompt,'\nFixture timing: role=status is intentionally empty BEFORE a response. First perform the actual authorised POST, confirm persisted backend data, THEN require visible Saved. Broken seed must fail for empty feedback after that write. Each separate check invocation has a fresh backend. Preserve success/403/reload/direct readback and screenshot assertions.\n');return adapter.start(stage,args);};w.awaitStage=child=>adapter.wait(child);
 const ev=()=>fs.existsSync(path.join(runDir,'run.json'))?core.events(runDir):[],has=(event,where=()=>true)=>ev().some(e=>e.event===event&&where(e));
 const prior=(stage,count=1)=>service.status(request).runs[0].operations.filter(o=>o.kind==='stage'&&o.stage===stage&&!o.not_started).length>=count;
 const once=async(stage,args)=>{const result=await q.stage(root,stage,args);if(result&&['blocked','rejected','baseline_blocked'].includes(result.status))fail('core_'+stage+'_blocked');return result;};
 if(!has('run_started')){if(prior('startRun'))fail('checkpoint_artifact_missing');await once('startRun',[{target:prepared.repository,mission:prepared.mission,base:'main',runId:'worker-core-once',stateDir:path.join(root,'core'),worktreeRoot:path.join(original.gitArea,'worktrees')}]);}
 if(!core.status(runDir).ledger.ok)fail('core_ledger_invalid');write(path.join(root,'active-core.json'),{runDir});
 if(!has('candidates_recorded')){if(prior('recordCandidates'))fail('checkpoint_artifact_missing');await once('recordCandidates',[runDir,prepared.candidates]);}
 for(const [phase,event]of [['critique','critique_recorded'],['oracle','oracle_authored'],['freeze','contract_frozen']]){
  if(has(event))continue;const stage={critique:'critique',oracle:'oracle',freeze:'freezeContract'}[phase];if(prior(stage))fail('checkpoint_artifact_missing');const result=await q.phase(root,phase);if(result&&['blocked','rejected'].includes(result.status))fail('core_'+phase+'_blocked');if(phase==='critique'&&result.verdict!=='pursue')fail('candidate_not_pursue');
 }
 if(!has('workspace_prepared',e=>e.kind==='baseline')){if(prior('prepareWorkspace'))fail('checkpoint_artifact_missing');await once('prepareWorkspace',[runDir,'baseline']);}
 if(!progress(ev()).baseline){if(has('baseline_attempted')||prior('verifyPhase'))fail('baseline_reconciliation_required');await once('verifyPhase',[runDir,'baseline']);}
 if(!has('implementation_finished')){if(has('implementation_started')||prior('build'))fail('implementation_reconciliation_required');await q.phase(root,'build');}
 if(!progress(ev()).after){if(has('holdout_consumed')||prior('verifyPhase',2))fail('consumed_holdout_unavailable');await q.phase(root,'verify');}
 if(!has('judgment_run')){if(prior('judge'))fail('judgment_reconciliation_required');await q.phase(root,'judge');}
 if(!has('decision_made'))await q.phase(root,'evaluate');
 if(!has('decision_applied'))await q.phase(root,'finalize');
 if(!core.status(runDir).terminal)fail('core_not_terminal');
 const archive=new w.DurableStore({root:path.join(root,'durable'),sourceRoot:runDir}),meta={...workerBinding,principal:current.principal,repo_id:request.repo_id,profile_revision:current.profile_revision};let receipt;
 if(fs.existsSync(path.join(archive.root,'jobs',workerBinding.job_id)))receipt=archive.recover(workerBinding.job_id,meta);else{
  const applied=ev().filter(e=>e.event==='decision_applied').at(-1);let bundle=null;
  if(applied.branch_retained){const worker=new w.DockerWorker(cfg.worker),staged=path.join(cfg.gitArea,'retained.bundle');try{const result=w.isolatedGit(worker,cfg.gitArea,['bundle','create',staged,applied.branch],{cwd:prepared.repository});if(result.status!==0)fail('retained_bundle_failed');bundle=path.join(runDir,'retained.bundle');fs.copyFileSync(staged,bundle);}finally{worker.close();}}
  const settled=new w.DockerWorker(cfg.worker);try{settled.close();receipt=w.durableCoreResult({store:archive,meta,runDir,workers:settled,retainedBundle:bundle});}finally{settled.close();}
 }
 write(path.join(root,'service-terminal-archive.json'),receipt);if(prepared.archive_barrier&&!fs.existsSync(path.join(root,'archive-release'))){write(path.join(root,'archive-ready.json'),{generation,run_id:request.run_id,manifest_sha256:receipt.manifest_sha256});while(!fs.existsSync(path.join(root,'archive-release')))await new Promise(resolve=>setTimeout(resolve,100));}
 const first=service.completeCycle({...request,cycle_id:cycle.id},archive),second=service.completeCycle({...request,cycle_id:cycle.id},archive);if(first.terminal_cycles!==1||second.terminal_cycles!==1||first.consumed_attempts!==second.consumed_attempts)fail('terminal_duplicate');write(path.join(root,'service-driver-result.json'),{generation,decision:core.status(runDir).decision,run_id:request.run_id,terminal_cycles:first.terminal_cycles,consumed_attempts:first.consumed_attempts,deadline_ms:first.deadline_ms,oracle:ev().filter(e=>e.event==='oracle_authored').length,holdout:ev().filter(e=>e.event==='holdout_consumed').length,report:service.report(request)});
}
module.exports={run,progress};
