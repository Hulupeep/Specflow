'use strict';
// Maintainer-only actual service fault injection. No fabricated Docker results,
// journal outcomes, authority, or protected checker receipts.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const identity=require('../../scripts/improve-process-identity.cjs');
const SCENARIOS=['readiness-failure','resource-breach','storage-breach','foreign-same-name','missing-migration-file'];
const read=p=>JSON.parse(fs.readFileSync(p)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const docker=args=>cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});
const write=(root,name,value)=>fs.writeFileSync(path.join(root,name),JSON.stringify(value),{mode:0o600,flag:'wx'});
if(process.argv[2]==='--supervisor'){
 const [target,scenario,root]=process.argv.slice(3);assert(SCENARIOS.includes(scenario));
 let descriptor,journal,paused=false;
 process.on('message',d=>{if(d?.value?.managed)descriptor=d.value;});
 const Journal=require('../../scripts/improve-managed-backend.cjs').ManagedBackendJournal,phase=Journal.prototype.phase,started=Journal.prototype.started,close=Journal.prototype.close,reserve=Journal.prototype.reserve,spawn=cp.spawn;
 function barrier(operation,state){if(paused)return;paused=true;assert(descriptor);write(root,'barrier.json',{scenario,pid:process.pid,identity:identity.identity(),operation,journalRoot:descriptor.root,stage:descriptor.stage,state});process.kill(process.pid,'SIGSTOP');}
 Journal.prototype.reserve=function(...args){const result=reserve.apply(this,args);journal=this;return result;};
 Journal.prototype.phase=function(next){
  if(scenario==='storage-breach'&&next==='execution'){write(root,'storage-escaped-to-execution.json',{requestedPhase:next,previousPhase:this.snapshot().phase,protectedChecksExecuted:0});throw Error('storage_exhaustion_not_rejected_before_execution');}
  const result=phase.call(this,next);
  if(next==='readiness'&&['readiness-failure','resource-breach'].includes(scenario))barrier('real-backend-entering-readiness',this.snapshot());
  if(next==='bootstrap'&&scenario==='missing-migration-file')barrier('before-staged-migrations-execute',this.snapshot());
  return result;
 };
 Journal.prototype.started=function(role,...args){const result=started.call(this,role,...args);if(scenario==='storage-breach'&&role==='gateway')barrier('real-gateway-started-before-http-readiness',this.snapshot());return result;};
 cp.spawn=function(file,args,options){if(scenario==='foreign-same-name'&&file==='/usr/bin/docker'&&args[2]==='image'&&args[3]==='inspect')barrier('reserved-name-before-create',journal.snapshot());return spawn.call(this,file,args,options);};
 Journal.prototype.close=function(){
  if(descriptor){const file=path.join(descriptor.root,'terminal.json');if(fs.existsSync(file)){const bytes=fs.readFileSync(file);assert.deepEqual(JSON.parse(bytes),this.snapshot());write(root,'observed-terminal.json',{originalPath:file,sha256:hash(bytes),terminal:JSON.parse(bytes)});}}
  return close.call(this);
 };
 process.argv=[process.execPath,target];require('module')._load(target,null,true);
}else if(process.argv[2]==='--controller'){
 process.once('message',async({qualification,scenario,root})=>{
  const q=read(qualification),config=read(q.configFile),fork=cp.fork;
  assert.equal(fs.realpathSync(process.cwd()),fs.realpathSync(config.emptyCwd));
  assert.equal(process.env.PATH.split(path.delimiter)[0],config.bin);
  const selectedGit=process.env.PATH.split(path.delimiter).map(p=>path.join(p,'git')).find(p=>{try{fs.accessSync(p,fs.constants.X_OK);return true;}catch{return false;}});
  assert.equal(fs.realpathSync(selectedGit),fs.realpathSync(path.join(config.bin,'git')));
  write(root,'launch-proof.json',{cwd:process.cwd(),git:selectedGit,configuredGitWrapper:true});
  cp.fork=function(file,args,options){if(path.resolve(file)===path.resolve(__dirname,'../../scripts/improve-backend-runtime.cjs'))return fork.call(this,__filename,['--supervisor',file,scenario,root],options);return fork.call(this,file,args,options);};
  try{const result=await require('../../scripts/improve-worker.cjs').coreStage(config,'verifyPhase',[q.runDir,'baseline']);write(root,'controller-result.json',{result});}
  catch(e){write(root,'controller-error.json',{cause:e.code||e.message});process.exitCode=2;}
  finally{process.disconnect?.();}
 });
}else{
 async function run(qualification,scenario){
  assert(SCENARIOS.includes(scenario));const q=read(qualification),config=read(q.configFile),admissionBytes=fs.readFileSync(q.admission.path);assert.equal(hash(admissionBytes),q.admission.sha256);const admission=JSON.parse(admissionBytes);assert(Date.now()+600000<admission.deadlineAtMs,'insufficient_original_admission');
  const root=fs.mkdtempSync(path.join(q.root,'fault-'+scenario+'-'));fs.chmodSync(root,0o700);
  const backend=require('../../scripts/improve-backend.cjs'),foreignName='sf-operational-control-'+crypto.randomUUID();let controller,barrier,foreign,collision;
  try{
   const launched=docker(['run','-d','--name',foreignName,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','134217728','--memory-swap','134217728','--cpus','1','--pids-limit','32','--user','postgres','--entrypoint','/bin/sh',backend.RECIPE.images.database,'-c','sleep 1200']);assert.equal(launched.status,0);foreign=launched.stdout.trim();
   const out=fs.openSync(path.join(root,'controller.stdout'),'wx',0o600),err=fs.openSync(path.join(root,'controller.stderr'),'wx',0o600);
   const worker=require('../../scripts/improve-worker.cjs'),authority=worker.currentAuthority(config),env=worker.controlledEnvironment();
   const launch=authority.service.withAuthorized(authority.report.lease,'execute',()=>cp.fork(__filename,['--controller'],{cwd:config.emptyCwd,env:{...env,PATH:config.bin+path.delimiter+env.PATH},detached:true,stdio:['ignore',out,err,'ipc']}));assert(launch.allowed);const child=launch.result;fs.closeSync(out);fs.closeSync(err);controller=identity.identity(child.pid);assert.equal(controller.group,child.pid);let exited=null;child.once('exit',(code,signal)=>{exited={code,signal};});child.send({qualification,scenario,root});
   console.log(JSON.stringify({status:'running',scenario,root,controllerPid:child.pid,originalDeadlineAtMs:admission.deadlineAtMs}));
   const end=Math.min(admission.deadlineAtMs,Date.now()+600000),barrierFile=path.join(root,'barrier.json');
   while(!fs.existsSync(barrierFile)){assert.equal(identity.state(controller),'live','controller terminated before fault barrier');assert(Date.now()<end,'fault barrier timeout');await sleep(25);}
   barrier=read(barrierFile);assert.equal(barrier.scenario,scenario);assert.equal(identity.state(barrier.identity),'live');assert.notEqual(barrier.identity.group,controller.group);assert.equal(barrier.state.phase,['readiness-failure','resource-breach','storage-breach'].includes(scenario)?'readiness':'bootstrap');
   const attempts=require('../../scripts/improve-backend-attempt.cjs'),store=new worker.DurableStore({root:config.worker.stateRoot,sourceRoot:config.worker.stateRoot}),active=attempts.reconcileStopped(store,q.jobId);assert.equal(active.state,'active');const ref=active.attempt;
   const db=barrier.state.resources.find(r=>r.role==='database');
   if(['readiness-failure','resource-breach','storage-breach'].includes(scenario)){
    assert(db&&db.status==='running');const dbEvents=attempts.resourceEvents(store,ref,'database'),created=dbEvents.find(e=>e.state==='created');assert(created&&created.id===db.id);assert(dbEvents.some(e=>e.state==='started'));
    const inspection=JSON.parse(docker(['inspect',db.id]).stdout)[0];assert(inspection.State.Running);assert.equal(inspection.Name,'/'+db.name);assert.equal(inspection.Image,db.image);assert.equal(inspection.Config.Labels['specflow.backend.job'],q.jobId);
   }
   let injection;
   if(scenario==='readiness-failure'){
    assert.equal(docker(['kill','--signal','KILL',db.id]).status,0);const stopped=JSON.parse(docker(['inspect',db.id]).stdout)[0];assert(!stopped.State.Running);injection={operation:'kill-owned-database-at-readiness',id:db.id,runningBefore:true,runningAfter:false};
   }else if(scenario==='resource-breach'){
    const bytes=backend.PROFILE.output.perServiceBytes+1048576;assert(Number.isSafeInteger(bytes)&&bytes<33554432);
    const result=docker(['exec','--detach',db.id,'/bin/sh','-c','head -c '+bytes+' /dev/zero > /proc/1/fd/1']);assert.equal(result.status,0);injection={operation:'actual-owned-process-output',id:db.id,requestedBytes:bytes,perServiceLimit:backend.PROFILE.output.perServiceBytes};
   }else if(scenario==='storage-breach'){
    const target=barrier.state.resources.find(r=>r.role==='gateway');assert(target&&target.status==='running');
    const inspection=JSON.parse(docker(['inspect',target.id]).stdout)[0];
    assert(inspection.State.Running);assert.equal(inspection.Name,'/'+target.name);assert.equal(inspection.Image,target.image);
    assert.equal(inspection.Config.Labels['specflow.backend.job'],q.jobId);assert.equal(inspection.Config.Labels['specflow.backend.generation'],barrier.state.generation);assert.equal(inspection.Config.Labels['specflow.backend.reservation'],target.reservation);
    assert(inspection.HostConfig.Tmpfs['/tmp'].includes('size=16777216'));
    const available=()=>{const r=docker(['exec',target.id,'df','-Pk','/tmp']);assert.equal(r.status,0);const row=r.stdout.trim().split('\n').at(-1).trim().split(/\s+/);assert.equal(row.at(-1),'/tmp');const blocks=Number(row[3]);assert(Number.isSafeInteger(blocks)&&blocks>=0);return blocks;};
    const before=available();assert(before>0);
    assert.equal(docker(['exec',target.id,'/bin/sh','-c','printf storage-positive > /tmp/specflow-storage-positive']).status,0);
    const bytes=16777216+1048576;
    const exhausted=docker(['exec',target.id,'/bin/sh','-c','dd if=/dev/zero of=/tmp/specflow-storage-exhaustion bs=1048576 count=17']);
    const after=available();
    write(root,'storage-write-attempt.json',{id:target.id,limitBytes:16777216,requestedBytes:bytes,positiveWrite:true,availableBlocksBefore:before,availableBlocksAfter:after,exitCode:exhausted.status,signal:exhausted.signal,error:exhausted.error?.code||null,stderr:exhausted.stderr.slice(0,512)});
    assert.equal(exhausted.status,1);assert.match(exhausted.stderr,/No space left on device/i);
    assert.equal(after,0);
    injection={operation:'actual-owned-tmpfs-exhaustion',id:target.id,role:'gateway',mount:'/tmp',limitBytes:16777216,requestedBytes:bytes,positiveWrite:true,writeExit:exhausted.status,storageError:'ENOSPC',availableBlocksBefore:before,availableBlocksAfter:after};
   }else if(scenario==='missing-migration-file'){
    assert.equal(barrier.state.resources.length,0);const envelope=path.join(store.root,'backend-attempts','envelope-'+ref.attemptId),stage=fs.realpathSync(barrier.stage);assert.equal(path.dirname(stage),fs.realpathSync(envelope));assert(path.basename(stage).startsWith('backend-stage-'));
    const migration=backend.RECIPE.migrations.at(-1),file=path.join(stage,'migrations',migration.name);assert.equal(hash(fs.readFileSync(file)),migration.sha256);assert(fs.lstatSync(file).isFile());fs.unlinkSync(file);assert(!fs.existsSync(file));injection={operation:'remove-one-owned-staged-migration-before-execution',migration:migration.name,originalSha256:migration.sha256,remainingFiles:fs.readdirSync(path.dirname(file)).length};assert.equal(injection.remainingFiles,155);
   }else{
    assert(db&&db.status==='reserved');assert.deepEqual(attempts.resourceEvents(store,ref,'database'),[]);
    const launched=docker(['run','-d','--name',db.name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','134217728','--memory-swap','134217728','--cpus','1','--pids-limit','32','--user','postgres','--entrypoint','/bin/sh',backend.RECIPE.images.database,'-c','sleep 1200']);assert.equal(launched.status,0);collision={id:launched.stdout.trim(),name:db.name};const existing=JSON.parse(docker(['inspect',collision.id]).stdout)[0];assert(existing.State.Running);assert(!existing.Config.Labels?.['specflow.backend.job']);injection={operation:'create-foreign-control-with-reserved-name',...collision,matchingOwnedLabels:false};
   }
   write(root,'injection.json',injection);process.kill(barrier.pid,'SIGCONT');
   const finishBy=Math.min(admission.deadlineAtMs,Date.now()+150000),observedFile=path.join(root,'observed-terminal.json');
   while(!fs.existsSync(observedFile)||exited===null){assert(Date.now()<finishBy,'operational cleanup timeout');await sleep(50);}
   const observed=read(observedFile),terminal=observed.terminal;assert.equal(terminal.phase,scenario==='foreign-same-name'?'cleanup_failed':'cleaned');assert.equal(terminal.successReceipt,false);if(scenario!=='foreign-same-name')assert(terminal.resources.every(r=>r.status==='removed'));
   if(scenario==='resource-breach'){assert.equal(terminal.cause,'backend_output_limit');assert(terminal.resources.find(r=>r.role==='database').outputBytes>backend.PROFILE.output.perServiceBytes);}
   else if(scenario==='storage-breach')assert.equal(terminal.cause,'backend_storage_limit');
   else assert(['backend_service_died','backend_readiness_failed'].includes(terminal.cause),'readiness failure lacks expected named cause');
   let signed=null,resources,credentialEnvelopeRemoved=false,attemptState;
   if(scenario==='foreign-same-name'){
    assert.equal(attempts.reconcileStopped(store,q.jobId).state,'operator_required');attemptState='operator_required';resources=[];const evidence=[];
    for(const intent of attempts.intents(store,ref)){const slot=intent.value.slot,events=attempts.resourceEvents(store,ref,slot);evidence.push({intent,events});const created=events.find(e=>e.state==='created');if(created){assert(events.some(e=>e.state==='removed'));resources.push({slot,id:created.id,status:'removed'});}else{assert.equal(slot,'database');assert.deepEqual(events.map(e=>e.state),['dispatching']);}}
    write(root,'signed-resource-events.json',evidence);const existing=JSON.parse(docker(['inspect',collision.id]).stdout)[0];assert(existing.State.Running);assert.equal(existing.Name,'/'+collision.name);assert(!existing.Config.Labels?.['specflow.backend.job']);
   }else{
    signed=attempts.terminal(store,ref);assert.equal(signed.state,'cleaned');assert(signed.cause&&signed.cause.startsWith('backend_'));assert(signed.credentialEnvelopeRemoved);resources=signed.resources;credentialEnvelopeRemoved=true;attemptState='released';assert(resources.every(r=>['absent','removed'].includes(r.status)));
   }
   for(const resource of resources.filter(r=>r.id)){const gone=docker(['inspect',resource.id]);assert.notEqual(gone.status,0);assert.match(gone.stderr,/No such (object|container)/i);}
   assert(!resources.some(r=>r.slot==='checker'),'protected checker dispatched');
   const foreignState=JSON.parse(docker(['inspect',foreign]).stdout)[0];assert(foreignState.State.Running);assert.equal(foreignState.Name,'/'+foreignName);
   assert.equal(identity.state(controller),'dead');const ledger=fs.readFileSync(path.join(q.runDir,'ledger.jsonl'),'utf8').trim().split('\n').map(JSON.parse);assert(!ledger.some(e=>e.event==='holdout_consumed'));
   assert(!fs.existsSync(path.join(q.runDir,'verification/baseline/runtime-evidence')));
   const resultFile=path.join(root,'controller-result.json');assert(fs.existsSync(resultFile),'core must return its structured failure result');
   const blocked=read(resultFile).result;assert.equal(blocked.status,'blocked');assert.equal(blocked.backendFailure.originalCause,terminal.cause);assert.equal(blocked.backendFailure.cleanup,scenario==='foreign-same-name'?'unconfirmed':'cleaned');
   if(signed){assert.deepEqual(blocked.backendFailure.attempt,ref);assert.equal(hash(fs.readFileSync(blocked.backendFailure.terminal.path)),blocked.backendFailure.terminal.sha256);write(root,'signed-attempt-terminal.json',signed);}assert.equal(exited.code,0);assert.equal(exited.signal,null);
   const result={status:'passed',scenario,scope:scenario==='foreign-same-name'?'Actual foreign-name collision rejected, foreign control survives, owned resources removed; ambiguous dispatch deliberately quarantined, not falsely labelled clean.':'Actual core/factory owned-service fault, real Docker/file operation and supervisor detection; no deciding checker or holdout.',root,namedCause:terminal.cause,controllerCause:blocked.backendFailure.originalCause,terminalPhase:terminal.phase,successReceipt:false,foreignSurvived:true,sameNameForeignSurvived:!!collision,ownedRemoved:resources.filter(r=>r.status==='removed').length,credentialEnvelopeRemoved,attemptState,terminal:{path:observedFile,sha256:hash(fs.readFileSync(observedFile)),originalSha256:observed.sha256},injection,controllerExit:exited,originalDeadlineAtMs:admission.deadlineAtMs,executed:1,failed:0,skipped:0};write(root,'result.json',result);return result;
  }finally{
   if(controller&&identity.state(controller)==='live')require('../../scripts/improve-controller-watchdog.cjs').signalGroup(controller);
   if(barrier&&identity.state(barrier.identity)==='live')try{process.kill(barrier.pid,'SIGCONT');}catch{}
   if(collision){const r=docker(['inspect',collision.id]);if(r.status===0){const c=JSON.parse(r.stdout)[0];assert.equal(c.Name,'/'+collision.name);assert(!c.Config.Labels?.['specflow.backend.job']);assert.equal(docker(['rm','-f',collision.id]).status,0);}}
   if(foreign){const r=docker(['inspect',foreign]);if(r.status===0){assert.equal(JSON.parse(r.stdout)[0].Name,'/'+foreignName);assert.equal(docker(['rm','-f',foreign]).status,0);}}
  }
 }
 run(...process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message,message:e.message,frames:(e.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,5)}));process.exitCode=1;});
}
