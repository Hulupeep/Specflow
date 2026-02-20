/**
 * Hook behavior tests for post-build-check.sh
 * Tests: build command detection, commit detection, non-build ignoring.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { runHook, buildBashInput } = require('../helpers/hook-runner');

// Use a temp dir so the hook can't accidentally run real journey tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-hook-test-'));

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('post-build-check.sh', () => {
  // The hook calls run-journey-tests.sh on build/commit detection.
  // Since that script won't exist in our temp dir, it will print a warning
  // and exit 0. We test that the hook reaches that point (or exits 0 silently).

  describe('build command detection', () => {
    test.each([
      'npm run build',
      'pnpm build',
      'yarn build',
      'pnpm run build',
      'next build',
      'vite build',
      'turbo build',
      // Bug 10: non-Node build commands
      'make build',
      'cargo build',
      'go build',
      'gradle build',
      'mvn package',
      'mvn compile',
      'tsc',
      'tsc --noEmit',
      'webpack',
      'webpack --mode production',
      'pnpm run build && echo done',
      'turbo run build',
    ])('detects "%s" as a build command', (cmd) => {
      const input = buildBashInput(cmd, 0);
      const result = runHook('post-build-check.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      // Should detect the build command (stderr will mention build or warning about missing script)
      expect(result.status).toBe(0);
      // Either it detected the build or warned about missing journey script
      const output = result.stderr;
      expect(
        output.includes('Build/commit detected') ||
        output.includes('run-journey-tests.sh not found')
      ).toBe(true);
    });
  });

  describe('commit command detection', () => {
    test('detects "git commit -m ..." as a commit command', () => {
      const input = buildBashInput('git commit -m "feat: add feature (#42)"', 0);
      const result = runHook('post-build-check.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      const output = result.stderr;
      expect(
        output.includes('Build/commit detected') ||
        output.includes('run-journey-tests.sh not found')
      ).toBe(true);
    });
  });

  describe('non-build commands are ignored', () => {
    test.each([
      'git status',
      'git diff',
      'npm test',
      'npm run lint',
      'ls -la',
      'echo hello',
      'cat README.md',
    ])('ignores "%s" silently', (cmd) => {
      const input = buildBashInput(cmd, 0);
      const result = runHook('post-build-check.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain('Build/commit detected');
    });
  });

  describe('failed commands are ignored', () => {
    test('ignores failed build command', () => {
      const input = buildBashInput('npm run build', 1);
      const result = runHook('post-build-check.sh', {
        stdin: input,
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain('Build/commit detected');
    });
  });

  describe('missing/empty input', () => {
    test('exits 0 with no stdin', () => {
      const result = runHook('post-build-check.sh', {
        stdin: '',
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
    });

    test('exits 0 with empty JSON', () => {
      const result = runHook('post-build-check.sh', {
        stdin: '{}',
        cwd: tmpDir,
      });
      expect(result.status).toBe(0);
    });
  });
});
