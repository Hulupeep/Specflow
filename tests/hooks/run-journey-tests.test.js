/**
 * Hook behavior tests for run-journey-tests.sh
 * Tests: journey ID→file mapping, deferral, issue extraction.
 *
 * Note: We test the script's internal functions by examining its behavior
 * in controlled environments, not by actually running git or gh commands.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'hooks', 'run-journey-tests.sh');

describe('run-journey-tests.sh', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-journey-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('gh CLI pre-flight (Bug 3 fix)', () => {
    test('exits 2 when gh CLI is not in PATH', () => {
      // Create empty dir as PATH — no gh available
      const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'no-gh-'));

      const result = spawnSync('/bin/bash', [SCRIPT_PATH], {
        encoding: 'utf-8',
        cwd: tmpDir,
        env: {
          CLAUDE_PROJECT_DIR: tmpDir,
          PATH: fakeBin,
          HOME: tmpDir,
        },
        timeout: 5000,
      });

      fs.rmSync(fakeBin, { recursive: true, force: true });

      // Must exit 2 (model-visible), not 0 (silent false green)
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('gh CLI not installed');
    });

    test('exits 2 when gh CLI is not authenticated', () => {
      // Create a fake gh that fails auth status
      const fakeBin = fs.mkdtempSync(path.join(os.tmpdir(), 'bad-gh-'));
      fs.writeFileSync(
        path.join(fakeBin, 'gh'),
        '#!/bin/bash\nif [ "$1" = "auth" ]; then exit 1; fi\nexit 0\n'
      );
      fs.chmodSync(path.join(fakeBin, 'gh'), 0o755);

      const result = spawnSync('/bin/bash', [SCRIPT_PATH], {
        encoding: 'utf-8',
        cwd: tmpDir,
        env: {
          CLAUDE_PROJECT_DIR: tmpDir,
          PATH: fakeBin,
          HOME: tmpDir,
        },
        timeout: 5000,
      });

      fs.rmSync(fakeBin, { recursive: true, force: true });

      expect(result.status).toBe(2);
      expect(result.stderr).toContain('gh CLI not authenticated');
    });
  });

  describe('ERR trap (Bug 7 fix)', () => {
    test('unexpected errors exit 2, not 1', () => {
      // Replicate the ERR trap from the fixed script
      const result = spawnSync('bash', ['-c', `
        set -e
        trap 'echo "Hook error at line $LINENO" >&2; exit 2' ERR
        cd /nonexistent/path/that/does/not/exist/12345
      `], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      // Before fix: exit 1 (user-only, invisible to Claude)
      // After fix: exit 2 (model-visible via ERR trap)
      expect(result.status).toBe(2);
      expect(result.stderr).toContain('Hook error');
    });
  });

  describe('journey ID regex (Bug 6 fix)', () => {
    const regex = 'J-[A-Z0-9]+(-[A-Z0-9]+)*';

    test.each([
      ['J-AUTH-SIGNUP', 'J-AUTH-SIGNUP'],
      ['J-SIGNUP-FLOW', 'J-SIGNUP-FLOW'],
      ['J-LOGIN', 'J-LOGIN'],
      ['J-A-B-C-D', 'J-A-B-C-D'],
      ['some text J-CHECKOUT-COMPLETE more text', 'J-CHECKOUT-COMPLETE'],
    ])('extracts correct ID from "%s" → %s', (input, expected) => {
      const result = spawnSync('bash', ['-c', `echo "${input}" | grep -oE '${regex}' | head -1`], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      expect(result.stdout.trim()).toBe(expected);
    });

    test('does not match trailing hyphen (the actual bug)', () => {
      const result = spawnSync('bash', ['-c', `echo "J-AUTH-SIGNUP- trailing" | grep -oE '${regex}' | head -1`], {
        encoding: 'utf-8',
        timeout: 5000,
      });
      // Old regex J-[A-Z0-9-]+ would produce "J-AUTH-SIGNUP-" (with trailing hyphen)
      // Fixed regex produces "J-AUTH-SIGNUP" (no trailing hyphen)
      expect(result.stdout.trim()).toBe('J-AUTH-SIGNUP');
    });
  });

  describe('deferral', () => {
    test('exits 0 when .claude/.defer-tests exists', () => {
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, '.defer-tests'), '');

      const result = spawnSync('bash', [SCRIPT_PATH], {
        encoding: 'utf-8',
        cwd: tmpDir,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tmpDir,
        },
        timeout: 5000,
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toContain('deferred');
    });

    test('does not defer when .defer-tests does not exist', () => {
      // Without git, the script will fail at git log, but shouldn't mention deferral
      const result = spawnSync('bash', [SCRIPT_PATH], {
        encoding: 'utf-8',
        cwd: tmpDir,
        env: {
          ...process.env,
          CLAUDE_PROJECT_DIR: tmpDir,
        },
        timeout: 5000,
      });

      expect(result.stderr || '').not.toContain('deferred');
    });
  });

  describe('journey_to_test_file mapping (via inline bash)', () => {
    // Test the sed transformation directly
    test.each([
      ['J-SIGNUP-FLOW', 'tests/e2e/journey_signup_flow.spec.ts'],
      ['J-LOGIN', 'tests/e2e/journey_login.spec.ts'],
      ['J-CHECKOUT-COMPLETE', 'tests/e2e/journey_checkout_complete.spec.ts'],
      ['J-BILLING-UPGRADE', 'tests/e2e/journey_billing_upgrade.spec.ts'],
    ])('maps %s → %s', (journeyId, expectedFile) => {
      // Replicate the shell logic: sed 's/^J-//' | tr '[:upper:]-' '[:lower:]_'
      const result = spawnSync('bash', ['-c', `echo "${journeyId}" | sed 's/^J-//' | tr '[:upper:]-' '[:lower:]_' | xargs -I{} echo "tests/e2e/journey_{}.spec.ts"`], {
        encoding: 'utf-8',
        timeout: 5000,
      });

      expect(result.stdout.trim()).toBe(expectedFile);
    });
  });

  describe('issue extraction (via inline bash)', () => {
    // Test the grep pattern used to extract issue numbers
    test.each([
      ['feat: add signup (#42)', ['42']],
      ['fix: bug (#10) and (#20)', ['10', '20']],
      ['chore: cleanup', []],
      ['feat: multi-issue (#1, #2, #3)', ['1', '2', '3']],
    ])('extracts issues from "%s" → %j', (commitMsg, expectedIssues) => {
      const result = spawnSync('bash', ['-c', `echo "${commitMsg}" | grep -oE '#[0-9]+' | sort -u | tr -d '#'`], {
        encoding: 'utf-8',
        timeout: 5000,
      });

      const found = result.stdout.trim().split('\n').filter(Boolean);
      expect(found.sort()).toEqual(expectedIssues.sort());
    });
  });
});
