'use strict';
// Installed by the pinned core-stage launcher after currentAuthority. Nothing
// serialized by a repository is a capability; the token is process-local.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const production=require('./improve-production-build.cjs'),{canonical}=production;
const admission=require('./improve-backend.cjs'),attempts=require('./improve-backend-attempt.cjs');
const managed=require('./improve-managed-worker.cjs'),credentials=require('./improve-backend-credentials.cjs');
const profiles=require('./improve-backend-profiles.cjs');
const runtime=require('./improve-backend-runtime.cjs'),semantics=require('./improve-backend-semantics.cjs');
const capabilities=new WeakMap(),sessions=new WeakMap();
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(ok,code='backend_input_invalid')=>{if(!ok)throw Error(code);};
const json=b=>require('./improve-worker.cjs').strictJSON(b.toString());
function absolute(ref){need(ref&&path.isAbsolute(ref.path));return admission.readBoundFile(path.dirname(ref.path),{path:path.basename(ref.path),sha256:ref.sha256},128*1024*1024);}
function write(root,name,bytes){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});return {path:file,sha256:hash(bytes)};}
function validateBinding(v){
 const exact=(x,keys)=>need(x&&Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).sort().join(',')===keys.sort().join(','),'backend_binding_invalid');
 const digest=x=>typeof x==='string'&&x.length===64&&/^[a-f0-9]+$/.test(x);
 exact(v,['schema','jobId','runId','recipeId','constructionSha256','expectedSemanticSha256','inputsTemplate','dependencies','sourceRecipeSha256','resourceProfileSha256','dependencySource','deadlineAtMs']);
 need(v.schema==='specflow.backend-job-binding/v1'&&v.recipeId==='heystax-supabase-v1'&&[v.jobId,v.runId].every(x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(x)&&!/\s/.test(x)),'backend_binding_invalid');
 need(['constructionSha256','expectedSemanticSha256','sourceRecipeSha256','resourceProfileSha256'].every(k=>digest(v[k]))&&Number.isSafeInteger(v.deadlineAtMs)&&v.deadlineAtMs>0,'backend_binding_invalid');
 exact(v.inputsTemplate,['path','sha256']);need(typeof v.inputsTemplate.path==='string'&&v.inputsTemplate.path.length<=4096&&path.isAbsolute(v.inputsTemplate.path)&&digest(v.inputsTemplate.sha256),'backend_binding_invalid');
 exact(v.dependencySource,['packageSha256','lockSha256','manifestSha256']);need(Object.values(v.dependencySource).every(digest),'backend_binding_invalid');
 exact(v.dependencies,['target','expected']);need(typeof v.dependencies.target==='string'&&path.isAbsolute(v.dependencies.target),'backend_binding_invalid');
 exact(v.dependencies.expected,['identity','manifestSha256']);need(digest(v.dependencies.expected.manifestSha256),'backend_binding_invalid');
 exact(v.dependencies.expected.identity,['jobId','sourceContainerId','recipeSha256','sourceInputSha256']);
 need(v.dependencies.expected.identity.jobId===v.jobId&&['sourceContainerId','recipeSha256','sourceInputSha256'].every(k=>digest(v.dependencies.expected.identity[k])),'backend_binding_invalid');
 return v;
}
function binding(config,store,runId){
 const signed=json(absolute(config.backendJobBinding));
 need(signed&&Object.keys(signed).sort().join(',')==='mac,value');
 validateBinding(signed.value);
 const value=signed.value,mac=store.mac(JSON.parse(canonical(value)));
 need(typeof signed.mac==='string'&&signed.mac.length===64&&/^[a-f0-9]+$/.test(signed.mac)&&crypto.timingSafeEqual(Buffer.from(signed.mac,'hex'),Buffer.from(mac,'hex')),'backend_binding_invalid');
 need(value.jobId===config.worker.jobId&&value.runId===runId&&value.deadlineAtMs===config.deadlineAtMs,'backend_binding_invalid');
 need(hash(canonical(value.dependencySource))===value.dependencies.expected.identity.sourceInputSha256,'build_dependency_source');
 need(value.dependencies.expected.identity.jobId===value.jobId&&value.sourceRecipeSha256===hash(RECONSTRUCT),'backend_binding_invalid');
 const template=admission.validateInputs(json(absolute(value.inputsTemplate)));
 need(template.jobId===value.jobId&&template.resourceProfile.sha256===value.resourceProfileSha256,'backend_binding_invalid');
 const profileBytes=admission.readBoundFile(path.dirname(value.inputsTemplate.path),template.resourceProfile);
 const profileId=json(profileBytes).id,profile=profiles.profileFor(profileId);
 if(profileId===admission.PROFILE.id)need(canonical(json(profileBytes))===canonical(profile),'backend_input_changed');
 else profiles.validateProfileBytes(profileId,profileBytes);
 return {value,template,profileId};
}
function install(config,runDir,authorize){
 need(typeof authorize==='function');authorize();
 const {DurableStore}=require('./improve-worker.cjs'),root=fs.realpathSync(runDir);
 const run=json(fs.readFileSync(path.join(root,'run.json')));
 const store=new DurableStore({root:config.worker.stateRoot,sourceRoot:config.worker.stateRoot});
 const admitted=binding(config,store,run.run_id),token=Object.freeze({});
 // Preserve existing order-sensitive software-layer digests in the private copy.
 // Canonicalization is for explicit signed fields, not a configuration rewrite.
 capabilities.set(token,{config:JSON.parse(JSON.stringify(config)),runDir:root,runId:run.run_id,store,admitted,authorize});return token;
}
function current(token,runDir,execution=true){
 const c=capabilities.get(token);need(c&&fs.realpathSync(runDir)===c.runDir,'backend_capability_required');
 c.authorize();const fresh=binding(c.config,c.store,c.runId);need(canonical(fresh)===canonical(c.admitted),'backend_input_changed');
 if(execution)need(Date.now()<fresh.value.deadlineAtMs,'backend_lease_expired');return c;
}
function declaration(token,runDir,decl){const c=current(token,runDir);need(canonical(decl)===canonical({recipeId:c.admitted.value.recipeId,expectedSemanticSha256:c.admitted.value.expectedSemanticSha256,constructionSha256:c.admitted.value.constructionSha256}),'backend_identity_mismatch');return c;}
// Snapshot exactly the workspace identity supplied by the core, not a previous
// build or a baseline bundle. All bytes are data until reconstructed in a worker.
function sourceBundle(workspace,identity){
 const files=[];let total=0;
 for(const entry of identity.entries){
  if(['node_modules','.next'].some(p=>entry.path===p||entry.path.startsWith(p+'/')))continue;
  if(entry.kind==='directory'||entry.kind==='mutable-output')continue;
  // Checked-in framework configuration is inert product data. The private run
  // and signed binding live outside this workspace; repository JSON never
  // becomes the process-local capability installed by coreStage.
  need(entry.kind==='file'&&entry.path.split('/').every(p=>p&&p!=='.'&&p!=='..'&&p!=='.git'&&(!p.startsWith('.env')||p==='.env.example')),'backend_source_invalid');
  let at=workspace;for(const part of entry.path.split('/')){at=path.join(at,part);need(!fs.lstatSync(at).isSymbolicLink(),'backend_source_invalid');}
  const fd=fs.openSync(at,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);let bytes,stat;
  try{stat=fs.fstatSync(fd);need(stat.isFile()&&stat.nlink===1&&stat.size<=256*1024*1024-total,'backend_source_invalid');bytes=fs.readFileSync(fd);}finally{fs.closeSync(fd);}
  total+=bytes.length;need(total<=256*1024*1024&&files.length<50000,'backend_source_invalid');
  need(hash(bytes)===entry.sha256,'backend_input_changed');files.push({path:entry.path,mode:stat.mode&0o111?0o755:0o644,contentBase64:bytes.toString('base64')});
 }
 return {files};
}
const RECONSTRUCT="const fs=require('fs'),p=require('path'),s=JSON.parse(fs.readFileSync('/inputs/source.json'));fs.mkdirSync('/work/app');for(const f of s.files){const target=p.join('/work/app',f.path);fs.mkdirSync(p.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.from(f.contentBase64,'base64'),{flag:'wx',mode:f.mode});}for(const n of ['node_modules','.next'])fs.mkdirSync('/work/app/'+n);";
async function open(token,runDir,phase,refresh){
 need(require('./improve-backend-phase.cjs').validPhase(phase));
 const c=current(token,runDir),v=c.admitted.value,initial=refresh({metadataOnly:true});declaration(token,runDir,initial.declaration);need(initial.bindingSha256===c.config.backendJobBinding.sha256,'backend_binding_invalid');
 const extended=c.admitted.profileId!==admission.PROFILE.id;
 // Every new managed admission must fit its selected profile; legacy selection
 // is not an escape hatch. Already running, pinned workers keep their bytes.
 const phasePlan=profiles.planPhase({phase,contract:json(Buffer.from(initial.contractJSON)),profileId:c.admitted.profileId,deadlineAtMs:v.deadlineAtMs});
 const ref=attempts.begin(c.store,{jobId:v.jobId,runId:v.runId,phase,contractSha256:initial.contractSha256,constructionSha256:v.constructionSha256,authoritySha256:hash(canonical(c.config.authority)),deadlineAtMs:v.deadlineAtMs});
 const state={c,token,ref,phasePlan:phasePlan?{...phasePlan,contractSha256:initial.contractSha256}:null,worker:null,session:null,consumer:null,root:null,product:null,context:null};const handle=Object.freeze({});sessions.set(handle,state);
 try{
  state.root=attempts.envelope(c.store,ref);
  if(phasePlan)state.plan=write(state.root,'phase-plan.json',canonical(state.phasePlan));
  const selected=refresh();
  const metadata=({identity,...rest})=>rest;
  need(canonical(metadata(selected))===canonical(metadata(initial)),'backend_input_changed');current(token,runDir);state.identity=selected.identity;
  const {DockerWorker}=require('./improve-worker.cjs');
  const worker=new DockerWorker({...c.config.worker,gitArea:null});state.worker=worker;
  managed.bind(worker,{store:c.store,attempt:ref,authorize:()=>current(token,runDir)});
  // Validate admitted dependency bytes before issue or resource creation.
  worker.capsuleMount(v.dependencies.target,v.dependencies.expected,'/deps');
  const source=sourceBundle(selected.workspace,selected.identity.workspace);
  for(const [name,expected]of [['package.json',v.dependencySource.packageSha256],['pnpm-lock.yaml',v.dependencySource.lockSha256]]){
   const file=source.files.find(f=>f.path===name);need(file&&hash(Buffer.from(file.contentBase64,'base64'))===expected,'build_dependency_source');
  }
  const template=JSON.parse(canonical(c.admitted.template));
  const inputRoot=path.dirname(v.inputsTemplate.path);
  for(const key of ['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile'])write(state.root,template[key].path,admission.readBoundFile(inputRoot,template[key],128*1024*1024));
  for(const file of template.migrations)write(state.root,template.migrationRoot+'/'+file.name,admission.readBoundFile(inputRoot,{path:template.migrationRoot+'/'+file.name,sha256:file.sha256}));
  const credentialRef=credentials.issue(c.store,{jobId:v.jobId,phase}),issued=credentials.read(c.store,credentialRef);
  const request={schema:'specflow.backend-request/v2',jobId:v.jobId,phase,recipeId:v.recipeId,generation:credentialRef.generation,expectedBackendIdentity:v.expectedSemanticSha256,resourceProfile:c.admitted.profileId,constructionSha256:v.constructionSha256};
  const normalized=JSON.parse(canonical(template));normalized.credentialBinding.sha256=semantics.projection(issued,request);
  need(hash(canonical(normalized))===v.constructionSha256,'backend_identity_mismatch');
  const secret=write(state.root,template.credentialBinding.path,canonical(issued));template.credentialBinding.sha256=secret.sha256;
  const manifest=write(state.root,'generation-inputs.json',canonical(template));request.inputManifest={path:'generation-inputs.json',sha256:manifest.sha256};
  const signed=fs.readFileSync(path.join(c.store.root,'backend-attempts','attempt-'+ref.attemptId+'.json'));
  request.attempt={path:'generation-attempt.json',sha256:write(state.root,'generation-attempt.json',signed).sha256};
  const bundle=write(state.root,'selected-source.json',canonical(source));
  managed.select(worker,'source-producer');const producer=worker.create({role:'setup',resourceProfile:'offline-dependencies-v1',mounts:[{source:bundle.path,destination:'/inputs/source.json'}]});
  worker.exec(producer,['/node/bin/node','-e',RECONSTRUCT],{cwd:'/work'});worker.pause(producer);
  const captured=worker.captureCapsule(producer,'/work/app',path.join(state.root,'source'),{recipeSha256:v.sourceRecipeSha256,sourceInputSha256:bundle.sha256});worker.destroy(producer);
  const productInput={schema:'specflow.production-build-input/v1',jobId:v.jobId,source:{target:captured.target,receipt:{identity:captured.identity,manifestSha256:captured.manifestSha256}},dependencies:{target:v.dependencies.target,receipt:v.dependencies.expected},dependencySource:v.dependencySource,runtimeSha256:production.runtimeIdentity(worker),command:production.COMMAND,environment:{...production.FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:issued.anonKey},resourceProfile:production.PROFILE.id};
  managed.select(worker,'build');const built=production.runProductionBuild(worker,productInput,path.join(state.root,'built'));
  current(token,runDir);credentials.read(c.store,credentialRef);need(worker.containers.size===0,'backend_cleanup_unconfirmed');
  const build=write(state.root,'generation-build.json',canonical(built.receipt));request.productBuildReceipt={path:'generation-build.json',sha256:build.sha256};state.product=build;
  if(phasePlan){const rechecked=profiles.planPhase({phase,contract:json(Buffer.from(selected.contractJSON)),profileId:c.admitted.profileId,deadlineAtMs:v.deadlineAtMs});need(canonical(rechecked)===canonical(phasePlan),'backend_input_changed');}
  managed.select(worker,'app');state.consumer=production.createProductionConsumer(worker,productInput,built.receipt,built.target,extended?c.admitted.profileId:undefined);
  state.session=await runtime.startBackend({worker,anchorId:state.consumer.id,root:state.root,request,inputs:template,credentials:{store:c.store,reference:credentialRef},productInput});
  state.context={runId:v.runId,phase,expectedBackendIdentity:v.expectedSemanticSha256,inputManifestSha256:request.inputManifest.sha256};
  state.request=request;return handle;
 }catch(error){try{error.backendGeneration=await close(handle,error.code||error.message);}catch(cleanup){error.cleanupCause=cleanup.message;}throw error;}
}
function access(handle){const s=sessions.get(handle);need(s&&s.session&&!s.stopping,'backend_capability_required');return {session:s.session,context:s.context,identity:s.identity,plan:s.plan};}
function selectChecker(handle){const s=sessions.get(handle);need(s&&s.worker&&!s.stopping);managed.select(s.worker,'checker');}
function validate(handle){const s=sessions.get(handle);need(s,'backend_capability_required');current(s.token,s.c.runDir);}
// Stop live resources once, but retain the sealed reservation until the core's
// final Git/verifier identity is checked. Shutdown never issues a success receipt.
async function shutdown(handle){
 const s=sessions.get(handle);need(s,'backend_capability_required');
 if(s.shutdown)return s.shutdown;
 s.stopping=true;
 s.shutdown=(async()=>{
  let backendTerminal=null,cleanupError;
  try{attempts.seal(s.c.store,s.ref);}catch(e){cleanupError=e;}
  try{if(s.session)backendTerminal=await runtime.closeBackend(s.session);}catch(e){cleanupError||=e;}
  try{if(s.consumer)s.consumer.close();}catch(e){cleanupError||=e;}
  try{s.worker?.close();}catch(e){cleanupError||=e;}
  if(cleanupError){attempts.operatorRequired(s.c.store,s.ref);throw cleanupError;}
  return backendTerminal;
 })();return s.shutdown;
}
async function close(handle,cause=null){
 const s=sessions.get(handle);need(s,'backend_capability_required');
 try{
  const backendTerminal=await shutdown(handle);
  if(backendTerminal?.cause&&(cause===null||cause==='backend_service_died'))cause=backendTerminal.cause;
  // Cleanup is always allowed, but elapsed task time or revoked authority can
  // never become a successful terminal after expensive final bookkeeping.
  if(cause===null)try{validate(handle);}catch(error){cause=error.code||error.message;}
  const originalCause=cause,terminalCause=cause===null?null:/^backend_[a-z_]+$/.test(cause)?cause:'backend_generation_failed';
  const terminal=attempts.finish(s.c.store,s.ref,{cause:terminalCause,backendTerminalSha256:backendTerminal?hash(canonical(backendTerminal)):null,productReceiptSha256:s.product?.sha256||null});
  return {attempt:s.ref,terminal,backendTerminal,originalCause,...(s.phasePlan?{plan:s.phasePlan}:{})};
 }finally{sessions.delete(handle);}
}
module.exports={install,open,access,selectChecker,validate,shutdown,close,declaration};

