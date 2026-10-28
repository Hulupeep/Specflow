#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const advice=require('./advisory-review.cjs'),identity=require('./improve-process-identity.cjs');
function native(dir){
 const r=JSON.parse(fs.readFileSync(path.join(dir,'native-request.json'))),keeper=identity.identity();
 if(!keeper||keeper.pid!==keeper.group)throw Error('Native session keeper must own its detached process group');
 const output=fs.openSync(path.join(dir,'stdout.txt'),'wx',0o600),error=fs.openSync(path.join(dir,'stderr.txt'),'wx',0o600);
 let timedOut=false,spawnError=null,bytes=0,stopping=false,exitStatus=null,exitSignal=null,invoked=false;
 const observation=(phase)=>({phase,status:exitStatus,signal:exitSignal,invoked,error:timedOut?'ETIMEDOUT':spawnError,keeper});
 function terminate(phase='forced-group-termination'){
  if(stopping)return;stopping=true;
  // This process remains the live session leader through the entire grace
  // period. A fast child exit cannot remove the ownership anchor or evade it.
  process.kill(-process.pid,'SIGTERM');
  setTimeout(()=>{try{advice.atomic(path.join(dir,'native-observation.json'),observation(phase));}finally{process.kill(-process.pid,'SIGKILL');}},500);
 }
 process.on('SIGTERM',()=>{if(!stopping){spawnError='NATIVE_INTERRUPTED';terminate();}});
 advice.atomic(path.join(dir,'custody.json'),{...r.custody,invoked:false,native_identity:keeper,native_members:[keeper],launch_phase:'keeper-ready'});
 const child=cp.spawn(r.spec.exe,r.spec.args,{cwd:dir,env:process.env,stdio:['pipe','pipe','pipe']});
 invoked=!!child.pid;const childIdentity=invoked?identity.identity(child.pid):null;
 const capture=fd=>chunk=>{const remaining=Math.max(0,32*1024*1024-bytes);if(remaining)fs.writeSync(fd,chunk.subarray(0,remaining));bytes+=chunk.length;if(bytes>32*1024*1024&&!spawnError){spawnError='NATIVE_OUTPUT_LIMIT';terminate();}};
 child.stdout.on('data',capture(output));child.stderr.on('data',capture(error));
 advice.atomic(path.join(dir,'custody.json'),{...r.custody,invoked,native_identity:keeper,native_child_identity:childIdentity,native_members:[keeper,...(childIdentity?[childIdentity]:[])]});
 child.on('error',e=>{spawnError=e.code;});child.stdin.on('error',()=>{});child.on('exit',(status,signal)=>{exitStatus=status;exitSignal=signal;});
 // Real child and continuously live keeper identities precede prompt delivery.
 child.stdin.end(r.prompt);
 const timer=setTimeout(()=>{timedOut=true;terminate();},r.timeoutMs);
 child.on('close',(status,signal)=>{
  exitStatus=status;exitSignal=signal;if(stopping)return;
  // Retire the whole owned session even after a normal leader exit. The live
  // keeper anchors this cleanup, so an unobserved fast fork cannot outlive it.
  clearTimeout(timer);terminate('native-closed-cleanup');
 });
}
function run(requestFile){
 const o=JSON.parse(fs.readFileSync(requestFile));let result;
 try{result=advice.worker(o);}catch(e){result=e.code==='store_busy'?{status:'pending',liveness:'live',gate_decision:'pending'}:{status:'unavailable',scope_status:'unknown',clean:false,findings:advice.handoff(o).findings,gate_decision:'pending',invoked:false,mode:'not_invoked',cause:e.message};}
 advice.atomic(o.delivery,result);
}
module.exports={native,run};
if(require.main===module){if(process.argv[2]==='--native')native(process.argv[3]);else run(process.argv[2]);}
