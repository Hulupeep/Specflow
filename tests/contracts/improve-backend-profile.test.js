'use strict';
const fs=require('fs'),crypto=require('crypto');
const profiles=require('../../scripts/improve-backend-profiles.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const old='heystax-backend-v1',journeys='heystax-backend-journeys-v1';
const check=(name,timeout=100)=>({timeout_seconds:timeout,verification_level:'journey',boundaries:['browser','api','database'],checker_paths:[name+'.spec.cjs',name+'.config.cjs'],input_paths:[],rule_paths:[],execution:{adapter:'playwright',test_files:[name+'.spec.cjs'],required_case_ids:[name+'::1280',name+'::360'],optional_case_ids:[],args:['--config',name+'.config.cjs']}});
const contract=()=>({acceptance:[{id:'gain',mandatory:true,check:check('gain'),dev_check:check('practice')},{id:'pending',mandatory:true,check:check('pending')},{id:'preserve',mandatory:true,check:check('preserve')},{id:'ux',mandatory:true,level:3}]});
const plan=(phase='baseline',c=contract(),extra={})=>profiles.planPhase({phase,contract:c,profileId:journeys,deadlineAtMs:2000000,nowMs:1000,...extra});
test('original profile bytes and non-time resource limits remain unchanged',()=>{
 expect(hash(fs.readFileSync(require.resolve('../../scripts/improve-backend-profile.json')))).toBe('c80d88b2dba8f111b455c1cdbdcf38cdfad2ca6a63a51eb25175c209b7d80c54');
 expect(hash(profiles.profileBytes(journeys))).toBe('d97baabca70c61f2f6b9f00d537d73aa22e2e54cc5026b4e8ba2088b751bc739');
 const a=profiles.profileFor(old),b=profiles.profileFor(journeys);
 for(const k of ['slots','aggregate','output'])expect(b[k]).toEqual(a[k]);
 expect(a.time.executionMilliseconds).toBe(120000);expect(b.time.executionMilliseconds).toBe(600000);expect(b.time.totalMilliseconds).toBe(780000);
 expect(Object.isFrozen(b.time)).toBe(true);expect(()=>{b.time.executionMilliseconds=Infinity;}).toThrow();
});
test.each(['unknown','__proto__',null,{},'heystax-backend-journeys-v1\n'])('rejects unknown profile %j',id=>expect(()=>profiles.profileFor(id)).toThrow('backend_profile_invalid'));
test('profile bytes must match the closed selected profile',()=>{
 const bytes=profiles.profileBytes(journeys);expect(profiles.validateProfileBytes(journeys,bytes)).toBe(profiles.profileFor(journeys));
 const mutated=JSON.parse(bytes);mutated.time.executionMilliseconds++;expect(()=>profiles.validateProfileBytes(journeys,Buffer.from(JSON.stringify(mutated)))).toThrow('backend_input_changed');
 expect(()=>profiles.validateProfileBytes(journeys,profiles.profileBytes(old))).toThrow('backend_input_changed');
 bytes[0]=0;expect(profiles.profileBytes(journeys)[0]).toBe(123);
});
test('baseline includes all hidden checks before practice with all two-width case identities',()=>{
 const p=plan();expect(p.invocations.map(x=>x.set+':'+x.id)).toEqual(['holdout:gain','holdout:pending','holdout:preserve','dev:gain']);
 expect(p.invocations.flatMap(x=>x.requiredCaseIds)).toHaveLength(8);
 expect(p).toMatchObject({declaredMilliseconds:400000,setupMilliseconds:90000,continuityMilliseconds:10000,requiredExecutionMilliseconds:580000,availableExecutionMilliseconds:600000,deadlineAtMs:2000000});
 expect(p.dispatchMilliseconds).toBe(80000);expect(p.dispatchMillisecondsPerInvocation).toBe(20000);
 expect(p.profileSha256).toBe(hash(profiles.profileBytes(journeys)));expect(p.inventorySha256).toMatch(/^[a-f0-9]{64}$/);
});
test('after and development select their actual execution sets; no optional invocation omitted',()=>{
 const c=contract();c.acceptance[1].mandatory=false;
 expect(plan('after',c).invocations.map(x=>x.id)).toEqual(['gain','pending','preserve']);
 expect(plan('dev-r2',c).invocations.map(x=>x.set+':'+x.id)).toEqual(['dev:gain']);
});
test('original short profile rejects the observed inventory with actionable required/available values',()=>{
 try{plan('baseline',contract(),{profileId:old});throw Error('not rejected');}catch(e){expect(e).toMatchObject({code:'backend_inventory_exceeds_profile',stage:'backend_admission',requiredMilliseconds:580000,availableMilliseconds:120000});expect(e.next_action).toMatch(/profile/);}
});
test('insufficient original job horizon fails without modifying the deadline',()=>{
 expect(()=>plan('baseline',contract(),{deadlineAtMs:1001})).toThrow('backend_job_time_insufficient');
 const a=plan(),b=plan('baseline',contract(),{nowMs:2000});expect(a.deadlineAtMs).toBe(b.deadlineAtMs);expect(a.inventorySha256).toBe(b.inventorySha256);
});
test('default timeout and fractional seconds match native invocation semantics',()=>{
 const c=contract();delete c.acceptance[0].check.timeout_seconds;c.acceptance[1].check.timeout_seconds=0.0001;
 const p=plan('after',c);expect(p.invocations.map(x=>x.timeoutMilliseconds)).toEqual([120000,1,100000]);
});
test.each([0,-1,NaN,Infinity,Number.MAX_VALUE])('invalid/overflow timeout %s fails admission',timeout=>{
 const c=contract();c.acceptance[0].check.timeout_seconds=timeout;expect(()=>plan('baseline',c)).toThrow('backend_inventory_invalid');
});
test('changed checks change digest and excessive inventory fails',()=>{
 const c=contract(),a=plan();c.acceptance[0].check.execution.required_case_ids[0]='different';expect(plan('baseline',c).inventorySha256).not.toBe(a.inventorySha256);
 c.acceptance.push({id:'extra1',mandatory:false,check:check('extra1')},{id:'extra2',mandatory:false,check:check('extra2')});expect(()=>plan('baseline',c)).toThrow('backend_inventory_exceeds_profile');
});
test('rejects invalid phases, duplicate acceptance identities and unsupported non-native checks',()=>{
 expect(()=>plan('dev-r0')).toThrow('backend_inventory_invalid');
 const c=contract();c.acceptance.push(c.acceptance[0]);expect(()=>plan('baseline',c)).toThrow('backend_inventory_invalid');
 const d=contract();d.acceptance[0].check={command:['true']};expect(()=>plan('baseline',d)).toThrow('backend_inventory_invalid');
});

describe('fixed supervisor profile lifetime',()=>{
 const os=require('os'),path=require('path');
 const {BackendJournal}=require('../../scripts/improve-backend-supervisor.cjs');
 const identity=require('../../scripts/improve-process-identity.cjs');
 let root,journal;
 beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'sf-profile-'));});
 afterEach(()=>{journal?.close();journal=null;fs.rmSync(root,{recursive:true,force:true});jest.restoreAllMocks();});
 const create=(extra={})=>new BackendJournal({root,jobId:'job',generation:'generation',controller:identity.identity(),resourceProfile:journeys,...extra});
 test('explicit selected profile sets immutable total and execution deadlines',()=>{
  journal=create();const start=journal.snapshot();expect(start.deadlineEpochMs-start.startedEpochMs).toBe(780000);
  expect(start.resourceProfile).toBe(journeys);expect(start.resourceProfileSha256).toBe(hash(profiles.profileBytes(journeys)));
  journal.phase('bootstrap');journal.phase('readiness');journal.phase('measured');journal.phase('execution');
  const state=journal.snapshot();expect(state.phaseDeadlineEpochMs-state.startedEpochMs).toBeGreaterThanOrEqual(600000);
  jest.spyOn(Date,'now').mockReturnValue(state.phaseDeadlineEpochMs+1);expect(journal.check().cause).toBe('backend_lease_expired');
  expect(journal.snapshot().deadlineEpochMs).toBe(start.deadlineEpochMs);
 });
 test('original job deadline still clips longer profile',()=>{
  const deadline=Date.now()+10000;journal=create({deadlineAtMs:deadline});expect(journal.snapshot().deadlineEpochMs).toBe(deadline);
 });
 test('unknown profile fails before journal creation',()=>{
  expect(()=>create({resourceProfile:'unlimited'})).toThrow('backend_profile_invalid');expect(fs.existsSync(path.join(root,'journal.json'))).toBe(false);
 });
});

