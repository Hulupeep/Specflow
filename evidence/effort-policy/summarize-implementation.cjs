'use strict';
// Summarize actual Jest receipts without substituting narrative for execution.
const fs = require('fs'), crypto = require('crypto'), assert = require('assert');
const read = file => {
  const raw = fs.readFileSync(file);
  return { path:file, sha256:crypto.createHash('sha256').update(raw).digest('hex'), value:JSON.parse(raw) };
};
const full = read(process.argv[2]), red = read('tmp/effort/red-regression.json');
assert.equal(full.value.success, true);
assert.equal(full.value.numFailedTests, 0);
assert.equal(full.value.numPendingTests + full.value.numTodoTests, 0);
assert.equal(full.value.numPassedTests, full.value.numTotalTests);
assert.equal(red.value.numFailedTests, 1);
assert.equal(red.value.numPassedTests, 0);
assert.match(red.value.testResults[0].message, /recovery did not establish progress/);
const tests = full.value.testResults.flatMap(s => s.assertionResults.map(t => ({
  file:s.name.slice(s.name.indexOf('/tests/')+1), name:t.fullName, status:t.status
}))).filter(t => /EFFORT-|failed recovery requires evidenced diagnosis/.test(t.name));
assert(tests.length >= 15);
assert(tests.every(t => t.status === 'passed'));
console.log(JSON.stringify({
  canonical:{path:full.path,sha256:full.sha256,passed:full.value.numPassedTests,
    failed:full.value.numFailedTests,skipped:full.value.numPendingTests+full.value.numTodoTests,
    suites:full.value.numTotalTestSuites},
  preFixRegression:{path:red.path,sha256:red.sha256,passed:0,failed:1,status:'observed red before fix'},
  selectedExecutedTests:tests,
  limits:'Local real helper/ledger/CLI tests with protocol fixtures; no live old-runtime migration, provider qualification, controller-window or CI claim.'
},null,2));
