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
 template.resourceProfile={path:'profile',sha256:write(path.join(root,'profile'),require('../../scripts/improve-backend.cjs').PROFILE).sha256};
 const dependencySource={packageSha256:digest,lockSha256:digest,manifestSha256:digest};
 value={schema:'specflow.backend-job-binding/v1',jobId:'job',runId:'run',recipeId:RECIPE.id,constructionSha256:digest,expectedSemanticSha256:digest,inputsTemplate:write(path.join(root,'inputs.json'),template),dependencies:{target:path.join(root,'deps'),expected:{identity:{jobId:'job',sourceContainerId:digest,recipeSha256:digest,sourceInputSha256:hash(canonical(dependencySource))},manifestSha256:digest}},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:template.resourceProfile.sha256,dependencySource,deadlineAtMs:Date.now()+60000};
 config={worker:{jobId:'job',stateRoot:store.root},deadlineAtMs:value.deadlineAtMs,authority:{repo_id:'repo',revision:1}};sign();
});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
const declaration=()=>({recipeId:value.recipeId,expectedSemanticSha256:value.expectedSemanticSha256,constructionSha256:value.constructionSha256});
function journeyProfile(){
 const bytes=require('../../scripts/improve-backend-profiles.cjs').profileBytes('heystax-backend-journeys-v1');fs.writeFileSync(path.join(root,'profile'),bytes);
 const template=JSON.parse(fs.readFileSync(value.inputsTemplate.path));template.resourceProfile.sha256=hash(bytes);
 value.inputsTemplate=write(value.inputsTemplate.path,template);value.resourceProfileSha256=hash(bytes);value.deadlineAtMs=Date.now()+2000000;config.deadlineAtMs=value.deadlineAtMs;sign();
}
const journeyContract=()=>({acceptance:[{id:'journey',mandatory:true,dev_check:{timeout_seconds:100,verification_level:'journey',boundaries:['browser','api'],checker_paths:['test.cjs','config.cjs'],input_paths:[],rule_paths:[],execution:{adapter:'playwright',test_files:['test.cjs'],required_case_ids:['case'],optional_case_ids:[],args:['--config','config.cjs']}}}]});
test('new profile refuses impossible inventory before reservation or resources',async()=>{
 journeyProfile();const token=generation.install(config,runDir,()=>{}),contract=journeyContract();contract.acceptance[0].dev_check.timeout_seconds=501;
 await expect(generation.open(token,runDir,'dev-r1',()=>({bindingSha256:config.backendJobBinding.sha256,declaration:declaration(),contractSha256:digest,contractJSON:JSON.stringify(contract)}))).rejects.toMatchObject({code:'backend_inventory_exceeds_profile',requiredMilliseconds:621000,availableMilliseconds:600000});
 expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);
});
test('legacy profile cannot bypass inventory admission before reservation',async()=>{
 value.deadlineAtMs=Date.now()+2000000;config.deadlineAtMs=value.deadlineAtMs;sign();
 const token=generation.install(config,runDir,()=>{});
 await expect(generation.open(token,runDir,'dev-r1',()=>({bindingSha256:config.backendJobBinding.sha256,declaration:declaration(),contractSha256:digest,contractJSON:JSON.stringify(journeyContract())}))).rejects.toMatchObject({code:'backend_inventory_exceeds_profile',requiredMilliseconds:220000,availableMilliseconds:120000});
 expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);
 expect(fs.existsSync(path.join(store.root,'backend-credentials'))).toBe(false);
});
test('changed signed profile bytes are rejected before capability installation',()=>{
 journeyProfile();fs.appendFileSync(path.join(root,'profile'),' ');expect(()=>generation.install(config,runDir,()=>{})).toThrow('backend_input_changed');
 expect(fs.existsSync(path.join(store.root,'backend-attempts'))).toBe(false);
});

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
 journeyProfile();
 const contract=journeyContract();contract.acceptance[0].check=contract.acceptance[0].dev_check;
 const token=generation.install(config,runDir,()=>{});let calls=0;
 const refresh=()=>{if(++calls===2)throw Error('backend_holdout_consumed');return {bindingSha256:config.backendJobBinding.sha256,declaration:declaration(),contractSha256:digest,contractJSON:JSON.stringify(contract)};};
 await expect(generation.open(token,runDir,'after',refresh)).rejects.toMatchObject({message:'backend_holdout_consumed',backendGeneration:{originalCause:'backend_holdout_consumed',terminal:{state:'cleaned',cause:'backend_holdout_consumed'}}});expect(calls).toBe(2);
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

test('checked-in Specflow configuration stays inert source data without becoming a capability',()=>{
 const src=path.join(root,'workspace');fs.mkdirSync(path.join(src,'.specflow'),{recursive:true});
 const contents='{"authority":"untrusted repository data"}';fs.writeFileSync(path.join(src,'.specflow','adapter-routing.json'),contents);
 const bundled=generation.sourceBundle(src,{entries:[{path:'.specflow/adapter-routing.json',kind:'file',sha256:hash(contents)}]});
 expect(Buffer.from(bundled.files[0].contentBase64,'base64').toString()).toBe(contents);
 expect(()=>generation.declaration(JSON.parse(contents),runDir,{})).toThrow('backend_capability_required');
});

