'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const w=require(process.cwd()+'/scripts/improve-worker.cjs');
// Explicit operator-supplied, previously qualified worker software configuration.
// No downloads, models, product services or production data are used here.
if (process.argv.length !== 4) throw Error('Usage: node scripts/qualify-input-capsule.cjs WORKER_CONFIG PRIVATE_EVIDENCE_DIRECTORY');
const old=JSON.parse(fs.readFileSync(process.argv[2]));
const base=path.resolve(process.argv[3]);
fs.mkdirSync(base,{recursive:true,mode:0o700});
const baseStat=fs.lstatSync(base);
assert(baseStat.isDirectory() && !baseStat.isSymbolicLink() && baseStat.uid===process.getuid() && (baseStat.mode&0o077)===0,'Evidence directory must be owner-private');
const root=fs.mkdtempSync(base+'/live-');fs.chmodSync(root,0o700);
const worker=new w.DockerWorker({...old,gitArea:null,jobId:'capsule-live',stateRoot:root,maxMilliseconds:240000});
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const options={recipeSha256:hash('scripts/improve-worker-capsule.py'),sourceInputSha256:hash(__filename)};
const results={startedAt:new Date().toISOString(),checks:{},helperSha256:options.recipeSha256,workerSha256:hash('scripts/improve-worker.cjs'),probeSha256:options.sourceInputSha256};
function denied(name,fn,pattern){let caught;try{fn()}catch(e){caught=e}assert(caught, name+' unexpectedly allowed');assert(pattern.test(caught.code||caught.message),name+': '+caught.code);results.checks[name]={passed:true,code:caught.code};}
try {
 const app=worker.create({tmpfs:[{path:'/data',bytes:16*1024*1024}]});
 worker.exec(app,['/node/bin/node','-e',"const f=require('fs');f.mkdirSync('/data/tree/pkg',{recursive:true});f.mkdirSync('/data/tree/bin');f.mkdirSync('/data/tree/empty');f.writeFileSync('/data/tree/pkg/tool',\"console.log('capsule-live-ok')\",{mode:0o755});f.symlinkSync('../pkg/tool','/data/tree/bin/tool');"],{cwd:'/tmp'});
 denied('unpaused',()=>worker.captureCapsule(app,'/data/tree',root+'/unpaused',options),/capsule_not_quiescent/);
 worker.pause(app);
 const processState=worker.capsuleState(app);
 assert(w.containerProcessIdentity(app,processState.Pid).identity.start);results.checks.actualProcessIdentity={passed:true};
 denied('hostProcessRejected',()=>w.containerProcessIdentity(app,process.pid),/capsule_process_identity/);
 denied('wrongContainerProcessRejected',()=>w.containerProcessIdentity('a'.repeat(64),processState.Pid),/capsule_process_identity/);
 const originalState=worker.capsuleState.bind(worker);let identityCalls=0;
 worker.capsuleState=id=>{const state=originalState(id);if(++identityCalls===2)state.processIdentity.identity.start+='-injected-change';return state;};
 try{denied('injectedIdentityChangeBeforeAdmission',()=>worker.captureCapsule(app,'/data/tree',root+'/identity-changed',options),/capsule_container_changed/);assert(!fs.existsSync(root+'/identity-changed'));}
 finally{worker.capsuleState=originalState;}
 const otherRoot=fs.mkdtempSync(base+'/other-');fs.chmodSync(otherRoot,0o700);const other=new w.DockerWorker({...old,gitArea:null,jobId:'other-job',stateRoot:otherRoot});
 try{denied('unowned',()=>other.captureCapsule(app,'/data/tree',otherRoot+'/foreign',options),/capsule_container_identity/);}finally{other.close();}
 const target=root+'/admitted';const receipt=worker.captureCapsule(app,'/data/tree',target,options);
 assert.equal(receipt.status,'admitted');assert.equal(receipt.identity.sourceContainerId,app);results.checks.ownedPausedCapture={passed:true,manifestSha256:receipt.manifestSha256};
 const expected={identity:receipt.identity,manifestSha256:receipt.manifestSha256};
 const consumer=worker.create({capsules:[{target,expected,destination:'/capsule'}]});
 const r=worker.exec(consumer,['/node/bin/node','/capsule/bin/tool'],{cwd:'/tmp'});assert.equal(r.stdout.trim(),'capsule-live-ok');
 const observation=worker.exec(consumer,['/node/bin/node','-e',"const f=require('fs');let denied=false;try{f.writeFileSync('/capsule/pkg/tool','bad')}catch(e){denied=['EROFS','EACCES'].includes(e.code)}console.log(JSON.stringify({denied,mode:f.statSync('/capsule/pkg/tool').mode&511,empty:f.readdirSync('/capsule/empty').length}))"],{cwd:'/tmp'});
 assert.deepEqual(JSON.parse(observation.stdout),{denied:true,mode:493,empty:0});results.checks.readOnlyExecutableRoundTrip={passed:true};worker.destroy(consumer);
 denied('ordinaryEvidenceStillRejectsLinks',()=>worker.capture(app,'/data/tree',root+'/ordinary'),/artifact_special_or_link/);
 denied('wrongJob',()=>worker.create({capsules:[{target,expected:{...expected,identity:{...expected.identity,jobId:'foreign'}},destination:'/capsule'}]}),/capsule_job_identity/);
 const realState=worker.capsuleState.bind(worker);let calls=0;
 worker.capsuleState=id=>{if(++calls===2)worker.call(['unpause',id]);return realState(id)};
 try{denied('realUnpauseBeforeAdmission',()=>worker.captureCapsule(app,'/data/tree',root+'/interrupted',options),/capsule_not_quiescent/);assert(!fs.existsSync(root+'/interrupted'));}
 finally{worker.capsuleState=realState;worker.pause(app);}
 fs.appendFileSync(target+'/tree/pkg/tool','\n// mutation');const count=worker.containers.size;
 denied('changedInputBeforeCreate',()=>worker.create({capsules:[{target,expected,destination:'/capsule'}]}),/capsule_tree_changed/);assert.equal(worker.containers.size,count);
 results.status='passed';
}catch(e){results.status='failed';results.error=e.code||e.message;process.exitCode=1;}
finally{try{worker.close()}catch(e){results.status='failed';results.teardown=e.code;process.exitCode=1;}results.remainingOwnedContainers=worker.containers.size;results.endedAt=new Date().toISOString();fs.writeFileSync(root+'/result.json',JSON.stringify(results,null,2),{mode:0o600});fs.writeFileSync(base+'/live-result.json',JSON.stringify({root,...results},null,2),{mode:0o600});console.log(JSON.stringify({root,...results}));}
