const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  runLoop,
  writeVerificationProposal,
  decideVerification,
  verificationPaths,
} = require('../../scripts/specflow-runner.cjs');

// VERIFIER-CONTRACT-01 enforcement in the feature-build 5_impl rail (epic #100).

function setup(overrides = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-implrail-'));
  const runDir = path.join(dir, '.specflow/runs/slice');
  fs.mkdirSync(runDir, { recursive: true });
  const contractPath = path.join(runDir, 'run-contract.yaml');
  const ledgerPath = path.join(runDir, 'ledger.jsonl');
  fs.writeFileSync(contractPath, yaml.dump({
    run_contract: {
      loop: 'feature-build',
      goal: 'implement slice',
      input_artifact: 'docs/x.md',
      path: 'templates/QA/loops/feature-build.yaml',
      current_stage_or_rail: '5_impl',
      next_gate: 'implementation',
      durable_evidence: [contractPath],
      stop_condition: 'handoff',
      never_without_human: ['git push'],
      storage: { contract_path: contractPath, ledger_path: ledgerPath },
    },
  }));
  const policyPath = path.join(dir, 'maker.yaml');
  fs.writeFileSync(policyPath, yaml.dump({
    adapter_policy: {
      id: 'fake-maker',
      provider: 'fake',
      command: 'fake',
      role: 'implementer',
      timeout_seconds: 10,
      max_iterations: 1,
      transcript_path: path.join(runDir, 'maker/transcript.jsonl'),
      output_path: path.join(runDir, 'maker/output.md'),
      dry_run: true,
      never_without_human: ['git push'],
      ...overrides.policy,
    },
  }));
  const promptPath = path.join(dir, 'prompt.md');
  fs.writeFileSync(promptPath, '# stage prompt');
  return { runDir, contractPath, ledgerPath, policyPath, promptPath };
}

function run(env) {
  return runLoop({
    slug: 'slice', contract: env.contractPath, ledger: env.ledgerPath,
    adapterPolicy: env.policyPath, prompt: env.promptPath,
  });
}

describe('VERIFIER-CONTRACT-01 impl-rail enforcement (#100)', () => {
  test('blocks the maker at 5_impl when a proposal exists but no contract is accepted', () => {
    const env = setup();
    writeVerificationProposal({
      runDir: env.runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v',
      runtimeChecks: [{ type: 'api', assertion: 'reread', required: true }],
    });

    const res = run(env);
    expect(res.status).toBe('blocked_verification_required');
    expect(fs.existsSync(path.join(env.runDir, 'maker/output.md'))).toBe(false); // adapter never ran
    const blocked = fs.readFileSync(env.ledgerPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
      .find((e) => e.event === 'impl_blocked');
    expect(blocked.stop_reason).toBe('verification_contract_required');
  });

  test('proceeds once the verification contract is accepted', () => {
    const env = setup();
    writeVerificationProposal({
      runDir: env.runDir, journeyId: 'J', makerPolicyId: 'm', verifierPolicyId: 'v',
      runtimeChecks: [{ type: 'api', assertion: 'reread', required: true }],
    });
    decideVerification({
      runDir: env.runDir, decision: 'accept',
      verificationContract: {
        journey_id: 'J', maker_policy_id: 'm', verifier_policy_id: 'v',
        runtime_checks: [{ type: 'api', assertion: 'reread', required: true }],
        forbidden_evidence: ['maker self-review'],
      },
    });

    const res = run(env);
    expect(res.status).not.toBe('blocked_verification_required');
    expect(res.status).toBe('dry_run'); // fake maker policy runs (dry_run)
  });

  test('does not block runs that never started the verifier lifecycle (backward compatible)', () => {
    const env = setup();
    expect(fs.existsSync(verificationPaths({ runDir: env.runDir }).proposalPath)).toBe(false);
    const res = run(env);
    expect(res.status).toBe('dry_run');
  });
});
