'use strict';
// Executed in a child with an isolated PATH. Native executables and accepted
// runner state are explicitly simulated; actual command planning, persistence,
// gate re-entry and boundary rejection are the system under test.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const source=process.argv[2],root=process.cwd(),runtime=process.argv[3];
const runner=require(path.join(source,'scripts/specflow-runner.cjs')),spec=require(path.join(source,'scripts/specflow-specification.cjs')),yaml=require(path.join(source,'node_modules/js-yaml'));
const supplied=require(path.join(source,'tests/helpers/spec-density.js')).fixture(root);
const record=JSON.parse(fs.readFileSync(supplied.tier_record));
const routing=path.join(root,'.specflow/adapter-routing.yml'),profile=yaml.load(fs.readFileSync(routing,'utf8'));
const policyProvider=runtime==='codex'?'codex-exec':'claude-print';
const rows=[];
fs.writeFileSync('verify-artifact.cjs',`const fs=require('fs');const [file,stage]=process.argv.slice(2);const x=JSON.parse(fs.readFileSync(file));if(x.stage!==stage||x.simulated!==true||x.value!==42)process.exit(1);`);
function saved(loop,stage){
 const contract=path.join(root,loop+'-run.yaml'),ledger=path.join(root,loop+'-ledger.jsonl');
 fs.writeFileSync(contract,yaml.dump({run_contract:{...supplied,loop,goal:'Isolated simulated host path mechanics',input_artifact:'supplied runner fixture, not live readiness',path:path.join(source,'templates/loops',loop+'.yaml'),current_stage_or_rail:stage,next_gate:'owning gate',durable_evidence:[contract,ledger],stop_condition:'human CI handoff',never_without_human:['git push','open PR','merge','--no-verify','override contract'],storage:{contract_path:contract,ledger_path:ledger}}}));
 return {loop,contract,ledger,adapterRouting:routing,confirmModels:true};
}
for(const [loop,routes] of Object.entries(profile.routes))for(const [stage,route]of Object.entries(routes)){
 const options=saved(loop,stage),artifact=path.join(root,loop+'-'+stage+'.json');
 process.env.PROTOCOL_STAGE=stage;process.env.PROTOCOL_ARTIFACT=artifact;delete process.env.PROTOCOL_FAIL;
 if(stage==='adversary'){
   const before=fs.existsSync('argv.jsonl')?fs.readFileSync('argv.jsonl','utf8'):'';
   assert.equal(runner.runLoop(options).status,'scoped_review_required');
   assert.equal(fs.existsSync('argv.jsonl')?fs.readFileSync('argv.jsonl','utf8'):'',before);
   // Qualify only this policy's command construction. The actual scoped gate
   // above remains blocked; a generic verifier label cannot approve it.
   const p=runner.normalizeAdapterPolicy(profile.policies[route.policy],{slug:'protocol-role'});
   p.prompt='Persist the explicitly simulated role artifact';
   assert.equal(runner.runAdapter(p,{cwd:root,env:{...process.env},stage}).status,'gate_rerun_required');
   rows.push({loop,stage,provider:p.provider,transition:'scoped_gate_blocked',simulated:true});continue;
 }
 if(stage==='5_review'){
   // This supplied-state fixture has no Git subject or real native peer. The
   // dedicated advisory journeys qualify its actual frozen protocol separately.
   const review=runner.runLoop({...options,advisorySimulation:true});assert.equal(review.status,'advisory_recorded');
   assert.equal(review.entry.advisory_review.clean,false);assert.equal(review.entry.gate_decision,'pending');
   rows.push({loop,stage,provider:policyProvider,transition:'6_provenance',simulated:true});continue;
 }
 if(stage==='5_impl'){
   process.env.PROTOCOL_FAIL='1';const failed=runner.runLoop(options);assert.equal(failed.status,'adapter_failed');
   assert.equal(yaml.load(fs.readFileSync(options.contract,'utf8')).run_contract.current_stage_or_rail,stage);
   if(failed.adapterResult?.discoveryBatch)spec.collect(root,record,failed.adapterResult.discoveryBatch,{outcome:'failed',discoveries:[]});
   // The batch is exposed on adapterResult in some runner surfaces and on the
   // durable journal in all of them. Collect each actual outstanding fixture batch.
   for(const b of Object.values(require(path.join(source,'scripts/specflow-reviews.cjs')).load(root,record.issue.number).batches||{}))if(b.collection!=='reported')spec.collect(root,record,b.id,{outcome:'failed',discoveries:[]});
   delete process.env.PROTOCOL_FAIL;
 }
 const run=runner.runLoop(options);assert.equal(run.status,'gate_rerun_required');
 assert.equal(yaml.load(fs.readFileSync(options.contract,'utf8')).run_contract.current_stage_or_rail,stage);
 assert.equal(JSON.parse(fs.readFileSync(artifact)).stage,stage);
 for(const b of Object.values(require(path.join(source,'scripts/specflow-reviews.cjs')).load(root,record.issue.number).batches||{}))if(b.collection!=='reported')spec.collect(root,record,b.id,{outcome:'success',discoveries:[]});
 const evidence=path.join(root,'stage-'+stage+'.yml');
 fs.writeFileSync(evidence,yaml.dump({stage_evidence:{schema_version:1,stage,artifacts:[{path:artifact,sha256:crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex')}],checks:[{name:'actual-persisted-role-artifact',command:`${JSON.stringify(process.execPath)} ${JSON.stringify(path.join(root,'verify-artifact.cjs'))} ${JSON.stringify(artifact)} ${JSON.stringify(stage)}`} ]}}));
 const gate=runner.runLoop({...options,stageEvidence:evidence});assert.equal(gate.status,'gate_passed');
 rows.push({loop,stage,provider:policyProvider,transition:yaml.load(fs.readFileSync(options.contract,'utf8')).run_contract.current_stage_or_rail,simulated:true});
}
const handoff=runner.runLoop(saved('feature-build','7_ci_handoff'));assert.equal(handoff.status,'human_ci_handoff_required');
const b5=runner.runLoop(saved('spec-build','GATE_B5'));assert.equal(b5.status,'scoped_review_required');
assert(rows.every(r=>r.provider===policyProvider));
console.log(JSON.stringify({rows,handoff:handoff.status,scoped:b5.status,simulated:true,productionReady:false}));
