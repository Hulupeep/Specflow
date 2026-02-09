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