test('internal service token spans the journey but never exceeds credential/task authority',()=>{
 expect(profiles.serverExpiry(old,5000,5000000,1000)).toBe(1600);
 expect(profiles.serverExpiry(journeys,5000,5000000,1000)).toBe(1880);
 expect(profiles.serverExpiry(journeys,1800,5000000,1000)).toBe(1800);
 expect(profiles.serverExpiry(journeys,5000,1800000,1000)).toBe(1800);
 expect(()=>profiles.serverExpiry(journeys,1600,5000000,1000)).toThrow('backend_credentials_expired');
});

test('four default native timeouts cannot silently absorb dispatch overhead',()=>{
 const c=contract();for(const a of c.acceptance)for(const k of ['check','dev_check'])if(a[k])delete a[k].timeout_seconds;
 try{plan('baseline',c);throw Error('not rejected');}catch(e){expect(e).toMatchObject({code:'backend_inventory_exceeds_profile',requiredMilliseconds:660000,availableMilliseconds:600000});}
});


test('v2 changes only checker task capacity; old profile and all deadlines stay fixed (#315)',()=>{
 const id='heystax-backend-journeys-v2',a=profiles.profileFor(journeys),b=profiles.profileFor(id);
 expect(hash(profiles.profileBytes(id))).toBe('0bcde64357203af07e5678e28984f991f5c3be977b7f989fa4ba871c228618c9');
 expect(profiles.workerLimits(journeys,'app').pids).toBe(128);
 for(const slot of ['app','checker'])expect(profiles.workerLimits(id,slot).phaseMilliseconds).toBe(profiles.workerLimits(journeys,slot).phaseMilliseconds);
 expect(profiles.serverExpiry(id,5000,5000000,1000)).toBe(profiles.serverExpiry(journeys,5000,5000000,1000));
 const expected=JSON.parse(JSON.stringify(a));expected.id=id;expected.slots.checker.pids=256;expected.aggregate.pids=768;
 expect(b).toEqual(expected);
 expect(profiles.workerLimits(id,'checker').pids).toBe(256);
 expect(profiles.workerLimits(id,'app').pids).toBe(128);
 expect(profiles.workerLimits(journeys,'checker').pids).toBe(128);
 expect(plan('baseline',contract(),{profileId:id}).requiredLifecycleMilliseconds).toBe(plan().requiredLifecycleMilliseconds);
 expect(()=>profiles.validateProfileBytes(id,profiles.profileBytes(journeys))).toThrow('backend_input_changed');
});


