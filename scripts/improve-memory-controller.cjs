'use strict';
// Extensions share the controller transaction and authority gateway; no executor.
const cp=require('child_process'),m=require('./improve-memory.cjs');
function git(repo,args) {
  const r=cp.spawnSync('/usr/bin/git',['--no-optional-locks','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-C',repo,...args],{
    encoding:'utf8',timeout:10000,maxBuffer:1024*1024,
    env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',GIT_TERMINAL_PROMPT:'0'}});
  m.need(r.status===0,'memory_baseline_unavailable');return r.stdout.trim();
}
function attach({store,access,ownerPrincipal,now,memory,guardWrite=()=>{}}) {
  if(memory)m.need(memory.required===true&&typeof memory.resolveActor==='function'&&typeof memory.resolveEvidence==='function','memory_trusted_host_required');
  const who=ctx=>{m.need(memory,'memory_host_unavailable');return m.actor(memory.resolveActor(),ctx.principal);};
  const rows=(s,r)=>m.events(s,r.canonical_repo);
  // Registration sealed the canonical identity. Historical reads must not follow
  // a replacement symlink or require a removed checkout to exist.
  const canonical=ctx=>ctx.profile.repository.path;
  function base(ctx,value) {
    m.shape(value,['ref','commit']);
    m.need(ctx.profile.repository.refs.some(r=>r.name===value.ref&&r.commit===value.commit),'memory_baseline_not_registered');
    m.need(git(canonical(ctx),['rev-parse','--verify','--end-of-options',value.ref+'^{commit}'])===value.commit,'memory_stale_baseline');
    return value;
  }
  function owned(s,req,ctx,owner=false) {
    const r=s.runs[req.run_id];
    m.need(r&&r.repo_id===req.repo_id&&r.canonical_repo===canonical(ctx)&&
      (r.principal===ctx.principal||(r.policy_version===2&&r.recovery.authorised.principal===ctx.principal)||(owner&&ctx.principal===ownerPrincipal)),'memory_run_unavailable');
    m.need(r.memory_required===true,'memory_not_enabled');guardWrite(r,ctx,{historical:true,control:owner});return r;
  }
  function command(req,allowed,fn,owner=false) {
    m.shape(req,['repo_id','run_id','request_id','expected_revision',...allowed]);
    return access(req.repo_id,true,null,ctx=>store.change(s=>{
      const r=owned(s,req,ctx,owner),actor=who(ctx);
      if(owner)m.need(ctx.principal===ownerPrincipal,'memory_owner_required');
      const previous=m.priorCommand(s,r.canonical_repo,actor,req);if(previous)return previous;
      return fn(s,r,ctx,actor);
    }));
  }
  function decisionPack(req) {
    m.shape(req,['repo_id']);
    return access(req.repo_id,false,null,ctx=>m.pack(store.read(),canonical(ctx),req.repo_id));
  }
  function equivalence(all,key) {
    const group=new Set([key]);let changed=true;
    while(changed){changed=false;for(const e of all)if(e.kind==='command'&&e.data.type==='resolution'&&e.data.action==='alias_family'){
      const a=e.data.family_key,b=e.data.alias_family;if(group.has(a)||group.has(b))for(const k of [a,b])if(!group.has(k)){group.add(k);changed=true;}
    }}return group;
  }
  function selectedData(selection,ctx) {
    m.shape(selection,['base_ref','base_commit','task','candidates','families','consumed_observations','rationale','retry']);
    m.need(Buffer.byteLength(m.canonical(selection))<=256*1024&&m.text(selection.rationale),'memory_capacity');
    base(ctx,{ref:selection.base_ref,commit:selection.base_commit});
    m.shape(selection.task,['id','experiment_id','source_revision','intent','criteria_revision','criteria']);
    const t=selection.task;
    m.need(m.token(t.id)&&m.token(t.experiment_id)&&m.text(t.source_revision,120)&&m.text(t.intent)&&m.sha(t.criteria_revision)&&
      Array.isArray(t.criteria)&&t.criteria.length>0&&t.criteria.length<=12&&new Set(t.criteria.map(c=>c.id)).size===t.criteria.length,'invalid_memory_task');
    for(const c of t.criteria){m.shape(c,['id','statement']);m.need(m.token(c.id)&&m.text(c.statement),'invalid_memory_task');}
    m.need(m.digest(t.criteria)===t.criteria_revision,'memory_criteria_revision_mismatch');
    const checked=require('./specflow-improve.cjs').validateCandidates(selection.candidates);
    m.need(checked.ok&&selection.candidates.candidates.length<=32,'invalid_memory_candidates');
    const ids=selection.candidates.candidates.map(c=>c.id);
    m.need(ids.every(m.token),'invalid_memory_candidates');
    m.shape(selection.families,ids);
    for(const key of ids)m.family(selection.families[key]);
    m.need(Array.isArray(selection.consumed_observations)&&selection.consumed_observations.length<=32&&
      selection.consumed_observations.every(m.sha)&&new Set(selection.consumed_observations).size===selection.consumed_observations.length,'invalid_memory_citations');
    const descriptor=m.family(selection.families[checked.selected.id]);
    return {task:structuredClone(t),family:descriptor,family_key:m.familyKey(canonical(ctx),descriptor),
      base_ref:selection.base_ref,base_commit:selection.base_commit,candidate_digest:m.digest(selection.candidates),
      selected:{id:checked.selected.id,title:checked.selected.title.slice(0,2000),hypothesis:checked.selected.hypothesis.slice(0,2000)},
      alternatives:selection.candidates.candidates.filter(c=>c.id!==checked.selected.id).map(c=>({id:c.id,title:c.title.slice(0,2000),status:c.status,reason:(c.reason||'').slice(0,2000)})),
      consumed_observations:selection.consumed_observations,rationale:selection.rationale};
  }
  function selectMemory(req) {
    return command(req,['selection'],(s,r,ctx,actor)=>{
      m.need(r.policy_version!==2||s.owners[r.canonical_repo]===r.id,'memory_run_not_owned');
      m.need(r.profile_revision===ctx.revision&&!r.active_cycle&&!r.operations.some(o=>o.state==='reserved'),'memory_selection_unavailable');
      const data=selectedData(req.selection,ctx),all=rows(s,r),group=equivalence(all,data.family_key);
      m.need(!all.some(e=>e.data.task?.experiment_id===data.task.experiment_id&&
        e.data.task.criteria_revision!==data.task.criteria_revision),'memory_fixed_criteria_conflict');
      m.need(data.consumed_observations.every(id=>all.some(e=>e.hash===id)),'memory_citation_unavailable');
      const prior=all.filter(e=>group.has(e.data.family_key)&&((e.kind==='command'&&e.data.type==='selection'&&e.data.result.allowed)||e.kind==='outcome'));
      const pending=prior.find(e=>e.kind==='outcome'&&e.data.decision==='KEEP'&&!all.some(x=>x.data.type==='resolution'&&x.data.outcome_id===e.hash&&['reject_idea','retry_with_new_evidence','accept_baseline'].includes(x.data.action)));
      let evidence=[],reason=pending?'pending_review':prior.length?'memory_equivalent_attempt':null;
      if(req.selection.retry!==null){
        m.shape(req.selection.retry,['reason','evidence']);m.need(m.text(req.selection.retry.reason),'invalid_memory_retry');
        evidence=m.resolveEvidence(memory,req.selection.retry.evidence,{repoId:r.repo_id,familyKey:data.family_key,paths:data.family.affected_paths,observable:data.family.observable});
        const previous=all.filter(e=>group.has(e.data.family_key)&&
          (e.kind==='outcome'||(e.data.type==='selection'&&e.data.result.allowed))).flatMap(e=>e.data.evidence||[]).filter(e=>e.actor);
        m.need(previous.every(e=>m.sha(e.observation_key)),'memory_legacy_observation_reconciliation_required');
        const previousKeys=new Set(previous.map(e=>e.observation_key));
        m.need(evidence.some(e=>!previousKeys.has(e.observation_key)),'memory_no_new_relevant_evidence');
        if(!pending)reason=null;
      }
      const lastResolution=all.filter(e=>e.data.type==='resolution'&&group.has(e.data.family_key)&&e.data.action!=='alias_family').at(-1);
      if(lastResolution?.data.action==='reject_idea')reason='memory_owner_rejected';
      if(lastResolution?.data.action==='retry_with_new_evidence'&&
        !lastResolution.data.evidence.some(a=>evidence.some(b=>a.observation_key===b.observation_key)))reason='memory_owner_retry_evidence_required';
      if(r.reasons.includes('pending_review'))reason='pending_review';
      const result={allowed:reason===null,reason_code:reason,evidence_ids:evidence.map(e=>e.id)};
      const receipt=m.finishCommand(s,r.canonical_repo,r.id,actor,req,'selection',{...data,evidence,retry_reason:req.selection.retry?.reason||null},result,now());
      if(result.allowed)r.memory_selection={...data,receipt_id:receipt.id,revision:receipt.revision,actor};
      return receipt;
    });
  }
  function outcome(all,id) {const e=all.find(e=>e.hash===id&&e.kind==='outcome');m.need(e,'memory_outcome_unavailable');return e;}
  function resolveMemory(req) {
    return command(req,['outcome_id','action','reason','source_revision','evidence','baseline','alias_family'],(s,r,ctx,actor)=>{
      m.need(['reject_idea','retry_with_new_evidence','accept_baseline','alias_family'].includes(req.action)&&m.text(req.reason)&&m.text(req.source_revision,120),'invalid_memory_resolution');
      m.need(!r.active_cycle&&!r.operations.some(o=>o.state==='reserved'),'memory_resolution_unavailable');
      const all=rows(s,r),old=outcome(all,req.outcome_id),target=s.runs[old.run_id];
      m.need(target&&target.canonical_repo===r.canonical_repo&&!target.active_cycle&&!target.operations.some(o=>o.state==='reserved'),'memory_resolution_unavailable');
      let evidence=[];
      if(req.action==='retry_with_new_evidence')evidence=m.resolveEvidence(memory,req.evidence,{repoId:r.repo_id,familyKey:old.data.family_key,paths:old.data.family.affected_paths,observable:old.data.family.observable});
      else m.need(Array.isArray(req.evidence)&&req.evidence.length===0,'invalid_memory_resolution');
      if(req.action==='accept_baseline'){
        const accepted=base(ctx,req.baseline);m.need(old.data.retained_commit,'memory_retained_commit_unavailable');
        const retainedTree=git(r.canonical_repo,['rev-parse',old.data.retained_commit+'^{tree}']);
        m.need(git(r.canonical_repo,['rev-parse',accepted.commit+'^{tree}'])===retainedTree,'memory_retained_baseline_mismatch');
      }else m.need(req.baseline===null,'invalid_memory_resolution');
      if(req.action==='alias_family')m.need(m.sha(req.alias_family)&&all.some(e=>e.data.family_key===req.alias_family),'memory_alias_unavailable');
      else m.need(req.alias_family===null,'invalid_memory_resolution');
      const result={allowed:true,reason_code:null,evidence_ids:evidence.map(e=>e.id)};
      const receipt=m.finishCommand(s,r.canonical_repo,r.id,actor,req,'resolution',{outcome_id:old.hash,family_key:old.data.family_key,
        action:req.action,reason:req.reason,source_revision:req.source_revision,evidence,baseline:req.baseline,alias_family:req.alias_family},result,now());
      if(req.action!=='alias_family'&&target.reasons.includes('pending_review')){
        target.reasons=target.reasons.filter(v=>v!=='pending_review');target.state='stopped';
        target.last_completed_action='memory-resolution:'+receipt.id;
        if(s.owners[target.canonical_repo]===target.id)delete s.owners[target.canonical_repo];
      }
      return receipt;
    },true);
  }
  function observeMemory(req) {
    return command(req,['outcome_id','source_revision','evidence','observation'],(s,r,ctx,actor)=>{
      const old=outcome(rows(s,r),req.outcome_id);m.need(m.text(req.source_revision,120),'invalid_memory_observation');
      const o=req.observation;let evidence=[];
      if(o?.kind==='proposal'){
        m.shape(o,['kind','state']);m.need(['pending_delivery','open','merged','closed_unmerged','unknown'].includes(o.state)&&Array.isArray(req.evidence)&&req.evidence.length===0,'invalid_memory_observation');
      }else{
        m.shape(o,['kind','verdict','criteria_revision','rationale']);
        m.need(o.kind==='experiment'&&['proven','disproven','needs-change'].includes(o.verdict)&&actor.role!=='builder'&&m.text(o.rationale)&&
          o.criteria_revision===old.data.task.criteria_revision,'invalid_memory_verdict');
        if(o.verdict!=='needs-change'){
          evidence=m.resolveEvidence(memory,req.evidence,{repoId:r.repo_id,familyKey:old.data.family_key,paths:old.data.family.affected_paths,observable:old.data.family.observable});
          m.need(evidence.every(e=>e.source_revision===o.criteria_revision),'memory_experiment_revision_mismatch');
        }
        else m.need(Array.isArray(req.evidence)&&req.evidence.length===0,'invalid_memory_evidence');
      }
      return m.finishCommand(s,r.canonical_repo,r.id,actor,req,'observation',{outcome_id:old.hash,family_key:old.data.family_key,
        source_revision:req.source_revision,observation:structuredClone(o),evidence},{allowed:true,reason_code:null,evidence_ids:evidence.map(e=>e.id)},now());
    });
  }
  function beforeCycle(s,r,ctx) {
    if(!r.memory_required)return;
    who(ctx);m.need(r.memory_selection&&r.memory_selection.revision===m.revision(s,r.canonical_repo),'memory_selection_required');
    base(ctx,{ref:r.memory_selection.base_ref,commit:r.memory_selection.base_commit});
  }
  function bindCycle(s,r,c) {if(r.memory_required)c.memory_selection=structuredClone(r.memory_selection);}
  function beforeStage(s,r,stage,requireValidation=true) {
    if(!r.memory_required)return;
    const c=r.cycles.find(c=>c.id===r.active_cycle);m.need(memory&&c?.memory_selection,'memory_selection_required');
    if(['recordCandidates','critique','freezeContract'].includes(stage))m.need(c.memory_selection.revision===m.revision(s,r.canonical_repo),'memory_stale_pack');
    if(requireValidation){m.need(c.memory_validated?.stage===stage&&c.memory_validated.selection_id===c.memory_selection.receipt_id,'memory_stage_binding_required');c.memory_validated=null;}
  }
  function terminal(s,r,c,proof,ctx) {
    if(!r.memory_required)return;
    const selection=c.memory_selection;m.need(selection&&proof.base_commit===selection.base_commit&&proof.candidate_digest===selection.candidate_digest,'memory_terminal_selection_mismatch');
    const valid=!proof.core_diagnosis.baseline_blocker&&!proof.core_diagnosis.holdout_exposed&&!proof.core_diagnosis.binding_errors.length;
    m.append(s,r.canonical_repo,r.id,who(ctx),'outcome',{...selection,cycle_id:c.id,core_run_id:c.binding.core_run_id,
      manifest_sha256:proof.manifest_sha256,decision:proof.decision,base_commit:proof.base_commit,retained_commit:proof.retained_commit,
      contract_revision:proof.contract_revision,verification:{valid,category:valid?'none':'verification'},experiment_verdict:'needs-change',
      evidence:[{id:c.binding.job_id,sha256:proof.manifest_sha256}]},now());
    r.memory_selection=null;
  }
  function validateMemoryStage(req,value) {
    m.shape(req,['repo_id','run_id','cycle_id','stage']);
    m.shape(value,['core_run_id','base_commit','candidate_digest','criteria_revision']);
    return access(req.repo_id,true,null,ctx=>store.change(s=>{
      const r=s.runs[req.run_id];m.need(r&&r.repo_id===req.repo_id&&(r.principal===ctx.principal||(r.policy_version===2&&r.recovery.authorised.principal===ctx.principal))&&r.profile_revision===ctx.revision,'memory_run_unavailable');
      guardWrite(r,ctx,{historical:true});
      m.need(r.policy_version!==2||s.owners[r.canonical_repo]===r.id,'memory_run_not_owned');
      if(!r.memory_required)return {required:false};
      beforeStage(s,r,req.stage,false);const c=r.cycles.find(c=>c.id===req.cycle_id),selected=c?.memory_selection;
      m.need(selected&&value.core_run_id===c.binding.core_run_id&&value.base_commit===selected.base_commit,'memory_core_binding_mismatch');
      if(req.stage!=='startRun')m.need(value.candidate_digest===selected.candidate_digest,'memory_candidate_digest_mismatch');
      if(req.stage==='freezeContract')m.need(value.criteria_revision===selected.task.criteria_revision,'memory_criteria_revision_mismatch');
      c.memory_validated={stage:req.stage,selection_id:selected.receipt_id};
      return {required:true,selection:structuredClone(selected),pack:m.pack(s,r.canonical_repo,r.repo_id)};
    }));
  }
  function summary(s,r) {
    const all=rows(s,r),outcomes=all.filter(e=>e.run_id===r.id&&e.kind==='outcome');
    return {version:1,support:'structural_family_guard_and_cited_selection',revision:m.revision(s,r.canonical_repo),
      outcomes:outcomes.map(e=>({id:e.hash,code_decision:e.data.decision,verification:e.data.verification,
        experiment_verdict:all.filter(x=>x.data.outcome_id===e.hash&&x.data.observation?.kind==='experiment').at(-1)?.data.observation.verdict||e.data.experiment_verdict})),
      limitations:['advisory_untrusted','no_general_semantic_similarity_or_autonomous_learning_claim','KEEP_is_not_demand_or_revenue_proof']};
  }
  return {public:{decisionPack,selectMemory,resolveMemory,observeMemory,validateMemoryStage},beforeCycle,bindCycle,beforeStage,terminal,summary};
}
module.exports={attach};
