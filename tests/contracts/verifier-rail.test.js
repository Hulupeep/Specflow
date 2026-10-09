const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  runVerifierStage,
  runRuntimeChecks,
  verifierRequiredForSlice,
  verifierGateDecision,
  runLoop,
  verifierTrace,
  verificationPaths,
  writeVerificationProposal,
  decideVerification,
} = require('../../scripts/specflow-runner.cjs');

// VERIFIER-RAIL-01 / J-VERIFIER-RAIL (issue #102)

function tempRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-rail-'));
}
const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';

function acceptContract(runDir, checks) {
  writeVerificationProposal({ runDir, journeyId: 'J-VERIFIER-RAIL', makerPolicyId: 'm', verifierPolicyId: 'v', runtimeChecks: checks });
  decideVerification({
    runDir, decision: 'accept',
    verificationContract: {
      journey_id: 'J-VERIFIER-RAIL', maker_policy_id: 'm', verifier_policy_id: 'v',
      runtime_checks: checks, forbidden_evidence: ['maker self-review'],
    },
  });
}

describe('VERIFIER-RAIL-01 — enforced runtime verifier stage (#102)', () => {
  test('AC2/AC10: required-by-slice-type detection with escape modes', () => {
    expect(verifierRequiredForSlice(['ui'])).toBe(true);
    expect(verifierRequiredForSlice(['data_mutation'])).toBe(true);
    expect(verifierRequiredForSlice(['docs'])).toBe(false);
    expect(verifierRequiredForSlice(['docs'], { mode: 'always' })).toBe(true);
    expect(verifierRequiredForSlice(['ui'], { mode: 'never' })).toBe(false);
  });

  test('AC4/AC5: gate decision blocks on missing/blocked/failed required findings', () => {
    expect(verifierGateDecision([])).toBe('blocked');
    expect(verifierGateDecision([{ required: true, verifier_result: 'blocked' }])).toBe('blocked');
    expect(verifierGateDecision([{ required: true, verifier_result: 'fail' }])).toBe('fail');
    expect(verifierGateDecision([{ required: true, verifier_result: 'pass' }])).toBe('pass');
  });

  test.each([undefined, null, 'unknown', 'pending', 'PASS', false])('#190: incomplete or unknown required results never pass (%s)', result => {
    expect(verifierGateDecision([{ required: true, verifier_result: result }])).toBe('blocked');
  });

  test.each([null, {}, [null], [{ required: 'false', verifier_result: 'pass' }]])('#190: malformed findings block rather than throwing (%j)', findings => {
    expect(verifierGateDecision(findings)).toBe('blocked');
  });

  test('#190: accepted inventory detects dropped, duplicated, substituted and downgraded findings', () => {
    const checks = [
      { id: 'AC-create', type: 'api', assertion: 'create', required: true },
      { id: 'AC-reread', type: 'db-reread', assertion: 'reread', required: true },
    ];
    const { findings } = runRuntimeChecks({ runDir: tempRun(), checks, runner: () => ({ executable: true, result: 'pass' }) });
    expect(verifierGateDecision(findings, checks)).toBe('pass');
    expect(verifierGateDecision(findings.slice(0, 1), checks)).toBe('blocked');
    expect(verifierGateDecision([findings[0], findings[0]], checks)).toBe('blocked');
    expect(verifierGateDecision([...findings, findings[1]], checks)).toBe('blocked');
    expect(verifierGateDecision([findings[0], { ...findings[1], check_id: 'other' }], checks)).toBe('blocked');
    expect(verifierGateDecision([findings[0], { ...findings[1], check_sha256: 'other' }], checks)).toBe('blocked');
    expect(verifierGateDecision([findings[0], { ...findings[1], required: false }], checks)).toBe('blocked');
  });

  test.each([{}, { executable: true, result: 'pending' }, { result: 'pass' }, { executable: false, result: 'pass' }])('#190: real stage records malformed runner evidence as blocked (%j)', outcome => {
    const runDir = tempRun();
    acceptContract(runDir, [{ type: 'api', assertion: 'reread', required: true }]);
    const result = runVerifierStage({ runDir, sliceTags: ['api_behavior'], makerClaim: 'complete', runner: () => outcome });
    expect(result).toMatchObject({ status: 'blocked', gate: 'blocked', summary: { pass: 0, blocked: 1 } });
    const findings = fs.readFileSync(verificationPaths({ runDir }).findingsPath, 'utf8').trim().split('\n').map(JSON.parse);
    expect(findings[0]).toMatchObject({ verifier_result: 'blocked', required: true });
    expect(fs.readFileSync(verificationPaths({ runDir }).ledgerPath, 'utf8')).toContain('maker_claimed_complete_but_gate_blocked');
  });

  test('#190: runner exceptions are auditable blockers and runner mutation cannot downgrade checks', () => {
    const runDir = tempRun();
    acceptContract(runDir, [{ type: 'api', assertion: 'reread', required: true }]);
    const result = runVerifierStage({ runDir, sliceTags: ['api_behavior'], runner: check => { check.required = false; throw Error('backend unavailable'); } });
    expect(result).toMatchObject({ gate: 'blocked', findings: [{ required: true, reason: 'runtime runner threw: backend unavailable' }] });
  });

  test('#190: caller cannot omit, replace or reclassify accepted checks before execution', () => {
    const runDir = tempRun();
    const checks = [
      { type: 'api', command: PASS, assertion: 'create', required: true },
      { type: 'db-reread', command: FAIL, assertion: 'reread', required: true },
    ];
    acceptContract(runDir, checks);
    const runner = jest.fn(() => ({ executable: true, result: 'pass' }));
    for (const replacement of [[], checks.slice(0, 1), [checks[0], { ...checks[1], command: PASS }], [checks[0], { ...checks[1], required: false }]]) {
      expect(runVerifierStage({ runDir, sliceTags: ['api_behavior'], checks: replacement, runner })).toMatchObject({ gate: 'blocked', reason: expect.stringContaining('accepted verification contract') });
    }
    expect(runner).not.toHaveBeenCalled();
    expect(runVerifierStage({ runDir, sliceTags: ['api_behavior'], checks }).gate).toBe('fail');
  });

  test('#190: value-bearing tag cannot be downgraded and an optional reread cannot decide completion', () => {
    const runDir = tempRun();
    acceptContract(runDir, [
      { type: 'screenshot', command: PASS, required: true },
      { type: 'api', command: FAIL, required: false },
    ]);
    expect(runVerifierStage({ runDir, sliceTags: ['data_mutation'], valueBearing: false }).gate).toBe('blocked');
  });

  test('AC10: doc-only slice is not required', () => {
    expect(runVerifierStage({ runDir: tempRun(), sliceTags: ['docs'] }).status).toBe('not_required');
  });

  test('AC1/AC4: blocks when required but no accepted contract', () => {
    const r = runVerifierStage({ runDir: tempRun(), sliceTags: ['ui'] });
    expect(r.gate).toBe('blocked');
    expect(r.reason).toMatch(/verification contract/);
  });

  test('AC2/AC3: runs checks and passes; findings written to verifier-findings.jsonl', () => {
    const runDir = tempRun();
    acceptContract(runDir, [{ type: 'api', command: PASS, assertion: 'reread', required: true }]);
    const r = runVerifierStage({ runDir, sliceTags: ['api_behavior'], makerClaim: 'complete' });
    expect(r.status).toBe('passed');
    expect(fs.existsSync(verificationPaths({ runDir }).findingsPath)).toBe(true);
  });

  test('AC5: blocks when a required runtime check fails', () => {
    const runDir = tempRun();
    acceptContract(runDir, [{ type: 'playwright', command: FAIL, assertion: 'space moves player', required: true }]);
    const r = runVerifierStage({ runDir, sliceTags: ['ui'], makerClaim: 'complete' });
    expect(r.gate).toBe('fail');
    expect(r.status).toBe('blocked');
  });

  test('AC6: screenshot-only cannot satisfy a value-bearing slice', () => {
    const runDir = tempRun();
    acceptContract(runDir, [{ type: 'screenshot', command: PASS, assertion: 'renders', required: true }]);
    const r = runVerifierStage({ runDir, sliceTags: ['data_mutation'] });
    expect(r.gate).toBe('blocked');
    expect((r.errors || []).join()).toMatch(/screenshot-only/);
  });

  test('AC9: human-only override requires a reason and is ledgered', () => {
    const runDir = tempRun();
    expect(() => runVerifierStage({ runDir, sliceTags: ['ui'], humanSkip: { approved_by: 'colm' } })).toThrow();
    const r = runVerifierStage({ runDir, sliceTags: ['ui'], humanSkip: { approved_by: 'colm', reason: 'infra outage' } });
    expect(r.status).toBe('skipped_human_override');
    expect(fs.readFileSync(verificationPaths({ runDir }).ledgerPath, 'utf8')).toMatch(/verifier_skip_override/);
  });

  test('AC8: the rail catches a real behavior bug (looks done, space does nothing)', () => {
    const broken = tempRun();
    acceptContract(broken, [{ type: 'playwright', command: 'BEHAVIOR_BUG=1 node examples/verifier-rail-proof/journey.js', assertion: 'space moves player', required: true }]);
    expect(runVerifierStage({ runDir: broken, sliceTags: ['ui'], makerClaim: 'complete' }).status).toBe('blocked');

    const fixed = tempRun();
    acceptContract(fixed, [{ type: 'playwright', command: 'node examples/verifier-rail-proof/journey.js', assertion: 'space moves player', required: true }]);
    expect(runVerifierStage({ runDir: fixed, sliceTags: ['ui'], makerClaim: 'complete' }).status).toBe('passed');
  });

  test('AC1/AC5/AC7: wired into runLoop — blocked_verifier_stage at 6_provenance + trace divergence', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-rail-loop-'));
    const runDir = path.join(dir, '.specflow/runs/slice');
    fs.mkdirSync(runDir, { recursive: true });
    const contractPath = path.join(runDir, 'run-contract.yaml');
    const ledgerPath = path.join(runDir, 'ledger.jsonl');
    fs.writeFileSync(contractPath, yaml.dump({
      run_contract: {
        loop: 'feature-build', goal: 'g', input_artifact: 'x', path: 'templates/QA/loops/feature-build.yaml',
        ...require('../helpers/spec-density').fixture(dir),
        current_stage_or_rail: '6_provenance', next_gate: 'provenance', durable_evidence: [contractPath],
        stop_condition: 'handoff', never_without_human: ['git push'],
        slice_tags: ['ui'], maker_claim: 'complete',
        storage: { contract_path: contractPath, ledger_path: ledgerPath },
      },
    }));
    acceptContract(runDir, [{ type: 'playwright', command: FAIL, assertion: 'space moves player', required: true }]);

    const res = runLoop({ slug: 'slice', contract: contractPath, ledger: ledgerPath });
    expect(res.status).toBe('blocked_verifier_stage');
    expect(verifierTrace({ runDir }).divergence).toContain('maker_claimed_done_but_verifier_failed');
  });

  test('AC10: runLoop backward-compatible — doc-only slice does not hit the verifier stage', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-rail-bc-'));
    const runDir = path.join(dir, '.specflow/runs/slice');
    fs.mkdirSync(runDir, { recursive: true });
    const contractPath = path.join(runDir, 'run-contract.yaml');
    const ledgerPath = path.join(runDir, 'ledger.jsonl');
    fs.writeFileSync(contractPath, yaml.dump({
      run_contract: {
        loop: 'feature-build', goal: 'g', input_artifact: 'x', path: 'templates/QA/loops/feature-build.yaml',
        current_stage_or_rail: '6_provenance', next_gate: 'provenance', durable_evidence: [contractPath],
        stop_condition: 'handoff', never_without_human: ['git push'],
        storage: { contract_path: contractPath, ledger_path: ledgerPath },
      },
    }));
    const res = runLoop({ slug: 'slice', contract: contractPath, ledger: ledgerPath });
    expect(res.status).not.toBe('blocked_verifier_stage');
  });
});
