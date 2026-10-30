'use strict';
// Closed admission for #293. Validated data is not a live backend capability.
// Only the trusted coordinator may consume private artifacts; no Docker RPC here.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { canonical } = require('./improve-production-build.cjs');
const { directory } = require('./improve-offline-cache.cjs');
const { validPhase } = require('./improve-backend-phase.cjs');
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
const RECIPE = freeze(require('./improve-backend-recipe.json'));
const PROFILE = freeze(require('./improve-backend-profile.json'));
function need(ok, code = 'backend_input_invalid') { if (!ok) throw new Error(code); }
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const digestValid = value => typeof value === 'string' && value.length === 64 && /^[a-f0-9]{64}$/.test(value);
const idValid = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value) && !/\s/.test(value);
function exact(value, fields) {
  need(value && Object.getPrototypeOf(value) === Object.prototype &&
    Reflect.ownKeys(value).length === fields.length && fields.every(k => Object.hasOwn(value,k)));
  // No accessors, hidden fields or prototype capabilities may cross admission.
  need(Object.values(Object.getOwnPropertyDescriptors(value)).every(d => d.enumerable && Object.hasOwn(d,'value')));
}
function relative(value) {
  need(typeof value === 'string' && value.length > 0 && value.length <= 4096 &&
    /^[\x20-\x7e]+$/.test(value) && !value.includes('\\') &&
    value.split('/').every(p => p && p !== '.' && p !== '..') && value.split('/').length <= 32);
}
function reference(value) { exact(value,['path','sha256']); relative(value.path); need(digestValid(value.sha256)); }
function parsed(value) {
  if (typeof value === 'string') {
    need(Buffer.byteLength(value) <= 1024 * 1024);
    try { return require('./improve-worker.cjs').strictJSON(value); } catch { throw new Error('backend_input_invalid'); }
  }
  return value;
}
function detached(value) {
  try { return JSON.parse(canonical(value)); } catch { throw new Error('backend_input_invalid'); }
}
function requestData(raw, managed) {
  const r=parsed(raw);
  exact(r,['schema','jobId','phase','recipeId','generation','expectedBackendIdentity','productBuildReceipt','inputManifest','resourceProfile',
    ...(managed?['attempt','constructionSha256']:[])]);
  need(r.schema===(managed?'specflow.backend-request/v2':'specflow.backend-request/v1') && r.recipeId===RECIPE.id && r.resourceProfile===PROFILE.id &&
    idValid(r.jobId) && idValid(r.generation) && (managed?validPhase(r.phase):['baseline','after'].includes(r.phase)) && digestValid(r.expectedBackendIdentity));
  reference(r.productBuildReceipt); reference(r.inputManifest);
  if(managed){reference(r.attempt);need(digestValid(r.constructionSha256));}
  return detached(r);
}
// Separate entrypoints prevent a legacy caller from opting into managed authority
// by adding fields or changing a schema tag. Both return data, not a capability.
function validateRequest(raw){return requestData(raw,false);}
function validateManagedRequest(raw){return requestData(raw,true);}
function validateInputs(raw) {
  const r=parsed(raw), refs=['bootstrap','supabaseCli','seed','credentialBinding','runtimeLayer','configuration','resourceProfile'];
  exact(r,['schema','jobId','recipeId','images','migrationRevision','migrations','migrationRoot',...refs,'expectedState']);
  need(r.schema==='specflow.backend-inputs/v1' && idValid(r.jobId) && r.recipeId===RECIPE.id && r.migrationRevision===RECIPE.migrationRevision);
  exact(r.images,Object.keys(RECIPE.images));need(Object.entries(RECIPE.images).every(([k,v])=>r.images[k]===v));
  need(Array.isArray(r.migrations) && r.migrations.length===RECIPE.migrations.length);
  r.migrations.forEach((m,i)=>{exact(m,['name','sha256']);need(m.name===RECIPE.migrations[i].name && m.sha256===RECIPE.migrations[i].sha256);});
  relative(r.migrationRoot); refs.forEach(k=>reference(r[k]));
  exact(r.expectedState,['schemaSha256','tablesSha256','sequencesSha256','migrationHistorySha256']);
  need(Object.values(r.expectedState).every(digestValid));
  return detached(r);
}
function privateRoot(root) {
  let fd;
  try {
    fd=directory(root);const s=fs.fstatSync(fd);
    need(s.uid===process.getuid() && !(s.mode&0o077),'backend_input_invalid');
    return fd;
  } catch { if(fd!==undefined)fs.closeSync(fd);throw new Error('backend_input_invalid'); }
}
function readBoundFile(root, ref, maxBytes=PROFILE.output.maxFileBytes) {
  reference(ref);need(Number.isSafeInteger(maxBytes)&&maxBytes>0&&maxBytes<=512*1024*1024);
  const rootFd=privateRoot(root);let parent=rootFd, fd;
  try {
    const parts=ref.path.split('/');
    for(const part of parts.slice(0,-1)) {
      const next=fs.openSync(`/proc/self/fd/${parent}/${part}`,fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);
      if(parent!==rootFd)fs.closeSync(parent); parent=next;
    }
    fd=fs.openSync(`/proc/self/fd/${parent}/${parts.at(-1)}`,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);
    const before=fs.fstatSync(fd,{bigint:true});
    need(before.isFile() && before.nlink===1n && before.size<=BigInt(maxBytes),'backend_input_invalid');
    const chunks=[];let size=0;
    for(;;){const buf=Buffer.alloc(65536),n=fs.readSync(fd,buf,0,buf.length,null);if(!n)break;size+=n;need(size<=maxBytes,'backend_input_invalid');chunks.push(buf.subarray(0,n));}
    const after=fs.fstatSync(fd,{bigint:true});
    need(['dev','ino','mode','nlink','size','mtimeNs','ctimeNs'].every(k=>before[k]===after[k]) && BigInt(size)===before.size,'backend_input_changed');
    const bytes=Buffer.concat(chunks);need(hash(bytes)===ref.sha256,'backend_input_changed');return bytes;
  } catch(e){throw new Error(e.message==='backend_input_changed'?'backend_input_changed':'backend_input_invalid');}
  finally {if(fd!==undefined)fs.closeSync(fd);if(parent!==rootFd)fs.closeSync(parent);fs.closeSync(rootFd);}
}
const FAILURE_CAUSES=Object.freeze(['backend_input_invalid','backend_input_changed','backend_identity_mismatch',
  'backend_readiness_failed','backend_controller_died','backend_service_died','backend_lease_expired',
  'backend_storage_limit','backend_output_limit','backend_cleanup_failed','backend_restart_invalid']);
