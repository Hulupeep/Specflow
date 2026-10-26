'use strict';
const fs=require('fs'),cp=require('child_process'),path=require('path'),w=require('../../../scripts/improve-worker.cjs'),c=require('../../../scripts/improve-controller.cjs'),{fromConfig}=require('../../../scripts/improve-recovery-host.cjs');
process.on('message',async message=>{
 try{
 const cfg=require('../../../scripts/improve-controller-cli.cjs').readPrivate(message.config),recovery=fromConfig(cfg.recovery,{principal:cfg.authority.principal,store:cfg.recovery.store,registry:cfg.authority.registry}),service=c.createControllerService({root:cfg.recovery.store,registry:cfg.authority.registry,resolvePrincipal:()=>recovery.resolveAssignment().principal,ownerPrincipal:'owner',hostCapabilities:()=>cfg.authority.host,recovery});
 if(message.action==='role'){
  const result=w.roleCall({role:'builder',model:'sonnet',effectiveModel:'fixture-builder',prompt:message.prompt,schema:{type:'object',properties:{}},cwd:cfg.emptyCwd,evidence:cfg.roles,claude:cfg.claude});process.send({ok:true,model:result.provenance.model});
 }else if(message.action==='stage'){
  const adapter=require('../../../scripts/improve-controller-worker.cjs').createControllerWorker({service,binding:cfg.controller_binding,configFile:message.config,evidenceDir:cfg.stageEvidence});const result=await adapter.wait(adapter.start(message.stage,message.args));process.send({ok:result.status===0,result});
 }else if(message.action==='orphan'){
  const child=cp.spawn(process.execPath,[path.join(__dirname,'ticket-orphan-probe.cjs'),message.config,message.trigger,message.result,message.marker],{detached:true,stdio:'ignore'});process.send({orphan:child.pid});
 }
 }catch(e){process.send({ok:false,reason:e.code||e.message});}
});process.send({ready:true});
