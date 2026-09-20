const fs = require('fs'), os = require('os'), path = require('path');
const { execFileSync } = require('child_process');
const duo = require('../../scripts/duo-build.cjs');
const direction = require('../../scripts/duo-direction.cjs');
const cadence = require('../../scripts/duo-cadence.cjs');
let root, run;
const put = (p, v) => { p = path.join(root, p); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, typeof v === 'string' ? v : JSON.stringify(v)); };
const load = () => duo.load(root, run.id).state;
const batch = extra => ({ id:'display', scope:'Correct displayed total, with owner consent separate', criteria:['AC-DISPLAY','LIVE-GATE'], claims:['Component check passes; visible result not yet proven'], assumptions:[], evidence:['.specflow/duo/raw.txt'], resolutions:[], ...extra });
const step = (owner='builder', criterion='AC-DISPLAY') => ({owner, criterion, action: owner === 'builder' ? 'Correct the displayed total and assert its visible value' : 'Complete real owner consent', done_when: owner === 'builder' ? 'The executed display command reports 42' : 'Real connected account observed'});
const response = () => ({round:load().continuation.round,steps:load().continuation.direction.next_steps.map((s,i)=>({step:i+1,disposition:s.owner==='builder'?'done':'deferred',reason:s.owner==='builder'?'Corrected visible output; raw command result submitted':'Owner consent unavailable; gate preserved'}))});
function peer(edit = () => {}) {
  // Native process adapters are mocked here; filesystem, git, ledger and Stop are real.
  return (exe,args,opts) => {
    if(args[0]==='--version') return 'simulated-adapter';
    if(args[0]==='auth') return '{"loggedIn":true}';
    if(args[0]==='login') return 'Logged in using ChatGPT';
    const req=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));
    const result={outcome:'blocked',summary:'Visible result needs correction; owner consent remains unavailable',inspected:req.requiredReads,index_complete:true,
      findings:[{id:'DISPLAY',criterion:'AC-DISPLAY',kind:'acceptance',basis:'Wrong customer-visible result',evidence:req.batch.evidence[0],action:'Correct the visible result',verification:'Execute and assert visible 42'}], unrelated:['Reorganizing the fixture is optional'], diagnostics:[],
      assessments:req.batch.criteria.map(id=>({id,status:'blocked',evidence:req.batch.evidence,reason:'Visible output and owner gate are not proven'})),
      resolutions:req.open_findings.map(f=>({id:f.id,status:'open',evidence:req.batch.evidence,reason:'Still unresolved'})),
      direction:{assessment:'redirect',goal_connection:'Component tests miss what the customer actually sees; fix that before broader work',next_steps:[step('user','LIVE-GATE'),step()],preserve:['Keep consent blocked; preserve completed component checks']}};
    edit(result,req,opts);
    if(exe==='codex') put(path.relative(root,path.join(opts.cwd,'response.json')),result);
    return JSON.stringify({structured_output:result});
  };
}
const review=(data=batch(),provider=peer())=>duo.review(root,run.id,data,provider,run.owner.session);
beforeEach(()=>{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'duo-direction-'));
  for(const args of [['init'],['config','user.name','Fixture'],['config','user.email','fixture@example.test']]) execFileSync('git',args,{cwd:root,stdio:'pipe'});
  put('goal.md','Customer sees correct result and can connect their own account');put('task.md','AC-DISPLAY: visible value is 42\nLIVE-GATE: real owner consent');put('display.cjs','console.log(41)');put('.specflow/duo/raw.txt','observed 41, component tests green, owner consent unavailable');
  execFileSync('git',['add','goal.md','task.md','display.cjs'],{cwd:root});execFileSync('git',['commit','-m','fixture'],{cwd:root,stdio:'pipe'});
  run=duo.start(root,'#147','claude-code',{goal:'goal.md',task:'task.md',objective:'Correct customer-visible result',finish:'Visible output and real consent proven',criteria:[{id:'AC-DISPLAY',source:'task.md',anchor:'AC-DISPLAY: visible value is 42',kind:'acceptance'},{id:'LIVE-GATE',source:'task.md',anchor:'LIVE-GATE: real owner consent',kind:'gate'}]},'direction-session');
});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
test.each(['claude-code','codex'])('J-DUO-DIRECTION: %s receives immediate useful continuation despite owner dependency',builder=>{
  run=duo.resume(root,run.id,builder,{takeover:true,reason:'Test host selection',hostSession:builder==='claude-code'?'direction-session':undefined});
  const result=review(); expect(result.history.at(-1).stage).toBe('validated');
  expect(result.next).toContain('builder: Correct the displayed');
  expect(cadence.assess(root,run.id)).toMatchObject({status:'continue_required'});
  if(builder==='claude-code') expect(cadence.stop(root,{session_id:'direction-session'}).decision).toBe('block');
  const round=path.join(root,'.specflow/duo',run.id,'round-001');
  expect(JSON.parse(fs.readFileSync(path.join(round,'invocation.json'))).exe).toBe(builder==='claude-code'?'codex':'claude');
  expect(fs.readFileSync(path.join(round,'prompt.txt'),'utf8')).toContain('goal-focused technical partner');
  expect(direction.render(result)).toContain('Real connected account observed');
});
test('J-DUO-RESUME-DIRECTION: builder responds, reviewer sees decision memory, owner-only handoff stops honestly',()=>{
  review();const old=run.owner.session;run=duo.resume(root,run.id,'codex',{takeover:true,reason:'User changed host'});
  expect(run.owner.session).not.toBe(old);expect(direction.render(run)).toContain('Component tests miss');
  put('display.cjs','console.log(42)');put('.specflow/duo/raw.txt',execFileSync(process.execPath,['display.cjs'],{cwd:root,encoding:'utf8'}));
  const corrected=batch({direction_response:response(),resolutions:[{id:'DISPLAY',change:'Corrected visible value',evidence:['.specflow/duo/raw.txt']}]});
  const result=review(corrected,peer((r,req)=>{
    expect(req.direction_memory[0].direction.goal_connection).toContain('customer');expect(req.batch.direction_response.steps[1].disposition).toBe('done');
    r.findings=[];r.resolutions[0].status='closed';r.assessments[0].status='verified';r.summary='Displayed 42 proven; owner consent still needed';r.direction={assessment:'blocked',goal_connection:'Customer-visible value corrected; only owner action remains',next_steps:[step('user','LIVE-GATE')],preserve:['Consent remains unverified']};
  }));
  expect(result.progress.findings_closed).toBe(1);expect(result.criteria['AC-DISPLAY'].status).toBe('verified');expect(result.criteria['LIVE-GATE'].status).toBe('blocked');
  expect(cadence.assess(root,run.id).status).toBe('blocked');expect(()=>duo.finish(root,run.id,run.owner.session)).toThrow(/incomplete/);
});
test('AC-CONTINUITY: absent or mismatched responses fail before any provider call',()=>{
  review();const invoke=jest.fn(peer());
  expect(review(batch(),invoke).blocker).toContain('Respond to every next step');expect(invoke).not.toHaveBeenCalled();
  const bad=response();bad.steps[1].step=1;
  expect(review(batch({direction_response:bad}),invoke).blocker).toContain('unique step');expect(invoke).not.toHaveBeenCalled();
});
test.each(['missing','unknown criterion','false completion','empty steps','blocked with builder'])('AC-DIRECTION: invalid %s cannot change acceptance or deliver direction',kind=>{
  const result=review(batch(),peer(r=>{
    if(kind==='missing') delete r.direction;
    if(kind==='unknown criterion') r.direction.next_steps[0].criterion='UNKNOWN-GATE';
    if(kind==='false completion') {r.direction.assessment='complete';r.direction.next_steps=[];}
    if(kind==='empty steps') r.direction.next_steps=[];
    if(kind==='blocked with builder') r.direction.assessment='blocked';
  }));
  expect(result.history[0].stage).toBe('peer_review');expect(result.continuation).toBeUndefined();expect(result.criteria['AC-DISPLAY'].status).toBe('unverified');expect(result.batchAttempts.display).toBeUndefined();expect(result.peerFailures).toBe(1);
});
test('J-DUO-PROTOCOL: invalid responses have a separate bounded budget, preserve prior direction and cannot reset repair attempts',()=>{
  review();const before=load().continuation, attempts=load().repairCycle.attempts;
  for(let i=0;i<3;i++) {put('.specflow/duo/raw.txt',`new capture ${i}`);review(batch({direction_response:response()}),peer(r=>{delete r.direction;}));}
  const state=load();expect(state.peerFailures).toBe(3);expect(state.repairCycle.attempts).toBe(attempts);expect(state.continuation).toEqual(before);expect(state.findings.DISPLAY.status).toBe('open');
  expect(direction.render(state)).toContain('Historical direction');
  const invoke=jest.fn(peer());expect(review(batch({direction_response:response()}),invoke).blocker).toContain('failure limit');expect(invoke).not.toHaveBeenCalled();
  run=duo.resume(root,run.id,'codex',{takeover:true,reason:'Host transfer cannot reset limits'});expect(run.peerFailures).toBe(3);
});
test('AC-FRESHNESS: excluded continuation/audit do not invalidate source; root log and product changes do',()=>{
  const before=duo.fingerprint(root,[]);review();expect(duo.fingerprint(root,[])).toBe(before);
  put(`.specflow/duo/${run.id}/builder-notes.md`,'Reasoning response is metadata');expect(duo.fingerprint(root,[])).toBe(before);
  put('audit.md','Root source remains included');expect(duo.fingerprint(root,[])).not.toBe(before);expect(direction.render(duo.inspect(root,run.id))).toContain('Historical direction');
});
test('AC-CADENCE: accepted partial batch still requires continuation; fully proven goal can finish',()=>{
  let result=review(batch({criteria:['AC-DISPLAY']}),peer(r=>{r.outcome='accepted';r.findings=[];r.assessments[0].status='verified';r.direction.assessment='on_track';r.direction.next_steps=[{...step('builder','LIVE-GATE'),action:'Inspect available owner consent evidence',done_when:'Real consent evidence validated or precise dependency identified'}];}));
  expect(result.outcome).toBe('accepted');expect(cadence.assess(root,run.id).status).toBe('continue_required');
  result=review(batch({id:'finish',direction_response:response()}),peer(r=>{r.outcome='accepted';r.findings=[];for(const a of r.assessments)a.status='verified';r.direction={assessment:'complete',goal_connection:'Synthetic adapter certifies all fixture rows',next_steps:[],preserve:[]};}));
  expect(result.outcome).toBe('accepted');expect(duo.finish(root,run.id,run.owner.session).goalStatus).toBe('complete');
});