function receiptData(raw, managed) {
  const r=parsed(raw);
  exact(r,['schema','jobId','phase','generation','state','namedCause','expectedBackendIdentity',
    'measuredBackendIdentity','manifest','productBuildReceiptSha256','supervisorJournal','deadlineEpochMs','cleanup','checks',
    ...(managed?['attempt','constructionSha256','attemptTerminal','inputManifestSha256']:[])]);
  need(r.schema===(managed?'specflow.backend-receipt/v2':'specflow.backend-receipt/v1') && idValid(r.jobId) && idValid(r.generation) &&
    (managed?validPhase(r.phase):['baseline','after'].includes(r.phase)) && ['qualified','failed','interrupted'].includes(r.state));
  if(managed){reference(r.attempt);reference(r.attemptTerminal);need(digestValid(r.constructionSha256)&&digestValid(r.inputManifestSha256));}
  need(digestValid(r.expectedBackendIdentity) && digestValid(r.productBuildReceiptSha256) &&
    (r.measuredBackendIdentity===null || digestValid(r.measuredBackendIdentity)) &&
    Number.isSafeInteger(r.deadlineEpochMs) && r.deadlineEpochMs>0);
  reference(r.supervisorJournal);if(r.manifest!==null)reference(r.manifest);
  exact(r.cleanup,['complete','ownedRemoved','remainingOwned']);exact(r.checks,['executed','failed','skipped']);
  const nonnegative=n=>Number.isSafeInteger(n)&&n>=0;
  need(typeof r.cleanup.complete==='boolean' && ['ownedRemoved','remainingOwned'].every(k=>nonnegative(r.cleanup[k])) &&
    r.cleanup.ownedRemoved+r.cleanup.remainingOwned<=PROFILE.aggregate.maxInstances &&
    Object.values(r.checks).every(nonnegative) && r.checks.failed<=r.checks.executed);
  need(!r.cleanup.complete || r.cleanup.remainingOwned===0);
  if(r.state==='qualified') need(r.namedCause===null && r.manifest!==null &&
    r.measuredBackendIdentity===r.expectedBackendIdentity && r.cleanup.complete &&
    r.checks.executed>0 && r.checks.failed===0 && r.checks.skipped===0);
  else need((managed?MANAGED_FAILURE_CAUSES:FAILURE_CAUSES).includes(r.namedCause));
  return detached(r);
}
const MANAGED_FAILURE_CAUSES=Object.freeze([...FAILURE_CAUSES,'backend_cleanup_unconfirmed','backend_attempt_active',
  'backend_credentials_expired','backend_authority_revoked','backend_dependency_changed']);
function validateReceipt(raw){return receiptData(raw,false);}
function validateManagedReceipt(raw){return receiptData(raw,true);}
module.exports={RECIPE,PROFILE,FAILURE_CAUSES,MANAGED_FAILURE_CAUSES,validateRequest,validateManagedRequest,
  validateInputs,validateReceipt,validateManagedReceipt,readBoundFile};
