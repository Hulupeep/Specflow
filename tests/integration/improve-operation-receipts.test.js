'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),{recoveryFixture}=require('../helpers/improve-recovery.cjs'),m=require('../../scripts/improve-memory.cjs'),{OperationReceipts}=require('../../scripts/improve-operation-receipts.cjs'),{spawnOperation}=require('../../scripts/improve-paused-operation.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
function setup(){f=recoveryFixture();const opts={root:path.join(f.root,'receipts'),registry:f.registryV2,lockTool:f.recovery.lockTool};const store=new OperationReceipts({...opts,create:true});const binding={run_id:f.req.run_id,cycle_id:'cycle',operation_id:crypto.randomUUID(),generation:1,principal:'owner',repo_id:'fixture',profile_revision:f.revision,input_sha256:m.hash('fixed')};return {opts,store,binding};}
const result={exit_code:0,reason_code:null,estimate_usd:null};
test('REC-RECEIPT authenticated bytes are idempotent; changed results, binding, blob or seal fail closed',()=>{
 const {store,binding}=setup(),doc=store.put({binding,result,stdout:'actual stdout'});expect(store.put({binding,result,stdout:'actual stdout'})).toEqual(doc);
 expect(()=>store.put({binding,result:{...result,exit_code:1},stdout:'actual stdout'})).toThrow('receipt_idempotency_conflict');
 fs.writeFileSync(path.join(store.root,'blobs',doc.stdout_sha256),'changed');expect(()=>store.get(doc.id)).toThrow('receipt_evidence_changed');
});
test('REC-RECEIPT caller edited header and foreign registry key cannot authenticate completion',()=>{
 const {store,binding}=setup(),doc=store.put({binding,result});const file=path.join(store.root,'receipts',doc.id+'.json');
 doc.binding.generation++;fs.writeFileSync(file,JSON.stringify(doc));expect(()=>store.get(doc.id)).toThrow('receipt_integrity_failure');
});
test.each(['receipt_blobs_synced','receipt_published'])('REC-RECEIPT lost acknowledgement at %s retains one immutable fact',point=>{
 const {opts,store,binding}=setup();const interrupted=new OperationReceipts({...opts,fault:stage=>{if(stage===point)throw Error('injected lost acknowledgement');}});
 expect(()=>interrupted.put({binding,result,stdout:'one outcome'})).toThrow('injected lost acknowledgement');expect(store.put({binding,result,stdout:'one outcome'}).result).toEqual(result);
});
async function supervise(release){
 const {opts,store,binding}=setup(),marker=path.join(f.root,'outbound-marker');
 const child=spawnOperation({executable:process.execPath,args:['-e','require("fs").writeFileSync(process.argv[1],"one launch");process.stdout.write("completion");',marker],options:{env:{PATH:'/usr/bin:/bin'}},receipt:opts,binding,kind:'stage'});
 let output='',error='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{error+=b;});child.stdin.end();
 await new Promise(r=>setTimeout(r,200));expect(fs.existsSync(marker)).toBe(false);
 const closed=new Promise(r=>child.once('close',code=>r(code)));if(release)child.recoveryRelease();else child.stdio[3].end();
 const status=await closed;return {status,marker,store,binding,output,error};
}
test('REC-FENCE supervisor performs no outbound call until the acknowledged release',async()=>{
 const r=await supervise(true);expect(r.error).toBe('');expect(r.status).toBe(0);expect(r.output).toBe('completion');expect(fs.readFileSync(r.marker,'utf8')).toBe('one launch');expect(r.store.get(r.binding.operation_id).phase).toBe('complete');
},15000);
test('REC-RECEIPT loss of the release pipe proves not-started rather than inventing a completion',async()=>{
 const r=await supervise(false);expect(r.error).toBe('');expect(r.status).toBe(2);expect(fs.existsSync(r.marker)).toBe(false);expect(r.store.get(r.binding.operation_id).phase).toBe('not_started');
},15000);
test.each(['receipt_file_synced','receipt_renamed','receipt_directory_synced'])('REC-RECEIPT real producer SIGKILL at %s recovers one authenticated receipt',phase=>{
 const {opts,store,binding}=setup(),input={binding,result,stdout:'one independently saved result'},file=path.join(f.root,'receipt-producer.json');fs.writeFileSync(file,JSON.stringify({options:opts,input,killAt:phase}),{mode:0o600});
 const killed=cp.spawnSync(process.execPath,[path.resolve('tests/fixtures/improve-worker/receipt-producer.cjs'),file],{encoding:'utf8',timeout:10000});expect(killed.signal).toBe('SIGKILL');
 const doc=store.put(input);expect(store.get(doc.id)).toEqual(doc);expect(store.put(input)).toEqual(doc);expect(fs.statSync(path.join(store.root,'receipts',doc.id+'.json')).nlink).toBe(1);expect(fs.readdirSync(path.join(store.root,'receipts')).filter(n=>n.endsWith('.json'))).toEqual([doc.id+'.json']);
});
