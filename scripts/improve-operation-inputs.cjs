'use strict';
// Hash owner-declared stage inputs, including bytes behind file arguments.
const fs=require('fs'),path=require('path'),m=require('./improve-memory.cjs'),{RecoveryError}=require('./improve-recovery-controller.cjs');
function inputDigest(stage,args,configFile,includeState,reviewHash){
 const files=new Map();let bytes=0;
 function add(file){
  if(!path.isAbsolute(file)||!fs.existsSync(file))return;
  for(let p=file;p!==path.dirname(p);p=path.dirname(p))if(fs.lstatSync(p).isSymbolicLink())throw new RecoveryError('stage_input_symlink');
  const before=fs.statSync(file,{bigint:true});if(before.isDirectory())return;
  if(!before.isFile()||before.size>32n*1024n*1024n||files.size>=256)throw new RecoveryError('stage_input_unavailable');
  if(files.has(file))return;const raw=fs.readFileSync(file);bytes+=raw.length;if(bytes>64*1024*1024)throw new RecoveryError('stage_input_unavailable');const after=fs.statSync(file,{bigint:true});
  if(['dev','ino','size','mtimeNs','ctimeNs'].some(k=>before[k]!==after[k]))throw new RecoveryError('stage_input_changed');files.set(file,m.hash(raw));
 }
 const visit=v=>{if(typeof v==='string')add(v);else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};
 visit(args);if(configFile)add(configFile);
 if(includeState&&typeof args[0]==='string'&&path.isAbsolute(args[0]))for(const name of ['run.json','ledger.jsonl','candidates.json'])add(path.join(args[0],name));
 return m.digest({stage,args,files:[...files].sort(([a],[b])=>a<b?-1:a>b?1:0),...(reviewHash===undefined?{}:{review_input_sha256:reviewHash})});
}
function stageInput(stage,args,configFile,reviewHash){return inputDigest(stage,args,configFile,true,reviewHash);}
// Caller-declared input only: automatic ledger state and memory injection are not repairs.
function reviewInput(stage,args){return inputDigest(stage,args,undefined,false);}
module.exports={stageInput,reviewInput};