test.each([undefined,'heystax-backend-journeys-v1','heystax-backend-journeys-v2','heystax-backend-journeys-v3','unlimited','heystax-backend-v1'])('qualification CLI admits only closed journey profile before inputs or Docker: %s',id=>{
 const cp=require('child_process'),path=require('path');
 const args=[path.resolve(__dirname,'../qualification/improve-backend-journeys-prepare.cjs'),'/missing-specflow-315-input','/missing-specflow-315-descriptor','1',...(id===undefined?[]:[id])];
 const r=cp.spawnSync(process.execPath,args,{cwd:path.resolve(__dirname,'../..'),encoding:'utf8',timeout:10000});
 expect(r.status).toBe(1);
 const error=JSON.parse(r.stderr.trim());
 expect(error.cause).toBe(id===undefined||['heystax-backend-journeys-v1','heystax-backend-journeys-v2','heystax-backend-journeys-v3'].includes(id)?'ENOENT':'backend_profile_invalid');
});
test.each([old,journeys,'heystax-backend-journeys-v2','heystax-backend-journeys-v3'])('aggregate task declaration sums the per-slot ceilings: %s',id=>{
 const p=profiles.profileFor(id);expect(p.aggregate.pids).toBe(Object.values(p.slots).reduce((sum,s)=>sum+s.pids*s.maxInstances,0));
});
test('v3 extends only isolated journey cleanup and preserves the v2 profile identity',()=>{
 const previous=profiles.profileFor('heystax-backend-journeys-v2'),next=profiles.profileFor('heystax-backend-journeys-v3');
 expect(hash(profiles.profileBytes('heystax-backend-journeys-v2'))).toBe('0bcde64357203af07e5678e28984f991f5c3be977b7f989fa4ba871c228618c9');
 const expected=JSON.parse(JSON.stringify(previous));expected.id='heystax-backend-journeys-v3';
 expected.time.totalMilliseconds=820000;expected.time.cleanupMilliseconds=60000;
 expect(next).toEqual(expected);
 expect(profiles.workerLimits('heystax-backend-journeys-v3','app').phaseMilliseconds)
  .toBe(profiles.workerLimits('heystax-backend-journeys-v2','app').phaseMilliseconds+40000);
});
