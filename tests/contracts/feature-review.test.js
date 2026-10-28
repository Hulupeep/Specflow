'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const yaml=require('js-yaml'),crypto=require('crypto');
const SOURCE=path.resolve(__dirname,'../..'),modulePath=path.join(SOURCE,'scripts/advisory-review.cjs');
const advice=require(modulePath);
const runner=require('../../scripts/specflow-runner.cjs');
const routing=require('../../scripts/runtime-routing.cjs');
let root,base;
const git=(...args)=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
const put=(name,value)=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,value);};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
let savedEnv,fixtureExecutable;
beforeEach(()=>{savedEnv={...process.env};fixtureExecutable=null;root=fs.mkdtempSync(path.join(os.tmpdir(),'advisory-review-'));git('init','-q');git('config','user.name','Review fixture');git('config','user.email','fixture@example.invalid');put('.gitignore','.specflow/\n');put('ticket.md','Accepted feature: preserve the real output.');put('app.js','module.exports=1;\n');git('add','.');git('commit','-qm','fixture base');base=git('rev-parse','HEAD');});
afterEach(()=>{for(const key of Object.keys(process.env))if(!Object.hasOwn(savedEnv,key))delete process.env[key];Object.assign(process.env,savedEnv);fs.rmSync(root,{recursive:true,force:true});});
const options=()=>({root,runKey:'fixture',issue:54,baseCommit:base,inputPaths:['ticket.md'],accepted:{number:54,body:'Preserve output'},policy:{id:'fixture-critic',provider:'codex-exec',command:'codex',role:'verifier',model:'gpt-5.6-sol',args:['--sandbox','read-only','--ephemeral']},simulation:true,fixtureExecutable,waitMs:10000});

