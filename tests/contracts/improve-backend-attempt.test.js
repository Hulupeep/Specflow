const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {DurableStore}=require('../../scripts/improve-worker.cjs');
const attempts=require('../../scripts/improve-backend-attempt.cjs');
const {validPhase}=require('../../scripts/improve-backend-phase.cjs');
const identity=require('../../scripts/improve-process-identity.cjs');
const input=()=>({jobId:'job',runId:'run',phase:'baseline',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+60000});
function fixture(){const root=fs.mkdtempSync(path.join(os.tmpdir(),'backend-attempt-'));return {root,store:new DurableStore({root,sourceRoot:root}),close:()=>fs.rmSync(root,{recursive:true,force:true})};}
function childBegin(root){return new Promise((resolve,reject)=>{const child=cp.spawn(process.execPath,['-e',`const {DurableStore}=require('./scripts/improve-worker.cjs'),a=require('./scripts/improve-backend-attempt.cjs');try{a.begin(new DurableStore({root:process.argv[1],sourceRoot:process.argv[1]}),JSON.parse(process.argv[2]));console.log('reserved')}catch(e){console.log(e.message);process.exitCode=1}`,root,JSON.stringify(input())],{cwd:path.resolve(__dirname,'../..'),stdio:['ignore','pipe','pipe']});let out='',err='';child.stdout.on('data',b=>out+=b);child.stderr.on('data',b=>err+=b);child.on('error',reject);child.on('close',code=>resolve({code,out:out.trim(),err}));});}
const intent=()=>({slot:'build',expectedConfigSha256:'d'.repeat(64),creator:identity.identity(),supervisor:identity.identity()});
describe('managed attempt fencing (#293)',()=>{
 test.each(['baseline','after','dev-r1','dev-r9007199254740991'])('canonical phase %s',p=>expect(validPhase(p)).toBe(true));
 test.each(['dev-r0','dev-r01','dev-r1\n','dev-r1e3','dev-r9007199254740992',null,1])('reject phase %s',p=>expect(validPhase(p)).toBe(false));
 test('separate processes compete for one durable claim; process exit never unlocks it',async()=>{const f=fixture();try{const results=await Promise.all([childBegin(f.root),childBegin(f.root)]);expect(results.map(r=>r.out).sort()).toEqual(['backend_attempt_active','reserved']);expect(results.map(r=>r.code).sort()).toEqual([0,1]);expect(results.every(r=>r.err==='')).toBe(true);expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');}finally{f.close();}});
 test('signed attempt survives reopen; altered caller reference fails',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input());expect(attempts.read(new DurableStore({root:f.root,sourceRoot:f.root}),ref).attemptId).toBe(ref.attemptId);expect(()=>attempts.read(f.store,{...ref,runId:'other'})).toThrow();}finally{f.close();}});
 test('one intent per slot, signed durable correspondence and no retry replacement',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),result=attempts.intent(f.store,ref,intent());expect(attempts.intents(f.store,ref)).toHaveLength(1);expect(attempts.intents(f.store,ref)[0].sha256).toBe(result.sha256);expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_resource_intent_exists');}finally{f.close();}});
 test('operator event is idempotent and fences creation without releasing reservation',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),event=attempts.operatorRequired(f.store,ref);expect(attempts.operatorRequired(f.store,ref)).toEqual(event);expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_cleanup_unconfirmed');expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');}finally{f.close();}});
 test('dangling operator marker remains a fence',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input());fs.symlinkSync('/missing/backend-marker',path.join(f.root,'backend-attempts','operator-'+ref.attemptId+'.json'));expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_cleanup_unconfirmed');}finally{f.close();}});
 test('truncated active marker is not repaired by a successor',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),dir=path.join(f.root,'backend-attempts'),file=path.join(dir,fs.readdirSync(dir).find(n=>n.startsWith('active-')));fs.writeFileSync(file,'{');expect(()=>attempts.read(f.store,ref)).toThrow();expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');expect(fs.readFileSync(file,'utf8')).toBe('{');}finally{f.close();}});
 test('unsigned mutation and symlink reads cannot admit an attempt',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),file=path.join(f.root,'backend-attempts','attempt-'+ref.attemptId+'.json'),raw=fs.readFileSync(file,'utf8'),r=JSON.parse(raw);r.value.phase='after';fs.writeFileSync(file,JSON.stringify(r));expect(()=>attempts.read(f.store,ref)).toThrow();fs.writeFileSync(file,raw);fs.renameSync(file,file+'.original');fs.symlinkSync(file+'.original',file);expect(()=>attempts.read(f.store,ref)).toThrow();}finally{f.close();}});
 test('expired attempt cannot create; unavailable supervisor cannot register',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input());expect(()=>attempts.intent(f.store,ref,{...intent(),supervisor:{...identity.identity(),boot_id:'foreign'}})).toThrow('backend_attempt_owner_unavailable');const clock=jest.spyOn(Date,'now').mockReturnValue(input().deadlineAtMs+1);try{expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_lease_expired');}finally{clock.mockRestore();}}finally{f.close();}});
 test('plain store objects cannot create private authority',()=>expect(()=>attempts.begin({root:'/tmp'},input())).toThrow('backend_attempt_authority'));
});

