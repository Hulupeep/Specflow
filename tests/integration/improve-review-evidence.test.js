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
 const entries=Array.from({length:4000},(_,i)=>({path:'src/file-'+i,kind:'file',mode:420,size:225,sha256:'a'.repeat(64)}));
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
test.each(['unknown-schema','unknown-field','wrong-count','unknown-entry','wrong-bytes'])('unknown or inconsistent metadata remains visible and bounded: %s',kind=>{
 const value=JSON.parse(fs.readFileSync(receipt));if(kind==='unknown-schema')value.schema='different';if(kind==='unknown-field')value.finding='must not disappear';if(kind==='wrong-count')value.entryCount=0;if(kind==='unknown-entry')value.entries[0].finding='must remain';if(kind==='wrong-bytes')value.bytes++;
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

test.each([40,64])('backend binding workspace inventory shrinks with %s-character Git objects',width=>{
 const file=path.join(source,'binding-22222222-2222-2222-2222-222222222222.json');
 const entries=Array.from({length:4000},(_,i)=>({path:'src/'+i,kind:'file',sha256:'a'.repeat(64),token:['1','2','3','1','5','6']}));
 const value={schema:'specflow.improve.binding/v1',attempt:'22222222-2222-2222-2222-222222222222',identity:{run_id:'run',phase:'after',contract_version:1,contract_sha256:'b'.repeat(64),artifact_sha256:{},base_commit:'c'.repeat(width),verifier:'d'.repeat(64),git:{tree:'e'.repeat(width),parent:'c'.repeat(width),branch:'refs/heads/branch'},workspace:{sha256:sha(JSON.stringify(entries)),entries,bytes:4000,limits:{max_bytes:1000000,max_entries:10000}}},evidence:[{id:'failed-case',sha256:'a'.repeat(64)}]};
 fs.writeFileSync(file,JSON.stringify(value));const original=fs.readFileSync(file);
 copyVerificationEvidence(source,target);fenceInputTree(target);
 const prompt=curatedText(target,{omitRuntimeMetadata:true});expect(prompt).toContain('failed-case');expect(prompt).toContain(sha(original));expect(prompt).toContain('Saved action disappeared');expect(fs.readFileSync(file).equals(original)).toBe(true);
});

function boundImages(records) {
 const items=records.map(([name,set],n)=>{const dir=path.join(source,'runtime-evidence',name);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'frame.png'),'not-invoked-image-'+name);fs.writeFileSync(path.join(dir,'native-report.json'),JSON.stringify({error:'failure '+name}));const file=path.join(dir,'execution.json');fs.writeFileSync(file,'{}');const digest=sha('{}');return {id:'ev-'+n,phase:'baseline',contract_version:1,criterion:'AC-'+n,kind:'executable-check',producer_role:'verifier-mechanical',executor:'specflow-improve',set,result:'fail',evidence_path:file,evidence_sha256:digest,native_execution:{receipt_path:file,receipt_sha256:digest}};});
 const value={schema:'specflow.improve.binding/v1',attempt:'22222222-2222-2222-2222-222222222222',identity:{run_id:'run',phase:'baseline',contract_version:1,contract_sha256:'b'.repeat(64),artifact_sha256:{},base_commit:'c'.repeat(40),verifier:'d'.repeat(64),git:{tree:'e'.repeat(40),parent:'c'.repeat(40),branch:'refs/heads/test'},workspace:{sha256:sha('[]'),entries:[],bytes:0,limits:{max_bytes:1000,max_entries:1000}}},evidence:items.map(x=>({id:x.id,sha256:sha(JSON.stringify(x))}))};
 const file=path.join(source,'binding-22222222-2222-2222-2222-222222222222.json');const bytes=JSON.stringify(value);fs.writeFileSync(file,bytes);return {omitPracticeImages:true,phaseEvidence:items,phaseReceipt:{path:file,sha256:sha(bytes)}};
}
test('practice images require receipt-bound evidence; holdout overlap and all reports retained',()=>{
 const options=boundImages([['practice','dev'],['required','holdout'],['shared','dev'],['shared','holdout']]);copyVerificationEvidence(source,target,options);
 expect(fs.existsSync(path.join(target,'runtime-evidence/practice/frame.png'))).toBe(false);expect(fs.existsSync(path.join(target,'runtime-evidence/required/frame.png'))).toBe(true);expect(fs.existsSync(path.join(target,'runtime-evidence/shared/frame.png'))).toBe(true);
 expect(fs.readFileSync(path.join(target,'runtime-evidence/practice/native-report.json'),'utf8')).toContain('failure practice');expect(fs.readFileSync(path.join(target,'review-presentation.json'),'utf8')).toContain('practice/frame.png');expect(fs.existsSync(path.join(source,'runtime-evidence/practice/frame.png'))).toBe(true);
});
test.each(['item-set','item-path','receipt-bytes','native-bytes','extra-item','no-receipt'])('unbound or mutated image attribution never removes frames: %s',kind=>{
 const options=boundImages([['required','holdout'],['practice','dev']]);
 if(kind==='item-set')options.phaseEvidence[0].set='dev';if(kind==='item-path')options.phaseEvidence[1].evidence_path=options.phaseEvidence[0].evidence_path;if(kind==='receipt-bytes')fs.appendFileSync(options.phaseReceipt.path,' ');if(kind==='native-bytes')fs.appendFileSync(options.phaseEvidence[1].evidence_path,' ');if(kind==='extra-item')options.phaseEvidence.push({...options.phaseEvidence[0],id:'extra'});if(kind==='no-receipt')delete options.phaseReceipt;
 copyVerificationEvidence(source,target,options);for(const name of ['required','practice'])expect(fs.existsSync(path.join(target,'runtime-evidence',name,'frame.png'))).toBe(true);
});

