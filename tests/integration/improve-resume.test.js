'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),k=require('../../scripts/improve-kernel-lock.cjs');
let root;beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'recovery-v2-test-'));fs.chmodSync(root,0o700);});afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
const tool=()=>({path:'/usr/bin/flock',sha256:crypto.createHash('sha256').update(fs.readFileSync('/usr/bin/flock')).digest('hex'),version:cp.execFileSync('/usr/bin/flock',['--version'],{encoding:'utf8'}).trim()});
async function killAt(stage,{authority=false}={}){
 const dir=path.join(root,'state');fs.mkdirSync(dir,{mode:0o700});const t=tool(),file=path.join(root,'holder.json');fs.writeFileSync(file,JSON.stringify({root:dir,tool:t,stage,authority}),{mode:0o600});
 const child=cp.spawn(process.execPath,[path.resolve('tests/fixtures/improve-worker/kernel-holder.cjs'),file],{stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',b=>{error+=b;});
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',b=>b.toString().trim()===stage?resolve():reject(Error('Unexpected checkpoint')));child.once('error',reject);child.once('exit',(code,signal)=>reject(Error('Early holder exit '+code+' '+signal+' '+error)));});
  const lock=authority?path.join(dir,'.authority-lock','kernel-v2.lock'):path.join(dir,'writer.lock'),ino=fs.existsSync(lock)?fs.statSync(lock).ino:null;
  const exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));child.kill('SIGKILL');expect((await exit).signal).toBe('SIGKILL');return {dir,t,lock,ino};
 }finally{if(child.exitCode===null&&child.signalCode===null){const end=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await end;}}
}
test.each([false,true])('REC-LOCK real SIGKILL releases v2 kernel authority=%s without inode deletion',async authority=>{
 const {t,lock,ino}=await killAt('kernel_acquired',{authority});expect(k.withLock(lock,t,()=>true)).toBe(true);expect(fs.statSync(lock).ino).toBe(ino);
},15000);
test.each(['kernel_candidate_synced','kernel_linked'])('REC-LOCK real SIGKILL at %s preserves committed lock identity and recovers an owned candidate alias',async stage=>{
 const {t,lock,ino}=await killAt(stage);k.prepare(lock,t);expect(k.withLock(lock,t,()=>true)).toBe(true);if(ino!==null)expect(fs.statSync(lock).ino).toBe(ino);expect(fs.statSync(lock).nlink).toBe(1);
},15000);
test('REC-LOCK incomplete authority initialization is specific and never adopted as a blank registry',async()=>{
 const {dir,t}=await killAt('kernel_authority_directory_created',{authority:true}),inode=fs.statSync(path.join(dir,'.authority-lock')).ino;
 expect(()=>k.prepareAuthority(dir,t)).toThrow('recovery_initialization_incomplete');expect(fs.readdirSync(path.join(dir,'.authority-lock'))).toEqual([]);
 const file=k.completeAuthorityInitialization(dir,t);expect(k.withLock(file,t,()=>true)).toBe(true);expect(fs.statSync(path.join(dir,'.authority-lock')).ino).toBe(inode);
},15000);
test('REC-LOCK an unbound initialization marker never authorizes adoption of an unknown directory',async()=>{
 const {dir,t}=await killAt('kernel_authority_directory_unbound',{authority:true}),before=fs.readFileSync(path.join(dir,'.authority-init-v2.json'));
 expect(()=>k.prepareAuthority(dir,t)).toThrow('recovery_initialization_incomplete');expect(()=>k.completeAuthorityInitialization(dir,t)).toThrow('recovery_initialization_incomplete');
 expect(fs.readFileSync(path.join(dir,'.authority-init-v2.json'))).toEqual(before);expect(fs.readdirSync(path.join(dir,'.authority-lock'))).toEqual([]);
},15000);
test('REC-LOCK unmarked legacy authority directory is distinct and remains byte-for-byte untouched',()=>{
 const dir=path.join(root,'legacy-registry');fs.mkdirSync(dir,{mode:0o700});fs.mkdirSync(path.join(dir,'.authority-lock'),{mode:0o700});
 expect(()=>k.prepareAuthority(dir,tool())).toThrow('legacy_recovery_unavailable');expect(fs.readdirSync(dir)).toEqual(['.authority-lock']);expect(fs.readdirSync(path.join(dir,'.authority-lock'))).toEqual([]);
});

