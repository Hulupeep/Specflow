'use strict';
// Explicit read-only factory-admission qualification using a real prepared job.
// Malformed fixtures are separate private files; original job files stay intact.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const worker=require('../../scripts/improve-worker.cjs');
const generation=require('../../scripts/improve-backend-generation.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const clone=x=>JSON.parse(JSON.stringify(x));
const q=read(process.argv[2]),config=read(q.configFile),binding=read(config.backendJobBinding.path);
assert.equal(hash(fs.readFileSync(config.backendJobBinding.path)),config.backendJobBinding.sha256);
const store=new worker.DurableStore({root:config.worker.stateRoot,sourceRoot:config.worker.stateRoot});
const root=fs.mkdtempSync(path.join(q.root,'admission-negatives-'));fs.chmodSync(root,0o700);
function write(name,value){const file=path.join(root,name),bytes=canonical(value);fs.writeFileSync(file,bytes,{mode:0o600,flag:'wx'});return {path:file,sha256:hash(bytes)};}
function snapshot(dir){return fs.existsSync(dir)?fs.readdirSync(dir).sort().flatMap(n=>{const file=path.join(dir,n),s=fs.lstatSync(file);return s.isFile()?[[n,hash(fs.readFileSync(file))]]:[];}):[];}
const attemptsBefore=snapshot(path.join(store.root,'backend-attempts'));
const originalTemplate=read(binding.value.inputsTemplate.path),templateHash=hash(fs.readFileSync(binding.value.inputsTemplate.path));
let creates=0;const create=worker.DockerWorker.prototype.create;
worker.DockerWorker.prototype.create=function(...args){creates++;return create.apply(this,args);};
const cases=[];
function install(c){const {service,report}=worker.currentAuthority(c);const result=service.withAuthorized(report.lease,'execute',()=>generation.install(c,q.runDir,()=>worker.currentAuthority(c)));assert(result.allowed,'owner authority denied admission probe');return result.result;}
function signed(c,value,name,mac){c.backendJobBinding=write(name,{value,mac:mac??store.mac(JSON.parse(canonical(value)))});}
function reject(name,expected,mutate){const c=clone(config),value=clone(binding.value);mutate(c,value,name);let cause;try{install(c);}catch(e){cause=e.code||e.message;}assert.equal(cause,expected,name);cases.push({name,result:'rejected',cause});}
try{
 const token=install(config);assert(token&&typeof token==='object');
 cases.push({name:'real_prepared_binding_positive_control',result:'admitted'});
 reject('missing_binding_file','backend_input_invalid',c=>{c.backendJobBinding.path=path.join(root,'absent-binding.json');});
 reject('changed_binding_bytes','backend_input_changed',c=>{c.backendJobBinding.sha256='0'.repeat(64);});
 reject('invalid_mac','backend_binding_invalid',(c,v,n)=>signed(c,v,n,'0'.repeat(64)));
 reject('foreign_job','backend_binding_invalid',c=>{c.worker.jobId+='-foreign';});
 reject('foreign_signed_run','backend_binding_invalid',(c,v,n)=>{v.runId+='-foreign';signed(c,v,n);});
 reject('changed_original_deadline','backend_binding_invalid',c=>{c.deadlineAtMs++;});
 reject('missing_original_deadline','backend_binding_invalid',c=>{delete c.deadlineAtMs;});
 reject('wrong_dependency_provenance','build_dependency_source',(c,v,n)=>{v.dependencySource.lockSha256='0'.repeat(64);signed(c,v,n);});
 reject('foreign_dependency_job','backend_binding_invalid',(c,v,n)=>{v.dependencies.expected.identity.jobId+='-foreign';signed(c,v,n);});
 reject('missing_inputs_file','backend_input_invalid',(c,v,n)=>{v.inputsTemplate.path=path.join(root,'absent-inputs.json');signed(c,v,n);});
 reject('changed_inputs_bytes','backend_input_changed',(c,v,n)=>{v.inputsTemplate.sha256='0'.repeat(64);signed(c,v,n);});
 for(const [name,mutate]of [
  ['unqualified_image',t=>{t.images.database='postgres:latest';}],
  ['changed_migration_digest',t=>{t.migrations[0].sha256='0'.repeat(64);}],
  ['missing_migration_entry',t=>{t.migrations.pop();}]
 ])reject(name,'backend_input_invalid',(c,v,n)=>{const t=clone(originalTemplate);mutate(t);v.inputsTemplate=write(n+'-inputs',t);signed(c,v,n);});
 assert.equal(creates,0);assert.deepEqual(snapshot(path.join(store.root,'backend-attempts')),attemptsBefore);
 assert.equal(hash(fs.readFileSync(config.backendJobBinding.path)),config.backendJobBinding.sha256);
 assert.equal(hash(fs.readFileSync(binding.value.inputsTemplate.path)),templateHash);
 const result={status:'passed',root,executed:cases.length,rejected:cases.filter(c=>c.result==='rejected').length,failed:0,skipped:0,workerCreateCalls:creates,originalJobBindingsAndAttemptRecordsUnchanged:true,cases,scope:'Real prepared-job configuration, current owner authority and factory install admission; no mocked return values, backend start or deciding checks. Does not prove migration-file execution/readiness failure or the remaining live fault matrix.'};
 write('result.json',result);console.log(JSON.stringify(result));
}finally{worker.DockerWorker.prototype.create=create;}
