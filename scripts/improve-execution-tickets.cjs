'use strict';
// Dynamic host authority, deliberately separate from frozen program/task inputs.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),m=require('./improve-memory.cjs'),proc=require('./improve-process-identity.cjs'),{RecoveryError,assignment}=require('./improve-recovery-controller.cjs');
const need=(v,c)=>{if(!v)throw new RecoveryError(c);};
const privatePath=(...args)=>require('./improve-operation-receipts.cjs').privatePath(...args);
function directory(root,create=false){need(path.isAbsolute(root),'execution_ticket_private_root_required');for(let p=root;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))need(!fs.lstatSync(p).isSymbolicLink(),'execution_ticket_unsafe_path');if(create)fs.mkdirSync(root,{recursive:true,mode:0o700});privatePath(root,true);return root;}
function key(registry){const file=path.join(registry,'lease-key');privatePath(file);const bytes=fs.readFileSync(file);need(bytes.length===32,'execution_ticket_key_unavailable');return crypto.createHmac('sha256',bytes).update('specflow-execution-ticket/v2').digest();}
function mac(registry,body){return crypto.createHmac('sha256',key(registry)).update(m.canonical(body)).digest('hex');}
function frame(process){need(/^[a-f0-9-]{36}$/.test(process.boot_id)&&/^\d+$/.test(process.start),'invalid_process_identity');return process.boot_id+'-'+process.pid+'-'+process.start;}
function location(root,scope,process,create=false){need(m.token(scope.repo_id)&&m.token(scope.run_id),'execution_ticket_scope_required');directory(root,create);const dir=path.join(root,scope.repo_id,scope.run_id);directory(dir,create);return path.join(dir,frame(process)+'.json');}
function read(file,registry,scope){
 privatePath(file);need(fs.statSync(file).size<16384,'execution_ticket_invalid');const doc=JSON.parse(fs.readFileSync(file));m.shape(doc,['version','repo_id','run_id','generation','assignment','claimed_at_ms','seal']);assignment(doc.assignment);
 const {seal,...body}=doc;need(doc.version===2&&doc.repo_id===scope.repo_id&&doc.run_id===scope.run_id&&Number.isSafeInteger(doc.generation)&&doc.generation>0&&Number.isSafeInteger(doc.claimed_at_ms)&&m.sha(seal),'execution_ticket_invalid');need(crypto.timingSafeEqual(Buffer.from(seal,'hex'),Buffer.from(mac(registry,body),'hex')),'execution_ticket_integrity_failure');return doc;
}
function issue({root,registry,run}){
 need(root!==run.canonical_repo&&!path.resolve(root).startsWith(run.canonical_repo+path.sep),'execution_ticket_outside_repo_required');
 const body={version:2,repo_id:run.repo_id,run_id:run.id,generation:run.recovery.generation,assignment:structuredClone(run.recovery.current.assignment),claimed_at_ms:run.recovery.current.at_ms};
 const file=location(root,body,body.assignment.process,true),doc={...body,seal:mac(registry,body)};let duplicate=false;
 if(fs.existsSync(file)){need(m.canonical(read(file,registry,body))===m.canonical(doc),'execution_ticket_conflict');duplicate=true;}
 else {const tmp=file+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(doc));fs.fsyncSync(fd);fs.renameSync(tmp,file);require('./improve-kernel-lock.cjs').syncDir(path.dirname(file));}finally{fs.closeSync(fd);fs.rmSync(tmp,{force:true});}}
 return {id:m.digest(body),repo_id:body.repo_id,run_id:body.run_id,generation:body.generation,principal:body.assignment.principal,duplicate};
}
function resolve({root,registry,scope}){
 const seen=new Set();let pid=process.pid;
 for(let i=0;i<256&&pid>1&&!seen.has(pid);i++){
  seen.add(pid);const identity=proc.identity(pid);need(identity,'stale_execution_generation');let file;
  try{file=location(root,scope,identity);}catch(e){if(e.code!=='ENOENT')throw e;throw new RecoveryError('stale_execution_generation');}
  if(fs.existsSync(file)){const doc=read(file,registry,scope);need(m.digest(doc.assignment.process)===m.digest(identity)&&proc.state(identity)==='live','stale_execution_generation');return doc;}
  try{const text=fs.readFileSync('/proc/'+pid+'/stat','utf8'),fields=text.slice(text.lastIndexOf(')')+2).split(' ');need(proc.identity(pid)?.start===identity.start,'stale_execution_generation');pid=Number(fields[1]);}catch{throw new RecoveryError('stale_execution_generation');}
 }
 throw new RecoveryError('stale_execution_generation');
}
function current({root,registry,scope,store}){
 const doc=resolve({root,registry,scope}),file=path.join(store,'controller.json');privatePath(file);const r=JSON.parse(fs.readFileSync(file)).runs[scope.run_id];
 need(r&&r.recovery?.current&&r.repo_id===scope.repo_id&&r.policy_version===2&&r.recovery.generation===doc.generation&&m.digest(r.recovery.authorised)===m.digest(doc.assignment)&&m.digest(r.recovery.current?.assignment)===m.digest(doc.assignment),'stale_execution_generation');return doc;
}
module.exports={issue,resolve,current,location};
