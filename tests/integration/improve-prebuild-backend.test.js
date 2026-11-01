'use strict';
// Real process identity and authenticated attempt storage; no Docker/network or fake cleanup success.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {DurableStore}=require('../../scripts/improve-worker.cjs'),attempts=require('../../scripts/improve-backend-attempt.cjs');
let root;afterEach(()=>{if(root)fs.rmSync(root,{recursive:true,force:true});root=null;});
function fixture({finish=true,loser=false,releaseCut=false,terminalCut=false}={}){
 root=fs.mkdtempSync(path.join(os.tmpdir(),'sf-prebuild-closed-'));fs.chmodSync(root,0o700);
 const store=new DurableStore({root:path.join(root,'store'),sourceRoot:root});
 const program=`const w=require(${JSON.stringify(require.resolve('../../scripts/improve-worker.cjs'))}),a=require(${JSON.stringify(require.resolve('../../scripts/improve-backend-attempt.cjs'))});const s=new w.DurableStore({root:process.argv[1],sourceRoot:process.argv[2]});const r=a.begin(s,{jobId:'closed-job',runId:'closed-run',phase:'baseline',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+10000});if(${loser}){try{a.begin(s,{jobId:'closed-job',runId:'closed-run',phase:'baseline',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+10000});}catch(e){if(e.message!=='backend_attempt_active')throw e;}}if(${terminalCut}){const fs=require('fs'),open=fs.openSync;fs.openSync=function(p,...args){if(String(p).includes('/release-')){console.log(JSON.stringify(r));process.exit(0);}return open(p,...args);};}if(${releaseCut}){const fs=require('fs'),unlink=fs.unlinkSync;fs.unlinkSync=function(p){if(String(p).includes('/active-')){console.log(JSON.stringify(r));process.exit(0);}return unlink(p);};}if(${finish}){a.envelope(s,r);a.seal(s,r);a.finish(s,r,{cause:'backend_qualification_failed',backendTerminalSha256:null,productReceiptSha256:null});}console.log(JSON.stringify(r));`;
 const ref=JSON.parse(cp.execFileSync(process.execPath,['-e',program,store.root,root],{encoding:'utf8',timeout:15000}));return{store,ref};
}
test('PREBUILD authentic completed empty resource history from a now-dead process verifies as cleanup only',()=>{
 const {store,ref}=fixture();const result=attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));expect(result).toHaveLength(1);expect(result[0].attempt).toEqual(ref);
});
test.each(['active','wrong_contract','wrong_run','tampered_terminal','operator_fence'])('PREBUILD backend refuses %s',kind=>{
 const {store,ref}=fixture({finish:kind!=='active'});
 if(kind==='tampered_terminal'){const p=path.join(store.root,'backend-attempts',`terminal-${ref.attemptId}.json`),x=JSON.parse(fs.readFileSync(p));x.value.credentialEnvelopeRemoved=false;fs.writeFileSync(p,JSON.stringify(x));}
 if(kind==='operator_fence')fs.writeFileSync(path.join(store.root,'backend-attempts',`operator-${ref.attemptId}.json`),'retained fence',{mode:0o600});
 expect(()=>attempts.verifyClosedHistory(store,kind==='wrong_run'?'different-run':'closed-run',kind==='wrong_contract'?'d'.repeat(64):'a'.repeat(64))).toThrow();
});

test('PREBUILD retains a losing inert attempt without permanently locking a cleaned run',()=>{
 const {store}=fixture({loser:true});const proof=attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));
 expect(proof).toHaveLength(2);expect(proof.filter(p=>p.disposition==='never_claimed')).toHaveLength(1);
});
test('PREBUILD signed release before active unlink proves cleanup without deleting its historical claim',()=>{
 const {store,ref}=fixture({releaseCut:true});const before=fs.readdirSync(path.join(store.root,'backend-attempts')).sort();
 const proof=attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));expect(proof[0].attempt).toEqual(ref);
 expect(fs.readdirSync(path.join(store.root,'backend-attempts')).sort()).toEqual(before);
 expect(before.some(n=>n.startsWith('active-'))).toBe(true);
});

