'use strict';
// Controlled loss of an isolated qualification process, with independent
// watchdogs. A fenced stopped attempt is NOT a successful whole-job cleanup.
// Run last for a qualification job: it deliberately leaves its stopped attempt
// fenced and never resets that identity or extends its original deadline.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const repo=process.cwd(),identity=require(repo+'/scripts/improve-process-identity.cjs'),signal=require(repo+'/scripts/improve-controller-watchdog.cjs').signalGroup;
const attempts=require(repo+'/scripts/improve-backend-attempt.cjs'),{DurableStore}=require(repo+'/scripts/improve-worker.cjs');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const read=p=>JSON.parse(fs.readFileSync(p));
function docker(args,allowFailure=false){const r=cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,maxBuffer:262144,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});if(!allowFailure)assert.equal(r.status,0,'qualification_docker_operation_failed');return r;}
async function main(){
 const stateFile=path.resolve(process.argv[2]),state=read(stateFile),inputs=read(state.inputs),root=fs.mkdtempSync(path.join(state.root,'controller-loss-'));fs.chmodSync(root,0o700);
 const body=fs.readFileSync(path.join(repo,'tests/qualification/improve-backend-journeys.test.cjs'),'utf8');
 const marker='  for(const [i,c]of checks.entries()){';assert.equal(body.split(marker).length,2);
 const probe=`  const record=read(path.join(envelope,'generation-attempt.json')).value;
  const attempt={jobId:record.jobId,runId:record.runId,attemptId:record.attemptId,attemptSha256:hash(canonical(record))};
  const journal=fs.readdirSync(envelope).find(n=>n.startsWith('backend-journal-'));assert(journal);
  process.send({ready:true,root,envelope,attempt,journal:path.join(envelope,journal,'journal.json')});
  await new Promise(()=>{setInterval(()=>{},1000);});
`;
 const file=path.join(root,'controller.cjs');fs.writeFileSync(file,body.replace(marker,probe+marker),{mode:0o600});
 const out=fs.openSync(path.join(root,'controller.stdout'),'wx',0o600),err=fs.openSync(path.join(root,'controller.stderr'),'wx',0o600);
 let child,childIdentity,ready,foreign,foreignName,foreignImage,result;
 try{
  child=cp.fork(file,[stateFile,'after'],{detached:true,stdio:['ignore',out,err,'ipc']});childIdentity=identity.identity(child.pid);assert.equal(childIdentity.group,child.pid);
  const prepared=new Promise((resolve,reject)=>{child.on('message',m=>{if(m?.ready)resolve(m);});child.on('error',()=>reject(Error('fault_controller_spawn_failed')));child.on('exit',()=>reject(Error('fault_controller_setup_failed')));});
  let timer;try{ready=await Promise.race([prepared,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('fault_original_deadline_expired')),Math.max(1,state.deadlineAtMs-Date.now()));})]);}finally{clearTimeout(timer);}
  assert(ready.envelope.startsWith(inputs.root+'/backend-attempts/'));const before=read(ready.journal);assert.equal(before.phase,'execution');assert.equal(before.resourceProfile,state.profileId);
  const store=new DurableStore({root:inputs.root,sourceRoot:inputs.root});assert.equal(attempts.read(store,ready.attempt).owner.pid,child.pid);
  const observed=attempts.intents(store,ready.attempt).map(({value})=>{const created=attempts.resourceEvents(store,ready.attempt,value.slot).find(e=>e.state==='created');assert(created);return{slot:value.slot,id:created.id};});assert.equal(observed.length,9);
  foreignName='sf-298-foreign-'+crypto.randomUUID();foreignImage=require(repo+'/scripts/improve-backend.cjs').RECIPE.images.database;
  foreign=docker(['run','--rm','-d','--name',foreignName,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','268435456','--memory-swap','268435456','--cpus','1','--pids-limit','64','--user','postgres','--entrypoint','/bin/sh',foreignImage,'-c','sleep 120']).stdout.trim();assert(/^[a-f0-9]{64}$/.test(foreign));
  assert(signal(childIdentity),'controller_identity_not_live');
  const end=Math.min(state.deadlineAtMs,Date.now()+30000),terminalPath=path.join(path.dirname(ready.journal),'terminal.json');
  for(;;){const removed=observed.every(r=>attempts.resourceEvents(store,ready.attempt,r.slot).some(e=>e.state==='removed'));if(fs.existsSync(terminalPath)&&removed)break;assert(Date.now()<end,'independent_watchdog_cleanup_not_confirmed');await sleep(100);}
  const terminal=read(terminalPath);assert.equal(terminal.phase,'cleaned');assert.equal(terminal.cause,'backend_controller_died');assert.equal(terminal.successReceipt,false);assert.equal(terminal.deadlineEpochMs,before.deadlineEpochMs);
  assert.equal(identity.state(childIdentity),'dead');
  for(const r of observed){const gone=docker(['container','inspect',r.id],true);assert.notEqual(gone.status,0);assert.match(gone.stderr,/No such (object|container)/i);}
  assert.equal(JSON.parse(docker(['inspect',foreign]).stdout)[0].State.Running,true);
  const reconciliation=attempts.reconcileStopped(store,inputs.jobId);assert.equal(reconciliation.state,'operator_required');assert.equal(reconciliation.attempt.attemptId,ready.attempt.attemptId);
  assert(!fs.existsSync(path.join(store.root,'backend-attempts','terminal-'+ready.attempt.attemptId+'.json')));
  result={status:'passed',scope:'Independent owned-container cleanup and conservative fencing after actual controller-group death; not whole-attempt release',root,profileId:state.profileId,controllerDead:true,removed:observed,foreignSurvived:true,backendCause:terminal.cause,backendTerminal:terminal.phase,attemptState:reconciliation.state,credentialEnvelopeRemoved:false,successReceipt:false,originalDeadlineAtMs:state.deadlineAtMs,backendDeadlineAtMs:terminal.deadlineEpochMs};
 }finally{
  if(childIdentity&&identity.state(childIdentity)==='live')signal(childIdentity);
  if(foreign){const found=docker(['inspect',foreign],true);if(found.status===0){const c=JSON.parse(found.stdout)[0];assert.equal(c.Id,foreign);assert.equal(c.Name,'/'+foreignName);assert.equal(c.Image,foreignImage);docker(['rm','-f',foreign]);}}
  fs.closeSync(out);fs.closeSync(err);
 }
 // Publish only after the control container's own cleanup also succeeds.
 assert(result);result.foreignControlRemoved=true;
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2),{mode:0o600,flag:'wx'});console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message}));process.exitCode=1;});
