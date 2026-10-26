'use strict';
const fs=require('fs'),path=require('path');
const {fixture}=require('./improve-controller.cjs'),m=require('../../scripts/improve-memory.cjs'),controller=require('../../scripts/improve-controller.cjs');
function candidateDocument(id='A',hypothesis='Remove redundant confirmation to reduce resume steps') {
  const c={id,title:id,kind:'defect',status:'selected',observation:'The seeded resume flow has duplicate confirmation.',user_impact:'Owners repeat their decision.',mission_relevance:'Fast reliable resumption.',hypothesis,evidence:[{kind:'runtime',ref:'seeded-runtime-observation'}],expected_value:'medium',risk:'low',reversibility:'high',cost:'S',evaluability:{best_level:1,method:'Measured persisted resume steps'}};
  const alt=(id)=>({...c,id,title:id,status:'opportunity',reason:'Not selected for this cycle.'});
  const alternatives=['A','B','C'].filter(other=>other!==id).slice(0,2);
  return {sources:[{kind:'runtime',ref:'fixture'}],candidates:[c,...alternatives.map(alt)],selection:{candidate_id:id,rationale:'Bounded observed defect',outranked:alternatives.map(id=>({id,why:'Later opportunity'}))}};
}
function memoryFixture({initialise=null,affectedPaths=['test.cjs'],configure=null}={}) {
  const f=fixture();if(initialise)initialise(f);f.register();if(configure)configure(f);
  const root=path.join(f.root,'memory-evidence');fs.mkdirSync(root,{mode:0o700});
  let holder='researcher-A',role='researcher',assignment=1;
  const actor=()=>({principal:f.config().resolvePrincipal(),holder,assignment_revision:'assignment-'+assignment,role});
  const memory={required:true,resolveActor:actor,resolveEvidence:m.createFileEvidenceResolver(root)};
  const service=()=>controller.createControllerService({...f.config(),memory});
  const s=service(),admission=s.admit({repo_id:'fixture',request_id:'memory-job'}),req={repo_id:'fixture',run_id:admission.run_id};
  const descriptor={affected_paths:affectedPaths,observable:'resume.steps'};
  const criteria=[{id:'steps',statement:'Resume uses at most two steps'}];
  const task={id:'task-A',experiment_id:'experiment-A',source_revision:'source-1',intent:'Reliable fast resume',criteria_revision:m.digest(criteria),criteria};
  function selection({id='A',hypothesis,observable=descriptor.observable,retry=null,consumed=[]}={}) {
    const doc=candidateDocument(id,hypothesis);
    return {base_ref:'main',base_commit:f.profile.repository.refs[0].commit,task,candidates:doc,
      families:Object.fromEntries(doc.candidates.map(c=>[c.id,{...descriptor,observable:c.id===id?observable:'other.'+c.id}])),
      consumed_observations:consumed,rationale:consumed.length?'Prior evidence changes this choice':'First bounded candidate',retry};
  }
  const command=(extra,id='command-'+Math.random().toString(36).slice(2))=>({...req,request_id:id,expected_revision:service().decisionPack({repo_id:'fixture'}).revision,...extra});
  function seededOutcome(decision='REVERT',valid=true) {
    let saved;
    s.store.change(state=>{
      const r=state.runs[req.run_id],sel=r.memory_selection;
      if(!sel)throw Error('Select before outcome fixture');
      // Protocol fixture only. Real archive/core qualification is a separate test.
      saved=m.append(state,f.repo,r.id,actor(),'outcome',{...sel,decision,base_commit:sel.base_commit,
        retained_commit:null,manifest_sha256:'f'.repeat(64),verification:{valid,category:valid?'none':'verification'},
        experiment_verdict:'needs-change',evidence:[]},f.clock);
      r.memory_selection=null;
      if(decision==='KEEP'){r.reasons=['pending_review'];r.state='stopped';}
    });return saved;
  }
  function evidence(id='observation',changes={}) {
    const doc={version:1,id,repo_id:'fixture',family_key:m.familyKey(f.repo,descriptor),source_revision:task.criteria_revision,
      affected_paths:descriptor.affected_paths,actor:actor(),executed:1,failed:0,skipped:0,exit_code:0,valid:true,failure_category:'none',...changes};
    const source=path.join(f.repo,doc.affected_paths[0]);if(!fs.existsSync(source))fs.writeFileSync(source,JSON.stringify({steps:4}));
    return require('./memory-evidence.cjs').writeCapturedEvidence(root,doc,{sourceFile:source});
  }
  return Object.defineProperties(Object.assign(f,{s,service,req,descriptor,task,selection,command,seededOutcome,evidence,memory,evidenceRoot:root}),{
    holder:{set(value){holder=value;assignment++;}},role:{set(value){role=value;assignment++;}}
  });
}
module.exports={memoryFixture,candidateDocument};