describe('J-FEATURE-REVIEW-ROUTE-INTEGRITY',()=>{
 test.each(['codex','claude-code'])('%s has an actual required critic rail, preserving 6/7',runtime=>{
  const p=yaml.load(fs.readFileSync(path.join(SOURCE,'templates/adapter-policies',routing.RUNTIMES[runtime])));
  const rails=yaml.load(fs.readFileSync(path.join(SOURCE,'templates/loops/feature-build.yaml'))).rails.map(x=>x.id);
  expect(rails.slice(rails.indexOf('5_impl'),rails.indexOf('5_impl')+4)).toEqual(['5_impl','5_review','6_provenance','7_ci_handoff']);
  expect(p.routes['feature-build']['5_review'].policy).toBe(p.routing_profile.normal_review.policy);
  delete p.routes['feature-build']['5_review'];expect(()=>routing.validateRoleRoutes(p,SOURCE)).toThrow(/missing.*5_review/i);
 });
});
describe('J-FEATURE-REVIEW-CLEAN: complete frozen subject, fresh context and non-authority',()=>{
 test('includes committed, staged, working and new files; excludes builder memory/transcripts',()=>{
  put('committed.js','committed');git('add','.');git('commit','-qm','feature');put('staged.js','staged');git('add','staged.js');put('app.js','working');put('new.js','untracked');
  put('.specflow/STATE.md','PRIVATE_REASONING_SENTINEL');put('.specflow/runs/fixture/adapter/build.jsonl','PRIVATE_REASONING_SENTINEL');
  const s=advice.subject(options());expect(s.base_commit).toBe(base);
  for(const f of ['committed.js','staged.js','app.js','new.js'])expect(s.entries[f]).toBeDefined();
  expect(s.diff).toContain('committed');expect(s.diff).toContain('working');expect(s.index).toContain('staged');expect(s.diff).toContain('untracked');expect(s.changed).toContain('new.js');
  expect(JSON.stringify(s)).not.toContain('PRIVATE_REASONING_SENTINEL');expect(s.input_refs).toContainEqual({path:'ticket.md',sha256:sha(fs.readFileSync(path.join(root,'ticket.md')))});
 });
 test('unknown base is unavailable; HEAD after implementation is never an implicit fallback',()=>{
  expect(()=>advice.subject({...options(),baseCommit:null})).toThrow(/base/i);
 });
 test('read-only invocation rejects resumed critic policies and never carries a builder session',()=>{
  expect(()=>advice.policy({...options().policy,session_id:'private-builder-session'})).toThrow(/fresh/i);
  expect(()=>advice.policy({...options().policy,args:['--resume','abc']})).toThrow(/fresh/i);
  expect(()=>advice.policy({...options().policy,billing:'api',cost:'expensive'})).toThrow(/expensive_api_cap_required/);
  expect(advice.policy({...options().policy,billing:'subscription_cli',cost:'ordinary'})).toBeDefined();
 });
 test('strict provider response cannot smuggle preparation or a Gate C verdict',()=>{
  expect(()=>advice.validateResponse({summary:'clean',findings:[],gate_decision:'passed'},{})).toThrow(/invalid advisory/i);
  expect(()=>advice.validateResponse({summary:'clean',findings:[],purpose:'preparation'},{})).toThrow(/invalid advisory/i);
 });
 test('frozen tree citations normalize only with the exact manifest hash and an actual native read',()=>{
  const f={id:'F1',severity:'p1',location:'tree/app.js:1',summary:'Concern',disposition:'open',tracking_issue:null,rationale:null,evidence:[{path:'tree/app.js',sha256:sha('source')}]},m={'app.js':{sha256:sha('source')}};
  expect(advice.validateResponse({summary:'finding',findings:[f]},m,['tree/app.js']).findings[0].evidence[0].path).toBe('app.js');
  expect(()=>advice.validateResponse({summary:'finding',findings:[f]},m,[])).toThrow(/successful native read/i);
  expect(()=>advice.validateResponse({summary:'finding',findings:[{...f,evidence:[{path:'tree/app.js',sha256:sha('wrong')}]}]},m,['tree/app.js'])).toThrow(/unavailable evidence/i);
 });
 test('Jest discovers canonical tests without executing frozen advisory copies',()=>{
  const r=cp.spawnSync(process.execPath,[path.join(SOURCE,'node_modules/jest/bin/jest.js'),'--runInBand','--listTests','--json','tests/contracts/feature-review.test.js'],{cwd:SOURCE,encoding:'utf8',timeout:10000});if(r.status!==0)throw Error(r.stderr);expect(JSON.parse(r.stdout)).toEqual([path.join(SOURCE,'tests/contracts/feature-review.test.js')]);
 });
});
function simulatedHost(host='codex'){
 const bin=fs.mkdtempSync(path.join(os.tmpdir(),'advisory-bin-'));const script=path.join(bin,host);
 fs.writeFileSync(script,`#!${process.execPath}\nrequire(${JSON.stringify(path.join(SOURCE,'tests/helpers/advisory-native.cjs'))});\n`);fs.chmodSync(script,0o755);
 for(const tool of ['git','sh','bash','cat','sed'])fs.symlinkSync('/usr/bin/'+tool,path.join(bin,tool));
 process.env.PATH=bin;fixtureExecutable={path:script,sha256:sha(fs.readFileSync(script))};
 process.env.ADVISORY_TEST_COUNT=path.join(root,'.specflow/native-count.txt');
 return bin;
}
function nativeCustody(o){const p=advice.paths(o),until=Date.now()+5000;while(Date.now()<until){try{const pointer=JSON.parse(fs.readFileSync(p.current)),op=JSON.parse(fs.readFileSync(path.join(p.dir,pointer.attempt,'custody.json')));if(op.invoked)return {pointer,op,p};}catch{}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);}throw Error('Simulated native operation never reached actual launch');}
describe('J-FEATURE-REVIEW-CLEAN / FINDINGS: actual native construction, simulated peer',()=>{
 test.each(['codex','claude'])('%s completes isolated frozen content protocol, not a preparation or merge gate',host=>{
  const bin=simulatedHost(host);try{const o=options();if(host==='claude')Object.assign(o.policy,{provider:'claude-print',command:'claude',model:'claude-fable-5'});
   const result=advice.run(o);expect(result).toMatchObject({status:'completed',scope_status:'current',clean:true,gate_decision:'pending',mode:'simulated',invoked:true});
   const p=advice.paths(o),pointer=JSON.parse(fs.readFileSync(p.current)),dir=path.join(p.dir,pointer.attempt),inv=JSON.parse(fs.readFileSync(path.join(dir,'invocation.json')));
   expect(inv.purpose).toBe('advisory');expect(inv.args.join(' ')).not.toMatch(/--resume|--continue|--session-id/);
   expect(fs.readFileSync(path.join(dir,'received-prompt.txt'),'utf8')).not.toContain('PRIVATE_REASONING_SENTINEL');
   expect(result.mode).toBe('simulated');expect(advice.handoff(o).clean).toBe(true);
   expect(advice.run(o).attempt_id).toBe(result.attempt_id);expect(fs.readFileSync(process.env.ADVISORY_TEST_COUNT,'utf8')).toBe('called\n');
   // Committing only the designated report must not stale its own source scope.
   git('add','evidence');git('commit','-qm','advisory projection');expect(advice.handoff(o).scope_status).toBe('current');
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test.each([['error','unavailable'],['malformed','invalid'],['empty','invalid'],['no_reads','invalid'],['tamper','invalid'],['timeout','unavailable']])('%s is explicit %s, never clean or approval', (mode,status)=>{
  const bin=simulatedHost();try{process.env.ADVISORY_TEST_CASE=mode;const r=advice.run({...options(),timeoutMs:mode==='timeout'?150:5000});expect(r).toMatchObject({status,clean:false,gate_decision:'pending',invoked:true,mode:'simulated'});expect(r.cause).toBeTruthy();}finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('authentication failure is an uninvoked gap, with no native review launch',()=>{
  const bin=simulatedHost();try{process.env.ADVISORY_TEST_CASE='auth_error';expect(advice.run(options())).toMatchObject({status:'unavailable',invoked:false,mode:'not_invoked',clean:false});expect(fs.existsSync(process.env.ADVISORY_TEST_COUNT)).toBe(false);}finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('a missing simulation pin blocks before a real or simulated provider can launch',()=>{
  const bin=simulatedHost();try{expect(advice.run({...options(),fixtureExecutable:null})).toMatchObject({status:'unavailable',invoked:false,mode:'not_invoked'});expect(fs.existsSync(process.env.ADVISORY_TEST_COUNT)).toBe(false);}finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('the worker is importable for tests without launching a provider',()=>{
  const bin=simulatedHost();try{expect(require('../../scripts/advisory-review-worker.cjs')).toMatchObject({native:expect.any(Function),run:expect.any(Function)});expect(fs.existsSync(process.env.ADVISORY_TEST_COUNT)).toBe(false);}finally{fs.rmSync(bin,{recursive:true,force:true});}
 });
 test.each(['stubborn','descendant_pipe'])('configured timeout terminates the proven-owned %s session, including inherited pipes',mode=>{
  const bin=simulatedHost(),o={...options(),timeoutMs:mode==='stubborn'?150:650,waitMs:3500};try{process.env.ADVISORY_TEST_CASE=mode;const r=advice.run(o);expect(r).toMatchObject({status:'unavailable',invoked:true,mode:'simulated',clean:false});expect(r.cause).toMatch(/timed out/i);}finally{try{const p=advice.paths(o),pointer=JSON.parse(fs.readFileSync(p.current)),dir=path.join(p.dir,pointer.attempt),op=JSON.parse(fs.readFileSync(path.join(dir,'custody.json'))),id=require('../../scripts/improve-process-identity.cjs');if(op.native_identity&&(op.native_members||[]).some(i=>i.group===op.native_identity.group&&id.state(i)==='live'))process.kill(-op.native_identity.group,'SIGKILL');if(id.state(op.owner)==='live')process.kill(-op.owner.group,'SIGKILL');}catch{}fs.rmSync(bin,{recursive:true,force:true});}
 },10000);
 test('new setup projects declare the actual advisory schema dependency',()=>{
  const setup=fs.readFileSync(path.join(SOURCE,'setup-project.sh'),'utf8'),text=setup.split('<<PKGJSON\n')[1].split('\nPKGJSON')[0],p=JSON.parse(text);expect(p.dependencies?.zod||p.devDependencies?.zod).toBe(require(path.join(SOURCE,'package.json')).dependencies.zod);
 });
 test('a live source edit cannot inherit a completed current-scope review',()=>{
  const bin=simulatedHost();try{process.env.ADVISORY_TEST_CASE='hold';const o={...options(),waitMs:100};expect(advice.run(o).status).toBe('pending');nativeCustody(o);put('app.js','changed while native review runs');const until=Date.now()+6000;while(advice.handoff(o).status==='pending'&&Date.now()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);expect(advice.handoff(o)).toMatchObject({status:'completed',scope_status:'stale',clean:false});}finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('missing binary and unknown base are uninvoked gaps, never fabricated native calls',()=>{
  const bin=simulatedHost();try{
   const bad=advice.run({...options(),baseCommit:null});expect(bad).toMatchObject({status:'unavailable',mode:'not_invoked',invoked:false,scope_status:'unknown',clean:false});
   fs.unlinkSync(path.join(bin,'codex'));const absent=advice.run(options());expect(absent).toMatchObject({status:'unavailable',invoked:false,mode:'not_invoked',clean:false});
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('arbitrary source omissions are rejected instead of hiding real implementation',()=>{
  expect(()=>advice.subject({...options(),privatePaths:['app.js']})).toThrow(/silently omitted/i);
 });
 test('actual advice and JSON relabelling cannot mint a preparation execution proof',()=>{
  const assignments=require('../../scripts/review-assignment.cjs');
  expect(assignments.owns({purpose:'preparation',method:'fresh-native',outcome:'accepted'},{id:'fake'},{nativeOutcome:'accepted'})).toBe(false);
  expect(()=>assignments.validate(root,{version:1,method:'fresh-native',purpose:'advisory',runtime:'codex',files:{}})).toThrow(/invalid pinned/i);
 });
 test('source changes stale the old review; tampered Markdown cannot erase canonical serious findings',()=>{
  const bin=simulatedHost();try{process.env.ADVISORY_TEST_FINDINGS=JSON.stringify([{id:'F1',severity:'p1',location:'app.js:1',summary:'Concern survives the projection',disposition:'open',tracking_issue:null,rationale:null,evidence:[]}]);const o=options(),first=advice.run(o);expect(first.findings).toHaveLength(1);
   put('evidence/review-54.md','forged clean');expect(advice.handoff(o)).toMatchObject({projection:'tampered',clean:false,findings:[{id:'F1'}]});
   fs.unlinkSync(path.join(root,'evidence/review-54.md'));expect(advice.handoff(o)).toMatchObject({projection:'missing',findings:[{id:'F1'}]});put('evidence/review-54.md','forged clean again');
   put('app.js','changed');expect(advice.handoff(o).scope_status).toBe('stale');delete process.env.ADVISORY_TEST_FINDINGS;const next=advice.run(o);expect(next.attempt_id).not.toBe(first.attempt_id);expect(next.findings).toHaveLength(1);expect(next.clean).toBe(false);
   const handoff=advice.handoffText(next,'Hulupeep/Specflow');expect(handoff).toContain('F1');expect(handoff).toContain('Gate C decision remains pending');
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('a historical protocol-rejected response retains its valid observed concerns without upgrading that old execution',()=>{
  const bin=simulatedHost();try{const o=options(),finding={id:'F1',severity:'p1',location:'tree/app.js:1',summary:'Concern from earlier invalid protocol',disposition:'open',tracking_issue:null,rationale:null,evidence:[{path:'tree/app.js',sha256:sha(fs.readFileSync(path.join(root,'app.js')))}]};
   put('app.js','module.exports=2;\n');finding.evidence[0].sha256=sha(fs.readFileSync(path.join(root,'app.js')));process.env.ADVISORY_TEST_FINDINGS=JSON.stringify([finding]);const first=advice.run(o);expect(first.status).toBe('completed');
   const p=advice.paths(o),pointer=JSON.parse(fs.readFileSync(p.current)),file=path.join(p.dir,pointer.attempt,'result.json'),record=JSON.parse(fs.readFileSync(file));
   // Explicit supplied historical state: retain the actual simulated native raw
   // reads/output, but reproduce the former tree-prefix validation rejection.
   record.review.execution_status='invalid';record.review.findings=[];record.review.cause='Historical tree-prefix protocol rejection';fs.writeFileSync(file,JSON.stringify(record));delete process.env.ADVISORY_TEST_FINDINGS;
   const next=advice.run(o);expect(next.status).toBe('completed');expect(next.findings[0]).toMatchObject({id:'F1',severity:'p1',disposition:'open'});expect(JSON.parse(fs.readFileSync(file)).review.execution_status).toBe('invalid');
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('re-entry never duplicates a live detached operation',()=>{
  const bin=simulatedHost();try{process.env.ADVISORY_TEST_CASE='hold';const o={...options(),waitMs:100};expect(advice.run(o).status).toBe('pending');const second=advice.run({...o,waitMs:500});expect(second.status).toBe('pending');
   const until=Date.now()+6000;while(advice.handoff(o).status==='pending'&&Date.now()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);
   expect(advice.handoff(o).status).toBe('completed');expect(fs.readFileSync(process.env.ADVISORY_TEST_COUNT,'utf8')).toBe('called\n');
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },15000);
 test('a killed worker retains custody of its live native child and later retries without overwrite',()=>{
  const bin=simulatedHost();try{process.env.ADVISORY_TEST_CASE='hold';const o={...options(),waitMs:100};advice.run(o);const p=advice.paths(o),until=Date.now()+4000;let pointer,op;
   while(Date.now()<until){try{pointer=JSON.parse(fs.readFileSync(p.current));op=JSON.parse(fs.readFileSync(path.join(p.dir,pointer.attempt,'custody.json')));if(op.invoked)break;}catch{}Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);}
   expect(op.invoked).toBe(true);process.kill(-op.owner.group,'SIGKILL');expect(advice.run({...o,waitMs:500}).status).toBe('pending');
   const deadBy=Date.now()+6000;while(advice.groupState(op.native_identity)!=='dead'&&Date.now()<deadBy)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);
   expect(advice.groupState(op.native_identity)).toBe('dead');delete process.env.ADVISORY_TEST_CASE;
   const next=advice.run({...o,waitMs:10000});expect(next.status).toBe('completed');expect(next.attempt_id).not.toBe(pointer.attempt);
   const interrupted=JSON.parse(fs.readFileSync(path.join(p.dir,pointer.attempt,'result.json')));expect(interrupted.review).toMatchObject({execution_status:'interrupted',invoked:true,gate_decision:'pending'});
   const hashBefore=sha(fs.readFileSync(p.current));Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,150);expect(sha(fs.readFileSync(p.current))).toBe(hashBefore);
   expect(fs.readFileSync(process.env.ADVISORY_TEST_COUNT,'utf8')).toBe('called\ncalled\n');
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },20000);
 test('unknown process visibility stays unknown, never death proof',()=>{
  expect(advice.groupState({boot_id:'different-boot',pid:99999999,start:'0',group:99999999})).toBe('unknown');
 });
 test.each(['codex','claude-code'])('%s actual rail and handoff retain serious findings and linked deferrals without a gate verdict',runtime=>{
  const bin=simulatedHost(runtime==='codex'?'codex':'claude');try{
   const supplied=require('../helpers/spec-density.js').fixture(root);routing.installRuntimeRouting({sourceRoot:SOURCE,targetRoot:root,runtime,interactive:false});
   const f={id:'F1',severity:'p1',location:'app.js:1',summary:'Visible concern',disposition:'deferred',tracking_issue:54,rationale:'Accepted future concern; native gates remain required',evidence:[{path:'ticket.md',sha256:sha(fs.readFileSync(path.join(root,'ticket.md')))}]};process.env.ADVISORY_TEST_FINDINGS=JSON.stringify([f]);
   const contract=path.join(root,'.specflow/runner.yaml'),ledger=path.join(root,'.specflow/runner.jsonl');const c=runner.createRunContract({loop:'feature-build',slug:'fixture',goal:'Explicit supplied-state runner fixture',input:'ticket.md',contractPath:contract,ledgerPath:ledger,tierRecord:supplied.tier_record,repoRoot:root}).run_contract;c.current_stage_or_rail='5_review';
   fs.writeFileSync(contract,yaml.dump({run_contract:c}));const opts={loop:'feature-build',slug:'fixture',contract,ledger,adapterRouting:path.join(root,'.specflow/adapter-routing.yml'),confirmModels:true,advisorySimulation:true,advisoryFixtureExecutable:fixtureExecutable};
   expect(runner.runLoop({...opts,dryRun:true})).toMatchObject({status:'dry_run',purpose:'advisory',gate_decision:'pending'});expect(fs.existsSync(process.env.ADVISORY_TEST_COUNT)).toBe(false);expect(yaml.load(fs.readFileSync(contract)).run_contract.current_stage_or_rail).toBe('5_review');
   const result=runner.runLoop(opts);expect(result.status).toBe('advisory_recorded');expect(result.entry.advisory_review).toMatchObject({status:'completed',mode:'simulated',gate_decision:'pending'});
   const saved=yaml.load(fs.readFileSync(contract)).run_contract;expect(saved.current_stage_or_rail).toBe('6_provenance');saved.current_stage_or_rail='7_ci_handoff';fs.writeFileSync(contract,yaml.dump({run_contract:saved}));
   const h=runner.runLoop(opts);expect(h.status).toBe('human_ci_handoff_required');expect(h.entry.advisory_review.findings[0].id).toBe('F1');expect(h.entry.evidence_note).toContain('#54');expect(h.entry.evidence_note).toContain('pending');
   expect(runner.readLedger(ledger).some(x=>x.event==='gate_passed'&&x.stage==='5_review')).toBe(false);
   const p=advice.paths(saved.advisory_context),pointer=JSON.parse(fs.readFileSync(p.current)),canonical=path.join(p.dir,pointer.attempt,'result.json'),bytes=fs.readFileSync(canonical);fs.writeFileSync(canonical,'corrupt canonical control');
   const corrupt=runner.runLoop(opts);expect(corrupt.entry.advisory_review).toMatchObject({status:'invalid',clean:false,findings:[{id:'F1'}]});fs.writeFileSync(canonical,bytes);
   put('app.js','changed before retry');process.env.ADVISORY_TEST_CASE='hold';expect(advice.run({...saved.advisory_context,waitMs:100}).status).toBe('pending');nativeCustody(saved.advisory_context);
   saved.current_stage_or_rail='5_review';fs.writeFileSync(contract,yaml.dump({run_contract:saved}));const pending=runner.runUntilTerminal(opts);expect(pending.status).toBe('advisory_review_pending');expect(pending.iterations).toBe(1);expect(yaml.load(fs.readFileSync(contract)).run_contract.advisory_last_result.findings[0].id).toBe('F1');
   const until=Date.now()+6000;while(advice.handoff(saved.advisory_context).status==='pending'&&Date.now()<until)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,50);expect(advice.handoff(saved.advisory_context).status).toBe('completed');
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },20000);
 test('a legacy copied project without Zod reports its advisory capability gap and preserves handoff',()=>{
  const supplied=require('../helpers/spec-density.js').fixture(root);routing.installRuntimeRouting({sourceRoot:SOURCE,targetRoot:root,runtime:'codex',interactive:false});
  const recipe=fs.readFileSync(path.join(SOURCE,'setup-project.sh'),'utf8').split('\n').find(l=>l.includes('case "$(basename "$script")"'));
  const excluded=new Set(recipe.match(/ in (.*?)\) continue/)[1].split('|'));
  fs.cpSync(path.join(SOURCE,'scripts'),path.join(root,'scripts'),{recursive:true,filter:p=>fs.statSync(p).isDirectory()||p.endsWith('.cjs')&&!excluded.has(path.basename(p))});
  fs.mkdirSync(path.join(root,'node_modules'),{recursive:true});fs.symlinkSync(path.join(SOURCE,'node_modules/js-yaml'),path.join(root,'node_modules/js-yaml'));
  fs.mkdirSync(path.join(root,'QA/loops'),{recursive:true});for(const loop of ['feature-build','spec-build'])fs.copyFileSync(path.join(SOURCE,'templates/loops',loop+'.yaml'),path.join(root,'QA/loops',loop+'.yaml'));
  const contract=path.join(root,'.specflow/copied.yaml'),ledger=path.join(root,'.specflow/copied.jsonl');const c=runner.createRunContract({loop:'feature-build',slug:'copied',goal:'Supplied-state legacy capability negative',input:'ticket.md',contractPath:contract,ledgerPath:ledger,tierRecord:supplied.tier_record,repoRoot:root}).run_contract;c.current_stage_or_rail='5_review';fs.writeFileSync(contract,yaml.dump({run_contract:c}));
  const code=`const fs=require('fs'),yaml=require('js-yaml'),r=require('./scripts/specflow-runner.cjs');const options=${JSON.stringify({loop:'feature-build',slug:'copied',contract,ledger,adapterRouting:path.join(root,'.specflow/adapter-routing.yml'),confirmModels:true})};const a=r.runLoop(options);if(a.status!=='advisory_recorded'||a.entry.advisory_review.status!=='unavailable')throw Error(JSON.stringify(a));const c=yaml.load(fs.readFileSync(options.contract)).run_contract;c.current_stage_or_rail='7_ci_handoff';fs.writeFileSync(options.contract,yaml.dump({run_contract:c}));const h=r.runLoop(options);if(h.status!=='human_ci_handoff_required'||h.entry.advisory_review.status!=='unavailable')throw Error(JSON.stringify(h));console.log(JSON.stringify({simulated:true,gap:a.entry.advisory_review.cause,handoff:h.status}));`;
  const result=cp.spawnSync(process.execPath,['-e',code],{cwd:root,env:{...process.env},encoding:'utf8',timeout:10000});if(result.status!==0)throw Error(result.stderr+result.stdout);const data=JSON.parse(result.stdout);expect(data.gap).toMatch(/zod/);expect(data.handoff).toBe('human_ci_handoff_required');
  // Install the exact declared library bytes and run the copied rail itself;
  // the model remains an explicitly pinned simulated native event fixture.
  const bin=simulatedHost();try{fs.symlinkSync(path.join(SOURCE,'node_modules/zod'),path.join(root,'node_modules/zod'));
   const opts={loop:'feature-build',slug:'copied',contract,ledger,adapterRouting:path.join(root,'.specflow/adapter-routing.yml'),confirmModels:true,advisorySimulation:true,advisoryFixtureExecutable:fixtureExecutable};
   const positive=`const fs=require('fs'),yaml=require('js-yaml'),r=require('./scripts/specflow-runner.cjs'),o=${JSON.stringify(opts)};const c=yaml.load(fs.readFileSync(o.contract)).run_contract;c.current_stage_or_rail='5_review';fs.writeFileSync(o.contract,yaml.dump({run_contract:c}));const a=r.runLoop(o);if(a.status!=='advisory_recorded'||a.entry.advisory_review.status!=='completed'||a.entry.advisory_review.mode!=='simulated')throw Error(JSON.stringify(a));console.log(JSON.stringify({copiedRail:true,simulated:true,mode:a.entry.advisory_review.mode}));`;
   const actual=cp.spawnSync(process.execPath,['-e',positive],{cwd:root,env:{...process.env},encoding:'utf8',timeout:15000});if(actual.status!==0)throw Error(actual.stderr+actual.stdout);expect(JSON.parse(actual.stdout)).toMatchObject({copiedRail:true,simulated:true});
  }finally{fs.rmSync(bin,{recursive:true,force:true});}
 },25000);
});
describe('J-FEATURE-REVIEW-FINDINGS / RECOVERY: canonical concerns survive omissions',()=>{
 const finding={id:'F1',severity:'critical',location:'app.js:1',summary:'A real concern',disposition:'open',tracking_issue:null,rationale:null,evidence:[]};
 test('omission cannot erase a concern, nor can a retry downgrade it',()=>{
  expect(advice.mergeFindings([finding],[])).toEqual([finding]);
  expect(()=>advice.mergeFindings([finding],[{...finding,severity:'note'}])).toThrow(/downgrade/i);
 });
 test('reported-fixed serious concerns require rationale and actual evidence and remain visible',()=>{
  expect(()=>advice.mergeFindings([finding],[{...finding,disposition:'fixed'}])).toThrow(/evidence|rationale/i);
  const fixed={...finding,disposition:'fixed',rationale:'Changed the path; required native gates remain separate.',evidence:[{path:'app.js',sha256:sha('change')}]};
  expect(advice.mergeFindings([finding],[fixed])).toEqual([fixed]);
 });
 test('missing earlier review is not reviewed, with no invented completion or merge verdict',()=>{
  const h=advice.handoff(options());expect(h.status).toBe('not_reviewed');expect(h.gate_decision).toBe('pending');expect(h.clean).toBe(false);
 });
});
