const fs = require('fs'), os = require('os'), path = require('path'), { spawnSync } = require('child_process');
const reviews = require('../../scripts/specflow-reviews.cjs');
const policy = require('../../scripts/specflow-tier.cjs');
const CLI = path.join(__dirname, '../../scripts/specflow-specification.cjs');
let root, saved;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-reset-')); saved = process.env.SPECFLOW_DUO_REVIEWER; delete process.env.SPECFLOW_DUO_REVIEWER; });
afterEach(() => { if (saved === undefined) delete process.env.SPECFLOW_DUO_REVIEWER; else process.env.SPECFLOW_DUO_REVIEWER = saved; fs.rmSync(root, { recursive: true, force: true }); });
const record = () => ({ issue: { number: 7, body: 'AC-1: corrections persist' }, profile: { ui: false, materialSeams: [] } });
function evidence(name, bytes = name) { fs.writeFileSync(path.join(root, name), bytes); return { path: name, sha256: policy.sha(bytes) }; }
const report = (overrides = {}) => ({ nativeOutcome: 'changes_required', readinessComplete: true, identity: { provider: 'codex', family: 'gpt', model: 'fixture-only', mode: 'simulated' }, evidence: [evidence('raw')], findings: [], gates: [], ...overrides });
let step = 0;
function round(r, tier = 'build-ready') { r.profile.repair = evidence(`repair-${++step}`); return reviews.complete(root, reviews.begin(root, r, tier, 'claude-code'), report()); }
function exhaust(r, tier = 'build-ready') { round(r, tier); round(r, tier); r.profile.repair = evidence(`repair-${++step}`); expect(() => reviews.begin(root, r, tier, 'codex')).toThrow('review limit reached'); }

