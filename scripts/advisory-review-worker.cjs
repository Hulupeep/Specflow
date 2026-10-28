#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const advice=require('./advisory-review.cjs'),identity=require('./improve-process-identity.cjs');
function native(dir){
 const r=JSON.parse(fs.readFileSync(path.join(dir,'native-request.json')));
 const output=fs.openSync(path.join(dir,'stdout.txt'),'wx',0o600),error=fs.openSync(path.join(dir,'stderr.txt'),'wx',0o600);
 let timedOut=false,spawnError=null,bytes=0,grace;
 const child=cp.spawn(r.spec.exe,r.spec.args,{cwd:dir,env:process.env,detached:true,stdio:['pipe','pipe','pipe']});
 const invoked=!!child.pid,nativeIdentity=invoked?identity.identity(child.pid):null,known=new Map();
 if(nativeIdentity)known.set(nativeIdentity.pid,nativeIdentity);
 const liveKnown=()=>[...known.values()].filter(i=>identity.state(i)==='live'&&i.group===nativeIdentity?.group);
 function remember(){
  // A continuously live, birth-checked member proves this detached session's
  // group has not disappeared and had its number reused by unrelated work.
  const queue=liveKnown(),visited=new Set();if(!queue.length)return;
  for(const owner of queue){if(visited.has(owner.pid))continue;visited.add(owner.pid);try{for(const name of fs.readFileSync(`/proc/${owner.pid}/task/${owner.pid}/children`,'utf8').trim().split(/\s+/).filter(Boolean)){const i=identity.identity(Number(name));if(i?.group===nativeIdentity.group){known.set(i.pid,i);queue.push(i);}}}catch{}}
  advice.atomic(path.join(dir,'custody.json'),{...r.custody,invoked,native_identity:nativeIdentity,native_members:[...known.values()]});
 }
 function signalOwned(signal){
  if(!nativeIdentity||nativeIdentity.pid!==nativeIdentity.group||!liveKnown().length)return false;
  try{process.kill(-nativeIdentity.group,signal);return true;}catch(e){if(e.code!=='ESRCH')spawnError='NATIVE_TERMINATION_UNAVAILABLE';return false;}
 }
 function terminate(){remember();signalOwned('SIGTERM');grace=setTimeout(()=>{remember();signalOwned('SIGKILL');},500);}
 const capture=fd=>chunk=>{const remaining=Math.max(0,32*1024*1024-bytes);if(remaining)fs.writeSync(fd,chunk.subarray(0,remaining));bytes+=chunk.length;if(bytes>32*1024*1024&&!spawnError){spawnError='NATIVE_OUTPUT_LIMIT';terminate();}};
 child.stdout.on('data',capture(output));child.stderr.on('data',capture(error));
 advice.atomic(path.join(dir,'custody.json'),{...r.custody,invoked,native_identity:nativeIdentity,native_members:[...known.values()]});
 const custodyTimer=setInterval(remember,100);
 child.on('error',e=>{spawnError=e.code;});child.stdin.on('error',()=>{});
 // Actual child identity is durable before any review prompt is delivered.
 child.stdin.end(r.prompt);
 const timer=setTimeout(()=>{timedOut=true;terminate();},r.timeoutMs);
 child.on('close',(status,signal)=>{
  clearTimeout(timer);clearTimeout(grace);clearInterval(custodyTimer);fs.closeSync(output);fs.closeSync(error);
  advice.atomic(path.join(dir,'native-result.json'),{status,signal,invoked,error:timedOut?'ETIMEDOUT':spawnError,group_state:invoked?advice.groupState(nativeIdentity):'dead'});
 });
}
function run(requestFile){
 const o=JSON.parse(fs.readFileSync(requestFile));let result;
 try{result=advice.worker(o);}catch(e){result=e.code==='store_busy'?{status:'pending',liveness:'live',gate_decision:'pending'}:{status:'unavailable',scope_status:'unknown',clean:false,findings:advice.handoff(o).findings,gate_decision:'pending',invoked:false,mode:'not_invoked',cause:e.message};}
 advice.atomic(o.delivery,result);
}

module.exports={native,run};
if(require.main===module){if(process.argv[2]==='--native')native(process.argv[3]);else run(process.argv[2]);}
