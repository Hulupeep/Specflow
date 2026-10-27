'use strict';
// Owner-registered content-pinned prepared program. Not a sandbox for hostile same-UID modules.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),Module=require('module'),{privatePath}=require('./improve-operation-receipts.cjs'),{ServiceError}=require('./improve-service-schema.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),fail=c=>{throw new ServiceError(c,503);};
function bytes(file,sha){privatePath(file);const before=fs.statSync(file,{bigint:true}),value=fs.readFileSync(file),after=fs.statSync(file,{bigint:true});if(['ino','dev','size','mtimeNs','ctimeNs'].some(k=>before[k]!==after[k])||hash(value)!==sha)fail('plan_input_changed');return value;}
function validate(plan,host){
 const runtime=host.runtimes?.[plan.runtime_sha256]||host.runtimes?.[plan.recipe_id];if(!runtime||!path.isAbsolute(runtime.root))fail('worker_unqualified');privatePath(runtime.root,true);
 const manifestFile=path.join(runtime.root,'runtime-manifest.json'),manifest=JSON.parse(bytes(manifestFile,runtime.manifest_sha256));
 if(manifest.version!==1||manifest.source_content_sha256!==plan.runtime_sha256||hash(JSON.stringify(manifest.files))!==plan.runtime_sha256)fail('runtime_binding_mismatch');
 for(const file of manifest.files){if(typeof file.path!=='string'||path.isAbsolute(file.path)||file.path.split(/[\\/]/).includes('..'))fail('runtime_binding_mismatch');bytes(path.join(runtime.root,file.path),file.sha256);}
 if(!plan.input_hashes||typeof plan.input_hashes!=='object'||Array.isArray(plan.input_hashes)||!Object.hasOwn(plan.input_hashes,plan.driver_module))fail('plan_binding_mismatch');
 let driver;for(const [file,sha]of Object.entries(plan.input_hashes)){if(!path.isAbsolute(file))fail('plan_binding_mismatch');const value=bytes(file,sha);if(file===plan.driver_module)driver=value;}
 const workerFile=path.join(runtime.root,'scripts/improve-service-worker.cjs');if(!manifest.files.some(f=>f.path==='scripts/improve-service-worker.cjs'))fail('runtime_binding_mismatch');
 return {runtimeRoot:runtime.root,workerFile,driver};
}
function load(plan,host){const {driver,runtimeRoot}=validate(plan,host),module=new Module(plan.driver_module);module.filename=plan.driver_module;module.paths=Module._nodeModulePaths(path.dirname(plan.driver_module));module._compile(driver.toString('utf8'),plan.driver_module);if(typeof module.exports.run!=='function')fail('plan_driver_unavailable');return {driver:module.exports,runtimeRoot};}
module.exports={validate,load};
