const fs=require('fs'),os=require('os'),path=require('path');
const managed=require('../../scripts/improve-managed-worker.cjs'),a=require('../../scripts/improve-backend-attempt.cjs');
const {DurableStore}=require('../../scripts/improve-worker.cjs'),identity=require('../../scripts/improve-process-identity.cjs');
const plan=()=>({image:'sha256:'+'a'.repeat(64),uid:1000,network:'none',memory:268435456,mounts:[{source:'/trusted/node',destination:'/node',writable:false}],tmpfs:[],phaseMilliseconds:60000});
describe('managed worker closed create plan (#293)',()=>{
 test('fixed create command contains no caller-selected executable or environment',()=>{const p=plan(),args=managed.createArgs(p,'specflow-12345678-1234-4123-a123-123456789abc-app');expect(args[0]).toBe('create');expect(args).toContain('--read-only');expect(args).toContain('no-new-privileges');expect(args.slice(-3)).toEqual([p.image,'-e','setInterval(()=>{},1000)']);expect(args).not.toContain('run');});
 test.each(['argv','environment','docker','privileged','entrypoint','name','command'])('rejects unknown %s authority',key=>expect(()=>managed.validatePlan({...plan(),[key]:'untrusted'})).toThrow('backend_input_invalid'));
 test.each(['host','bridge','container:foreign','none\n'])('rejects network %s',network=>expect(()=>managed.validatePlan({...plan(),network})).toThrow());
 test.each([0,-1,2147483649,Infinity,1.5])('rejects memory %s',memory=>expect(()=>managed.validatePlan({...plan(),memory})).toThrow());
 test.each([0,600001,Infinity,1.5])('rejects phase duration %s',phaseMilliseconds=>expect(()=>managed.validatePlan({...plan(),phaseMilliseconds})).toThrow());
 test('rejects writable mount and mount option injection',()=>{const p=plan();p.mounts[0].writable=true;expect(()=>managed.validatePlan(p)).toThrow();p.mounts[0].writable=false;p.mounts[0].source='/tmp,readonly=false';expect(()=>managed.validatePlan(p)).toThrow();});
 test('rejects duplicate reserved tmpfs mount and accessors without executing them',()=>{const p=plan();p.tmpfs=[{path:'/tmp',bytes:4096}];expect(()=>managed.validatePlan(p)).toThrow();const q=plan();Object.defineProperty(q,'network',{get(){throw Error('executed');},enumerable:true});expect(()=>managed.validatePlan(q)).toThrow('backend_input_invalid');});
 test('unbound legacy worker remains on existing path',()=>{expect(managed.create({},plan())).toBeNull();expect(managed.destroy({},'a'.repeat(64))).toBe(false);});
});
describe('signed supervisor events are ordered and cannot recover uncertain creation (storage tests)',()=>{
 let root,store,ref;
 beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'managed-events-'));store=new DurableStore({root,sourceRoot:root});ref=a.begin(store,{jobId:'job',runId:'run',phase:'dev-r1',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+60000});a.intent(store,ref,{slot:'app',expectedConfigSha256:'d'.repeat(64),creator:identity.identity(),supervisor:identity.identity()});});
 afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
 const event=(state,id=null,inspectionSha256=null)=>a.resourceEvent(store,ref,'app',{state,id,inspectionSha256});
 test('cannot start or remove before a returned creation is recorded',()=>{expect(()=>event('started','e'.repeat(64),'f'.repeat(64))).toThrow();expect(()=>event('removed','e'.repeat(64),'f'.repeat(64))).toThrow();});
 test('dispatch and created identity are durable before start; removal cannot change identity',()=>{event('dispatching');event('created','e'.repeat(64),'f'.repeat(64));event('started','e'.repeat(64),'f'.repeat(64));expect(()=>event('removed','a'.repeat(64),'f'.repeat(64))).toThrow();event('removed','e'.repeat(64),'f'.repeat(64));expect(a.resourceEvents(store,ref,'app').map(e=>e.state)).toEqual(['dispatching','created','started','removed']);expect(()=>event('created','a'.repeat(64),'f'.repeat(64))).toThrow('backend_cleanup_unconfirmed');});
 test('unknown dispatch cannot be promoted into a created or clean event',()=>{event('dispatching');event('unconfirmed');expect(()=>event('created','e'.repeat(64),'f'.repeat(64))).toThrow('backend_cleanup_unconfirmed');expect(()=>event('not_dispatched')).toThrow();});
 test('operator fence blocks dispatch including a dangling marker',()=>{fs.symlinkSync('/missing/marker',path.join(root,'backend-attempts','operator-'+ref.attemptId+'.json'));expect(()=>event('dispatching')).toThrow('backend_cleanup_unconfirmed');});
 test('a supervisor cannot append an event for another live process',()=>{const other=identity.identity(process.ppid);a.intent(store,ref,{slot:'checker',expectedConfigSha256:'d'.repeat(64),creator:identity.identity(),supervisor:other});expect(()=>a.resourceEvent(store,ref,'checker',{state:'dispatching',id:null,inspectionSha256:null})).toThrow('backend_attempt_owner_unavailable');});
});


