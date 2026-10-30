const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const backend = require('../../scripts/improve-backend.cjs');
const sha = x => crypto.createHash('sha256').update(x).digest('hex');
const clone = x => JSON.parse(JSON.stringify(x));
const h = 'a'.repeat(64);
const ref = { path: 'inputs/item.json', sha256: h };
function request() { return { schema: 'specflow.backend-request/v1', jobId: 'job-1', phase: 'baseline',
 recipeId: 'heystax-supabase-v1', generation: 'generation-1', expectedBackendIdentity: h,
 productBuildReceipt: clone(ref), inputManifest: clone(ref), resourceProfile: 'heystax-backend-v1' }; }
function inputs() { return { schema:'specflow.backend-inputs/v1', jobId:'job-1', recipeId:'heystax-supabase-v1',
 images:clone(backend.RECIPE.images), migrationRevision:backend.RECIPE.migrationRevision,
 migrations:clone(backend.RECIPE.migrations), migrationRoot:'migrations',
 ...Object.fromEntries(['bootstrap','supabaseCli','seed','credentialBinding','runtimeLayer','configuration','resourceProfile'].map(k=>[k,clone(ref)])),
 expectedState:Object.fromEntries(['schemaSha256','tablesSha256','sequencesSha256','migrationHistorySha256'].map(k=>[k,h])) }; }
