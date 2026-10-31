'use strict';
// Capacity qualification: four separately dispatched real two-width journeys
// in baseline, three in after. Repeated workload is intentional; it is not four
// distinct product features, independent oracle authorship, or a product KEEP.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const repo=process.cwd(),w=require(repo+'/scripts/improve-worker.cjs'),production=require(repo+'/scripts/improve-production-build.cjs');
const generation=require(repo+'/scripts/improve-backend-generation.cjs'),runtime=require(repo+'/scripts/improve-backend-runtime.cjs'),native=require(repo+'/scripts/test-execution.cjs');
const binding=require(repo+'/scripts/improve-binding.cjs'),profiles=require(repo+'/scripts/improve-backend-profiles.cjs');
const canonical=production.canonical,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>w.strictJSON(fs.readFileSync(p).toString());
const bound=ref=>{const b=fs.readFileSync(ref.path);assert.equal(hash(b),ref.sha256);return w.strictJSON(b.toString());};
function write(root,name,value){const b=Buffer.isBuffer(value)?value:Buffer.from(canonical(value)),file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,b,{flag:'wx',mode:0o600});return{path:file,sha256:hash(b)};}
async function main(){
 const state=read(process.argv[2]),phase=process.argv[3];assert(['baseline','after'].includes(phase));
 const inputs=read(state.inputs),root=fs.mkdtempSync(path.join(state.root,phase+'-'));fs.chmodSync(root,0o700);
 const runId='profile-298-'+phase+'-'+crypto.randomUUID(),run=path.join(root,'run');fs.mkdirSync(run,{mode:0o700});write(run,'run.json',{run_id:runId});
 const store=new w.DurableStore({root:inputs.root,sourceRoot:inputs.root}),workspace=path.join(inputs.source.target,'tree');
 const check=(i)=>{const file='journeys/invocation-'+i+'.spec.cjs',config='journeys/config-'+i+'.cjs';return{id:'CAPACITY-'+i,required:true,timeout_seconds:100,verification_level:'journey',boundaries:['browser','network','database','process'],configuration_ids:['confined'],checker_paths:[file,config],input_paths:['inputs/public.json'],rule_paths:[],execution:{adapter:'playwright',test_files:[file],required_case_ids:[1280,360].map(width=>'default::'+file+'::J-BACKEND-PRODUCT-'+width+': real login save reload and wrong-user RLS rejection'),optional_case_ids:[],args:['--config',config]}};};
 const all=[1,2,3,4].map(check),contract={acceptance:all.slice(0,3).map((c,i)=>({id:c.id,mandatory:true,check:c,...(i===0?{dev_check:all[3]}:{})})),runtime:{identity:{}}};
 // Practice inherits acceptance identity just as the actual core does.
 contract.acceptance[0].dev_check.id=contract.acceptance[0].id;
 const contractRef=write(root,'frozen-capacity-contract.json',contract),contractSha256=hash(canonical(contract));
 const plan=profiles.planPhase({phase,contract,profileId:state.profileId,deadlineAtMs:state.deadlineAtMs});write(root,'admission-plan.json',plan);
 const value={schema:'specflow.backend-job-binding/v1',jobId:inputs.jobId,runId,recipeId:'heystax-supabase-v1',constructionSha256:state.constructionSha256,expectedSemanticSha256:state.expectedSemanticSha256,inputsTemplate:state.template,dependencies:{target:inputs.dependencies.target,expected:inputs.dependencies.receipt},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:hash(profiles.profileBytes(state.profileId)),dependencySource:inputs.dependencySource,deadlineAtMs:state.deadlineAtMs};
 const signed=write(root,'binding.json',{value,mac:store.mac(JSON.parse(canonical(value)))}),authority={scope:'explicit-disposable-profile-298-qualification',contractSha256};
 const cfg={worker:{...bound(inputs.workerConfig),stateRoot:inputs.root,gitArea:null,jobId:inputs.jobId,maxMilliseconds:600000},backendJobBinding:signed,deadlineAtMs:state.deadlineAtMs,authority};
 const authorize=()=>{assert(Date.now()<state.deadlineAtMs,'original_qualification_deadline_expired');assert.equal(hash(fs.readFileSync(contractRef.path)),contractRef.sha256);};
 const token=generation.install(cfg,run,authorize),declaration={recipeId:value.recipeId,expectedSemanticSha256:value.expectedSemanticSha256,constructionSha256:value.constructionSha256};
 const selected=binding.workspace(workspace),refresh=({metadataOnly=false}={})=>{authorize();const current=binding.workspace(workspace);assert.equal(current.sha256,selected.sha256);const m={bindingSha256:signed.sha256,contractSha256,declaration,workspace,contractJSON:JSON.stringify(contract)};return metadataOnly?m:{...m,identity:{workspace:current}};};
 let handle,error,closed;const results=[],timings={},started=Date.now();
 try{
  handle=await generation.open(token,run,phase,refresh);timings.openMilliseconds=Date.now()-started;
  const {session,context,identity,plan:planRef}=generation.access(handle);write(root,'generation-plan.json',fs.readFileSync(planRef.path));
  const t=Date.now(),entry=await runtime.admitBackend(session,context);timings.admitMilliseconds=Date.now()-t;
  generation.retainProof(root,{path:entry.path,sha256:hash(fs.readFileSync(entry.path))});
  runtime.bindBackendProduct(session,context,identity.workspace);
  const envelope=path.dirname(planRef.path),manifest=read(envelope+'/generation-inputs.json');
  const anonKey=read(path.join(envelope,manifest.credentialBinding.path)).anonKey;
  const oracle=path.join(root,'oracle');fs.mkdirSync(oracle,{mode:0o700});
  const files={'inputs/public.json':Buffer.from(JSON.stringify({url:'http://127.0.0.1:54321',anonKey}))};
  const checks=(phase==='baseline'?['check','dev_check']:['check']).flatMap(key=>contract.acceptance.filter(a=>a[key]).map(a=>({...a[key],id:a.id,required:a.mandatory})));
  for(const c of checks){const file=c.execution.test_files[0],config=c.execution.args[1];files[file]=fs.readFileSync(path.join(repo,'tests/e2e/journey_confined_backend.spec.cjs'));files[config]=Buffer.from("module.exports={testDir:__dirname+'/..',testMatch:"+JSON.stringify('**/'+path.basename(file))+",workers:1,retries:0,timeout:45000,use:{launchOptions:{executablePath:process.env.SPECFLOW_BROWSER_EXECUTABLE,args:['--no-sandbox']}}};");}
  for(const [name,bytes]of Object.entries(files))write(oracle,name,bytes);
  const frozenFiles=Object.fromEntries(Object.entries(files).map(([name,b])=>[name,hash(b)]));write(root,'frozen-artifacts.json',frozenFiles);
  generation.selectChecker(handle);runtime.prepareBackendChecks(session,context,{oracleRoot:oracle,frozenFiles,checks});
  await runtime.startBackendServer(session,context);timings.setupMilliseconds=Date.now()-started-timings.openMilliseconds;
  for(const [i,c]of checks.entries()){
   const options={root:workspace,oracleRoot:oracle,runDir:path.join(root,'native-'+i),verificationContract:{contract},configurationId:'confined',environment:'confined-profile-298',env:{BASE_URL:'http://127.0.0.1:3000'},frozenFiles,backendSession:session,backendContext:context};
   const before=Date.now(),receipt=native.executeFrozen(c,options);write(root,'native-receipt-'+i+'.json',Buffer.from(JSON.stringify(receipt)));
   results.push({invocation:i,id:c.id,result:receipt.result,summary:receipt.summary||null,elapsedMilliseconds:Date.now()-before});
   assert(native.ownsFrozen(receipt,c,options.verificationContract,options),'native_receipt_not_owned');
   assert.equal(receipt.result,'pass','capacity_native_journey_failed');assert.equal(receipt.summary.passed,2);assert.equal(receipt.summary.skipped,0);
  }
  const stage=fs.readdirSync(envelope).find(n=>n.startsWith('backend-stage-'));assert(stage);
  const serverKey=read(path.join(envelope,stage,'gateway.json')).consumers.find(c=>c.username==='server').keyauth_credentials[0].key;
  const scanner=require(repo+'/scripts/improve-backend-server.cjs');
  const scans=checks.map((_,i)=>scanner.scanArtifacts(path.join(root,'native-'+i),serverKey));
  scans.push(scanner.scanArtifacts(path.join(envelope,'built/tree/static'),serverKey));write(root,'secret-scan.json',scans);
  const before=Date.now();await runtime.backendContinuity(session,context);timings.continuityMilliseconds=Date.now()-before;
 }catch(e){error=e;}
 const settled=await require(path.join(repo,'tests/qualification/backend-journey-result.cjs')).settle({handle,error,close:generation.close,phase,results});
 closed=settled.closed;error=settled.error;timings.shutdownMilliseconds=settled.shutdownMilliseconds;
 if(closed)write(root,'terminal.json',closed);
 const result={scope:'Repeated real two-width integration workload; runtime capacity/cleanup only, not product improvement',status:settled.status,phase,profileId:state.profileId,deadlineAtMs:state.deadlineAtMs,results,timings,elapsedMilliseconds:Date.now()-started,root,...(error?{cause:settled.cause,observedCause:settled.observedCause,cleanupCause:settled.cleanupCause}:{}),cleanup:closed?.terminal?.state||'unavailable'};
 write(root,'result.json',result);console.log(JSON.stringify(result));if(error)throw error;

}
main().catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message}));process.exitCode=1;});
