'use strict';
// Real signed binding/capability and subprocess attempt history. No Docker,
// backend services or browser checks execute; a missing worker image causes the
// actual blocked baseline. Attempts are created by that baseline invocation.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const core=require('../../scripts/specflow-improve.cjs'),generation=require('../../scripts/improve-backend-generation.cjs');
const {DurableStore}=require('../../scripts/improve-worker.cjs'),{RECIPE}=require('../../scripts/improve-backend.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),digest='a'.repeat(64);
function prepareFreeze(f,runDir,contract,{kind='cleaned'}={}){
 const root=path.join(f.root,'managed-protocol');fs.mkdirSync(root,{mode:0o700});
 const store=new DurableStore({root:path.join(root,'store'),sourceRoot:root});
 const write=(name,value)=>{const file=path.join(root,name),bytes=canonical(value);fs.writeFileSync(file,bytes,{mode:0o600});return{path:file,sha256:sha(bytes)};};
 const profileBytes=require('../../scripts/improve-backend-profiles.cjs').profileBytes('heystax-backend-journeys-v1');fs.writeFileSync(path.join(root,'profile'),profileBytes,{mode:0o600});
 const ref=name=>({path:name,sha256:digest}),profile={path:path.join(root,'profile'),sha256:sha(profileBytes)},jobId='managed-job',runId=JSON.parse(fs.readFileSync(path.join(runDir,'run.json'))).run_id;
 const template={schema:'specflow.backend-inputs/v1',jobId,recipeId:RECIPE.id,images:RECIPE.images,migrationRevision:RECIPE.migrationRevision,migrations:RECIPE.migrations,migrationRoot:'migrations',bootstrap:ref('bootstrap'),supabaseCli:ref('cli'),seed:ref('seed'),credentialBinding:ref('credentials'),runtimeLayer:ref('layer'),configuration:ref('configuration'),resourceProfile:{path:'profile',sha256:profile.sha256},expectedState:{schemaSha256:digest,tablesSha256:digest,sequencesSha256:digest,migrationHistorySha256:digest}};
 const dependencySource={packageSha256:digest,lockSha256:digest,manifestSha256:digest};
 const value={schema:'specflow.backend-job-binding/v1',jobId,runId,recipeId:RECIPE.id,constructionSha256:digest,expectedSemanticSha256:digest,inputsTemplate:write('inputs.json',template),dependencies:{target:path.join(root,'deps'),expected:{identity:{jobId,sourceContainerId:digest,recipeSha256:digest,sourceInputSha256:sha(canonical(dependencySource))},manifestSha256:digest}},sourceRecipeSha256:generation.sourceRecipeSha256,resourceProfileSha256:profile.sha256,dependencySource,deadlineAtMs:Date.now()+2000000};
 const config={worker:{jobId,stateRoot:store.root},deadlineAtMs:value.deadlineAtMs,authority:{repo_id:'fixture',revision:1},backendJobBinding:write('binding.json',{value,mac:store.mac(JSON.parse(canonical(value)))})};
 const artifact='holdout/native.test.js',configFile='holdout/playwright.config.cjs';
 fs.writeFileSync(path.join(runDir,artifact),"const {test,expect}=require('@playwright/test');test('required',()=>expect(4).toBeLessThanOrEqual(2));\n");
 fs.writeFileSync(path.join(runDir,configFile),'module.exports={};\n');
 core.recordOracle(runDir,{role:'evaluator',executor:'managed-recovery-protocol-fixture',files:[artifact,configFile]});
 const check=contract.acceptance[0].check;delete check.command;delete contract.acceptance[0].dev_check;contract.gates=[];
 Object.assign(check,{artifact,verification_level:'integration',boundaries:['network','database'],configuration_ids:['confined'],checker_paths:[artifact,configFile],input_paths:[],rule_paths:[],execution:{adapter:'playwright',test_files:[artifact],required_case_ids:['default::'+artifact+'::required'],optional_case_ids:[],args:['--config',configFile]}});
 contract.runtime={configuration_id:'confined',backend:{recipeId:RECIPE.id,constructionSha256:digest,expectedSemanticSha256:digest}};
 const backendConfigPath=write('config.json',config).path;
 const verifyBaseline=()=>{
  const program=`const fs=require('fs'),a=require(${JSON.stringify(require.resolve('../../scripts/improve-backend-attempt.cjs'))}),g=require(${JSON.stringify(require.resolve('../../scripts/improve-backend-generation.cjs'))}),core=require(${JSON.stringify(require.resolve('../../scripts/specflow-improve.cjs'))});const cfg=JSON.parse(fs.readFileSync(process.argv[1])),runDir=process.argv[2];if(${kind==='inert'}){const begin=a.begin;a.begin=(s,input)=>{const ref=begin(s,input);try{begin(s,input);}catch(e){if(e.message!=='backend_attempt_active')throw e;}return ref;};}if(${kind==='missing_release'}){const open=fs.openSync;fs.openSync=(p,...args)=>{if(String(p).includes('/release-')){console.log(JSON.stringify({status:'interrupted',fixtureCut:'before-signed-release'}));process.exit(23);}return open(p,...args);};}const capability=g.install(cfg,runDir,()=>{});core.verifyPhase(runDir,'baseline',{backendCapability:capability}).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exitCode=1;});`;
  const r=cp.spawnSync(process.execPath,['-e',program,backendConfigPath,runDir],{encoding:'utf8',timeout:20000});
  if(r.status!==(kind==='missing_release'?23:0))throw Error('Managed baseline fixture: '+r.stderr);
  return JSON.parse(r.stdout.trim());
 };
 return {backendCapability:generation.install(config,runDir,()=>{}),backendStore:store,verifyBaseline};
}
module.exports={prepareFreeze};
