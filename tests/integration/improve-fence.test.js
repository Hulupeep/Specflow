'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),c=require('../../scripts/improve-controller.cjs'),m=require('../../scripts/improve-memory.cjs'),proc=require('../../scripts/improve-process-identity.cjs'),{recoveryFixture}=require('../helpers/improve-recovery.cjs');
let f,holder;afterEach(async()=>{if(holder&&holder.exitCode===null&&holder.signalCode===null){const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;}holder=null;f?.cleanup();f=null;});
function oldHolder(){holder=cp.spawn(process.execPath,['-e','process.stdin.resume();process.stdin.on("end",()=>process.exit());setInterval(()=>{},1000);'],{detached:true,stdio:['pipe','ignore','ignore']});return proc.identity(holder.pid);}
function cfg(assignment,request,name,extra={}){
 const file=path.join(f.root,name+'.json');fs.writeFileSync(file,JSON.stringify({root:f.rootV2,registry:f.registryV2,principal:assignment.principal,ownerPrincipal:'owner',host:f.host,clock:f.clock,recovery:{format:2,lockTool:f.recovery.lockTool},assignment,request,action:'resume',routes:f.actualRoutes,...extra}),{mode:0o600});return file;
}
const child=file=>new Promise((resolve,reject)=>{const p=cp.spawn(process.execPath,[path.resolve('tests/fixtures/improve-worker/recovery-command.cjs'),file],{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>{out+=b;});p.stderr.on('data',b=>{err+=b;});p.once('error',reject);p.once('close',code=>{try{if(code!==0)throw Error(err);resolve(JSON.parse(out));}catch(e){reject(e);}});});
async function killHolder(){const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;}
function setupReplacement(principal='owner'){
 f=recoveryFixture({initialProcess:oldHolder()});f.claim();const old=f.current(),execution=f.execution(),snapshot=f.serviceV2().status(f.req).runs[0];
 const next=f.successor({principal,holder:'worker-B',revision:'assignment-2',process:proc.identity()});f.serviceV2().assign(f.command({principal:next.principal,holder:next.holder,assignment_revision:next.revision}));return {old,execution,next,snapshot};
}
test('REC-FENCE a real live former holder blocks replacement; after death two command processes yield exactly one generation',async()=>{
 const {next,snapshot}=setupReplacement();f.use(next);
 expect(f.serviceV2().resume(f.command({},'still-live'))).toMatchObject({allowed:false,reason_code:'previous_holder_live',generation:1});
 await killHolder();const request=f.command({},'left'),barrier=path.join(f.root,'race');
 const left=child(cfg(next,request,'left',{barrier})),right=child(cfg(next,{...request,request_id:'right'},'right',{barrier}));fs.writeFileSync(barrier,'go');
 const results=await Promise.all([left,right]);expect(results.filter(r=>r.allowed===true)).toHaveLength(1);expect(results.filter(r=>r.reason_code==='recovery_generation_conflict')).toHaveLength(1);
 const state=f.serviceV2().status(f.req).runs[0];expect(state.recovery.generation).toBe(2);expect(state.deadline_ms).toBe(snapshot.deadline_ms);expect(state.consumed_attempts).toBe(0);
 expect(f.serviceV2().store.read().history.filter(e=>e.event==='recovery_command'&&e.kind==='resume'&&e.result.allowed)).toHaveLength(2);
},30000);
test('REC-FENCE identical concurrent resume deliveries return one original ownership receipt',async()=>{
 const {next}=setupReplacement();f.use(next);await killHolder();const request=f.command({},'duplicate'),barrier=path.join(f.root,'duplicate-race');
 const a=child(cfg(next,request,'a',{barrier})),b=child(cfg(next,request,'b',{barrier}));fs.writeFileSync(barrier,'go');const results=await Promise.all([a,b]);
 expect(results.every(r=>r.allowed&&r.generation===2)).toBe(true);expect(results.filter(r=>r.duplicate)).toHaveLength(1);
 expect(f.serviceV2().store.read().history.filter(e=>e.event==='recovery_command'&&e.kind==='resume'&&e.result.generation===2)).toHaveLength(1);
},30000);
test('REC-FENCE a granted different principal succeeds without rewriting origin; stale old context launches nothing',async()=>{
 const {old,execution,next}=setupReplacement('delegate'),oldConfig={...f.configV2(),recovery:{...f.recovery,resolveAssignment:()=>old,resolveExecution:()=>execution}};
 await killHolder();f.principal='delegate';f.use(next);expect(f.claim().generation).toBe(2);
 const cycle=f.serviceV2().reserveCycle({...f.req,binding:{job_id:'delegate-job',operation_id:'delegate-op',core_run_id:'delegate-core'}}).cycle;
 let launches=0;f.principal='owner';
 expect(()=>c.createControllerService(oldConfig).startStage({...f.req,cycle_id:cycle.id,stage:'build',input_sha256:m.digest({args:'immutable'})},()=>{launches++;})).toThrow('stale_execution_generation');
 expect(launches).toBe(0);const run=f.serviceV2().status(f.req).runs[0];expect(run.principal).toBe('owner');expect(run.recovery.current.assignment.principal).toBe('delegate');
},30000);
