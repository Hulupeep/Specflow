const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const {fixture}=require('../helpers/duo-action-fixture.cjs');
const duo=require('../../scripts/duo-build.cjs'),runtime=require('../../scripts/duo-runtime.cjs');
let f;
beforeEach(()=>{f=fixture();});afterEach(()=>f.close());
function legacy(){const s=f.state();delete s.reviewControl;f.put(`.specflow/duo/${s.id}/run.json`,s);return s;}
function input(){f.put('diagnosis.txt','Legacy protocol rejection diagnosed; adopt reviewed policy without refunds');return {ownerAuthorized:true,reason:'Owner requests recovery',evidence:[{path:'diagnosis.txt',sha256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(f.root,'diagnosis.txt'))).digest('hex')}]};}
test('MIG-1/3/4: same-run migration archives exact old state/runtime and requires fresh review',()=>{
 const old=legacy(),dir=path.join(f.root,'.specflow/duo',old.id),bytes=fs.readFileSync(path.join(dir,'run.json'));
 const migrated=duo.migrateReview(f.root,old.id,old.owner.session,input());
 expect(migrated.id).toBe(old.id);expect(migrated.history).toEqual(old.history);expect(migrated.findings).toEqual(old.findings);expect(migrated.instructions).toEqual(old.instructions);
 expect(migrated.owner).toEqual(old.owner);expect(migrated.pinned).toEqual(old.pinned);expect(migrated.reviewControl.calls).toBe(0);expect(migrated.indexComplete).toBe(false);
 const event=migrated.events.at(-1);expect(fs.readFileSync(path.join(f.root,event.archive))).toEqual(bytes);runtime.verify(dir,old.runtime);runtime.verify(dir,migrated.runtime);
 expect(()=>duo.finish(f.root,old.id,old.owner.session)).toThrow();
 expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,input())).toThrow(/already|current/);
 const result=execFileSync(process.execPath,[path.resolve(__dirname,'../../scripts/duo-build.cjs'),'status',old.id],{cwd:f.root,encoding:'utf8'});expect(result).toContain(migrated.runtime.identity);
});
test('MIG-2: wrong owner, missing authorization/reason, stale evidence leave original state intact',()=>{
 const old=legacy(),file=path.join(f.root,'.specflow/duo',old.id,'run.json'),before=fs.readFileSync(file);
 const good=input();for(const [token,data] of [['wrong',good],[old.owner.session,{...good,ownerAuthorized:false}],[old.owner.session,{...good,reason:''}],[old.owner.session,{...good,evidence:[{path:'diagnosis.txt',sha256:'wrong'}]}]])expect(()=>duo.migrateReview(f.root,old.id,token,data)).toThrow();
 expect(fs.readFileSync(file)).toEqual(before);
});
test('MIG-3: historical calls and validated achievements survive without granting acceptance',()=>{
 f.put('display.cjs','console.log(42)');f.review(f.batch(f.capture()));
 const old=legacy();expect(old.criteria['AC-TOTAL'].status).toBe('verified');
 const next=duo.migrateReview(f.root,old.id,old.owner.session,input());
 expect(next.reviewControl.calls).toBe(1);expect(next.reviewControl.achievements).toContain('criterion:AC-TOTAL');expect(next.criteria['AC-TOTAL'].status).toBe('unverified');expect(next.everVerified).toEqual(old.everVerified);
});
test('MIG-2: installer and active operation locks refuse migration',()=>{
 const old=legacy(),data=input();runtime.lock(f.root,()=>expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow(/lock/));
 f.put(`.specflow/duo/${old.id}/review.lock`,String(process.pid));expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow(/active/);
});
test('MIG-2: failed staging leaves old run authoritative and retry keeps abandoned archive',()=>{
 const old=legacy(),data=input(),file=path.join(f.root,'.specflow/duo',old.id,'run.json'),before=fs.readFileSync(file);
 const spy=jest.spyOn(runtime,'pin').mockImplementationOnce(()=>{throw Error('disk full');});
 try{expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow('disk full');}finally{spy.mockRestore();}
 expect(fs.readFileSync(file)).toEqual(before);const dir=path.join(path.dirname(file),'runtime-migrations'),first=fs.readdirSync(dir)[0],archive=fs.readFileSync(path.join(dir,first,'before.json'));
 expect(duo.migrateReview(f.root,old.id,old.owner.session,data).reviewControl).toBeDefined();expect(fs.readdirSync(dir)).toHaveLength(2);expect(fs.readFileSync(path.join(dir,first,'before.json'))).toEqual(archive);
});
test('MIG-1/2: unknown runtime, ceased and completed state refuse',()=>{
 const old=legacy(),data=input();for(const patch of [{runtime:{provenance:'legacy_unknown'}},{runtimeCeased:{reason:'ended'}},{goalStatus:'complete'}]){
 f.put(`.specflow/duo/${old.id}/run.json`,{...old,...patch});expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow();
 }
});
test('MIG-2/3: scoped journal lock and pending round refuse; migration preserves exact shared bytes',()=>{
 const old=legacy(),data=input();old.context.specification={record:'record.json',targetTier:'build-ready'};f.put('record.json',{issue:{number:199,body:'fixture'},profile:{}});f.put(`.specflow/duo/${old.id}/run.json`,old);
 const reviews=require('../../scripts/specflow-reviews.cjs'),file=reviews.statePath(f.root,199);fs.mkdirSync(path.dirname(file),{recursive:true});
 const journal={reviews:{'build-ready':[{status:'pending',id:'prior'}]},events:[],batches:{}};fs.writeFileSync(file,JSON.stringify(journal));
 expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow(/Pending scoped/);
 journal.reviews['build-ready'][0].status='complete';fs.writeFileSync(file,JSON.stringify(journal));const bytes=fs.readFileSync(file);
 fs.mkdirSync(file+'.lock');expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow(/Specification operation/);fs.rmdirSync(file+'.lock');
 duo.migrateReview(f.root,old.id,old.owner.session,data);expect(fs.readFileSync(file)).toEqual(bytes);
});
test('MIG-3: invalid historical responses retain protocol guard and earn no progress',()=>{
 const old=legacy(),data=input();old.history=Array.from({length:3},(_,i)=>({batch:'bad',at:new Date().toISOString(),attempted:true,stage:'peer_review',outcome:'blocked',review:{assessments:[{id:'AC-TOTAL',status:'verified'}]}}));f.put(`.specflow/duo/${old.id}/run.json`,old);
 const next=duo.migrateReview(f.root,old.id,old.owner.session,data);expect(next.history).toEqual(old.history);expect(next.reviewControl.calls).toBe(3);expect(next.reviewControl.achievements).toEqual([]);expect(require('../../scripts/review-continuation.cjs').decision(next.reviewControl).kind).toBe('protocol');
});
test('MIG-2: changed acceptance or tampered pinned runtime refuses',()=>{
 const old=legacy(),data=input();f.put('task.md','different acceptance');expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow(/Pinned acceptance/);
 f.put('task.md','AC-TOTAL: display 42\nOWNER-GATE: actual owner consent');f.put(`.specflow/duo/${old.id}/runtime/scripts/duo-build.cjs`,'corrupt');expect(()=>duo.migrateReview(f.root,old.id,old.owner.session,data)).toThrow(/Pinned duo runtime modified/);
});

