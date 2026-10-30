'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const repo=process.cwd(),runtime=require(repo+'/scripts/improve-backend-runtime.cjs'),credentialAuthority=require(repo+'/scripts/improve-backend-credentials.cjs'),production=require(repo+'/scripts/improve-production-build.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=ref=>{const b=fs.readFileSync(ref.path);assert.equal(hash(b),ref.sha256);return JSON.parse(b);};
function probe(){let chunks=[];process.stdin.on('data',c=>chunks.push(c));process.stdin.on('end',async()=>{try{const c=JSON.parse(Buffer.concat(chunks)),out={};for(const [name,keys]of Object.entries(c.cases)){const r=await fetch('http://127.0.0.1:54321/rest/v1/attention_blocks?select=id&limit=1',{headers:{apikey:keys.apikey,Authorization:'Bearer '+keys.bearer},signal:AbortSignal.timeout(5000)});out[name]=r.status;await r.arrayBuffer();}console.log(JSON.stringify(out));}catch{process.exitCode=1;}});}
function assertReplayWindow(key,now=Date.now()){
 try{assert(typeof key==='string'&&key.split('.').length===3);const claims=JSON.parse(Buffer.from(key.split('.')[1],'base64url').toString());assert(Number.isSafeInteger(claims.exp)&&claims.exp*1000>now+30000);}catch{throw Error('replay_requires_unexpired_prior_token');}
}
async function main(){
 const d=JSON.parse(fs.readFileSync(process.argv[2])),original=read(d.request),m=read(d.manifest),product=read(d.product),pi=read(product.inputs),pr=read(product.request),built=read(product.built),cfg=read(pi.workerConfig);
 const selected=process.argv[3],historyPath=process.argv[4];assert(!selected||['baseline','after'].includes(selected));if(selected)assert(historyPath&&path.isAbsolute(historyPath));
 const mutation=process.argv[5];assert(!mutation||['admit','server','schema','seed','env-input'].includes(mutation));if(mutation)assert.equal(selected,'after');const negative=mutation&&!['admit','server'].includes(mutation);let rejection;
 let history;if(selected==='after'){const fd=fs.openSync(historyPath,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW);try{const stat=fs.fstatSync(fd);assert.equal(stat.mode&0o777,0o600);assert.equal(stat.uid,process.getuid());assert.equal(stat.nlink,1);history=JSON.parse(fs.readFileSync(fd));}finally{fs.closeSync(fd);}assert.equal(history.jobId,pr.jobId);assert.equal(history.phase,'baseline');}
 if(history&&!negative&&mutation!=='server')assertReplayWindow(history.oldKey);
 let oldKey=mutation==='server'?undefined:history?.oldKey;const reports=history?.reports||[],cleanups=history?.cleanups||[],builds=history?.builds||[],observations=history?.observations||[];const store=new (require(repo+'/scripts/improve-worker.cjs').DurableStore)({root:pi.root,sourceRoot:pi.root});
 for(const phase of (selected?[selected]:['baseline','after'])){
  const reference=credentialAuthority.issue(store,{jobId:pr.jobId,phase}),issued=credentialAuthority.read(store,reference);
  const root=fs.mkdtempSync(path.join(pi.root,'generation-'));fs.chmodSync(root,0o700);
  const manifest=JSON.parse(JSON.stringify(m)),r={...original,phase,generation:reference.generation};
  if(mutation){assert(history.observations?.length===1);manifest.expectedState=history.observations[0].state;r.expectedBackendIdentity=history.observations[0].semantic;}
  fs.mkdirSync(path.join(root,m.migrationRoot),{mode:0o700});for(const f of m.migrations)fs.copyFileSync(path.join(d.root,m.migrationRoot,f.name),path.join(root,m.migrationRoot,f.name));
  for(const k of ['bootstrap','supabaseCli','seed','runtimeLayer','configuration','resourceProfile'])fs.copyFileSync(path.join(d.root,m[k].path),path.join(root,m[k].path));
  const credentialBytes=production.canonical(issued);fs.writeFileSync(path.join(root,m.credentialBinding.path),credentialBytes,{mode:0o600});manifest.credentialBinding.sha256=hash(credentialBytes);
  const manifestBytes=production.canonical(manifest);fs.writeFileSync(path.join(root,r.inputManifest.path),manifestBytes,{mode:0o600});r.inputManifest.sha256=hash(manifestBytes);
  const worker=new (require(repo+'/scripts/improve-worker.cjs').DockerWorker)({...cfg,gitArea:null,stateRoot:pi.root,jobId:pr.jobId,maxMilliseconds:300000});let consumer,session,checker;
  const previous=new Set(fs.readdirSync(root));
  try{
   const productInput={...pr,runtimeSha256:production.runtimeIdentity(worker),environment:{...pr.environment,NEXT_PUBLIC_SUPABASE_ANON_KEY:issued.anonKey}};
   const freshBuild=production.runProductionBuild(worker,productInput,path.join(root,'built'));
   const buildBytes=production.canonical(freshBuild.receipt);fs.writeFileSync(path.join(root,r.productBuildReceipt.path),buildBytes,{mode:0o600});r.productBuildReceipt.sha256=hash(buildBytes);
   builds.push({phase,inputSha256:freshBuild.receipt.inputSha256,buildIdSha256:freshBuild.receipt.buildIdSha256,sourceManifestSha256:productInput.source.receipt.manifestSha256});
   consumer=production.createProductionConsumer(worker,productInput,freshBuild.receipt,freshBuild.target);
   session=await runtime.startBackend({worker,anchorId:consumer.id,root,request:r,inputs:manifest,credentials:{store,reference},productInput});
   const journalName=fs.readdirSync(root).find(n=>n.startsWith('backend-journal-')),journal=JSON.parse(fs.readFileSync(path.join(root,journalName,'journal.json'))),db=journal.resources.find(x=>x.role==='database').id;
   if(mutation==='schema')worker.call(['exec',db,'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c','CREATE TABLE public.specflow_mutation_canary (id integer PRIMARY KEY)']);
   if(mutation==='seed')worker.call(['exec',db,'psql','-h','/work','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',"DO $$ BEGIN UPDATE public.next_actions SET content=content||' mutation-negative' WHERE id=(SELECT id FROM public.next_actions ORDER BY id LIMIT 1); ASSERT FOUND, 'seed_fixture_missing'; END $$"]);
   if(mutation==='env-input'){const stage=fs.readdirSync(root).find(n=>n.startsWith('backend-stage-')),file=path.join(root,stage,'auth.env'),text=fs.readFileSync(file,'utf8');assert(text.includes('GOTRUE_LOG_LEVEL=info'));fs.writeFileSync(file,text.replace('GOTRUE_LOG_LEVEL=info','GOTRUE_LOG_LEVEL=debug'));}
   const context={runId:'phase-mutation-qualification',phase,expectedBackendIdentity:r.expectedBackendIdentity,inputManifestSha256:r.inputManifest.sha256};
   if(negative){const expected=mutation==='env-input'?'backend_input_changed':'backend_identity_mismatch';await assert.rejects(runtime.admitBackend(session,context),error=>{rejection=error.message;return rejection===expected;});continue;}
   if(selected){const observed=['admit','server'].includes(mutation)?(await runtime.admitBackend(session,context)).manifest:await runtime.observeBackend(session);observations.push({phase,semantic:observed.measuredBackendIdentity,inputManifestSha256:observed.inputManifestSha256,state:observed.state,counts:observed.counts});if(['admit','server'].includes(mutation))await runtime.backendContinuity(session,context);if(mutation==='server'){const started=await runtime.startBackendServer(session,context);assert.equal(started.started,true);console.log(JSON.stringify({scope:'Actual unchanged Next server in the admitted production consumer',server:started}));}}

   const stages=fs.readdirSync(root).filter(n=>n.startsWith('backend-stage-')&&!previous.has(n));assert.equal(stages.length,1);
   const gateway=JSON.parse(fs.readFileSync(path.join(root,stages[0],'gateway.json'))),key=name=>gateway.consumers.find(c=>c.username===name).keyauth_credentials[0].key,current=key('server');
   const cases={current:{apikey:current,bearer:current}};
   if(oldKey){assertReplayWindow(oldKey);assert(current!==oldKey,'generation_key_reused');cases.oldKey={apikey:oldKey,bearer:oldKey};cases.oldBearerWithCurrentAnon={apikey:key('anon'),bearer:oldKey};}
   checker=worker.create({role:'checker',network:'container:'+consumer.id});
   const result=worker.exec(checker,['/node/bin/node','-e','('+probe.toString()+')()'],{cwd:'/tmp',input:JSON.stringify({cases}),timeout:20000,maxBuffer:4096});
   const report=JSON.parse(result.stdout);assert.equal(report.current,200);reports.push(report);oldKey=current;
   if(mutation==='server'){worker.destroy(checker);checker=null;await require('./fixtures/backend-server-journey.cjs').runServerJourney({root,session,context,anonKey:issued.anonKey,serverKey:current,staticRoot:path.join(freshBuild.target,'tree','static')});}
  }finally{
   try{if(checker)worker.destroy(checker);}finally{try{if(session){const t=await runtime.closeBackend(session);assert.equal(t.phase,'cleaned');assert.equal(t.cause,negative?(mutation==='env-input'?'backend_input_changed':'backend_identity_mismatch'):null);assert(t.resources.every(r=>r.status==='removed'));cleanups.push({phase:t.phase,cause:t.cause,ownedRemoved:t.resources.length});}}finally{if(consumer)consumer.close();worker.close();}}
  }
 }
 if(mutation==='server'){console.log(JSON.stringify({scope:'Actual current-generation server and desktop/mobile journeys only; rotation replay is a separate required check',cleanup:cleanups.at(-1),freshBuild:builds.at(-1)}));return;}
 if(negative){console.log(JSON.stringify({scope:'Live disposable backend mutation rejection before deciding checks',mutation,rejection,decidingChecksExecuted:0,cleanup:cleanups.at(-1),freshBuild:builds.at(-1)}));assert(rejection);return;}
 if(selected==='baseline'){fs.writeFileSync(historyPath,production.canonical({jobId:pr.jobId,phase:selected,oldKey,reports,cleanups,builds,observations}),{mode:0o600,flag:'wx'});console.log(JSON.stringify({scope:'Disposable baseline observation only; no deciding checks or frozen core acceptance',reports,cleanups,builds,observations}));return;}
 if(selected==='after'){console.log(JSON.stringify({scope:'Actual measured phase equivalence diagnostic, not core acceptance',observations}));assert.equal(observations.length,2);assert.notEqual(observations[0].inputManifestSha256,observations[1].inputManifestSha256);assert.equal(observations[0].semantic,observations[1].semantic,'credential_only_phase_semantics_differ');assert.deepEqual(observations[0].state,observations[1].state);}
 console.log(JSON.stringify({scope:'Disposable owned backend generation replay diagnostic; no host/production requests and no credentials in output',reports,cleanups,builds,priorGenerationOldApiKeyRejected:reports[1].oldKey===401,priorGenerationBearerRejected:[401,403].includes(reports[1].oldBearerWithCurrentAnon)}));
 assert.equal(reports[1].oldKey,401);assert.equal(reports[1].oldBearerWithCurrentAnon,401,'prior_generation_bearer_was_not_rejected');assert.equal(cleanups.length,2);assert.notEqual(builds[0].inputSha256,builds[1].inputSha256);assert.equal(builds[0].sourceManifestSha256,builds[1].sourceManifestSha256);
}
module.exports={assertReplayWindow};
if(require.main===module)main().catch(e=>{console.error(JSON.stringify({failed:true,cause:e.code||e.message}));process.exitCode=1;});
