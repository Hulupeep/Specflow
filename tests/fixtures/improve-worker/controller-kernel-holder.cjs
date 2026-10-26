'use strict';
const fs=require('fs'),c=require('../../../scripts/improve-controller.cjs'),cfg=JSON.parse(fs.readFileSync(process.argv[2]));
const service=c.createControllerService({...cfg,resolvePrincipal:()=>cfg.principal,ownerPrincipal:cfg.principal,hostCapabilities:()=>cfg.host,now:()=>cfg.clock,
 fault:stage=>{if(stage===cfg.checkpoint){process.stdout.write(stage+'\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);}}});
if(cfg.action==='migrate')service.migrate({repo_id:'fixture',request_id:'migration-1'});
else service.admit({repo_id:'fixture',request_id:'atomic-crash'});
