'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const base = root => path.join(root,'.specflow/duo');
const helpers = ['readonly-review.cjs','review-input.cjs','review-assignment.cjs','specflow-review.cjs','duo-snapshot.cjs','review-continuation.cjs','specflow-tier.cjs','specflow-specification.cjs','specflow-volume.cjs','specflow-publication.cjs','specflow-reviews.cjs','typesafe-effort-analysis.cjs','typesafe-effort-trial.cjs','typesafe-routing.cjs','typesafe-routing-bridge.cjs','duo-review-receipts.cjs','typesafe-evidence.cjs','typesafe-questions-v1.cjs','duo-build.cjs','duo-progress.cjs','duo-direction.cjs','duo-actions.cjs','duo-cadence.cjs','duo-runtime.cjs','typesafe-duo.cjs','typesafe-client.cjs','typesafe-questions.cjs','typesafe-actions.cjs'];
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
// Source resources are copied without rewriting canonical bytes. Installed
// project scripts carry them below scripts/ so project package.json is untouched.
const resourcePrefix='scripts/runtime-resources/';
function resourceRoot(source) {
  const embedded=path.join(source,resourcePrefix);
  return fs.existsSync(path.join(embedded,'package.json'))?embedded:source;
}
function sourceFile(source,rel) {
  return rel.startsWith(resourcePrefix)?path.join(resourceRoot(source),rel.slice(resourcePrefix.length)):path.join(source,rel);
}
function walkFiles(dir,visit,rel='') {
  if(!fs.existsSync(dir))return;
  noLinks(dir);
  for(const entry of fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))) {
    const name=rel?rel+'/'+entry.name:entry.name,file=path.join(dir,entry.name);
    if(entry.isSymbolicLink())throw Error('Runtime path must not follow symlinks');
    if(entry.isDirectory())walkFiles(file,visit,name);else if(entry.isFile())visit(name,file);
  }
}
function scriptFiles(source,visit) {
  const dir=path.join(source,'scripts'),vendor=path.join(dir,'vendor'),manifest=path.join(vendor,'manifest.json');
  const roots=fs.readdirSync(noLinks(dir)).filter(n=>fs.lstatSync(path.join(dir,n)).isFile()).sort();
  if(!fs.existsSync(manifest)&&roots.some(n=>n.endsWith('.cjs')&&/require\(['"]\.\/vendor\//.test(fs.readFileSync(path.join(dir,n),'utf8'))))throw Error('Bundled vendor inventory missing');
  if(fs.existsSync(manifest)) {
    const inventory=read(manifest),actual=[];
    if(inventory.version!==1||!inventory.files||typeof inventory.files!=='object')throw Error('Invalid bundled vendor inventory');
    walkFiles(vendor,(rel,file)=>{if(rel==='manifest.json')return;actual.push(rel);if(inventory.files[rel]!==hash(fs.readFileSync(noLinks(file))))throw Error('Bundled vendor bytes missing or corrupt: '+rel);});
    if(JSON.stringify(actual.sort())!==JSON.stringify(Object.keys(inventory.files).sort()))throw Error('Bundled vendor closure is incomplete');
  }
  for(const name of roots)visit('scripts/'+name,path.join(dir,name));
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if(entry.isSymbolicLink())throw Error('Runtime path must not follow symlinks');
    // scripts/agents is a legacy project overlay; setup owns that path from
    // canonical agents/. Copying its older source mirror would claim two owners.
    if(entry.isDirectory()&&!['runtime-resources','agents'].includes(entry.name))walkFiles(path.join(dir,entry.name),(rel,file)=>visit('scripts/'+entry.name+'/'+rel,file));
  }
}
function resourceFiles(source,visit) {
  const root=resourceRoot(source);
  const manifest=path.join(root,'package.json');
  const metadata=fs.existsSync(manifest)?read(manifest):{};
  if(fs.existsSync(manifest))visit('package.json',manifest);
  // Reuse the package's existing shipped-resource inventory. Scripts have their
  // own canonical location; host overlays are distribution adapters, not core.
  for(const name of metadata.files||['templates/','skills/','bin/']) {
    if(typeof name!=='string'||path.isAbsolute(name)||name.split('/').includes('..'))throw Error('Invalid shipped runtime resource');
    if(/^(scripts|plugins)\//.test(name))continue;
    const rel=name.replace(/\/$/,''),file=path.join(root,rel);
    if(!fs.existsSync(file))continue;
    noLinks(file);
    if(fs.statSync(file).isDirectory())walkFiles(file,(child,from)=>visit(rel+'/'+child,from));else visit(rel,file);
  }
}
function pin(root,dir,builder) {
  const helperHashes={},skillHashes={},destination=path.join(dir,'runtime');
  const put=(rel,file,hashes=helperHashes)=>{const bytes=fs.readFileSync(noLinks(file));fs.mkdirSync(path.dirname(path.join(destination,rel)),{recursive:true});fs.writeFileSync(path.join(destination,rel),bytes);hashes[rel]=hash(bytes);};
  const source=path.resolve(__dirname,'..');
  scriptFiles(source,(rel,file)=>put(rel,file));
  resourceFiles(source,(rel,file)=>put(rel,file));
  const candidates=[path.join(resourceRoot(source),'skills/duo-build/SKILL.md'),path.join(root,builder==='claude-code'?'.claude/skills/duo-build/SKILL.md':'.agents/skills/duo-build/SKILL.md')];
  const skill=candidates.find(f=>fs.existsSync(f));
  if(skill&&fs.existsSync(path.join(path.dirname(skill),'references/routing-study.md')))put('references/routing-study.md',path.join(path.dirname(skill),'references/routing-study.md'),skillHashes);
  if(skill)put('SKILL.md',skill,skillHashes);
  const result={protocolVersion:'duo-actions-1',closureVersion:fs.existsSync(path.join(source,'scripts/vendor/manifest.json'))?2:1,helperHashes,skillHashes,provenance:'recorded',identity:hash(JSON.stringify({helperHashes,skillHashes}))};
  write(path.join(destination,'manifest.json'),result);return result;
}
function selected(dir, runtime) {
  const name = runtime.directory || 'runtime';
  if (name !== 'runtime' && !/^runtime-migrations\/[a-f0-9-]+\/runtime$/.test(name)) throw Error('Invalid selected runtime directory');
  return noLinks(path.join(dir,name));
}
function verify(dir,runtime) {
  for(const [rel,sha] of Object.entries({...runtime.helperHashes,...runtime.skillHashes})) if(hash(fs.readFileSync(noLinks(path.join(selected(dir,runtime),rel))))!==sha) throw Error(`Pinned duo runtime modified: ${rel}`);
}
function dispatch(root,id,current) {
  if(!/^[A-Za-z0-9-]+$/.test(id||'')) return null;
  const dir=path.join(base(root),id),file=path.join(dir,'run.json');if(!fs.existsSync(file))return null;
  const state=read(file); if(!state.runtime || state.runtime.provenance==='legacy_unknown')return null;
  verify(dir,state.runtime);
  const pinned=path.join(selected(dir,state.runtime),'scripts');return path.resolve(current)===path.resolve(pinned)?null:pinned;
}
function unfinished(root) {
  if(!fs.existsSync(base(root)))return [];
  return fs.readdirSync(base(root)).filter(id=>fs.existsSync(path.join(base(root),id,'run.json'))).filter(id=>{const state=read(path.join(base(root),id,'run.json'));return state.goalStatus!=='complete'&&!state.runtimeCeased;});
}
function bundle(source) {
  const result={};
  const put=(rel,file)=>{if(fs.existsSync(file)) result[rel]=fs.readFileSync(noLinks(file),'utf8');};
  for(const name of helpers)put('scripts/'+name,path.join(source,'scripts',name));
  scriptFiles(source,(rel,file)=>put(rel,file));
  resourceFiles(source,(rel,file)=>put(resourcePrefix+rel,file));
  for(const target of ['.claude','.codex','.agents']) { put(`${target}/skills/duo-build/SKILL.md`,path.join(source,'skills/duo-build/SKILL.md')); put(`${target}/skills/duo-build/references/routing-study.md`,path.join(source,'skills/duo-build/references/routing-study.md')); }
  for(const target of ['.claude','.codex','.agents'])put(`${target}/skills/specflow-loop-selector/SKILL.md`,path.join(source,'skills/specflow-loop-selector/SKILL.md'));
  put('.claude/hooks/duo-review-check.sh',path.join(source,'hooks/duo-review-check.sh'));
  return result;
}
function install(source,root,{held=false,beforeWrite,requestedRuntime=null}={}) {
  if(requestedRuntime&&!['codex','claude-code'].includes(requestedRuntime))throw Error('Use --runtime codex|claude-code');
  if(!held)return lock(root,()=>install(source,root,{held:true,beforeWrite,requestedRuntime}));
  const dir=path.join(base(root),'runtime-update'), next=bundle(source), stagedVersion=hash(JSON.stringify(next)), pendingRunIds=unfinished(root);
  const manifest=path.join(source,'package.json');
  const metadata=fs.existsSync(manifest)?JSON.parse(fs.readFileSync(manifest)):null;
  const packageIdentity=metadata?{name:metadata.name,version:metadata.version,root:path.resolve(source),manifestSha256:hash(fs.readFileSync(manifest))}:null;
  const ownedFile=path.join(dir,'installed.json'), previous=fs.existsSync(ownedFile)?read(ownedFile):{hashes:{}};
  if(pendingRunIds.length) {
    write(path.join(dir,'staged.json'),{files:next,stagedVersion,pendingRunIds,package:packageIdentity,requestedRuntime});
    return {state:'staged',pendingRunIds,activeVersion:previous.version||'legacy_unknown',stagedVersion,reason:'Unfinished runs retain their exact installation; rerun the installer after completion. Reload the native skill in a new conversation.'};
  }
  const before={},modes={};
  for(const rel of Object.keys(next)) {
    const file=noLinks(path.join(root,rel));before[rel]=fs.existsSync(file)?fs.readFileSync(file):null;modes[rel]=before[rel]?fs.statSync(file).mode & 0o777:null;
    // Neither a writable hash nor a package locator can grant overwrite rights.
    // Divergent bytes need the explicit reviewed backup/restore procedure.
    if(before[rel] && hash(before[rel])!==hash(next[rel])) throw Error(`Custom or unverifiable managed file preserved: ${rel}; review and back up before restoring the executing package's canonical bytes`);
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
    write(ownedFile,{version:stagedVersion,package:packageIdentity,hashes:Object.fromEntries(Object.entries(next).map(([k,v])=>[k,hash(v)]))});
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
module.exports={selected,helpers,lock,pin,verify,dispatch,unfinished,install,describe,bundle,sourceFile};
if(require.main===module) {
  try { const [command,source,root,...args]=process.argv.slice(2);if(command!=='install')throw Error('Use install <source> <target> [--lock-held] [--runtime HOST]');const at=args.indexOf('--runtime'),requested=at>=0?args[at+1]:null;const requestedRuntime=requested?require('./runtime-routing.cjs').resolveRuntime({runtime:requested,interactive:!!(process.stdin.isTTY&&process.stdout.isTTY)}):null;const result=install(path.resolve(source),path.resolve(root),{held:args.includes('--lock-held'),requestedRuntime});console.log(JSON.stringify(result));process.exitCode=result.state==='staged'?10:0; }
  catch(e){console.error(e.message);process.exitCode=2;}
}
