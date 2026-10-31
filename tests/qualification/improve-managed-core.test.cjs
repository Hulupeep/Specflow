'use strict';
// Explicit local mechanical qualification on immutable real product inputs.
// Candidate/oracle preparation is a labelled fixture, not a product win or an
// independent model-authored story. All product build/runtime/check/Git work is
// confined. Baseline and later phases invoke the actual pinned coreStage.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('assert');
const w=require('../../scripts/improve-worker.cjs'),core=require('../../scripts/specflow-improve.cjs');
const production=require('../../scripts/improve-production-build.cjs'),credentials=require('../../scripts/improve-backend-credentials.cjs');
const runtime=require('../../scripts/improve-backend-runtime.cjs'),backend=require('../../scripts/improve-backend.cjs');
const semantics=require('../../scripts/improve-backend-semantics.cjs'),generation=require('../../scripts/improve-backend-generation.cjs');
const profiles=require('../../scripts/improve-profiles.cjs'),{canonical}=production;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>w.strictJSON(fs.readFileSync(p).toString());
const bound=ref=>{const bytes=fs.readFileSync(ref.path);assert.equal(hash(bytes),ref.sha256);return w.strictJSON(bytes.toString());};
const dir=p=>{fs.mkdirSync(p,{recursive:true,mode:0o700});fs.chmodSync(p,0o700);return p;};
function write(p,value){const bytes=canonical(value);fs.writeFileSync(p,bytes,{mode:0o600,flag:'wx'});return {path:p,sha256:hash(bytes)};}
function time(admission,remaining=1){assert(Number.isSafeInteger(admission.deadlineAtMs)&&Date.now()+remaining<admission.deadlineAtMs,'backend_lease_expired');}
async function stage(configFile,name,args,history){
 const deadline=read(configFile).deadlineAtMs;assert(Number.isSafeInteger(deadline)&&deadline>Date.now(),'backend_lease_expired');
 // A build contains multiple fresh generations. Its observation bound is the
 // original admitted task deadline, not a new per-stage ten-minute deadline.
 const result=await w.awaitStage(w.startAuthorizedStage(configFile,name,args),{timeout:Math.max(1,deadline-Date.now())});
 const base=path.join(history,Date.now()+'-'+name);fs.writeFileSync(base+'.stdout',result.stdout,{mode:0o600});fs.writeFileSync(base+'.stderr',result.stderr,{mode:0o600});
 assert.equal(result.status,0,'core_'+name+'_failed; inspect private stage output');
 // Core results include fractional telemetry; canonical() is for integer-only
 // build inputs and signed authority records, not these retained observations.
 const parsed=w.strictJSON(result.stdout.trim().split('\n').at(-1));fs.writeFileSync(base+'.result.json',JSON.stringify(parsed),{mode:0o600,flag:'wx'});return parsed;
}
async function prepare(descriptorFile){
 const descriptor=read(descriptorFile),inputs=bound(descriptor.inputs),admission=bound(descriptor.admission),old=bound(descriptor.recipe);
 time(admission,900000);assert.equal(inputs.sourceRevision,admission.productRevision);
 const root=fs.mkdtempSync(path.join(inputs.root,'core-runtime-'));fs.chmodSync(root,0o700);
 write(path.join(root,'admission.json'),admission);
 const workerConfig={...bound(inputs.workerConfig),stateRoot:inputs.root,gitArea:null,jobId:inputs.jobId,maxMilliseconds:600000};
 const store=new w.DurableStore({root:inputs.root,sourceRoot:inputs.root});
 const recipe=dir(path.join(root,'recipe')),template=JSON.parse(canonical(old));template.jobId=inputs.jobId;
 for(const name of ['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile']){
  const bytes=backend.readBoundFile(descriptor.recipeRoot,old[name],128*1024*1024),file=path.join(recipe,old[name].path);dir(path.dirname(file));fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});
 }
 for(const m of old.migrations){const file=path.join(recipe,old.migrationRoot,m.name);dir(path.dirname(file));fs.writeFileSync(file,backend.readBoundFile(descriptor.recipeRoot,{path:old.migrationRoot+'/'+m.name,sha256:m.sha256}),{mode:0o600,flag:'wx'});}
 const credentialRef=credentials.issue(store,{jobId:inputs.jobId,phase:'baseline'}),issued=credentials.read(store,credentialRef);
 const secretPath=path.join(recipe,template.credentialBinding.path);dir(path.dirname(secretPath));fs.writeFileSync(secretPath,canonical(issued),{mode:0o600,flag:'wx'});template.credentialBinding.sha256=hash(canonical(issued));
 const manifest=write(path.join(recipe,'preflight-inputs.json'),template);
 const request={schema:'specflow.backend-request/v1',jobId:inputs.jobId,phase:'baseline',recipeId:backend.RECIPE.id,generation:credentialRef.generation,expectedBackendIdentity:'0'.repeat(64),resourceProfile:backend.PROFILE.id,inputManifest:{path:'preflight-inputs.json',sha256:manifest.sha256}};
 const worker=new w.DockerWorker(workerConfig);let consumer,session,measurement,terminal,built;
 try{
  worker.capsuleMount(inputs.source.target,inputs.source.receipt,'/source');worker.capsuleMount(inputs.dependencies.target,inputs.dependencies.receipt,'/dependencies');
  const productInput={schema:'specflow.production-build-input/v1',jobId:inputs.jobId,source:inputs.source,dependencies:inputs.dependencies,dependencySource:inputs.dependencySource,runtimeSha256:production.runtimeIdentity(worker),command:production.COMMAND,environment:{...production.FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:issued.anonKey},resourceProfile:production.PROFILE.id};
  built=production.runProductionBuild(worker,productInput,path.join(root,'preflight-built'));time(admission,300000);
  const receipt=write(path.join(recipe,'preflight-build.json'),built.receipt);request.productBuildReceipt={path:'preflight-build.json',sha256:receipt.sha256};
  consumer=production.createProductionConsumer(worker,productInput,built.receipt,built.target);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root:recipe,request,inputs:template,credentials:{store,reference:credentialRef},productInput});
  measurement=await runtime.observeBackend(session);
  assert.deepEqual(measurement.state,template.expectedState,'pre_freeze_state_mismatch');
  // This observation precedes contract freeze. It is never promoted into a core
  // verification receipt and cannot be substituted for deciding checks.
 }finally{
  try{if(session){terminal=await runtime.closeBackend(session);assert.equal(terminal.phase,'cleaned','pre_freeze_cleanup_incomplete');assert.equal(terminal.cause,null,'pre_freeze_cleanup_cause');assert(terminal.resources.every(r=>r.status==='removed'));}}
  finally{try{if(consumer)consumer.close();}finally{worker.close();fs.unlinkSync(secretPath);}}
 }
 assert(measurement&&terminal);const preflight=write(path.join(root,'pre-freeze-observation.json'),{scope:'infrastructure qualification before frozen core; no deciding check',measurement,terminal,source:inputs.source.receipt,dependencies:inputs.dependencies.receipt});
 const normalized=JSON.parse(canonical(template));normalized.credentialBinding.sha256=semantics.projection(issued,request);
 const constructionSha256=hash(canonical(normalized)),expectedSemanticSha256=measurement.measuredBackendIdentity;
 const templateRef=write(path.join(recipe,'inputs-template.json'),template);
 const gitArea=dir(path.join(root,'git')),repo=path.join(gitArea,'repo');fs.cpSync(path.join(inputs.source.target,'tree'),repo,{recursive:true});
 function writable(file){const s=fs.lstatSync(file);assert(!s.isSymbolicLink());if(s.isDirectory()){fs.chmodSync(file,0o700);for(const n of fs.readdirSync(file))writable(path.join(file,n));}else{assert(s.isFile());fs.chmodSync(file,s.mode&0o111?0o755:0o644);}}writable(repo);
 const gitWorker=new w.DockerWorker({...workerConfig,gitArea});
 const git=args=>w.isolatedGit(gitWorker,gitArea,args,{cwd:repo}).stdout.trim();let head;
 try{git(['init','-q','-b','main']);git(['add','-A']);git(['-c','user.name=Specflow qualification','-c','user.email=qualification@example.invalid','commit','-qm','Import immutable product for mechanical qualification']);git(['remote','add','origin','https://github.com/Hulupeep/tabstax-webapps.git']);head=git(['rev-parse','HEAD']);}finally{gitWorker.close();}
 const runId='managed-core-'+crypto.randomUUID(),stateRoot=dir(path.join(root,'core')),runDir=path.join(stateRoot,runId);
 const value={schema:'specflow.backend-job-binding/v1',jobId:inputs.jobId,runId,recipeId:backend.RECIPE.id,constructionSha256,expectedSemanticSha256,inputsTemplate:templateRef,dependencies:{target:inputs.dependencies.target,expected:inputs.dependencies.receipt},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:template.resourceProfile.sha256,dependencySource:inputs.dependencySource,deadlineAtMs:admission.deadlineAtMs};
 const binding=write(path.join(root,'job-binding.json'),{value,mac:store.mac(JSON.parse(canonical(value)))});
 const claude=fs.realpathSync(descriptor.claude),toolchain=[['node',process.execPath],['git','/usr/bin/git'],['claude',claude]].map(([id,file])=>({id,path:fs.realpathSync(file),sha256:hash(fs.readFileSync(fs.realpathSync(file))),version:cp.execFileSync(file,['--version'],{encoding:'utf8',env:w.controlledEnvironment(),timeout:15000}).trim()}));
 const revision=hash(canonical({worker:hash(fs.readFileSync(require.resolve('../../scripts/improve-worker.cjs'))),generation:hash(fs.readFileSync(require.resolve('../../scripts/improve-backend-generation.cjs'))),preflight:preflight.sha256}));
 const routing=write(path.join(root,'routing.json'),{mode:'subscription_cli',builder:'claude-sonnet-5-5',oracle:'claude-opus-5-5',peer:'claude-opus-5-5',judge:'claude-opus-5-5'});
 const registry=dir(path.join(root,'registry')),principal='local-owner-'+process.getuid(),repoId='backend-qualification',backendRecipe=['node','qualified-heystax-supabase-v1'];
 const verifier='src/__tests__/contracts/account_records_bearer_auth_contract.test.ts';assert(fs.existsSync(path.join(repo,verifier)));
 const profile={version:1,repo_id:repoId,repository:{path:repo,remote:'https://github.com/Hulupeep/tabstax-webapps.git',refs:[{name:'main',commit:head}]},mission:'Qualify core generation lifecycle on disposable real product and backend; no revenue or improvement claim.',scope:{allowed:['src/app/attention/page.tsx'],protected:['.git/**','.env*','src/__tests__/**']},recipes:{setup:['node','--version'],test:['node',verifier],backend:backendRecipe},verifier:{path:verifier,sha256:hash(fs.readFileSync(path.join(repo,verifier)))},toolchain,routing:{path:routing.path,sha256:routing.sha256,usage_mode:'subscription_cli',providers:[{id:'claude',kind:'claude-cli',tool:'claude'}]},runtime:{adapter:'local-managed-backend-qualification',revision},secret_references:[],evidence:{path:stateRoot},publication:{allowed:false,branch_prefix:'improve/',automatic_merge:false},grants:{[principal]:['read','preflight','execute']}};
 const registered=profiles.registerProfile(registry,profile);
 const host={revision,operations:['read','preflight','execute'],adapters:[{id:profile.runtime.adapter,revision,qualified:true,usage_modes:['subscription_cli'],noninteractive_roles:true,evidence:preflight}],backends:[{recipe:hash(JSON.stringify({repo_id:repoId,commit:head,argv:backendRecipe})),ready:true,evidence:preflight}]};
 const bin=dir(path.join(root,'bin')),fileSchema={type:'object',properties:{files:{type:'array',items:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false}},claim:{type:'string'}},required:['files','claim'],additionalProperties:false};
 const cfg={worker:{...workerConfig,gitArea},gitArea,allowed:profile.scope.allowed,protected:profile.scope.protected,roles:dir(path.join(root,'roles')),emptyCwd:dir(path.join(root,'empty')),claude,models:{builder:'claude-sonnet-5-5',oracle:'claude-opus-5-5',peer:'claude-opus-5-5',judge:'claude-opus-5-5'},schemas:{builder:fileSchema,oracle:fileSchema},authority:{uid:process.getuid(),principal,registry,repo_id:repoId,revision:registered.revision,host},bin,launcher:path.join(bin,'worker-command'),backendJobBinding:binding,deadlineAtMs:admission.deadlineAtMs};
 w.currentAuthority(cfg);w.pinnedLauncher({directory:bin,config:cfg,mode:'git'});w.pinnedLauncher({directory:bin,config:cfg,mode:'worker'});
 const history=dir(path.join(root,'stage-history')),configFile=path.join(bin,'job.json');
 const mission=path.join(root,'mission.md');fs.writeFileSync(mission,profile.mission,{mode:0o600});
 const started=await stage(configFile,'startRun',[{target:repo,mission,base:'main',runId,stateDir:stateRoot,worktreeRoot:path.join(gitArea,'worktrees')}],history);assert.equal(started.runDir,runDir);
 const fixture=await require('./fixtures/backend-core-fixture.cjs').prepareManagedContract({core,runDir,root,backend:{recipeId:backend.RECIPE.id,expectedSemanticSha256,constructionSha256}});
 const frozen=await stage(configFile,'freezeContract',[runDir,fixture.contract],history);assert.equal(frozen.status,'frozen',JSON.stringify(frozen));
 const state={schema:'specflow.managed-core-qualification/v1',root,configFile,runDir,history,admission:descriptor.admission,sourceRevision:inputs.sourceRevision,jobId:inputs.jobId,preflight,scope:'mechanical core qualification; fixture candidate/oracle, real product/backend/native checks, no product verdict'};
 write(path.join(root,'qualification.json'),state);console.log(JSON.stringify({status:'prepared',qualification:path.join(root,'qualification.json'),originalDeadlineAtMs:admission.deadlineAtMs,preFreezeSemanticSha256:expectedSemanticSha256,remainingOwned:0}));
}
async function phase(stateFile,name){
 const s=read(stateFile);time(bound(s.admission));assert(['baseline','build','after','evaluate','finalize'].includes(name));
 let args=[s.runDir],operation=name;
 if(name==='baseline'||name==='after'){operation='verifyPhase';args.push(name);}
 if(name==='build'){
  const cfg=read(s.configFile),policyFile=path.join(s.root,'builder-policy.json');
  write(policyFile,{adapter_policy:{id:'managed-core-builder',provider:'claude-print',command:cfg.launcher,role:'implementer',args:['role','builder','-p'],model:'sonnet',requested_model:'sonnet',timeout_seconds:300,max_iterations:1,allowed_tools:[],denied_tools:['Read','Write','Edit','Bash'],transcript_path:'.specflow/runs/<slug>/adapters/builder.jsonl',output_path:'.specflow/runs/<slug>/adapters/builder.final.txt',never_without_human:['git push','open PR','merge','--no-verify','override contract','production deploy']}});
  args.push({policy:policyFile});
 }
 const result=await stage(s.configFile,operation,args,s.history);
 if(name==='evaluate'){
  assert.equal(result.schema,'specflow.improve.decision/v1');
  assert.equal(result.decision,'REVERT','Known failing fixture must never earn KEEP');
  assert.deepEqual(result.binding_errors,[],'Lifecycle proof requires valid baseline/after binding');
 }else if(name==='build'){
  assert.equal(result.status,'built');assert(result.rounds.length>=2,'Both practice generations must execute');
  assert.equal(result.rounds[0].dev?.['AC-1'],'fail');assert.equal(result.rounds[1].dev?.['AC-1'],'pass');
  assert(result.rounds.every(r=>!r.invalid),'Native peer responses must validate');
 }else if(name==='finalize')assert.equal(result.decision,'REVERT');
 else assert.equal(result.status,name==='baseline'?'baseline_recorded':'verified',JSON.stringify(result));
 if(result.status==='blocked')throw Error(result.reason);console.log(JSON.stringify({status:'passed',phase:name,result,qualification:stateFile,scope:s.scope}));
}
if(require.main===module){const [mode,file]=process.argv.slice(2);(mode==='prepare'?prepare(file):phase(file,mode)).catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message,frames:(e.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).slice(0,5)}));process.exitCode=1;});}
module.exports={prepare,phase};
