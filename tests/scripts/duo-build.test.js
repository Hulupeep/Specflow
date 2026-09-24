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
  expect(result.outcome).toBe('blocked'); expect(result.blocker).toContain('initial review plus one repair');
  expect(invoke.mock.calls.some(([, , opts]) => opts?.input)).toBe(false);
  const rounds = require('../../scripts/specflow-reviews.cjs').load(root, 165).reviews.contracted;
  expect(rounds).toHaveLength(2); expect(rounds.every(r => r.identity.mode === 'simulated')).toBe(true);
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
test('no progress stops and maximum three repair rounds is enforced', () => {
  const run = duo.start(root, '#1', 'codex', context);
  reviewOwned(root, run.id, batch(), fakePeer('changes_required'));
  expect(reviewOwned(root, run.id, batch(), fakePeer()).blocker).toMatch(/No new evidence/);
  for (let i = 0; i < 3; i++) { put('raw.txt', `new observed failure ${i}`); expect(reviewOwned(root, run.id, batch(), fakePeer('changes_required')).outcome).toBe('changes_required'); }
  put('raw.txt', 'another attempt');
  expect(reviewOwned(root, run.id, batch(), fakePeer()).blocker).toMatch(/three repair rounds/);
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
  try { expect(duo.cli(['resume', run.id], root)).toBe(1); expect(log.mock.calls[0][0]).toContain('Current blocker: F1: Correct result'); }
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
