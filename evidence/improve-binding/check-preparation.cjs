'use strict';
// Structural preparation gate only: does not assert the unbuilt fix passes.
const fs = require('fs'), assert = require('assert'), yaml = require('js-yaml');
const story = fs.readFileSync('docs/specs/improve-binding/story.md', 'utf8');
const preparation = fs.readFileSync('docs/specs/improve-binding/preparation.md', 'utf8');
const contract = yaml.load(fs.readFileSync('docs/contracts/feature_improve_core.yml', 'utf8'));
const loaded = fs.readdirSync('docs/contracts').filter(p => p.endsWith('.yml')).map(p => {
  const obj = yaml.load(fs.readFileSync('docs/contracts/' + p, 'utf8'));
  return { path: 'docs/contracts/' + p, firstField: Object.keys(obj)[0] };
});
let executed = 0;
for (let i = 1; i <= 5; i++) {
  assert.strictEqual((story.match(new RegExp('^- \\[ \\] BIND-' + i + ':', 'gm')) || []).length, 1);
  assert(preparation.includes('BIND-' + i)); executed++;
}
for (const id of ['001','002','003','004','005','006','007','010','011','012']) {
  assert(contract.invariants.some(x => x.id === 'I-IMPROVE-' + id)); executed++;
}
for (const p of ['scripts/specflow-improve.cjs','scripts/specflow-runner.cjs','tests/contracts/improve-core.test.js','docs/specs/improve-trust-spike/RESULTS.md']) { assert(fs.statSync(p).isFile()); executed++; }
assert(story.includes('legacy') && story.includes('edit-and-restore') && story.includes('consumption'));
assert(preparation.includes('CRITICAL: None') && preparation.includes('P1: None')); executed++;
console.log(JSON.stringify({ executed, skipped: 0, failed: 0, scope: 'preparation mapping, not implementation acceptance', contractsLoaded: loaded }));
