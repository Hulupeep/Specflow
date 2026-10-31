'use strict';
// Required live evidence: no mocked measurements and no skip-on-missing-input path.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const runtime=require('../../scripts/improve-backend-runtime.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const descriptor=JSON.parse(fs.readFileSync(process.argv[2]));
const selection=process.argv[3]||'all';assert(['all','native','core-equal','core-mutated'].includes(selection),'Unknown qualification selection');
function read(ref){const bytes=fs.readFileSync(ref.path);assert.equal(hash(bytes),ref.sha256);return JSON.parse(bytes);}
const sourceRequest=read(descriptor.request),sourceInputs=read(descriptor.manifest),product=read(descriptor.product);
let expected;
function fixture(name){
 const root=fs.mkdtempSync(path.join(path.dirname(descriptor.root),'measurement-'+name+'-'));fs.chmodSync(root,0o700);
 const m=JSON.parse(JSON.stringify(sourceInputs)),r=JSON.parse(JSON.stringify(sourceRequest));r.generation=crypto.randomUUID();
 fs.mkdirSync(path.join(root,m.migrationRoot),{mode:0o700});
 for(const f of m.migrations)fs.copyFileSync(path.join(descriptor.root,m.migrationRoot,f.name),path.join(root,m.migrationRoot,f.name));
 for(const k of ['bootstrap','supabaseCli','seed','credentialBinding','runtimeLayer','configuration','resourceProfile'])fs.copyFileSync(path.join(descriptor.root,m[k].path),path.join(root,m[k].path));
 fs.copyFileSync(path.join(descriptor.root,r.productBuildReceipt.path),path.join(root,r.productBuildReceipt.path));
 if(expected){m.expectedState=expected.state;r.expectedBackendIdentity=expected.measuredBackendIdentity;}
 const bytes=canonical(m);fs.writeFileSync(path.join(root,r.inputManifest.path),bytes,{mode:0o600});r.inputManifest.sha256=hash(bytes);
 return {root,r,m};
}
async function withBackend(name,fn){
 const f=fixture(name),pi=read(product.inputs),request=read(product.request),built=read(product.built);
 const {DockerWorker}=require('../../scripts/improve-worker.cjs');let consumer,session;
 const worker=new DockerWorker({...read(pi.workerConfig),gitArea:null,stateRoot:pi.root,jobId:request.jobId,maxMilliseconds:300000});
 try{consumer=require('../../scripts/improve-production-build.cjs').createProductionConsumer(worker,request,built.receipt,built.target);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root:f.root,request:f.r,inputs:f.m});
  const state={...f,worker,session};await fn(state);if(state.closed)session=null;
 }finally{
  if(session){const terminal=await runtime.closeBackend(session);assert.equal(terminal.phase,'cleaned');assert(terminal.resources.every(x=>x.status==='removed'));assert.equal(terminal.successReceipt,false);}
  if(consumer)consumer.close();worker.close();
 }
}
const context=f=>({runId:'qualification-measurement',phase:f.r.phase,expectedBackendIdentity:f.r.expectedBackendIdentity,inputManifestSha256:f.r.inputManifest.sha256});
function database(f){const name=fs.readdirSync(f.root).find(n=>n.startsWith('backend-journal-'));const j=JSON.parse(fs.readFileSync(path.join(f.root,name,'journal.json')));return j.resources.find(x=>x.role==='database').id;}
test('factory observes exact rows, sequence state and schema under one exported snapshot without admission',{timeout:300000},async()=>{
 await withBackend('factory',async f=>{expected=await runtime.observeBackend(f.session);assert.equal(expected.counts.migrations,156);assert.equal(expected.counts.tables,102);assert.equal(expected.counts.rows,103);assert.equal(expected.counts.sequences,2);assert.equal(expected.snapshotProtocol,'repeatable-read-read-only-exported-snapshot');for(const value of Object.values(expected.state))assert.match(value,/^[a-f0-9]{64}$/);assert.match(expected.measuredBackendIdentity,/^[a-f0-9]{64}$/);});
});

