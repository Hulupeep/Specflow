const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  validateRuntimeChecks,
  runRuntimeChecks,
  verifierTrace,
  verificationPaths,
} = require('../../scripts/specflow-runner.cjs');

// VERIFIER-RUNTIME-01 / J-VERIFIER-RUNTIME-EVIDENCE (epic #100)

function tempRun() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-vrt-'));
}
function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
}
const PASS = 'node -e "process.exit(0)"';
const FAIL = 'node -e "process.exit(1)"';

describe('VERIFIER-RUNTIME-01 — runtime evidence (J-VERIFIER-RUNTIME-EVIDENCE)', () => {
  test('validates check types and UI / value-bearing requirements', () => {
    expect(validateRuntimeChecks([{ type: 'bogus' }]).ok).toBe(false);
    expect(validateRuntimeChecks([{ type: 'playwright' }], { uiOrWorkflow: true }).ok).toBe(false); // none required
    expect(validateRuntimeChecks([{ type: 'playwright', required: true }], { uiOrWorkflow: true }).ok).toBe(true);

    const screenshotOnly = validateRuntimeChecks([{ type: 'screenshot', required: true }], { valueBearing: true });
    expect(screenshotOnly.ok).toBe(false);
    expect(screenshotOnly.errors.join()).toMatch(/screenshot-only/);
    expect(validateRuntimeChecks([{ type: 'api', required: true }], { valueBearing: true }).ok).toBe(true);
  });

  test('normalizes supplied-state metadata only; actual native execution has separate TE tests', () => {
    const runDir = tempRun();
    const { findings, summary } = runRuntimeChecks({
      runDir,
      makerClaim: 'done',
      runner: check => ({ executable: true, result: check.command === PASS ? 'pass' : 'fail' }), // explicit unit input, not owning evidence
      checks: [
        { type: 'api', command: PASS, assertion: 'reread returns 200', required: true },
        { type: 'playwright', command: FAIL, assertion: 'space bar moves player', required: true },
      ],
    });
    expect(summary).toMatchObject({ total: 2, pass: 1, fail: 1 });
    expect(findings.every(f => f.evidence_kind === 'supplied_state')).toBe(true);

    const written = readJsonl(verificationPaths({ runDir }).findingsPath);
    for (const f of written) {
      for (const field of ['severity', 'check_type', 'maker_claim', 'verifier_result', 'gate_result']) {
        expect(f[field]).toBeDefined();
      }
      expect(f.gate_result).toBe('pending'); // never a gate pass
    }
    expect(findings.find((f) => f.check_type === 'playwright').severity).toBe('critical');
  });

  test('missing executable surface yields a BLOCKED finding, not fabricated evidence', () => {
    const runDir = tempRun();
    const { findings } = runRuntimeChecks({
      runDir,
      checks: [{ type: 'api', assertion: 'reread the created row', required: true }], // no command
    });
    expect(findings[0].verifier_result).toBe('blocked');
    expect(findings[0].severity).toBe('blocked');
    expect(findings[0].reason).toMatch(/native execution adapter/);
    expect(findings[0].evidence_path).toBeNull();
  });

  test('a supported runner can inject results (no real browser needed)', () => {
    const runDir = tempRun();
    const runner = (c) => ({ executable: true, result: 'pass', evidence_path: `runtime-evidence/${c.type}.png` });
    const { findings } = runRuntimeChecks({
      runDir, checks: [{ type: 'screenshot', assertion: 'renders', required: true }], runner,
    });
    expect(findings[0].verifier_result).toBe('pass');
    expect(findings[0].evidence_path).toMatch(/screenshot\.png/);
  });

  test('supplied historical findings feed trace metadata without claiming native proof', () => {
    const runDir = tempRun();
    fs.appendFileSync(verificationPaths({ runDir }).ledgerPath,
      `${JSON.stringify({ event: 'maker_claim', claim: 'done' })}\n`);
    runRuntimeChecks({ runDir, makerClaim: 'done', runner: () => ({ executable: true, result: 'fail' }), checks: [{ type: 'api', command: FAIL, assertion: 'reread', required: true }] });

    const t = verifierTrace({ runDir });
    expect(t.verifier.findings_count).toBe(1);
    expect(t.divergence).toContain('maker_claimed_done_but_verifier_failed');
  });
});
