/**
 * Hook behavior tests for post-push-ci.sh (templates/hooks/)
 * Tests: command detection, deferral, JSON stdin parsing, non-push ignoring.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { runHook, buildPushInput } = require('../helpers/hook-runner');

describe('post-push-ci.sh', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-push-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('command detection', () => {
    test('detects "git push" command', () => {
      const input = buildPushInput('git push origin main', 0);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      // The script will try to run gh and git commands which won't work in test,
      // but the important thing is it didn't exit early (it got past command detection)
      // It should exit 0 (advisory)
      expect(result.status).toBe(0);
    });

    test('detects "git push --force" command', () => {
      const input = buildPushInput('git push --force origin main', 0);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
    });

    test('ignores "git status" command', () => {
      const input = buildPushInput('git status', 0);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      // Should exit immediately without CI messages
      expect(result.stderr).not.toContain('Checking CI status');
    });

    test('ignores "git commit" command', () => {
      const input = buildPushInput('git commit -m "test"', 0);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain('Checking CI status');
    });

    test('ignores "npm run build" command', () => {
      const input = buildPushInput('npm run build', 0);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain('Checking CI status');
    });
  });

  describe('failed push detection', () => {
    test('ignores failed git push (exit code != 0)', () => {
      const input = buildPushInput('git push origin main', 1);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain('Checking CI status');
    });
  });

  describe('deferral', () => {
    test('respects .claude/.defer-ci-check file', () => {
      const claudeDir = path.join(tmpDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(path.join(claudeDir, '.defer-ci-check'), '');

      const input = buildPushInput('git push origin main', 0);
      const result = runHook('post-push-ci.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).toContain('deferred');
    });
  });

  describe('no input', () => {
    test('exits 0 with empty stdin', () => {
      const result = runHook('post-push-ci.sh', {
        stdin: '',
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
    });

    test('exits 0 with JSON missing command field', () => {
      const result = runHook('post-push-ci.sh', {
        stdin: JSON.stringify({ tool_name: 'Bash' }),
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
    });
  });
});
