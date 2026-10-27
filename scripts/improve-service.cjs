'use strict';
// One authenticated transport facade; the existing controller remains the job/authority truth.
const http=require('http'),{McpServer}=require('@modelcontextprotocol/server'),{NodeStreamableHTTPServerTransport}=require('@modelcontextprotocol/node');
const {schemas,parse,ServiceError}=require('./improve-service-schema.cjs'),{authenticator}=require('./improve-service-auth.cjs');
const tools=Object.keys(schemas),capabilities=Object.freeze({api_version:1,service_version:'1.0.0',tools,admission:'policy_creator_only',execution:'owner_registered_qualified_plan',deployment:'owner_local_loopback'});
function project(svc,repo_id,run_id,snapshot=null){
 const r=snapshot?.run||svc.status({repo_id,run_id}).runs[0],p=snapshot?.report||svc.report({repo_id,run_id});if(!r.service)throw new ServiceError('not_authorised',403);
 return {api_version:1,run_id,repo_id,task:r.service.task,profile_revision:r.profile_revision,lifecycle:p.lifecycle,report_id:p.report_id,report_revision:p.revision,code_decision:p.code_results.at(-1)?.decision||null,current_improvement_established:p.established,experiment_verdict:p.experiment_results.at(-1)?.verdict||null,delivery:'not_requested',blocker:(['blocked','interrupted','cancelling'].includes(p.lifecycle)||p.reason_code&&!['awaiting_dispatch','work_running','cycle_in_progress','ready_for_next_cycle'].includes(p.reason_code))?{reason_code:p.reason_code,stage:p.stage,failed_check:p.failed_check,retryable:false,evidence_refs:[],next_action:p.next_action}:null,limits:p.original_limits,deadline_ms:p.deadline_ms,consumed:p.consumed,usage:p.usage};
}
function createService({authFile,controllerFactory,preflight,notify=()=>{},control}){
 const auth=authenticator(authFile);
 function call(tool,input,header){
  const actor=auth.authenticate(header),req=parse(tool,input);auth.authorize(header,actor,req.repo_id,tool);
  const svc=controllerFactory(actor);const ref={repo_id:req.repo_id};
  if(tool==='improve_preflight')return {api_version:1,capabilities,...preflight(req,actor)};
  if(tool==='improve_start'){
   const out=svc.admitTask({repo_id:req.repo_id,request_id:req.request_id,task:req.task},actor);
   if(out.accepted){notify({repo_id:req.repo_id,run_id:out.run_id});return {api_version:1,accepted:true,duplicate:out.duplicate,run_id:out.run_id,job:project(svc,req.repo_id,out.run_id),blocker:null};}
   return {api_version:1,accepted:false,duplicate:out.duplicate,run_id:null,job:null,blocker:{reason_code:out.reason_code,stage:'admission',failed_check:null,retryable:false,evidence_refs:[],next_action:{owner:'agent',action:'Inspect original blocked admission and current registered plan/policy; do not reset or repeat this request.',reason_code:out.reason_code}}};
  }
  if(tool==='improve_status'){
   const runs=svc.status({...ref,...(req.run_id?{run_id:req.run_id}:{})}).runs.filter(r=>r.service);
   if(req.run_id&&!runs.length)throw new ServiceError('not_authorised',403);
   const reports=runs.map(r=>svc.report({repo_id:req.repo_id,run_id:r.id}));return {api_version:1,jobs:runs.map((r,i)=>project(svc,req.repo_id,r.id,{run:r,report:reports[i]})),reports};
  }
  // Canonical control binding is provided by the trusted dispatcher; never caller generation/path.
  if(!control)throw new ServiceError('control_unavailable',503);
  const receipt=control({tool,request:req,actor,service:svc});if(tool==='improve_resume'&&receipt.allowed)notify({repo_id:req.repo_id,run_id:req.run_id,control_command:receipt.command_id,expected_generation:receipt.expected_generation});return {api_version:1,receipt,job:project(svc,req.repo_id,req.run_id)};
 }
 return {call,authenticate:auth.authenticate,capabilities};
}
function failure(e){let code=typeof e.code==='string'&&/^[a-z][a-z0-9_]{0,79}$/.test(e.code)?e.code:'service_unavailable';if(['run_unavailable','recovery_run_unavailable','authority_revoked','service_actor_mismatch','policy_unavailable'].includes(code))code='not_authorised';return {status:code==='not_authorised'?403:e.status||(['invalid_request','idempotency_conflict','task_revision_conflict'].includes(code)?400:503),error:{api_version:1,reason_code:code,next_action:{owner:'agent',action:code==='not_authorised'?'Use a current credential with the required repo/action scope.':code==='plan_preparation_required'?'Prepare and qualify the registered task plan through the existing Specflow workflow.':'Inspect the named service/worker boundary and original job evidence; do not substitute execution or reset its identity.',reason_code:code}}};}
async function readBody(req){let size=0,parts=[];for await(const part of req){size+=part.length;if(size>16384)throw new ServiceError('request_too_large',413);parts.push(part);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new ServiceError('invalid_request');}}
function createHttpServer(service){
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{if(res.headersSent)return;res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
  try{
   const expected='127.0.0.1:'+server.address().port;
   if(req.headers.host!==expected||req.headers.origin&&req.headers.origin!=='http://'+expected)throw new ServiceError('origin_not_allowed',403);
   const header=req.headers.authorization;service.authenticate(header);
   if(req.url==='/v1/capabilities'&&req.method==='GET')return send(200,service.capabilities);
   if(req.method!=='POST')throw new ServiceError('method_not_allowed',405);
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw new ServiceError('invalid_content_type',415);
   const body=await readBody(req);
   if(req.url==='/mcp'){
    const mcp=new McpServer({name:'specflow-improve',version:service.capabilities.service_version});
    for(const name of tools)mcp.registerTool(name,{description:'Authenticated durable Specflow '+name.slice(8),inputSchema:schemas[name]},async input=>{try{const result=service.call(name,input,header);return {content:[{type:'text',text:JSON.stringify(result)}],structuredContent:result};}catch(e){return {isError:true,content:[{type:'text',text:JSON.stringify(failure(e).error)}]};}});
    const transport=new NodeStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});await mcp.connect(transport);res.on('close',()=>void mcp.close());return await transport.handleRequest(req,res,body);
   }
   const tool={ '/v1/preflight':'improve_preflight','/v1/start':'improve_start','/v1/status':'improve_status','/v1/cancel':'improve_cancel','/v1/resume':'improve_resume'}[req.url];if(!tool)throw new ServiceError('route_not_found',404);
   return send(200,service.call(tool,body,header));
  }catch(e){const out=failure(e);send(out.status,out.error);}
 });server.requestTimeout=15000;server.headersTimeout=10000;return server;
}
module.exports={createService,createHttpServer,project,failure,capabilities};
