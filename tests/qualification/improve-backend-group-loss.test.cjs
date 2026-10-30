'use strict';
// Real controller process-group death, not a mocked journal or a finally-only cleanup.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),assert=require('node:assert/strict');
const runtime=require('../../scripts/improve-backend-runtime.cjs'),identity=require('../../scripts/improve-process-identity.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=ref=>{const bytes=fs.readFileSync(ref.path);assert.equal(hash(bytes),ref.sha256);return JSON.parse(bytes);};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function docker(args,allowFailure=false){const r=cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,maxBuffer:262144,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});if(!allowFailure)assert.equal(r.status,0,'Docker operation '+args[0]+' failed');return r;}
function fixture(d){
 const root=fs.mkdtempSync(path.join(path.dirname(d.root),'group-loss-'));fs.chmodSync(root,0o700);const m=read(d.manifest),r=read(d.request);r.generation=crypto.randomUUID();
 fs.mkdirSync(path.join(root,m.migrationRoot),{mode:0o700});for(const f of m.migrations)fs.copyFileSync(path.join(d.root,m.migrationRoot,f.name),path.join(root,m.migrationRoot,f.name));
 for(const k of ['bootstrap','supabaseCli','seed','credentialBinding','runtimeLayer','configuration','resourceProfile'])fs.copyFileSync(path.join(d.root,m[k].path),path.join(root,m[k].path));
 fs.copyFileSync(path.join(d.root,r.productBuildReceipt.path),path.join(root,r.productBuildReceipt.path));if(d.measurement){const expected=read(d.measurement);m.expectedState=expected.state;r.expectedBackendIdentity=expected.measuredBackendIdentity;}const bytes=canonical(m);fs.writeFileSync(path.join(root,r.inputManifest.path),bytes,{mode:0o600});r.inputManifest.sha256=hash(bytes);return {root,r,m,product:read(d.product)};
}
async function controller(f){
 const {DockerWorker}=require('../../scripts/improve-worker.cjs');const pi=read(f.product.inputs),request=read(f.product.request),built=read(f.product.built);
 const worker=new DockerWorker({...read(pi.workerConfig),gitArea:null,stateRoot:pi.root,jobId:request.jobId,maxMilliseconds:300000});
 const consumer=require('../../scripts/improve-production-build.cjs').createProductionConsumer(worker,request,built.receipt,built.target);
 process.send({anchor:consumer.id});const session=await runtime.startBackend({worker,anchorId:consumer.id,root:f.root,request:f.r,inputs:f.m});if(f.phase==='execution')await runtime.admitBackend(session,{runId:'group-loss-execution',phase:f.r.phase,expectedBackendIdentity:f.r.expectedBackendIdentity,inputManifestSha256:f.r.inputManifest.sha256});process.send({ready:true});setInterval(()=>{},1000);
 // Deliberately no finally: the supervisor must own cleanup when this process is killed.
}
if(process.argv[2]==='--controller')process.once('message',f=>controller(f).catch(()=>{process.send?.({failed:true});process.exitCode=2;process.disconnect?.();}));
else{
 const {test}=require('node:test');const d=JSON.parse(fs.readFileSync(process.argv[2]));const phase=process.argv[3]||'readiness';assert(['bootstrap','readiness','execution'].includes(phase));
 test('real backend cleans after controller process-group death during '+phase,{timeout:180000},async()=>{
  const f={...fixture(d),phase};let child,foreign,anchor,journalPath,observed,terminal;
  const foreignName='sf-backend-foreign-'+crypto.randomUUID();
  try{
   foreign=docker(['run','-d','--name',foreignName,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','268435456','--memory-swap','268435456','--cpus','1','--pids-limit','64','--user','postgres','--entrypoint','/bin/sh',require('../../scripts/improve-backend.cjs').RECIPE.images.database,'-c','sleep 180']).stdout.trim();
   child=cp.fork(__filename,['--controller'],{detached:true,stdio:['ignore','ignore','ignore','ipc']});let ready=false,failed=false;child.on('message',m=>{if(m.anchor)anchor=m.anchor;if(m.ready)ready=true;if(m.failed)failed=true;});child.send(f);
   const deadline=Date.now()+120000;
   for(;;){assert(!failed&&child.exitCode===null&&child.signalCode===null,'controller failed before selected phase');assert(Date.now()<deadline,'phase startup timed out');
    const name=fs.readdirSync(f.root).find(n=>n.startsWith('backend-journal-'));if(name){journalPath=path.join(f.root,name,'journal.json');if(fs.existsSync(journalPath)){observed=JSON.parse(fs.readFileSync(journalPath));if(phase!=='bootstrap'?ready:observed.phase==='bootstrap'&&observed.resources.some(r=>r.status==='running'))break;}}
    await sleep(25);
   }
   assert.equal(observed.phase,phase);assert(observed.resources.length>0);assert.equal(identity.identity(child.pid).group,child.pid);
   const descendants=fs.readFileSync(`/proc/${child.pid}/task/${child.pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean).map(Number);
   const supervisor=descendants.find(pid=>{try{return fs.readFileSync('/proc/'+pid+'/cmdline').includes(Buffer.from('/scripts/improve-backend-runtime.cjs'));}catch{return false;}});
   assert(supervisor);const supervisorIdentity=identity.identity(supervisor);const controllerIdentity=identity.identity(child.pid);
   const closed=new Promise(resolve=>child.once('close',resolve));assert(require('../../scripts/improve-controller-watchdog.cjs').signalGroup(controllerIdentity));
   const terminalPath=path.join(path.dirname(journalPath),'terminal.json');const cleanupDeadline=Date.now()+25000;
   while(!fs.existsSync(terminalPath)&&Date.now()<cleanupDeadline)await sleep(100);
   const report={phase,controllerDead:identity.state(controllerIdentity)==='dead',sameProcessGroup:supervisorIdentity.group===controllerIdentity.group,terminalPresent:fs.existsSync(terminalPath),successReceipt:false};
   fs.writeFileSync(path.join(f.root,'group-loss-result.json'),JSON.stringify(report));console.log(JSON.stringify(report));
   assert(report.terminalPresent,'supervisor did not record terminal cleanup after controller group death');terminal=JSON.parse(fs.readFileSync(terminalPath));
   assert.equal(terminal.phase,'cleaned');assert.equal(terminal.cause,'backend_controller_died');assert.equal(terminal.successReceipt,false);assert(terminal.resources.every(r=>r.status==='removed'));
   for(const r of terminal.resources){const gone=docker(['inspect',r.id||r.name],true);assert.notEqual(gone.status,0);assert.match(gone.stderr,/No such (object|container)/i);}
   assert.equal(JSON.parse(docker(['inspect',foreign]).stdout)[0].State.Running,true);assert(!fs.readdirSync(f.root).some(n=>n.startsWith('backend-stage-')),'private credential stage survived controller loss');
   assert.equal(terminal.deadlineEpochMs-terminal.startedEpochMs,300000);assert.equal(terminal.resources.length,observed.resources.length);console.log(JSON.stringify({phase,terminal:terminal.phase,cause:terminal.cause,removed:terminal.resources.length,foreignSurvived:true,privateStageRemoved:true,deadlineMilliseconds:300000,successReceipt:false}));await closed;
  }finally{
   if(child&&identity.state(identity.identity(child.pid))==='live')require('../../scripts/improve-controller-watchdog.cjs').signalGroup(identity.identity(child.pid));
   // Failure containment only. Never edits the journal or manufactures terminal evidence.
   if(journalPath&&fs.existsSync(journalPath)){const j=JSON.parse(fs.readFileSync(journalPath));for(const slot of j.resources){const raw=docker(['inspect',slot.id||slot.name],true);if(raw.status!==0)continue;const c=JSON.parse(raw.stdout)[0],l=c.Config.Labels;assert.equal(c.Image,slot.image);assert.equal(c.Name,'/'+slot.name);for(const[k,v]of Object.entries({job:j.jobId,generation:j.generation,reservation:slot.reservation,role:slot.role}))assert.equal(l['specflow.backend.'+k],v);docker(['rm','-f',c.Id]);}}
   for(const name of fs.readdirSync(f.root).filter(n=>n.startsWith('backend-stage-'))){const p=path.join(f.root,name);assert(!fs.lstatSync(p).isSymbolicLink());fs.rmSync(p,{recursive:true,force:true});}
   if(foreign)docker(['rm','-f',foreign],true);
   // The production consumer has its own independent ownership watchdog; await absence.
   if(anchor){const end=Date.now()+15000;while(docker(['inspect',anchor],true).status===0&&Date.now()<end)await sleep(100);assert.notEqual(docker(['inspect',anchor],true).status,0,'consumer watchdog left its anchor');}
  }
 });
}
