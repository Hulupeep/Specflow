'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const {copyVerificationEvidence}=require('../../scripts/improve-review-evidence.cjs');
const {curatedText}=require('../../scripts/improve-worker.cjs');
const {fenceInputTree}=require('../../scripts/improve-untrusted.cjs');
let root,source,target,receipt;
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
beforeEach(()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'review-evidence-'));source=path.join(root,'original');target=path.join(root,'peer');
 receipt=path.join(source,'backend-proof-11111111-1111-1111-1111-111111111111/receipt.json');fs.mkdirSync(path.dirname(receipt),{recursive:true});
 const entries=Array.from({length:4000},(_,i)=>({path:'src/file-'+i,sha256:'a'.repeat(64)}));
 fs.writeFileSync(receipt,JSON.stringify({schema:'specflow.input-capsule/v1',bytes:900000,entryCount:entries.length,entries}));
 fs.writeFileSync(path.join(source,'native-report.json'),JSON.stringify({status:'failed',error:'Saved action disappeared after reload',skipped:0}));
 fs.writeFileSync(path.join(source,'backend-outcome.json'),JSON.stringify({cause:'backend_identity_mismatch'}));
});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
test('large inventories no longer block review, while failures and complete original proof remain',()=>{
 const original=fs.readFileSync(receipt);expect(()=>curatedText(source,{omitRuntimeMetadata:true})).toThrow('role_input_limit');
 copyVerificationEvidence(source,target);
 const summary=JSON.parse(fs.readFileSync(path.join(target,path.relative(source,receipt))));
 expect(summary).toMatchObject({schema:'specflow.review-capsule-summary/v1',original:{sha256:sha(original),fileBytes:original.length},capsule:{entryCount:4000}});
 expect(fs.readFileSync(receipt).equals(original)).toBe(true);
 fenceInputTree(target);const prompt=curatedText(target,{omitRuntimeMetadata:true});
 expect(prompt).toContain('Saved action disappeared after reload');expect(prompt).toContain('backend_identity_mismatch');expect(prompt).toContain(sha(original));
});
test.each(['unknown-schema','unknown-field','wrong-count'])('unknown or inconsistent metadata remains visible and bounded: %s',kind=>{
 const value=JSON.parse(fs.readFileSync(receipt));if(kind==='unknown-schema')value.schema='different';if(kind==='unknown-field')value.finding='must not disappear';if(kind==='wrong-count')value.entryCount=0;
 fs.writeFileSync(receipt,JSON.stringify(value));copyVerificationEvidence(source,target);
 expect(fs.readFileSync(path.join(target,path.relative(source,receipt)),'utf8')).toBe(fs.readFileSync(receipt,'utf8'));
 expect(()=>curatedText(target,{omitRuntimeMetadata:true})).toThrow('role_input_limit');
});
test('oversized non-inventory findings still hit the unchanged bound',()=>{
 fs.writeFileSync(path.join(source,'native-report.json'),'Failure detail '.repeat(30000));copyVerificationEvidence(source,target);
 expect(()=>curatedText(target,{omitRuntimeMetadata:true})).toThrow('role_input_limit');
});
test('symlinked evidence cannot be copied into a summary',()=>{
 fs.symlinkSync(receipt,path.join(source,'linked.json'));expect(()=>copyVerificationEvidence(source,target)).toThrow('review_evidence_special');
});
