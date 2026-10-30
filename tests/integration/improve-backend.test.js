'use strict';
// The exported live suite is run by the mandatory qualification runner with an
// owner-private admitted fixture. Jest always runs the no-Docker admission cases;
// it must not describe those as live backend qualification.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const {readInputs,startBackend,closeBackend,observeBackend,admitBackend,backendContinuity}=require('../../scripts/improve-backend-runtime.cjs');
const {RECIPE,PROFILE}=require('../../scripts/improve-backend.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function live(descriptorPath){
 const d=JSON.parse(fs.readFileSync(descriptorPath));
 const read=ref=>{const bytes=fs.readFileSync(ref.path);assert.equal(hash(bytes),ref.sha256);return JSON.parse(bytes);};
 const r=read(d.request),m=read(d.manifest),product=read(d.product),root=d.root;
 let checks=0,worker,consumer,session;
 const check=(fn)=>{fn();checks++;};
 try{
  check(()=>assert.doesNotThrow(()=>readInputs(root,r,m)));
  const badImage=JSON.parse(JSON.stringify(m));badImage.images.auth='sha256:'+'0'.repeat(64);
  check(()=>assert.throws(()=>readInputs(root,r,badImage),/backend_input_invalid/));
  const foreign=JSON.parse(JSON.stringify(m));foreign.jobId='foreign-job';
  check(()=>assert.throws(()=>readInputs(root,r,foreign),/backend_input_changed/));
  const migration=path.join(root,m.migrationRoot,m.migrations[0].name),original=fs.readFileSync(migration);
  try{fs.appendFileSync(migration,'\n-- tampered');check(()=>assert.throws(()=>readInputs(root,r,m),/backend_input_changed/));}
  finally{fs.writeFileSync(migration,original);}
  fs.renameSync(migration,migration+'.missing');try{check(()=>assert.throws(()=>readInputs(root,r,m),/backend_input_changed/));}finally{fs.renameSync(migration+'.missing',migration);}
  const pi=read(product.inputs),request=read(product.request),built=read(product.built);
  const config=read(pi.workerConfig);const {DockerWorker}=require('../../scripts/improve-worker.cjs');
  worker=new DockerWorker({...config,gitArea:null,stateRoot:pi.root,jobId:request.jobId,maxMilliseconds:300000});
  consumer=require('../../scripts/improve-production-build.cjs').createProductionConsumer(worker,request,built.receipt,built.target);
  session=await startBackend({worker,anchorId:consumer.id,root,request:r,inputs:m});checks++;
  const query=`(async()=>{const r=await fetch('http://127.0.0.1:9999/health');if(r.status!==200)process.exit(1);console.log('AUTH_HEALTH_OK');})().catch(()=>process.exit(2));`;
  check(()=>assert.equal(consumer.exec(['/node/bin/node','-e',query]).stdout.trim(),'AUTH_HEALTH_OK'));
  const terminal=await closeBackend(session);session=null;
  check(()=>assert.equal(terminal.phase,'cleaned'));
  check(()=>assert.equal(terminal.resources.length,5));
  check(()=>assert(terminal.resources.every(x=>x.status==='removed'&&x.id&&/^[a-f0-9]{64}$/.test(x.createdFingerprint)&&/^[a-f0-9]{64}$/.test(x.runningFingerprint))));
  check(()=>assert.equal(terminal.successReceipt,false));
  check(()=>assert.equal(terminal.cause,null));
  check(()=>assert.equal(terminal.deadlineEpochMs-terminal.startedEpochMs,300000));
  return {executed:checks,failed:0,skipped:0,roles:terminal.resources.map(x=>({role:x.role,status:x.status})),scope:'Actual pinned services, full 156 migration replay, seed restoration, readiness and owned cleanup. No core success or browser journey claimed.'};
 }catch(e){throw Object.assign(Error(e.message),{executed:checks+1,failed:1,skipped:0});}
 finally{if(session)await closeBackend(session);if(consumer)consumer.close();if(worker)worker.close();}
}
module.exports={live};
if(require.main===module){live(process.argv[2]).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.log(JSON.stringify({executed:e.executed||1,failed:1,skipped:0,cause:/^backend_[a-z_]+$/.test(e.message)?e.message:'backend_qualification_failed'}));process.exitCode=1;});}
else if(typeof test==='function'){
 test('closed startup admission rejects unknown recipe without Docker',()=>{expect(()=>readInputs('/nonexistent',{recipeId:'unknown'},{})).toThrow('backend_input_invalid');});
 test('live startup cannot accept a forged worker capability',async()=>{await expect(startBackend({worker:{jobId:'job'},request:{jobId:'job'}})).rejects.toThrow('backend_input_changed');});
 test.each([observeBackend,admitBackend,backendContinuity])('measurement/admission/continuity cannot accept JSON capabilities: %p',async fn=>{await expect(fn({ready:true,measurement:{}},{})).rejects.toThrow('backend_input_invalid');});
 test('close cannot accept a JSON object as a live session',async()=>{await expect(closeBackend({ready:true})).rejects.toThrow('backend_input_invalid');});
}
