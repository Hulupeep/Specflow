// Supplied-state fixture for existing runner tests. These tests isolate runner
// mechanics; they do not claim a live promotion or independent review occurred.
const fs = require('fs'), path = require('path');
const policy = require('../../scripts/specflow-tier.cjs');
function seedState(root,record) {
  // Explicit supplied-state harness. No live review/promotion is claimed.
  fs.writeFileSync(path.join(root,record.source.path),JSON.stringify(record.issue));
  record.readiness.inputHash=policy.inputHash(record);
  require('../../scripts/specflow-reviews.cjs').change(root,record.issue.number,state=>{state.transitions=[structuredClone(record.readiness)];});
}
function fixture(root) {
  const ref = name => {
    fs.writeFileSync(path.join(root, name), `simulated ${name}`);
    return { path: name, sha256: policy.sha(`simulated ${name}`) };
  };
  const record = {
    issue: { number: 122, title: 'Runner fixture', body: 'AC-1: verify the runner', labels: ['spec:build-ready'] },
    source: {kind:'file',path:'tier-issue.json'},
    profile: { ui: false, materialSeams: [], artifacts: ['acceptance-checks', 'simulation', 'preflight'].map(role => ({ id: role, role, ...ref(`tier-${role}`) })) },
    freshness: { status: 'current' },
  };
  record.readiness = { id:'simulated-fixture',tier: 'build-ready', inputHash: policy.inputHash(record),dependenciesHash:policy.digest([]),discoveryHash:policy.digest([]),discoverySources:[122], gates: [{ id: 'preflight', status: 'passed', skipped: false, executed: true, evidence: ref('tier-gate') }], review: { outcome: 'passed', evidence: ref('tier-review') } };
  seedState(root,record);
  const file = path.join(root, 'tier-record.json'); fs.writeFileSync(file, JSON.stringify(record));
  return { tier_record: file, repository_root: root };
}
module.exports = { fixture, seedState };
