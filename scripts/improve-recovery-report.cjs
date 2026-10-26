'use strict';
// Owner-host projection only: archived decisions, current retained Git and memory.
const fs=require('fs'),path=require('path'),cp=require('child_process'),m=require('./improve-memory.cjs');
function report({r,ctx,now,host,memory,view,verifyTerminalArchive}){
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
 const reason=unresolved.length?'reconciliation_required':missing?'terminal_evidence_unavailable':r.reasons.includes('pending_review')&&!established?'retained_state_unverified':view.reason_code||(!established?'improvement_not_established':'pending_review');
 const next=unresolved.length?{owner:'agent',action:'Reconcile the original operation receipts and terminal archive without repeating uncertain work.',reason_code:reason}:
  missing?{owner:'agent',action:'Restore and authenticate the original terminal evidence before requesting a proposal decision.',reason_code:reason}:
  r.reasons.includes('pending_review')&&!established?{owner:'agent',action:'Revalidate the retained proposal and exact verified Git tree before requesting review.',reason_code:reason}:
  r.reasons.includes('pending_review')&&established?{owner:'owner',action:'Review the authenticated retained proposal and accept or reject its baseline.',reason_code:'pending_review'}:
  {owner:'agent',action:r.cancel_requested||now>=r.deadline_ms?'Finish the evidence-backed report and reconcile delivery; start no new protected work.':'Continue the authorised job from its current verified checkpoint within the original work window.',reason_code:reason};
 const facts={version:2,kind:'controller-report',run_id:r.id,report_id:r.id,repo_id:r.repo_id,profile_revision:r.profile_revision,
  claim:established?'Verified retained local improvement: '+gains.flatMap(c=>c.criteria.filter(a=>a.status==='satisfied'&&a.mandatory).map(a=>a.statement)).join('; '):'improvement not established',established,code_results:code,verification_results:verification,
  experiment_results:(memory?.outcomes||[]).map(o=>({outcome_id:o.id,verdict:o.experiment_verdict})),memory_revision:memory?.revision||null,
  unresolved,original_limits:r.limits,deadline_ms:r.deadline_ms,window_ended:now>=r.deadline_ms,cancel_requested:r.cancel_requested,
  consumed:{cycles:r.consumed_cycles,terminal_cycles:r.terminal_cycles,attempts:r.consumed_attempts,consecutive_no_progress:r.no_progress},
  usage:{mode:'subscription_cli',attempts:r.consumed_attempts,estimates_usd:r.estimates.length?r.estimates.reduce((n,e)=>n+e.usd,0):null,actual_charges_usd:null},
  reason_code:reason,reasons:view.reasons,next_action:next,activation:'recovery_required'};
 return {...facts,revision:m.digest(facts),remaining:view.remaining};
}
module.exports={report};