const profiles=require('../../scripts/improve-profiles.cjs'),controller=require('../../scripts/improve-controller.cjs'),{fixture}=require('../helpers/improve-controller.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
function v2Host(){
 f=fixture();const t=tool(),registry=path.join(f.root,'v2-registry'),store=path.join(f.root,'v2-controller');fs.mkdirSync(registry,{mode:0o700});
 profiles.registerProfile(registry,f.profile,{lockTool:t});const config={...f.config(),registry,root:store,recovery:{format:2,lockTool:t}},service=()=>controller.createControllerService(config);
 service().registerPolicy(f.policy());return {registry,store,config,service};
}
test.each(['authority_locked','before_transition','rename','directory_fsync'])('REC-LOCK real protected controller SIGKILL at %s releases BOTH mutexes and preserves exactly one admission',async checkpoint=>{
 const h=v2Host(),cfg=path.join(f.root,'crash-host.json');fs.writeFileSync(cfg,JSON.stringify({root:h.store,registry:h.registry,principal:'owner',host:f.host,clock:f.clock,recovery:h.config.recovery,checkpoint}),{mode:0o600});
 const child=cp.spawn(process.execPath,[path.resolve('tests/fixtures/improve-worker/controller-kernel-holder.cjs'),cfg],{stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',b=>{error+=b;});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',b=>b.toString().trim()===checkpoint?resolve():reject(Error('Bad checkpoint')));child.once('error',reject);child.once('exit',c=>reject(Error('Early exit '+c+' '+error)));});
  const authority=path.join(h.registry,'.authority-lock','kernel-v2.lock'),writer=path.join(h.store,'writer.lock'),inodes=[authority,writer].map(p=>fs.statSync(p).ino);
  const done=new Promise(resolve=>child.once('exit',(code,signal)=>resolve(signal)));child.kill('SIGKILL');expect(await done).toBe('SIGKILL');
  const admitted=h.service().admit({repo_id:'fixture',request_id:'atomic-crash'});expect(admitted.allowed).toBe(true);
  expect(admitted.duplicate).toBe(checkpoint==='directory_fsync'?true:undefined);
  expect(h.service().admit({repo_id:'fixture',request_id:'atomic-crash'})).toMatchObject({duplicate:true,run_id:admitted.run_id});
  const status=h.service().status({repo_id:'fixture'});expect(status.runs).toHaveLength(1);expect(status.runs[0].consumed_attempts).toBe(0);
  expect([authority,writer].map(p=>fs.statSync(p).ino)).toEqual(inodes);
 }finally{if(child.exitCode===null&&child.signalCode===null){const end=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await end;}}
},20000);
test('REC-LOCK old-format clients cannot modify a v2 host, while v1 state is never implicitly migrated',()=>{
 const h=v2Host(),file=path.join(h.store,'controller.json'),before=fs.readFileSync(file);
 expect(()=>profiles.registerProfile(h.registry,f.profile)).toThrow('Owner registry operation active');
 expect(()=>new controller.ControllerStore({root:h.store}).change(()=>{})).toThrow('store_busy');expect(fs.readFileSync(file)).toEqual(before);
 f.register();const legacy=fs.readFileSync(path.join(f.store,'controller.json'));
 const requested=new controller.ControllerStore({root:f.store,format:2,lockTool:h.config.recovery.lockTool});expect(requested.read().version).toBe(1);
 expect(()=>requested.change(()=>{})).toThrow('legacy_recovery_unavailable');expect(fs.readFileSync(path.join(f.store,'controller.json'))).toEqual(legacy);
},15000);

