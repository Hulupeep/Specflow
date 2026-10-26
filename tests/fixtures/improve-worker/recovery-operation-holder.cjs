'use strict';
const fs=require('fs'),path=require('path'),c=require('../../../scripts/improve-controller.cjs'),host=require('../../../scripts/improve-recovery-host.cjs'),R=require('../../../scripts/improve-operation-receipts.cjs'),{spawnOperation}=require('../../../scripts/improve-paused-operation.cjs');
process.on('message',cfg=>{
 try{
 const recovery=host.fromConfig(cfg.recovery,{principal:cfg.principal,store:cfg.store,registry:cfg.registry}),svc=c.createControllerService({root:cfg.store,registry:cfg.registry,resolvePrincipal:()=>cfg.principal,ownerPrincipal:'owner',hostCapabilities:()=>cfg.host,recovery});
 const receipt={root:path.join(cfg.store,'operation-receipts'),registry:cfg.registry,lockTool:cfg.recovery.lockTool};new R.OperationReceipts({...receipt,create:true});
 const run=svc.status(cfg.req).runs[0];
 const out=svc.startStage({...cfg.req,cycle_id:cfg.cycle_id,stage:'build',input_sha256:require('../../../scripts/improve-memory.cjs').hash('fixed child input')},entry=>{const child=spawnOperation({executable:process.execPath,args:['-e','const fs=require("fs");fs.appendFileSync(process.argv[1],"one launch\\n");const t=setInterval(()=>{if(fs.existsSync(process.argv[2])){clearInterval(t);process.stdout.write("independent completion");}},20);',cfg.marker,cfg.gate],options:{env:{PATH:'/usr/bin:/bin'}},receipt,binding:R.forOperation(run,entry.operation),kind:'stage'});if(cfg.killBeforeAck){process.kill(process.pid,'SIGKILL');}return child;});
 out.started.stdin.end();out.started.stdout.resume();out.started.stderr.resume();process.send({operation:out.result.operation});
 }catch(e){process.send({error:e.code||e.message});}
});process.send({ready:true});