test('MIG-4: printed migrated entrypoint works while installed legacy dispatcher stays unchanged',()=>{
 const old=legacy(),data=input();
 // The installed launcher still selects only runtime/ and rejects the new bundle.
 const legacySource="const fs=require('fs'),path=require('path');const id=process.argv[3],dir=path.join(process.cwd(),'.specflow/duo',id);const state=JSON.parse(fs.readFileSync(path.join(dir,'run.json')));if(state.runtime.directory)throw Error('Legacy dispatcher cannot select migrated runtime');";
 f.put('scripts/duo-build.cjs',legacySource);
 f.put('migration.json',data);
 const result=require('child_process').spawnSync(process.execPath,[path.resolve(__dirname,'../../scripts/duo-build.cjs'),'migrate-review',old.id,'--session',old.owner.session,'--input','migration.json'],{cwd:f.root,encoding:'utf8'});
 expect(result.stderr).toBe('');expect(result.stdout).toContain('Run commands with:');
 const migrated=f.state(),entry=path.join('.specflow/duo',old.id,migrated.runtime.directory,'scripts/duo-build.cjs');
 const denied=require('child_process').spawnSync(process.execPath,['scripts/duo-build.cjs','status',old.id],{cwd:f.root,encoding:'utf8'});expect(denied.status).not.toBe(0);expect(denied.stderr).toContain('Legacy dispatcher');
 const cadence=path.join(path.dirname(entry),'duo-cadence.cjs');
 const hook=require('child_process').spawnSync(process.execPath,[cadence,'--hook'],{cwd:f.root,encoding:'utf8',env:{...process.env,CLAUDE_PROJECT_DIR:f.root,SPECFLOW_DUO_REVIEWER:''},input:JSON.stringify({session_id:'fixture-session'})});
 expect(hook.status).toBe(0);expect(JSON.parse(hook.stdout)).toMatchObject({decision:'block',reason:expect.stringContaining('node '+entry+' review')});
 expect(duo.status(migrated)).toContain('node '+entry+' ACTION');
 expect(fs.readFileSync(path.join(f.root,'scripts/duo-build.cjs'),'utf8')).toBe(legacySource);
 const out=execFileSync(process.execPath,[entry,'status',old.id],{cwd:f.root,encoding:'utf8'});expect(out).toContain(migrated.runtime.identity);
 const resumed=require('child_process').spawnSync(process.execPath,[entry,'resume',old.id,'--builder',old.builder,'--session',old.owner.session],{cwd:f.root,encoding:'utf8'});expect(resumed.status).toBe(2);expect(resumed.stderr).toBe('');expect(resumed.stdout).toContain('Owner session: '+old.owner.session);
});
test('MIG-3: retained counters absent from detailed history cannot be refunded',()=>{
 const old=legacy(),data=input();old.batchAttempts={earlier:7};old.peerFailures=3;old.stagnantRounds=2;f.put(`.specflow/duo/${old.id}/run.json`,old);
 const next=duo.migrateReview(f.root,old.id,old.owner.session,data);expect(next.reviewControl).toMatchObject({calls:7,protocolFailures:3,stagnant:2});
});
