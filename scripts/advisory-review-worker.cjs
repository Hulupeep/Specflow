#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),advice=require('./advisory-review.cjs');
if(process.argv[2]==='--native'){
 const dir=process.argv[3],r=JSON.parse(fs.readFileSync(path.join(dir,'native-request.json')));
 const output=fs.openSync(path.join(dir,'stdout.txt'),'wx',0o600),error=fs.openSync(path.join(dir,'stderr.txt'),'wx',0o600);
 let timedOut=false,spawnError=null;
 const child=cp.spawn(r.spec.exe,r.spec.args,{cwd:dir,env:process.env,stdio:['pipe','pipe','pipe']});
 let bytes=0;
 const capture=fd=>chunk=>{const remaining=Math.max(0,32*1024*1024-bytes);if(remaining)fs.writeSync(fd,chunk.subarray(0,remaining));bytes+=chunk.length;if(bytes>32*1024*1024){spawnError='NATIVE_OUTPUT_LIMIT';child.kill('SIGTERM');}};
 child.stdout.on('data',capture(output));child.stderr.on('data',capture(error));
 const invoked=!!child.pid;
 // Durable actual child identity precedes delivery of the review prompt. A
 // killed outer worker cannot hide a still-running native process group.
 advice.atomic(path.join(dir,'custody.json'),{...r.custody,invoked,native_identity:require('./improve-process-identity.cjs').identity(child.pid)});
 child.on('error',e=>{spawnError=e.code;});child.stdin.on('error',()=>{});child.stdin.end(r.prompt);
 const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},r.timeoutMs);
 child.on('close',(status,signal)=>{clearTimeout(timer);fs.closeSync(output);fs.closeSync(error);advice.atomic(path.join(dir,'native-result.json'),{status,signal,invoked,error:timedOut?'ETIMEDOUT':spawnError});});
}else{
 const o=JSON.parse(fs.readFileSync(process.argv[2]));let result;
 try{result=advice.worker(o);}catch(e){result=e.code==='store_busy'?{status:'pending',liveness:'live',gate_decision:'pending'}:{status:'unavailable',scope_status:'unknown',clean:false,findings:advice.handoff(o).findings,gate_decision:'pending',invoked:false,mode:'not_invoked',cause:e.message};}
 advice.atomic(o.delivery,result);
}
