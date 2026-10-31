'use strict';
// Version2 assignment/epoch boundary on the existing controller transaction.
const crypto=require('crypto'),m=require('./improve-memory.cjs');
class RecoveryError extends Error{constructor(code){super(code);this.code=code;}}
const need=(v,c)=>{if(!v)throw new RecoveryError(c);};
function shape(v,keys){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k))&&keys.every(k=>Object.hasOwn(v,k)),'invalid_recovery_request');}
const token=m.token,digest=m.digest;
function processIdentity(v){shape(v,['boot_id','pid','start','group']);need(typeof v.boot_id==='string'&&v.boot_id.length<=100&&v.boot_id.length>0&&Number.isSafeInteger(v.pid)&&v.pid>1&&typeof v.start==='string'&&/^\d{1,30}$/.test(v.start)&&Number.isSafeInteger(v.group)&&v.group>1,'invalid_process_identity');return structuredClone(v);}
function assignment(v){shape(v,['principal','holder','revision','process']);need(token(v.principal)&&token(v.holder)&&token(v.revision),'invalid_recovery_assignment');return {...v,process:processIdentity(v.process)};}
const same=(a,b)=>digest(a)===digest(b);
function routes(values){
 need(Array.isArray(values)&&values.length>0&&values.length<=32,'invalid_route_policy');const seen=new Set();
 for(const r of values){shape(r,['role','requested_model','effective_model','billing','cost','maxStarts']);
  need(['builder','oracle','peer','judge'].includes(r.role)&&token(r.requested_model)&&token(r.effective_model)&&['subscription_cli','api','unknown'].includes(r.billing)&&['ordinary','low_cost','expensive','unknown'].includes(r.cost)&&
   (r.maxStarts===null||(Number.isSafeInteger(r.maxStarts)&&r.maxStarts>0&&r.maxStarts<=10000))&&(r.cost!=='expensive'||r.maxStarts!==null),'invalid_route_policy');
  const key=digest([r.role,r.requested_model,r.effective_model,r.billing]);need(!seen.has(key),'invalid_route_policy');seen.add(key);
 }return structuredClone(values);
}
function attach({store,access,ownerPrincipal,now,recovery,applyReceipt,abandonPrebuild}){
 function host(){need(recovery?.format===2&&['resolveAssignment','resolveExecution','resolveSuccessor','resolveProcess','resolveRoute','resolveReceipt','resolveTerminalArchive'].every(k=>typeof recovery[k]==='function'),'recovery_trusted_host_required');return recovery;}
 const enabled=r=>r.policy_version===2;
 const actor=ctx=>{const a=assignment(host().resolveAssignment());need(a.principal===ctx.principal,'recovery_actor_mismatch');return a;};
 function get(s,req,ctx){const r=s.runs[req.run_id];need((!host().scope||host().scope.run_id===req.run_id)&&r&&r.repo_id===req.repo_id&&r.canonical_repo===ctx.profile.repository.path&&
  (r.principal===ctx.principal||r.recovery?.authorised?.principal===ctx.principal||ctx.principal===ownerPrincipal),'recovery_run_unavailable');need(enabled(r)&&r.recovery,'legacy_recovery_unavailable');return r;}
 function admit(r,ctx,policy){
  if(policy.version!==2)return;const a=actor(ctx);need(host().resolveProcess(a.process)==='live','recovery_holder_unavailable');
  r.policy_version=2;r.recovery={generation:0,current:null,authorised:a,routes:routes(policy.routes)};
 }
 function guard(r,ctx,{historical=false,control=false}={}){
  if(!enabled(r))return;
  need(!host().scope||(host().scope.repo_id===r.repo_id&&host().scope.run_id===r.id),'stale_execution_generation');
  const a=actor(ctx);if(control){need((!host().scope&&ctx.principal===ownerPrincipal)||same(a,r.recovery.authorised),'recovery_assignment_mismatch');return;}
  const e=host().resolveExecution();need(e&&Number.isSafeInteger(e.generation),'recovery_generation_required');
  const fixed=assignment({principal:e.principal,holder:e.holder,revision:e.revision,process:e.process});
  need(same(a,fixed)&&same(a,r.recovery.authorised)&&r.recovery.current&&same(a,r.recovery.current.assignment)&&e.generation===r.recovery.generation,'stale_execution_generation');
  if(!historical)need(host().resolveProcess(a.process)==='live','recovery_holder_unavailable');
 }
 function command(req,fields,kind,fn,{owner=false}={}){
  shape(req,['repo_id','run_id','request_id','expected_generation',...fields]);need(token(req.repo_id)&&token(req.run_id)&&token(req.request_id)&&Number.isSafeInteger(req.expected_generation)&&req.expected_generation>=0,'invalid_recovery_request');
  return access(req.repo_id,true,null,ctx=>store.change(s=>{
   const r=get(s,req,ctx),a=actor(ctx);need(!owner||ctx.principal===ownerPrincipal,'recovery_owner_required');
   if(!owner)need(same(a,r.recovery.authorised),'recovery_assignment_mismatch');
   const key=digest([ctx.principal,req.request_id]),input=digest({kind,request:req});
   const old=s.history.find(e=>e.event==='recovery_command'&&e.run_id===r.id&&e.key===key);
   if(old){need(old.input===input,'recovery_idempotency_conflict');return {...structuredClone(old.result),duplicate:true};}
   need(r.recovery.generation===req.expected_generation,'recovery_generation_conflict');
   const result=fn(s,r,ctx,a);s.history.push({event:'recovery_command',run_id:r.id,at_ms:now(),key,input,kind,actor:a,result:structuredClone(result)});return result;
  }));
 }
 function receipt(r,allowed,reason=null){return {allowed,reason_code:reason,run_id:r.id,generation:r.recovery.generation,duplicate:false,
  unresolved:r.operations.filter(o=>o.state==='reserved').map(o=>o.id),next_action:reason==='deadline'?'Reconcile already-issued receipts only; the original work window has ended.':reason?'Inspect the named ownership/operation proof; no protected start is authorised.':'Continue within the original job, authority and work window.'};}
 function resume(req){return command(req,[],'resume',(s,r,ctx,a)=>{
  need(r.profile_revision===ctx.revision,'stale_profile');need(host().resolveProcess(a.process)==='live','recovery_holder_unavailable');
  const old=r.recovery.current;
  if(old&&!same(old.assignment,a)){
   const state=host().resolveProcess(old.assignment.process);if(state!=='dead')return receipt(r,false,state==='live'?'previous_holder_live':'previous_holder_unknown');
   for(const op of r.operations.filter(o=>o.state==='reserved')){
    if(!op.process_identity)return receipt(r,false,'launch_completion_unknown');
    if(host().resolveProcess(op.process_identity)!=='dead')return receipt(r,false,'issued_process_not_quiescent');
   }
   if(r.operations.some(o=>o.state==='reserved'))return receipt(r,false,'reconciliation_required');
  }
  if(!old||!same(old.assignment,a)){r.recovery.generation++;r.recovery.current={generation:r.recovery.generation,assignment:a,at_ms:now()};}
  const reason=r.cancel_requested?'operator_cancelled':now()>=r.deadline_ms?'deadline':r.operations.find(o=>o.state==='reserved'&&o.unknown_reason)?.unknown_reason|| (r.operations.some(o=>o.state==='reserved')?'reconciliation_required':r.reasons[0]||r.last_failure?.reason_code||null);
  r.last_completed_action='ownership:'+r.recovery.generation;return receipt(r,true,reason);
 });}
 function reconcile(req){return command(req,['receipt_id'],'reconcile',(s,r,ctx,a)=>{
  need(token(req.receipt_id),'invalid_receipt_id');
  // Current designated successor may reconcile original issued evidence before
  // claiming a new epoch; no executable or tool is invoked here.
  let sealed;
  try{sealed=host().resolveReceipt(req.receipt_id);}catch(e){
   if(e.code!=='external_completion_unknown'||!e.observation)throw e;
   const observed=e.observation,op=r.operations.find(o=>o.id===observed.binding.operation_id);
   need(op&&same(observed.binding,bindingFor(r,op))&&observed.id===req.receipt_id&&observed.phase==='unknown'&&op.state==='reserved','receipt_binding_mismatch');
   op.unknown_reason='external_completion_unknown';op.local_interruption=observed.result.reason_code;op.observation_seal=observed.seal;
   return receipt(r,false,'external_completion_unknown');
  }
  const op=r.operations.find(o=>o.id===sealed.binding.operation_id);
  need(op&&same(sealed.binding,bindingFor(r,op))&&sealed.id===req.receipt_id,'receipt_binding_mismatch');
  if(op.process_identity)need(host().resolveProcess(op.process_identity)==='dead','issued_process_not_quiescent');
  if(op.state==='complete')need(op.receipt_seal===sealed.seal,'receipt_idempotency_conflict');
  else {applyReceipt(s,r,op,sealed);op.receipt_seal=sealed.seal;}
  clearReconciliation(r);
  r.last_completed_action='receipt:'+sealed.id;
  return receipt(r,true,r.cancel_requested?'operator_cancelled':now()>=r.deadline_ms?'deadline':r.operations.some(o=>o.state==='reserved')?'reconciliation_required':null);
 });}
 function issueExecutionTicket(req){shape(req,['repo_id','run_id']);return access(req.repo_id,true,null,ctx=>store.change(s=>{const r=get(s,req,ctx);guard(r,ctx);need(!host().scope&&host().ticketRoot,'execution_ticket_issuer_required');const result=require('./improve-execution-tickets.cjs').issue({root:host().ticketRoot,registry:host().registry,run:r});if(!s.history.some(e=>e.event==='execution_ticket_issued'&&e.ticket_id===result.id))s.history.push({event:'execution_ticket_issued',run_id:r.id,at_ms:now(),ticket_id:result.id,generation:result.generation});return result;}));}
 function assign(req){need(!host().scope,'scoped_execution_only');return command(req,['principal','holder','assignment_revision'],'assign',(s,r,ctx)=>{
  need(token(req.principal)&&token(req.holder)&&token(req.assignment_revision),'invalid_recovery_assignment');
  const a=assignment(host().resolveSuccessor({principal:req.principal,holder:req.holder,revision:req.assignment_revision}));
  need(a.principal===req.principal&&a.holder===req.holder&&a.revision===req.assignment_revision&&ctx.profile.grants[a.principal]?.includes('execute'),'recovery_successor_unavailable');
  r.recovery.authorised=a;return receipt(r,true);
 },{owner:true});}
 function route(r,ctx,role){
  if(!enabled(r))return true;guard(r,ctx);
  const actual=host().resolveRoute(role);shape(actual,['requested_model','effective_model','billing']);
  const selected=r.recovery.routes.find(g=>g.role===role&&g.requested_model===actual.requested_model&&g.effective_model===actual.effective_model&&g.billing===actual.billing);
  need(selected&&selected.billing==='subscription_cli'&&ctx.profile.routing.usage_mode==='subscription_cli'&&selected.cost!=='unknown','recovery_route_unavailable');
  const key=digest([role,actual.requested_model,actual.effective_model,actual.billing]),consumed=r.operations.filter(o=>o.kind==='provider'&&o.route_key===key).length;
  if(selected.maxStarts!==null&&consumed>=selected.maxStarts){r.route_blocker={role,requested_model:selected.requested_model,effective_model:selected.effective_model,ceiling:selected.maxStarts,consumed};r.reasons=[...new Set([...r.reasons,'route_starts_exhausted'])];return null;}
  return key;
 }
 function bindOperation(r,op,input){if(enabled(r)){need(m.sha(input),'recovery_input_binding_required');op.generation=r.recovery.generation;op.assignment=structuredClone(r.recovery.current.assignment);op.input_sha256=input;}}
 function clearReconciliation(r){if(enabled(r)&&!r.operations.some(o=>o.state==='reserved'&&!(o.kind==='stage'&&o.id===r.active_stage&&o.process_identity&&host().resolveProcess(o.process_identity)==='live')))r.reasons=r.reasons.filter(x=>x!=='reconciliation_required');}
 function bindingFor(r,op){return {run_id:r.id,cycle_id:op.cycle_id,operation_id:op.id,generation:op.generation,principal:op.assignment.principal,repo_id:r.repo_id,profile_revision:r.profile_revision,input_sha256:op.input_sha256};}
 function verifyResult(r,op,result){
  if(!enabled(r))return;
  const sealed=host().resolveReceipt(op.id);need(same(sealed.binding,bindingFor(r,op))&&sealed.phase==='complete','receipt_binding_mismatch');
  need(same(sealed.result,{exit_code:result.exit_code,reason_code:result.reason_code,estimate_usd:result.estimate_usd??null}),'receipt_result_mismatch');return sealed;
 }
 function reconcilePrebuild(req){
  need(!host().scope,'scoped_execution_only');
  return command(req,['cycle_id','reason'],'reconcile_prebuild',(s,r,ctx,a)=>{
   need(host().resolveProcess(a.process)==='live','recovery_holder_unavailable');
   need(token(req.cycle_id)&&typeof req.reason==='string'&&req.reason.trim().length>0&&req.reason.length<=2000,'invalid_recovery_request');
   need(s.owners[r.canonical_repo]===r.id&&r.active_cycle===req.cycle_id,'run_ownership_unavailable');
   need(r.reasons.length>0||r.cancel_requested||now()>=r.deadline_ms,'prebuild_stop_required');
   need(r.recovery.current&&host().resolveProcess(r.recovery.current.assignment.process)==='dead','previous_holder_not_dead');
   need(!r.operations.some(o=>o.state==='reserved'||o.unknown_reason),'reconciliation_required');
   for(const op of r.operations){
    if(op.process_identity)need(host().resolveProcess(op.process_identity)==='dead','issued_process_not_quiescent');
    need(op.receipt_seal,'receipt_binding_mismatch');
    const sealed=host().resolveReceipt(op.id);need(['complete','not_started'].includes(sealed.phase)&&sealed.seal===op.receipt_seal&&same(sealed.binding,bindingFor(r,op)),'receipt_binding_mismatch');
   }
   need(typeof abandonPrebuild==='function','prebuild_reconciliation_unavailable');
   return abandonPrebuild(s,r,ctx,req);
  },{owner:true});
 }
 return {public:{resume,assign,reconcile,reconcilePrebuild,issueExecutionTicket},admit,guard,route,bindOperation,host,bindingFor,verifyResult,clearReconciliation};
}
module.exports={RecoveryError,processIdentity,assignment,routes,attach};
