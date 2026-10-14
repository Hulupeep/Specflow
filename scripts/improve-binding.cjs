'use strict';
// Conservative local input identity, not a sandbox against hostile same-user processes.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const digest=value=>sha(JSON.stringify(value));
const fileCache=new Map();
function fileIdentity(file) {
  const real=fs.realpathSync(file),before=token(fs.statSync(real,{bigint:true})),key=real+JSON.stringify(before);
  if(fileCache.has(key))return fileCache.get(key);
  const result={path:real,token:before,sha256:sha(fs.readFileSync(real))};
  if(JSON.stringify(before)!==JSON.stringify(token(fs.statSync(real,{bigint:true}))))throw Error('Verifier input changed while hashing');
  fileCache.set(key,result);return result;
}
function git(cwd,args,options={}) {
  const r=spawnSync('git',args,{cwd,encoding:'utf8',maxBuffer:64*1024*1024,...options});
  if(r.status!==0)throw Error('Input identity Git operation unavailable: '+(r.stderr||r.error?.message||r.status));
  return r.stdout.trim();
}
function token(s) {return [s.dev,s.ino,s.mode,s.size,s.mtimeNs,s.ctimeNs].map(String);}
function workspace(root) {
  root=fs.realpathSync(root);const entries=[];let size=0;
  function visit(rel) {
    if(rel==='.git')return;
    const file=path.join(root,rel),before=fs.lstatSync(file,{bigint:true});
    if(entries.length>=50000)throw Error('Input tree exceeds 50000 entries');
    const entry={path:rel,token:token(before)};entries.push(entry);
    if(before.isSymbolicLink()) {
      const target=fs.readlinkSync(file),real=fs.realpathSync(file);
      if(real!==root&&!real.startsWith(root+path.sep))throw Error('External symlink input is unsupported');
      entry.kind='symlink';entry.sha256=sha(target);
    } else if(before.isDirectory()) {
      entry.kind='directory';for(const name of fs.readdirSync(file).sort())visit(rel?rel+'/'+name:name);
    } else if(before.isFile()) {
      size+=Number(before.size);if(size>256*1024*1024)throw Error('Input tree exceeds 256 MiB');
      entry.kind='file';entry.sha256=sha(fs.readFileSync(file));
    } else throw Error('Special input file is unsupported');
    if(JSON.stringify(token(before))!==JSON.stringify(token(fs.lstatSync(file,{bigint:true}))))throw Error('Input changed while identity was captured');
  }
  visit('');return {sha256:digest(entries),entries};
}
function executable(command,cwd,env) {
  if(!Array.isArray(command)||!command.length||typeof command[0]!=='string')throw Error('Unsupported check command identity');
  const exe=command[0],candidates=exe.includes('/')?[path.resolve(cwd,exe)]:(env.PATH||'').split(path.delimiter).map(p=>path.resolve(cwd,p||'.',exe));
  for(const file of candidates) {
    try {fs.accessSync(file,fs.constants.X_OK);}catch{continue;}
    const real=fs.realpathSync(file);if(!fs.statSync(real).isFile())continue;
    return {command,...fileIdentity(real)};
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
module.exports={sha,digest,workspace,verifier,tree,retain};
