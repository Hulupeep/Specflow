'use strict';
// Qualification-only private content-pinned copy; no install, download, credential or repo mutation.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const defaultSource=path.resolve(__dirname,'../..'),sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function prepare(destination,{sourceRoot=defaultSource}={}){
 const source=fs.realpathSync(sourceRoot);
 if(!path.isAbsolute(destination)||fs.existsSync(destination)||destination.startsWith(source+path.sep))throw Error('fresh_private_runtime_required');
 fs.mkdirSync(destination,{mode:0o700,recursive:true});if(fs.lstatSync(destination).isSymbolicLink()||fs.statSync(destination).uid!==process.getuid()||fs.statSync(destination).mode&0o077)throw Error('private_runtime_required');
 const manifest=[];
 function copy(file,relative){const stat=fs.statSync(file,{bigint:true}),bytes=fs.readFileSync(file),after=fs.statSync(file,{bigint:true});if(['ino','dev','size','mtimeNs','ctimeNs'].some(k=>stat[k]!==after[k]))throw Error('runtime_source_changed');const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{mode:0o700,recursive:true});fs.writeFileSync(target,bytes,{mode:Number(stat.mode&0o111n)?0o500:0o600,flag:'wx'});if(sha(fs.readFileSync(target))!==sha(bytes))throw Error('runtime_copy_mismatch');manifest.push({path:relative,sha256:sha(bytes)});}
 const names=cp.execFileSync('/usr/bin/git',['-C',source,'ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
 const prefixes=['scripts/','templates/','docs/contracts/','evidence/improve-worker/','evidence/improve-recovery/','evidence/improve-service/','tests/fixtures/improve-worker/'];
 for(const name of [...new Set(names)].sort())if(prefixes.some(p=>name.startsWith(p))||['package.json','package-lock.json','tests/e2e/journey_worker_qualification.spec.cjs'].includes(name)){if(fs.lstatSync(path.join(source,name)).isSymbolicLink())throw Error('runtime_source_symlink');copy(path.join(source,name),name);}
 const seen=new Map();
 function dependency(name,from=source){let pkgFile;const resolve=require('module').createRequire(path.join(from,'package.json')).resolve;
  let at=path.dirname(resolve(name));while(at!==path.dirname(at)){const candidate=path.join(at,'package.json');if(fs.existsSync(candidate)&&JSON.parse(fs.readFileSync(candidate)).name===name){pkgFile=candidate;break;}at=path.dirname(at);}if(!pkgFile)throw Error('runtime_dependency_manifest_unavailable');
  const pkg=JSON.parse(fs.readFileSync(pkgFile)),dir=path.dirname(pkgFile);if(seen.has(name)){if(seen.get(name)!==pkg.version)throw Error('runtime_dependency_version_conflict');return;}seen.set(name,pkg.version);
  const walk=(at,rel)=>{for(const entry of fs.readdirSync(at,{withFileTypes:true})){const src=path.join(at,entry.name),out=path.join(rel,entry.name);if(entry.isSymbolicLink())throw Error('runtime_dependency_symlink');if(entry.isDirectory())walk(src,out);else if(entry.isFile())copy(src,out);else throw Error('runtime_dependency_special_file');}};
  walk(dir,path.join('node_modules',name));for(const child of Object.keys(pkg.dependencies||{}))dependency(child,dir);
 }
 for(const name of Object.keys(JSON.parse(fs.readFileSync(path.join(source,'package.json'))).dependencies||{}))dependency(name);
 manifest.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);const digest=sha(JSON.stringify(manifest)),doc={version:1,source_content_sha256:digest,files:manifest,dependencies:Object.fromEntries(seen)};fs.writeFileSync(path.join(destination,'runtime-manifest.json'),JSON.stringify(doc,null,2),{mode:0o400,flag:'wx'});
 const sealDirectories=dir=>{for(const e of fs.readdirSync(dir,{withFileTypes:true}))if(e.isDirectory())sealDirectories(path.join(dir,e.name));fs.chmodSync(dir,0o500);};sealDirectories(destination);
 return {root:destination,source_content_sha256:digest,files:manifest.length,dependencies:Object.fromEntries(seen)};
}
module.exports={prepare};
if(require.main===module)try{console.log(JSON.stringify(prepare(process.argv[2])));}catch(e){console.error(JSON.stringify({code:e.code||e.message}));process.exitCode=2;}
