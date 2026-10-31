'use strict';
// Owner-host projection only: archived decisions, current retained Git and memory.
const fs=require('fs'),path=require('path'),cp=require('child_process'),m=require('./improve-memory.cjs');
function report({r,ctx,now,host,memory,view,verifyTerminalArchive,ownsRepo}){
 const code=[],verification=[];
 for(const cycle of r.cycles.filter(c=>c.state==='terminal')){
  let row={cycle_id:cycle.id,decision:cycle.decision,retained_commit:null,available:false,retained:false,base_commit:null,criteria:[],gains:[],regressions:[],risks:[],reason_code:null},valid=false;
  try{
   const store=host.resolveTerminalArchive(cycle.binding.job_id);
   if(!(store instanceof require('./improve-worker.cjs').DurableStore))throw Error('archive_unavailable');
   const proof=verifyTerminalArchive(store,{...cycle.binding,principal:r.principal,repo_id:r.repo_id,profile_revision:r.profile_revision},r.canonical_repo);
   if(proof.manifest_sha256!==cycle.manifest_sha256||proof.decision!==cycle.decision)throw Error('archive_binding_mismatch');
   const entry=proof.files.find(f=>f.path==='decision.json'),d=JSON.parse(fs.readFileSync(path.join(store.root,'blobs',entry.sha256)));
   valid=!d.baseline_blocker&&!d.binding_errors?.length&&!(Array.isArray(d.holdout_exposed)?d.holdout_exposed.length:d.holdout_exposed);
   row={...row,available:true,retained_commit:proof.retained_commit,base_commit:proof.base_commit,criteria:d.criteria||[],gains:d.gains||[],regressions:d.regressions||[],risks:[...(d.gates_missing||[]),...(d.reasons||[])]};
   if(row.decision==='KEEP'&&/^[a-f0-9]{40}$/.test(row.retained_commit||'')&&/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(d.workspace?.branch||'')){
    const git=args=>cp.execFileSync('/usr/bin/git',['-C',r.canonical_repo,...args],{encoding:'utf8',timeout:10000,maxBuffer:65536,stdio:['ignore','pipe','pipe'],env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null'}}).trim();
    try{row.retained=git(['rev-parse','--verify',d.workspace.branch+'^{commit}'])===row.retained_commit&&git(['rev-parse',row.retained_commit+'^{tree}'])===d.workspace.verified_git?.tree;}catch{row.retained=false;}
   }
  }catch(e){row.reason_code=m.token(e.code||e.message)?e.code||e.message:'archive_unavailable';}
  code.push(row);verification.push({cycle_id:cycle.id,available:row.available,valid:row.available&&valid});
 }
 const gains=code.filter(c=>c.available&&c.retained&&c.decision==='KEEP'&&c.gains.length&&c.gains.every(g=>g.established)&&verification.find(v=>v.cycle_id===c.cycle_id)?.valid);
 const unresolved=[...r.operations.filter(o=>o.state==='reserved').map(o=>o.id),...(r.active_cycle?[r.active_cycle]:[])];
 const established=gains.length>0&&ctx.revision===r.profile_revision&&!unresolved.length;
 const missing=code.some(c=>!c.available);
 const issued=r.operations.filter(o=>o.state==='reserved');
 const running=issued.length>0&&issued.every(o=>o.process_identity&&host.resolveProcess(o.process_identity)==='live');
 const ready=ownsRepo&&!issued.length&&!r.reasons.length&&!r.cancel_requested&&now<r.deadline_ms&&r.recovery.current&&host.resolveProcess(r.recovery.current.assignment.process)==='live';
 const holderState=r.recovery.current?host.resolveProcess(r.recovery.current.assignment.process):'dead';
 const queued=r.service?.dispatch?.state==='pending'&&!r.recovery.current&&!r.operations.length&&!r.active_cycle;
 const holderLost=!queued&&ownsRepo&&!issued.length&&!r.reasons.length&&!r.cancel_requested&&now<r.deadline_ms&&(r.active_cycle||view.remaining.cycles===null||view.remaining.cycles>0)&&holderState!=='live';
 const holderReason=holderState==='unknown'?'previous_holder_unknown':'recovery_holder_unavailable';
 const knownStageFailure=!issued.length&&r.reasons.includes('stage_failure');
 const dispatchBlocked=!issued.length&&r.service?.dispatch?.state==='blocked'?r.service.dispatch.reason_code||'dispatch_blocked':null;
 const unknown=r.operations.find(o=>o.state==='reserved'&&o.unknown_reason)?.unknown_reason;
 const reason=unknown|| (r.cancel_requested?'operator_cancelled':now>=r.deadline_ms?'deadline':knownStageFailure?'stage_failure':dispatchBlocked?dispatchBlocked:holderLost?holderReason:running?'work_running':ready?(r.active_cycle?'cycle_in_progress':'ready_for_next_cycle'):unresolved.length?'reconciliation_required':missing?'terminal_evidence_unavailable':r.reasons.includes('pending_review')&&!established?'retained_state_unverified':view.reason_code||(queued?'awaiting_dispatch':!established?'improvement_not_established':'pending_review'));
 const next=unknown?{owner:'owner',action:'The original provider outcome is unknown. No automatic resolution is available; the repository remains held. Decide a safe audited disposition without repeating the call.',reason_code:reason}:
  knownStageFailure?{owner:'owner',action:'All operations are complete; there are no uncertain receipts to resolve. No automatic resume is available. The repository remains held until an authorised audited repair of '+(r.failed_check||'the recorded stage failure')+'.',reason_code:reason}:
  dispatchBlocked?{owner:'agent',action:'Inspect the original dispatch, process and operation evidence for '+dispatchBlocked+'; do not create a new job or repeat uncertain work.',reason_code:reason}:
  holderLost?{owner:'agent',action:'Verify the original holder is positively dead, then claim the same job through resume within its original work window; do not repeat issued work.',reason_code:reason}:
  !unknown&&running&&!r.cancel_requested&&now<r.deadline_ms?{owner:'agent',action:'Monitor the original issued work and its authenticated receipt; start no replacement call.',reason_code:reason}:
  !unknown&&ready?{owner:'agent',action:r.active_cycle?'Continue the original cycle at its next unconsumed checkpoint.':'Select the next evidence-backed opportunity within the original remaining window.',reason_code:reason}:
  unresolved.length?{owner:'agent',action:'Reconcile the original operation receipts and terminal archive without repeating uncertain work.',reason_code:reason}:
  missing?{owner:'agent',action:'Restore and authenticate the original terminal evidence before requesting a proposal decision.',reason_code:reason}:
  r.reasons.includes('pending_review')&&!established?{owner:'agent',action:'Revalidate the retained proposal and exact verified Git tree before requesting review.',reason_code:reason}:
  r.reasons.includes('pending_review')&&established?{owner:'owner',action:'Review the authenticated retained proposal and accept or reject its baseline.',reason_code:'pending_review'}:
  {owner:'agent',action:!ownsRepo?'Use the preserved completed result; any further work requires a new authorised job.':r.cancel_requested||now>=r.deadline_ms?'Finish the evidence-backed report and reconcile delivery; start no new protected work.':'Continue the authorised job from its current verified checkpoint within the original work window.',reason_code:reason};
 const facts={version:2,kind:'controller-report',run_id:r.id,report_id:r.id,repo_id:r.repo_id,profile_revision:r.profile_revision,
  claim:established?'Verified retained local improvement: '+gains.flatMap(c=>c.criteria.filter(a=>a.status==='satisfied'&&a.mandatory).map(a=>a.statement)).join('; '):'improvement not established',established,code_results:code,verification_results:verification,
  experiment_results:(memory?.outcomes||[]).map(o=>({outcome_id:o.id,verdict:o.experiment_verdict})),memory_revision:memory?.revision||null,
  stage:r.stage,last_completed_action:r.last_completed_action,failed_check:r.failed_check||null,review_retries:structuredClone(r.review_retries||[]),operations_complete:issued.length===0,lifecycle:knownStageFailure||dispatchBlocked?'blocked':holderLost?'interrupted':unresolved.length?(r.cancel_requested?'cancelling':running||ready?'running':'interrupted'):ready?'running':code.length?'completed':r.cancel_requested?'cancelled':r.reasons.length||now>=r.deadline_ms?'blocked':'queued',repo_owned:ownsRepo,unresolved,original_limits:r.limits,deadline_ms:r.deadline_ms,window_ended:now>=r.deadline_ms,cancel_requested:r.cancel_requested,
  consumed:{cycles:r.consumed_cycles,terminal_cycles:r.terminal_cycles,attempts:r.consumed_attempts,consecutive_no_progress:r.no_progress},
  usage:{mode:'subscription_cli',attempts:r.consumed_attempts,estimates_usd:r.estimates.length?r.estimates.reduce((n,e)=>n+e.usd,0):null,actual_charges_usd:null},
  reason_code:reason,reasons:view.reasons,next_action:next,activation:'recovery_required'};
 const delivery=require('./improve-delivery-projection.cjs').project(r.service?.delivery);if(!delivery)return {...facts,revision:m.digest(facts),remaining:view.remaining};
 const execution_revision=m.digest(facts),next_action=delivery.blocker&&facts.operations_complete&&!r.active_cycle?delivery.blocker.next_action:facts.next_action;return {...facts,execution_revision,execution_next_action:facts.next_action,next_action,delivery,revision:m.digest({...facts,delivery}),remaining:view.remaining};
}
module.exports={report};
