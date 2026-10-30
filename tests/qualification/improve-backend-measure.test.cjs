'use strict';
// Required live evidence: no mocked measurements and no skip-on-missing-input path.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const runtime=require('../../scripts/improve-backend-runtime.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const descriptor=JSON.parse(fs.readFileSync(process.argv[2]));
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
  await fn({...f,worker,session});
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
test('fresh equal backend admits the frozen expectation and retains hashes through continuity',{timeout:300000},async()=>{
 assert(expected,'factory measurement required');await withBackend('equal',async f=>{
  const receipt=await runtime.admitBackend(f.session,context(f));assert.equal(receipt.manifest.measuredBackendIdentity,expected.measuredBackendIdentity);assert.deepEqual(receipt.manifest.state,expected.state);assert.equal(receipt.sha256,hash(fs.readFileSync(receipt.path)));assert.equal((await runtime.backendContinuity(f.session,context(f))).entryManifestSha256,receipt.sha256);
  // A legitimate deciding check may write data; post-check continuity binds the runtime, not the original rows.
  f.worker.call(['exec',database(f),'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',"UPDATE public.next_actions SET content=content||' legitimate-test-write' WHERE id=(SELECT id FROM public.next_actions ORDER BY id LIMIT 1)"]);
  assert.equal((await runtime.backendContinuity(f.session,context(f))).entryManifestSha256,receipt.sha256);
 });
});
test('actual changed seed rejects admission with backend_identity_mismatch',{timeout:300000},async()=>{
 assert(expected,'factory measurement required');await withBackend('mutated-row',async f=>{
  f.worker.call(['exec',database(f),'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',"UPDATE public.next_actions SET content=content||' changed-measurement-negative' WHERE id=(SELECT id FROM public.next_actions ORDER BY id LIMIT 1)"]);
  await assert.rejects(runtime.admitBackend(f.session,context(f)),/backend_identity_mismatch/);
 });
});
test('actual sequence is_called change rejects even when its last value is unchanged',{timeout:300000},async()=>{
 assert(expected,'factory measurement required');await withBackend('mutated-sequence',async f=>{
  f.worker.call(['exec',database(f),'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',"DO $$ DECLARE q record; v bigint; called boolean; BEGIN SELECT schemaname,sequencename INTO q FROM pg_sequences WHERE schemaname IN ('public','auth') ORDER BY schemaname,sequencename LIMIT 1; EXECUTE format('SELECT last_value,is_called FROM %I.%I',q.schemaname,q.sequencename) INTO v,called; PERFORM setval(format('%I.%I',q.schemaname,q.sequencename)::regclass,v,NOT called); END $$;"]);
  await assert.rejects(runtime.admitBackend(f.session,context(f)),/backend_identity_mismatch/);
 });
});
