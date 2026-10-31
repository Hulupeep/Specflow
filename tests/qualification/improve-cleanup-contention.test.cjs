'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert');
const base=process.cwd(),{DurableStore}=require(base+'/scripts/improve-worker.cjs'),a=require(base+'/scripts/improve-backend-attempt.cjs'),identity=require(base+'/scripts/improve-process-identity.cjs');
if(process.argv[2]==='child'){
 process.once('message',({root,ref,slot,owner})=>{
  const store=new DurableStore({root,sourceRoot:root});
  a.intent(store,ref,{slot,expectedConfigSha256:'d'.repeat(64),creator:owner,supervisor:identity.identity()});
  a.resourceEvent(store,ref,slot,{state:'dispatching',id:null,inspectionSha256:null});
  a.resourceEvent(store,ref,slot,{state:'created',id:'a'.repeat(64),inspectionSha256:'b'.repeat(64)});
  process.send({state:'ready'});
  process.once('message',()=>{
   const mkdir=fs.mkdirSync;
   if(slot==='database')fs.mkdirSync=function(file,...args){const v=mkdir.call(this,file,...args);if(String(file).endsWith('mutation-'+ref.attemptId)){fs.writeFileSync(root+'/lock-held','held',{flag:'wx'});Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1500);}return v;};
   try{a.resourceEvent(store,ref,slot,{state:'removed',id:'a'.repeat(64),inspectionSha256:'b'.repeat(64)});process.send({state:'removed',slot});}
   catch(e){process.send({state:'failed',slot,cause:e.message});}
   finally{process.disconnect();}
  });
 });
}else{
 (async()=>{
  const root=fs.mkdtempSync(path.resolve('.specflow/specification/backend-recipe/contention-probe-'));fs.chmodSync(root,0o700);
  const store=new DurableStore({root,sourceRoot:root}),ref=a.begin(store,{jobId:'contention-probe',runId:'run',phase:'baseline',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+60000});
  async function ready(slot){const child=cp.fork(__filename,['child'],{stdio:['ignore','ignore','inherit','ipc']});const r=new Promise(resolve=>child.once('message',resolve));child.send({root,ref,slot,owner:identity.identity()});assert.equal((await r).state,'ready');return child;}
  const database=await ready('database'),app=await ready('app');const dbDone=new Promise(r=>database.once('message',r)),appDone=new Promise(r=>app.once('message',r));database.send('remove');const end=Date.now()+5000;while(!fs.existsSync(root+'/lock-held')){assert(Date.now()<end);await new Promise(r=>setTimeout(r,10));}app.send('remove');
  const outcomes=await Promise.all([dbDone,appDone]);const result={root,scope:'Actual separate-process signed resource-event writers; scheduling-only lock overlap, no Docker or product proof',outcomes};fs.writeFileSync(root+'/result.json',JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));assert(outcomes.every(x=>x.state==='removed'),'concurrent cleanup events must both be recorded');
 })().catch(e=>{console.error(e.message);process.exitCode=1;});
}
