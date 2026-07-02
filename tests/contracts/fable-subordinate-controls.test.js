const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertModelHonesty,
  recordModelHonesty,
  costAccounting,
  visionFinding,
  assertVisionNotGate,
  validateRoutineManifest,
  scaffoldRoutineManifest,
} = require('../../scripts/specflow-runner.cjs');

function tmpLedger() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-sub-')), 'ledger.jsonl');
}
function events(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
}

describe('MODEL-ROUTING-HONESTY-01 — silent downgrade is a failed contract (#83)', () => {
  test('HOSTILE: requested != effective with no reason fails the contract', () => {
    const r = assertModelHonesty({ requested_model: 'fable', effective_model: 'opus' });
    expect(r.ok).toBe(false);
    expect(r.downgrade).toBe(true);
    expect(r.violation).toMatch(/silent model downgrade/);
  });
  test('a recorded reason makes the downgrade honest, and it is ledgered', () => {
    const ledger = tmpLedger();
    const r = recordModelHonesty(ledger, { requested_model: 'fable', effective_model: 'opus', fallback_refusal_reason: 'safety route to opus' });
    expect(r.ok).toBe(true);
    const e = events(ledger).find((x) => x.event === 'model_honesty');
    expect(e.result).toBe('ok');
    expect(e.effective_model).toBe('opus');
  });
  test('an unreported effective model is not a downgrade (unknown != downgrade)', () => {
    expect(assertModelHonesty({ requested_model: 'fable', effective_model: 'unknown' }).ok).toBe(true);
  });
});

describe('COST-ACCOUNTING-01 — cost per accepted change; missing usage is unknown (#89)', () => {
  test('HOSTILE: missing usage is counted as unknown, never fabricated as zero', () => {
    const acct = costAccounting([
      { provider: 'claude-print', stage: '5_impl', estimated_cost: 0.5, effective_model: 'sonnet' },
      { provider: 'codex-exec', stage: '6_provenance' }, // no usage metadata
      { result: 'pass', stage: '6_provenance' },
    ]);
    expect(acct.total_cost).toBe(0.5);
    expect(acct.unknown_usage).toBe(1);
    expect(acct.per_gate.some((r) => r.cost === 'unknown')).toBe(true);
    expect(acct.accepted_gates).toBe(1);
    expect(acct.cost_per_accepted_change).toBe(0.5);
  });
});

describe('VISION-EVIDENCE-01 — vision is evidence, never a gate pass (#88)', () => {
  test('a vision finding names goal/screenshot/model/verdict/gaps and stays pending', () => {
    const f = visionFinding({ goal: 'cart totals', screenshot: 'a.png', model: 'fable-vision', verdict: 'looks correct', gaps: ['no reread'] });
    expect(f.gate_result).toBe('pending');
    expect(f.goal).toBe('cart totals');
    expect(f.gaps).toEqual(['no reread']);
  });
  test('HOSTILE: a vision verdict cannot be treated as a gate pass', () => {
    expect(assertVisionNotGate(visionFinding({ verdict: 'pass' })).gate_pass).toBe(false);
    expect(() => assertVisionNotGate({ gate_result: 'pass' })).toThrow(/evidence only/);
  });
});

describe('ROUTINE-SAFETY-01 — reject unsafe routine manifests (#87)', () => {
  test('a scaffolded manifest that calls specflow run is accepted', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-routine-'));
    const { manifest } = scaffoldRoutineManifest({ slug: 'nightly', outPath: path.join(dir, 'r.yml') });
    expect(validateRoutineManifest(manifest).ok).toBe(true);
  });
  test('HOSTILE: a manifest that does not call specflow run / runs a human-gated action is rejected', () => {
    const bad = validateRoutineManifest({ routine: { slug: 'x', command: 'git push origin main' } });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join()).toMatch(/specflow run/);
    expect(bad.errors.join()).toMatch(/human-gated/);
  });
  test('portfolio-improvement routine must declare a proposal policy', () => {
    const r = validateRoutineManifest({ routine: { slug: 'portfolio-improve', command: 'npx specflow run spec-build --slug x' } });
    expect(r.ok).toBe(false);
    expect(r.errors.join()).toMatch(/proposal_policy/);
  });
});