function verifyReceipt(token,runDir,phase,contractSha256,receipt,contract){
 const c=current(token,runDir,false),v=c.admitted.value,m=receipt.managed;
 {
  const expected=profiles.planPhase({phase,contract,profileId:c.admitted.profileId,deadlineAtMs:v.deadlineAtMs,nowMs:0});
  need(canonical(json(absolute(receipt.plan)))===canonical({...expected,contractSha256}),'backend_receipt_invalid');
 }
 need(m&&m.attempt.jobId===v.jobId&&m.attempt.runId===v.runId,'backend_receipt_invalid');
 const terminal=attempts.terminal(c.store,m.attempt);
 need(canonical(terminal)===canonical(m.terminal)&&terminal.state==='cleaned'&&terminal.cause===null&&terminal.credentialEnvelopeRemoved===true&&terminal.phase===phase,'backend_cleanup_unconfirmed');
 const signed=json(fs.readFileSync(path.join(c.store.root,'backend-attempts','attempt-'+m.attempt.attemptId+'.json'))),a=signed.value;
 need(signed.mac===c.store.mac(JSON.parse(canonical(a)))&&hash(canonical(a))===m.attempt.attemptSha256,'backend_receipt_invalid');
 need(a.contractSha256===contractSha256&&a.constructionSha256===v.constructionSha256&&a.deadlineAtMs===v.deadlineAtMs&&a.phase===phase&&a.authoritySha256===hash(canonical(c.config.authority)),'backend_receipt_invalid');
 const entry=json(absolute(receipt.entry)),backendTerminal=json(absolute(receipt.terminal));
 if(c.admitted.profileId!==admission.PROFILE.id)need(backendTerminal.resourceProfile===c.admitted.profileId&&backendTerminal.resourceProfileSha256===v.resourceProfileSha256,'backend_receipt_invalid');
 need(entry.jobId===v.jobId&&entry.phase===phase&&entry.attemptSha256===m.attempt.attemptSha256&&entry.constructionSha256===v.constructionSha256&&entry.generation===backendTerminal.generation,'backend_receipt_invalid');
 need(terminal.backendTerminalSha256===hash(canonical(backendTerminal))&&terminal.productReceiptSha256===receipt.product.build.sha256,'backend_receipt_invalid');
 for(const slot of ['source-producer','build','app','checker','database','authMigration','auth','rest','gateway'])need(terminal.resources.some(r=>r.slot===slot&&r.status==='removed'),'backend_cleanup_unconfirmed');
 return true;
}
module.exports.verifyReceipt=verifyReceipt;

module.exports.freezeBinding=(token,runDir,decl)=>{const c=declaration(token,runDir,decl);return {sha256:c.config.backendJobBinding.sha256};};

// Proof survives envelope removal, but remains in a private no-follow directory
// even when the enclosing core phase directory uses the ordinary 0755 mode.
function proofBytes(dir,bytes){
 const {directory}=require('./improve-offline-cache.cjs'),fd=directory(dir);
 try{
  const parent=fs.fstatSync(fd);need(parent.uid===process.getuid()&&!(parent.mode&0o022),'backend_receipt_invalid');
  const name='backend-proof-'+crypto.randomUUID(),base='/proc/self/fd/'+fd;
  fs.mkdirSync(path.join(base,name),{mode:0o700});
  write(path.join(base,name),'receipt.json',bytes);
  return {path:path.join(fs.realpathSync(dir),name,'receipt.json'),sha256:hash(bytes)};
 }finally{fs.closeSync(fd);}
}
module.exports.retainProof=(dir,ref)=>proofBytes(dir,absolute(ref));
module.exports.writeProof=(dir,value)=>proofBytes(dir,canonical(value));
module.exports.sourceRecipeSha256=hash(RECONSTRUCT);

module.exports.sourceBundle=sourceBundle;
