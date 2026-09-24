const fs = require('fs'), os = require('os'), path = require('path');
const reviews = require('../../scripts/specflow-reviews.cjs');
const policy = require('../../scripts/specflow-tier.cjs');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'scoped-review-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const record = () => ({ issue: { number: 3, body: 'AC-1: corrections persist' }, profile: { ui: false, materialSeams: [] } });
function evidence(name = 'raw', bytes = name) { fs.writeFileSync(path.join(root, name), bytes); return { path: name, sha256: policy.sha(bytes) }; }
function report(overrides = {}) {
  return { nativeOutcome: 'accepted', readinessComplete: true, identity: { provider: 'claude', family: 'claude', model: 'fixture-only', mode: 'simulated' }, evidence: [evidence()], findings: [], gates: [], ...overrides };
}
function finding(overrides = {}) {
  return { id: 'F1', basis: 'AC-1: correction durability', action: 'Persist corrections before replacing a parse', severity: 'SERIOUS', status: 'open', impact: 'current', origin: 'original', evidence: [evidence('finding')], ...overrides };
}
test('review budget belongs to the issue/tier, survives hosts and cannot reset through run renaming', () => {
  const r = record();
  const first = reviews.begin(root, r, 'contracted', 'codex');
  reviews.complete(root, first, report({ nativeOutcome: 'changes_required', findings: [finding()] }));
  expect(() => reviews.begin(root, r, 'contracted', 'claude-code')).toThrow('No new evidence');
  r.profile.repairEvidence = evidence('repair');
  const second = reviews.begin(root, r, 'contracted', 'claude-code');
  reviews.complete(root, second, report({ identity: { provider: 'codex', family: 'gpt', model: 'fixture-only', mode: 'simulated' }, findings: [finding({ status: 'resolved' })] }));
  r.profile.newName = 'try another run';
  expect(() => reviews.begin(root, r, 'contracted', 'codex')).toThrow('initial review plus one repair');
  expect(reviews.load(root, 3).reviews.contracted).toHaveLength(2);
});
test('a pending or interrupted review is durable and cannot disappear', () => {
  const r = record(), first = reviews.begin(root, r, 'build-ready', 'codex');
  expect(() => reviews.begin(root, r, 'build-ready', 'codex')).toThrow('unfinished');
  reviews.fail(root, first, 'peer unavailable');
  expect(() => reviews.latest(root, r, 'build-ready')).toThrow('blocked');
});
test.each(['current', 'unknown'])('an unbuilt dependency with %s impact is not automatically deferred', impact => {
  const result = reviews.classify(root, null, [finding({ status: 'deferred', impact, targets_unbuilt_dependency: true, deferral: { nonimpact: 'future only', ownerIssue: 'https://github.com/example/project/issues/2', trigger: 'dependency implementation', evidence: [evidence('nonimpact')] } })], [], report().identity);
  expect(result.outcome).toBe('blocked');
  expect(result.errors.join(' ')).toContain('unbuilt dependency alone');
});
test('evidenced future spelling detail can defer with owner and reconsideration trigger', () => {
  const result = reviews.classify(root, null, [finding({ impact: 'future', status: 'deferred', basis: 'Later adapter spelling, with current interface unchanged', deferral: { nonimpact: 'Current interface and corrections unchanged', ownerIssue: 'https://github.com/example/project/issues/4', trigger: 'adapter implemented', evidence: [evidence('nonimpact')] } })], [], report().identity);
  expect(result.outcome).toBe('passed');
});
test('more than half of new material findings caused by repairs escalates with counts', () => {
  const result = reviews.classify(root, null, [finding({ origin: 'repair_induced', repairLink: evidence('previous-fix') }), finding({ id: 'F2', origin: 'repair_induced', repairLink: evidence('other-fix') }), finding({ id: 'F3', origin: 'unknown' })], [], report().identity);
  expect(result).toMatchObject({ outcome: 'escalated', counts: { newMaterial: 3, repairInduced: 2, unknownOrigin: 1 } });
});
test('omitted blockers survive; cosmetic P2 warnings do not create another repair loop', () => {
  expect(reviews.classify(root, { findings: [finding()] }, [], [], report().identity).outcome).toBe('blocked');
  expect(reviews.classify(root, null, [finding({ severity: 'P2' })], [], report().identity).outcome).toBe('passed_with_warnings');
});
test('required skipped or failed execution blocks even if the reviewer narrative says accepted', () => {
  for (const [index, fault] of [{ skipped: true }, { status: 'failed' }, { executed: false }].entries()) {
    const r = record(); r.issue.number += index;
    const reservation = reviews.begin(root, r, 'build-ready', 'codex');
    const result = reviews.complete(root, reservation, report({ gates: [{ id: 'journey', executed: true, skipped: false, status: 'passed', evidence: [evidence('journey')], ...fault }] }));
    expect(result.outcome).toBe('blocked');
  }
});
test('missing review evidence and a same-family peer cannot be called independent acceptance', () => {
  const reservation = reviews.begin(root, record(), 'contracted', 'codex');
  const result = reviews.complete(root, reservation, report({ evidence: [], identity: { provider: 'codex', model: 'fixture-only', family: 'gpt', mode: 'simulated' } }));
  expect(result.outcome).toBe('blocked');
  expect(result.errors.join(' ')).toMatch(/missing/);
  expect(result.errors.join(' ')).toMatch(/builder model family/);
});
test('a fix without regrade and changed raw review evidence cannot restore readiness', () => {
  const r = record(), reservation = reviews.begin(root, r, 'contracted', 'codex');
  reviews.complete(root, reservation, report());
  expect(reviews.latest(root, r, 'contracted').identity.mode).toBe('simulated');
  r.profile.changed = true;
  expect(() => reviews.latest(root, r, 'contracted')).toThrow('without regrade');
  delete r.profile.changed; fs.writeFileSync(path.join(root, 'raw'), 'changed');
  expect(() => reviews.latest(root, r, 'contracted')).toThrow('changed evidence');
});
test('an accepted partial batch cannot become a passing preparation receipt', () => {
  const r = record(), reservation = reviews.begin(root, r, 'contracted', 'codex');
  expect(reviews.complete(root, reservation, report({ readinessComplete: false })).outcome).toBe('blocked');
  expect(() => reviews.latest(root, r, 'contracted')).toThrow('blocked');
});
test('scope changes and owner exceptions retain exact honest non-passing status', () => {
 const r=record(),reservation=reviews.begin(root,r,'contracted','codex');reviews.complete(root,reservation,report());r.profile.changed=true;
 expect(reviews.status(root,r,'contracted')).toMatchObject({status:'fixed as specified, not re-graded',passed:false});
 reviews.change(root,3,s=>s.events.push({kind:'owner-exception',scope:policy.inputHash(r),status:'override:owner:bounded early decision'}));
 expect(reviews.status(root,r,'contracted')).toMatchObject({status:'override:owner:bounded early decision',passed:false});
 for(const outcome of ['fixed as specified, not re-graded','override:owner:bounded early decision']){r.issue.labels=['spec:build-ready'];r.readiness={tier:'build-ready',inputHash:policy.inputHash(r),review:{outcome}};expect(policy.evaluate(r,{root,operation:'build'}).status).toBe('blocked');}
});
