'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const base = root => path.join(root,'.specflow/duo');
const helpers = ['duo-build.cjs','duo-progress.cjs','duo-direction.cjs','duo-actions.cjs','duo-cadence.cjs','duo-runtime.cjs','typesafe-duo.cjs','typesafe-client.cjs','typesafe-questions.cjs','typesafe-actions.cjs'];
const read = file => JSON.parse(fs.readFileSync(noLinks(file),'utf8'));
function write(file,value) { noLinks(file); fs.mkdirSync(path.dirname(file),{recursive:true}); const tmp=file+'.tmp-'+process.pid; fs.writeFileSync(tmp,JSON.stringify(value,null,2)); fs.renameSync(tmp,file); }
function noLinks(file) {
  for(let p=path.resolve(file);p!==path.dirname(p);p=path.dirname(p)) if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()) throw Error('Runtime path must not follow symlinks');
  return file;
}
function lock(root, fn) {
  const dir=base(root); noLinks(dir); fs.mkdirSync(dir,{recursive:true});
  const file=path.join(dir,'installer.lock');
  try { fs.mkdirSync(file); } catch(e) { if(e.code==='EEXIST') throw Error('Duo installation/start lock active; inspect the owner before recovery'); throw e; }
  fs.writeFileSync(path.join(file,'pid'),String(process.pid));
  try { return fn(); } finally { fs.rmSync(file,{recursive:true}); }
}
function pin(root,dir,builder) {
  const helperHashes={}, skillHashes={}, destination=path.join(dir,'runtime');
  for(const name of helpers) {
    const file=path.join(__dirname,name); if(!fs.existsSync(file)) continue;
    const bytes=fs.readFileSync(noLinks(file)), rel='scripts/'+name;
    fs.mkdirSync(path.join(destination,'scripts'),{recursive:true}); fs.writeFileSync(path.join(destination,rel),bytes); helperHashes[rel]=hash(bytes);
  }
  const candidates = [path.resolve(__dirname,'../skills/duo-build/SKILL.md'),path.join(root,builder==='claude-code'?'.claude/skills/duo-build/SKILL.md':'.agents/skills/duo-build/SKILL.md')];
  const skill=candidates.find(f=>fs.existsSync(f));
  if(skill) { const bytes=fs.readFileSync(noLinks(skill)); fs.writeFileSync(path.join(destination,'SKILL.md'),bytes); skillHashes['SKILL.md']=hash(bytes); }
  const result={protocolVersion:'duo-actions-1',helperHashes,skillHashes,provenance:'recorded',identity:hash(JSON.stringify({helperHashes,skillHashes}))};
  write(path.join(destination,'manifest.json'),result);return result;
}
function verify(dir,runtime) {
  for(const [rel,sha] of Object.entries({...runtime.helperHashes,...runtime.skillHashes})) if(hash(fs.readFileSync(noLinks(path.join(dir,'runtime',rel))))!==sha) throw Error(`Pinned duo runtime modified: ${rel}`);
}
function dispatch(root,id,current) {
  if(!/^[A-Za-z0-9-]+$/.test(id||'')) return null;
  const dir=path.join(base(root),id),file=path.join(dir,'run.json');if(!fs.existsSync(file))return null;
  const state=read(file); if(!state.runtime || state.runtime.provenance==='legacy_unknown')return null;
  verify(dir,state.runtime);
  const pinned=path.join(dir,'runtime/scripts');return path.resolve(current)===path.resolve(pinned)?null:pinned;
}
function unfinished(root) {
  if(!fs.existsSync(base(root)))return [];
  return fs.readdirSync(base(root)).filter(id=>fs.existsSync(path.join(base(root),id,'run.json'))).filter(id=>{const state=read(path.join(base(root),id,'run.json'));return state.goalStatus!=='complete'&&!state.runtimeCeased;});
}
function bundle(source) {
  const result={};
  const put=(rel,file)=>{if(fs.existsSync(file)) result[rel]=fs.readFileSync(noLinks(file),'utf8');};
  for(const name of helpers)put('scripts/'+name,path.join(source,'scripts',name));
  for(const target of ['.claude','.codex','.agents'])put(`${target}/skills/duo-build/SKILL.md`,path.join(source,'skills/duo-build/SKILL.md'));
  put('.claude/hooks/duo-review-check.sh',path.join(source,'hooks/duo-review-check.sh'));
  return result;
}
function install(source,root,{held=false,beforeWrite}={}) {
  if(!held)return lock(root,()=>install(source,root,{held:true,beforeWrite}));
  const dir=path.join(base(root),'runtime-update'), next=bundle(source), stagedVersion=hash(JSON.stringify(next)), pendingRunIds=unfinished(root);
  const ownedFile=path.join(dir,'installed.json'), previous=fs.existsSync(ownedFile)?read(ownedFile):{hashes:{}};
  if(pendingRunIds.length) {
    write(path.join(dir,'staged.json'),{files:next,stagedVersion,pendingRunIds});
    return {state:'staged',pendingRunIds,activeVersion:previous.version||'legacy_unknown',stagedVersion,reason:'Unfinished runs retain their exact installation; rerun the installer after completion. Reload the native skill in a new conversation.'};
  }
  const before={},modes={};
  for(const rel of Object.keys(next)) {
    const file=noLinks(path.join(root,rel));before[rel]=fs.existsSync(file)?fs.readFileSync(file):null;modes[rel]=before[rel]?fs.statSync(file).mode & 0o777:null;
    if(before[rel] && hash(before[rel])!==hash(next[rel]) && previous.hashes[rel]!==hash(before[rel])) throw Error(`Custom or unowned duo file preserved: ${rel}; compare it before installation`);
  }
  const written=[];
  try {
    for(const [rel,bytes] of Object.entries(next)) {
      if(beforeWrite)beforeWrite(rel);
      const file=path.join(root,rel),current=fs.existsSync(file)?fs.readFileSync(noLinks(file)):null;
      if((current&&hash(current))!==(before[rel]&&hash(before[rel])))throw Error(`Concurrent installation change: ${rel}`);
      fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.duo-tmp',bytes);fs.chmodSync(file+'.duo-tmp',rel.endsWith('.sh')?0o755:modes[rel]||0o644);fs.renameSync(file+'.duo-tmp',file);written.push(rel);
    }
    // Remove staging before the final metadata commit; a failed cleanup leaves
    // the previous manifest authoritative while transaction-owned bytes roll back.
    noLinks(path.join(dir,'staged.json'));fs.rmSync(path.join(dir,'staged.json'),{force:true});
    write(ownedFile,{version:stagedVersion,hashes:Object.fromEntries(Object.entries(next).map(([k,v])=>[k,hash(v)]))});
  } catch(e) {
    for(const rel of written.reverse()) {
      const file=path.join(root,rel);
      // Never roll back a concurrent custom edit.
      if(fs.existsSync(file)&&hash(fs.readFileSync(file))===hash(next[rel])) { if(before[rel]){fs.writeFileSync(file,before[rel]);fs.chmodSync(file,modes[rel]);}else fs.unlinkSync(file); }
    }
    throw e;
  }
  return {state:'active',pendingRunIds:[],activeVersion:stagedVersion,reason:'Installed. New conversations load this skill; existing conversations cannot hot-reload.'};
}
function describe(root,state) {
  const dir=path.join(base(root),'runtime-update'), staged=path.join(dir,'staged.json'), installed=path.join(dir,'installed.json');
  const guide=path.join(root,'goal.md');let staleGuide='';
  if(fs.existsSync(guide)) {
    const ids=[...fs.readFileSync(guide,'utf8').matchAll(/\.specflow\/duo\/([0-9]+-[a-f0-9]+)/g)].map(m=>m[1]);
    if(ids.length&&!ids.includes(state.id))staleGuide=`Goal guide points to ${ids.join(', ')}; active run is .specflow/duo/${state.id}/. Update its navigation between runs; pinned acceptance was not changed.`;
  }
  return {active:state.runtime?.identity||'legacy_unknown',installed:fs.existsSync(installed)?read(installed).version:'unrecorded',staged:fs.existsSync(staged)?read(staged).stagedVersion:null,staleGuide};
}
module.exports={helpers,lock,pin,verify,dispatch,unfinished,install,describe};
if(require.main===module) {
  try { const [command,source,root,held]=process.argv.slice(2);if(command!=='install')throw Error('Use install <source> <target> [--lock-held]');const result=install(path.resolve(source),path.resolve(root),{held:held==='--lock-held'});console.log(JSON.stringify(result));process.exitCode=result.state==='staged'?10:0; }
  catch(e){console.error(e.message);process.exitCode=2;}
}
