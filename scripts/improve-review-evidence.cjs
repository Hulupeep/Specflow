'use strict';
// Model presentation only. Complete verification evidence stays at source;
// summaries are never capsule inputs or verification/decision receipts.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
function copyVerificationEvidence(source,destination){
 fs.cpSync(source,destination,{recursive:true,filter:file=>{
  const stat=fs.lstatSync(file);
  if(stat.isSymbolicLink()||(!stat.isDirectory()&&!stat.isFile()))throw Error('review_evidence_special');
  return !/server\.log$/.test(file);
 }});
 for(const name of fs.readdirSync(destination)){
  if(!/^backend-proof-[a-f0-9-]{36}$/.test(name))continue;
  const dir=path.join(destination,name);
  if(!fs.lstatSync(dir).isDirectory())continue;
  const file=path.join(dir,'receipt.json');if(!fs.existsSync(file))continue;
  const bytes=fs.readFileSync(file);let value;try{value=JSON.parse(bytes);}catch{continue;}
  // Unknown shapes stay complete: never hide an arbitrary oversized artifact
  // merely because a producer used a familiar filename or schema string.
  if(value?.schema!=='specflow.input-capsule/v1'||Object.keys(value).sort().join(',')!=='bytes,entries,entryCount,schema'||
     !Array.isArray(value.entries)||value.entryCount!==value.entries.length||!Number.isSafeInteger(value.bytes)||value.bytes<0)continue;
  const summary={schema:'specflow.review-capsule-summary/v1',
   original:{sha256:crypto.createHash('sha256').update(bytes).digest('hex'),fileBytes:bytes.length},
   capsule:{schema:value.schema,bytes:value.bytes,entryCount:value.entryCount},
   omitted:'Per-file capsule inventory retained in original verification evidence; this summary neither verifies it nor grants execution or decision authority.'};
  fs.writeFileSync(file,JSON.stringify(summary,null,2)+'\n');
 }
}
module.exports={copyVerificationEvidence};
