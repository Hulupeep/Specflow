'use strict';
// Real product probes with fresh credentials/builds and a previously frozen
// expectation. Separate from managed core and fault-injection qualification.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const workerModule=require('../../scripts/improve-worker.cjs'),production=require('../../scripts/improve-production-build.cjs');
const backend=require('../../scripts/improve-backend.cjs'),runtime=require('../../scripts/improve-backend-runtime.cjs');
const credentials=require('../../scripts/improve-backend-credentials.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=p=>workerModule.strictJSON(fs.readFileSync(p).toString());
const bound=ref=>{const bytes=fs.readFileSync(ref.path);assert.equal(hash(bytes),ref.sha256);return workerModule.strictJSON(bytes.toString());};
function write(root,name,value){const file=path.join(root,name),bytes=production.canonical(value);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});return {path:name,sha256:hash(bytes)};}
async function live(file,mode,targetsFile){
 assert(['auth','journey','isolation','identity-mismatch'].includes(mode));
 const d=read(file),inputs=bound(d.inputs),admission=bound(d.admission),template=bound(d.recipe),expected=bound(d.expectation);
 const time=remaining=>assert(Date.now()+remaining<admission.deadlineAtMs,'backend_lease_expired');
 time(300000);assert.equal(inputs.sourceRevision,admission.productRevision);
 assert.deepEqual(expected.source,inputs.source.receipt);assert.deepEqual(expected.dependencies,inputs.dependencies.receipt);
 assert.deepEqual(expected.measurement.state,template.expectedState);
 const root=fs.mkdtempSync(path.join(inputs.root,'product-'+mode+'-'));fs.chmodSync(root,0o700);
 const store=new workerModule.DurableStore({root:inputs.root,sourceRoot:inputs.root});
 const reference=credentials.issue(store,{jobId:inputs.jobId,phase:'baseline'}),issued=credentials.read(store,reference);
 const manifest=JSON.parse(production.canonical(template));manifest.jobId=inputs.jobId;
 for(const k of ['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile']){
  const target=path.join(root,template[k].path);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,backend.readBoundFile(d.recipeRoot,template[k],128*1024*1024),{mode:0o600,flag:'wx'});
 }
 for(const m of template.migrations){const name=path.join(template.migrationRoot,m.name),target=path.join(root,name);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,backend.readBoundFile(d.recipeRoot,{path:name,sha256:m.sha256}),{mode:0o600,flag:'wx'});}
 manifest.credentialBinding=write(root,template.credentialBinding.path,issued);
 const request={schema:'specflow.backend-request/v1',jobId:inputs.jobId,phase:'baseline',recipeId:backend.RECIPE.id,generation:reference.generation,expectedBackendIdentity:expected.measurement.measuredBackendIdentity,resourceProfile:backend.PROFILE.id,inputManifest:write(root,'inputs.json',manifest)};
 const workerConfig={...bound(inputs.workerConfig),stateRoot:inputs.root,gitArea:null,jobId:inputs.jobId,maxMilliseconds:600000};
 const worker=new workerModule.DockerWorker(workerConfig);let consumer,session,checker,terminal,built,admitted,result;
 try{
  worker.capsuleMount(inputs.source.target,inputs.source.receipt,'/source');worker.capsuleMount(inputs.dependencies.target,inputs.dependencies.receipt,'/dependencies');
  const productInput={schema:'specflow.production-build-input/v1',jobId:inputs.jobId,source:inputs.source,dependencies:inputs.dependencies,dependencySource:inputs.dependencySource,runtimeSha256:production.runtimeIdentity(worker),command:production.COMMAND,environment:{...production.FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:issued.anonKey},resourceProfile:production.PROFILE.id};
  built=production.runProductionBuild(worker,productInput,path.join(root,'built'));time(180000);
  request.productBuildReceipt=write(root,'build-receipt.json',built.receipt);
  consumer=production.createProductionConsumer(worker,productInput,built.receipt,built.target);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root,request,inputs:manifest,credentials:{store,reference},productInput});
  const context={runId:'product-'+mode+'-'+reference.generation,phase:request.phase,expectedBackendIdentity:request.expectedBackendIdentity,inputManifestSha256:request.inputManifest.sha256};
  if(mode==='identity-mismatch'){
   // Deliberately change only this disposable generation's real seed data,
   // after readiness and before any protected check can be admitted.
   const journals=fs.readdirSync(root).filter(n=>n.startsWith('backend-journal-'));
   assert.equal(journals.length,1);
   const journal=read(path.join(root,journals[0],'journal.json'));
   const database=journal.resources.find(r=>r.role==='database');assert(database?.id);
   const actual=JSON.parse(worker.call(['inspect',database.id]).stdout)[0];
   assert.equal(actual.Config.Labels['specflow.backend.job'],request.jobId);
   assert.equal(actual.Config.Labels['specflow.backend.generation'],request.generation);
   assert.equal(actual.Config.Labels['specflow.backend.reservation'],database.reservation);
   const mutation=worker.call(['exec',database.id,'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-Atc',
    "WITH changed AS (UPDATE public.stax SET name = name || ' identity probe' WHERE id=(SELECT id FROM public.stax ORDER BY id LIMIT 1) RETURNING 1) SELECT count(*) FROM changed"]);
   assert.equal(mutation.stdout.trim(),'1');
   const measured=await runtime.observeBackend(session);
   assert.notEqual(measured.measuredBackendIdentity,context.expectedBackendIdentity);
   assert.notDeepEqual(measured.state,manifest.expectedState);
   await assert.rejects(runtime.admitBackend(session,context),/backend_identity_mismatch/);
   admitted={manifest:measured};
   result={status:'passed',expectedRejection:'backend_identity_mismatch',seedMutationRows:1,protectedChecksExecuted:0,skipped:0};
  }else admitted=await runtime.admitBackend(session,context);
  if(mode==='auth'){
   const publicRoot=path.join(root,'public');fs.mkdirSync(publicRoot,{mode:0o700});fs.writeFileSync(path.join(publicRoot,'public.json'),JSON.stringify({anonKey:issued.anonKey}),{mode:0o400});
   checker=worker.create({role:'checker',network:'container:'+consumer.id,mounts:[{source:publicRoot,destination:'/inputs'},{source:path.resolve(__dirname,'fixtures/backend-auth-probe.cjs'),destination:'/oracle/auth.cjs'}],tmpfs:[{path:'/output',bytes:64*1024*1024}]});
   const execution=worker.exec(checker,['/node/bin/node','/oracle/auth.cjs'],{cwd:'/tmp',allowFailure:true,timeout:45000,maxBuffer:65536});
   result=JSON.parse(execution.stdout);fs.writeFileSync(path.join(root,'auth-result.json'),JSON.stringify(result),{mode:0o600});
   assert.equal(execution.status,0);assert.equal(result.executed,29);assert.equal(result.failed,0);assert.equal(result.skipped,0);assert(result.results.every(r=>r.result==='pass'));
   worker.destroy(checker);checker=null;
  }else if(mode==='journey'){
   await runtime.startBackendServer(session,context);
   const stages=fs.readdirSync(root).filter(n=>n.startsWith('backend-stage-'));assert.equal(stages.length,1);
   const gateway=read(path.join(root,stages[0],'gateway.json')),serverKey=gateway.consumers.find(c=>c.username==='server').keyauth_credentials[0].key;
   result=await require('./fixtures/backend-server-journey.cjs').runServerJourney({root,session,context,anonKey:issued.anonKey,serverKey,staticRoot:path.join(built.target,'tree/static')});
  }else if(mode==='isolation'){
   assert(targetsFile,'production_targets_required');
   result=await require('./fixtures/backend-boundary-probe.cjs').run({worker,anchor:consumer.id,base:inputs.root,workerConfig,jobId:inputs.jobId,productionTargets:read(targetsFile)});
   assert.equal(result.status,'passed');assert.equal(result.failed,0);assert.equal(result.skipped,0);assert.equal(result.executed,result.checks.length);assert(result.executed>=51);
  }
  if(mode!=='identity-mismatch')await runtime.backendContinuity(session,context);time(0);
 }finally{
  try{if(checker)worker.destroy(checker);}finally{
   try{if(session){terminal=await runtime.closeBackend(session);assert.equal(terminal.phase,'cleaned');assert.equal(terminal.cause,mode==='identity-mismatch'?'backend_identity_mismatch':null);assert(terminal.resources.every(r=>r.status==='removed'));}}
   finally{try{if(consumer)consumer.close();}finally{worker.close();fs.unlinkSync(path.join(root,manifest.credentialBinding.path));}}
  }
 }
 const report={status:'passed',mode,root,result,sourceRevision:inputs.sourceRevision,sourceManifestSha256:inputs.source.receipt.manifestSha256,buildIdSha256:built.receipt.buildIdSha256,expectedBackendIdentity:request.expectedBackendIdentity,measuredBackendIdentity:admitted.manifest.measuredBackendIdentity,cleanup:{phase:terminal.phase,cause:terminal.cause,resources:terminal.resources.length},originalDeadlineAtMs:admission.deadlineAtMs,scope:mode==='identity-mismatch'?'Actual disposable seed mutation and admission rejection before protected checks; direct runtime identity proof, not a successful product verdict.':'Actual fresh-build product probe with ordinary-user assertions; direct runtime qualification, not managed-core/failure-matrix/product-improvement proof.'};
 fs.writeFileSync(path.join(root,'qualification-result.json'),JSON.stringify(report),{mode:0o600});return report;
}
module.exports={live};
if(require.main===module)live(...process.argv.slice(2)).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message,scope:'Product probe failed; inspect private artifacts. No pass claimed.'}));process.exitCode=1;});
