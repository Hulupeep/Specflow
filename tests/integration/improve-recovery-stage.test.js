'use strict';
const fs=require('fs'),path=require('path'),{recoveryFixture}=require('../helpers/improve-recovery.cjs'),{createControllerWorker}=require('../../scripts/improve-controller-worker.cjs'),R=require('../../scripts/improve-operation-receipts.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
test('REC-FENCE real v2 production stage adapter start/wait persists process identity and authentic completion',async()=>{
 f=recoveryFixture();f.claim();const svc=f.serviceV2(),cycle=svc.reserveCycle({...f.req,binding:{job_id:'stage-job',operation_id:'stage-op',core_run_id:'stage-core'}}).cycle;
 const bin=path.join(f.root,'bin'),empty=path.join(f.root,'empty');fs.mkdirSync(bin,{mode:0o700});fs.mkdirSync(empty,{mode:0o700});
 const launcher=path.join(bin,'worker-command');fs.writeFileSync(launcher,'#!'+process.execPath+'\nprocess.stdout.write(JSON.stringify({actualStage:true}));',{mode:0o700});
 const cfg={bin,launcher,emptyCwd:empty,authority:{uid:process.getuid(),principal:'owner',repo_id:'fixture',revision:f.revision,registry:f.registryV2},controller_binding:{...f.req,cycle_id:cycle.id},recovery:{format:2,lockTool:f.recovery.lockTool,store:f.rootV2}};
 const config=path.join(bin,'job.json');fs.writeFileSync(config,JSON.stringify(cfg),{mode:0o600});
 const adapter=createControllerWorker({service:svc,binding:cfg.controller_binding,configFile:config,evidenceDir:path.join(f.root,'stage-evidence')}),child=adapter.start('startRun',[]),result=await adapter.wait(child);
 expect(result.status).toBe(0);expect(JSON.parse(result.stdout).actualStage).toBe(true);const run=svc.status(f.req).runs[0],op=run.operations[0];expect(op.state).toBe('complete');expect(op.process_identity.pid).toBe(child.pid);expect(op.process_identity.boot_id).toBeTruthy();expect(op.receipt_seal).toMatch(/^[a-f0-9]{64}$/);expect(run.active_stage).toBe(null);
 const receipt=new R.OperationReceipts({root:path.join(f.rootV2,'operation-receipts'),registry:f.registryV2,lockTool:f.recovery.lockTool}).get(op.id);expect(receipt.seal).toBe(op.receipt_seal);expect(receipt.binding.input_sha256).toBe(op.input_sha256);
},15000);
