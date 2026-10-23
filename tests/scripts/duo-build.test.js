const directionFixture = require('../helpers/duo-direction.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const duo = require('../../scripts/duo-build.cjs');
let root;
const put = (name, value) => { const file = path.join(root, name); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, value); };
const git = (...args) => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
const context = { workKind: 'preparation', goal: 'goal.md', task: 'task.md', objective: 'Deliver correct answer', finish: 'AC-1 tested and accepted', criteria: [{id: 'AC-1', source: 'task.md', anchor: 'AC-1: returns 42', kind: 'acceptance'}] };
const reviewOwned = (root, id, batch, invoke) => duo.review(root, id, directionFixture.respond(duo.load(root, id).state, batch), invoke, duo.load(root, id).state.owner.session);
const batch = () => ({ id: 'implementation', scope: 'AC-1', criteria: ['AC-1'], claims: ['locally tested'], assumptions: [], evidence: ['raw.txt'], resolutions: [] });
function fakePeer(outcome = 'accepted', effect = () => {}) {
  return (exe, args, options) => {
    if (args[0] === '--version') return 'test-double';
    if (args[0] === 'auth') return '{"loggedIn":true}';
    if (args[0] === 'login') return 'Logged in using ChatGPT';
    const request = JSON.parse(fs.readFileSync(path.join(options.cwd, 'request.json')));
    // Provider boundary is simulated; state, snapshot and git operations are real.
    const result = { outcome, summary: outcome, inspected: request.requiredReads, findings: outcome === 'changes_required' ? [{ id: 'F1', criterion: 'AC-1', kind: 'acceptance', basis: 'AC-1', evidence: 'tree/code.js:1', action: 'Correct result', verification: 'Check the result equals 42' }] : [], unrelated: [] };
    if(request.specification_review)result.specification_nonblocking=[];
    if (request.specification_review) result.specification_findings = result.findings.map(f => ({ id: f.id, severity: 'SERIOUS', origin: 'original', repair_evidence: null }));
    Object.assign(result, { index_complete: true, assessments: request.batch.criteria.map(id => ({id, status: outcome === 'accepted' ? 'verified' : 'blocked', evidence: request.batch.evidence, reason: 'inspected fixture'})), resolutions: request.open_findings.map(f => ({id: f.id, status: outcome === 'accepted' ? 'closed' : 'open', evidence: request.batch.evidence, reason: 'fixture disposition'})), diagnostics: [{observation: fs.readFileSync(path.join(options.cwd, 'tree/raw.txt'), 'utf8'), evidence: request.batch.evidence}] });
    directionFixture.feedback(request, result);
    effect(options, result);
    if (exe === 'codex') fs.writeFileSync(path.join(options.cwd, 'response.json'), JSON.stringify(result));
    return directionFixture.transport(result, exe, options.cwd);
  };
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'duo-test-'));
  git('init'); git('config', 'user.email', 'test@example.test'); git('config', 'user.name', 'Test');
  put('goal.md', 'Correct observable results'); put('task.md', 'AC-1: returns 42'); put('code.js', 'module.exports = 41;'); put('raw.txt', 'command: node code.js; exit: 0; observed 41; expected 42');
  git('add', '.'); git('commit', '-m', 'fixture');
});
afterEach(() => { delete process.env.SPECFLOW_DUO_REVIEWER; fs.rmSync(root, { recursive: true, force: true }); });
test('new production Duo starts and stale resumes require actual current readiness state', () => {
  const { workKind, ...legacy } = context;
  expect(() => duo.start(root, '#1', 'codex', legacy)).toThrow('Specification gate');
  const fields = require('../helpers/spec-density').fixture(root);
  const record = JSON.parse(fs.readFileSync(fields.tier_record));
  record.issue.body = fs.readFileSync(path.join(root, 'task.md'), 'utf8');
  require('../helpers/spec-density').seedState(root,record);
  fs.writeFileSync(fields.tier_record, JSON.stringify(record));
  const run = duo.start(root, '#1', 'codex', { ...context, workKind: 'implementation', specification: { record: 'tier-record.json' } });
  fs.writeFileSync(path.join(root, 'tier-preflight'), 'changed');
  expect(() => duo.resume(root, run.id, 'codex', { session: run.owner.session })).toThrow('changed evidence');
  expect(() => duo.capture(root, run.id, run.owner.session, ['node', '-e', 'process.exit(0)'])).toThrow('changed evidence');
  expect(() => duo.finish(root, run.id, run.owner.session)).toThrow('changed evidence');
});
test('native Duo review path consumes the shared tier budget before invoking a peer', () => {
  const record = { issue: { number: 165, body: 'AC-1: returns 42', labels: ['spec:contracted'] }, profile: { ui: false, materialSeams: [] } };
  put('tier.json', JSON.stringify(record));
  const scoped = { ...context, specification: { record: 'tier.json', targetTier: 'contracted' } };
  const run = duo.start(root, '#165', 'codex', scoped);
  expect(reviewOwned(root, run.id, batch(), fakePeer('changes_required')).outcome).toBe('changes_required');
  record.profile.repair = 'new evidence'; put('tier.json', JSON.stringify(record)); put('raw.txt', 'Second capture: still wrong, now 43');
  duo.resume(root, run.id, 'claude-code', { takeover: true, reason: 'Fixture host switch' });
  expect(reviewOwned(root, run.id, batch(), fakePeer('changes_required')).outcome).toBe('changes_required');
  // Changing both run and batch names does not replenish the issue/tier budget.
  const renamed = duo.start(root, '#165 renamed run', 'codex', scoped), invoke = jest.fn(fakePeer());
  const result = reviewOwned(root, renamed.id, { ...batch(), id: 'another-name' }, invoke);
  expect(result.outcome).toBe('blocked'); expect(result.blocker).toContain('No new evidence-backed progress');
  expect(invoke.mock.calls.some(([, , opts]) => opts?.input)).toBe(false);
  const rounds = require('../../scripts/specflow-reviews.cjs').load(root, 165).reviews.contracted;
  expect(rounds).toHaveLength(2); expect(rounds.every(r => r.identity.mode === 'simulated')).toBe(true);
});
test('preparation can correct two rejected peer protocols and then obtain a scoped review', () => {
  const record = { issue: { number: 189, body: 'AC-1: returns 42', labels: ['spec:contracted'] }, profile: { ui: false, materialSeams: [] } };
  put('tier.json', JSON.stringify(record));
  const run = duo.start(root, '#189', 'codex', { ...context, specification: { record: 'tier.json', targetTier: 'contracted' } });
  const badEvidence = fakePeer('accepted', (opts, result) => { result.assessments[0].evidence = ['code.js']; });
  const badPromotion = fakePeer('accepted', (opts, result) => {
    result.direction = { assessment: 'on_track', goal_connection: 'Preparation accepted', preserve: [], next_steps: [{ criterion: 'AC-1', owner: 'builder', action: 'Run specification promote', done_when: 'Tier promoted' }] };
  });
  expect(reviewOwned(root, run.id, batch(), badEvidence).outcome).toBe('blocked');
  expect(reviewOwned(root, run.id, batch(), badPromotion).outcome).toBe('blocked');
  const accepted = reviewOwned(root, run.id, batch(), fakePeer());
  expect(accepted.outcome).toBe('accepted');
  expect(accepted.history.map(r => r.stage)).toEqual(['peer_review', 'peer_review', 'validated']);
  const reviews = require('../../scripts/specflow-reviews.cjs');
  expect(reviews.status(root, record, 'contracted')).toMatchObject({ attempts: 1, protocolFailures: 0, passed: false });
  expect(fs.readFileSync(path.join(root, '.specflow/duo', run.id, 'round-003/prompt.txt'), 'utf8')).toContain('Promotion is a subsequent builder action');
});
test('#228: scoped P2 evidence uses submitted batch paths and a rejected response retains the retry', () => {
  const record = { issue: { number: 228, body: 'AC-1: returns 42', labels: ['spec:contracted'] }, profile: { ui: false, materialSeams: [] } };
  put('tier.json', JSON.stringify(record));
  const run = duo.start(root, '#228', 'codex', { ...context, specification: { record: 'tier.json', targetTier: 'contracted' } });
  const warning = evidence => ({ id: 'P2-NAME', kind: 'P2', basis: 'Future filename is generated', action: 'Record it in feature-build', impact: 'future', evidence, nonimpact: 'The contract semantics are fixed', owner_issue: '#228', trigger: 'Migration creation' });
  const invalid = reviewOwned(root, run.id, batch(), fakePeer('accepted', (_, result) => {
    result.specification_nonblocking = [warning(['task.md'])];
  }));
  expect(invalid.outcome).toBe('blocked');
  expect(require('../../scripts/specflow-reviews.cjs').status(root, record, 'contracted')).toMatchObject({ attempts: 0, protocolFailures: 1, passed: false });

  const valid = reviewOwned(root, run.id, batch(), fakePeer('accepted', (_, result) => {
    result.specification_nonblocking = [warning(['raw.txt'])];
  }));
  expect(valid.outcome).toBe('accepted');
  const reviews = require('../../scripts/specflow-reviews.cjs');
  expect(reviews.status(root, record, 'contracted')).toMatchObject({ attempts: 1, protocolFailures: 0 });
  expect(reviews.load(root, 228).reviews.contracted).toHaveLength(2);
  const round = path.join(root, '.specflow/duo', run.id, 'round-002');
  const schema = JSON.parse(fs.readFileSync(path.join(round, 'schema.json'), 'utf8'));
  expect(schema.properties.specification_nonblocking.items.properties.evidence.items.enum).toEqual(['raw.txt']);
  expect(fs.readFileSync(path.join(round, 'prompt.txt'), 'utf8')).toContain('specification_nonblocking evidence must use exact paths from batch.evidence');
});
test.each(['codex', 'claude-code'])('J-DUO-REPAIR/J-DUO-RESUME: %s builder repairs and retains evidence', builder => {
  const run = duo.start(root, '#1', builder, context);
  const first = reviewOwned(root, run.id, batch(), fakePeer('changes_required'));
  expect(first.outcome).toBe('changes_required');
  put('code.js', 'module.exports = 42;'); put('raw.txt', 'command: node code.js; exit: 0; executed 1 passed 1 skipped 0; observed 42');
  const second = reviewOwned(root, run.id, { ...batch(), resolutions: [{id: 'F1', change: 'corrected output', evidence: ['raw.txt']}] }, fakePeer());
  expect(second.outcome).toBe('accepted');
  expect(duo.load(root, run.id).state.history.map(r => r.outcome)).toEqual(['changes_required', 'accepted']);
  expect(fs.readFileSync(path.join(root, '.specflow/duo', run.id, 'round-001/tree/code.js'), 'utf8')).toContain('41');
});
test('both commands retain native permission controls and no write tools for Claude', () => {
  const claude = duo.invocation('codex', '/tmp/r'), codex = duo.invocation('claude-code', '/tmp/r');
  expect(claude.exe).toBe('claude'); expect(claude.args).toContain('-p'); expect(claude.args.slice(claude.args.indexOf('--effort'),claude.args.indexOf('--effort')+2)).toEqual(['--effort','medium']); expect(claude.args).toContain('Read,Glob,Grep'); expect(claude.args).toContain('dontAsk');
  expect(codex.exe).toBe('codex'); expect(codex.args.slice(0, 3)).toEqual(['exec', '--sandbox', 'read-only']);
});
test('Claude GitHub inspection permits bare reads without granting API or write access', () => {
  const spec = duo.invocation('codex', '/tmp/r', { repository: 'owner/repo' });
  const allowed = spec.args[spec.args.indexOf('--allowedTools') + 1].split(',');
  expect(allowed).toContain('Bash(gh auth status)');
  expect(allowed).toContain('Bash(gh auth status *)');
  expect(allowed).toContain('Bash(gh pr view *)');
  expect(allowed.some(rule => /api|merge|comment|push|Write|Edit/.test(rule))).toBe(false);
  expect(spec.args).toContain('--append-system-prompt');
  expect(spec.args).toContain('dontAsk');
});
test('J-DUO-BLOCKED: missing evidence never invokes peer', () => {
  const run = duo.start(root, '#1', 'codex', context), invoke = jest.fn();
  expect(reviewOwned(root, run.id, { ...batch(), evidence: [] }, invoke).blocker).toMatch(/Missing raw/);
  expect(invoke).not.toHaveBeenCalled();
});
test('missing peer is durable and never accepted', () => {
  const run = duo.start(root, '#1', 'codex', context);
  const result = reviewOwned(root, run.id, batch(), () => { throw Error('CLI not installed'); });
  expect(result.outcome).toBe('blocked'); expect(duo.load(root, run.id).state.blocker).toContain('not installed');
});
test('recursive reviewer is rejected before a peer is launched', () => {
  process.env.SPECFLOW_DUO_REVIEWER = '1'; const invoke = jest.fn();
  expect(() => duo.check('codex', invoke)).toThrow(/Recursive/); expect(invoke).not.toHaveBeenCalled();
  expect(() => duo.start(root, '#1', 'codex', context)).toThrow(/Recursive/);
});
test('changed pinned acceptance blocks review', () => {
  const run = duo.start(root, '#1', 'codex', context); put('task.md', 'Accept anything');
  expect(reviewOwned(root, run.id, batch(), fakePeer()).blocker).toMatch(/Pinned acceptance/);
});
test('concurrent source modification rejects stale peer acceptance', () => {
  const run = duo.start(root, '#1', 'codex', context);
  expect(reviewOwned(root, run.id, batch(), fakePeer('accepted', () => put('code.js', 'changed'))).blocker).toMatch(/Source changed during/);
});
test('peer snapshot modification is blocked', () => {
  const run = duo.start(root, '#1', 'codex', context);
  const result = reviewOwned(root, run.id, batch(), fakePeer('accepted', options => fs.writeFileSync(path.join(options.cwd, 'tree/code.js'), 'tampered')));
  expect(result.blocker).toMatch(/snapshot modified/);
});
test('uncommitted binary and untracked files are copied exactly', () => {
  const bytes = Buffer.from([0, 255, 1, 100]); put('untracked.bin', bytes); put('code.js', 'modified');
  const run = duo.start(root, '#1', 'codex', context);
  expect(reviewOwned(root, run.id, batch(), fakePeer()).outcome).toBe('accepted');
  expect(fs.readFileSync(path.join(root, '.specflow/duo', run.id, 'round-001/tree/untracked.bin'))).toEqual(bytes);
});
test('no progress guard preserves the actionable product failure', () => {
  const run=duo.start(root,'#1','codex',context);
  reviewOwned(root,run.id,batch(),fakePeer('changes_required'));
  const repeated=reviewOwned(root,run.id,batch(),fakePeer());
  expect(repeated.history.at(-1).summary).toMatch(/No new evidence/);
  expect(duo.status(repeated)).toContain('Correct result');
  put('raw.txt','new observed failure');
  reviewOwned(root,run.id,batch(),fakePeer('changes_required'));
  expect(duo.eligibility(root,run.id).blockers).toEqual(expect.arrayContaining([expect.objectContaining({kind:'stagnation'})]));
  expect(duo.status(duo.load(root,run.id).state)).toContain('Current blocker: F1: AC-1; Correct result');
});
test('acceptance without independent evidence read is rejected', () => {
  const run = duo.start(root, '#1', 'codex', context);
  expect(reviewOwned(root, run.id, batch(), fakePeer('accepted', (_, result) => { result.inspected = []; })).blocker).toMatch(/content-access receipt/);
});
test.each([
  ['optional parser, complete Read receipts', 'Bash', 'python3 -c "import json"', true, true],
  ['optional parser, missing receipts', 'Bash', 'python3 -c "import json"', false, false],
  ['GitHub denial', 'Bash', 'gh pr view 1 --repo owner/repo', true, false],
  ['artifact denial', 'Read', '', true, false],
  ['recursive CLI attempt', 'Bash', 'codex exec review', true, false],
])('permission recovery: %s', (_, toolName, command, receipts, accepted) => {
  const run=duo.start(root,'#1','codex',context);
  const invoke=(exe,args,options)=>{
    const raw=fakePeer()(exe,args,options);
    if(args[0]!=='-p')return raw;
    const request=JSON.parse(fs.readFileSync(path.join(options.cwd,'request.json'))), result=JSON.parse(raw.split("\n").at(-1));
    result.permission_denials=[{tool_name:toolName,tool_input:{command}}];
    const events=receipts ? request.requiredReads.flatMap((file,i)=>[
      {type:'assistant',message:{content:[{type:'tool_use',name:'Read',id:`r${i}`,input:{file_path:path.join(options.cwd,file)}}]}},
      {type:'user',message:{content:[{type:'tool_result',tool_use_id:`r${i}`,content:'fixture read result',is_error:false}]}}
    ]) : [];
    return [...events,result].map(e=>JSON.stringify(e)).join('\n');
  };
  const state=reviewOwned(root,run.id,batch(),invoke);
  expect(state.outcome).toBe(accepted ? 'accepted' : 'blocked');
  expect(state.history[0].permissionDenials).toHaveLength(1);
  expect(Boolean(state.history[0].permissionRecovery)).toBe(accepted);
  const audit=fs.readFileSync(path.join(root,'.specflow/duo',run.id,'audit.md'),'utf8');
  expect(audit).toContain('Denied tool calls: 1');
});
test('paths cannot escape repository or follow symlinks', () => {
  expect(() => duo.start(root, '#1', 'codex', { ...context, task: '../outside' })).toThrow(/escapes/);
  fs.symlinkSync('/etc/passwd', path.join(root, 'linked'));
  expect(() => duo.start(root, '#1', 'codex', { ...context, task: 'linked' })).toThrow(/Symlink/);
});
test('unauthenticated Codex is blocked without invoking a review', () => {
  const run = duo.start(root, '#1', 'claude-code', context);
  const invoke = jest.fn((exe, args) => args[0] === '--version' ? 'codex test' : 'Not logged in');
  const result = reviewOwned(root, run.id, batch(), invoke);
  expect(result.outcome).toBe('blocked'); expect(result.blocker).toMatch(/authentication not confirmed/);
  expect(result.history[0].peer).toBeUndefined(); expect(invoke.mock.calls).toHaveLength(2);
});
test('an interrupted attempt is persisted before invoking the peer', () => {
  const run = duo.start(root, '#1', 'codex', context);
  reviewOwned(root, run.id, batch(), fakePeer('accepted', () => {
    const pending = duo.load(root, run.id).state;
    expect(pending.history).toHaveLength(1); expect(pending.history[0].attempted).toBe(true); expect(pending.outcome).toBe('blocked'); expect(pending.peerFailures).toBe(1);
  }));
  expect(duo.load(root, run.id).state.history).toHaveLength(1);
});
test('resume invalidates acceptance when reviewed evidence changed', () => {
  const run = duo.start(root, '#1', 'codex', context);
  reviewOwned(root, run.id, batch(), fakePeer()); put('raw.txt', 'new failing output');
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try { duo.cli(['resume', run.id], root); expect(log.mock.calls[0][0]).toContain('Source or evidence changed'); }
  finally { log.mockRestore(); }
  expect(duo.load(root, run.id).state.outcome).toBe('blocked');
});
test.each(['codex', 'claude-code'])('installer delivers native skill and helper for %s', runtime => {
  execFileSync('bash', [path.resolve(__dirname, '../../install-hooks.sh'), root, '--runtime', runtime], { stdio: 'pipe' });
  for (const f of ['scripts/duo-build.cjs', '.claude/skills/duo-build/SKILL.md', '.codex/skills/duo-build/SKILL.md', '.agents/skills/duo-build/SKILL.md']) expect(fs.existsSync(path.join(root, f))).toBe(true);
});
test('snapshot preserves executable permissions and detects mode drift', () => {
  fs.chmodSync(path.join(root, 'code.js'), 0o755);
  const run = duo.start(root, '#1', 'codex', context);
  const result = reviewOwned(root, run.id, batch(), fakePeer('accepted', options => {
    const file = path.join(options.cwd, 'tree/code.js');
    expect(fs.statSync(file).mode & 0o777).toBe(0o755);
    fs.chmodSync(file, 0o644);
  }));
  expect(result.blocker).toMatch(/snapshot modified/);
});
test('readable blocked status leads with the actionable finding', () => {
  const run = duo.start(root, '#1', 'codex', context);
  reviewOwned(root, run.id, batch(), fakePeer('changes_required', (_, result) => { result.summary = 'Observed facts: '.repeat(50); }));
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  try { expect(duo.cli(['resume', run.id], root)).toBe(1); expect(log.mock.calls[0][0]).toContain('Current blocker: F1: AC-1; Correct result'); }
  finally { log.mockRestore(); }
});
test('production capture reserves discovery collection and blocks review until an explicit report',()=>{
 const fields=require('../helpers/spec-density').fixture(root),r=JSON.parse(fs.readFileSync(fields.tier_record));r.issue.body=fs.readFileSync(path.join(root,'task.md'),'utf8');require('../helpers/spec-density').seedState(root,r);fs.writeFileSync(fields.tier_record,JSON.stringify(r));
 const run=duo.start(root,'#1','codex',{...context,workKind:'implementation',specification:{record:'tier-record.json'}});
 const captured=duo.capture(root,run.id,run.owner.session,[process.execPath,'-e','console.log("observed: 42")']);
 const invoke=jest.fn(fakePeer());expect(reviewOwned(root,run.id,batch(),invoke).blocker).toContain('collection missing');expect(invoke).not.toHaveBeenCalled();
 require('../../scripts/specflow-specification.cjs').collect(root,r,captured.lastCapture.discoveryBatch,{outcome:'success',discoveries:[]});
 expect(reviewOwned(root,run.id,batch(),fakePeer()).outcome).toBe('accepted');
});
test('explicit approved Codex model is bound to the invocation without claiming served-model telemetry',()=>{
 const spec=duo.invocation('claude-code','/tmp/r',null,'gpt-6-astra');expect(spec.args.slice(spec.args.indexOf('--model'),spec.args.indexOf('--model')+2)).toEqual(['--model','gpt-6-astra']);
 expect(()=>duo.invocation('claude-code','/tmp/r',null,'claude-peer')).toThrow('supported model family');
});
test('scoped review cannot silently omit an ignored applicable artifact from the frozen snapshot',()=>{
 put('.gitignore','private-planning/\n');put('private-planning/decision.md','An applicable ownership decision');
 const policy=require('../../scripts/specflow-tier.cjs'),r={issue:{number:165,body:'AC-1: returns 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[{id:'ownership'}],artifacts:[{id:'ownership',role:'decision:ownership',path:'private-planning/decision.md',sha256:policy.sha('An applicable ownership decision')}]}};
 put('tier.json',JSON.stringify(r));const run=duo.start(root,'#165','codex',{...context,specification:{record:'tier.json',targetTier:'contracted'}}),invoke=jest.fn(fakePeer());
 expect(reviewOwned(root,run.id,batch(),invoke).blocker).toContain('not in the frozen snapshot');expect(invoke.mock.calls.some(([, , opts])=>opts?.input)).toBe(false);
});
test('stale Duo recovery evidence cannot consume a scoped reservation or either recovery attempt',()=>{
 const record={issue:{number:189,body:'AC-1: returns 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};
 put('tier.json',JSON.stringify(record));const run=duo.start(root,'#189','codex',{...context,specification:{record:'tier.json',targetTier:'contracted'}});
 for(let i=0;i<2;i++){record.profile.revision=i;put('tier.json',JSON.stringify(record));put('raw.txt',`failure ${i}`);reviewOwned(root,run.id,batch(),fakePeer('changes_required'));}
 const input={kind:'stagnation',cause:'value not corrected',action:'correct exported value',evidence:[{path:'raw.txt',sha256:require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'raw.txt'))).digest('hex')}]};
 expect(()=>duo.recoverReview(root,run.id,'wrong',{...input,scope:'specification'})).toThrow('does not own');
 duo.recoverReview(root,run.id,run.owner.session,{...input,scope:'specification'});
 duo.recoverReview(root,run.id,run.owner.session,input);
 const reviews=require('../../scripts/specflow-reviews.cjs'),before=reviews.load(root,189);
 put('raw.txt','tampered diagnosis evidence');const invoke=jest.fn(fakePeer());
 const result=reviewOwned(root,run.id,batch(),invoke);
 expect(result.blocker).toContain('Recovery evidence changed');
 expect(invoke.mock.calls.some(([, , opts])=>opts?.input)).toBe(false);
 expect(reviews.load(root,189)).toEqual(before);
 expect(result.reviewControl.calls).toBe(2);expect(result.reviewControl.recoveries[0].consumed).toBe(false);
});
test('new recovery command explains a pinned old runtime boundary without changing its journal',()=>{
 const run=duo.start(root,'#legacy','codex',context),file=path.join(root,'.specflow/duo',run.id,'run.json');
 const state=JSON.parse(fs.readFileSync(file));delete state.runtime.helperHashes['scripts/review-continuation.cjs'];
 fs.unlinkSync(path.join(root,'.specflow/duo',run.id,'runtime/scripts/review-continuation.cjs'));
 fs.writeFileSync(file,JSON.stringify(state));const before=fs.readFileSync(file,'utf8');
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});
 try{expect(duo.cli(['recover-review',run.id,'--session',run.owner.session,'--input','not-read.json'],root)).toBe(2);expect(log.mock.calls[0][0]).toContain('Pinned run uses the prior review policy');}finally{log.mockRestore();}
 expect(fs.readFileSync(file,'utf8')).toBe(before);
});
test('rejected scoped deferral persists and is supplied to the next native peer without phantom progress',()=>{
 const record={issue:{number:189,body:'AC-1: returns 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};
 put('tier.json',JSON.stringify(record));const run=duo.start(root,'#189','codex',{...context,specification:{record:'tier.json',targetTier:'contracted'}});
 const first=reviewOwned(root,run.id,batch(),fakePeer('accepted',(_,result)=>{
  result.specification_nonblocking=[{id:'RISK',kind:'deferred',impact:'current',basis:'Current data loss',action:'Preserve the value',evidence:['raw.txt'],nonimpact:'claimed future',owner_issue:'https://github.com/example/repo/issues/1',trigger:'future adapter'}];
 }));
 expect(first.history.at(-1).stage).toBe('scoped_blocked');expect(first.peerFailures).toBe(0);expect(first.reviewControl.achievements).toEqual([]);
 const reviews=require('../../scripts/specflow-reviews.cjs');expect(reviews.load(root,189).reviewControl.contracted.achievements).toEqual([]);
 record.profile.revision=2;put('tier.json',JSON.stringify(record));put('raw.txt','new output');
 const second=reviewOwned(root,run.id,batch(),fakePeer('accepted',(opts)=>{const req=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));expect(req.specification_review.prior_findings[0]).toMatchObject({id:'RISK',status:'open'});}));
 expect(second.outcome).toBe('blocked');expect(reviews.load(root,189).reviews.contracted.at(-1).findings[0].status).toBe('open');
});
test('interruption bookkeeping is owner-fenced and refuses a live run operation',()=>{
 const record={issue:{number:189,body:'AC-1: returns 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};
 put('tier.json',JSON.stringify(record));const run=duo.start(root,'#189','codex',{...context,specification:{record:'tier.json',targetTier:'contracted'}});
 const reviews=require('../../scripts/specflow-reviews.cjs'),reservation=reviews.begin(root,record,'contracted','codex',{ownerRun:run.id});
 expect(()=>duo.recordScopedInterruption(root,run.id,'wrong',reservation,'exited')).toThrow('does not own');
 const lock=path.join(root,'.specflow/duo',run.id,'review.lock');fs.writeFileSync(lock,String(process.pid));
 expect(()=>duo.recordScopedInterruption(root,run.id,run.owner.session,reservation,'exited')).toThrow('active');fs.unlinkSync(lock);
 const result=duo.recordScopedInterruption(root,run.id,run.owner.session,reservation,'Peer exited without response');expect(result.status).toBe('protocol_failed');
});
test('scoped partial batches progress on new actual evidence without changing the specification',()=>{
 const criteria=Array.from({length:4},(_,i)=>({id:`AC-${i+1}`,source:'task.md',anchor:`AC-${i+1}: requirement ${i+1}`,kind:'acceptance'}));
 const body=criteria.map(c=>c.anchor).join('\n');put('task.md',body);
 const record={issue:{number:189,body,labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};put('tier.json',JSON.stringify(record));
 const run=duo.start(root,'#189','codex',{...context,criteria,specification:{record:'tier.json',targetTier:'contracted'}});
 for(let i=0;i<4;i++){
  put('raw.txt',`Requirement ${i+1} observed`);
  const result=reviewOwned(root,run.id,{...batch(),id:`part${i}`,criteria:[`AC-${i+1}`]},fakePeer());
  expect(result.outcome).toBe('accepted');expect(duo.eligibility(root,run.id).eligible).toBe(true);
 }
 const result=reviewOwned(root,run.id,{...batch(),id:'final',criteria:criteria.map(c=>c.id)},fakePeer());
 expect(result.outcome).toBe('accepted');expect(duo.finish(root,run.id,run.owner.session).goalStatus).toBe('complete');
 const journal=require('../../scripts/specflow-reviews.cjs').load(root,189);expect(journal.reviewControl.contracted.achievements).toHaveLength(4);expect(journal.reviews.contracted).toHaveLength(5);
});
test('#206: a linked preparation run inherits open scoped findings so a repaired specification can pass',()=>{
 const reviews=require('../../scripts/specflow-reviews.cjs');
 const record={issue:{number:206,body:'AC-1: returns 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};
 put('tier.json',JSON.stringify(record));
 const scoped={...context,specification:{record:'tier.json',targetTier:'contracted'}};
 const first=duo.start(root,'#206','codex',scoped);
 expect(reviewOwned(root,first.id,batch(),fakePeer('changes_required')).outcome).toBe('changes_required');
 expect(reviews.load(root,206).reviews.contracted.at(-1).findings.find(f=>f.id==='F1').status).toBe('open');
 // Repairing the pinned task forces a linked run (validatePins); the old run is ceased.
 put('task.md','AC-1: returns 42\nRepaired: result is exactly 42.');record.issue.body='AC-1: returns 42\nRepaired: result is exactly 42.';
 record.profile.revision=1;put('tier.json',JSON.stringify(record));put('raw.txt','command: node code.js; exit: 0; observed 42; expected 42');
 duo.cease(root,first.id,first.owner.session,'Pinned task repaired; reconcile in a linked run');
 const linked=duo.start(root,'#206 linked','codex',scoped);
 const inherited=duo.load(root,linked.id).state.findings.F1;
 expect(inherited).toMatchObject({status:'open',inherited:{issue:206,tier:'contracted'}});
 const seen=[];const result=reviewOwned(root,linked.id,{...batch(),resolutions:[{id:'F1',change:'Task repaired to require exactly 42',evidence:['raw.txt']}]},
  fakePeer('accepted',opts=>{seen.push(JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json'))).open_findings.map(f=>f.id));}));
 expect(seen[0]).toEqual(['F1']);
 expect(result.outcome).toBe('accepted');
 const last=reviews.load(root,206).reviews.contracted.at(-1);
 expect(last.outcome).toBe('passed');expect(last.findings.find(f=>f.id==='F1').status).toBe('resolved');
});
test('#206: inheritance is limited to open blocking scoped findings of preparation runs',()=>{
 const reviews=require('../../scripts/specflow-reviews.cjs');
 const record={issue:{number:207,body:'AC-1: returns 42',labels:['spec:contracted']},profile:{ui:false,materialSeams:[]}};
 put('tier.json',JSON.stringify(record));
 const scoped={...context,specification:{record:'tier.json',targetTier:'contracted'}};
 const first=duo.start(root,'#207','codex',scoped);
 reviewOwned(root,first.id,batch(),fakePeer('changes_required',(_,r)=>{r.specification_nonblocking=[{id:'P2-NOTE',kind:'P2',impact:'current',basis:'Wording',action:'Tidy wording',evidence:['raw.txt']}];}));
 duo.cease(root,first.id,first.owner.session,'fixture');
 const linked=duo.load(root,duo.start(root,'#207 linked','codex',scoped).id).state;
 expect(Object.keys(linked.findings)).toEqual(['F1']);
 const plain=duo.load(root,duo.start(root,'#207 unscoped','codex',context).id).state;
 expect(Object.keys(plain.findings)).toEqual([]);
});
