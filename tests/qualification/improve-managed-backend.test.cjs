'use strict';
// Live five-service bridge qualification. Reuses admitted source/dependencies,
// rebuilds the product with fresh job credentials; not a core outcome proof.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {DockerWorker,DurableStore}=require('../../scripts/improve-worker.cjs');
const production=require('../../scripts/improve-production-build.cjs');
const credentials=require('../../scripts/improve-backend-credentials.cjs');
const attempts=require('../../scripts/improve-backend-attempt.cjs');
const managed=require('../../scripts/improve-managed-worker.cjs');
const runtime=require('../../scripts/improve-backend-runtime.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=ref=>{const bytes=fs.readFileSync(ref.path);assert.equal(hash(bytes),ref.sha256);return JSON.parse(bytes);};
async function main(){
 const descriptor=JSON.parse(fs.readFileSync(process.argv[2])),original=read(descriptor.request),template=read(descriptor.manifest);
 const product=read(descriptor.product),inputs=read(product.inputs),request=read(product.request),cfg=read(inputs.workerConfig);
 const root=fs.mkdtempSync(path.join(inputs.root,'managed-services-'));fs.chmodSync(root,0o700);
 const store=new DurableStore({root:inputs.root,sourceRoot:inputs.root}),phase='dev-r1';
 // Test contract/construction identities; never relabel this fixture a frozen
 // core contract or full receipt. The factory integration remains a separate gate.
 const constructionSha256=hash(production.canonical(template));
 const attempt=attempts.begin(store,{jobId:request.jobId,runId:'managed-service-qualification',phase,contractSha256:hash(production.canonical(original)),constructionSha256,authoritySha256:hash('qualification-only'),deadlineAtMs:Date.now()+600000});
 const reference=credentials.issue(store,{jobId:request.jobId,phase}),issued=credentials.read(store,reference);
 const manifest=JSON.parse(JSON.stringify(template)),r={...original,schema:'specflow.backend-request/v2',phase,generation:reference.generation,constructionSha256};
 fs.mkdirSync(path.join(root,manifest.migrationRoot),{mode:0o700});
 for(const f of manifest.migrations)fs.copyFileSync(path.join(descriptor.root,manifest.migrationRoot,f.name),path.join(root,manifest.migrationRoot,f.name));
 for(const k of ['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile'])fs.copyFileSync(path.join(descriptor.root,manifest[k].path),path.join(root,manifest[k].path));
 const secret=production.canonical(issued);fs.writeFileSync(path.join(root,manifest.credentialBinding.path),secret,{mode:0o600});manifest.credentialBinding.sha256=hash(secret);
 const manifestBytes=production.canonical(manifest);fs.writeFileSync(path.join(root,r.inputManifest.path),manifestBytes,{mode:0o600});r.inputManifest.sha256=hash(manifestBytes);
 const attemptBytes=fs.readFileSync(path.join(store.root,'backend-attempts','attempt-'+attempt.attemptId+'.json'));fs.writeFileSync(path.join(root,'attempt.json'),attemptBytes,{mode:0o600});r.attempt={path:'attempt.json',sha256:hash(attemptBytes)};
 const worker=new DockerWorker({...cfg,gitArea:null,stateRoot:inputs.root,jobId:request.jobId,maxMilliseconds:300000});
 managed.bind(worker,{store,attempt,authorize:()=>DockerWorker.probe()});let consumer,session,terminal;
 try{
  const productInput={...request,runtimeSha256:production.runtimeIdentity(worker),environment:{...request.environment,NEXT_PUBLIC_SUPABASE_ANON_KEY:issued.anonKey}};
  managed.select(worker,'build');const built=production.runProductionBuild(worker,productInput,path.join(root,'built'));
  const bytes=production.canonical(built.receipt);fs.writeFileSync(path.join(root,r.productBuildReceipt.path),bytes,{mode:0o600});r.productBuildReceipt.sha256=hash(bytes);
  managed.select(worker,'app');consumer=production.createProductionConsumer(worker,productInput,built.receipt,built.target);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root,request:r,inputs:manifest,credentials:{store,reference},productInput});
  const observed=await runtime.observeBackend(session);assert.equal(observed.phase,phase);
  terminal=await runtime.closeBackend(session);session=null;assert.equal(terminal.phase,'cleaned');assert.equal(terminal.resources.length,5);
 }finally{try{if(session)await runtime.closeBackend(session);}finally{if(consumer)consumer.close();worker.close();}}
 const intents=attempts.intents(store,attempt);assert.equal(intents.length,7);
 for(const {value}of intents){const events=attempts.resourceEvents(store,attempt,value.slot);assert(events.some(e=>e.state==='removed'),value.slot+' not removed');assert(!events.some(e=>['foreign','unconfirmed'].includes(e.state)));}
 assert.equal(attempts.read(store,attempt).attemptId,attempt.attemptId);
 const result={status:'passed',scope:'managed builder/app/five-service signed ownership and removal; no core or complete envelope-release claim',roles:intents.map(i=>i.value.slot),backendTerminal:terminal.phase,reservationRetained:true,skipped:0,root};
 fs.writeFileSync(path.join(root,'qualification-result.json'),JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message}));process.exitCode=1;});
