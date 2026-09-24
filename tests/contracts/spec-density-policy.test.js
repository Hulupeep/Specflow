const fs = require('fs');
const os = require('os');
const path = require('path');
const policy = require('../../scripts/specflow-tier.cjs');
const { spawnSync } = require('child_process');

let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-density-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function ref(name, content = name) {
  fs.writeFileSync(path.join(root, name), content);
  return { path: name, sha256: policy.sha(content) };
}
function ready() {
  const record = {
    issue: { number: 1, title: 'Small CLI change', body: 'AC-1: print the count', labels: ['spec:build-ready', 'enhancement'] },
    profile: { ui: false, materialSeams: [], artifacts: ['acceptance-checks', 'simulation', 'preflight'].map(role => ({ id: role, role, reuse: true, ...ref(role) })) },
    freshness: { status: 'current' },
  };
  // Supplied verification state for #163 policy tests. #164 owns creation of
  // receipts from executed checks; these fixtures are not live peer reviews.
  record.readiness = { tier: 'build-ready', inputHash: policy.inputHash(record), gates: [{ id: 'preflight', executed: true, skipped: false, status: 'passed', evidence: ref('gate') }], review: { outcome: 'passed', evidence: ref('review') } };
  return record;
}
const assess = (record, options = {}) => policy.evaluate(record, { root, ...options });