describe('managed supervisor spawn failure (#293)',()=>{
 test('missing supervisor PID never defaults to controller identity or dispatches',()=>{
  const cp=require('child_process'),{DockerWorker}=require('../../scripts/improve-worker.cjs');
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'managed-no-supervisor-'));
  const store=new DurableStore({root,sourceRoot:root});
  const ref=a.begin(store,{jobId:'job',runId:'run',phase:'baseline',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+60000});
  const worker=new DockerWorker({image:'sha256:'+'a'.repeat(64),layer:{},stateRoot:root,jobId:'job'});
  managed.bind(worker,{store,attempt:ref,authorize:()=>{}});managed.select(worker,'build');
  const spawn=jest.spyOn(cp,'spawn').mockReturnValue({pid:undefined,on(){return this;},unref(){}});
  const original=identity.identity;
  const probe=jest.spyOn(identity,'identity').mockImplementation(function(pid){
   // Fail immediately if the unsafe one-argument default is reached, avoiding a
   // misleading 60-second wait on the still-live controller in this regression.
   if(arguments.length===1&&pid===undefined)throw Error('supervisor_identity_defaulted_to_controller');
   return original(pid);
  });
  try{
   expect(()=>managed.create(worker,plan())).toThrow('backend_attempt_owner_unavailable');
   expect(probe.mock.calls.some(args=>args.length===1&&args[0]===undefined)).toBe(false);
   expect(a.intents(store,ref)).toEqual([]);
   const envelope=a.envelope(store,ref),created=fs.readdirSync(envelope).filter(n=>n.startsWith('managed-create-'));
   expect(created).toHaveLength(1);
   for(const name of created)expect(fs.existsSync(path.join(envelope,name,'dispatch.json'))).toBe(false);
  }finally{probe.mockRestore();spawn.mockRestore();fs.rmSync(root,{recursive:true,force:true});}
 });
});

