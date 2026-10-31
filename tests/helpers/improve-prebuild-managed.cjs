'use strict';
// Real signed binding/capability and subprocess attempt history. No Docker,
// backend services or browser checks execute; missing execution authority is the
// actual blocked baseline. These fixtures test the controller recovery bridge.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const core=require('../../scripts/specflow-improve.cjs'),generation=require('../../scripts/improve-backend-generation.cjs');
const {DurableStore}=require('../../scripts/improve-worker.cjs'),{RECIPE,PROFILE}=require('../../scripts/improve-backend.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),digest='a'.repeat(64);
function prepareFreeze(f,runDir,contract){
 const root=path.join(f.root,'managed-protocol');fs.mkdirSync(root,{mode:0o700});
 const store=new DurableStore({root:path.join(root,'store'),sourceRoot:root});
 const write=(name,value)=>{const file=path.join(root,name),bytes=canonical(value);fs.writeFileSync(file,bytes,{mode:0o600});return{path:file,sha256:sha(bytes)};};
 const ref=name=>({path:name,sha256:digest}),profile=write('profile',PROFILE),jobId='managed-job',runId=JSON.parse(fs.readFileSync(path.join(runDir,'run.json'))).run_id;
 const template={schema:'specflow.backend-inputs/v1',jobId,recipeId:RECIPE.id,images:RECIPE.images,migrationRevision:RECIPE.migrationRevision,migrations:RECIPE.migrations,migrationRoot:'migrations',bootstrap:ref('bootstrap'),supabaseCli:ref('cli'),seed:ref('seed'),credentialBinding:ref('credentials'),runtimeLayer:ref('layer'),configuration:ref('configuration'),resourceProfile:{path:'profile',sha256:profile.sha256},expectedState:{schemaSha256:digest,tablesSha256:digest,sequencesSha256:digest,migrationHistorySha256:digest}};
 const dependencySource={packageSha256:digest,lockSha256:digest,manifestSha256:digest};
 const value={schema:'specflow.backend-job-binding/v1',jobId,runId,recipeId:RECIPE.id,constructionSha256:digest,expectedSemanticSha256:digest,inputsTemplate:write('inputs.json',template),dependencies:{target:path.join(root,'deps'),expected:{identity:{jobId,sourceContainerId:digest,recipeSha256:digest,sourceInputSha256:sha(canonical(dependencySource))},manifestSha256:digest}},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:profile.sha256,dependencySource,deadlineAtMs:Date.now()+60000};
 const config={worker:{jobId,stateRoot:store.root},deadlineAtMs:value.deadlineAtMs,authority:{repo_id:'fixture',revision:1},backendJobBinding:write('binding.json',{value,mac:store.mac(JSON.parse(canonical(value)))})};
 const artifact='holdout/native.test.js',configFile='holdout/playwright.config.cjs';
 fs.writeFileSync(path.join(runDir,artifact),"const {test,expect}=require('@playwright/test');test('required',()=>expect(4).toBeLessThanOrEqual(2));\n");
 fs.writeFileSync(path.join(runDir,configFile),'module.exports={};\n');
 core.recordOracle(runDir,{role:'evaluator',executor:'managed-recovery-protocol-fixture',files:[artifact,configFile]});
 const check=contract.acceptance[0].check;delete check.command;delete contract.acceptance[0].dev_check;contract.gates=[];
 Object.assign(check,{artifact,verification_level:'integration',boundaries:['network','database'],configuration_ids:['confined'],checker_paths:[artifact,configFile],input_paths:[],rule_paths:[],execution:{adapter:'playwright',test_files:[artifact],required_case_ids:['default::'+artifact+'::required'],optional_case_ids:[],args:['--config',configFile]}});
 contract.runtime={configuration_id:'confined',backend:{recipeId:RECIPE.id,constructionSha256:digest,expectedSemanticSha256:digest}};
 return {backendCapability:generation.install(config,runDir,()=>{}),backendStore:store};
}
function history(store,runDir,kind){
 const runId=JSON.parse(fs.readFileSync(path.join(runDir,'run.json'))).run_id,contractSha256=core.governingContract(runDir).entry.contract_sha256;
 const input={jobId:'managed-job',runId,phase:'baseline',contractSha256,constructionSha256:digest,authoritySha256:digest,deadlineAtMs:Date.now()+10000};
 const program=`const fs=require('fs'),w=require(${JSON.stringify(require.resolve('../../scripts/improve-worker.cjs'))}),a=require(${JSON.stringify(require.resolve('../../scripts/improve-backend-attempt.cjs'))});const s=new w.DurableStore({root:process.argv[1],sourceRoot:process.argv[1]}),input=${JSON.stringify(input)},ref=a.begin(s,input);if(${kind==='inert'}){try{a.begin(s,input);}catch(e){if(e.message!=='backend_attempt_active')throw e;}}a.envelope(s,ref);a.seal(s,ref);if(${kind==='missing_release'}){const open=fs.openSync;fs.openSync=(p,...args)=>{if(String(p).includes('/release-'))process.exit(0);return open(p,...args);};}a.finish(s,ref,{cause:'backend_qualification_failed',backendTerminalSha256:null,productReceiptSha256:null});`;
 const result=cp.spawnSync(process.execPath,['-e',program,store.root],{encoding:'utf8',timeout:15000});if(result.status!==0)throw Error('Managed recovery fixture failed: '+result.stderr);
}
module.exports={prepareFreeze,history};
