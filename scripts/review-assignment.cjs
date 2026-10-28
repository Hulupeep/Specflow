'use strict';
// Selection authority is the installed, package-verified managed profile. A
// copied descriptor or a caller's method/family assertion is not an assignment.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const issued=new WeakSet(), proofs=new WeakMap(), nativeCalls=new WeakMap();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const digest=v=>sha(JSON.stringify(v??null));
function fileHash(file) {
  for(let p=path.resolve(file);p!==path.dirname(p);p=path.dirname(p)) if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink()) throw Error('Review assignment cannot follow symlinks');
  const s=fs.lstatSync(file);if(!s.isFile()||s.nlink!==1||s.size>1024*1024)throw Error('Invalid review assignment file');
  return sha(fs.readFileSync(file));
}
function projectPolicy(record){
  const method=record?.profile?.requiredReviewMethod;
  if(method!==undefined&&!['duo','fresh-native'].includes(method))throw Error('Unsupported project review method');
  if(method==='duo')throw Error('Selected project policy requires Duo; use specflow duo-build without a fallback');
}
function resolve(root,record,sourceRoot=path.resolve(__dirname,'..')) {
  projectPolicy(record);
  const routing=require(path.join(sourceRoot,'scripts/runtime-routing.cjs'));
  const verified=routing.verifyRuntimeRouting({targetRoot:root,sourceRoot});
  if(!verified.ok)throw Error(verified.error);
  if(verified.status!=='ok')throw Error('Custom routing is preserved; fresh-native requires a verified managed assignment');
  const yaml=require('js-yaml');
  const active=path.join(root,'.specflow/adapter-routing.yml'), p=yaml.load(fs.readFileSync(active,'utf8'));
  if(fileHash(active)!==fileHash(path.join(sourceRoot,'templates/adapter-policies',routing.RUNTIMES[verified.runtime])))throw Error('Managed active profile differs from the trusted shipped assignment');
  const r=p.routing_profile.normal_review, policy=p.policies[r.policy].adapter_policy;
  if(policy.role!=='verifier'||policy.session_id)throw Error('Fresh-native requires a fresh critic policy');
  const files=[active,path.join(root,'.specflow/install-state.yml'),path.join(sourceRoot,'templates/adapter-policies',routing.RUNTIMES[verified.runtime])];
  const value={version:1,method:'fresh-native',purpose:'preparation',runtime:verified.runtime,profile_id:p.routing_profile.id,profile_sha256:fileHash(active),policy_id:r.policy,policy_sha256:digest(policy),reviewer_model:policy.requested_model||policy.model||null,files:Object.fromEntries(files.map(f=>[f,fileHash(f)]))};
  issued.add(value);return Object.freeze(value);
}
function trusted(value){return issued.has(value);}
function restore(root,value){validate(root,value);const copy=Object.freeze(structuredClone(value));issued.add(copy);return copy;}
function validate(root,value) {
  if(value?.version!==1||value.method!=='fresh-native'||value.purpose!=='preparation'||!['codex','claude-code'].includes(value.runtime))throw Error('Invalid pinned native review assignment');
  if(!Object.hasOwn(value.files||{},path.join(root,'.specflow/adapter-routing.yml')))throw Error('Review assignment belongs to another repository');
  for(const [file,hash]of Object.entries(value.files)) if(fileHash(file)!==hash)throw Error(`Pinned review assignment changed: ${file}; retain this run and rebind/review current policy in a linked scope`);
  return value;
}
function match(record,value){projectPolicy(record);if(digest(record?.profile?.reviewAssignment)!==digest(value))throw Error('Current record is not bound to the selected review assignment; run specflow review bind before gates');}
function bind(root,file,sourceRoot) {
  const spec=require('./specflow-specification.cjs'),record=spec.current(root,spec.read(root,file)),assignment=resolve(root,record,sourceRoot);
  if(digest(record.profile?.reviewAssignment)===digest(assignment))return {status:'unchanged',assignment,readinessPreserved:!!record.readiness};
  record.profile||={};record.profile.reviewAssignment=assignment;delete record.readiness;
  spec.write(root,file,record);return {status:'bound',assignment,next_action:'Run current gates and scoped fresh-native preparation; existing receipts and history remain historical'};
}
// Only the owning in-process native transport issues this handle, after native
// content receipts and snapshot validation. JSON and simulated invocations cannot.
function invoke(assignment,exe,args,options){
  if(!trusted(assignment)||exe!==(assignment.runtime==='codex'?'codex':'claude'))throw Error('Trusted host transport required');
  if(options?.env?.SPECFLOW_DUO_REVIEWER!=='1'||!options.cwd)throw Error('Owning review invocation required');
  const requestFile=path.join(options.cwd,'request.json'),requestHash=fileHash(requestFile),request=JSON.parse(fs.readFileSync(requestFile,'utf8'));
  if(request.review_method!=='fresh-native'||request.review_purpose!=='preparation')throw Error('Owning review invocation requires the pinned fresh-native preparation purpose');
  const transportBuilder=assignment.runtime==='codex'?'claude-code':'codex';
  const model=assignment.reviewer_model||request.context?.specification?.reviewerModel||null;
  const expected=require('./duo-build.cjs').invocation(transportBuilder,options.cwd,request.github,model);
  if(exe==='claude'){
    expected.args[expected.args.indexOf('--json-schema')+1]=JSON.stringify(JSON.parse(fs.readFileSync(path.join(options.cwd,'schema.json'),'utf8')));
    if(model)expected.args.push('--model',model);
  }
  if(JSON.stringify(args)!==JSON.stringify(expected.args)||Object.entries(expected.env).some(([k,v])=>options.env[k]!==v))throw Error('Native proof requires the canonical fresh read-only review invocation');
  const result=require('child_process').spawnSync(exe,args,{encoding:'utf8',maxBuffer:32*1024*1024,...options});
  if(result.error||result.status!==0)throw Error(`${exe}: ${result.error?.message||result.stderr||result.stdout||`exit ${result.status}`}`);
  const raw=result.stdout||'';let events=[],response=null;
  try{
    events=raw.trim().split('\n').filter(Boolean).map(JSON.parse);
    const wrapper=events.findLast(e=>e.type==='result'||e.structured_output);
    response=exe==='claude'?(wrapper?.structured_output||JSON.parse(wrapper?.result)):JSON.parse(fs.readFileSync(path.join(options.cwd,'response.json'),'utf8'));
  }catch{/* The owning protocol validator reports malformed native output. */}
  const served=events.find(e=>e.type==='system'&&e.model)?.model||events.find(e=>e.message?.model)?.message.model||events.find(e=>e.model)?.model;
  const handle=Object.freeze({});nativeCalls.set(handle,{assignment:digest(assignment),provider:exe,raw:sha(raw),events,response,request,requestHash,requestFile,model:served||model});
  return {raw:result.stdout||'',stderr:result.stderr||'',handle};
}
function executed(reservation,assignment,call,_callerEvents,round,request) {
  const native=nativeCalls.get(call);
  if(!trusted(assignment)||!native||native.assignment!==digest(assignment)||sha(fs.readFileSync(path.join(round,'stdout.txt')))!==native.raw)throw Error('Owning native transport execution proof required');
  if(fileHash(native.requestFile)!==native.requestHash||digest(request)!==digest(native.request)||reservation.scope!==require('./specflow-tier.cjs').inputHash(native.request.specification_review?.record)||reservation.tier!==native.request.context?.specification?.targetTier)throw Error('Native transport is not bound to this frozen request/reservation');
  const receipt=require('./duo-review-receipts.cjs').collect(native.events,round,[...request.requiredReads,...Object.keys(request.instruction_review.artifactHashes),'request.json']);
  if(request.requiredReads.some(p=>!receipt.inspected.includes(p)))throw Error('Owning native content receipt missing');
  if(!native.response?.outcome)throw Error('Native peer outcome unavailable');
  const handle=Object.freeze({});proofs.set(handle,{reservation:reservation.id,assignment:digest(assignment),provider:native.provider,model:native.model,outcome:native.response.outcome});return handle;
}
function owns(handle,reservation,report){const p=proofs.get(handle);return !!p&&p.reservation===reservation.id&&p.assignment===digest(reservation.reviewAssignment)&&p.provider===(reservation.reviewAssignment.runtime==='codex'?'codex':'claude')&&p.provider===report?.identity?.provider&&p.model===report?.identity?.model&&p.outcome===report?.nativeOutcome;}
module.exports={resolve,trusted,restore,validate,match,bind,invoke,executed,owns,digest};