test('capability snapshot preserves the admitted software-layer byte ordering',async()=>{
 journeyProfile();
 const workerModule=require('../../scripts/improve-worker.cjs'),production=require('../../scripts/improve-production-build.cjs');
 const files=[{source:'/fixture/tool',destination:'/node/bin/node',sha256:digest}],directories=[];
 config.worker.image='sha256:'+digest;config.worker.layer={files,directories,sha256:hash(JSON.stringify({files,directories}))};
 const expected=production.runtimeIdentity(config.worker),token=generation.install(config,runDir,()=>{});let captured;
 const spy=jest.spyOn(workerModule,'DockerWorker').mockImplementation(value=>{captured=value;throw Error('qualification_constructor_stop');});
 try{
  await expect(generation.open(token,runDir,'baseline',()=>({bindingSha256:config.backendJobBinding.sha256,declaration:declaration(),contractSha256:digest,contractJSON:JSON.stringify(journeyContract())}))).rejects.toThrow('qualification_constructor_stop');
  expect(production.runtimeIdentity(captured)).toBe(expected);
 }finally{spy.mockRestore();}
});

// Orchestration unit controls: substitute Docker/build/backend operations only.
// The capability, credential issue/read, durable reservation and terminal are real.
// Live owned-resource removal is covered by the separate qualification drivers.
describe('GENERATION293 reservation ordering and failure terminals',()=>{
 afterEach(()=>jest.restoreAllMocks());
 function staged(stage,extended=true){
  journeyProfile();
  const workerModule=require('../../scripts/improve-worker.cjs');
  const admission=require('../../scripts/improve-backend.cjs'),credentials=require('../../scripts/improve-backend-credentials.cjs');
  const semantics=require('../../scripts/improve-backend-semantics.cjs'),managed=require('../../scripts/improve-managed-worker.cjs');
  const production=require('../../scripts/improve-production-build.cjs'),runtime=require('../../scripts/improve-backend-runtime.cjs');
  const workspace=path.join(root,'workspace');fs.mkdirSync(workspace);
  const entries=['package.json','pnpm-lock.yaml'].map(name=>{const bytes='fixture '+name;fs.writeFileSync(path.join(workspace,name),bytes);return {path:name,kind:'file',sha256:hash(bytes)};});
  value.dependencySource.packageSha256=entries[0].sha256;value.dependencySource.lockSha256=entries[1].sha256;
  value.dependencies.expected.identity.sourceInputSha256=hash(canonical(value.dependencySource));
  const template=JSON.parse(fs.readFileSync(value.inputsTemplate.path));
  const prior=credentials.read(store,credentials.issue(store,{jobId:'job',phase:'after'}));
  const normalized=JSON.parse(canonical(template));normalized.credentialBinding.sha256=semantics.projection(prior,prior);value.constructionSha256=hash(canonical(normalized));sign();
  const read=admission.readBoundFile;
  jest.spyOn(admission,'readBoundFile').mockImplementation((dir,ref,...args)=>{
   if(dir===root&&[...['bootstrap','supabaseCli','seed','runtimeLayer','configuration'].map(k=>template[k].path),...template.migrations.map(x=>'migrations/'+x.name)].includes(ref.path))return Buffer.from('substituted inert build input');
   return read(dir,ref,...args);
  });
  const calls=[],fail=at=>{calls.push(at);if(stage===at)throw Error('backend_'+at+'_failed');};
  const begin=attempts.begin;let reservation;
  jest.spyOn(attempts,'begin').mockImplementation((...args)=>{reservation=begin(...args);calls.push('reserved');return reservation;});
  const issue=credentials.issue;
  jest.spyOn(credentials,'issue').mockImplementation((...args)=>{
   expect(reservation).toBeDefined();expect(attempts.read(store,reservation).attemptId).toBe(reservation.attemptId);
   const claimed=JSON.parse(fs.readFileSync(path.join(store.root,'backend-attempts','attempt-'+reservation.attemptId+'.json'))).value;
   expect(()=>begin(store,Object.fromEntries(['jobId','runId','phase','contractSha256','constructionSha256','authoritySha256','deadlineAtMs'].map(k=>[k,claimed[k]])))).toThrow('backend_attempt_active');
   fail('issue');return issue(...args);
  });
  const worker={containers:new Set(),capsuleMount:()=>{},create:()=> 'producer',exec:()=>{},pause:()=>{},captureCapsule:()=>({target:'/substituted/source',identity:{},manifestSha256:digest}),destroy:()=>{},close:()=>{calls.push('worker-close');}};
  jest.spyOn(workerModule,'DockerWorker').mockImplementation(()=>worker);
  jest.spyOn(managed,'bind').mockImplementation(()=>{});jest.spyOn(managed,'select').mockImplementation(()=>{});
  jest.spyOn(production,'runtimeIdentity').mockReturnValue(digest);
  jest.spyOn(production,'runProductionBuild').mockImplementation(()=>{fail('build');return {receipt:{fixture:'substituted build'},target:'/substituted/build'};});
  jest.spyOn(production,'createProductionConsumer').mockReturnValue({id:'substituted-app',close:()=>calls.push('consumer-close')});
  jest.spyOn(runtime,'startBackend').mockImplementation(async()=>{fail('start');return {};});
  jest.spyOn(runtime,'closeBackend').mockImplementation(async()=>{fail('close');return {phase:'cleaned',cause:null};});
  const token=generation.install(config,runDir,()=>{});
  const refresh=({metadataOnly}={})=>({bindingSha256:config.backendJobBinding.sha256,declaration:declaration(),contractSha256:digest,workspace,...(extended?{contractJSON:JSON.stringify(journeyContract())}:{}),...(metadataOnly?{}:{identity:{workspace:{entries}}})});
  return {calls,open:()=>generation.open(token,runDir,'dev-r1',refresh),reservation:()=>reservation};
 }
 test('new profile propagates to app/backend and retains exact admitted inventory',async()=>{
  const f=staged('check',true),handle=await f.open();
  const production=require('../../scripts/improve-production-build.cjs'),runtime=require('../../scripts/improve-backend-runtime.cjs');
  expect(production.createProductionConsumer.mock.calls[0][4]).toBe('heystax-backend-journeys-v1');
  expect(runtime.startBackend.mock.calls[0][0].request.resourceProfile).toBe('heystax-backend-journeys-v1');
  const ref=generation.access(handle).plan,proof=JSON.parse(fs.readFileSync(ref.path));expect(hash(fs.readFileSync(ref.path))).toBe(ref.sha256);
  expect(proof).toMatchObject({profileId:'heystax-backend-journeys-v1',contractSha256:digest,deadlineAtMs:value.deadlineAtMs,requiredExecutionMilliseconds:220000});
  expect(proof.invocations.map(x=>x.set+':'+x.id)).toEqual(['dev:journey']);
  const closed=await generation.close(handle,'backend_check_failed');expect(closed.plan).toEqual(proof);
 });
 test('time spent building cannot renew original task horizon or create an app',async()=>{
  const f=staged('check',true),production=require('../../scripts/improve-production-build.cjs');
  const now=Date.now();production.runProductionBuild.mockImplementation(()=>{jest.spyOn(Date,'now').mockReturnValue(now+1200000);return {receipt:{fixture:'substituted build'},target:'/substituted/build'};});
  await expect(f.open()).rejects.toMatchObject({code:'backend_job_time_insufficient'});
  expect(production.createProductionConsumer).not.toHaveBeenCalled();expect(config.deadlineAtMs).toBe(value.deadlineAtMs);
 });
 test.each(['issue','build','start'])('failure at %s preserves cause and cleans exact durable attempt',async stage=>{
  const f=staged(stage);let error;try{await f.open();}catch(e){error=e;}
  expect(error?.message).toBe('backend_'+stage+'_failed');
  expect(error.backendGeneration.terminal).toMatchObject({attemptId:f.reservation().attemptId,state:'cleaned',cause:error.message,credentialEnvelopeRemoved:true});
  expect(f.calls.indexOf('reserved')).toBeLessThan(f.calls.indexOf('issue'));
  expect(fs.readdirSync(path.join(store.root,'backend-attempts')).some(n=>n.startsWith('active-'))).toBe(false);
 });
 test('check failure retains named failed terminal instead of success',async()=>{
  const f=staged('check'),handle=await f.open(),result=await generation.close(handle,'backend_check_failed');
  expect(result.terminal).toMatchObject({attemptId:f.reservation().attemptId,state:'cleaned',cause:'backend_check_failed',credentialEnvelopeRemoved:true});
  expect(f.calls).toEqual(['reserved','issue','build','start','close','consumer-close','worker-close']);
 });
 test('close failure fences successor with operator_required and keeps private envelope',async()=>{
  const f=staged('close'),handle=await f.open(),envelope=attempts.envelope(store,f.reservation());await expect(generation.close(handle)).rejects.toThrow('backend_close_failed');
  const ref=f.reservation(),area=path.join(store.root,'backend-attempts');
  expect(JSON.parse(fs.readFileSync(path.join(area,'operator-'+ref.attemptId+'.json'))).value.state).toBe('operator_required');
  expect(fs.readdirSync(area).some(n=>n.startsWith('active-'))).toBe(true);
  expect(fs.existsSync(envelope)).toBe(true);
  expect(f.calls).toEqual(['reserved','issue','build','start','close','consumer-close','worker-close']);
 });
});