describe('closed backend admission (#293)',()=>{
 test('request returns a detached validated value',()=>{const r=request(),v=backend.validateRequest(r);r.jobId='changed';expect(v.jobId).toBe('job-1');});
 test.each(['argv','mounts','environment','privileged','network','image','__proto__'])('rejects unknown authority %s',k=>{
  const r=request();Object.defineProperty(r,k,{value:'attacker',enumerable:true});expect(()=>backend.validateRequest(r)).toThrow('backend_input_invalid');
 });
 test.each(Object.keys(request()))('rejects missing request field %s',k=>{const r=request();delete r[k];expect(()=>backend.validateRequest(r)).toThrow('backend_input_invalid');});
 test.each(['../outside','/etc/passwd','a/../b','a//b','a/./b','a\\b','a\0b'])('rejects unsafe input reference %j',p=>{const r=request();r.inputManifest.path=p;expect(()=>backend.validateRequest(r)).toThrow('backend_input_invalid');});
 test('duplicate JSON keys are rejected before decoding loses them',()=>{expect(()=>backend.validateRequest(JSON.stringify(request()).replace('"jobId":"job-1"','"jobId":"job-2","jobId":"job-1"'))).toThrow('backend_input_invalid');});
 test('delimiter key cannot impersonate fields',()=>{const r=request();delete r.phase;delete r.generation;r['phase|generation']='baseline';expect(()=>backend.validateRequest(r)).toThrow('backend_input_invalid');});
 test('nested arbitrary authority rejected',()=>{const r=request();r.inputManifest.writable=true;expect(()=>backend.validateRequest(r)).toThrow('backend_input_invalid');});
 test('only the exact reviewed migration set and images pass',()=>{expect(backend.validateInputs(inputs()).migrations).toHaveLength(156);});
 test.each(['database','auth','rest','gateway'])('rejects unpinned %s image',k=>{const r=inputs();r.images[k]='latest';expect(()=>backend.validateInputs(r)).toThrow('backend_input_invalid');});
 test.each(['missing','extra','duplicate-name','changed-hash','reordered'])('rejects %s migration manifest',kind=>{
  const r=inputs();if(kind==='missing')r.migrations.pop();if(kind==='extra')r.migrations.push(clone(r.migrations[0]));
  if(kind==='duplicate-name')r.migrations[1].name=r.migrations[0].name;
  if(kind==='changed-hash')r.migrations[0].sha256='b'.repeat(64);if(kind==='reordered')r.migrations.reverse();
  expect(()=>backend.validateInputs(r)).toThrow('backend_input_invalid');
 });
 test('runtime resource profile exactly matches accepted design',()=>expect(backend.PROFILE).toEqual(require('../../docs/specs/improve-worker/backend-resource-profile.json')));
});
describe('bound private file reads',()=>{
 let root; beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'backend-admission-'));fs.chmodSync(root,0o700);});
 afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
 const write=(root,name,data)=>{fs.writeFileSync(path.join(root,name),data,{mode:0o600});return {path:name,sha256:sha(data)};};
 test('reads exact bytes and rejects changed bytes',()=>{const r=write(root,'seed.sql','fixture');expect(backend.readBoundFile(root,r).toString()).toBe('fixture');fs.writeFileSync(path.join(root,'seed.sql'),'mutated');expect(()=>backend.readBoundFile(root,r)).toThrow('backend_input_changed');});
 test('rejects final and parent symlinks',()=>{const r=write(root,'seed.sql','fixture');fs.symlinkSync(path.join(root,'seed.sql'),path.join(root,'link'));expect(()=>backend.readBoundFile(root,{...r,path:'link'})).toThrow('backend_input_invalid');fs.mkdirSync(path.join(root,'dir'));fs.symlinkSync(root,path.join(root,'dir','parent'));expect(()=>backend.readBoundFile(root,{...r,path:'dir/parent/seed.sql'})).toThrow('backend_input_invalid');});
 test('rejects public root',()=>{const r=write(root,'seed.sql','fixture');fs.chmodSync(root,0o755);expect(()=>backend.readBoundFile(root,r)).toThrow('backend_input_invalid');});
 test('rejects files over the explicit bound',()=>{const r=write(root,'seed.sql','four');expect(()=>backend.readBoundFile(root,r,3)).toThrow('backend_input_invalid');});
 test('no directory or external path is a valid artifact',()=>{fs.mkdirSync(path.join(root,'dir'));expect(()=>backend.readBoundFile(root,{path:'dir',sha256:h})).toThrow('backend_input_invalid');expect(()=>backend.readBoundFile(root,{path:'/etc/passwd',sha256:h})).toThrow('backend_input_invalid');});
});
describe('terminal receipt admission',()=>{
 function receipt(){return {schema:'specflow.backend-receipt/v1',jobId:'job-1',phase:'baseline',generation:'generation-1',state:'qualified',namedCause:null,expectedBackendIdentity:h,measuredBackendIdentity:h,manifest:clone(ref),productBuildReceiptSha256:h,supervisorJournal:clone(ref),deadlineEpochMs:123,cleanup:{complete:true,ownedRemoved:8,remainingOwned:0},checks:{executed:2,failed:0,skipped:0}};}
 test('structurally valid receipt is data, never a live capability',()=>expect(backend.validateReceipt(receipt()).state).toBe('qualified'));
 test.each([
  ['unequal identity',r=>r.measuredBackendIdentity='b'.repeat(64)],
  ['missing measurement',r=>r.measuredBackendIdentity=null],
  ['missing manifest',r=>r.manifest=null],
  ['failed check',r=>r.checks.failed=1],['skipped check',r=>r.checks.skipped=1],
  ['zero checks',r=>r.checks.executed=0],['unfinished cleanup',r=>r.cleanup.complete=false],
  ['owned survivor',r=>r.cleanup.remainingOwned=1],['impossible resources',r=>r.cleanup.ownedRemoved=9],
  ['unknown cause',r=>{r.state='failed';r.namedCause='oops'}],['success cause',r=>r.namedCause='backend_lease_expired'],
  ['missing failure cause',r=>r.state='failed'],['noninteger clock',r=>r.deadlineEpochMs=1.1]
 ])('rejects %s',(_,change)=>{const r=receipt();change(r);expect(()=>backend.validateReceipt(r)).toThrow('backend_input_invalid');});
 test.each(['failed','interrupted'])('retains named %s with no successful measurement',state=>{const r=receipt();Object.assign(r,{state,namedCause:'backend_controller_died',measuredBackendIdentity:null,manifest:null});r.checks.executed=0;r.cleanup={complete:false,ownedRemoved:2,remainingOwned:4};expect(backend.validateReceipt(r).namedCause).toBe('backend_controller_died');});
});
