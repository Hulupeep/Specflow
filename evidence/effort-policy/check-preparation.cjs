'use strict';
const fs = require('fs'), cp = require('child_process'), assert = require('assert');
const result = cp.spawnSync(process.execPath, [
  'node_modules/jest/bin/jest.js', '--runInBand', '--no-coverage', '--json',
  '--outputFile', '.specflow/effort-baseline.json',
  'tests/contracts/review-continuation.test.js', 'tests/contracts/duo-operations.test.js'
], { encoding: 'utf8', timeout: 120000 });
if (result.status !== 0) throw Error('Baseline controls failed: ' + result.stderr);
const baseline = JSON.parse(fs.readFileSync('.specflow/effort-baseline.json'));
assert.equal(baseline.numFailedTests, 0);
assert.equal(baseline.numPendingTests + baseline.numTodoTests, 0);
const red = JSON.parse(fs.readFileSync('tmp/effort/red-regression.json'));
assert.equal(red.numFailedTests, 1);
assert.equal(red.numPassedTests, 0);
assert.match(red.testResults[0].message, /recovery did not establish progress/);
const c = require('../../scripts/review-continuation.cjs'), state = c.create({ usageMode: 'subscription' });
assert.equal(state.policy.maxCalls, undefined);
assert.equal(state.policy.maxElapsedMs, undefined);
console.log(JSON.stringify({
  executed: baseline.numPassedTests + 3, failed: 0, skipped: 0,
  scope: 'Preparation assertions and old baseline controls only; not the desired fix',
  baselinePassed: baseline.numPassedTests,
  desiredRegression: { passed: 0, failed: 1, skipped: 0, status: 'observed pre-fix red; never a passing implementation gate' }
}));