describe('attempt seal closes resource admission without claiming cleanup',()=>{
 test('seal survives reopen and rejects new intent without releasing the job',()=>{const f=fixture();try{
  const ref=attempts.begin(f.store,input()), sealed=attempts.seal(f.store,ref);
  expect(attempts.seal(new DurableStore({root:f.root,sourceRoot:f.root}),ref)).toEqual(sealed);
  expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_attempt_sealed');
  expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
 test('intent recorded before seal cannot dispatch, but supervisor can certify not dispatched',()=>{const f=fixture();try{
  const ref=attempts.begin(f.store,input());attempts.intent(f.store,ref,intent());attempts.seal(f.store,ref);
  expect(()=>attempts.resourceEvent(f.store,ref,'build',{state:'dispatching',id:null,inspectionSha256:null})).toThrow('backend_attempt_sealed');
  attempts.resourceEvent(f.store,ref,'build',{state:'not_dispatched',id:null,inspectionSha256:null});
  expect(attempts.resourceEvents(f.store,ref,'build').map(e=>e.state)).toEqual(['not_dispatched']);
 }finally{f.close();}});
 test('in-flight dispatched resource can report creation and exact removal after seal',()=>{const f=fixture();try{
  const ref=attempts.begin(f.store,input());attempts.intent(f.store,ref,intent());
  attempts.resourceEvent(f.store,ref,'build',{state:'dispatching',id:null,inspectionSha256:null});attempts.seal(f.store,ref);
  const object={id:'e'.repeat(64),inspectionSha256:'f'.repeat(64)};
  attempts.resourceEvent(f.store,ref,'build',{state:'created',...object});
  expect(()=>attempts.resourceEvent(f.store,ref,'build',{state:'started',...object})).toThrow('backend_attempt_sealed');
  attempts.resourceEvent(f.store,ref,'build',{state:'removed',...object});
  expect(attempts.resourceEvents(f.store,ref,'build').map(e=>e.state)).toEqual(['dispatching','created','removed']);
  expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
 test('interrupted mutation fences sealing and admission; no timeout lock stealing',()=>{const f=fixture();try{
  const ref=attempts.begin(f.store,input());fs.mkdirSync(path.join(f.root,'backend-attempts','mutation-'+ref.attemptId),{mode:0o700});
  expect(()=>attempts.seal(f.store,ref)).toThrow('backend_attempt_mutation_busy');
  expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_attempt_mutation_busy');
  expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
 test('corrupt seal remains a fence and cannot be regenerated',()=>{const f=fixture();try{
  const ref=attempts.begin(f.store,input());attempts.seal(f.store,ref);
  fs.writeFileSync(path.join(f.root,'backend-attempts','sealed-'+ref.attemptId+'.json'),'{');
  expect(()=>attempts.seal(f.store,ref)).toThrow();
  expect(()=>attempts.intent(f.store,ref,intent())).toThrow('backend_attempt_sealed');
 }finally{f.close();}});
});

describe('complete attempt terminal and exact release',()=>{
 const failure={cause:'backend_worker_failed',backendTerminalSha256:null,productReceiptSha256:null};
 function prepared(f){const ref=attempts.begin(f.store,input()),dir=attempts.envelope(f.store,ref);fs.writeFileSync(path.join(dir,'private.env'),'disposable-test-fixture',{mode:0o600});return {ref,dir};}
 test('deletes the owned envelope before durable failure terminal and permits a successor',()=>{const f=fixture();try{
  const {ref,dir}=prepared(f);attempts.seal(f.store,ref);const t=attempts.finish(f.store,ref,failure);
  expect(t.cause).toBe(failure.cause);expect(t.credentialEnvelopeRemoved).toBe(true);expect(fs.existsSync(dir)).toBe(false);
  expect(attempts.terminal(new DurableStore({root:f.root,sourceRoot:f.root}),ref)).toEqual(t);
  const next=attempts.begin(f.store,input());expect(next.attemptId).not.toBe(ref.attemptId);
  expect(()=>attempts.finish(f.store,ref,failure)).toThrow('backend_attempt_not_active');
  expect(attempts.read(f.store,next).attemptId).toBe(next.attemptId);
 }finally{f.close();}});
 test('accounts for removed and undispatched resources, preserving original failure',()=>{const f=fixture();try{
  const {ref}=prepared(f);attempts.intent(f.store,ref,intent());
  attempts.resourceEvent(f.store,ref,'build',{state:'not_dispatched',id:null,inspectionSha256:null});
  attempts.intent(f.store,ref,{...intent(),slot:'app'});
  attempts.resourceEvent(f.store,ref,'app',{state:'dispatching',id:null,inspectionSha256:null});
  const obj={id:'e'.repeat(64),inspectionSha256:'f'.repeat(64)};
  attempts.resourceEvent(f.store,ref,'app',{state:'created',...obj});attempts.resourceEvent(f.store,ref,'app',{state:'removed',...obj});
  attempts.seal(f.store,ref);const t=attempts.finish(f.store,ref,failure);
  expect(t.resources.map(r=>[r.slot,r.status])).toEqual([['build','absent'],['app','removed']]);
 }finally{f.close();}});
 test.each(['intent','dispatching','created','unconfirmed','foreign'])('never releases %s resource',state=>{const f=fixture();try{
  const {ref,dir}=prepared(f);attempts.intent(f.store,ref,intent());
  if(['dispatching','created'].includes(state))attempts.resourceEvent(f.store,ref,'build',{state:'dispatching',id:null,inspectionSha256:null});
  if(state==='created')attempts.resourceEvent(f.store,ref,'build',{state:'created',id:'e'.repeat(64),inspectionSha256:'f'.repeat(64)});
  if(['unconfirmed','foreign'].includes(state))attempts.resourceEvent(f.store,ref,'build',{state,id:null,inspectionSha256:null});
  attempts.seal(f.store,ref);expect(()=>attempts.finish(f.store,ref,failure)).toThrow('backend_cleanup_unconfirmed');
  expect(fs.existsSync(dir)).toBe(true);expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
 test('operator-required marker prevents automatic release even with no resources',()=>{const f=fixture();try{
  const {ref}=prepared(f);attempts.seal(f.store,ref);attempts.operatorRequired(f.store,ref);
  expect(()=>attempts.finish(f.store,ref,failure)).toThrow('backend_cleanup_unconfirmed');
  expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
 test('envelope symlink cannot cause deletion outside the owned directory',()=>{const f=fixture();try{
  const {ref,dir}=prepared(f),outside=path.join(f.root,'retain');fs.writeFileSync(outside,'retain',{mode:0o600});fs.symlinkSync(outside,path.join(dir,'link'));
  attempts.seal(f.store,ref);expect(()=>attempts.finish(f.store,ref,failure)).toThrow('backend_cleanup_unconfirmed');
  expect(fs.readFileSync(outside,'utf8')).toBe('retain');expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
 test('replaced envelope inode is refused and retained',()=>{const f=fixture();try{
  const {ref,dir}=prepared(f);fs.renameSync(dir,dir+'-original');fs.mkdirSync(dir,{mode:0o700});
  attempts.seal(f.store,ref);expect(()=>attempts.finish(f.store,ref,failure)).toThrow('backend_cleanup_unconfirmed');
  expect(fs.existsSync(dir)).toBe(true);expect(fs.existsSync(dir+'-original')).toBe(true);
 }finally{f.close();}});
 test('no caller cleaned flag or absent envelope can establish cleanup',()=>{const f=fixture();try{
  const ref=attempts.begin(f.store,input());attempts.seal(f.store,ref);
  expect(()=>attempts.finish(f.store,ref,{...failure,credentialEnvelopeRemoved:true})).toThrow();
  expect(()=>attempts.finish(f.store,ref,failure)).toThrow();expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');
 }finally{f.close();}});
});

describe('owned runtime envelope and interrupted finalization',()=>{
 const failure={cause:'backend_worker_failed',backendTerminalSha256:null,productReceiptSha256:null};
 test('existing envelope is reused only after signed inode validation',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),dir=attempts.envelope(f.store,ref);expect(attempts.envelope(f.store,ref)).toBe(dir);fs.renameSync(dir,dir+'-old');fs.mkdirSync(dir,{mode:0o700});expect(()=>attempts.envelope(f.store,ref)).toThrow('backend_cleanup_unconfirmed');}finally{f.close();}});
 test('recursive private stage is removed including readonly container inputs',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),dir=attempts.envelope(f.store,ref);fs.mkdirSync(path.join(dir,'stage'),{mode:0o700});fs.mkdirSync(path.join(dir,'stage','migrations'),{mode:0o755});fs.writeFileSync(path.join(dir,'stage','migrations','fixture.sql'),'-- fixture',{mode:0o444});fs.writeFileSync(path.join(dir,'stage','auth.env'),'fixture-only',{mode:0o600});attempts.seal(f.store,ref);expect(attempts.finish(f.store,ref,failure).credentialEnvelopeRemoved).toBe(true);expect(fs.existsSync(dir)).toBe(false);}finally{f.close();}});
 test('nested symlink blocks all deletion and records an explicit operator state',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),dir=attempts.envelope(f.store,ref);fs.mkdirSync(path.join(dir,'nested'),{mode:0o700});fs.writeFileSync(path.join(dir,'keep'),'fixture',{mode:0o600});fs.symlinkSync(f.root,path.join(dir,'nested','outside'));attempts.seal(f.store,ref);expect(()=>attempts.finish(f.store,ref,failure)).toThrow('backend_cleanup_unconfirmed');expect(fs.readFileSync(path.join(dir,'keep'),'utf8')).toBe('fixture');const marker=JSON.parse(fs.readFileSync(path.join(f.root,'backend-attempts','operator-'+ref.attemptId+'.json')));expect(marker.value.state).toBe('operator_required');}finally{f.close();}});
 test('missing envelope after an interruption is named and never auto-released',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input()),dir=attempts.envelope(f.store,ref);attempts.seal(f.store,ref);fs.rmdirSync(dir);expect(()=>attempts.finish(f.store,ref,failure)).toThrow();expect(fs.existsSync(path.join(f.root,'backend-attempts','operator-'+ref.attemptId+'.json'))).toBe(true);expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');}finally{f.close();}});
 test('stopped owner with interrupted mutation gets a named operator condition without unlock',async()=>{const f=fixture();try{expect((await childBegin(f.root)).code).toBe(0);const result=attempts.reconcileStopped(f.store,'job');expect(result.state).toBe('operator_required');expect(result.ownerState).toBe('dead');expect(()=>attempts.begin(f.store,input())).toThrow('backend_attempt_active');}finally{f.close();}});
 test('reconciliation does not stop a live owner',()=>{const f=fixture();try{const ref=attempts.begin(f.store,input());expect(attempts.reconcileStopped(f.store,'job')).toEqual({state:'active',attempt:ref});expect(fs.existsSync(path.join(f.root,'backend-attempts','operator-'+ref.attemptId+'.json'))).toBe(false);}finally{f.close();}});
});
