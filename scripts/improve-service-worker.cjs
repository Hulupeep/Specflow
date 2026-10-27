'use strict';
// An inert owner-host child until the committed assignment is released. Native work remains in #217 stages.
const {ServiceError}=require('./improve-service-errors.cjs');
const fs=require('fs'),path=require('path'),proc=require('./improve-process-identity.cjs'),{createControllerService}=require('./improve-controller.cjs'),{compileHost}=require('./improve-service-host.cjs');
function main(args=process.argv.slice(2)){
const [hostFile,repo_id,run_id,intent]=args,req={repo_id,run_id};let released=false;
const compiled=compileHost(hostFile),host=compiled.host,actual=proc.identity();
// Assignment may not yet have been recorded; reread it only on release and bind to this real process.
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b),command=(r,request_id,extra={})=>({...req,request_id,expected_generation:r.recovery.generation,...extra});
process.once('disconnect',()=>{if(!released)process.exit(0);});
const idle=setTimeout(()=>{if(!released)process.exit(0);},10000);
process.once('message',async message=>{
 if(message?.action!=='release'||message.intent!==intent)return process.exit(2);released=true;clearTimeout(idle);
 let execution=null,actor;
 const make=scope=>createControllerService({root:host.store,registry:host.registry,resolvePrincipal:()=>host.principal,ownerPrincipal:host.ownerPrincipal,hostCapabilities:()=>host.host,memory:compiled.memoryFor(()=>actor),recovery:{...compiled.recovery,scope,resolveAssignment:()=>structuredClone(actor),resolveExecution:()=>execution?structuredClone(execution):null}});
 try{
  const run=compiled.controllerFactory({principal:host.principal}).store.read().runs[run_id],d=run.service.dispatch;
  if(d.intent_id!==intent||d.state!=='released'||!same(d.process,actual)||!same(d.assignment,run.recovery.authorised))throw new ServiceError('stale_dispatch',503);
  actor=structuredClone(d.assignment);const admin=make(undefined);
  for(const op of run.operations.filter(o=>o.state==='reserved').sort((a,b)=>(a.kind==='stage')-(b.kind==='stage'))){
   const result=admin.reconcile(command(run,'dispatch-receipt-'+intent+'-'+op.id,{receipt_id:op.id}));if(!result.allowed)throw new ServiceError(result.reason_code,503);
  }
  const claim=admin.resume({...req,request_id:d.control_command||'dispatch-resume-'+intent,expected_generation:d.expected_generation});
  if(!claim.allowed||claim.reason_code)throw new ServiceError(claim.reason_code||'resume_blocked',503);
  execution={...actor,generation:claim.generation};if(host.recovery.issueTicketsTo)admin.issueExecutionTicket(req);
  const {driver,runtimeRoot}=require('./improve-service-plans.cjs').load(run.service.plan,host);
  await driver.run({service:make(req),request:req,plan:structuredClone(run.service.plan),runtimeRoot,host:structuredClone(host),generation:claim.generation});
  admin.transitionDispatch(req,r=>{if(r.service.dispatch.intent_id!==intent||r.recovery.generation!==claim.generation||!same(r.recovery.current?.assignment,actor))throw new ServiceError('stale_execution_generation',503);if(!r.terminal_cycles&&!r.reasons.includes('no_safe_work'))throw new ServiceError('driver_incomplete',503);if(r.operations.some(o=>o.state==='reserved')||r.active_cycle)throw new ServiceError('reconciliation_required',503);r.service.dispatch.state='complete';r.service.dispatch.binding_revision++;});
 }catch(e){
  try{compiled.controllerFactory({principal:host.principal}).transitionDispatch(req,r=>{if(r.service.dispatch.intent_id===intent&&same(r.service.dispatch.process,actual)){r.service.dispatch.state='blocked';r.service.dispatch.reason_code=typeof e.code==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(e.code)?e.code:'driver_failed';r.failed_check||='dispatch:'+r.service.dispatch.reason_code;if(!r.active_cycle)r.stage='dispatch';r.service.dispatch.binding_revision++;}});}catch{}
  process.exitCode=2;
 }finally{if(process.connected)process.disconnect();}
});

}
module.exports={main};
if(require.main===module)try{main();}catch{process.exitCode=2;}