describe('shared-network hostname transition is exact (#293)',()=>{
 const specimen=()=>({Id:'a'.repeat(64),Image:'sha256:'+'b'.repeat(64),Config:{Hostname:'a'.repeat(12),Env:['HOME=/tmp']},HostConfig:{NetworkMode:'container:'+'c'.repeat(64),OomKillDisable:null},Mounts:[],State:{Status:'created'}});
 test('only the initial own-ID hostname may transition to the inspected anchor hostname',()=>{
  const before=specimen(),after=JSON.parse(JSON.stringify(before));after.Config.Hostname='c'.repeat(12);after.State.Status='running';after.HostConfig.OomKillDisable=false;
  expect(managed.workerFingerprint(before,'c'.repeat(12))).toBe(managed.workerFingerprint(after,'c'.repeat(12)));
  after.Config.Env.push('UNTRUSTED=1');expect(managed.workerFingerprint(before,'c'.repeat(12))).not.toBe(managed.workerFingerprint(after,'c'.repeat(12)));
 });
 test.each(['created','running','exited'])('rejects unrelated hostname in %s state',status=>{const c=specimen();c.State.Status=status;c.Config.Hostname='foreign';expect(()=>managed.workerFingerprint(c,'c'.repeat(12))).toThrow('backend_input_changed');});
 test('running checker cannot retain the pre-start hostname or normalize a different network mode',()=>{const c=specimen();c.State.Status='running';expect(()=>managed.workerFingerprint(c,'c'.repeat(12))).toThrow();c.State.Status='created';c.HostConfig.NetworkMode='none';expect(()=>managed.workerFingerprint(c,'c'.repeat(12))).toThrow();});
});

describe('closed journey worker lifetimes (#298)',()=>{
 const profiles=require('../../scripts/improve-backend-profiles.cjs');
 const id='heystax-backend-journeys-v1';
 function backendPlan(slot){const limits=profiles.workerLimits(id,slot);return {...plan(),memory:limits.memory,phaseMilliseconds:limits.phaseMilliseconds,tmpfs:limits.tmpfs,network:slot==='app'?'none':'container:'+'b'.repeat(64),backendProfile:limits.binding};}
 test.each(['app','checker'])('accepts only exact closed %s limits',slot=>{
  const p=backendPlan(slot);expect(managed.validatePlan(p)).toEqual(p);expect(p.phaseMilliseconds).toBeGreaterThan(600000);
  for(const key of ['memory','phaseMilliseconds'])expect(()=>managed.validatePlan({...p,[key]:p[key]+1})).toThrow('backend_input_invalid');
  expect(()=>managed.validatePlan({...p,backendProfile:{...p.backendProfile,sha256:'c'.repeat(64)}})).toThrow('backend_input_invalid');
  expect(()=>managed.createArgs(p,'specflow-12345678-1234-4123-a123-123456789abc-build')).toThrow('backend_input_invalid');
 });
 test('no caller-defined limits or extra roles can select the exception',()=>{
  for(const slot of ['build','source-producer','seed'])expect(()=>profiles.workerLimits(id,slot)).toThrow('backend_profile_invalid');
  expect(()=>profiles.workerLimits('arbitrary','app')).toThrow('backend_profile_invalid');
  expect(()=>managed.validatePlan({...plan(),phaseMilliseconds:880000})).toThrow('backend_input_invalid');
 });
 test('profile checker keeps its closed tmpfs and isolated network',()=>{
  const p=backendPlan('checker');expect(()=>managed.validatePlan({...p,tmpfs:[]})).toThrow('backend_input_invalid');
  expect(()=>managed.validatePlan({...p,network:'none'})).toThrow('backend_input_invalid');
 });
});


test.each(['heystax-backend-journeys-v1','heystax-backend-journeys-v2'])('managed checker derives exact task ceiling from %s, never caller overrides (#315)',id=>{
 const limits=require('../../scripts/improve-backend-profiles.cjs').workerLimits(id,'checker');
 const p={...plan(),memory:limits.memory,tmpfs:limits.tmpfs,phaseMilliseconds:limits.phaseMilliseconds,network:'container:'+'b'.repeat(64),backendProfile:limits.binding};
 const args=managed.createArgs(p,'specflow-12345678-1234-4123-a123-123456789abc-checker');
 expect(args[args.indexOf('--pids-limit')+1]).toBe(id.endsWith('v2')?'256':'128');
 expect(()=>managed.validatePlan({...p,pids:9999})).toThrow('backend_input_invalid');
 expect(()=>managed.createArgs({...p,backendProfile:{...p.backendProfile,sha256:'0'.repeat(64)}},'specflow-12345678-1234-4123-a123-123456789abc-checker')).toThrow('backend_input_invalid');
});