test('owner reset archives rounds into an appended audited event and preserves existing events', () => {
  const r = record(); exhaust(r);
  reviews.change(root, 7, s => s.events.push({ kind: 'owner-exception', status: 'earlier' }));
  const before = reviews.load(root, 7).reviews['build-ready'];
  const out = reviews.resetReview(root, r, 'build-ready', 'peer misread the scope; owner accepts resubmission', { by: 'Owner <owner@example.com>' });
  expect(out).toMatchObject({ status: 'reset', tier: 'build-ready', archivedRounds: 2, resets: 1 });
  const state = reviews.load(root, 7);
  expect(state.reviews['build-ready']).toEqual([]);
  expect(state.events).toHaveLength(2);
  expect(state.events[0]).toEqual({ kind: 'owner-exception', status: 'earlier' });
  expect(state.events[1]).toMatchObject({ kind: 'owner-review-allowance-reset', tier: 'build-ready', by: 'Owner <owner@example.com>', reason: 'peer misread the scope; owner accepts resubmission', archivedRounds: before });
  expect(Date.parse(state.events[1].at)).not.toBeNaN();
  expect(state.transitions).toBeUndefined();
});
test('the default identity is recorded when none is supplied', () => {
  const r = record(); exhaust(r);
  reviews.resetReview(root, r, 'build-ready', 'owner escalation');
  expect(reviews.load(root, 7).events[0].by).toMatch(/\S/);
});
test('after a reset begin() works and the normal limit applies again after two more rounds', () => {
  const r = record(); exhaust(r);
  reviews.resetReview(root, r, 'build-ready', 'owner escalation', { by: 'owner' });
  round(r); round(r);
  r.profile.repair = evidence(`repair-${++step}`);
  expect(() => reviews.begin(root, r, 'build-ready', 'codex')).toThrow('review limit reached');
  expect(reviews.load(root, 7).reviews['build-ready']).toHaveLength(2);
});
test('a reset touches only the named tier', () => {
  const r = record(); round(r, 'contracted'); exhaust(r);
  reviews.resetReview(root, r, 'build-ready', 'owner escalation', { by: 'owner' });
  expect(reviews.load(root, 7).reviews.contracted).toHaveLength(1);
});
test('refused inside a peer reviewer', () => {
  const r = record(); exhaust(r); process.env.SPECFLOW_DUO_REVIEWER = '1';
  expect(() => reviews.resetReview(root, r, 'build-ready', 'owner escalation', { by: 'owner' })).toThrow(/owner-only/);
  expect(reviews.load(root, 7).reviews['build-ready']).toHaveLength(2);
});
test.each([undefined, '', '   '])('refused without a reason (%p)', reason => {
  const r = record(); exhaust(r);
  expect(() => reviews.resetReview(root, r, 'build-ready', reason, { by: 'owner' })).toThrow(/reason/);
  expect(reviews.load(root, 7).reviews['build-ready']).toHaveLength(2);
});
test.each(['thin', 'buildready', undefined])('refused for an unknown tier (%p)', tier => {
  expect(() => reviews.resetReview(root, record(), tier, 'owner escalation', { by: 'owner' })).toThrow(/contracted or build-ready/);
});
test('refused while the latest round is pending', () => {
  const r = record(); round(r); r.profile.repair = evidence('pending-scope');
  reviews.begin(root, r, 'build-ready', 'codex');
  expect(() => reviews.resetReview(root, r, 'build-ready', 'owner escalation', { by: 'owner' })).toThrow(/unfinished/);
  expect(reviews.load(root, 7).reviews['build-ready'].at(-1).status).toBe('pending');
  expect(reviews.load(root, 7).events).toEqual([]);
});
test('refused while the specification lock is held', () => {
  const r = record(); exhaust(r);
  fs.mkdirSync(reviews.statePath(root, 7) + '.lock');
  expect(() => reviews.resetReview(root, r, 'build-ready', 'owner escalation', { by: 'owner' })).toThrow(/operation is active/);
  fs.rmSync(reviews.statePath(root, 7) + '.lock', { recursive: true });
  expect(reviews.load(root, 7).reviews['build-ready']).toHaveLength(2);
});
test('status and stageGate report the reset count per tier and name the owner command when exhausted', () => {
  const r = record(); exhaust(r);
  expect(reviews.status(root, r, 'build-ready')).toMatchObject({ resets: 0, attempts: 2 });
  expect(reviews.stageGate(root, r, 'GATE_B5').next_action).toContain('reset-review');
  reviews.resetReview(root, r, 'build-ready', 'first', { by: 'owner' });
  exhaust(r);
  reviews.resetReview(root, r, 'build-ready', 'second', { by: 'owner' });
  expect(reviews.status(root, r, 'build-ready')).toMatchObject({ resets: 2, attempts: 0 });
  expect(reviews.stageGate(root, r, 'GATE_B5')).toMatchObject({ resets: 2, tier: 'build-ready' });
  expect(reviews.status(root, r, 'contracted')).toMatchObject({ resets: 0 });
});
test('the CLI command resets with an audited identity and refuses inside a reviewer', () => {
  const r = record(); exhaust(r);
  fs.writeFileSync(path.join(root, 'record.json'), JSON.stringify(r));
  const env = { ...process.env }; delete env.SPECFLOW_DUO_REVIEWER;
  const refused = spawnSync(process.execPath, [CLI, 'reset-review', 'record.json', 'build-ready', 'owner escalation'], { cwd: root, encoding: 'utf8', env: { ...env, SPECFLOW_DUO_REVIEWER: '1' } });
  expect(refused.status).toBe(2);
  expect(refused.stderr).toMatch(/owner-only/);
  const missing = spawnSync(process.execPath, [CLI, 'reset-review', 'record.json', 'build-ready'], { cwd: root, encoding: 'utf8', env });
  expect(missing.status).toBe(2);
  expect(missing.stderr).toMatch(/reason/);
  const ok = spawnSync(process.execPath, [CLI, 'reset-review', 'record.json', 'build-ready', 'owner', 'escalation'], { cwd: root, encoding: 'utf8', env });
  expect(ok.status).toBe(0);
  expect(JSON.parse(ok.stdout)).toMatchObject({ status: 'reset', tier: 'build-ready', archivedRounds: 2, resets: 1 });
  const event = reviews.load(root, 7).events.find(e => e.kind === 'owner-review-allowance-reset');
  expect(event).toMatchObject({ reason: 'owner escalation', tier: 'build-ready' });
  expect(event.by).toMatch(/\S/);
});
