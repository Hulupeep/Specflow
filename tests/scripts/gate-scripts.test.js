const fs = require('fs');
const os = require('os');
const path = require('path');
const { createHash } = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const VERIFY_FALSIFICATION = path.join(ROOT, 'scripts', 'verify-falsification.cjs');
const TEARDOWN_GATE = path.join(ROOT, 'scripts', 'teardown-gate.cjs');

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

function runNode(script, args, cwd = ROOT) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
  });
}

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-gates-'));
}

function falsification({ prdHash, verdict = 'PASS' }) {
  const table = '| Claim | Attack |\n|---|---|\n| c1 | a1 |';
  return `PRD SHA-256: ${prdHash}

## Premise Attack
${table}

## Claim Inventory
${table}

## Dependency Audit
${table}

## Acceptance Gate Attack
${table}

## Source / Reality Ledger
${table}

## Overclaim / Scope Leakage
${table}

## Banned-Mode Self-Check
${table}

## Final Verdict
${verdict}
`;
}

describe('Gate A falsification verification', () => {
  test('requires PASS and current PRD hash when Gate A options are used', () => {
    const dir = tmpDir();
    const prdContent = '# PRD\nreal content\n';
    const prd = path.join(dir, 'prd.md');
    const f = path.join(dir, 'falsification.md');
    fs.writeFileSync(prd, prdContent);
    fs.writeFileSync(f, falsification({ prdHash: sha256(prdContent), verdict: 'PASS WITH STIPULATIONS' }));

    const result = runNode(VERIFY_FALSIFICATION, [f, '--require-pass', '--binds-prd', prd]);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('PRD hash matches');
  });

  test('rejects FAIL even when the artifact is structurally complete', () => {
    const dir = tmpDir();
    const prdContent = '# PRD\nreal content\n';
    const prd = path.join(dir, 'prd.md');
    const f = path.join(dir, 'falsification.md');
    fs.writeFileSync(prd, prdContent);
    fs.writeFileSync(f, falsification({ prdHash: sha256(prdContent), verdict: 'FAIL' }));

    const result = runNode(VERIFY_FALSIFICATION, [f, '--require-pass', '--binds-prd', prd]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must be PASS');
  });

  test('rejects a stale PRD hash binding', () => {
    const dir = tmpDir();
    const prd = path.join(dir, 'prd.md');
    const f = path.join(dir, 'falsification.md');
    fs.writeFileSync(prd, '# PRD\nedited content\n');
    fs.writeFileSync(f, falsification({ prdHash: sha256('# PRD\nold content\n'), verdict: 'PASS' }));

    const result = runNode(VERIFY_FALSIFICATION, [f, '--require-pass', '--binds-prd', prd]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('stale PRD hash binding');
  });
});

function writeGateD(dir, { valueEvidence = true, redDisposition = true, policy = null } = {}) {
  fs.mkdirSync(path.join(dir, 'evidence'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'journey-map.md'), [
    '- J: HOP1 value-bearing — balance after rollback',
    '- J: HOP2 — non-value navigation',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'findings.md'), [
    '## J: HOP1',
    'status: green',
    valueEvidence ? 'evidence/oracle.json' : 'evidence/screen.png',
    '',
    '## J: HOP2',
    'status: red',
    redDisposition ? 'disposition: bug' : 'needs follow-up',
    'evidence/hop2.png',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'evidence', 'screen.png'), 'png');
  fs.writeFileSync(path.join(dir, 'evidence', 'hop2.png'), 'png');
  if (valueEvidence) fs.writeFileSync(path.join(dir, 'evidence', 'oracle.json'), '{"balance":2}');
  if (policy) fs.writeFileSync(path.join(dir, 'signoff-policy.json'), JSON.stringify(policy, null, 2));
}

describe('Gate D checks', () => {
  test('passes without signatures when signoff policy is not required', () => {
    const dir = tmpDir();
    writeGateD(dir);

    const result = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Gate D checks pass');
  });

  test('rejects decorative-only evidence for value-bearing hops', () => {
    const dir = tmpDir();
    writeGateD(dir, { valueEvidence: false });

    const result = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('value evidence missing');
  });

  test('rejects red hops without bug or stale-oracle disposition', () => {
    const dir = tmpDir();
    writeGateD(dir, { redDisposition: false });

    const result = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('missing disposition');
  });

  test('requires configured signatures only when signoff policy requires them', () => {
    const dir = tmpDir();
    writeGateD(dir, {
      policy: {
        signoff_policy: {
          required: true,
          artifacts: ['journey-map.md', 'gate-d-result.md'],
        },
      },
    });
    fs.writeFileSync(path.join(dir, 'gate-d-result.md'), 'Gate D result: green\n');

    const unsigned = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);
    expect(unsigned.status).toBe(1);
    expect(unsigned.stderr).toContain('missing sign-off');

    expect(runNode(TEARDOWN_GATE, ['sign', path.join(dir, 'journey-map.md'), '--by', 'tester']).status).toBe(0);
    expect(runNode(TEARDOWN_GATE, ['sign', path.join(dir, 'gate-d-result.md'), '--by', 'tester']).status).toBe(0);

    const signed = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);
    expect(signed.status).toBe(0);
  });

  test('accepts vision verifier finding files only with screenshot evidence', () => {
    const dir = tmpDir();
    fs.mkdirSync(path.join(dir, 'evidence'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'journey-map.md'), '- J: UIHOP — screenshot review\n');
    fs.writeFileSync(path.join(dir, 'evidence', 'screen.png'), 'png');
    fs.writeFileSync(path.join(dir, 'evidence', 'vision.md'), '# Vision verifier\nVerdict: pass\n');
    fs.writeFileSync(path.join(dir, 'findings.md'), [
      '## J: UIHOP',
      'status: green',
      'vision-verifier: evidence/vision.md',
      'screenshot: evidence/screen.png',
      '',
    ].join('\n'));

    const pass = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);
    expect(pass.status).toBe(0);

    fs.writeFileSync(path.join(dir, 'findings.md'), [
      '## J: UIHOP',
      'status: green',
      'vision-verifier: evidence/vision.md',
      '',
    ].join('\n'));
    const fail = runNode(TEARDOWN_GATE, ['check-gate-d', dir]);
    expect(fail.status).toBe(1);
    expect(fail.stderr).toContain('vision evidence incomplete');
  });
});
