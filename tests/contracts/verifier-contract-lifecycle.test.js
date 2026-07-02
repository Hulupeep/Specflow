const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  writeVerificationProposal,
  decideVerification,
  requireAcceptedVerificationContract,
  verificationPaths,
} = require('../../scripts/specflow-runner.cjs');

// VERIFIER-CONTRACT-01 / J-VERIFIER-CONTRACT-LIFECYCLE (epic #100)
// Trust boundary: maker proposes, verifier decides, mechanical gate still owns pass/fail.

function tempRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-verif-'));
}
function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function sampleContract(overrides = {}) {
  return {
    journey_id: 'J-VERIFIER-CONTRACT-LIFECYCLE',
    maker_policy_id: 'claude-print-maker',
    verifier_policy_id: 'codex-exec-verifier',
    runtime_checks: [
      { type: 'playwright', command: 'npx playwright test j.spec.ts', assertion: 'flow completes', required: true },
    ],
    forbidden_evidence: ['maker self-review', 'provider exit code as gate pass'],
    ...overrides,
  };
}

describe('VERIFIER-CONTRACT-01 — verification contract lifecycle (J-VERIFIER-CONTRACT-LIFECYCLE)', () => {
  test('writes verification-proposal.md before implementation and blocks until accepted', () => {
    const runDir = tempRun();
    const { proposalPath } = writeVerificationProposal({
      runDir,
      journeyId: 'J-VERIFIER-CONTRACT-LIFECYCLE',
      makerPolicyId: 'claude-print-maker',
      verifierPolicyId: 'codex-exec-verifier',
      runtimeChecks: sampleContract().runtime_checks,
    });
    expect(fs.existsSync(proposalPath)).toBe(true);

    // No accepted contract yet → maker implementation is blocked.
    const gate = requireAcceptedVerificationContract({ runDir });
    expect(gate.accepted).toBe(false);
    expect(gate.reason).toMatch(/blocked/);
    expect(fs.existsSync(verificationPaths({ runDir }).contractPath)).toBe(false);
  });

  test('acceptance writes verification-contract.json with required fields + accepted_at and unblocks', () => {
    const runDir = tempRun();
    writeVerificationProposal({
      runDir, journeyId: 'J-VERIFIER-CONTRACT-LIFECYCLE', makerPolicyId: 'm', verifierPolicyId: 'v',
      runtimeChecks: sampleContract().runtime_checks,
    });
    const res = decideVerification({
      runDir, decision: 'accept', verificationContract: sampleContract(), acceptedAt: '2026-07-02T00:00:00.000Z',
    });
    expect(res.decision).toBe('accepted');

    const gate = requireAcceptedVerificationContract({ runDir });
    expect(gate.accepted).toBe(true);
    const saved = JSON.parse(fs.readFileSync(gate.contractPath, 'utf8'));
    for (const f of ['journey_id', 'maker_policy_id', 'verifier_policy_id', 'runtime_checks', 'forbidden_evidence', 'accepted_at']) {
      expect(saved[f]).toBeDefined();
    }
    expect(saved.accepted_at).toBe('2026-07-02T00:00:00.000Z');
  });

  test('rejection does not write a contract, blocks implementation, and names the missing check', () => {
    const runDir = tempRun();
    writeVerificationProposal({ runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: [] });
    const res = decideVerification({
      runDir, decision: 'reject', missingCheck: 'no value-bearing API reread for the state change',
    });
    expect(res.decision).toBe('rejected');
    expect(res.blocksImplementation).toBe(true);
    expect(fs.existsSync(verificationPaths({ runDir }).contractPath)).toBe(false);
    expect(requireAcceptedVerificationContract({ runDir }).accepted).toBe(false);

    const rej = readJsonl(verificationPaths({ runDir }).ledgerPath).find((e) => e.verifier_decision === 'rejected');
    expect(rej.missing_check).toMatch(/reread/);
    expect(rej.blocks_implementation).toBe(true);
    expect(rej.verification_contract_path).toBeNull();
  });

  test('ledger references proposal path, verifier decision, accepted contract path, and mechanical gate state', () => {
    const runDir = tempRun();
    const { proposalPath } = writeVerificationProposal({
      runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: sampleContract().runtime_checks,
    });
    decideVerification({ runDir, decision: 'accept', verificationContract: sampleContract() });

    const led = readJsonl(verificationPaths({ runDir }).ledgerPath);
    expect(led.find((e) => e.event === 'proposal_written').proposal_path).toBe(proposalPath);

    const accepted = led.find((e) => e.verifier_decision === 'accepted');
    expect(accepted.proposal_path).toBe(proposalPath);
    expect(accepted.verification_contract_path).toBe(verificationPaths({ runDir }).contractPath);
    expect(accepted.mechanical_gate_state).toBe('pending'); // gate has NOT run — verifier acceptance is not a pass
  });

  test('a provider exit code or maker summary cannot satisfy the ticket', () => {
    const runDir = tempRun();
    // Cannot accept before a proposal exists (no implicit acceptance from a prior adapter run).
    expect(() => decideVerification({ runDir, decision: 'accept', verificationContract: sampleContract() }))
      .toThrow(/proposal/);

    // Acceptance requires an explicit, complete verification contract — not a truthy adapter result.
    writeVerificationProposal({ runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: sampleContract().runtime_checks });
    expect(() => decideVerification({ runDir, decision: 'accept', verificationContract: { journey_id: 'J' } }))
      .toThrow(/missing field/);
    expect(requireAcceptedVerificationContract({ runDir }).accepted).toBe(false);
  });
});
