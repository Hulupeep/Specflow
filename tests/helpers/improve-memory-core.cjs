'use strict';
// Actual core checks/Git/finalization/archive. Only AI transport is a protocol double.
const fs=require('fs'),path=require('path'),core=require('../../scripts/specflow-improve.cjs'),worker=require('../../scripts/improve-worker.cjs');
const {memoryFixture}=require('./improve-memory.cjs'),m=require('../../scripts/improve-memory.cjs');
const CANARY='PRIVATE_HOLDOUT_AND_PROVIDER_MEMORY_CANARY_182';
function coreFixture({configure=null}={}){return memoryFixture({configure,affectedPaths:['journey.json'],initialise:f=>{
  fs.writeFileSync(path.join(f.repo,'journey.json'),JSON.stringify({steps:4}));f.git('add','journey.json');f.git('commit','-m','seed actual measurement input');
  f.update(p=>{p.repository.refs[0].commit=f.git('rev-parse','HEAD');p.scope.allowed=['journey.json'];});
}});}
const peer=output=>()=>({status:0,stderr:'',stdout:[JSON.stringify({type:'system',subtype:'init',model:'fixture-peer'}),JSON.stringify({type:'result',subtype:'success',structured_output:output,total_cost_usd:0})].join('\n')});
const write=(file,doc)=>{fs.writeFileSync(file,JSON.stringify(doc,null,2)+'\n',{mode:0o600});return file;};
async function executeCycle(f,{number=1,steps=3,id='A',invalid=false,retry=null,consumed=[],afterVerified=null,implementationData=null,stopBeforeBuild=false,generatedOutput=false,prepareFreeze=null,expectedBaseline=null}={}){
  const selection=f.selection({id,retry,consumed});
  const selected=f.service().selectMemory(f.command({selection}));if(!selected.allowed)throw Error(selected.reason_code);
  const binding={job_id:'memory-job-'+number,operation_id:'memory-operation-'+number,core_run_id:'memory-core-'+number};
  const cycle=f.service().reserveCycle({...f.req,binding}).cycle;
  const mission=path.join(f.root,'mission.md');fs.writeFileSync(mission,'Shorten the controlled resume path while preserving its input contract.');
  const {runDir}=core.startRun({target:f.repo,mission,base:'main',runId:binding.core_run_id,stateDir:path.join(f.root,'core'),worktreeRoot:path.join(f.root,'worktrees')});
  core.recordCandidates(runDir,write(path.join(f.root,'candidates-'+number+'.json'),selection.candidates));
  core.critique(runDir,{invokePeer:peer({verdict:'pursue',reselect_to:null,challenges:[],contract_requirements:[],risks:[]})});
  for(const [dir,limit] of [['holdout',2],['dev',3]]){
    fs.mkdirSync(path.join(runDir,dir));fs.writeFileSync(path.join(runDir,dir,'steps.cjs'),
      '// '+CANARY+'\nconst fs=require("fs");'+(generatedOutput?'fs.mkdirSync(process.env.IMPROVE_WORKSPACE+"/baseline-output",{recursive:true});fs.writeFileSync(process.env.IMPROVE_WORKSPACE+"/baseline-output/result.txt","actual check output");':'')+'const data=JSON.parse(fs.readFileSync(process.env.IMPROVE_WORKSPACE+"/journey.json","utf8"));console.log(JSON.stringify({steps:data.steps}));process.exit(data.steps<='+limit+'?0:1);');
  }
  fs.writeFileSync(path.join(runDir,'private-provider.txt'),CANARY,{mode:0o600});
  core.recordOracle(runDir,{role:'evaluator',executor:'protocol-fixture-evaluator',files:['holdout/steps.cjs']});
  const contract={candidate_id:id,observation:'Controlled source has four steps.',user_problem:'Repeated confirmation.',mission_relation:'Fast reliable resume.',hypothesis:selection.candidates.candidates[0].hypothesis,baseline:'four steps',
    acceptance:[{id:f.task.criteria[0].id,statement:f.task.criteria[0].statement,required_level:1,mandatory:true,intent:'gain',baseline_expectation:'fail',dev_baseline_expectation:invalid?'pass':'fail',
      check:{type:'custom-script',level:1,artifact:'holdout/steps.cjs',command:['node','{artifact}']},dev_check:{type:'custom-script',level:1,artifact:'dev/steps.cjs',command:['node','{artifact}']}}],
    non_goals:['No other changes'],evaluation_method:'Fixed independent before/after executable checks',affected_journey:'J-CONTROLLED-RESUME',scope:{allowed_paths:['journey.json'],max_files:1},ux_profile:{preserve:['input shape']},safety:{external_side_effects:'none'},
    gates:[{id:'input-shape',command:['node','-e','const x=JSON.parse(require("fs").readFileSync("journey.json","utf8"));process.exit(Number.isInteger(x.steps)?0:1)']}]};
  if(generatedOutput)contract.runtime={identity:{mutable_outputs:['baseline-output']}};
  const extra=prepareFreeze?prepareFreeze(f,runDir,contract):{};
  const frozen=core.freezeContract(runDir,write(path.join(f.root,'contract-'+number+'.json'),contract),{backendCapability:extra.backendCapability});if(frozen.status!=='frozen')throw Error(JSON.stringify(frozen));
  const baseline=await (extra.verifyBaseline?extra.verifyBaseline():core.verifyPhase(runDir,'baseline'));if(baseline.status!==(expectedBaseline||(invalid?'baseline_blocked':'baseline_recorded')))throw Error(JSON.stringify(baseline));
  if(stopBeforeBuild)return {cycle,binding,runDir,baseline,selection,backendStore:extra.backendStore};
  const builder=write(path.join(f.root,'builder-'+number+'.json'),{id:'fixture-builder',provider:'fake',command:'fake',timeout_seconds:10,max_iterations:1,transcript_path:'unused',output_path:'unused',never_without_human:['git push'],fake_stdout:'Fixture implementation'});
  await core.build(runDir,{policy:builder,acceptBaselineBlocker:invalid?CANARY:undefined,
    invokePeer:peer({direction:{assessment:'complete',goal_connection:'Controlled step reduction',next_steps:[],preserve:['input shape']},recommendation:'keep',reason:'Practice check observed'}),
    afterBuilderRound:workspace=>fs.writeFileSync(path.join(workspace,'journey.json'),JSON.stringify({steps,...(implementationData||{})}))});
  const after=await core.verifyPhase(runDir,'after');if(after.status!=='verified')throw Error(JSON.stringify(after));
  if(afterVerified)await afterVerified({cycle,binding,runDir});
  // Separate successful measurement over the actual candidate bytes, not a
  // fabricated measurement result or a rerun of the deciding holdout.
  const candidateSource=path.join(f.root,'worktrees',binding.core_run_id,'journey.json');
  const observationDoc={version:1,id:'measured-'+number,repo_id:'fixture',family_key:m.familyKey(f.repo,f.descriptor),source_revision:f.task.criteria_revision,affected_paths:f.descriptor.affected_paths,
    actor:{principal:'owner',holder:'independent-measurement',assignment_revision:'measurement-'+number,role:'evaluator'},executed:1,failed:0,skipped:0,exit_code:0,valid:true,failure_category:'none'};
  const evidence=require('./memory-evidence.cjs').writeCapturedEvidence(f.evidenceRoot,observationDoc,{sourceFile:candidateSource});
  const decision=core.evaluate(runDir);const applied=core.finalize(runDir);
  if(decision.decision==='KEEP')f.git('bundle','create',path.join(runDir,'retained.bundle'),applied.branch);
  const archive=new worker.DurableStore({root:path.join(f.root,'archive-'+number),sourceRoot:runDir});
  const meta={...binding,principal:'owner',repo_id:'fixture',profile_revision:f.revision};const receipt=archive.commit(meta,runDir);
  return {cycle,binding,runDir,decision,applied,archive,receipt,evidence,selection};
}
module.exports={coreFixture,executeCycle,CANARY};