test('backend service inventory is an array; summaries preserve measured state and counts',()=>{
 const metadata=Array.from({length:4000},(_,i)=>({id:String(i),role:'service-'+i,rawInspectionSha256:'f'.repeat(64),semantic:{image:'image',config:{label:'config'},host:{},mounts:[]}}));
 const value={schema:'specflow.backend-entry/v1',jobId:'job',phase:'after',generation:'33333333-3333-3333-3333-333333333333',expectedBackendIdentity:'a'.repeat(64),measuredBackendIdentity:'a'.repeat(64),inputManifestSha256:'b'.repeat(64),state:{migrationHistorySha256:'a'.repeat(64),schemaSha256:'a'.repeat(64),sequencesSha256:'a'.repeat(64),tablesSha256:'a'.repeat(64)},counts:{rows:1,migrations:0,sequences:0,tables:1},snapshotProtocol:'repeatable-read-read-only-exported-snapshot',schemaArtifact:{path:'schema.sql',sha256:'c'.repeat(64)},services:metadata,configuration:{gateway:{},services:metadata.map(x=>({role:x.role,...x.semantic}))},stageHashes:{file:'d'.repeat(64)}};
 fs.writeFileSync(receipt,JSON.stringify(value));const before=fs.readFileSync(receipt);copyVerificationEvidence(source,target);
 const v=JSON.parse(fs.readFileSync(path.join(target,path.relative(source,receipt))));expect(v.schema).toBe('specflow.review-backend-entry-summary/v1');expect(v.state.schemaSha256).toBe('a'.repeat(64));expect(v.services[0].semantic.config.label).toBe('config');expect(v.counts.rows).toBe(1);expect(v.presentation.original.sha256).toBe(sha(before));expect(fs.readFileSync(receipt).equals(before)).toBe(true);
});

test('duplicate receipt keys are preserved rather than selecting a convenient value',()=>{
 const original=fs.readFileSync(receipt,'utf8').replace('"schema":','"schema":"unexpected","schema":');fs.writeFileSync(receipt,original);copyVerificationEvidence(source,target);
 expect(fs.readFileSync(path.join(target,path.relative(source,receipt)),'utf8')).toBe(original);
});
test.each(['missing-holdout','outside-root','malformed'])('uncertain practice attribution retains all images: %s',kind=>{
 const dir=path.join(source,'runtime-evidence/attempt-1');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'frame.png'),'retained');
 for(const k of ['dev','holdout'])fs.mkdirSync(path.join(source,k),{recursive:true});
 const record={evidence_path:path.join(dir,'execution.json')};
 fs.writeFileSync(path.join(source,'dev/verifier-findings.jsonl'),kind==='malformed'?'bad-json':JSON.stringify(kind==='outside-root'?{evidence_path:'/outside/execution.json'}:record));
 if(kind!=='missing-holdout')fs.writeFileSync(path.join(source,'holdout/verifier-findings.jsonl'),'');
 copyVerificationEvidence(source,target,{omitPracticeImages:true});expect(fs.existsSync(path.join(target,'runtime-evidence/attempt-1/frame.png'))).toBe(true);
});
test('oversized required text names the artifact and forbids acceptance replay',()=>{
 fs.writeFileSync(path.join(source,'required-failure.txt'),'important failure '.repeat(30000));
 expect(()=>curatedText(source,{files:['required-failure.txt']})).toThrow(expect.objectContaining({code:'role_input_limit',observed:expect.stringContaining('required-failure.txt'),next_action:expect.stringContaining('never truncate required reports')}));
});

