'use strict';
// Preparation experiment only. Real Linux process/kernel lock, no controller writes.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto');
function lock(file){const fd=fs.openSync(file,'a',0o600),r=cp.spawnSync('/usr/bin/flock',['--exclusive','--nonblock','3'],{stdio:['ignore','pipe','pipe',fd]});return {fd,status:r.status};}
if(process.argv[2]==='hold'){
 const held=lock(process.argv[3]);if(held.status!==0)process.exit(2);
 process.stdout.write('locked\n');setInterval(()=>{},1000);
}else{
 (async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'specflow-recovery-lock-')),file=path.join(root,'writer.lock');let child,executed=0;
  const check=(ok,why)=>{if(!ok)throw Error(why);executed++;};
  try{
   check(process.platform==='linux','Only qualified Linux kernel mode');
   const executable=fs.realpathSync('/usr/bin/flock'),version=cp.execFileSync(executable,['--version'],{encoding:'utf8'}).trim(),sha256=crypto.createHash('sha256').update(fs.readFileSync(executable)).digest('hex');
   child=cp.spawn(process.execPath,[__filename,'hold',file],{stdio:['ignore','pipe','pipe']});
   await new Promise((resolve,reject)=>{child.stdout.once('data',b=>b.toString()==='locked\n'?resolve():reject(Error('Bad child ack')));child.once('error',reject);child.once('exit',c=>reject(Error('Child exited '+c)));});
   check(child.pid>1,'Real holder running');const competing=lock(file);fs.closeSync(competing.fd);check(competing.status===1,'Kernel excludes another host after helper exited');
   const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.kill('SIGKILL');const termination=await ended;
   check(termination.signal==='SIGKILL','Actual holder interruption');const successor=lock(file);check(successor.status===0,'Kernel releases after SIGKILL');fs.closeSync(successor.fd);
   check((fs.statSync(file).mode&0o077)===0,'Private permanent inode remains');
   console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'Preparation capability only; no production recovery/lease/receipt proof',platform:process.platform,tool:{path:executable,version,sha256},termination}));
  }finally{if(child?.exitCode===null&&child?.signalCode===null)child.kill('SIGKILL');fs.rmSync(root,{recursive:true,force:true});}
 })().catch(e=>{console.error(e.message);process.exitCode=2;});
}
