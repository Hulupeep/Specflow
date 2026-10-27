'use strict';
// Trusted host dispatch over original controller facts. No independent queue/lease or build evaluator.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),proc=require('./improve-process-identity.cjs'),{ServiceError}=require('./improve-service-schema.cjs'),{compileHost}=require('./improve-service-host.cjs');
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),id=()=>crypto.randomUUID();
function createDispatcher(hostFile,{fault=()=>{}}={}){
 const compiled=compileHost(hostFile),owner={principal:compiled.host.ownerPrincipal},service=()=>compiled.controllerFactory(owner),children=new Map();
 // Successor authority is derived from a committed real idle-child identity, never caller fields.
 compiled.recovery.resolveSuccessor=key=>{for(const r of Object.values(service().store.read().runs)){const a=r.service?.dispatch?.assignment;if(a&&a.principal===key.principal&&a.holder===key.holder&&a.revision===key.revision)return structuredClone(a);}throw new ServiceError('recovery_successor_unavailable',503);};
 async function dispatch(req){
  const svc=service(),ref={repo_id:req.repo_id,run_id:req.run_id};let job;
  svc.transitionDispatch(ref,(r,s)=>{
   if(req.control_command){const bound=Object.values(r.service.controls).find(c=>c.original_command.request_id===req.control_command);if(!bound||bound.action!=='resume'||!bound.receipt.allowed||bound.expected_generation!==req.expected_generation)throw new ServiceError('control_binding_mismatch',503);if(r.recovery.generation!==bound.expected_generation)return;}
   if(r.cancel_requested||Date.now()>=r.deadline_ms)return;
   if(r.service.dispatch.state==='complete'||r.reasons.includes('pending_review'))return;
   const d=r.service.dispatch;
   if(d.process&&proc.state(d.process)!=='dead')return;
   if(d.state==='blocked'&&['driver_incomplete','stage_failure','plan_input_changed','runtime_binding_mismatch'].includes(d.reason_code))return;
   if(r.reasons.includes('stage_failure'))return;
   if(d.intent_id&&!d.process){d.state='blocked';d.reason_code='dispatch_launch_unconfirmed';return;}
   // A released dead worker is recoverable only through its original issued receipts.
   if(r.operations.some(o=>o.state==='reserved'&&(o.unknown_reason||!o.process_identity||proc.state(o.process_identity)!=='dead')))return;
   const runtime=require('./improve-service-plans.cjs').validate(r.service.plan,compiled.host);
   const intent=id();r.service.dispatch={...d,state:'pending',intent_id:intent,process:null,assignment:null,expected_generation:r.recovery.generation,binding_revision:d.binding_revision+1,reason_code:null,control_command:req.control_command||null};
   s.history.push({event:'service_dispatch_intent',run_id:r.id,intent_id:intent,at_ms:Date.now(),launcher:proc.identity()});job={run_id:r.id,repo_id:r.repo_id,intent,expected_generation:r.recovery.generation,workerFile:runtime.workerFile};
  });if(!job)return {started:false};
  fault('dispatch_intent_committed',job);
  const child=cp.fork(job.workerFile,[hostFile,req.repo_id,req.run_id,job.intent],{detached:true,stdio:['ignore','ignore','ignore','ipc'],env:require('./improve-worker.cjs').controlledEnvironment()});children.set(child.pid,child);child.on('error',()=>{});child.once('exit',()=>children.delete(child.pid));
  fault('fork_before_ack',{...job,pid:child.pid});
  const identity=proc.identity(child.pid);if(!identity)throw new ServiceError('dispatch_launch_unconfirmed',503);
  const assignment={principal:compiled.host.principal,holder:'worker-'+job.intent,revision:'dispatch-'+job.intent,process:identity};
  svc.transitionDispatch(ref,(r,s)=>{const d=r.service.dispatch;if(d.intent_id!==job.intent||d.process)throw new ServiceError('dispatch_conflict',503);d.process=identity;d.assignment=assignment;d.state='worker_recorded';d.binding_revision++;s.history.push({event:'service_worker_recorded',run_id:r.id,intent_id:job.intent,process:identity,at_ms:Date.now()});});
  fault('worker_recorded',job);
  // Exact original command ids/generation survive lost assign acknowledgement.
  svc.assign({...ref,request_id:'dispatch-assign-'+job.intent,expected_generation:job.expected_generation,principal:assignment.principal,holder:assignment.holder,assignment_revision:assignment.revision});
  fault('assignment_committed',job);
  svc.transitionDispatch(ref,r=>{if(r.service.dispatch.intent_id!==job.intent||!equal(r.service.dispatch.process,identity))throw new ServiceError('dispatch_conflict',503);if(r.cancel_requested||Date.now()>=r.deadline_ms)throw new ServiceError('execution_stopped',503);r.service.dispatch.state='released';r.service.dispatch.binding_revision++;});
  fault('before_release',job);
  child.send({action:'release',intent:job.intent});child.unref();child.channel?.unref();fault('released',job);return {started:true,run_id:req.run_id,pid:child.pid};
 }
 function notify(req){setImmediate(()=>dispatch(req).catch(e=>{try{service().transitionDispatch(req,r=>{if(!r.service.dispatch.process){r.service.dispatch.state='blocked';r.service.dispatch.reason_code=typeof e.code==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(e.code)?e.code:'dispatch_unavailable';r.failed_check||='dispatch:'+r.service.dispatch.reason_code;r.stage='dispatch';}});}catch{}}));}
 function recover(){for(const r of Object.values(service().store.read().runs))if(r.service)notify({repo_id:r.repo_id,run_id:r.id});}
 return {dispatch,notify,recover,service,children};
}
module.exports={createDispatcher};