test.each(['token-length','token-text','bytes','digest','unknown-entry','unknown-workspace'])('mutated binding inventory remains complete: %s',kind=>{
 const entries=[{path:'src/a',kind:'file',token:['1','2','3','1','5','6'],sha256:'a'.repeat(64)}];
 const w={sha256:sha(JSON.stringify(entries)),entries,bytes:1,limits:{max_bytes:100,max_entries:10}};
 if(kind==='token-length')entries[0].token=['1'];if(kind==='token-text')entries[0].token[3]='failure must remain';if(kind==='bytes')w.bytes=2;if(kind==='digest')w.sha256='b'.repeat(64);if(kind==='unknown-entry')entries[0].finding='must remain';if(kind==='unknown-workspace')w.finding='must remain';
 const value={schema:'specflow.improve.binding/v1',attempt:'22222222-2222-2222-2222-222222222222',identity:{run_id:'run',phase:'after',contract_version:1,contract_sha256:'b'.repeat(64),artifact_sha256:{},base_commit:'c'.repeat(40),verifier:'d'.repeat(64),git:{tree:'e'.repeat(40),parent:'c'.repeat(40),branch:'refs/heads/test'},workspace:w},evidence:[]};
 const f=path.join(source,'binding-22222222-2222-2222-2222-222222222222.json'),before=JSON.stringify(value);fs.writeFileSync(f,before);copyVerificationEvidence(source,target);expect(fs.readFileSync(path.join(target,path.basename(f)),'utf8')).toBe(before);
});
test.each(['managed-pair','duplicate-mismatch','unknown-service','invalid-stage-digest','unknown-config'])('inconsistent backend metadata remains complete: %s',kind=>{
 const services=[{id:'service',role:'db',rawInspectionSha256:'a'.repeat(64),semantic:{image:'image',config:{error:'preserve'},host:{},mounts:[]}}];
 const v={schema:'specflow.backend-entry/v1',jobId:'job',phase:'after',generation:'33333333-3333-3333-3333-333333333333',expectedBackendIdentity:'a'.repeat(64),measuredBackendIdentity:'a'.repeat(64),inputManifestSha256:'b'.repeat(64),state:{migrationHistorySha256:'a'.repeat(64),schemaSha256:'a'.repeat(64),sequencesSha256:'a'.repeat(64),tablesSha256:'a'.repeat(64)},counts:{rows:1,migrations:0,sequences:0,tables:1},snapshotProtocol:'repeatable-read-read-only-exported-snapshot',schemaArtifact:{path:'schema.sql',sha256:'c'.repeat(64)},services,configuration:{gateway:{},services:services.map(x=>({role:x.role,...JSON.parse(JSON.stringify(x.semantic))}))},stageHashes:{file:'d'.repeat(64)}};
 if(kind==='managed-pair')v.attemptSha256='a'.repeat(64);if(kind==='duplicate-mismatch')v.configuration.services[0].config.error='different';if(kind==='unknown-service')v.services[0].finding='do not omit';if(kind==='invalid-stage-digest')v.stageHashes.file='failure';if(kind==='unknown-config')v.configuration.finding='do not omit';
 const before=JSON.stringify(v);fs.writeFileSync(receipt,before);copyVerificationEvidence(source,target);expect(fs.readFileSync(path.join(target,path.relative(source,receipt)),'utf8')).toBe(before);
});

test.each(['attempt','evidence','artifact-map','git','version','phase','backend'])('malformed outer binding envelope remains raw: %s',kind=>{
 const options=boundImages([]),file=options.phaseReceipt.path,value=JSON.parse(fs.readFileSync(file));
 if(kind==='attempt')value.attempt='not-an-attempt';if(kind==='evidence')value.evidence=[{id:'ev',sha256:'invalid'}];if(kind==='artifact-map')value.identity.artifact_sha256={'holdout/check':'invalid'};if(kind==='git')value.identity.git.tree='invalid';if(kind==='version')value.identity.contract_version=-1;if(kind==='phase')value.identity.phase='unknown';if(kind==='backend')value.backend='invalid';
 const bytes=JSON.stringify(value);fs.writeFileSync(file,bytes);copyVerificationEvidence(source,target);expect(fs.readFileSync(path.join(target,path.basename(file)),'utf8')).toBe(bytes);
});

test.each(['mixed-format','short-hash','non-hex'])('malformed Git identity remains raw: %s',kind=>{
 const options=boundImages([['required','holdout']]),file=options.phaseReceipt.path,value=JSON.parse(fs.readFileSync(file));
 if(kind==='mixed-format')value.identity.git.tree='a'.repeat(64);
 if(kind==='short-hash')value.identity.git.parent='a'.repeat(39);
 if(kind==='non-hex')value.identity.base_commit='z'.repeat(40);
 fs.writeFileSync(file,JSON.stringify(value));copyVerificationEvidence(source,target);
 expect(fs.readFileSync(path.join(target,path.basename(file)),'utf8')).toBe(fs.readFileSync(file,'utf8'));
});
