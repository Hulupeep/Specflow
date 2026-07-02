const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  resolveVerifierPolicy,
  assembleVerifierInput,
  requireAcceptedVerificationContract,
  verificationPaths,
} = require('../../scripts/specflow-runner.cjs');

// VERIFIER-POLICY-01 / J-VERIFIER-POLICY-ISOLATION (epic #100)
// The verifier runs from artifact + spec + accepted contract + rubric — NOT the
// maker reasoning trace — and writes to paths separate from the maker.

function tempRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-vpol-'));
}
function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
function verifierPolicyObj(overrides = {}) {
  return {
    id: 'codex-exec-verifier',
    provider: 'codex-exec',
    command: 'codex',
    role: 'verifier',
    timeout_seconds: 600,
    max_iterations: 1,
    transcript_path: '.specflow/runs/<slug>/verifier/transcript.jsonl',
    output_path: '.specflow/runs/<slug>/verifier/finding.md',
    never_without_human: ['git push', 'open PR', 'merge'],
    ...overrides,
  };
}
function makerPolicyObj(adapterOverrides = {}) {
  return {
    adapter_policy: {
      id: 'claude-print-maker',
      provider: 'claude-print',
      command: 'claude',
      role: 'implementer',
      timeout_seconds: 900,
      max_iterations: 1,
      transcript_path: '.specflow/runs/<slug>/maker/transcript.jsonl',
      output_path: '.specflow/runs/<slug>/maker/output.md',
      never_without_human: ['git push', 'open PR', 'merge'],
      verifier_policy: verifierPolicyObj(),
      ...adapterOverrides,
    },
  };
}

describe('VERIFIER-POLICY-01 — verifier policy isolation (J-VERIFIER-POLICY-ISOLATION)', () => {
  test('resolves a verifier policy distinct from the maker policy with separate paths', () => {
    const { maker, verifier } = resolveVerifierPolicy(makerPolicyObj(), { slug: 'demo' });
    expect(verifier.id).not.toBe(maker.id);
    expect(verifier.transcript_path).not.toBe(maker.transcript_path);
    expect(verifier.output_path).not.toBe(maker.output_path);
    expect(verifier.role).toBe('verifier');
  });

  test('rejects a verifier policy that shares the maker output or transcript path', () => {
    const shared = makerPolicyObj({
      verifier_policy: verifierPolicyObj({ output_path: '.specflow/runs/<slug>/maker/output.md' }),
    });
    expect(() => resolveVerifierPolicy(shared, { slug: 'demo' })).toThrow(/output_path must differ/);
  });

  test('throws when no verifier policy is declared', () => {
    const noVerifier = makerPolicyObj({ verifier_policy: undefined });
    expect(() => resolveVerifierPolicy(noVerifier, { slug: 'demo' })).toThrow(/does not declare a verifier_policy/);
  });

  test('verifier input includes artifact/spec/contract/rubric and excludes the maker trace by default', () => {
    const input = assembleVerifierInput({
      artifactPath: '.specflow/runs/demo/maker/output.md',
      specPath: 'docs/specs/verifier-runtime-lifecycle/tickets.md',
      verificationContractPath: '.specflow/runs/demo/verification-contract.json',
      rubric: 'attack the running slice; refute by default',
      makerTranscriptPath: '.specflow/runs/demo/maker/transcript.jsonl',
    });
    expect(input.artifact_path).toBeTruthy();
    expect(input.spec_path).toBeTruthy();
    expect(input.verification_contract_path).toBeTruthy();
    expect(input.rubric).toBeTruthy();
    expect(input.includes_maker_trace).toBe(false);
    expect(input.maker_transcript_path).toBeNull();
  });

  test('including the maker trace requires a human-recorded exception', () => {
    const base = {
      artifactPath: 'a', specPath: 's', verificationContractPath: 'c', rubric: 'r',
      makerTranscriptPath: 't', allowMakerTrace: true,
    };
    expect(() => assembleVerifierInput(base)).toThrow(/human exception/);
  });

  test('a human exception records the maker-trace inclusion in the ledger', () => {
    const runDir = tempRun();
    const ledger = verificationPaths({ runDir }).ledgerPath;
    const input = assembleVerifierInput({
      artifactPath: 'a', specPath: 's', verificationContractPath: 'c', rubric: 'r',
      makerTranscriptPath: '.specflow/runs/x/maker/transcript.jsonl',
      allowMakerTrace: true,
      humanException: { approved_by: 'colm', reason: 'flaky runtime surface; need maker context once' },
      ledger,
    });
    expect(input.includes_maker_trace).toBe(true);
    const entry = readJsonl(ledger).find((e) => e.event === 'verifier_maker_trace_exception');
    expect(entry.approved_by).toBe('colm');
    expect(entry.reason).toMatch(/flaky/);
  });

  test('assembling verifier input has no gate side effect (mechanical gate still owns pass)', () => {
    const runDir = tempRun();
    assembleVerifierInput({ artifactPath: 'a', specPath: 's', verificationContractPath: 'c', rubric: 'r' });
    expect(fs.existsSync(verificationPaths({ runDir }).contractPath)).toBe(false);
    expect(requireAcceptedVerificationContract({ runDir }).accepted).toBe(false);
  });
});