test('PREBUILD a terminal without its signed release retains ownership with a named reason',()=>{
 const {store}=fixture({terminalCut:true});
 expect(()=>attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64))).toThrow('backend_release_incomplete');
});
test('PREBUILD a losing attempt with an unexplained mutation fence is not called inert',()=>{
 const {store,ref}=fixture({loser:true}),area=path.join(store.root,'backend-attempts');
 const name=fs.readdirSync(area).find(n=>n.startsWith('attempt-')&&!n.includes(ref.attemptId));
 fs.mkdirSync(path.join(area,'mutation-'+name.slice(8,-5)),{mode:0o700});
 expect(()=>attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64))).toThrow('backend_attempt_inert_unproven');
});

test('PREBUILD authenticated foreign-run schema is not treated as this run history',()=>{
 const {store}=fixture(),name='attempt-11111111-1111-4111-8111-111111111111.json',value={runId:'foreign-run',schema:'other-version'};
 fs.writeFileSync(path.join(store.root,'backend-attempts',name),JSON.stringify({value,mac:store.mac(value)}),{mode:0o600});
 expect(attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64))).toHaveLength(1);
});
test('PREBUILD unauthenticated record is named rather than silently assigned to another run',()=>{
 const {store}=fixture(),name='attempt-11111111-1111-4111-8111-111111111111111.json';
 fs.writeFileSync(path.join(store.root,'backend-attempts',name),'corrupt',{mode:0o600});
 try{attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));throw Error('expected refusal');}catch(e){expect(e.message).toBe('backend_attempt_record_unreadable');expect(e.record).toBe(name);}
});


test('PREBUILD cleanup for a different attempt cannot satisfy the ledger reference',()=>{
 const {store,ref}=fixture();
 expect(()=>attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64),[{...ref,attemptSha256:'e'.repeat(64)}])).toThrow('backend_attempt_proof_missing');
 expect(attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64),[ref])).toHaveLength(1);
});
test.each(['terminal','resource','active'])('PREBUILD orphan %s record is retained and named',kind=>{
 const {store,ref}=fixture({releaseCut:kind==='active'}),area=path.join(store.root,'backend-attempts');
 fs.unlinkSync(path.join(area,`attempt-${ref.attemptId}.json`));
 if(kind==='resource')fs.writeFileSync(path.join(area,`resource-${ref.attemptId}-unresolved.json`),'unresolved',{mode:0o600});
 const before=fs.readdirSync(area).sort();
 try{attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));throw Error('expected refusal');}catch(e){expect(e.message).toBe('backend_attempt_record_orphan');expect(before).toContain(e.record);}
 expect(fs.readdirSync(area).sort()).toEqual(before);
});
test('PREBUILD empty backend history identifies an attempt that was never admitted',()=>{
 const {store}=fixture();
 expect(()=>attempts.verifyClosedHistory(store,'unadmitted-run','a'.repeat(64))).toThrow('backend_attempt_not_admitted');
});


test.each(['unexpected-entry','attempt-malformed.json'])('PREBUILD unknown record %s is named and retained',name=>{
 const {store}=fixture(),area=path.join(store.root,'backend-attempts');fs.writeFileSync(path.join(area,name),'unknown',{mode:0o600});
 try{attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));throw Error('expected refusal');}catch(e){expect(e.message).toBe('backend_attempt_record_unreadable');expect(e.record).toBe(name);}
 expect(fs.existsSync(path.join(area,name))).toBe(true);
});


test('PREBUILD invalid authenticated attempt schema names its record',()=>{
 const {store,ref}=fixture(),name=`attempt-${ref.attemptId}.json`,file=path.join(store.root,'backend-attempts',name),signed=JSON.parse(fs.readFileSync(file));
 signed.value.schema='invalid';signed.mac=store.mac(signed.value);fs.writeFileSync(file,JSON.stringify(signed));
 try{attempts.verifyClosedHistory(store,'closed-run','a'.repeat(64));throw Error('expected refusal');}catch(e){expect(e.message).toBe('backend_attempt_record_unreadable');expect(e.record).toBe(name);}
});
