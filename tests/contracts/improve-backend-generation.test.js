'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const generation=require('../../scripts/improve-backend-generation.cjs');
const {DurableStore}=require('../../scripts/improve-worker.cjs');
const {RECIPE}=require('../../scripts/improve-backend.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const attempts=require('../../scripts/improve-backend-attempt.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),digest='a'.repeat(64);
let root,store,config,value,runDir;
function write(file,data){const bytes=canonical(data);fs.writeFileSync(file,bytes,{mode:0o600});return {path:file,sha256:hash(bytes)};}
function sign(){config.backendJobBinding=write(path.join(root,'binding.json'),{value,mac:store.mac(JSON.parse(canonical(value)))});}
beforeEach(()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'sf-generation-'));runDir=path.join(root,'run');fs.mkdirSync(runDir,{mode:0o700});write(path.join(runDir,'run.json'),{run_id:'run'});
 store=new DurableStore({root:path.join(root,'store'),sourceRoot:root});
 const ref=name=>({path:name,sha256:digest});
 const template={schema:'specflow.backend-inputs/v1',jobId:'job',recipeId:RECIPE.id,images:RECIPE.images,migrationRevision:RECIPE.migrationRevision,migrations:RECIPE.migrations,migrationRoot:'migrations',bootstrap:ref('bootstrap'),supabaseCli:ref('cli'),seed:ref('seed'),credentialBinding:ref('credentials'),runtimeLayer:ref('layer'),configuration:ref('configuration'),resourceProfile:ref('profile'),expectedState:{schemaSha256:digest,tablesSha256:digest,sequencesSha256:digest,migrationHistorySha256:digest}};
 const dependencySource={packageSha256:digest,lockSha256:digest,manifestSha256:digest};
 value={schema:'specflow.backend-job-binding/v1',jobId:'job',runId:'run',recipeId:RECIPE.id,constructionSha256:digest,expectedSemanticSha256:digest,inputsTemplate:write(path.join(root,'inputs.json'),template),dependencies:{target:path.join(root,'deps'),expected:{identity:{jobId:'job',sourceContainerId:digest,recipeSha256:digest,sourceInputSha256:hash(canonical(dependencySource))},manifestSha256:digest}},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:digest,dependencySource,deadlineAtMs:Date.now()+60000};
 config={worker:{jobId:'job',stateRoot:store.root},deadlineAtMs:value.deadlineAtMs,authority:{repo_id:'repo',revision:1}};sign();
});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
const declaration=()=>({recipeId:value.recipeId,expectedSemanticSha256:value.expectedSemanticSha256,constructionSha256:value.constructionSha256});
test('JSON and copied tokens cannot grant generation authority',async()=>{
 const authorize=jest.fn(),token=generation.install(config,runDir,authorize);expect(authorize).toHaveBeenCalledTimes(1);
 expect(generation.freezeBinding(token,runDir,declaration())).toEqual({sha256:config.backendJobBinding.sha256});
 for(const forged of [{},JSON.parse(JSON.stringify(token)),Object.assign({},token)])await expect(generation.open(forged,runDir,'baseline',()=>{})).rejects.toThrow('backend_capability_required');
 expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);
});
test('missing original task deadline cannot be renewed from signed binding',()=>{delete config.deadlineAtMs;expect(()=>generation.install(config,runDir,()=>{})).toThrow('backend_binding_invalid');});
test('expired original deadline rejects before reservation or issuing',async()=>{
 value.deadlineAtMs=Date.now()-1;config.deadlineAtMs=value.deadlineAtMs;sign();const token=generation.install(config,runDir,()=>{});
 await expect(generation.open(token,runDir,'baseline',()=>{})).rejects.toThrow('backend_lease_expired');expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);expect(fs.existsSync(path.join(store.root,'backend-credentials'))).toBe(false);
});
test('wrong dependency provenance is rejected before capability creation',()=>{value.dependencySource.lockSha256='b'.repeat(64);sign();expect(()=>generation.install(config,runDir,()=>{})).toThrow('build_dependency_source');});
test('binding requires a MAC from this job store',()=>{const data=JSON.parse(fs.readFileSync(config.backendJobBinding.path));data.mac='0'.repeat(64);config.backendJobBinding=write(config.backendJobBinding.path,data);expect(()=>generation.install(config,runDir,()=>{})).toThrow('backend_binding_invalid');});
test('original authority is checked again at generation dispatch',async()=>{
 let revoked=false;const token=generation.install(config,runDir,()=>{if(revoked)throw Error('authority_revoked');});revoked=true;
 await expect(generation.open(token,runDir,'baseline',()=>{})).rejects.toThrow('authority_revoked');expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);
});
test('a binding added after freeze cannot replace the frozen binding hash',async()=>{
 const token=generation.install(config,runDir,()=>{});
 await expect(generation.open(token,runDir,'baseline',()=>({bindingSha256:'b'.repeat(64),declaration:declaration()}))).rejects.toThrow('backend_binding_invalid');expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);
});
test('ledger refusal under reservation records a failed clean terminal and releases only that attempt',async()=>{
 const token=generation.install(config,runDir,()=>{});let calls=0;
 const refresh=()=>{if(++calls===2)throw Error('backend_holdout_consumed');return {bindingSha256:config.backendJobBinding.sha256,declaration:declaration(),contractSha256:digest};};
 await expect(generation.open(token,runDir,'after',refresh)).rejects.toThrow('backend_holdout_consumed');expect(calls).toBe(2);
 const area=path.join(store.root,'backend-attempts'),names=fs.readdirSync(area);
 expect(names.some(n=>n.startsWith('active-'))).toBe(false);expect(names.some(n=>n.startsWith('intent-'))).toBe(false);
 const terminal=JSON.parse(fs.readFileSync(path.join(area,names.find(n=>n.startsWith('terminal-'))))).value;
 expect(terminal).toMatchObject({state:'cleaned',cause:'backend_holdout_consumed',resources:[],credentialEnvelopeRemoved:true});
 const next=attempts.begin(store,{jobId:'job',runId:'run',phase:'dev-r1',contractSha256:digest,constructionSha256:digest,authoritySha256:digest,deadlineAtMs:value.deadlineAtMs});expect(next.attemptId).not.toBe(terminal.attemptId);
});

