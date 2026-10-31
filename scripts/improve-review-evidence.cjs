'use strict';
// Model presentation only. Complete verification evidence stays at source;
// summaries are never capsule inputs or verification/decision receipts.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function copyVerificationEvidence(source,destination,{omitPracticeImages=false,phaseEvidence=null,phaseReceipt=null}={}){
 fs.cpSync(source,destination,{recursive:true,filter:file=>{
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))throw Error('review_evidence_special');
  return !/server\.log$/.test(file);
 }});
 const manifest=[];
 for(const name of fs.readdirSync(destination)) {
  if(!/^binding-[a-f0-9-]{36}\.json$/.test(name))continue;
  const file=path.join(destination,name),bytes=fs.readFileSync(file);let value;try{value=require('./improve-worker.cjs').strictJSON(bytes.toString());}catch{continue;}
  if(!bindingEnvelope(value))continue;
  const original=reference(bytes),w=value.identity.workspace;
  value.schema='specflow.review-binding-summary/v1';
  value.identity.workspace={sha256:w.sha256,bytes:w.bytes,limits:w.limits,entryCount:w.entries.length,entriesSha256:hash(JSON.stringify(w.entries))};
  value.presentation={original,notice:NOTICE};fs.writeFileSync(file,JSON.stringify(value)+'\n');
 }
 for(const name of fs.readdirSync(destination)){
  if(!/^backend-proof-[a-f0-9-]{36}$/.test(name))continue;
  const dir=path.join(destination,name);
  if(!fs.lstatSync(dir).isDirectory())continue;
  const file=path.join(dir,'receipt.json');if(!fs.existsSync(file))continue;
  const bytes=fs.readFileSync(file);let value;try{value=require('./improve-worker.cjs').strictJSON(bytes.toString());}catch{continue;}
  if(backendEntry(value)) {
   // Keep every inspected service/configuration value. Only remove the exact
   // duplicate projection and a validated path->digest inventory.
   const original=reference(bytes),omitted={configurationServices:reference(Buffer.from(JSON.stringify(value.configuration.services))),stageHashes:reference(Buffer.from(JSON.stringify(value.stageHashes)))};
   value.configuration={gateway:value.configuration.gateway,services:'Exact projection of retained services[].semantic, with role; see presentation metadata.'};
   delete value.stageHashes;value.schema='specflow.review-backend-entry-summary/v1';value.presentation={original,omitted,notice:NOTICE};fs.writeFileSync(file,JSON.stringify(value)+'\n');continue;
  }
  // Unknown shapes stay complete: never hide an arbitrary oversized artifact
  // merely because a producer used a familiar filename or schema string.
  if(value?.schema!=='specflow.input-capsule/v1'||Object.keys(value).sort().join(',')!=='bytes,entries,entryCount,schema'||
     !capsule(value))continue;
  const summary={schema:'specflow.review-capsule-summary/v1',
   original:{sha256:crypto.createHash('sha256').update(bytes).digest('hex'),fileBytes:bytes.length},
   capsule:{schema:value.schema,bytes:value.bytes,entryCount:value.entryCount},
   omitted:'Per-file capsule inventory retained in original verification evidence; this summary neither verifies it nor grants execution or decision authority.'};
  fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n');
 }
 if(omitPracticeImages) {
  const roots=practiceRoots(path.resolve(source),phaseEvidence,phaseReceipt);
  function walk(rel) {for(const name of fs.readdirSync(path.join(destination,rel)).sort()) {
   const sub=rel?rel+'/'+name:name,file=path.join(destination,sub),stat=fs.lstatSync(file);
   if(stat.isDirectory())walk(sub);
   else if(sub.endsWith('.png')&&[...roots].some(r=>sub.startsWith(r+'/'))) {
    manifest.push({path:sub,...reference(fs.readFileSync(file)),reason:'practice-only screenshot; textual reports retained'});fs.unlinkSync(file);
   }
  }}walk('');
  fs.writeFileSync(path.join(destination,'review-presentation.json'),JSON.stringify({schema:'specflow.review-presentation/v1',notice:NOTICE,omittedPracticeImages:manifest},null,2)+'\n');
 }
}
const NOTICE='Presentation only; originals remain authoritative. This summary grants no verification, execution or decision authority.';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const reference=b=>({sha256:hash(b),fileBytes:Buffer.byteLength(b)});
function keys(v,required,optional=[]) {return v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));}
const hex=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const rel=v=>typeof v==='string'&&v.length>0&&!path.isAbsolute(v)&&!v.includes('\\')&&!v.includes('\0')&&!v.split('/').some(p=>!p||p==='.'||p==='..');
function workspace(w) {
 if(!keys(w,['sha256','entries','bytes','limits'])||!hex(w.sha256)||!Number.isSafeInteger(w.bytes)||w.bytes<0||
  !keys(w.limits,['max_bytes','max_entries'])||!Object.values(w.limits).every(n=>Number.isSafeInteger(n)&&n>0)||!Array.isArray(w.entries)||w.entries.length>w.limits.max_entries||w.bytes>w.limits.max_bytes)return false;
 let bytes=0;const seen=new Set();
 for(const e of w.entries) {
  if(!keys(e,['path','kind'],['token','sha256'])||(!rel(e.path)&&!(e.path===''&&e.kind==='directory'))||seen.has(e.path))return false;seen.add(e.path);
  if(e.kind==='mutable-output'){if(!keys(e,['path','kind']))return false;continue;}
  if(!['file','directory','symlink'].includes(e.kind)||!Array.isArray(e.token)||e.token.length!==(e.kind==='directory'?3:6)||!e.token.every(t=>typeof t==='string'&&/^\d+$/.test(t)))return false;
  if(e.kind==='directory'){if(Object.hasOwn(e,'sha256'))return false;}else if(!hex(e.sha256))return false;
  if(e.kind==='file'){const size=Number(e.token[3]);if(!Number.isSafeInteger(size))return false;bytes+=size;}
 }
 return Number.isSafeInteger(bytes)&&bytes===w.bytes&&hash(JSON.stringify(w.entries))===w.sha256;
}
const id=v=>typeof v==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(v);
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const commit=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
function bindingEnvelope(v) {
 if(v?.schema!=='specflow.improve.binding/v1'||!keys(v,['schema','attempt','identity','evidence'],['backend'])||!uuid(v.attempt)||!Array.isArray(v.evidence)||!v.evidence.every(e=>keys(e,['id','sha256'])&&id(e.id)&&hex(e.sha256))||new Set(v.evidence.map(e=>e.id)).size!==v.evidence.length)return false;
 const i=v.identity;
 return keys(i,['run_id','phase','contract_version','contract_sha256','artifact_sha256','base_commit','verifier','git','workspace'])&&id(i.run_id)&&['baseline','after'].includes(i.phase)&&Number.isSafeInteger(i.contract_version)&&i.contract_version>0&&hex(i.contract_sha256)&&object(i.artifact_sha256)&&Object.entries(i.artifact_sha256).every(([k,x])=>rel(k)&&hex(x))&&commit(i.base_commit)&&hex(i.verifier)&&keys(i.git,['tree','parent','branch'])&&commit(i.git.tree)&&commit(i.git.parent)&&typeof i.git.branch==='string'&&i.git.branch.startsWith('refs/heads/')&&workspace(i.workspace)&&(!Object.hasOwn(v,'backend')||object(v.backend));
}
function capsule(v) {
 if(!Array.isArray(v.entries)||v.entryCount!==v.entries.length||!Number.isSafeInteger(v.bytes)||v.bytes<0)return false;
 let bytes=0;const seen=new Set();
 for(const e of v.entries) {
  if(!rel(e.path)||seen.has(e.path)||!Number.isSafeInteger(e.mode)||e.mode<0||e.mode>0o777)return false;seen.add(e.path);
  if(e.kind==='directory'){if(!keys(e,['kind','mode','path']))return false;}
  else if(e.kind==='file'){if(!keys(e,['kind','mode','path','sha256','size'])||!hex(e.sha256)||!Number.isSafeInteger(e.size)||e.size<0)return false;bytes+=e.size;}
  else return false;
 }
 return Number.isSafeInteger(bytes)&&bytes===v.bytes;
}
function backendEntry(v) {
 if(v?.schema!=='specflow.backend-entry/v1'||!keys(v,['schema','jobId','phase','generation','expectedBackendIdentity','measuredBackendIdentity','inputManifestSha256','state','counts','snapshotProtocol','schemaArtifact','services','configuration','stageHashes'],['constructionSha256','attemptSha256']))return false;
 if((!id(v.jobId)||!uuid(v.generation)||!['baseline','after'].includes(v.phase)||v.snapshotProtocol!=='repeatable-read-read-only-exported-snapshot')||!['expectedBackendIdentity','measuredBackendIdentity','inputManifestSha256'].every(k=>hex(v[k]))||!keys(v.state,['migrationHistorySha256','schemaSha256','sequencesSha256','tablesSha256'])||!Object.values(v.state).every(hex)||!keys(v.counts,['migrations','rows','sequences','tables'])||!Object.values(v.counts).every(n=>Number.isSafeInteger(n)&&n>=0)||!keys(v.schemaArtifact,['path','sha256'])||typeof v.schemaArtifact.path!=='string'||!hex(v.schemaArtifact.sha256))return false;
 if(Object.hasOwn(v,'constructionSha256')!==Object.hasOwn(v,'attemptSha256')||(Object.hasOwn(v,'attemptSha256')&&(!hex(v.attemptSha256)||!hex(v.constructionSha256))))return false;
 if(!keys(v.configuration,['gateway','services'])||!Array.isArray(v.configuration.services)||!object(v.configuration.gateway)||!Array.isArray(v.services)||!v.services.every(x=>keys(x,['id','role','rawInspectionSha256','semantic'])&&typeof x.id==='string'&&typeof x.role==='string'&&hex(x.rawInspectionSha256)&&keys(x.semantic,['image','config','host','mounts'])&&typeof x.semantic.image==='string'&&object(x.semantic.config)&&object(x.semantic.host)&&Array.isArray(x.semantic.mounts)))return false;
 if(!object(v.stageHashes)||!Object.entries(v.stageHashes).every(([k,x])=>rel(k)&&hex(x)))return false;
 return require('util').isDeepStrictEqual(v.configuration.services,v.services.map(x=>({role:x.role,...x.semantic})));
}
// Classification comes from native verifier records, never screenshot names.
// An acceptance reference always wins over a practice reference.
function practiceRoots(source,items,reference) {
 try {
  if(!Array.isArray(items)||!reference||!hex(reference.sha256))return new Set();
  const receiptRel=path.relative(source,reference.path);
  if(!/^binding-[a-f0-9-]{36}\.json$/.test(receiptRel))return new Set();
  const bytes=fs.readFileSync(reference.path);if(hash(bytes)!==reference.sha256)return new Set();
  const receipt=require('./improve-worker.cjs').strictJSON(bytes.toString());
  if(!bindingEnvelope(receipt)||receipt.evidence.length!==items.length)return new Set();
  const seen=new Set(),dev=new Set(),required=new Set();
  for(const ref of receipt.evidence) {
   const item=items.find(x=>x.id===ref.id);
   if(!item||seen.has(item.id)||hash(JSON.stringify(item))!==ref.sha256||item.phase!==receipt.identity.phase||item.contract_version!==receipt.identity.contract_version)return new Set();seen.add(item.id);
   if(!item.native_execution)continue;
   if(item.kind!=='executable-check'||item.producer_role!=='verifier-mechanical'||item.executor!=='specflow-improve'||!['dev','holdout','gate'].includes(item.set)||!['pass','fail','blocked'].includes(item.result))return new Set();
   const rel=path.relative(source,item.evidence_path),native=item.native_execution;
   if(!/^runtime-evidence\/[^/]+\/execution\.json$/.test(rel)||native.receipt_path!==item.evidence_path||native.receipt_sha256!==item.evidence_sha256||!hex(item.evidence_sha256)||hash(fs.readFileSync(item.evidence_path))!==item.evidence_sha256)return new Set();
   (item.set==='dev'?dev:required).add(path.dirname(rel));
  }
  return new Set([...dev].filter(x=>!required.has(x)));
 }catch{return new Set();}
}
module.exports={copyVerificationEvidence};