function migrationHost(){
 f=fixture();f.register();const config={...f.config(),recovery:{format:2,lockTool:tool(),migration:{dedicated:true,stores:[f.store]}}};
 return {config,service:()=>controller.createControllerService(config),request:{repo_id:'fixture',request_id:'migration-1'}};
}
test('REC-LOCK explicit quiescent migration preserves original runs, counters, deadlines and history',()=>{
 const h=migrationHost(),old=f.service().admit({repo_id:'fixture',request_id:'legacy-admission'}),before=f.service().store.read();
 expect(h.service().migrate(h.request)).toEqual({allowed:true,reason_code:null});
 const next=h.service().store.read();expect(next.version).toBe(2);expect(next.runs).toEqual(before.runs);expect(next.owners).toEqual(before.owners);expect(next.requests).toEqual(before.requests);
 expect(next.history.slice(0,before.history.length)).toEqual(before.history);expect(next.history.filter(e=>e.event==='recovery_migration')).toHaveLength(1);
 expect(next.runs[old.run_id].limits.maxAttempts).toBe(f.policy().limits.maxAttempts);expect(next.runs[old.run_id].deadline_ms).toBe(before.runs[old.run_id].deadline_ms);
 expect(h.service().migrate(h.request)).toEqual({allowed:true,reason_code:null});expect(h.service().store.read().history.filter(e=>e.event==='recovery_migration')).toHaveLength(1);
},15000);
test('REC-LOCK migration refuses unknown legacy writer without removing or rewriting it',()=>{
 const h=migrationHost(),file=path.join(f.store,'writer.lock');fs.writeFileSync(file,'{"pid":987654321}',{mode:0o600});const before=fs.readFileSync(file),state=fs.readFileSync(path.join(f.store,'controller.json'));
 expect(()=>h.service().migrate(h.request)).toThrow('legacy_recovery_unavailable');expect(fs.existsSync(file)).toBe(true);expect(fs.readFileSync(file)).toEqual(before);expect(fs.readFileSync(path.join(f.store,'controller.json'))).toEqual(state);
},15000);
test('REC-LOCK migration refuses active work and non-owner before any format rewrite',()=>{
 const h=migrationHost(),admitted=f.service().admit({repo_id:'fixture',request_id:'active'});f.service().reserveCycle({repo_id:'fixture',run_id:admitted.run_id,binding:{job_id:'pending-job',operation_id:'pending-op',core_run_id:'pending-core'}});
 const bytes=fs.readFileSync(path.join(f.store,'controller.json'));expect(()=>h.service().migrate(h.request)).toThrow('migration_work_not_quiescent');expect(fs.readFileSync(path.join(f.store,'controller.json'))).toEqual(bytes);
 f.principal='viewer';expect(()=>h.service().migrate(h.request)).toThrow('migration_owner_required');expect(fs.readFileSync(path.join(f.store,'controller.json'))).toEqual(bytes);
},15000);
test('REC-LOCK lost migration acknowledgement reconciles the same intent without another migration event',()=>{
 const h=migrationHost();let fired=false;
 const service=controller.createControllerService({...h.config,fault:stage=>{if(stage==='migration_state_committed'&&!fired){fired=true;throw Error('Lost migration ack');}}});
 expect(()=>service.migrate(h.request)).toThrow('Lost migration ack');expect(h.service().store.read().version).toBe(2);
 expect(()=>h.service().admit({repo_id:'fixture',request_id:'must-wait'})).toThrow('recovery_migration_incomplete');
 expect(h.service().migrate(h.request).allowed).toBe(true);expect(h.service().store.read().history.filter(e=>e.event==='recovery_migration')).toHaveLength(1);
},15000);

