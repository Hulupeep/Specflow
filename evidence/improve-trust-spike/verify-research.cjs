'use strict';
// Read-only verification of archived observations; never reruns a holdout.
const fs = require('fs'), crypto = require('crypto'), assert = require('assert');
const root = 'evidence/improve-trust-spike/research/';
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p));
const manifest = read(root + 'manifest.json');
for (const ref of manifest.files) assert.strictEqual(sha(ref.path), ref.sha256, ref.path);
const observations = [];
for (const experiment of manifest.experiments) {
  const receipt = read(experiment.receipt), plan = read(experiment.plan), execution = read(experiment.execution);
  assert.strictEqual(receipt.productionAccepted, false);
  assert.strictEqual(receipt.stdout, execution.stdout);
  assert.strictEqual(receipt.exitCode, execution.exitCode);
  const output = JSON.parse(receipt.stdout);
  assert.strictEqual(output.sourceHashes.probe, sha(experiment.probe));
  for (const suffix of ['scripts/specflow-improve.cjs', 'scripts/specflow-runner.cjs', 'tests/contracts/improve-core.test.js']) {
    assert.strictEqual(sha(suffix), plan.code.find(r => r.path === suffix).sha256);
  }
  const probe = JSON.parse(receipt.sandboxProbe.stdout);
  for (const key of ['success', 'sandboxReady', 'readOnly', 'hostPathsHidden', 'networkNamespaceIsolated', 'writableFixture']) assert.strictEqual(probe[key], true);
  observations.push(...output.observations);
}
const get = name => observations.find(o => o.scenario === name && !o.unavailable).actual;
assert.strictEqual(get('unchanged-gain').retained.steps, 2);
assert.strictEqual(get('mutation-before-evaluate').decision, 'KEEP');
assert.strictEqual(get('mutation-before-evaluate').retained.steps, 9);
assert.notStrictEqual(get('mutation-before-evaluate').testedHash, get('mutation-before-evaluate').evaluatedHash);
assert.strictEqual(get('mutation-after-evaluate').finalExit, 2);
assert.strictEqual(get('v2-no-new-baseline').implementationStarted, true);
assert.strictEqual(get('v2-mismatching-baseline').freshBaseline.status, 'baseline_blocked');
assert.strictEqual(get('v2-mismatching-baseline').implementationStarted, true);
assert.strictEqual(get('v2-matching-baseline').freshBaseline.status, 'baseline_recorded');
assert.strictEqual(get('preservation-only').baseline['AC-1'], 'pass');
assert.strictEqual(get('preservation-only').after['AC-1'], 'pass');
assert.strictEqual(get('preservation-only').decision, 'KEEP');
assert.strictEqual(get('preservation-only').branchRetained, true);
assert.strictEqual(get('gain-control').decision, 'KEEP');
assert.strictEqual(get('regression-control').decision, 'REVERT');
assert.deepStrictEqual(get('gate-regression-control').gates, [{ id: 'nav', baseline: 'pass', after: 'fail' }]);
assert.strictEqual(get('gate-regression-control').decision, 'REVERT');
assert.strictEqual(get('gate-regression-control').branchRetained, false);
assert.strictEqual(observations.filter(o => o.unavailable).length, 1);
assert.strictEqual(observations.length, 11);
console.log(JSON.stringify({ status: 'archive_verified', executed: 11, unavailableInitialAttempts: 1, distinctScenarios: 10, retried: 1, productionAccepted: false, note: 'Verifies stored observations and hashes only; does not rerun experiments or prove fixes.' }));
