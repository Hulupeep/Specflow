const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  writeVerificationProposal,
  decideVerification,
  verifierTrace,
  verificationPaths,
  appendLedger,
  cli,
} = require('../../scripts/specflow-runner.cjs');

// VERIFIER-TRACE-01 / J-VERIFIER-TRACE-DIVERGENCE (epic #100)

function tempRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-vtrace-'));
}
function contract(overrides = {}) {
  return {
    journey_id: 'J', maker_policy_id: 'm', verifier_policy_id: 'v',
    runtime_checks: [{ type: 'api', command: 'curl', assertion: 'reread', required: true }],
    forbidden_evidence: ['maker self-review'], ...overrides,
  };
}

describe('VERIFIER-TRACE-01 — maker/verifier/gate divergence (J-VERIFIER-TRACE-DIVERGENCE)', () => {
  test('groups maker claim, verifier finding, gate result separately and never posts transcript', () => {
    const runDir = tempRun();
    writeVerificationProposal({ runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: contract().runtime_checks });
    decideVerification({ runDir, decision: 'accept', verificationContract: contract() });

    const t = verifierTrace({ runDir });
    expect(t.verifier.decision).toBe('accepted');
    expect(t.mechanical_gate.result).toBe('not_run'); // gate has not run — acceptance is not a pass
    expect(t.disposition).toBe('pending');
    expect(t.sends_transcript_to_provider).toBe(false);
  });

  test('flags verifier_passed_but_gate_failed', () => {
    const runDir = tempRun();
    writeVerificationProposal({ runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: contract().runtime_checks });
    decideVerification({ runDir, decision: 'accept', verificationContract: contract() });
    appendLedger(verificationPaths({ runDir }).ledgerPath, { stage: '6_provenance', verifier: 'provenance', result: 'fail', stop_reason: 'gate_failed' });

    const t = verifierTrace({ runDir });
    expect(t.mechanical_gate.result).toBe('fail');
    expect(t.divergence).toContain('verifier_passed_but_gate_failed');
    expect(t.disposition).toBe('gate_failed');
  });

  test('flags maker_claimed_done_but_verifier_failed and dispositions blocked', () => {
    const runDir = tempRun();
    writeVerificationProposal({ runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: [] });
    appendLedger(verificationPaths({ runDir }).ledgerPath, { event: 'maker_claim', claim: 'done', output_path: '/x/output.md' });
    decideVerification({ runDir, decision: 'reject', missingCheck: 'no value-bearing reread' });

    const t = verifierTrace({ runDir });
    expect(t.maker.claimed_done).toBe(true);
    expect(t.verifier.decision).toBe('rejected');
    expect(t.divergence).toContain('maker_claimed_done_but_verifier_failed');
    expect(t.disposition).toBe('blocked');
  });

  test('reports missing maker/verifier and missing evidence without inferring', () => {
    const runDir = tempRun();
    appendLedger(verificationPaths({ runDir }).ledgerPath, {
      event: 'proposal_written', proposal_path: path.join(runDir, 'does-not-exist.md'), verification_contract_path: null,
    });
    const t = verifierTrace({ runDir });
    expect(t.maker.claim).toBe('missing');
    expect(t.verifier.decision).toBe('missing');
    expect(t.divergence).toContain('missing_evidence');
  });

  test('flags human_gated_action_attempted', () => {
    const runDir = tempRun();
    appendLedger(verificationPaths({ runDir }).ledgerPath, { stage: '5_impl', stop_reason: 'blocked_human_required', forbidden_action_detected: 'git push' });
    expect(verifierTrace({ runDir }).divergence).toContain('human_gated_action_attempted');
  });

  test('CLI `trace` verb reads the run directory', () => {
    const runDir = tempRun();
    writeVerificationProposal({ runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: contract().runtime_checks });
    const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const code = cli(['trace', '--run-dir', runDir]);
    spy.mockRestore();
    expect(code).toBe(0);
  });
});
