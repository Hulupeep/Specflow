'use strict';

// Read-only function-level observation. Exit 0 means the probe ran, not that
// improve meets the desired behavior. No subprocess, model, network or DB calls.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const improve = require(path.join(root, 'scripts/specflow-improve.cjs'));
const source = fs.readFileSync(path.join(root, 'scripts/specflow-improve.cjs'));
const contract = { acceptance: [{ id: 'PRESERVE', statement: 'Existing navigation works',
  mandatory: true, required_level: 1, baseline_expectation: 'pass' }] };
const evidence = ['baseline', 'after'].map(phase => ({ id: phase,
  criterion: 'PRESERVE', phase, contract_version: 1, set: 'holdout',
  kind: 'executable-check', level: 1, result: 'pass',
  producer_role: 'verifier-mechanical' }));
const state = { integrity_failed: false, side_effects_attempted: 0,
  scope: { outside_scope: [], protected_touched: [], too_many_files: false },
  base: { unchanged: true }, empty_diff: false,
  criteria: improve.evaluateCriteria(contract, evidence, 1),
  regressions: [], gates_missing: [], baseline_blocker: null, rail_gate: 'pass',
  holdout_exposed: [], disputes: [], peer_recommendation: 'keep' };
const observed = improve.decide(state);
const regression = improve.decide({ ...state, criteria: [{
  id: 'PRESERVE', mandatory: true, status: 'failed' }] });
const empty = improve.decide({ ...state, empty_diff: true });
console.log(JSON.stringify({
  kind: 'research-observation', observed_at: new Date().toISOString(),
  source: 'scripts/specflow-improve.cjs',
  source_sha256: crypto.createHash('sha256').update(source).digest('hex'),
  scope: 'exported evaluateCriteria and decide functions; constructed inputs',
  input: { contract, evidence, state },
  desired_decision: 'not KEEP without a demonstrated gain', observed,
  desired_behavior_met: observed.decision !== 'KEEP',
  controls: { mandatory_regression: regression, empty_diff: empty },
  limitations: ['Not a CLI/worktree reproduction', 'No environment or backend validation',
    'Constructed valid-state assumptions do not prove reachability through every CLI gate'],
}, null, 2));
