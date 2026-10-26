'use strict';
const {coreFixture,executeCycle}=require('../../helpers/improve-memory-core.cjs'),{configureRecovery}=require('../../helpers/improve-recovery-core.cjs');
(async()=>{
 const f=coreFixture({configure:x=>configureRecovery(x)});f.claimRecovery();
 await executeCycle(f,{steps:2,afterVerified:async run=>new Promise(()=>{process.send({root:f.root,store:f.store,registry:f.registry,repo:f.repo,host:f.host,req:f.req,revision:f.revision,lockTool:f.recovery.lockTool,evidenceRoot:f.evidenceRoot,run},()=>process.kill(process.pid,'SIGKILL'));})});
})().catch(e=>{process.send({error:e.code||e.message});process.exitCode=2;});
