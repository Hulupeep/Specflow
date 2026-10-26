'use strict';
// Explicit owner-host migration, one dedicated registry/controller inventory.
// Unknown legacy mutexes are never removed. This does not migrate pinned code.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),kernel=require('./improve-kernel-lock.cjs'),proc=require('./improve-process-identity.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw new kernel.KernelLockError(code);};
function privateFile(file){const s=fs.lstatSync(file);need(!s.isSymbolicLink()&&s.isFile()&&s.uid===process.getuid()&&!(s.mode&0o077)&&s.nlink===1&&s.size<16*1024*1024,'migration_private_source_required');return s;}
function read(file){privateFile(file);return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,doc){const tmp=file+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(tmp,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(doc));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}fs.renameSync(tmp,file);kernel.syncDir(path.dirname(file));}
function keyFor({store,registry,request,principal}){return hash(JSON.stringify([principal,request.repo_id,request.request_id,store.root,registry]));}
function recoverAuthority(options){
 const {store,registry,recovery}=options,dir=path.join(registry,'.authority-lock');
 if(!fs.existsSync(dir)||fs.existsSync(path.join(dir,'kernel-v2.lock')))return;
 const intentFile=path.join(store.root,'migration-v2.json'),marker=path.join(registry,'.migration-v2.json');
 if(!fs.existsSync(intentFile)||!fs.existsSync(marker))return;
 const inventory=recovery.migration;need(inventory?.dedicated===true&&inventory.stores?.length===1&&path.resolve(inventory.stores[0])===store.root,'legacy_recovery_unavailable');
 const intent=read(intentFile),proof=read(path.join(dir,'.migration-owner.json')),key=keyFor(options);
 need(intent.key===key&&proof.key===key&&read(marker).key===key&&JSON.stringify(proof)===JSON.stringify(intent),'migration_binding_mismatch');
 const own=proc.identity(),same=own&&intent.holder?.pid===own.pid&&intent.holder.start===own.start&&intent.holder.boot_id===own.boot_id;
 need(same||proc.state(intent.holder)==='dead','migration_holder_unresolved');
 const stat=fs.lstatSync(dir);need(stat.isDirectory()&&!stat.isSymbolicLink()&&stat.uid===process.getuid()&&!(stat.mode&0o077)&&
  stat.dev===intent.authority_inode.dev&&stat.ino===intent.authority_inode.ino&&proof.origin_sha256===intent.origin_sha256,'migration_inode_changed');
 need(hash(fs.readFileSync(store.file))===intent.origin_sha256,'migration_snapshot_changed');
 kernel.prepareAuthority(registry,recovery.lockTool,{legacyOwned:true});
}
function migrate({store,registry,recovery,request,principal,fault=()=>{}}){
 const inventory=recovery.migration;
 need(recovery.format===2&&inventory?.dedicated===true&&Array.isArray(inventory.stores)&&inventory.stores.length===1&&
  path.resolve(inventory.stores[0])===store.root,'legacy_recovery_unavailable');
 const marker=path.join(registry,'.migration-v2.json'),intentFile=path.join(store.root,'migration-v2.json');
 const key=keyFor({store,registry,request,principal});
 let intent=fs.existsSync(intentFile)?read(intentFile):null;
 if(intent){need(intent.key===key,'migration_idempotency_conflict');if(intent.status==='complete'||read(marker).status==='complete'){
  const current=store.read();need(current.version===2&&read(marker).status==='complete'&&current.history.some(e=>e.event==='recovery_migration'&&e.key===key&&e.original_sha256===intent.origin_sha256),'recovery_migration_incomplete');
  if(intent.status!=='complete')write(intentFile,{...intent,status:'complete'});return {allowed:true,reason_code:null};
 }}
 let state=store.read();
 need(state.version===1||intent,'migration_not_legacy');
 const quiescent=s=>Object.values(s.runs).every(r=>!r.active_cycle&&!r.active_stage&&r.operations.every(o=>o.state==='complete')&&!r.reasons.includes('reconciliation_required'));
 need(quiescent(state),'migration_work_not_quiescent');
 let legacyFd=null,permanent=false;
 try{
  if(!intent){
   try{legacyFd=fs.openSync(store.lock,'wx',0o600);}catch(e){if(e.code==='EEXIST')throw new kernel.KernelLockError('legacy_recovery_unavailable');throw e;}
   fs.writeFileSync(legacyFd,JSON.stringify({pid:process.pid,started_at:new Date().toISOString()}));fs.fsyncSync(legacyFd);
   // Re-read only after both legacy mutexes exclude protected transitions.
   state=store.read();need(state.version===1&&quiescent(state),'migration_work_not_quiescent');
   const stat=fs.fstatSync(legacyFd),bytes=fs.readFileSync(store.file),authority=fs.lstatSync(path.join(registry,'.authority-lock'));
   intent={version:2,key,status:'pending',request_id:request.request_id,repo_id:request.repo_id,principal,origin_sha256:hash(bytes),
    inode:{dev:stat.dev,ino:stat.ino},authority_inode:{dev:authority.dev,ino:authority.ino},holder:proc.identity(),history_length:state.history.length};
   need(intent.holder,'migration_process_identity_unavailable');
   write(path.join(registry,'.authority-lock','.migration-owner.json'),intent);write(intentFile,intent);write(marker,{version:2,key,status:'pending',store:store.root});fault('migration_intent');
  }else{
   need(read(marker).key===key,'migration_binding_mismatch');
   const holder=proc.state(intent.holder),own=proc.identity(),same=own&&intent.holder.pid===own.pid&&intent.holder.start===own.start&&intent.holder.boot_id===own.boot_id;
   need(holder==='dead'||same,'migration_holder_unresolved');
  }
  kernel.prepareAuthority(registry,recovery.lockTool,{legacyOwned:true});permanent=true;fault('migration_authority_fenced');
  let isKernel=false;try{kernel.header(store.lock,recovery.lockTool);isKernel=true;}catch(e){if(!['legacy_recovery_unavailable','recovery_initialization_incomplete'].includes(e.code))throw e;}
  if(!isKernel){
   const stat=privateFile(store.lock);need(stat.dev===intent.inode.dev&&stat.ino===intent.inode.ino,'migration_inode_changed');
   need(hash(fs.readFileSync(store.file))===intent.origin_sha256,'migration_snapshot_changed');
   const fd=legacyFd===null?fs.openSync(store.lock,fs.constants.O_RDWR|fs.constants.O_NOFOLLOW):legacyFd;
   try{const header={format:'specflow-flock/v2',uid:process.getuid(),tool_sha256:recovery.lockTool.sha256,nonce:crypto.randomUUID()},bytes=Buffer.from(JSON.stringify(header));
    fs.writeSync(fd,bytes,0,bytes.length,0);fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd);
   }finally{if(legacyFd===null)fs.closeSync(fd);}
  }
  fault('migration_writer_fenced');
  kernel.withLock(store.lock,recovery.lockTool,()=>{
   const current=store.read();
   if(current.version===1){need(hash(fs.readFileSync(store.file))===intent.origin_sha256,'migration_snapshot_changed');
    const migrated=structuredClone(current);migrated.version=2;migrated.revision++;
    migrated.history.push({event:'recovery_migration',at_ms:Date.now(),run_id:null,key,original_sha256:intent.origin_sha256,principal});
    write(store.file,migrated);
   }else need(current.history.some(e=>e.event==='recovery_migration'&&e.key===key&&e.original_sha256===intent.origin_sha256),'migration_receipt_unavailable');
   fault('migration_state_committed');
   write(marker,{version:2,key,status:'complete',store:store.root});fault('migration_marker_committed');write(intentFile,{...intent,status:'complete'});
  });
  return {allowed:true,reason_code:null};
 }finally{
  const owned=legacyFd!==null?fs.fstatSync(legacyFd):null;
  if(legacyFd!==null)fs.closeSync(legacyFd);
  // Before a durable migration intent, this invocation still owns an ordinary
  // live v1 mutex. After intent/fencing, retain every byte for reconciliation.
  if(owned&&!fs.existsSync(intentFile)&&!permanent&&fs.existsSync(store.lock)){
   const current=fs.lstatSync(store.lock);if(current.dev===owned.dev&&current.ino===owned.ino)fs.unlinkSync(store.lock);
  }
 }
}
module.exports={migrate,recoverAuthority};
