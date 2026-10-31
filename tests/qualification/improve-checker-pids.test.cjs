'use strict';
// Actual Docker qualification. Requires a hash-bound worker input capsule.
// Tests finite task pressure for ordinary and managed workers; no product verdict.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('node:assert/strict');
const {DockerWorker,DurableStore}=require('../../scripts/improve-worker.cjs');
const attempts=require('../../scripts/improve-backend-attempt.cjs'),managed=require('../../scripts/improve-managed-worker.cjs');
const input=JSON.parse(fs.readFileSync(process.argv[2]));
const configBytes=fs.readFileSync(input.workerConfig.path);
assert.equal(crypto.createHash('sha256').update(configBytes).digest('hex'),input.workerConfig.sha256);
const cfg=JSON.parse(configBytes),root=fs.mkdtempSync(path.resolve('.specflow/checker-pids/native-'));
fs.chmodSync(root,0o700);
const binary=path.join(root,'task-pressure');
cp.execFileSync('cc',['-static','-O2','-pthread',path.join(__dirname,'fixtures/checker-task-pressure.c'),'-o',binary],{stdio:'pipe',timeout:30000});
const results=[];
for(const mode of ['ordinary','managed'])for(const profile of ['heystax-backend-journeys-v1','heystax-backend-journeys-v2']){
 const stateRoot=path.join(root,mode+'-'+profile);fs.mkdirSync(stateRoot,{mode:0o700});
 const jobId='checker-pids-'+crypto.randomUUID(),store=new DurableStore({root:stateRoot,sourceRoot:stateRoot});
 const worker=new DockerWorker({...cfg,stateRoot,jobId,maxMilliseconds:60000});
 let ref;
 if(mode==='managed'){
  ref=attempts.begin(store,{jobId,runId:'capacity-only',phase:'dev-r1',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+120000});
  managed.bind(worker,{store,attempt:ref,authorize:()=>DockerWorker.probe()});managed.select(worker,'app');
 }
 try{
  const anchor=worker.create({role:'app'});
  if(ref)managed.select(worker,'checker');
  const checker=worker.createBackendChecker({network:'container:'+anchor,mounts:[{source:binary,destination:'/task-pressure',writable:false}]},profile);
  const inspect=JSON.parse(worker.call(['inspect',checker]).stdout)[0];
  assert.equal(inspect.HostConfig.PidsLimit,profile.endsWith('v2')?256:128);
  const result=worker.exec(checker,['/task-pressure'],{cwd:'/tmp',timeout:15000,allowFailure:true});
  const observation=JSON.parse(result.stdout);
  assert.equal(result.status,profile.endsWith('v2')?0:23);
  assert.equal(observation.capacityDenied,!profile.endsWith('v2'));
  if(profile.endsWith('v2'))assert.equal(observation.created,160);else assert(observation.created<128);
  results.push({mode,profile,pidsLimit:inspect.HostConfig.PidsLimit,...observation});
 }finally{worker.close();}
 assert.equal(worker.containers.size,0);
 if(ref){attempts.seal(store,ref);const terminal=attempts.finish(store,ref,{cause:'backend_qualification_only',backendTerminalSha256:null,productReceiptSha256:null});assert(terminal.resources.every(r=>r.status==='removed'));}
}
const report={status:'passed',scope:'kernel task capacity, not browser/product acceptance',results,cleanupConfirmed:true};
fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,root}));