if(['all','native'].includes(selection))test('canonical frozen native verifier executes only inside the admitted backend checker',{timeout:300000},async()=>{
 assert(expected);await withBackend('native',async f=>{
  const cp=require('child_process'),native=require('../../scripts/test-execution.cjs');
  const root=path.join(f.root,'product'),oracleRoot=path.join(f.root,'oracle');fs.mkdirSync(root,{mode:0o700});fs.mkdirSync(oracleRoot,{mode:0o700});
  cp.execFileSync('git',['init','-q','-b','main'],{cwd:root});fs.writeFileSync(path.join(root,'README.md'),'Synthetic verifier binding; backend is real.');cp.execFileSync('git',['add','README.md'],{cwd:root});cp.execFileSync('git',['-c','user.name=Qualification','-c','user.email=qualification@example.invalid','commit','-qm','Initialize native verifier fixture'],{cwd:root});
  const files={
   'native.spec.cjs':"const {test,expect}=require('@playwright/test');const fs=require('fs');test('real backend and confined filesystem',async()=>{expect((await fetch('http://127.0.0.1:9999/health')).status).toBe(200);expect(fs.existsSync('/var/run/docker.sock')).toBe(false);expect(fs.existsSync('/home/xanacan')).toBe(false);let readonly=false;try{fs.appendFileSync(__filename,'changed')}catch{readonly=true}expect(readonly).toBe(true);});",
   'playwright.config.cjs':"module.exports={testDir:__dirname,testMatch:'native.spec.cjs',workers:1,retries:0,timeout:10000};"
  };
  for(const [file,bytes]of Object.entries(files))fs.writeFileSync(path.join(oracleRoot,file),bytes,{mode:0o600});
  const frozenFiles=Object.fromEntries(Object.entries(files).map(([file,bytes])=>[file,hash(bytes)]));
  const check={id:'BACKEND-NATIVE',required:true,verification_level:'integration',boundaries:['process','network','database'],configuration_ids:['confined'],checker_paths:Object.keys(files),input_paths:[],rule_paths:[],execution:{adapter:'playwright',test_files:['native.spec.cjs'],required_case_ids:['default::native.spec.cjs::real backend and confined filesystem'],optional_case_ids:[],args:['--config','playwright.config.cjs']}};
  const ctx=context(f);await runtime.admitBackend(f.session,ctx);runtime.prepareBackendChecks(f.session,ctx,{oracleRoot,frozenFiles,checks:[check]});
  const options={root,oracleRoot,runDir:path.join(f.root,'evidence'),verificationContract:{check},configurationId:'confined',environment:'confined-backend',env:{},frozenFiles,backendSession:f.session,backendContext:ctx};
  const receipt=native.executeFrozen(check,options);
  fs.writeFileSync(path.join(f.root,'native-result.json'),JSON.stringify(receipt));
  assert.equal(receipt.result,'pass',receipt.reason);assert.equal(receipt.summary.collected,1);assert.equal(receipt.summary.passed,1);assert.equal(receipt.summary.skipped,0);
  assert.equal(receipt.command[0],'/node/bin/node');assert(native.ownsFrozen(receipt,check,options.verificationContract,options));assert(!native.ownsFrozen(JSON.parse(JSON.stringify(receipt)),check,options.verificationContract,options));
  await runtime.backendContinuity(f.session,ctx);
 });
});

const {coreFixture}=require('./fixtures/backend-core-fixture.cjs');
for(const mutated of [false,true].filter(value=>selection==='all'||selection===(value?'core-mutated':'core-equal')))test('existing core '+(mutated?'rejects mutated backend before deciding execution':'records equal backend entry and cleanup manifests'),{timeout:300000},async()=>{
 assert(expected);await withBackend(mutated?'core-mutated':'core-equal',async f=>{
  const {core,runDir}=await coreFixture(f,read(product.request).source);
  if(mutated)f.worker.call(['exec',database(f),'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',"UPDATE public.next_actions SET content=content||' core-negative' WHERE id=(SELECT id FROM public.next_actions ORDER BY id LIMIT 1)"]);
  const outcome=await core.verifyPhase(runDir,'baseline',{backendSession:f.session});f.closed=true;
  const events=core.events(runDir);fs.writeFileSync(path.join(f.root,'core-result.json'),JSON.stringify({outcome,events}));
  if(mutated){assert.equal(outcome.status,'blocked');assert.match(outcome.reason,/backend_identity_mismatch/);assert(!events.some(e=>['holdout_consumed','verification_receipt','evidence_added'].includes(e.event)));}
  else{assert.equal(outcome.status,'baseline_recorded',JSON.stringify(outcome));const selected=events.find(e=>e.event==='verification_receipt');assert(selected);const receipt=JSON.parse(fs.readFileSync(selected.path));assert.equal(receipt.backend.expectedSemanticSha256,expected.measuredBackendIdentity);assert.equal(receipt.backend.measuredSemanticSha256,expected.measuredBackendIdentity);for(const ref of [receipt.backend.entry,receipt.backend.terminal,...Object.values(receipt.backend.product)])assert.equal(hash(fs.readFileSync(ref.path)),ref.sha256);assert.equal(core.boundReceipt(runDir,'baseline').error,undefined);}
 });
});
