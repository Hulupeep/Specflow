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