test('unlabeled thin inspection does not manufacture artifacts or promote', () => {
  const record = { issue: { number: 2, body: 'Future useful outcome', labels: ['enhancement'] } }, before = JSON.stringify(record);
  for (const route of ['spec-build', 'specflow-audit', 'specflow-simulate', 'board-auditor', ...policy.BUILD_ROUTES]) {
    expect(assess(record, { route })).toMatchObject({ status: 'planning', tier: 'thin', simulation_required: false, review_scope: [] });
    expect(assess(record, { route }).warnings).toHaveLength(1);
  }
  expect(JSON.stringify(record)).toBe(before);
});
test('conflicting labels block instead of choosing the deepest', () => {
  expect(assess({ issue: { labels: [{ name: 'spec:thin' }, { name: 'spec:build-ready' }] } }).errors.join(' ')).toContain('Conflicting tier labels');
});
test('unknown operations and routes fail closed through the public CLI', () => {
  const file = path.join(root, 'record.json'); fs.writeFileSync(file, JSON.stringify(ready()));
  for (const args of [['feature-build', 'buid'], ['feature-buid', 'resume'], ['feature-buid', 'build']]) {
    const result = spawnSync(process.execPath, [path.resolve(__dirname, '../../bin/specflow.js'), 'tier', 'inspect', file, ...args], { cwd: root, encoding: 'utf8' });
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ status: 'blocked' });
  }
  expect(assess(ready(), { operation: 'experiment' }).status).toBe('experiment_plan_required');
});
test.each(policy.BUILD_ROUTES)('%s refuses thin, contracted, stale and manually relabeled work', route => {
  for (const tier of ['thin', 'contracted']) {
    const record = ready(); record.issue.labels = [`spec:${tier}`];
    expect(assess(record, { route, operation: 'build' }).status).toBe('blocked');
  }
  const record = ready(); delete record.readiness;
  expect(assess(record, { route, operation: 'build' }).errors.join(' ')).toContain('promotion receipt');
  const stale = ready(); stale.freshness.status = 'unavailable';
  expect(assess(stale, { route, operation: 'resume' }).status).toBe('blocked');
});
test('existing check and contract references suffice without irrelevant artifact quotas', () => {
  const record = ready();
  record.profile.artifacts.push({ id: 'database', role: 'database', applicable: false, reason: 'No persistence changes' });
  record.readiness.inputHash = policy.inputHash(record);
  expect(assess(record, { operation: 'build' })).toMatchObject({ status: 'eligible', implementation_status: 'not_established' });
  delete record.profile.artifacts.at(-1).reason;
  expect(assess(record, { operation: 'promote' }).errors).toContain('database: N/A needs a reason');
});
test('material seam and UI require relevant decisions and paper walkthrough', () => {
  const record = ready(); record.issue.labels = ['spec:contracted'];
  record.profile.ui = true; record.profile.materialSeams = [{ id: 'correction-storage' }];
  expect(assess(record, { operation: 'promote' }).errors).toEqual(expect.arrayContaining([
    expect.stringContaining('decision:correction-storage'), expect.stringContaining('persona-walkthrough'),
  ]));
  for (const role of ['decision:correction-storage', 'persona-walkthrough']) record.profile.artifacts.push({ id: role, role, reuse: true, ...ref(role.replace(':', '-')) });
  expect(assess(record, { operation: 'promote' }).status).toBe('planning');
});
test('two slices reuse one decision, and changed shared evidence blocks both', () => {
  const shared = { id: 'ownership', role: 'decision:ownership', reuse: true, ...ref('shared-decision') };
  const records = [ready(), ready()];
  records.forEach((record, index) => {
    record.issue.number = index + 1;
    record.profile.materialSeams = [{ id: 'ownership' }];
    record.profile.artifacts.push(shared);
    record.readiness.inputHash = policy.inputHash(record);
    expect(assess(record, { operation: 'build' }).status).toBe('eligible');
  });
  expect(new Set(records.map(r => r.profile.artifacts.at(-1).path)).size).toBe(1);
  fs.writeFileSync(path.join(root, shared.path), 'new ownership boundary');
  for (const record of records) expect(assess(record, { operation: 'build' }).status).toBe('blocked');
});
test('current evidence is content bound; ordinary comments do not stale acceptance', () => {
  const record = ready(); record.issue.comments = [{ body: 'Nice work' }]; record.issue.updatedAt = new Date().toISOString();
  expect(assess(record, { operation: 'build' }).status).toBe('eligible');
  record.issue.body += '\nAC-2: support Unicode';
  expect(assess(record, { operation: 'build' }).status).toBe('blocked');
  const changedFile = ready(); fs.writeFileSync(path.join(root, 'acceptance-checks'), 'different assertion');
  expect(assess(changedFile, { operation: 'build' }).errors.join(' ')).toContain('changed evidence');
});
test.each(['absent', 'skipped', 'failed', 'ungraded', 'override'])('%s gates or reviews cannot establish readiness', fault => {
  const record = ready();
  if (fault === 'absent') record.readiness.gates = [];
  if (fault === 'skipped') record.readiness.gates[0].skipped = true;
  if (fault === 'failed') record.readiness.gates[0].status = 'failed';
  if (fault === 'ungraded') record.readiness.review.outcome = 'fixed_ungraded';
  if (fault === 'override') record.readiness.review.outcome = 'override:owner:urgent';
  expect(assess(record, { operation: 'build' }).status).toBe('blocked');
});
test('no symlink, traversal or missing evidence can satisfy a reference', () => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-outside-'));
  try {
    fs.writeFileSync(path.join(outside, 'data'), 'data'); fs.symlinkSync(path.join(outside, 'data'), path.join(root, 'link'));
    for (const file of ['link', '../data', 'missing']) expect(policy.referenceErrors(root, { path: file, sha256: policy.sha('data') }).length).toBeGreaterThan(0);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
});
test('installation creates only missing labels, is idempotent, and reports unavailable gh', () => {
  const labels = [{ name: 'enhancement' }, { name: 'spec:thin' }], calls = [];
  const run = (command, args) => {
    calls.push([command, args]);
    if (args[1] === 'list') return { status: 0, stdout: JSON.stringify(labels) };
    labels.push({ name: args[2] }); return { status: 0 };
  };
  expect(policy.installLabels(root, run)).toMatchObject({ created: ['spec:contracted', 'spec:build-ready'] });
  expect(policy.installLabels(root, run)).toMatchObject({ created: [] });
  expect(calls.every(([, args]) => args[0] === 'label')).toBe(true);
  expect(policy.installLabels(root, () => ({ status: 1 }))).toMatchObject({ status: 'blocked' });
});
test('deferred future artifacts need a reason and cannot satisfy a currently required role',()=>{
 const policy=require('../../scripts/specflow-tier.cjs');
 expect(policy.artifactErrors(process.cwd(),[{id:'future',role:'future-schema',deferred:true,reason:'Not needed for this selected slice'}],[])).toEqual([]);
 expect(policy.artifactErrors(process.cwd(),[{id:'future',role:'acceptance-checks',deferred:true,reason:'Later'}],['acceptance-checks']).join()).toContain('Missing applicable');
});
