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
function gateDependencies(files) {
 const pending=['scripts/teardown-gate.cjs'],seen=new Set();
 while(pending.length){const rel=pending.pop();if(seen.has(rel))continue;seen.add(rel);
  for(const match of (files[rel]||'').matchAll(/require\(\s*['"](\.\.?\/[^'"]+)['"]\s*\)/g)){
   let dep=path.posix.normalize(path.posix.join(path.posix.dirname(rel),match[1]));if(!path.posix.extname(dep))dep+='.cjs';if(Object.hasOwn(files,dep))pending.push(dep);
  }
 }
 return seen;
}
function inspect({targetRoot='.',sourceRoot=path.resolve(__dirname,'..'),env=process.env}={}) {
 const target=fs.realpathSync(targetRoot),executing=JSON.parse(fs.readFileSync(path.join(sourceRoot,'package.json'))),findings=[];
 const add=(code,message,repairCommand,severity='error')=>findings.push({code,severity,message,...(repairCommand?{repairCommand}:{})});
 const read=(rel,parse=JSON.parse)=>{try{return parse(fs.readFileSync(path.join(target,rel),'utf8'));}catch(e){if(e.code!=='ENOENT')add('invalid_metadata',rel+': '+e.message);return null;}};
 const owned=read('.specflow/duo/runtime-update/installed.json'),staged=read('.specflow/duo/runtime-update/staged.json');
 const state=read('.specflow/install-state.yml',yaml.load),active=read('.specflow/adapter-routing.yml',yaml.load);
 const desired=staged?.requestedRuntime||state?.routing?.runtime;
 const detection=routing.detectRuntime(env),requestedRuntime=Object.hasOwn(routing.RUNTIMES,desired)?desired:null;
 const installedRuntime=Object.hasOwn(routing.RUNTIMES,active?.routing_profile?.runtime)?active.routing_profile.runtime:null;
 const selected=requestedRuntime||installedRuntime||detection.detected||'codex';
 const repair=`npx @colmbyrne/specflow update ${quote(target)} --runtime ${selected}`;
 let canonicalRoot=sourceRoot,canonicalPackage=executing,manifestSha256=null,expected={};
 try {
  if(owned?.package?.root)canonicalRoot=fs.realpathSync(owned.package.root);
  const bytes=fs.readFileSync(path.join(canonicalRoot,'package.json'));canonicalPackage=JSON.parse(bytes);manifestSha256=sha(bytes);
  if(canonicalPackage.name!=='@colmbyrne/specflow'||(owned?.package?.manifestSha256&&owned.package.manifestSha256!==manifestSha256))throw Error('recorded package manifest does not match reached package');
  expected=runtime.bundle(canonicalRoot);
 }catch(e){add('package_unverifiable','Installed canonical package unavailable: '+e.message,repair);}
 if(!owned?.version||!owned.package)add('installation_unverifiable','Installation lacks a recorded package identity; compare local gates before a reviewed update.',repair);
 const artifacts=[],actual={};
 for(const [rel,wanted]of Object.entries(expected)) {
  let bytes=null;try{bytes=fs.readFileSync(runtimePath(target,rel));}catch(e){if(e.code!=='ENOENT')add('artifact_unreadable',rel+': '+e.message,repair);}
  const hash=bytes?sha(bytes):null,wantedHash=sha(wanted);
  const ownership=!bytes?'missing':hash===wantedHash?'managed':owned?.hashes?.[rel]===hash?'unverifiable':'custom';
  artifacts.push({path:rel,ownership,actualSha256:hash,expectedSha256:wantedHash});if(bytes)actual[rel]=bytes.toString('utf8');
  if(ownership!=='managed')add('gate_artifact_'+ownership,rel+': '+ownership+'. Custom bytes are preserved; compare with the named package and back up before reviewed replacement.',ownership==='custom'?undefined:repair);
 }
 const routingPath=path.join(target,'.specflow/adapter-routing.yml');
 let routingOwnership=!fs.existsSync(routingPath)?'missing':state?.routing?.managed===false?'custom':'managed';
 try {
  if(routingOwnership==='managed'&&state?.routing?.installed_sha256!==sha(fs.readFileSync(routingPath)))routingOwnership='custom';
  const checked=routing.verifyRuntimeRouting({sourceRoot:canonicalRoot,targetRoot:target,verifySkills:true});
  if(!checked.ok)add(checked.status,checked.error,repair);
 }catch(e){add('routing_unverifiable',e.message,repair);}
 if(routingOwnership==='custom')add('custom_routing','Custom routing preserved; inspect its actual profile before explicit replacement.',repair+' --replace-routing','warning');
 if(requestedRuntime&&installedRuntime&&requestedRuntime!==installedRuntime)add(staged?'runtime_staged':'runtime_mismatch',`Requested ${requestedRuntime}; preserved active ${installedRuntime}.`,staged?repair:repair+' --replace-routing',staged?'warning':'error');
 if(detection.ambiguous)add('runtime_ambiguous','Conflicting current host hints; choose --runtime codex or --runtime claude-code.',repair);
 if(staged)add('update_staged',`Update ${staged.stagedVersion} is staged; complete retained runs and rerun the installer. Active bytes were not replaced.`,repair,'warning');
 const complete=artifacts.length>0&&artifacts.every(a=>a.ownership==='managed');
 const gate=artifacts.find(a=>a.path==='scripts/teardown-gate.cjs');
 const dependencies=gateDependencies(expected),gatePresent=!!gate&&[...dependencies].every(rel=>artifacts.some(a=>a.path===rel&&a.ownership==='managed'));
 const capabilities=[{id:'gate-d',status:gatePresent&&owned?.package?'present':gate?.ownership==='missing'?'missing':gate?'stale':'unverifiable',entrypoint:gate?'scripts/teardown-gate.cjs':null,evidenceKind:gatePresent?'artifact_identity':'not_verified'},
  {id:'native-host-session',status:'unverifiable',entrypoint:null,evidenceKind:'not_verified'}];
 return DoctorResult.parse({status:detection.ambiguous?'runtime_ambiguous':findings.some(f=>f.severity==='error')?'repair_required':'healthy',specflowVersion:executing.version,detectedRuntime:detection.detected,activeRoutingProfile:typeof active?.routing_profile?.id==='string'&&active.routing_profile.id?active.routing_profile.id:null,routingOwnership,findings,
  inspectedProject:target,inspectedPackage:{name:canonicalPackage.name,version:canonicalPackage.version,root:canonicalRoot,manifestSha256},
  activeInstallation:{identity:complete?sha(JSON.stringify(actual)):null,version:typeof owned?.package?.version==='string'?owned.package.version:null},
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
   `Package: ${result.inspectedPackage.root}`,
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
