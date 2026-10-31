'use strict';
// Closed profiles and phase plans are data, never execution authority. The
// coordinator must bind the bytes to the signed template and frozen contract.
const fs=require('fs'),crypto=require('crypto');
const {canonical}=require('./improve-production-build.cjs');
const {validPhase}=require('./improve-backend-phase.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const registry=new Map([
 ['heystax-backend-v1','./improve-backend-profile.json'],
 ['heystax-backend-journeys-v1','./improve-backend-journeys-profile.json'],
 ['heystax-backend-journeys-v2','./improve-backend-journeys-v2-profile.json']
].map(([id,file])=>{const bytes=fs.readFileSync(require.resolve(file));return[id,{bytes,profile:freeze(JSON.parse(bytes))}];}));
function entry(id){if(!registry.has(id))throw Error('backend_profile_invalid');return registry.get(id);}
function profileFor(id){return entry(id).profile;}
function profileBytes(id){return Buffer.from(entry(id).bytes);}
function validateProfileBytes(id,bytes){
 const found=entry(id);
 if(!Buffer.isBuffer(bytes)||!bytes.equals(found.bytes))throw Error('backend_input_changed');
 return found.profile;
}
function reject(code,requiredMilliseconds,availableMilliseconds){
 throw Object.assign(Error(`${code}: required ${requiredMilliseconds}ms, available ${availableMilliseconds}ms`),{
  code,stage:'backend_admission',requiredMilliseconds,availableMilliseconds,
  next_action:'Retain the original run and deadline. Select an explicitly qualified profile that fits every required invocation, or admit a separate successor with sufficient task time; never omit checks or extend a running generation.'
 });
}
function valid(ok){if(!ok)throw Error('backend_inventory_invalid');}
function planPhase({phase,contract,profileId,deadlineAtMs,nowMs=Date.now()}){
 const profile=profileFor(profileId);
 valid(validPhase(phase)&&Array.isArray(contract?.acceptance));
 valid(Number.isSafeInteger(deadlineAtMs)&&deadlineAtMs>0&&Number.isSafeInteger(nowMs)&&nowMs>=0);
 const ids=contract.acceptance.map(a=>a?.id);
 valid(ids.every(id=>typeof id==='string'&&id.trim())&&new Set(ids).size===ids.length);
 const sets=phase==='baseline'?['check','dev_check']:phase==='after'?['check']:['dev_check'];
 const invocations=[];
 for(const key of sets)for(const acceptance of contract.acceptance){
  const raw=acceptance[key];if(raw===undefined||raw===null)continue;
  const check={...raw,id:acceptance.id,required:acceptance.mandatory};
  valid(require('./test-execution.cjs').validateFrozen(check).ok&&check.execution.adapter==='playwright');
  const timeoutMilliseconds=Math.ceil((check.timeout_seconds??120)*1000);
  valid(Number.isSafeInteger(timeoutMilliseconds)&&timeoutMilliseconds>0);
  invocations.push({set:key==='check'?'holdout':'dev',id:acceptance.id,checkSha256:require('./outcome-contract.cjs').hashValue(check),timeoutMilliseconds,
   requiredCaseIds:[...check.execution.required_case_ids],optionalCaseIds:[...check.execution.optional_case_ids]});
 }
 valid(invocations.length>0);
 const declaredMilliseconds=invocations.reduce((sum,c)=>sum+c.timeoutMilliseconds,0);
 const setupMilliseconds=90000,continuityMilliseconds=10000,dispatchMillisecondsPerInvocation=20000;
 const dispatchMilliseconds=invocations.length*dispatchMillisecondsPerInvocation;
 const requiredExecutionMilliseconds=declaredMilliseconds+dispatchMilliseconds+setupMilliseconds+continuityMilliseconds;
 valid(Number.isSafeInteger(requiredExecutionMilliseconds));
 if(requiredExecutionMilliseconds>profile.time.executionMilliseconds)reject('backend_inventory_exceeds_profile',requiredExecutionMilliseconds,profile.time.executionMilliseconds);
 // Recheck after the separately bounded build, before app/backend creation.
 // This does not promise that build time is part of the backend envelope.
 const remaining=deadlineAtMs-nowMs;
 const requiredLifecycleMilliseconds=profileId!=='heystax-backend-v1'?workerLimits(profileId,'app').phaseMilliseconds:profile.time.totalMilliseconds;
 if(remaining<requiredLifecycleMilliseconds)reject('backend_job_time_insufficient',requiredLifecycleMilliseconds,Math.max(0,remaining));
 const inventory={phase,invocations};
 return freeze({schema:'specflow.backend-phase-plan/v1',profileId,profileSha256:hash(entry(profileId).bytes),deadlineAtMs,
  ...inventory,inventorySha256:hash(canonical(inventory)),declaredMilliseconds,dispatchMillisecondsPerInvocation,dispatchMilliseconds,setupMilliseconds,continuityMilliseconds,
  requiredLifecycleMilliseconds,requiredExecutionMilliseconds,availableExecutionMilliseconds:profile.time.executionMilliseconds});
}
// Closed nested lifecycle envelopes include launch/setup before the backend
// clock starts and the managed worker's ten-second cleanup reserve. Generic
// production build timing is not enlarged by this consumer/checker profile.
function workerLimits(id,slot){
 if(!['heystax-backend-journeys-v1','heystax-backend-journeys-v2'].includes(id)||!['app','checker'].includes(slot))throw Error('backend_profile_invalid');
 const p=profileFor(id);
 return freeze({binding:{id,sha256:hash(entry(id).bytes),slot},memory:p.slots[slot].memoryBytes,pids:p.slots[slot].pids,
  tmpfs:slot==='checker'?[{path:'/output',bytes:67108864}]:[],
  phaseMilliseconds:slot==='app'?p.time.totalMilliseconds+p.time.bootstrapMilliseconds+10000:p.time.executionMilliseconds+p.time.cleanupMilliseconds+10000});
}
function serverExpiry(id,credentialExpiresAt,deadlineAtMs,nowSeconds=Math.floor(Date.now()/1000)){
 const p=profileFor(id);
 if(id==='heystax-backend-v1')return nowSeconds+600;
 valid(Number.isSafeInteger(credentialExpiresAt)&&Number.isSafeInteger(deadlineAtMs)&&Number.isSafeInteger(nowSeconds));
 const expiration=Math.min(credentialExpiresAt,Math.floor(deadlineAtMs/1000),nowSeconds+Math.ceil(workerLimits(id,'app').phaseMilliseconds/1000));
 if((expiration-nowSeconds)*1000<p.time.totalMilliseconds)reject('backend_credentials_expired',p.time.totalMilliseconds,Math.max(0,(expiration-nowSeconds)*1000));
 return expiration;
}
module.exports={profileFor,profileBytes,validateProfileBytes,planPhase,workerLimits,serverExpiry};
