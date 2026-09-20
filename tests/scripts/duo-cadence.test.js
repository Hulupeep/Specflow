const directionFixture = require('../helpers/duo-direction.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const duo = require('../../scripts/duo-build.cjs');
const cadence = require('../../scripts/duo-cadence.cjs');
let root, run;
const put = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
const input = { session_id: 'claude-session', stop_hook_active: false };
const batch = () => ({ id: 'batch', scope: 'CLI diagnosis', criteria: ['AC-1'], claims: ['observed result'], assumptions: [], evidence: ['.specflow/duo/raw.txt'], resolutions: [] });
function peer(outcome = 'accepted') {
  // Only provider responses are simulated; capture, snapshot, ledger and hook are real.
  return (exe, args, options) => {
    if (args[0] === '--version') return 'fixture';
    if (args[0] === 'auth') return '{"loggedIn":true}';
    if (args[0] === 'login') return 'Logged in using ChatGPT';
    const req = JSON.parse(fs.readFileSync(path.join(options.cwd, 'request.json')));
    const result = { outcome, summary: outcome === 'blocked' ? 'Owner browser unavailable; diagnosis inspected' : outcome,
      inspected: req.requiredReads, index_complete: true, unrelated: [], diagnostics: [], resolutions: [],
      findings: outcome === 'changes_required' ? [{id:'F1',criterion:'AC-1',kind:'acceptance',basis:'AC-1',evidence:'raw.txt',action:'Fix the result',verification:'Run result check'}] : [],
      assessments: [{id:'AC-1',status:outcome === 'accepted' ? 'verified' : 'blocked',evidence:req.batch.evidence,reason:'fixture raw inspection'}] };
    directionFixture.feedback(req, result);
    if (outcome === 'blocked') Object.assign(result.direction.next_steps[0], {action:'Owner browser: provide access for the required check',done_when:'Owner browser access is available'});
    if (exe === 'codex') fs.writeFileSync(path.join(options.cwd, 'response.json'), JSON.stringify(result));
    return JSON.stringify({structured_output:result});
  };
}
const review = (outcome = 'accepted', invoke = peer(outcome), data = batch()) => duo.review(root, run.id, directionFixture.respond(duo.load(root, run.id).state, data), invoke, run.owner.session);
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'duo-cadence-'));
  git('init'); git('config','user.email','test@example.test'); git('config','user.name','Test');
  put('goal.md','Correct observable output'); put('task.md','AC-1: correct output'); put('code.js','result = 1');
  put('.specflow/duo/raw.txt','observed 1'); git('add','goal.md','task.md','code.js'); git('commit','-m','fixture');
  run = duo.start(root,'#1','claude-code',{goal:'goal.md',task:'task.md',objective:'Correct output',finish:'AC-1 verified',criteria:[{id:'AC-1',source:'task.md',anchor:'AC-1: correct output',kind:'acceptance'}]},input.session_id);
});
afterEach(() => { delete process.env.SPECFLOW_DUO_REVIEWER; fs.rmSync(root,{recursive:true,force:true}); });
test('J-DUO-CADENCE AC-1/AC-2: unreviewed turn continues once; second refusal stops explicitly blocked', () => {
  expect(cadence.stop(root,input)).toMatchObject({decision:'block',reason:expect.stringContaining('review')});
  expect(cadence.stop(root,{...input,stop_hook_active:true})).toMatchObject({continue:false,stopReason:expect.stringContaining('unreviewed')});
  expect(duo.load(root,run.id).state.history).toHaveLength(0);
});
test('AC-1: reviewed unchanged source stops; changed source or ignored raw evidence needs review', () => {
  review(); expect(cadence.stop(root,input)).toEqual({});
  put('.specflow/duo/raw.txt','observed 2'); expect(cadence.assess(root,run.id).status).toBe('review_required');
  put('.specflow/duo/raw.txt','observed 1'); expect(cadence.assess(root,run.id).status).toBe('reviewed');
  put('code.js','result = 2'); expect(cadence.stop(root,input).decision).toBe('block');
});
test('AC-1: verification-only new capture requires review even without product changes', () => {
  review(); duo.capture(root,run.id,run.owner.session,[process.execPath,'-e','console.log(42)']);
  expect(cadence.assess(root,run.id).status).toBe('review_required');
});
test('AC-2: legitimate blocked feedback permits honest stop; actionable findings continue', () => {
  review('blocked'); expect(cadence.stop(root,input)).toMatchObject({continue:false,stopReason:expect.stringContaining('Owner browser')});
});
test('AC-2: corrections are requested immediately', () => {
  review('changes_required'); expect(cadence.stop(root,input).reason).toContain('Verify the fixture output');
});
test('AC-2: missing peer stops as unavailable, missing raw evidence requests correction', () => {
  review('blocked',peer(),{...batch(),evidence:[]});
  expect(cadence.stop(root,input).decision).toBe('block');
  review('blocked',()=>{throw Error('CLI unavailable');});
  expect(cadence.stop(root,input)).toMatchObject({continue:false,stopReason:expect.stringContaining('CLI unavailable')});
});
test('AC-3: other conversations, hosts and recursive reviewers are unaffected', () => {
  expect(cadence.stop(root,{...input,session_id:'other'})).toEqual({});
  process.env.SPECFLOW_DUO_REVIEWER='1'; expect(cadence.stop(root,input)).toEqual({}); delete process.env.SPECFLOW_DUO_REVIEWER;
  duo.resume(root,run.id,'codex',{takeover:true,reason:'User changed hosts'});
  expect(cadence.stop(root,input)).toEqual({});
});
test('AC-3: archived completed runs do not intercept later work in the same conversation', () => {
  review(); duo.finish(root,run.id,run.owner.session); put('code.js','next task');
  expect(cadence.stop(root,input)).toEqual({});
});
test('AC-3: corrupt unrelated run state cannot stop non-duo conversations', () => {
  put('.specflow/duo/broken/run.json','{');put('.specflow/duo/null/run.json','null');
  expect(cadence.stop(root,{...input,session_id:'unrelated'})).toEqual({});
  expect(cadence.stop(root,input).decision).toBe('block');
});
test('AC-3: an unexpanded host-session placeholder cannot silently disable binding', () => {
  expect(()=>duo.resume(root,run.id,'claude-code',{session:run.owner.session,hostSession:'${CLAUDE_SESSION_ID}'})).toThrow(/expanded/);
  expect(duo.load(root,run.id).state.owner.hostSession).toBe(input.session_id);
});
test('AC-3: operation lock and changed pins block without mutation', () => {
  const stateFile=path.join(root,'.specflow/duo',run.id,'run.json'), before=fs.readFileSync(stateFile,'utf8');
  put(`.specflow/duo/${run.id}/review.lock`,String(process.pid));
  expect(cadence.stop(root,input).stopReason).toContain('operation is active');
  fs.unlinkSync(path.join(root,'.specflow/duo',run.id,'review.lock')); put('task.md','weakened');
  expect(cadence.stop(root,input).stopReason).toContain('Pinned acceptance');
  expect(fs.readFileSync(stateFile,'utf8')).toBe(before);
});
test('AC-4: generated audit distinguishes calls and validation, without owner token or source drift', () => {
  put('audit.md','Owner-maintained root log'); const before=duo.fingerprint(root,[]);
  review('blocked',peer(),{...batch(),evidence:[]}); review();
  const audit=fs.readFileSync(path.join(root,'.specflow/duo',run.id,'audit.md'),'utf8');
  expect(audit).toContain('preflight only; peer not invoked'); expect(audit).toContain('codex invoked');
  expect(audit).toContain('Validated feedback: yes'); expect(audit).toContain('AC-1: verified');
  expect(audit).not.toContain(run.owner.session); expect(fs.readFileSync(path.join(root,'audit.md'),'utf8')).toBe('Owner-maintained root log');
  expect(duo.fingerprint(root,[])).toBe(before);
});
test('AC-2: exhausted repair limit remains blocked despite changes', () => {
  const file=path.join(root,'.specflow/duo',run.id,'run.json'), state=JSON.parse(fs.readFileSync(file));
  state.repairCycle={attempts:4}; fs.writeFileSync(file,JSON.stringify(state)); put('code.js','changed');
  expect(cadence.stop(root,input).stopReason).toContain('limit reached');
});
test.each(['codex','claude-code'])('J-DUO-GITHUB AC-5: %s peer gets GitHub context and authenticated read configuration', builder => {
  git('remote','add','origin','https://github.com/owner/repository.git');
  run=duo.resume(root,run.id,builder,{takeover:true,reason:'test host'});
  const invoke=jest.fn(peer()); const result=review('accepted',invoke);
  expect(result.outcome).toBe('accepted');
  expect(invoke.mock.calls).toContainEqual(['gh',['auth','status','--hostname','github.com'],{combineOutput:true}]);
  const round=path.join(root,'.specflow/duo',run.id,'round-001');
  expect(JSON.parse(fs.readFileSync(path.join(round,'request.json'))).github).toEqual({repository:'owner/repository',head:git('rev-parse','HEAD').toString().trim()});
  const spec=JSON.parse(fs.readFileSync(path.join(round,'invocation.json')));
  expect(spec.env.XDG_CACHE_HOME).toBe(path.join(round,'gh-cache'));
  expect(fs.existsSync(path.join(spec.env.XDG_CACHE_HOME,'gh'))).toBe(true);
  const call=invoke.mock.calls.find(([,args])=>args[0]=== (builder==='codex'?'-p':'exec'));
  expect(call[2].env.XDG_CACHE_HOME).toBe(spec.env.XDG_CACHE_HOME);
  if(builder==='claude-code') {expect(spec.args).toContain('permissions.duo-review.network.enabled=true');expect(spec.args).toContain('permissions.duo-review.extends=":read-only"');expect(spec.args).toContain(`permissions.duo-review.filesystem={${JSON.stringify(spec.env.XDG_CACHE_HOME)}="write"}`);expect(spec.args).not.toContain('--sandbox');}
  else {expect(spec.args).toContain('Read,Glob,Grep,Bash');expect(spec.args.join(' ')).toContain('Bash(gh run view *)');expect(spec.args.join(' ')).toContain('Bash(gh pr list *)');expect(spec.args.join(' ')).not.toContain('Bash(gh api');}
  expect(fs.readFileSync(path.join(round,'prompt.txt'),'utf8')).toContain('remote mutations are forbidden');
});
test('AC-5: failed gh authentication blocks before reviewer invocation', () => {
  git('remote','add','origin','git@github.com:owner/repository.git');
  const invoke=jest.fn((exe,args,options)=>{if(exe==='gh' && args[0]==='auth')throw Error('gh not authenticated');return peer()(exe,args,options);});
  const result=review('blocked',invoke); expect(result.blocker).toContain('gh not authenticated');
  expect(result.history[0].attempted).toBeUndefined(); expect(cadence.stop(root,input).stopReason).toContain('gh not authenticated');
});
test('AC-3: installer preserves existing Stop hooks and does not duplicate on reinstall', () => {
  put('.claude/settings.json',JSON.stringify({hooks:{Stop:[{hooks:[{type:'command',command:'existing-stop'}]}]}}));
  const installer=path.resolve(__dirname,'../../install-hooks.sh');
  for(let i=0;i<2;i++) execFileSync('bash',[installer,root,'--runtime','claude-code'],{stdio:'pipe'});
  const hooks=JSON.parse(fs.readFileSync(path.join(root,'.claude/settings.json'))).hooks.Stop;
  expect(hooks).toHaveLength(2); expect(hooks.some(h=>h.hooks[0].command==='existing-stop')).toBe(true);
  const output=execFileSync('bash',[path.join(root,'.claude/hooks/duo-review-check.sh')],{cwd:root,env:{...process.env,CLAUDE_PROJECT_DIR:root},input:JSON.stringify(input),encoding:'utf8'});
  expect(JSON.parse(output).decision).toBe('block');
});
test('AC-3: partial install blocks only its active bound duo conversation', () => {
  const hook=path.resolve(__dirname,'../../hooks/duo-review-check.sh');
  const invoke=data=>execFileSync('bash',[hook],{cwd:root,env:{...process.env,CLAUDE_PROJECT_DIR:root},input:JSON.stringify(data),encoding:'utf8'});
  expect(invoke({...input,session_id:'unrelated'})).toBe('');
  expect(JSON.parse(invoke(input)).stopReason).toContain('helper is missing');
  duo.resume(root,run.id,'codex',{takeover:true,reason:'test host transfer'});
  expect(invoke(input)).toBe('');
});
