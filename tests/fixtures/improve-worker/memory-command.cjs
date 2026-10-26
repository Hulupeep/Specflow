'use strict';
// Child-process protocol client over the real profile/controller/file resolver.
const fs=require('fs'),cfg=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const c=require('../../../scripts/improve-controller.cjs'),m=require('../../../scripts/improve-memory.cjs');
const service=c.createControllerService({root:cfg.root,registry:cfg.registry,resolvePrincipal:()=>cfg.principal,
  ownerPrincipal:cfg.ownerPrincipal,hostCapabilities:()=>cfg.host,now:()=>cfg.clock,
  memory:{required:true,resolveActor:()=>cfg.actor,resolveEvidence:m.createFileEvidenceResolver(cfg.evidenceRoot)}});
const end=Date.now()+10000,sleep=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10);
while(cfg.barrier&&!fs.existsSync(cfg.barrier)&&Date.now()<end)sleep();
let result;
do{try{result=service.resolveMemory(cfg.request);break;}catch(e){
  if(['authority_busy','store_busy'].includes(e.code)&&Date.now()<end){sleep();continue;}
  result={reason_code:e.code||e.message};break;
}}while(Date.now()<end);
if(!cfg.dropAcknowledgement)console.log(JSON.stringify(result));
