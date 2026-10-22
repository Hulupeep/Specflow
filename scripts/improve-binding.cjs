'use strict';
// Conservative local input identity, not a sandbox against hostile same-user processes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const digest=value=>sha(JSON.stringify(value));
const fileCache=new Map();
function fileIdentity(file) {
  const real=fs.realpathSync(file),before=token(fs.statSync(real,{bigint:true})),key=real+JSON.stringify(before);
  if(fileCache.has(key))return fileCache.get(key);
  const result={path:real,token:before,sha256:streamSha(real)};
  if(JSON.stringify(before)!==JSON.stringify(token(fs.statSync(real,{bigint:true}))))throw Error('Verifier input changed while hashing');
  fileCache.set(key,result);return result;
}
function git(cwd,args,options={}) {
  const r=spawnSync('git',args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024,...options});
  if(r.status!==0)throw Error('Input identity Git operation unavailable: '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
function token(s) {return [s.dev,s.ino,s.mode,s.size,s.mtimeNs,s.ctimeNs].map(String);}
// Default bounds keep the original conservative caps for contracts that declare
// no runtime identity. A contract may raise them (frozen, so bound); exceeding a
// bound fails closed and never truncates coverage (#176 REQ-RUNTIME-02).
const DEFAULT_LIMITS={max_bytes:256*1024*1024,max_entries:50000};
const CEILING={max_bytes:16*1024*1024*1024,max_entries:2000000};
function streamSha(file) {
  const hash=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buf=Buffer.allocUnsafe(1024*1024);
  try {let n;while((n=fs.readSync(fd,buf,0,buf.length,null))>0)hash.update(buf.subarray(0,n));}finally{fs.closeSync(fd);}
  return hash.digest('hex');
}
// Content cache for one process: a key includes inode, size, mtime and ctime,
// so any write (including a restored mtime) changes it and forces a rehash.
const contentCache=new Map();
function contentSha(file,tok) {
  const key=file+'\0'+tok.join(':');
  if(!contentCache.has(key))contentCache.set(key,streamSha(file));
  return contentCache.get(key);
}
function safeRel(rel) {
  return typeof rel==='string'&&rel.length>0&&!path.isAbsolute(rel)&&!rel.split('/').some(p=>!p||p==='.'||p==='..'||p==='.git')&&!rel.includes('\\');
}
// Disposable runtime outputs (e.g. `.next`, `test-results`) are produced by the
// frozen setup/serve/check commands from sealed inputs. They are wiped before
// setup, must be untracked, must not be symlinks, and are recorded by path
// rather than content. They cannot hide a consumed input because they start empty.
function validateOutputs(root,outputs) {
  const list=Array.isArray(outputs)?outputs:[];
  for(const rel of list) {
    if(!safeRel(rel))throw Error('Disposable output path is unsafe: '+rel);
    for(const other of list)if(other!==rel&&(other+'/').startsWith(rel+'/'))throw Error('Disposable outputs overlap: '+rel+', '+other);
    const file=path.join(root,rel);
    if(fs.existsSync(file)||isLink(file)) {if(fs.lstatSync(file).isSymbolicLink())throw Error('Disposable output is a symlink: '+rel);}
    if(git(root,['ls-files','-z','--',rel]))throw Error('Disposable output contains tracked inputs: '+rel);
  }
  return list;
}
function isLink(file) {try{return fs.lstatSync(file).isSymbolicLink();}catch{return false;}}
function wipeOutputs(root,outputs) {
  root=fs.realpathSync(root);
  for(const rel of validateOutputs(root,outputs))fs.rmSync(path.join(root,rel),{recursive:true,force:true});
}
function workspace(root,options={}) {
  root=fs.realpathSync(root);const entries=[];let size=0;
  const limits={...DEFAULT_LIMITS,...(options.limits||{})};
  const outputs=new Set(validateOutputs(root,options.outputs));
  function visit(rel) {
    if(rel==='.git')return;
    const file=path.join(root,rel),before=fs.lstatSync(file,{bigint:true});
    if(outputs.has(rel)) {
      if(before.isSymbolicLink())throw Error('Disposable output became a symlink: '+rel);
      entries.push({path:rel,kind:'disposable-output'});return;
    }
    if(entries.length>=limits.max_entries)throw Error(limits.max_entries===DEFAULT_LIMITS.max_entries?'Input tree exceeds 50000 entries':'Input tree exceeds '+limits.max_entries+' entries');
    const entry={path:rel,token:token(before)};entries.push(entry);
    if(before.isSymbolicLink()) {
      const target=fs.readlinkSync(file),real=fs.realpathSync(file);
      if(real!==root&&!real.startsWith(root+path.sep))throw Error('External symlink input is unsupported');
      entry.kind='symlink';entry.sha256=sha(target);
    } else if(before.isDirectory()) {
      entry.kind='directory';for(const name of fs.readdirSync(file).sort())visit(rel?rel+'/'+name:name);
    } else if(before.isFile()) {
      size+=Number(before.size);
      if(size>limits.max_bytes)throw Error(limits.max_bytes===DEFAULT_LIMITS.max_bytes?'Input tree exceeds 256 MiB':'Input tree exceeds '+limits.max_bytes+' bytes');
      entry.kind='file';entry.sha256=contentSha(file,entry.token);
    } else throw Error('Special input file is unsupported');
    if(JSON.stringify(token(before))!==JSON.stringify(token(fs.lstatSync(file,{bigint:true}))))throw Error('Input changed while identity was captured');
  }
  visit('');return {sha256:digest(entries),entries,bytes:size,limits};
}
function executable(command,cwd,env) {
  if(!Array.isArray(command)||!command.length||typeof command[0]!=='string')throw Error('Unsupported check command identity');
  const exe=command[0],candidates=exe.includes('/')?[path.resolve(cwd,exe)]:(env.PATH||'').split(path.delimiter).map(p=>path.resolve(cwd,p||'.',exe));
  for(const file of candidates) {
    try {fs.accessSync(file,fs.constants.X_OK);}catch{continue;}
    const real=fs.realpathSync(file);if(!fs.statSync(real).isFile())continue;
    const id=fileIdentity(real),root=fs.realpathSync(cwd);
    // A workspace-local tool (node_modules/.bin/...) is identified by its path
    // relative to the workspace and its bytes, so equivalent baseline and
    // candidate worktrees compare equal while changed bytes still differ.
    if(real.startsWith(root+path.sep))return {command,path:'{workspace}/'+path.relative(root,real),sha256:id.sha256,executable:true};
    return {command,...id};
  }
  throw Error('Check executable identity unavailable');
}
function verifier(contract,cwd,env,files) {
  const commands=[...(contract.acceptance||[]).flatMap(a=>[a.check?.command,a.dev_check?.command].filter(Boolean)),...(contract.gates||[]).map(g=>g.command)];
  if(contract.runtime?.serve?.command)commands.push(contract.runtime.serve.command);
  return digest({environment:Object.fromEntries(Object.entries(env).sort(([a],[b])=>a.localeCompare(b))),contract,
    node:{version:process.version,...fileIdentity(process.execPath)},
    files:files.map(fileIdentity),commands:commands.map(c=>executable(c,cwd,env))});
}
// Stage the exact Git product artifact and reject transformations that would
// retain bytes other than those tested. Ignored/generated inputs remain in the
// workspace identity even though they are not part of the retained Git tree.
function tree(root) {
  git(root,['add','-A']);
  const raw=spawnSync('git',['ls-files','--stage','-z'],{cwd:root,encoding:'utf8',maxBuffer:64*1024*1024});
  if(raw.status!==0)throw Error('Git index identity unavailable');
  for(const line of raw.stdout.split('\0').filter(Boolean)) {
    const match=/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]*)$/.exec(line);
    if(!match||match[3]!=='0'||!['100644','100755','120000'].includes(match[1]))throw Error('Unsupported Git index entry');
    const file=path.join(root,match[4]),stat=fs.lstatSync(file);
    const bytes=stat.isSymbolicLink()?Buffer.from(fs.readlinkSync(file)):fs.readFileSync(file);
    const mode=stat.isSymbolicLink()?'120000':stat.mode&0o111?'100755':'100644';
    if(mode!==match[1]||git(root,['hash-object','--no-filters','--stdin'],{input:bytes})!==match[2])throw Error('Git content transformation differs from verified bytes');
  }
  return {tree:git(root,['write-tree']),parent:git(root,['rev-parse','HEAD']),branch:git(root,['symbolic-ref','HEAD'])};
}
function retain(root,expected,message) {
  if(git(root,['symbolic-ref','HEAD'])!==expected.branch||git(root,['rev-parse','HEAD'])!==expected.parent)throw Error('Verified branch parent changed');
  const commit=git(root,['-c','user.name=specflow-improve','-c','user.email=specflow-improve@localhost','commit-tree',expected.tree,'-p',expected.parent,'-m',message]);
  git(root,['update-ref',expected.branch,commit,expected.parent]);return commit;
}
module.exports={sha,digest,workspace,wipeOutputs,validateOutputs,DEFAULT_LIMITS,CEILING,verifier,tree,retain};
