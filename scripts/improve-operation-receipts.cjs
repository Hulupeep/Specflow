'use strict';
// Host-only, integrity-bound completion evidence. No caller-provided path/key.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),k=require('./improve-kernel-lock.cjs'),m=require('./improve-memory.cjs'),{RecoveryError}=require('./improve-recovery-controller.cjs');
const need=(v,code)=>{if(!v)throw new RecoveryError(code);};
function privatePath(file,directory=false){
 need(path.isAbsolute(file),'receipt_private_source_required');for(let p=file;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))need(!fs.lstatSync(p).isSymbolicLink(),'receipt_unsafe_source');
 const s=fs.statSync(file);need(s.uid===process.getuid()&&!(s.mode&0o077)&&(directory?s.isDirectory():s.isFile()&&s.nlink===1&&s.size<=16*1024*1024),'receipt_private_source_required');return s;
}
function shape(v,keys){need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(x=>keys.includes(x))&&keys.every(x=>Object.hasOwn(v,x)),'invalid_operation_receipt');}
function binding(v){shape(v,['run_id','cycle_id','operation_id','generation','principal','repo_id','profile_revision','input_sha256']);need(['run_id','cycle_id','operation_id','principal','repo_id'].every(x=>m.token(v[x]))&&Number.isSafeInteger(v.generation)&&v.generation>0&&m.sha(v.profile_revision)&&m.sha(v.input_sha256),'invalid_operation_receipt');return structuredClone(v);}
function result(v){shape(v,['exit_code','reason_code','estimate_usd']);need(Number.isInteger(v.exit_code)&&(v.reason_code===null||m.token(v.reason_code))&&(v.estimate_usd===null||typeof v.estimate_usd==='number'&&Number.isFinite(v.estimate_usd)&&v.estimate_usd>=0),'invalid_operation_receipt');return structuredClone(v);}
class OperationReceipts{
 constructor({root,registry,lockTool,create=false,fault=()=>{}}){
  need(path.isAbsolute(root)&&path.isAbsolute(registry),'receipt_private_source_required');if(create)fs.mkdirSync(root,{recursive:true,mode:0o700});privatePath(root,true);this.root=root;this.tool=lockTool;this.fault=fault;
  const key=path.join(registry,'lease-key');privatePath(key);const raw=fs.readFileSync(key);need(raw.length===32,'receipt_key_unavailable');this.key=crypto.createHmac('sha256',raw).update('specflow-operation-receipts/v2').digest();
  for(const name of ['blobs','receipts']){const dir=path.join(root,name);if(create)fs.mkdirSync(dir,{mode:0o700,recursive:true});privatePath(dir,true);}
 }
 mac(body){return crypto.createHmac('sha256',this.key).update(m.canonical(body)).digest('hex');}
 publish(file,bytes){
  if(fs.existsSync(file)){privatePath(file);need(fs.readFileSync(file).equals(bytes),'receipt_idempotency_conflict');return;}
  const tmp=file+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(tmp,'wx',0o600);
  // All publication is under receipt.lock; atomic rename cannot expose a
  // half-written file or leave a second hard-link after process death.
  try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);this.fault('receipt_file_synced',{kind:path.basename(path.dirname(file))});fs.renameSync(tmp,file);this.fault('receipt_renamed',{kind:path.basename(path.dirname(file))});}finally{fs.closeSync(fd);fs.rmSync(tmp,{force:true});}
  k.syncDir(path.dirname(file));this.fault('receipt_directory_synced',{kind:path.basename(path.dirname(file))});
 }
 get(id){
  need(m.token(id),'invalid_receipt_id');const file=path.join(this.root,'receipts',id+'.json');privatePath(file);let doc;
  try{doc=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new RecoveryError('receipt_corrupt');}
  shape(doc,['version','id','binding','phase','result','stdout_sha256','stderr_sha256','seal']);binding(doc.binding);result(doc.result);
  need(doc.version===2&&doc.id===id&&['complete','not_started'].includes(doc.phase)&&m.sha(doc.stdout_sha256)&&m.sha(doc.stderr_sha256)&&m.sha(doc.seal),'invalid_operation_receipt');
  const {seal,...body}=doc;need(crypto.timingSafeEqual(Buffer.from(seal,'hex'),Buffer.from(this.mac(body),'hex')),'receipt_integrity_failure');
  for(const hash of [doc.stdout_sha256,doc.stderr_sha256]){const blob=path.join(this.root,'blobs',hash);privatePath(blob);need(m.hash(fs.readFileSync(blob))===hash,'receipt_evidence_changed');}
  return structuredClone(doc);
 }
 put({binding:identity,phase='complete',result:outcome,stdout='',stderr=''}){
  const b=binding(identity),r=result(outcome);need(['complete','not_started'].includes(phase)&&typeof stdout==='string'&&typeof stderr==='string'&&Buffer.byteLength(stdout)+Buffer.byteLength(stderr)<=8*1024*1024,'invalid_operation_receipt');
  const body={version:2,id:b.operation_id,binding:b,phase,result:r,stdout_sha256:m.hash(stdout),stderr_sha256:m.hash(stderr)},doc={...body,seal:this.mac(body)};
  return k.withLock(path.join(this.root,'receipt.lock'),this.tool,()=>{
   const file=path.join(this.root,'receipts',doc.id+'.json');
   if(fs.existsSync(file)){const old=this.get(doc.id);need(same(old,doc),'receipt_idempotency_conflict');return old;}
   this.publish(path.join(this.root,'blobs',body.stdout_sha256),Buffer.from(stdout));this.publish(path.join(this.root,'blobs',body.stderr_sha256),Buffer.from(stderr));this.fault('receipt_blobs_synced');
   this.publish(file,Buffer.from(JSON.stringify(doc)));this.fault('receipt_published');return this.get(doc.id);
  },{create:true});
 }
}
const same=(a,b)=>m.canonical(a)===m.canonical(b);
function forOperation(run,op){return {run_id:run.id,cycle_id:op.cycle_id,operation_id:op.id,generation:op.generation,principal:op.assignment.principal,repo_id:run.repo_id,profile_revision:run.profile_revision,input_sha256:op.input_sha256};}
module.exports={OperationReceipts,binding,result,privatePath,forOperation};
