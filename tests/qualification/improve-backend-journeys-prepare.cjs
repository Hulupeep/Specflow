'use strict';
// Disposable profile qualification only. Not a product contract or KEEP.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const repo=process.cwd(),w=require(repo+'/scripts/improve-worker.cjs'),production=require(repo+'/scripts/improve-production-build.cjs');
const admission=require(repo+'/scripts/improve-backend.cjs'),profiles=require(repo+'/scripts/improve-backend-profiles.cjs');
const credentials=require(repo+'/scripts/improve-backend-credentials.cjs'),attempts=require(repo+'/scripts/improve-backend-attempt.cjs'),managed=require(repo+'/scripts/improve-managed-worker.cjs');
const runtime=require(repo+'/scripts/improve-backend-runtime.cjs'),semantics=require(repo+'/scripts/improve-backend-semantics.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>w.strictJSON(fs.readFileSync(p).toString()),canonical=production.canonical;
const bound=ref=>{const b=fs.readFileSync(ref.path);assert.equal(hash(b),ref.sha256);return w.strictJSON(b.toString());};
function write(root,name,value){const b=Buffer.isBuffer(value)?value:Buffer.from(canonical(value)),file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,b,{flag:'wx',mode:0o600});return{path:file,sha256:hash(b)};}
async function main(){
 const profileId=process.argv[5]??'heystax-backend-journeys-v1';
 profiles.workerLimits(profileId,'app');
 const label=profileId==='heystax-backend-journeys-v3'?'profile-327':profileId==='heystax-backend-journeys-v2'?'profile-315':'profile-298';
 const inputs=read(process.argv[2]),descriptor=read(process.argv[3]),old=bound(descriptor.recipe);
 const root=fs.mkdtempSync(path.join(inputs.root,label+'-'));fs.chmodSync(root,0o700);
 const startedAtMs=Date.now(),deadlineAtMs=process.argv[4]===undefined?startedAtMs+7200000:Number(process.argv[4]);
 assert(Number.isSafeInteger(deadlineAtMs)&&deadlineAtMs>startedAtMs&&deadlineAtMs<=startedAtMs+7200000,'qualification_deadline_invalid');
 write(root,'admission.json',{scope:'Disposable '+label+' infrastructure qualification; no product gain or production access',jobId:inputs.jobId,sourceRevision:inputs.sourceRevision,profileId,startedAtMs,deadlineAtMs});
 const store=new w.DurableStore({root:inputs.root,sourceRoot:inputs.root}),phase='dev-r1',cfg={...bound(inputs.workerConfig),stateRoot:inputs.root,gitArea:null,jobId:inputs.jobId,maxMilliseconds:600000};
 const recipe=path.join(root,'recipe');fs.mkdirSync(recipe,{mode:0o700});
 const template=JSON.parse(canonical(old));template.jobId=inputs.jobId;
 for(const k of ['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile']){
  const bytes=k==='resourceProfile'?profiles.profileBytes(profileId):admission.readBoundFile(descriptor.recipeRoot,old[k],128*1024*1024);
  const ref=write(recipe,old[k].path,bytes);template[k].sha256=ref.sha256;
 }
 for(const m of old.migrations)write(recipe,old.migrationRoot+'/'+m.name,admission.readBoundFile(descriptor.recipeRoot,{path:old.migrationRoot+'/'+m.name,sha256:m.sha256}));
 const credentialRef=credentials.issue(store,{jobId:inputs.jobId,phase}),issued=credentials.read(store,credentialRef);
 const normalized=JSON.parse(canonical(template));normalized.credentialBinding.sha256=semantics.projection(issued,issued);const constructionSha256=hash(canonical(normalized));
 const attempt=attempts.begin(store,{jobId:inputs.jobId,runId:label+'-preflight',phase,contractSha256:hash(label+'-observation-only'),constructionSha256,authoritySha256:hash('authorized-disposable-qualification'),deadlineAtMs});
 const authority=()=>{assert(Date.now()<deadlineAtMs,'original_qualification_deadline_expired');};
 const worker=new w.DockerWorker(cfg);managed.bind(worker,{store,attempt,authorize:authority});
 const request={schema:'specflow.backend-request/v2',jobId:inputs.jobId,phase,recipeId:admission.RECIPE.id,generation:credentialRef.generation,expectedBackendIdentity:'0'.repeat(64),resourceProfile:profileId,constructionSha256};
 const secret=write(recipe,template.credentialBinding.path,issued);template.credentialBinding.sha256=secret.sha256;
 const manifest=write(recipe,'inputs.json',template);request.inputManifest={path:'inputs.json',sha256:manifest.sha256};
 const attemptFile=write(recipe,'attempt.json',fs.readFileSync(path.join(store.root,'backend-attempts','attempt-'+attempt.attemptId+'.json')));request.attempt={path:'attempt.json',sha256:attemptFile.sha256};
 let consumer,session,measurement,terminal,built,productInput,error;
 try{
  productInput={schema:'specflow.production-build-input/v1',jobId:inputs.jobId,source:inputs.source,dependencies:inputs.dependencies,dependencySource:inputs.dependencySource,runtimeSha256:production.runtimeIdentity(worker),command:production.COMMAND,environment:{...production.FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:issued.anonKey},resourceProfile:production.PROFILE.id};
  managed.select(worker,'build');built=production.runProductionBuild(worker,productInput,path.join(root,'built'));
  const build=write(recipe,'build.json',built.receipt);request.productBuildReceipt={path:'build.json',sha256:build.sha256};
  assert(deadlineAtMs-Date.now()>=profiles.workerLimits(profileId,'app').phaseMilliseconds);
  managed.select(worker,'app');consumer=production.createProductionConsumer(worker,productInput,built.receipt,built.target,profileId);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root:recipe,request,inputs:template,credentials:{store,reference:credentialRef},productInput});
  measurement=await runtime.observeBackend(session);assert.deepEqual(measurement.state,old.expectedState);
 }catch(e){error=e;}
 finally{
  attempts.seal(store,attempt);
  try{if(session){terminal=await runtime.closeBackend(session);assert.equal(terminal.phase,'cleaned');assert.equal(terminal.cause,null);}}
  finally{try{if(consumer)consumer.close();}finally{try{worker.close();}finally{try{fs.unlinkSync(secret.path);}catch(e){if(e.code!=='ENOENT')throw e;}}}}
 }
 const finished=attempts.finish(store,attempt,{cause:error?'backend_qualification_failed':null,backendTerminalSha256:terminal?hash(canonical(terminal)):null,productReceiptSha256:built?hash(canonical(built.receipt)):null});
 if(error)throw error;
 assert.equal(finished.state,'cleaned');assert(finished.credentialEnvelopeRemoved);assert.equal(terminal.resourceProfile,profileId);
 const observation=write(root,'observation.json',{scope:'Real managed app and five-service observation/cleanup only; no native cases or product verdict',measurement,terminal,attempt,finished});
 // A future generation uses the same immutable template and measured semantic
 // identity, with independently issued credentials and its own durable attempt.
 const result={status:'passed',root,inputs:path.resolve(process.argv[2]),recipe,template:write(recipe,'template.json',template),observation,constructionSha256,expectedSemanticSha256:measurement.measuredBackendIdentity,deadlineAtMs,profileId,sourceRevision:inputs.sourceRevision,elapsedMilliseconds:Date.now()-startedAtMs,remainingOwned:0};
 write(root,'qualification-state.json',result);console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message}));process.exitCode=1;});
