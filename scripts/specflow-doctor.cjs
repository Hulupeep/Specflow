'use strict';
// Read-only installation identity inspection. No provider calls or repairs.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),yaml=require('js-yaml');
const routing=require('./runtime-routing.cjs'),runtime=require('./duo-runtime.cjs');
const z=require('zod'),text=z.string().min(1),digest=z.string().regex(/^[a-f0-9]{64}$/),host=z.enum(['codex','claude-code']);
const DoctorResult=z.object({
 status:z.enum(['healthy','repair_required','runtime_ambiguous']),specflowVersion:text,detectedRuntime:host.nullable(),activeRoutingProfile:text.nullable(),routingOwnership:z.enum(['managed','custom','missing']),
 findings:z.array(z.object({code:text,severity:z.enum(['error','warning','info']),message:text,repairCommand:text.optional()}).strict()),
 inspectedProject:text,inspectedPackage:z.object({name:text,version:text,root:text,manifestSha256:digest.nullable()}).strict(),activeInstallation:z.object({identity:digest.nullable(),version:text.nullable()}).strict(),
 stagedInstallation:z.object({identity:digest,version:text.nullable()}).strict().nullable(),requestedRuntime:host.nullable(),installedRuntime:host.nullable(),
 artifacts:z.array(z.object({path:text,ownership:z.enum(['managed','custom','missing','unverifiable']),actualSha256:digest.nullable(),expectedSha256:digest.nullable()}).strict()),
 capabilities:z.array(z.object({id:text,status:z.enum(['present','stale','missing','unverifiable']),entrypoint:text.nullable(),evidenceKind:z.enum(['artifact_identity','not_verified'])}).strict())
}).strict();
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
function reviewedRestore(source,target,expectedSource,expectedTarget,backupDir,projectRoot,coreRuntime) {
 // Display only. Executing this explicit, reversible procedure is an operator
 // action after review; inspection itself never writes or invokes it.
 const code='const fs=require("fs"),c=require("crypto");const [s,t,sh,th,dir,project,runtime]=process.argv.slice(1);const owner=require(runtime);owner.lock(project,()=>{if(owner.unfinished(project).length)throw Error("Unfinished runs retain active bytes; resolve them before repair");const from=fs.readFileSync(s),before=fs.readFileSync(t),hash=b=>c.createHash("sha256").update(b).digest("hex");if(hash(from)!==sh||hash(before)!==th)throw Error("Artifact changed since doctor; inspect again before repair");for(let p=dir;p!==require("path").dirname(p);p=require("path").dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error("Backup path is a symlink");fs.mkdirSync(dir,{recursive:true,mode:0o700});const backup=require("path").join(dir,require("path").basename(t)+".specflow-backup-"+c.randomUUID());fs.writeFileSync(backup,before,{flag:"wx",mode:0o600});fs.writeFileSync(t,from);console.log("Backup: "+backup);});';
 return [quote(process.execPath),'-e',quote(code),...[source,target,expectedSource,expectedTarget,backupDir,projectRoot,coreRuntime].map(quote)].join(' ');
}
function reviewedMetadataReset(file,expected,lock,update,backupDir,projectRoot,coreRuntime) {
 const code='const fs=require("fs"),c=require("crypto");const [file,expected,lock,dir,project,runtime]=process.argv.slice(1);const owner=require(runtime);owner.lock(project,()=>{if(owner.unfinished(project).length)throw Error("Unfinished runs retain active metadata; use their existing recovery before repair");const bytes=fs.readFileSync(file);if(c.createHash("sha256").update(bytes).digest("hex")!==expected)throw Error("Metadata changed since doctor; inspect again");for(let p=dir;p!==require("path").dirname(p);p=require("path").dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error("Backup path is a symlink");fs.mkdirSync(dir,{recursive:true,mode:0o700});const backup=require("path").join(dir,require("path").basename(file)+".specflow-backup-"+c.randomUUID());fs.writeFileSync(backup,bytes,{flag:"wx",mode:0o600});fs.unlinkSync(file);console.log("Backup: "+backup);});';
 return [quote(process.execPath),'-e',quote(code),...[file,expected,lock,backupDir,projectRoot,coreRuntime].map(quote)].join(' ')+' && '+update;
}
function gateDependencies(files) {
 const pending=['scripts/teardown-gate.cjs'],seen=new Set();
 while(pending.length){const rel=pending.pop();if(seen.has(rel))continue;seen.add(rel);
  for(const match of (files[rel]||'').matchAll(/require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g)){
   let dep=path.posix.normalize(path.posix.join(path.posix.dirname(rel),match[1]));if(!path.posix.extname(dep))dep+='.cjs';pending.push(dep);
  }
 }
 return seen;
}
function inspect({targetRoot='.',sourceRoot=path.resolve(__dirname,'..'),env=process.env}={}) {
 const target=fs.realpathSync(targetRoot),backupDir=path.join(target,'.specflow/runs/repair-backups'),executing=JSON.parse(fs.readFileSync(path.join(sourceRoot,'package.json'))),findings=[],invalid=[];
 const add=(code,message,repairCommand,severity='error')=>findings.push({code,severity,message,...(repairCommand?{repairCommand}:{})});
 const read=(rel,parse=JSON.parse)=>{try{return parse(fs.readFileSync(path.join(target,rel),'utf8'));}catch(e){if(e.code!=='ENOENT'){invalid.push({rel,index:findings.length});add('invalid_metadata',rel+': '+(e.code||e.name)+'; preserve a backup before explicit metadata recovery.');}return null;}};
 const owned=read('.specflow/duo/runtime-update/installed.json'),staged=read('.specflow/duo/runtime-update/staged.json');
 const state=read('.specflow/install-state.yml',yaml.load),active=read('.specflow/adapter-routing.yml',yaml.load);
 const desired=staged?.requestedRuntime||state?.routing?.runtime;
 const detection=routing.detectRuntime(env),requestedRuntime=Object.hasOwn(routing.RUNTIMES,desired)?desired:null;
 const installedRuntime=Object.hasOwn(routing.RUNTIMES,active?.routing_profile?.runtime)?active.routing_profile.runtime:null;
 const selected=requestedRuntime||installedRuntime||detection.detected||'codex';
 const repair=`npx @colmbyrne/specflow update ${quote(target)} --runtime ${selected}`;
 const matchingUpdate=[quote(process.execPath),quote(path.join(sourceRoot,'bin/specflow.js')),'update',quote(target),'--runtime',selected].join(' ');
 for(const item of invalid){try{const file=path.join(target,item.rel);findings[item.index].repairCommand=reviewedMetadataReset(file,sha(fs.readFileSync(file)),path.join(target,'.specflow/duo/installer.lock'),matchingUpdate,backupDir,target,path.join(sourceRoot,'scripts/duo-runtime.cjs'));}catch{findings[item.index].repairCommand=matchingUpdate;}}
 let canonicalRoot=sourceRoot,canonicalPackage=executing,manifestSha256=null,observedFiles={};
 try {
  if(owned?.package?.root)canonicalRoot=fs.realpathSync(owned.package.root);
  const bytes=fs.readFileSync(path.join(canonicalRoot,'package.json'));canonicalPackage=JSON.parse(bytes);manifestSha256=sha(bytes);
  if(canonicalPackage.name!=='@colmbyrne/specflow'||(owned?.package?.manifestSha256&&owned.package.manifestSha256!==manifestSha256))throw Error('recorded package manifest does not match reached package');
  observedFiles=runtime.bundle(canonicalRoot);
 }catch(e){add('package_unverifiable','Installed canonical package unavailable: '+e.message,repair);}
 // A recorded locator is observation, not authority. Capabilities and repairs
 // always use the executing core package, never a tree chosen by that record.
 let expected={};try{expected=runtime.bundle(sourceRoot);}catch(e){add('authoritative_package_unavailable',e.message,repair);}
 if(path.resolve(canonicalRoot)!==path.resolve(sourceRoot))add('authoritative_package','Gate artifacts are compared with executing package '+sourceRoot+' at version '+executing.version+'; the recorded package locator is observational, not overwrite authority.',undefined,'info');
 const canonicalCurrent=!!owned?.version&&Object.keys(expected).length>0&&owned.version===sha(JSON.stringify(expected));
 if(owned?.version&&Object.keys(expected).length&&!canonicalCurrent)add('package_bundle_mismatch','The recorded installation differs from the executing authoritative package; historical identity does not authorise gate replacement.',repair);
 if(!owned?.version||!owned.package)add('installation_unverifiable','Installation lacks a recorded package identity; compare local gates before a reviewed update.',repair);
 const artifacts=[];
 for(const [rel,wanted]of Object.entries(expected)) {
  let bytes=null;try{bytes=fs.readFileSync(runtimePath(target,rel));}catch(e){if(e.code!=='ENOENT')add('artifact_unreadable',rel+': '+e.message,repair);}
  const hash=bytes?sha(bytes):null,wantedHash=sha(wanted);
  const ownership=!bytes?'missing':hash===wantedHash?'managed':owned?.hashes?.[rel]===hash?'unverifiable':'custom';
  artifacts.push({path:rel,ownership,actualSha256:hash,expectedSha256:wantedHash});
  if(ownership!=='managed')add('gate_artifact_'+ownership,rel+': '+ownership+'. Bytes are preserved. Review the executing package before using the explicit backup/restore procedure; then rerun '+repair+'.',bytes?reviewedRestore(path.join(sourceRoot,rel),path.join(target,rel),wantedHash,hash,backupDir,target,path.join(sourceRoot,'scripts/duo-runtime.cjs')):repair);
 }
 const routingPath=path.join(target,'.specflow/adapter-routing.yml');
 let routingOwnership=!fs.existsSync(routingPath)?'missing':state?.routing?.managed===false?'custom':'managed';
 try {
  if(routingOwnership==='managed'&&state?.routing?.installed_sha256!==sha(fs.readFileSync(routingPath)))routingOwnership='custom';
  const checked=routing.verifyRuntimeRouting({sourceRoot,targetRoot:target,verifySkills:true});
  if(!checked.ok)add(checked.status,checked.error,repair);
 }catch(e){add('routing_unverifiable',e.message,repair);}
 if(routingOwnership==='custom')add('custom_routing','Custom routing preserved; inspect its actual profile before explicit replacement.',repair+' --replace-routing','warning');
 if(requestedRuntime&&installedRuntime&&requestedRuntime!==installedRuntime)add(staged?'runtime_staged':'runtime_mismatch',`Requested ${requestedRuntime}; preserved active ${installedRuntime}.`,staged?repair:repair+' --replace-routing',staged?'warning':'error');
 if(detection.ambiguous)add('runtime_ambiguous','Conflicting current host hints; choose --runtime codex or --runtime claude-code.',repair);
 if(staged)add('update_staged',`Update ${staged.stagedVersion} is staged; complete retained runs and rerun the installer. Active bytes were not replaced.`,repair,'warning');
 const gate=artifacts.find(a=>a.path==='scripts/teardown-gate.cjs');
 const dependencies=gateDependencies(expected),gatePresent=!!gate&&[...dependencies].every(rel=>artifacts.some(a=>a.path===rel&&a.ownership==='managed'));
 for(const rel of dependencies)if(!Object.hasOwn(expected,rel))add('gate_dependency_missing','The canonical package is missing required gate dependency '+rel,repair);
 const gateVerified=gatePresent&&Object.keys(expected).length>0;
 const capabilities=[{id:'gate-d',status:gateVerified?'present':gate?.ownership==='missing'?'missing':gate?'stale':'unverifiable',entrypoint:gate?'scripts/teardown-gate.cjs':null,evidenceKind:gateVerified?'artifact_identity':'not_verified'},
  {id:'native-host-session',status:'unverifiable',entrypoint:null,evidenceKind:'not_verified'}];
 let observedIdentity=null;
 try{const observed={};for(const [rel,bytes]of Object.entries(observedFiles)){const actual=fs.readFileSync(runtimePath(target,rel));if(sha(actual)!==sha(bytes))throw Error('observed bytes differ');observed[rel]=actual.toString('utf8');}if(Object.keys(observed).length)observedIdentity=sha(JSON.stringify(observed));}catch{/* Unknown observed identity grants no capability. */}
 return DoctorResult.parse({status:detection.ambiguous?'runtime_ambiguous':findings.some(f=>f.severity==='error')?'repair_required':'healthy',specflowVersion:executing.version,detectedRuntime:detection.detected,activeRoutingProfile:typeof active?.routing_profile?.id==='string'&&active.routing_profile.id?active.routing_profile.id:null,routingOwnership,findings,
  inspectedProject:target,inspectedPackage:{name:canonicalPackage.name,version:canonicalPackage.version,root:canonicalRoot,manifestSha256},
  activeInstallation:{identity:observedIdentity,version:typeof owned?.package?.version==='string'?owned.package.version:null},
  stagedInstallation:staged&&/^[a-f0-9]{64}$/.test(staged.stagedVersion||'')?{identity:staged.stagedVersion,version:typeof staged.package?.version==='string'?staged.package.version:null}:null,
  requestedRuntime,installedRuntime,artifacts,capabilities});
}
function runtimePath(root,relative){const file=path.join(root,relative);for(let p=file;p!==path.dirname(p);p=path.dirname(p))if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('managed artifact is a symlink');return file;}
function cli(args,sourceRoot) {
 try {
  const target=args.find(a=>!a.startsWith('--'))||'.',result=inspect({targetRoot:target,sourceRoot});
  const lines=[
   `Specflow ${result.specflowVersion}: ${result.status}`,
   `Project: ${result.inspectedProject}`,
   `Detected runtime: ${result.detectedRuntime||'unavailable'}`,
   `Routing ownership: ${result.routingOwnership}`,
   `Runtime: ${result.installedRuntime||'unverified'}; requested: ${result.requestedRuntime||'unavailable'}; profile: ${result.activeRoutingProfile||'missing'}`,
   `Observed package: ${result.inspectedPackage.name}@${result.inspectedPackage.version} (${result.inspectedPackage.root})`,
   `Active: ${result.activeInstallation.identity||'unverifiable'}; staged: ${result.stagedInstallation?.identity||'none'}`,
   `Artifacts: ${result.artifacts.filter(a=>a.ownership==='managed').length} managed; ${result.artifacts.filter(a=>a.ownership!=='managed').length} divergent`,
   ...result.capabilities.map(c=>`${c.id}: ${c.status} (${c.evidenceKind})`),
   ...result.findings.map(f=>`${f.code}: ${f.message}${f.repairCommand?'\nRepair: '+f.repairCommand:''}`),
  ];
  console.log(args.includes('--json')?JSON.stringify(result,null,2):lines.join('\n'));
  return result.status==='healthy'?0:1;
 }catch(e){console.error('specflow doctor: '+e.message);return 1;}
}
module.exports={inspect,cli,DoctorResult};
