'use strict';
// Explicit maintainer fault injection. The real core/factory/runtime and Docker
// operations execute; only a supervisor scheduling barrier is added by this test.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto');
const identity=require('../../scripts/improve-process-identity.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms)),read=p=>JSON.parse(fs.readFileSync(p));
const docker=args=>cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});
function write(root,name,value){fs.writeFileSync(path.join(root,name),JSON.stringify(value),{mode:0o600,flag:'wx'});}
if(process.argv[2]==='--supervisor'){
 const [target,scenario,root]=process.argv.slice(3);assert.equal(scenario,'before-create');
 const spawn=cp.spawn;let paused=false;
 cp.spawn=function(file,args,options){
  if(!paused&&file==='/usr/bin/docker'&&args[2]==='image'&&args[3]==='inspect'){
   paused=true;write(root,'barrier.json',{scenario,pid:process.pid,identity:identity.identity(),operation:'image-inspect-after-reservation-before-create'});
   process.kill(process.pid,'SIGSTOP');
  }
  return spawn.call(this,file,args,options);
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
  cp.fork=function(file,args,options){
   if(path.resolve(file)===path.resolve(__dirname,'../../scripts/improve-backend-runtime.cjs'))return fork.call(this,__filename,['--supervisor',file,scenario,root],options);
   return fork.call(this,file,args,options);
  };
  try{const result=await require('../../scripts/improve-worker.cjs').coreStage(config,'verifyPhase',[q.runDir,'baseline']);write(root,'controller-result.json',{result});}
  catch(e){write(root,'controller-error.json',{cause:e.code||e.message});process.exitCode=2;}
  finally{process.disconnect?.();}
 });
}else{
 async function run(qualification,scenario){
  assert.equal(scenario,'before-create');const q=read(qualification),config=read(q.configFile);
  const admissionBytes=fs.readFileSync(q.admission.path);assert.equal(crypto.createHash('sha256').update(admissionBytes).digest('hex'),q.admission.sha256);
  const admission=JSON.parse(admissionBytes);assert(Date.now()+600000<admission.deadlineAtMs,'insufficient_original_admission');
  const root=fs.mkdtempSync(path.join(q.root,'fault-'+scenario+'-'));fs.chmodSync(root,0o700);
  const foreignName='sf-fault-control-'+crypto.randomUUID(),image=require('../../scripts/improve-backend.cjs').RECIPE.images.database;
  let child,controller,barrier,foreign;
  try{
   const launched=docker(['run','-d','--name',foreignName,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','134217728','--memory-swap','134217728','--cpus','1','--pids-limit','32','--user','postgres','--entrypoint','/bin/sh',image,'-c','sleep 1200']);assert.equal(launched.status,0);foreign=launched.stdout.trim();
   const out=fs.openSync(path.join(root,'controller.stdout'),'wx',0o600),err=fs.openSync(path.join(root,'controller.stderr'),'wx',0o600);
   const workerModule=require('../../scripts/improve-worker.cjs'),authority=workerModule.currentAuthority(config),env=workerModule.controlledEnvironment();
   const launch=authority.service.withAuthorized(authority.report.lease,'execute',()=>cp.fork(__filename,['--controller'],{cwd:config.emptyCwd,env:{...env,PATH:config.bin+path.delimiter+env.PATH},detached:true,stdio:['ignore',out,err,'ipc']}));
   assert(launch.allowed);child=launch.result;fs.closeSync(out);fs.closeSync(err);controller=identity.identity(child.pid);assert.equal(controller.group,child.pid);child.send({qualification,scenario,root});
   console.log(JSON.stringify({status:'running',scenario,root,controllerPid:child.pid,originalDeadlineAtMs:admission.deadlineAtMs}));
   const end=Math.min(admission.deadlineAtMs,Date.now()+600000),barrierFile=path.join(root,'barrier.json');
   while(!fs.existsSync(barrierFile)){assert.equal(identity.state(controller),'live','controller terminated before fault barrier');assert(Date.now()<end,'fault barrier timeout');await sleep(25);}
   barrier=read(barrierFile);assert.equal(barrier.scenario,scenario);assert.equal(identity.state(barrier.identity),'live');assert.notEqual(barrier.identity.group,controller.group);
   const attempts=require('../../scripts/improve-backend-attempt.cjs'),{DurableStore}=require('../../scripts/improve-worker.cjs'),store=new DurableStore({root:config.worker.stateRoot,sourceRoot:config.worker.stateRoot});
   const active=attempts.reconcileStopped(store,q.jobId);assert.equal(active.state,'active');const ref=active.attempt;
   const envelope=path.join(store.root,'backend-attempts','envelope-'+ref.attemptId),journals=fs.readdirSync(envelope).filter(n=>n.startsWith('backend-journal-'));assert.equal(journals.length,1);
   const journalRoot=path.join(envelope,journals[0]),before=read(path.join(journalRoot,'journal.json'));
   assert.equal(before.resources.length,1);assert.equal(before.resources[0].role,'database');assert.equal(before.resources[0].status,'reserved');assert.equal(attempts.resourceEvents(store,ref,'database').length,0);
   write(root,'before-kill.json',{controller,supervisor:barrier.identity,attempt:ref,journal:before});
   assert(require('../../scripts/improve-controller-watchdog.cjs').signalGroup(controller));
   process.kill(barrier.pid,'SIGCONT');
   const terminalFile=path.join(journalRoot,'terminal.json'),cleanupEnd=Date.now()+60000;
   while(!fs.existsSync(terminalFile)){assert(Date.now()<cleanupEnd,'backend cleanup timeout');await sleep(50);}
   const terminal=read(terminalFile);assert.equal(terminal.phase,'cleaned');assert.equal(terminal.cause,'backend_controller_died');assert.equal(terminal.successReceipt,false);assert(terminal.resources.every(r=>r.status==='removed'));
   assert.deepEqual(attempts.resourceEvents(store,ref,'database').map(e=>e.state),['not_dispatched']);
   const appEvents=()=>attempts.resourceEvents(store,ref,'app');
   while(!appEvents().some(e=>e.state==='removed')){assert(Date.now()<cleanupEnd,'app watchdog cleanup timeout');await sleep(50);}
   for(const intent of attempts.intents(store,ref)){
    const events=attempts.resourceEvents(store,ref,intent.value.slot),created=events.find(e=>e.state==='created');
    if(created){const gone=docker(['inspect',created.id]);assert.notEqual(gone.status,0);assert.match(gone.stderr,/No such (object|container)/i);assert(events.some(e=>e.state==='removed'));}
   }
   const foreignState=JSON.parse(docker(['inspect',foreign]).stdout)[0];assert(foreignState.State.Running);assert.equal(foreignState.Name,'/'+foreignName);
   assert.equal(identity.state(controller),'dead');
   const ledger=fs.readFileSync(path.join(q.runDir,'ledger.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
   assert(!ledger.some(e=>e.event==='holdout_consumed'||(e.event==='verification_receipt'&&e.phase==='baseline')));
   assert(!fs.existsSync(path.join(q.runDir,'verification/baseline/runtime-evidence')));
   const recovery=attempts.reconcileStopped(store,q.jobId);assert.equal(recovery.state,'operator_required');
   const result={status:'passed',scenario,scope:'Actual managed core/factory controller kill before backend create; no deciding checks. Backend/app cleanup verified; dead-coordinator attempt stays operator_required, never silently released.',root,namedCause:terminal.cause,successReceipt:false,databaseDispatched:false,foreignSurvived:true,controllerDead:true,supervisorSeparateGroup:true,attemptState:recovery.state,terminal:{path:terminalFile,sha256:crypto.createHash('sha256').update(fs.readFileSync(terminalFile)).digest('hex')},originalDeadlineAtMs:admission.deadlineAtMs,skipped:0};write(root,'result.json',result);return result;
  }finally{
   if(controller&&identity.state(controller)==='live')require('../../scripts/improve-controller-watchdog.cjs').signalGroup(controller);
   if(barrier&&identity.state(barrier.identity)==='live')try{process.kill(barrier.pid,'SIGCONT');}catch{}
   if(foreign){const r=docker(['inspect',foreign]);if(r.status===0){assert.equal(JSON.parse(r.stdout)[0].Name,'/'+foreignName);assert.equal(docker(['rm','-f',foreign]).status,0);}}
   // Never remove unknown job resources or fabricate a successful journal.
  }
 }
 run(...process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message,message:e.message,frames:(e.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,5)}));process.exitCode=1;});
}
