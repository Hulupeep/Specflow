'use strict';
// Extension of the SAME controller transaction. No queue lease, execution loop or replacement recovery store.
const crypto=require('crypto'),m=require('./improve-memory.cjs');
function attach({store,access,admitIn,cancelIn,now,need,serviceBinding,ownerPrincipal,scoped,canControl}){
 const hash=v=>crypto.createHash('sha256').update(m.canonical(v)).digest('hex');
 function admitTask(req,actor){
  need(!scoped,'scoped_execution_only');
  need(serviceBinding&&typeof serviceBinding.resolvePlan==='function','service_plan_registry_required');
  need(req&&m.token(req.repo_id)&&m.token(req.request_id)&&req.task&&['task_id','experiment_id'].every(k=>m.token(req.task[k]))&&['source_revision','contract_revision'].every(k=>/^[a-f0-9]{40,64}$/.test(req.task[k])),'invalid_request');
  return access(req.repo_id,true,null,ctx=>store.change(s=>{
   need(actor&&actor.principal===ctx.principal&&['credential_id','role_id','holder','assignment_revision'].every(k=>m.token(actor[k])),'service_actor_mismatch');
   const input=hash(req),key='service-start-'+hash([ctx.principal,ctx.profile.repository.path,req.request_id]),old=s.requests[key];
   if(old){need(old.kind==='service_start'&&old.input_sha256===input,'idempotency_conflict');return {...structuredClone(old),duplicate:true};}
   const taskKey='service-task-'+hash([ctx.principal,ctx.profile.repository.path,req.task.task_id,req.task.experiment_id]),claim=s.requests[taskKey];
   if(claim)need(claim.kind==='service_task'&&hash(claim.task)===hash(req.task),'task_revision_conflict');
   let admitted,plan;
   if(claim){need(s.runs[claim.run_id]?.repo_id===req.repo_id,'service_task_corrupt');admitted={allowed:true,run_id:claim.run_id,reason_code:null};}
   else{
    try{plan=serviceBinding.resolvePlan(req.task,ctx);}catch(e){need(false,['plan_preparation_required','worker_unqualified','plan_binding_mismatch'].includes(e.code)?e.code:'plan_unavailable');}
    need(plan&&plan.repo_id===req.repo_id&&plan.profile_revision===ctx.revision&&hash(plan.task)===hash(req.task),'plan_binding_mismatch');
    admitted=admitIn(s,{repo_id:req.repo_id,request_id:'service-'+hash([ctx.principal,req.request_id])},ctx,false);
    if(admitted.allowed){const r=s.runs[admitted.run_id];need(r.policy_version===2,'recovery_store_required');
     const planHash=hash(plan);r.service={version:1,task:structuredClone(req.task),origin_actor:structuredClone(actor),plan:structuredClone(plan),plan_sha256:planHash,dispatch:{state:'pending',binding_revision:1,plan_sha256:planHash,process:null},controls:{}};
     s.requests[taskKey]={kind:'service_task',principal:ctx.principal,repo_id:req.repo_id,task:structuredClone(req.task),run_id:r.id,plan_sha256:planHash};
    }
   }
   const receipt={kind:'service_start',principal:ctx.principal,repo_id:req.repo_id,request_id:req.request_id,input_sha256:input,run_id:admitted.run_id||null,accepted:Boolean(admitted.allowed),reason_code:admitted.reason_code||null,actor:structuredClone(actor)};
   s.requests[key]=receipt;s.history.push({event:'service_admission',run_id:receipt.run_id,at_ms:now(),actor:structuredClone(actor),duplicate_task:Boolean(claim)});return {...structuredClone(receipt),duplicate:Boolean(claim)};
  }));
 }
 function owned(s,req,ctx){const r=s.runs[req.run_id];need(r&&r.repo_id===req.repo_id&&r.principal===ctx.principal&&r.service,'run_unavailable');return r;}
 function serviceControl(req,actor){
  need(!scoped,'scoped_execution_only');need(req&&['cancel','resume'].includes(req.action)&&m.token(req.request_id)&&m.token(req.run_id),'invalid_request');
  return access(req.repo_id,false,null,ctx=>store.change(s=>{
   need(ctx.principal===ownerPrincipal&&actor.principal===ctx.principal&&canControl(req.repo_id),'authority_revoked');
   const r=owned(s,req,ctx),key=hash([ctx.principal,req.request_id]),input=hash(req),previous=r.service.controls[key];
   if(previous){need(previous.input_sha256===input,'idempotency_conflict');return structuredClone(previous.receipt);}
   const command={repo_id:req.repo_id,run_id:req.run_id,request_id:'service-control-'+key,expected_generation:r.recovery.generation};
   if(req.action==='cancel')cancelIn(s,r,ctx);
   const reason=req.action==='cancel'?'operator_cancelled':r.cancel_requested?'operator_cancelled':now()>=r.deadline_ms?'deadline':r.reasons[0]||r.operations.find(o=>o.state==='reserved'&&o.unknown_reason)?.unknown_reason||r.service.dispatch.reason_code||'resume_requested';
   const receipt={allowed:req.action==='cancel'||reason==='resume_requested',run_id:r.id,request_id:req.request_id,command_id:command.request_id,expected_generation:command.expected_generation,reason_code:reason};
   r.service.controls[key]={kind:'service_control',principal:ctx.principal,repo_id:r.repo_id,run_id:r.id,request_id:req.request_id,action:req.action,input_sha256:input,original_command:command,expected_generation:command.expected_generation,state:'complete',receipt,actor:structuredClone(actor)};
   s.history.push({event:'service_control',run_id:r.id,at_ms:now(),action:req.action,command:structuredClone(command),actor:structuredClone(actor)});return structuredClone(receipt);
  }));
 }
 function transitionDispatch(req,transition){
  need(!scoped&&typeof transition==='function','scoped_execution_only');
  return access(req.repo_id,false,null,ctx=>store.change(s=>{need(ctx.principal===ownerPrincipal,'authority_revoked');const r=owned(s,req,ctx);const result=transition(r,s,ctx);need(!result||typeof result.then!=='function','synchronous_transition_required');return result;}));
 }
 return {admitTask,serviceControl,transitionDispatch};
}
module.exports={attach};
