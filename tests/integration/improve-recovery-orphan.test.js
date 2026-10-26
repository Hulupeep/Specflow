'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),proc=require('../../scripts/improve-process-identity.cjs'),R=require('../../scripts/improve-operation-receipts.cjs'),{recoveryFixture}=require('../helpers/improve-recovery.cjs');
let f,holder;afterEach(async()=>{if(holder?.exitCode===null&&holder?.signalCode===null){const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;}f?.cleanup();f=null;holder=null;});
const until=async fn=>{const end=Date.now()+5000;while(!fn()){if(Date.now()>end)throw Error('Expected real process evidence unavailable');await new Promise(r=>setTimeout(r,20));}};
test('REC-RECEIPT real holder SIGKILL does not replay its live child; designated successor adopts independent sealed completion',async()=>{
 holder=cp.fork(path.resolve('tests/fixtures/improve-worker/recovery-operation-holder.cjs'),[],{stdio:['ignore','ignore','pipe','ipc']});await new Promise(r=>holder.once('message',r));
 f=recoveryFixture({initialProcess:proc.identity(holder.pid)});f.claim();const svc=f.serviceV2(),cycle=svc.reserveCycle({...f.req,binding:{job_id:'orphan-job',operation_id:'orphan-op',core_run_id:'orphan-core'}}).cycle;
 const marker=path.join(f.root,'launches'),gate=path.join(f.root,'complete-child'),message=new Promise(r=>holder.once('message',r));
 holder.send({principal:'owner',store:f.rootV2,registry:f.registryV2,host:f.host,req:f.req,cycle_id:cycle.id,marker,gate,recovery:{format:2,lockTool:f.recovery.lockTool,assignment:f.current(),generation:1,routes:f.actualRoutes}});
 const started=await message;expect(started.error).toBeUndefined();await until(()=>fs.existsSync(marker));const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;
 const next=f.successor({...f.current(),holder:'worker-B',revision:'assignment-2',process:proc.identity()});svc.assign(f.command({principal:'owner',holder:next.holder,assignment_revision:next.revision}));f.use(next);
 expect(f.claim()).toMatchObject({allowed:false,reason_code:'issued_process_not_quiescent'});
 fs.writeFileSync(gate,'complete');const store=new R.OperationReceipts({root:path.join(f.rootV2,'operation-receipts'),registry:f.registryV2,lockTool:f.recovery.lockTool});
 await until(()=>fs.existsSync(path.join(store.root,'receipts',started.operation.id+'.json')));const op=f.serviceV2().status(f.req).runs[0].operations[0];await until(()=>proc.state(op.process_identity)==='dead');
 expect(f.serviceV2().reconcile(f.command({receipt_id:op.id}))).toMatchObject({allowed:true,generation:1});expect(f.claim().generation).toBe(2);
 const after=f.serviceV2().status(f.req).runs[0];expect(after.operations).toHaveLength(1);expect(after.operations[0].state).toBe('complete');expect(after.consumed_cycles).toBe(1);expect(fs.readFileSync(marker,'utf8')).toBe('one launch\n');expect(after.principal).toBe('owner');expect(after.deadline_ms-after.created_at_ms).toBe(after.limits.maxWallMs);
},20000);
test('REC-FENCE holder SIGKILL after fork before PID ack keeps unknown launch quarantined with zero protected starts',async()=>{
 holder=cp.fork(path.resolve('tests/fixtures/improve-worker/recovery-operation-holder.cjs'),[],{stdio:['ignore','ignore','pipe','ipc']});await new Promise(r=>holder.once('message',r));
 f=recoveryFixture({initialProcess:proc.identity(holder.pid)});f.claim();const svc=f.serviceV2(),cycle=svc.reserveCycle({...f.req,binding:{job_id:'unacked-job',operation_id:'unacked-op',core_run_id:'unacked-core'}}).cycle;
 const marker=path.join(f.root,'launches'),gate=path.join(f.root,'complete-child'),end=new Promise(r=>holder.once('exit',(c,s)=>r(s)));
 holder.send({principal:'owner',store:f.rootV2,registry:f.registryV2,host:f.host,req:f.req,cycle_id:cycle.id,marker,gate,killBeforeAck:true,recovery:{format:2,lockTool:f.recovery.lockTool,assignment:f.current(),generation:1,routes:f.actualRoutes}});expect(await end).toBe('SIGKILL');
 const reserved=svc.status(f.req).runs[0].operations[0];expect(reserved.state).toBe('reserved');expect(reserved.process_identity).toBeUndefined();
 const next=f.successor({...f.current(),holder:'worker-B',revision:'assignment-2',process:proc.identity()});svc.assign(f.command({principal:'owner',holder:next.holder,assignment_revision:next.revision}));f.use(next);expect(f.claim()).toMatchObject({allowed:false,reason_code:'launch_completion_unknown'});
 let calls=0;expect(()=>f.serviceV2().startStage({...f.req,cycle_id:cycle.id,stage:'build',input_sha256:reserved.input_sha256},()=>{calls++;})).toThrow('recovery_generation_required');expect(calls).toBe(0);expect(fs.existsSync(marker)).toBe(false);
 const store=new R.OperationReceipts({root:path.join(f.rootV2,'operation-receipts'),registry:f.registryV2,lockTool:f.recovery.lockTool});await until(()=>fs.existsSync(path.join(store.root,'receipts',reserved.id+'.json')));expect(store.get(reserved.id).phase).toBe('not_started');
 expect(f.serviceV2().reconcile(f.command({receipt_id:reserved.id})).allowed).toBe(true);expect(f.claim().generation).toBe(2);expect(fs.existsSync(marker)).toBe(false);expect(f.serviceV2().status(f.req).runs[0].operations).toHaveLength(1);
},20000);
test.each(['missing','corrupt','swapped-seal'])('REC-RECEIPT actual issued process with %s receipt remains reserved and blocks takeover and outbound work',async mode=>{
 holder=cp.fork(path.resolve('tests/fixtures/improve-worker/recovery-operation-holder.cjs'),[],{stdio:['ignore','ignore','pipe','ipc']});await new Promise(r=>holder.once('message',r));f=recoveryFixture({initialProcess:proc.identity(holder.pid)});f.claim();
 const svc=f.serviceV2(),cycle=svc.reserveCycle({...f.req,binding:{job_id:'negative-job',operation_id:'negative-op',core_run_id:'negative-core'}}).cycle,marker=path.join(f.root,'launches'),gate=path.join(f.root,'complete-child'),message=new Promise(r=>holder.once('message',r));
 holder.send({principal:'owner',store:f.rootV2,registry:f.registryV2,host:f.host,req:f.req,cycle_id:cycle.id,marker,gate,recovery:{format:2,lockTool:f.recovery.lockTool,assignment:f.current(),generation:1,routes:f.actualRoutes}});const started=await message;expect(started.error).toBeUndefined();fs.writeFileSync(gate,'complete');
 const file=path.join(f.rootV2,'operation-receipts/receipts',started.operation.id+'.json');await until(()=>fs.existsSync(file));const op=svc.status(f.req).runs[0].operations[0];await until(()=>proc.state(op.process_identity)==='dead');
 const end=new Promise(r=>holder.once('exit',r));holder.kill('SIGKILL');await end;
 if(mode==='missing')fs.unlinkSync(file);else if(mode==='corrupt')fs.writeFileSync(file,'broken JSON');else {const doc=JSON.parse(fs.readFileSync(file));doc.seal='0'.repeat(64);fs.writeFileSync(file,JSON.stringify(doc));}
 const next=f.successor({...f.current(),holder:'worker-B',revision:'assignment-2',process:proc.identity()});svc.assign(f.command({principal:'owner',holder:next.holder,assignment_revision:next.revision}));f.use(next);
 expect(()=>f.serviceV2().reconcile(f.command({receipt_id:op.id}))).toThrow();expect(f.claim()).toMatchObject({allowed:false,reason_code:'reconciliation_required',generation:1});
 let calls=0;expect(()=>f.serviceV2().startStage({...f.req,cycle_id:cycle.id,stage:'build',input_sha256:op.input_sha256},()=>{calls++;})).toThrow('recovery_generation_required');expect(calls).toBe(0);expect(f.serviceV2().status(f.req).runs[0].operations[0].state).toBe('reserved');expect(fs.readFileSync(marker,'utf8')).toBe('one launch\n');
},20000);
