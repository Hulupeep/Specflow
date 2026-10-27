'use strict';
// Compile owner-only local configuration; transport input cannot select any file or executable.
const {readPrivate}=require('./improve-controller-cli.cjs'),profiles=require('./improve-profiles.cjs'),proc=require('./improve-process-identity.cjs'),{createControllerService}=require('./improve-controller.cjs'),{ServiceError}=require('./improve-service-schema.cjs');
function loadHost(file){const host=readPrivate(file);if(host.version!==1||host.uid!==process.getuid()||host.principal!==host.ownerPrincipal||!host.recovery||host.recovery.format!==2)throw new ServiceError('host_unqualified',503);return host;}
function compileHost(file){
 const host=loadHost(file),identity=proc.identity(),assignment={principal:host.principal,holder:'service-'+process.pid,revision:'service-'+identity.start,process:identity};
 const raw={...host.recovery,assignment};delete raw.generation;delete raw.scope;delete raw.ticketRoot;
 const recovery=require('./improve-recovery-host.cjs').fromConfig(raw,{principal:host.principal,store:host.store,registry:host.registry});
 const getPlans=()=>{const registry=readPrivate(host.authFile);if(!Array.isArray(registry.plans))throw new ServiceError('plan_preparation_required',503);return registry.plans;};
 const resolvePlan=(task,ctx)=>{
  const p=getPlans().find(p=>p.repo_id===ctx.profile.repo_id&&p.task.task_id===task.task_id&&p.task.experiment_id===task.experiment_id);if(!p)throw new ServiceError('plan_preparation_required',503);
  if(p.recipe_id!==ctx.profile.runtime.adapter||p.profile_revision!==ctx.revision)throw new ServiceError('worker_unqualified',503);
  const adapter=host.host.adapters.find(a=>a.id===p.recipe_id&&a.revision===ctx.profile.runtime.revision&&a.qualified);if(!adapter||adapter.evidence?.sha256!==p.qualification_evidence_sha256)throw new ServiceError('worker_unqualified',503);
  require('./improve-service-plans.cjs').validate(p,host);
  return p;
 };
 const memoryFor=(resolveAssignment=()=>recovery.resolveAssignment())=>host.memory?{required:true,resolveActor:()=>{const a=resolveAssignment();return {principal:a.principal,holder:a.holder,assignment_revision:a.revision,role:host.memory.role||'builder'};},resolveEvidence:require('./improve-memory.cjs').createFileEvidenceResolver(host.memory.evidenceRoot)}:undefined;
 const factory=actor=>{if(actor.principal!==host.ownerPrincipal)throw new ServiceError('not_authorised',403);return createControllerService({root:host.store,registry:host.registry,resolvePrincipal:()=>actor.principal,ownerPrincipal:host.ownerPrincipal,hostCapabilities:()=>host.host,recovery,memory:memoryFor(),serviceBinding:{resolvePlan}});};
 const preflight=(req,actor)=>{
  if(actor.principal!==host.ownerPrincipal)throw new ServiceError('not_authorised',403);
  const service=profiles.createProfileService({registry:host.registry,resolvePrincipal:()=>actor.principal,hostCapabilities:()=>host.host,lockTool:host.recovery.lockTool}),result=service.preflight({repo_id:req.repo_id});
  if(!result.available)throw new ServiceError('not_authorised',403);
  const {lease,...safe}=result,plans=getPlans().filter(p=>p.repo_id===req.repo_id),checks=plans.map(plan=>{try{if(plan.profile_revision!==result.revision)throw new ServiceError('plan_binding_mismatch',503);require('./improve-service-plans.cjs').validate(plan,host);return {task_id:plan.task.task_id,ready:true,reason_code:null};}catch(e){return {task_id:plan.task.task_id,ready:false,reason_code:e.code||'plan_unavailable'};}}),dispatch=host.dispatch_enabled===true;
  return {...safe,worker_ready:result.ready,ready:result.ready&&checks.some(p=>p.ready)&&dispatch,registered_plans:plans.length,plan_checks:checks,dispatch_enabled:dispatch,next_action:!plans.length?{owner:'agent',reason_code:'plan_preparation_required',action:'Prepare and qualify the registered task plan.'}:!dispatch?{owner:'agent',reason_code:'dispatcher_paused',action:'Enable the configured owner-host dispatcher; queued jobs keep their original finite horizon.'}:null};
 };
 return {host,recovery,memoryFor,controllerFactory:factory,preflight};
}
async function serve(file,{port=0,notify,control}={}){const compiled=compileHost(file),{createService,createHttpServer}=require('./improve-service.cjs');const dispatcher=compiled.host.dispatch_enabled?require('./improve-service-dispatch.cjs').createDispatcher(file):null;
 const service=createService({authFile:compiled.host.authFile,controllerFactory:compiled.controllerFactory,preflight:compiled.preflight,notify:notify||dispatcher?.notify,control:control||(({tool,request,actor,service:svc})=>svc.serviceControl({repo_id:request.repo_id,run_id:request.run_id,request_id:request.request_id,action:tool==='improve_cancel'?'cancel':'resume'},actor))});const server=createHttpServer(service);await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});dispatcher?.recover();return {server,service,dispatcher,...compiled};}
module.exports={loadHost,compileHost,serve};
if(require.main===module)serve(process.argv[2],{port:Number(process.argv[3]||0)}).then(({server})=>{const address={url:'http://127.0.0.1:'+server.address().port+'/'};if(process.send)process.send(address);else console.log(JSON.stringify(address));}).catch(()=>{console.error(JSON.stringify({reason_code:'service_host_unavailable',next_action:'Check the owner-private qualified host configuration; no worker was launched.'}));process.exitCode=2;});
