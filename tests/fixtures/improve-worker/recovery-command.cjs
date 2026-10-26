'use strict';
// Genuine independent command process. Native model transport is not exercised.
const fs=require('fs'),c=require('../../../scripts/improve-controller.cjs'),p=require('../../../scripts/improve-process-identity.cjs'),cfg=JSON.parse(fs.readFileSync(process.argv[2]));
const recovery={...cfg.recovery,resolveAssignment:()=>cfg.assignment,resolveExecution:()=>cfg.execution||null,resolveSuccessor:key=>cfg.successors?.find(a=>a.principal===key.principal&&a.holder===key.holder&&a.revision===key.revision),resolveProcess:p.state,
 resolveRoute:role=>cfg.routes[role],resolveReceipt:()=>{throw Error('No receipt in fencing protocol');},resolveTerminalArchive:()=>{throw Error('No archive in fencing protocol');}};
const service=c.createControllerService({root:cfg.root,registry:cfg.registry,resolvePrincipal:()=>cfg.principal,ownerPrincipal:cfg.ownerPrincipal,hostCapabilities:()=>cfg.host,now:()=>cfg.clock,recovery});
(async()=>{
 const end=Date.now()+15000;
 while(cfg.barrier&&!fs.existsSync(cfg.barrier)){if(Date.now()>end)throw Error('Barrier unavailable');await new Promise(r=>setTimeout(r,10));}
 for(;;){try{const result=service[cfg.action](cfg.request);process.stdout.write(JSON.stringify(result));return;}catch(e){if(['authority_busy','store_busy'].includes(e.code)&&Date.now()<end){await new Promise(r=>setTimeout(r,20));continue;}process.stdout.write(JSON.stringify({reason_code:e.code||e.message}));return;}}
})().catch(e=>{process.stderr.write(e.message);process.exitCode=2;});
