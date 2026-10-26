'use strict';
// Actual supervised processes and durable authority; protocol tasks, no model-quality claim.
const fs=require('fs'),path=require('path'),m=require('../../scripts/improve-memory.cjs'),{recoveryFixture}=require('../helpers/improve-recovery.cjs'),R=require('../../scripts/improve-operation-receipts.cjs'),{spawnOperation}=require('../../scripts/improve-paused-operation.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
function setup(extra={}){f=recoveryFixture({policyOverrides:extra});f.claim();const cycle=f.serviceV2().reserveCycle({...f.req,binding:{job_id:'job',operation_id:'op',core_run_id:'core'}}).cycle;const receipt={root:path.join(f.rootV2,'operation-receipts'),registry:f.registryV2,lockTool:f.recovery.lockTool};const store=new R.OperationReceipts({...receipt,create:true});return {cycle,receipt,store};}
async function issue(context,{complete=true,kind='provider'}={}){
 const svc=f.serviceV2(),run=svc.status(f.req).runs[0];
 const args={...f.req,cycle_id:context.cycle.id,input_sha256:m.hash('fixed process input'),...(kind==='provider'?{role:'builder'}:{stage:'build'})};
 const started=svc[kind==='provider'?'startAttempt':'startStage'](args,entry=>spawnOperation({executable:process.execPath,args:['-e','process.stdout.write("actual output")'],options:{env:{PATH:'/usr/bin:/bin'}},receipt:context.receipt,binding:R.forOperation(run,entry.operation),kind:'stage'}));
 if(!started.result.allowed)return started;
 const child=started.started;child.stdout.resume();child.stderr.resume();child.stdin.end();await new Promise(r=>child.once('close',r));
 const op=started.result.operation,doc=context.store.get(op.id);
 if(complete){const result={...doc.result,evidence:[doc.stdout_sha256,doc.stderr_sha256]};if(kind==='stage')delete result.estimate_usd;svc[kind==='provider'?'recordAttempt':'recordStage']({...f.req,operation_id:op.id},result);}
 return {op,doc,child};
}
test('EFFORT-V2 thirty-one real useful process starts pass without an invented subscription ceiling',async()=>{
 const ctx=setup();for(let i=0;i<31;i++)expect((await issue(ctx)).doc.result.exit_code).toBe(0);
 const run=f.serviceV2().status(f.req).runs[0];expect(run.consumed_attempts).toBe(31);expect(run.remaining.attempts).toBe(null);expect(run.reasons).toEqual([]);expect(run.limits.maxWallMs).toBe(7200000);expect(run.remaining.consecutive_no_progress).toBe(null);
},60000);
test('EFFORT-V2 explicit ceiling denies the next actual process and preserves the original overnight window',async()=>{
 const ctx=setup({limits:{maxCycles:2,maxAttempts:2,maxWallMs:28800000}});
 await issue(ctx);await issue(ctx);let calls=0;
 const denied=f.serviceV2().startAttempt({...f.req,cycle_id:ctx.cycle.id,role:'builder',input_sha256:m.hash('fixed')},()=>{calls++;});
 expect(denied.result.run.reason_code).toBe('attempts_exhausted');expect(calls).toBe(0);expect(denied.result.run.limits.maxWallMs).toBe(28800000);
 expect(require('../../scripts/improve-controller.cjs').limitsV2({maxAttempts:1},{maxCycles:2,maxAttempts:2,maxConsecutiveNoProgress:null,maxWallMs:28800000})).toEqual({maxCycles:2,maxAttempts:1,maxConsecutiveNoProgress:null,maxWallMs:28800000});
},15000);
test('EFFORT-V2 a registered expensive route has an exact independent ceiling',async()=>{
 f=recoveryFixture();const routes=f.policyV2().routes.map(r=>({...r,cost:'expensive',maxStarts:1}));f.cleanup();f=null;
 const ctx=setup({routes});await issue(ctx);let calls=0;
 const denied=f.serviceV2().startAttempt({...f.req,cycle_id:ctx.cycle.id,role:'builder',input_sha256:m.hash('fixed')},()=>{calls++;});
 expect(denied.result.run.reason_code).toBe('route_starts_exhausted');expect(calls).toBe(0);expect(denied.result.run.route_blocker.consumed).toBe(1);
},15000);
test.each(['billing','effective_model','requested_model'])('EFFORT-V2 forged actual %s blocks before any outbound process',key=>{
 const ctx=setup();f.actualRoutes.builder[key]='unregistered';let calls=0;
 expect(()=>f.serviceV2().startAttempt({...f.req,cycle_id:ctx.cycle.id,role:'builder',input_sha256:m.hash('fixed')},()=>{calls++;})).toThrow('recovery_route_unavailable');expect(calls).toBe(0);
});
test('REC-RECEIPT completed stage adoption after deadline is idempotent and never invokes another executable',async()=>{
 const ctx=setup(),{op}=await issue(ctx,{kind:'stage',complete:false});const before=f.serviceV2().status(f.req).runs[0];f.clock=before.deadline_ms+1;
 const req=f.command({receipt_id:op.id},'receipt-once'),accepted=f.serviceV2().reconcile(req);expect(accepted).toMatchObject({allowed:true,reason_code:'deadline'});expect(f.serviceV2().reconcile(req).duplicate).toBe(true);
 const after=f.serviceV2().status(f.req).runs[0];expect(after.operations).toHaveLength(1);expect(after.operations[0].state).toBe('complete');expect(after.active_stage).toBe(null);expect(after.deadline_ms).toBe(before.deadline_ms);
 let calls=0;expect(f.serviceV2().startStage({...f.req,cycle_id:ctx.cycle.id,stage:'build',input_sha256:m.hash('new')},()=>{calls++;}).result.allowed).toBe(false);expect(calls).toBe(0);
},15000);
test('REC-RECEIPT wrong binding and forged result cannot acknowledge a real reserved operation',async()=>{
 const ctx=setup(),{op,doc}=await issue(ctx,{complete:false});expect(()=>f.serviceV2().recordAttempt({...f.req,operation_id:op.id},{...doc.result,exit_code:99,evidence:[]})).toThrow('receipt_result_mismatch');
 f.recovery.resolveReceipt=()=>({...doc,binding:{...doc.binding,generation:99}});expect(()=>f.serviceV2().reconcile(f.command({receipt_id:op.id}))).toThrow('receipt_binding_mismatch');expect(f.serviceV2().status(f.req).runs[0].operations[0].state).toBe('reserved');
},15000);
test('REC-RECEIPT cancellation permits only adoption of already-issued supervisor evidence',async()=>{
 const ctx=setup(),{op}=await issue(ctx,{kind:'stage',complete:false});f.serviceV2().cancel(f.req);expect(f.serviceV2().reconcile(f.command({receipt_id:op.id}))).toMatchObject({allowed:true,reason_code:'operator_cancelled'});
 let calls=0;expect(f.serviceV2().startStage({...f.req,cycle_id:ctx.cycle.id,stage:'build',input_sha256:m.hash('new')},()=>{calls++;}).result.allowed).toBe(false);expect(calls).toBe(0);const run=f.serviceV2().status(f.req).runs[0];expect(run.operations).toHaveLength(1);expect(run.operations[0].state).toBe('complete');expect(run.cancel_requested).toBe(true);expect(run.consumed_cycles).toBe(1);
},15000);