test('retained proof remains privately readable after the original envelope is deleted',()=>{
 const phase=path.join(runDir,'phase'),envelope=path.join(root,'envelope');fs.mkdirSync(phase,{mode:0o755});fs.mkdirSync(envelope,{mode:0o700});
 const original=write(path.join(envelope,'entry.json'),{phase:'baseline',generation:'g'});
 const copied=generation.retainProof(phase,original),terminal=generation.writeProof(phase,{state:'cleaned'});
 fs.rmSync(envelope,{recursive:true});
 for(const ref of [copied,terminal]){
  expect(fs.statSync(path.dirname(ref.path)).mode&0o777).toBe(0o700);expect(fs.statSync(ref.path).mode&0o777).toBe(0o600);
  const bytes=require('../../scripts/improve-backend.cjs').readBoundFile(path.dirname(ref.path),{path:path.basename(ref.path),sha256:ref.sha256});expect(hash(bytes)).toBe(ref.sha256);
 }
 expect(copied.sha256).toBe(original.sha256);
});
test('proof capture refuses changed source and symlinked destination',()=>{
 const phase=path.join(runDir,'phase');fs.mkdirSync(phase,{mode:0o755});const original=write(path.join(root,'entry.json'),{x:1});fs.appendFileSync(original.path,' ');
 expect(()=>generation.retainProof(phase,original)).toThrow('backend_input_changed');expect(fs.readdirSync(phase)).toEqual([]);
 fs.symlinkSync(phase,path.join(runDir,'redirect'));expect(()=>generation.writeProof(path.join(runDir,'redirect'),{})).toThrow();
});
test('a signed but different source recipe cannot mislabel the trusted reconstruction',()=>{
 value.sourceRecipeSha256='b'.repeat(64);sign();expect(()=>generation.install(config,runDir,()=>{})).toThrow('backend_binding_invalid');
});

test('selected source preserves the inert public env template but rejects private env and links',()=>{
 const src=path.join(root,'workspace');fs.mkdirSync(src);const template='PUBLIC_VALUE=example\n';fs.writeFileSync(path.join(src,'.env.example'),template);
 const identity={entries:[{path:'.env.example',kind:'file',sha256:hash(template)}]};expect(generation.sourceBundle(src,identity).files[0].path).toBe('.env.example');
 fs.mkdirSync(path.join(src,'nested'));fs.writeFileSync(path.join(src,'nested/.env.local'),'private');
 expect(()=>generation.sourceBundle(src,{entries:[{path:'nested/.env.local',kind:'file',sha256:hash('private')}]})).toThrow('backend_source_invalid');
 fs.symlinkSync('/etc/passwd',path.join(src,'linked'));expect(()=>generation.sourceBundle(src,{entries:[{path:'linked',kind:'file',sha256:hash('private')}]})).toThrow('backend_source_invalid');
});
