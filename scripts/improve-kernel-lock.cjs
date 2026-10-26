'use strict';
// Explicit Linux v2 owner-host mutex. Permanent inode; kernel releases on death.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
class KernelLockError extends Error{constructor(code){super(code);this.code=code;}}
const need=(ok,code)=>{if(!ok)throw new KernelLockError(code);};
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function noLinks(file){need(path.isAbsolute(file),'kernel_private_path_required');for(let p=file;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p))need(!fs.lstatSync(p).isSymbolicLink(),'kernel_unsafe_path');}
function directory(dir){noLinks(dir);const s=fs.statSync(dir);need(s.isDirectory()&&s.uid===process.getuid()&&!(s.mode&0o077),'kernel_private_path_required');return dir;}
function syncDir(dir){const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
function tool(value){
 need(process.platform==='linux'&&value&&value.path==='/usr/bin/flock'&&/^[a-f0-9]{64}$/.test(value.sha256)&&typeof value.version==='string','kernel_capability_unavailable');
 noLinks(value.path);need(sha(fs.readFileSync(value.path))===value.sha256,'kernel_tool_changed');
 const r=cp.spawnSync(value.path,['--version'],{encoding:'utf8',timeout:5000,maxBuffer:65536,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent'}});
 need(r.status===0&&r.stdout.trim()===value.version,'kernel_tool_changed');return value;
}
function header(file,value){
 noLinks(file);const s=fs.lstatSync(file);need(s.isFile()&&s.uid===process.getuid()&&!(s.mode&0o077)&&s.size<=4096,'kernel_private_path_required');
 let h;try{h=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new KernelLockError('recovery_initialization_incomplete');}
 need(h.format==='specflow-flock/v2'&&h.uid===process.getuid()&&h.tool_sha256===value.sha256&&/^[a-f0-9-]{36}$/.test(h.nonce),'legacy_recovery_unavailable');
 const aliases=[],name='.kernel-init-'+h.nonce;
 need(s.nlink<=2,'kernel_unexpected_link');
 if(s.nlink===2){
  try{const alias=fs.lstatSync(path.join(path.dirname(file),name));need(alias.ino===s.ino&&alias.dev===s.dev,'kernel_unexpected_link');aliases.push(name);}
  catch(e){if(e.code!=='ENOENT')throw e;need(fs.lstatSync(file).nlink===1,'kernel_unexpected_link');}
 }
 return {s,h,aliases};
}
function prepare(file,value,{fault=()=>{}}={}){
 tool(value);directory(path.dirname(file));
 if(fs.existsSync(file))return header(file,value);
 const nonce=crypto.randomUUID(),candidate=path.join(path.dirname(file),'.kernel-init-'+nonce),doc={format:'specflow-flock/v2',uid:process.getuid(),tool_sha256:value.sha256,nonce};
 const fd=fs.openSync(candidate,'wx',0o600);
 try{
  fs.writeFileSync(fd,JSON.stringify(doc));fs.fsyncSync(fd);fault('kernel_candidate_synced');
  try{fs.linkSync(candidate,file);}catch(e){if(e.code!=='EEXIST')throw e;}
  fault('kernel_linked');syncDir(path.dirname(file));fault('kernel_directory_synced');
 }finally{fs.closeSync(fd);fs.rmSync(candidate,{force:true});}
 return header(file,value);
}
function withLock(file,value,fn,{create=false,fault=()=>{}}={}){
 tool(value);directory(path.dirname(file));if(create)prepare(file,value,{fault});
 let before;try{before=header(file,value);}catch(e){if(e.code==='ENOENT')throw new KernelLockError('recovery_initialization_incomplete');throw e;}
 const fd=fs.openSync(file,fs.constants.O_RDWR|fs.constants.O_NOFOLLOW);
 try{
  const own=fs.fstatSync(fd);need(own.ino===before.s.ino&&own.dev===before.s.dev,'kernel_inode_changed');
  const result=cp.spawnSync(value.path,['--exclusive','--nonblock','3'],{stdio:['ignore','pipe','pipe',fd],timeout:5000,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent'}});
  if(result.status===1)throw new KernelLockError('store_busy');need(result.status===0,'kernel_capability_unavailable');
  const current=header(file,value);need(current.s.ino===own.ino&&current.s.dev===own.dev,'kernel_inode_changed');
  for(const name of current.aliases)fs.rmSync(path.join(path.dirname(file),name),{force:true});
  fault('kernel_acquired');const out=fn();need(!out||typeof out.then!=='function','kernel_synchronous_transition_required');return out;
 }finally{fs.closeSync(fd);}
}
function initMarker(file,doc){
 const tmp=file+'.'+crypto.randomUUID()+'.tmp',fd=fs.openSync(tmp,'wx',0o600);
 try{fs.writeFileSync(fd,JSON.stringify(doc));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
 fs.renameSync(tmp,file);syncDir(path.dirname(file));
}
function readInit(file,registry,value){
 noLinks(file);const s=fs.lstatSync(file);need(s.isFile()&&s.uid===process.getuid()&&!(s.mode&0o077)&&s.nlink===1&&s.size<=4096,'recovery_initialization_incomplete');
 let doc;try{doc=JSON.parse(fs.readFileSync(file,'utf8'));}catch{throw new KernelLockError('recovery_initialization_incomplete');}
 need(doc.format==='specflow-authority-init/v2'&&doc.registry===sha(registry)&&doc.uid===process.getuid()&&doc.tool_sha256===value.sha256&&typeof doc.nonce==='string','recovery_initialization_incomplete');return doc;
}
function prepareAuthority(registry,value,{legacyOwned=false,completeInitialization=false,fault=()=>{}}={}){
 directory(registry);tool(value);const dir=path.join(registry,'.authority-lock'),file=path.join(dir,'kernel-v2.lock'),marker=path.join(registry,'.authority-init-v2.json');
 let init=fs.existsSync(marker)?readInit(marker,registry,value):null;
 if(fs.existsSync(file)){
  directory(dir);const found=header(file,value);
  if(init){const st=fs.lstatSync(dir);need(init.directory?.dev===st.dev&&init.directory?.ino===st.ino,'recovery_initialization_incomplete');
   if(init.status==='complete')need(init.kernel.dev===found.s.dev&&init.kernel.ino===found.s.ino,'kernel_inode_changed');
   else initMarker(marker,{...init,status:'complete',kernel:{dev:found.s.dev,ino:found.s.ino}});
  }return file;
 }
 if(legacyOwned){need(fs.existsSync(dir),'legacy_recovery_unavailable');prepare(file,value,{fault});return file;}
 if(fs.existsSync(dir)){
  need(init,'legacy_recovery_unavailable');directory(dir);const st=fs.lstatSync(dir);
  need(init.status==='pending'&&init.directory?.dev===st.dev&&init.directory?.ino===st.ino&&fs.readdirSync(dir).length===0&&
   fs.readdirSync(registry).every(n=>['.authority-lock','.authority-init-v2.json'].includes(n)),'recovery_initialization_incomplete');
  need(completeInitialization,'recovery_initialization_incomplete');
 }else{
  if(init)need(init.status==='pending'&&!init.directory,'recovery_initialization_incomplete');
  else{
   need(fs.readdirSync(registry).length===0,'legacy_recovery_unavailable');
   const doc={format:'specflow-authority-init/v2',registry:sha(registry),uid:process.getuid(),tool_sha256:value.sha256,nonce:crypto.randomUUID(),status:'pending',directory:null};
   const fd=fs.openSync(marker,'wx',0o600);try{fs.writeFileSync(fd,JSON.stringify(doc));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}syncDir(registry);init=doc;
  }
  try{fs.mkdirSync(dir,{mode:0o700});}catch(e){if(e.code==='EEXIST')throw new KernelLockError('recovery_initialization_incomplete');throw e;}
  fault('kernel_authority_directory_unbound');const st=fs.lstatSync(dir);init={...init,directory:{dev:st.dev,ino:st.ino}};initMarker(marker,init);
  fault('kernel_authority_directory_created');
 }
 prepare(file,value,{fault});const st=fs.lstatSync(file);initMarker(marker,{...init,status:'complete',kernel:{dev:st.dev,ino:st.ino}});return file;
}
const completeAuthorityInitialization=(registry,value)=>prepareAuthority(registry,value,{completeInitialization:true});
module.exports={KernelLockError,tool,header,prepare,withLock,prepareAuthority,completeAuthorityInitialization,syncDir};
