'use strict';
// Pre-freeze fixture execution of independently authored product checks.
// Records native failures honestly; grants no baseline, freeze or product verdict.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const repo=path.resolve(__dirname,'../..'),w=require(repo+'/scripts/improve-worker.cjs'),production=require(repo+'/scripts/improve-production-build.cjs');
const generation=require(repo+'/scripts/improve-backend-generation.cjs'),runtime=require(repo+'/scripts/improve-backend-runtime.cjs'),native=require(repo+'/scripts/test-execution.cjs');
const binding=require(repo+'/scripts/improve-binding.cjs'),profiles=require(repo+'/scripts/improve-backend-profiles.cjs');
const canonical=production.canonical,hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>w.strictJSON(fs.readFileSync(p).toString());
const bound=ref=>{const b=fs.readFileSync(ref.path);assert.equal(hash(b),ref.sha256);return w.strictJSON(b.toString());};
function write(root,name,value){const b=Buffer.isBuffer(value)?value:Buffer.from(canonical(value)),file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,b,{flag:'wx',mode:0o600});return{path:file,sha256:hash(b)};}
async function main(){
 const state=read(process.argv[2]),phase='baseline',draftFile=process.argv[3],oracleSource=process.argv[4];assert(draftFile&&oracleSource);assert.equal(state.profileId,'heystax-backend-journeys-v2');
 const inputs=read(state.inputs),root=fs.mkdtempSync(path.join(state.root,phase+'-'));fs.chmodSync(root,0o700);
 const runId='prefreeze-fixture-'+phase+'-'+crypto.randomUUID(),run=path.join(root,'run');fs.mkdirSync(run,{mode:0o700});write(run,'run.json',{run_id:runId});
 const store=new w.DurableStore({root:inputs.root,sourceRoot:inputs.root}),workspace=path.join(inputs.source.target,'tree');
 const contract=read(draftFile);
 // Fail missing fixture inputs before allocating the expensive backend.
 for(const a of contract.acceptance)for(const k of ['check','dev_check'])if(a[k])for(const name of [...a[k].checker_paths,...(a[k].input_paths||[]),...(a[k].rule_paths||[])]){
  assert(!path.isAbsolute(name)&&name.split('/').every(x=>x&&x!=='.'&&x!=='..'));
  let isFile=false;try{isFile=fs.statSync(path.join(oracleSource,name)).isFile();}catch{}
  if(!isFile)throw Error('oracle_input_not_file');
 }

 const contractRef=write(root,'unfrozen-check-inventory.json',contract),contractSha256=hash(canonical(contract));
 const plan=profiles.planPhase({phase,contract,profileId:state.profileId,deadlineAtMs:state.deadlineAtMs});write(root,'admission-plan.json',plan);
 const value={schema:'specflow.backend-job-binding/v1',jobId:inputs.jobId,runId,recipeId:'heystax-supabase-v1',constructionSha256:state.constructionSha256,expectedSemanticSha256:state.expectedSemanticSha256,inputsTemplate:state.template,dependencies:{target:inputs.dependencies.target,expected:inputs.dependencies.receipt},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:hash(profiles.profileBytes(state.profileId)),dependencySource:inputs.dependencySource,deadlineAtMs:state.deadlineAtMs};
 const signed=write(root,'binding.json',{value,mac:store.mac(JSON.parse(canonical(value)))}),authority={scope:'explicit-prefreeze-fixture-validation-no-product-verdict',contractSha256};
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
  const envelope=path.dirname(planRef.path),oracle=path.join(root,'oracle');fs.mkdirSync(oracle,{mode:0o700});
  const checks=['check','dev_check'].flatMap(key=>contract.acceptance.filter(a=>a[key]).map(a=>({...a[key],id:a.id,required:a.mandatory})));
  const files={};
  for(const c of checks)for(const name of [...c.checker_paths,...(c.input_paths||[]),...(c.rule_paths||[])]){assert(!path.isAbsolute(name)&&name.split('/').every(x=>x&&x!=='.'&&x!=='..'));files[name]=fs.readFileSync(path.join(oracleSource,name));}
  for(const [name,bytes]of Object.entries(files))write(oracle,name,bytes);
  const frozenFiles=Object.fromEntries(Object.entries(files).map(([name,b])=>[name,hash(b)]));write(root,'frozen-artifacts.json',frozenFiles);
  generation.selectChecker(handle);runtime.prepareBackendChecks(session,context,{oracleRoot:oracle,frozenFiles,checks});
  await runtime.startBackendServer(session,context);timings.setupMilliseconds=Date.now()-started-timings.openMilliseconds;
  for(const [i,c]of checks.entries()){
   const options={root:workspace,oracleRoot:oracle,runDir:path.join(root,'native-'+i),verificationContract:{contract},configurationId:'confined',environment:'confined-prefreeze-fixture',env:{BASE_URL:'http://127.0.0.1:3000'},frozenFiles,backendSession:session,backendContext:context};
   const before=Date.now(),receipt=native.executeFrozen(c,options);write(root,'native-receipt-'+i+'.json',Buffer.from(JSON.stringify(receipt)));
   results.push({invocation:i,id:c.id,result:receipt.result,summary:receipt.summary||null,elapsedMilliseconds:Date.now()-before});
   // Read cumulative kernel denials after each invocation, before cleanup can
   // remove the cgroup. This captures denials missed by periodic sampling.
   const cp=require('child_process');
   const docker=args=>cp.execFileSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,env:{PATH:'/usr/bin:/bin',HOME:inputs.root,DOCKER_CONFIG:path.join(inputs.root,'docker-config')}});
   const ids=docker(['ps','-q','--filter','label=specflow.worker=owned']).trim().split('\n').filter(Boolean);
   const matched=[];
   for(const id of ids){
    const inspected=JSON.parse(docker(['inspect',id]))[0];
    if(inspected.Mounts.some(m=>m.Destination==='/oracle'&&m.Source.startsWith(envelope+'/'))){
     const group=fs.readFileSync('/proc/'+inspected.State.Pid+'/cgroup','utf8').trim().split('::')[1];
     assert(group?.startsWith('/'),'unified_cgroup_required');
     const base='/sys/fs/cgroup'+group;
     const events=Object.fromEntries(fs.readFileSync(base+'/pids.events','utf8').trim().split('\n').map(line=>line.split(' ')));
     matched.push({invocation:i,endpoint:'unix:///var/run/docker.sock',scope:'checker cgroup only; ancestor limits not measured',pidsLimit:inspected.HostConfig.PidsLimit,current:Number(fs.readFileSync(base+'/pids.current','utf8')),peak:Number(fs.readFileSync(base+'/pids.peak','utf8')),denied:Number(events.max)});
    }
   }
   write(root,'checker-kernel-'+i+'.json',matched);
   assert.equal(matched.length,1,'exact_checker_required');assert.equal(matched[0].pidsLimit,256);assert.equal(matched[0].denied,0,'checker_kernel_task_denial');
   assert(native.ownsFrozen(receipt,c,options.verificationContract,options),'native_receipt_not_owned');
   assert(receipt.summary&&typeof receipt.summary==='object','native_summary_missing');
   assert.equal(receipt.summary.collected,c.execution.required_case_ids.length,'fixture_case_inventory_changed');assert.equal(receipt.summary.skipped,0);assert.equal(receipt.summary.flaky,0);
  }
  const stage=fs.readdirSync(envelope).find(n=>n.startsWith('backend-stage-'));assert(stage);
  const serverKey=read(path.join(envelope,stage,'gateway.json')).consumers.find(c=>c.username==='server').keyauth_credentials[0].key;
  const scanner=require(repo+'/scripts/improve-backend-server.cjs');
  const scans=checks.map((_,i)=>scanner.scanArtifacts(path.join(root,'native-'+i),serverKey));
  scans.push(scanner.scanArtifacts(path.join(envelope,'built/tree/static'),serverKey));write(root,'secret-scan.json',scans);
  const before=Date.now();await runtime.backendContinuity(session,context);timings.continuityMilliseconds=Date.now()-before;
 }catch(e){error=e;closed=e.backendGeneration||null;}
 let cleanupError=null;const shutdown=Date.now();
 try{if(handle)closed=await generation.close(handle,error?.code||error?.message||null);}catch(e){cleanupError=e;}
 timings.shutdownMilliseconds=Date.now()-shutdown;
 if(closed)write(root,'terminal.json',closed);
 const cleanupConfirmed=closed?.terminal?.state==='cleaned'&&closed?.terminal?.credentialEnvelopeRemoved===true&&closed?.backendTerminal?.phase==='cleaned'&&closed?.backendTerminal?.cause===null;
 if(!cleanupConfirmed&&!cleanupError)cleanupError=Error('backend_cleanup_unconfirmed');
 const result={scope:'Pre-freeze oracle fixture validation only. Native outcomes require inspection for intended assertions; this is not a core baseline, accepted contract, product verdict or permission to implement.',status:error||cleanupError?'failed':'observed',phase,profileId:state.profileId,deadlineAtMs:state.deadlineAtMs,results,timings,elapsedMilliseconds:Date.now()-started,root,cause:error?.code||error?.message||null,cleanupCause:cleanupError?.code||cleanupError?.message||null,cleanupConfirmed};
 write(root,'result.json',result);console.log(JSON.stringify(result));if(error||cleanupError)throw error||cleanupError;

}
main().catch(e=>{console.error(JSON.stringify({status:'failed',cause:e.code||e.message}));process.exitCode=1;});