test.each(['migration_intent','migration_authority_fenced','migration_writer_fenced','migration_state_committed','migration_marker_committed'])('REC-LOCK real migration SIGKILL at %s preserves legacy identity and reconciles once',async checkpoint=>{
 const h=migrationHost(),before=f.service().store.read(),cfg=path.join(f.root,'migration-host.json');
 fs.writeFileSync(cfg,JSON.stringify({root:f.store,registry:f.registry,principal:'owner',host:f.host,clock:f.clock,recovery:h.config.recovery,checkpoint,action:'migrate'}),{mode:0o600});
 const child=cp.spawn(process.execPath,[path.resolve('tests/fixtures/improve-worker/controller-kernel-holder.cjs'),cfg],{stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',b=>{error+=b;});
 try{
  await new Promise((resolve,reject)=>{child.stdout.once('data',b=>b.toString().trim()===checkpoint?resolve():reject(Error('Bad migration checkpoint')));child.once('error',reject);child.once('exit',c=>reject(Error('Early migration exit '+c+' '+error)));});
  if(checkpoint!=='migration_marker_committed')expect(()=>h.service().migrate(h.request)).toThrow('migration_holder_unresolved');
  const authority=path.join(f.registry,'.authority-lock'),writer=path.join(f.store,'writer.lock'),inodes=[authority,writer].map(p=>fs.statSync(p).ino);
  const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve(signal)));child.kill('SIGKILL');expect(await ended).toBe('SIGKILL');
  expect(h.service().migrate(h.request).allowed).toBe(true);expect(h.service().migrate(h.request).allowed).toBe(true);
  const next=h.service().store.read();expect(next.version).toBe(2);expect(next.runs).toEqual(before.runs);expect(next.policies).toEqual(before.policies);
  expect(next.history.filter(e=>e.event==='recovery_migration')).toHaveLength(1);expect(next.history.slice(0,before.history.length)).toEqual(before.history);
  expect([authority,writer].map(p=>fs.statSync(p).ino)).toEqual(inodes);
 }finally{if(child.exitCode===null&&child.signalCode===null){const end=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGKILL');await end;}}
},20000);

function diskBytes(directory){const out={};function visit(at,relative){for(const name of fs.readdirSync(at).sort()){const p=path.join(at,name),key=relative+name,s=fs.lstatSync(p);if(s.isDirectory()){out[key+'/']='directory';visit(p,key+'/');}else out[key]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');}}visit(directory,'');return out;}
test.each(['missing','false','multiple','mismatched'])('REC-LOCK migration inventory %s is denied before controller, writer or registry bytes change',kind=>{
 const h=migrationHost(),writer=path.join(f.store,'writer.lock');fs.writeFileSync(writer,'{"pid":987654321}',{mode:0o600});
 if(kind==='missing')delete h.config.recovery.migration;
 if(kind==='false')h.config.recovery.migration.dedicated=false;
 if(kind==='multiple')h.config.recovery.migration.stores.push(path.join(f.root,'other-store'));
 if(kind==='mismatched')h.config.recovery.migration.stores=[path.join(f.root,'other-store')];
 const before={controller:diskBytes(f.store),registry:diskBytes(f.registry)};expect(()=>h.service().migrate(h.request)).toThrow('legacy_recovery_unavailable');
 expect({controller:diskBytes(f.store),registry:diskBytes(f.registry)}).toEqual(before);
},15000);
test('REC-LOCK dropping the dedicated inventory after an interrupted intent cannot mutate or finalize the migration',()=>{
 const h=migrationHost(),inventory=h.config.recovery.migration;let fired=false;
 const svc=controller.createControllerService({...h.config,fault:stage=>{if(stage==='migration_authority_fenced'&&!fired){fired=true;throw Error('Interrupted intent');}}});
 expect(()=>svc.migrate(h.request)).toThrow('Interrupted intent');delete h.config.recovery.migration;
 const before={controller:diskBytes(f.store),registry:diskBytes(f.registry)};expect(()=>h.service().migrate(h.request)).toThrow('legacy_recovery_unavailable');
 expect({controller:diskBytes(f.store),registry:diskBytes(f.registry)}).toEqual(before);
 h.config.recovery.migration=inventory;expect(h.service().migrate(h.request).allowed).toBe(true);
},15000);
