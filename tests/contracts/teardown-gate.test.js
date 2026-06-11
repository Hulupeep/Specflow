/**
 * teardown-gate.cjs — the daily-use-teardown mechanical gates (adversary F1/S1 fixes).
 * Proves: hash-bound sign-off (edit-after-sign fails), skipped-journey detection,
 * dangling-evidence detection, and the happy path.
 */

const { execFileSync } = require('child_process');
const { mkdtempSync, writeFileSync, mkdirSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');

const GATE = join(__dirname, '../../scripts/teardown-gate.cjs');

function run(args, cwd) {
  try {
    execFileSync('node', [GATE, ...args], { cwd, stdio: 'pipe' });
    return 0;
  } catch (e) {
    return e.status ?? 2;
  }
}

function makeTeardown(dir, { signMap = true, skipJourney = false, danglingEvidence = false } = {}) {
  mkdirSync(join(dir, 'evidence'), { recursive: true });
  writeFileSync(join(dir, 'evidence/01-login.png'), 'fake-png');
  writeFileSync(join(dir, 'journey-map.md'),
    '# Journey map\n- J: LOGIN — sign in and land on the dashboard\n- J: TRIAGE — review overnight alerts\n');
  const triageEvidence = danglingEvidence ? 'evidence/99-missing.png' : 'evidence/01-login.png';
  let findings = '## J: LOGIN\nVerdict: WORKS\nevidence/01-login.png\n';
  if (!skipJourney) findings += `## J: TRIAGE\nVerdict: CONFUSING [hypothesis]\n${triageEvidence}\n`;
  writeFileSync(join(dir, 'findings.md'), findings);
  if (signMap) run(['sign', join(dir, 'journey-map.md'), '--by', 'Colm'], dir);
}

describe('teardown-gate', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'td-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  test('happy path: signed map + complete findings + resolving evidence → pass', () => {
    makeTeardown(dir);
    expect(run(['check', dir])).toBe(0);
  });

  test('unsigned map → gate fails (a confirmed-by line in the map counts for nothing)', () => {
    makeTeardown(dir, { signMap: false });
    writeFileSync(join(dir, 'journey-map.md'),
      '# Journey map\nconfirmed-by: Colm\n- J: LOGIN — sign in\n- J: TRIAGE — review alerts\n'); // forged line
    expect(run(['check', dir])).toBe(1);
  });

  test('HASH BINDING: map edited AFTER sign-off → stale, gate fails', () => {
    makeTeardown(dir);
    writeFileSync(join(dir, 'journey-map.md'),
      '# Journey map\n- J: LOGIN — sign in\n- J: TRIAGE — review alerts\n- J: SNEAKED — added after sign-off\n');
    expect(run(['check', dir])).toBe(1);
  });

  test('journey silently skipped (in map, no findings entry) → gate fails', () => {
    makeTeardown(dir, { skipJourney: true });
    expect(run(['check', dir])).toBe(1);
  });

  test('dangling evidence reference → gate fails', () => {
    makeTeardown(dir, { danglingEvidence: true });
    expect(run(['check', dir])).toBe(1);
  });

  test('signed do-list passes; edited-after-sign do-list fails', () => {
    makeTeardown(dir);
    writeFileSync(join(dir, 'do-list.md'), '1. TRIAGE stall at filter [hypothesis] — evidence/01-login.png\n');
    run(['sign', join(dir, 'do-list.md'), '--by', 'Colm'], dir);
    expect(run(['check', dir])).toBe(0);
    writeFileSync(join(dir, 'do-list.md'), '1. something the agent rewrote\n');
    expect(run(['check', dir])).toBe(1);
  });
});
