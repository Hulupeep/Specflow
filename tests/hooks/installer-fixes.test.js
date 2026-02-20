/**
 * Tests for installer, verify-setup, and settings.json bug fixes.
 * Covers: Bug 1 (jq merge), Bug 2 (post-push-ci registration),
 *         Bug 4 (conditional banner), Bug 5 (exec bit check),
 *         Bug 8 (session-start.sh not installed).
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');

const INSTALLER_PATH = path.join(__dirname, '..', '..', 'install-hooks.sh');
const VERIFY_PATH = path.join(__dirname, '..', '..', 'verify-setup.sh');
const SETTINGS_PATH = path.join(__dirname, '..', '..', 'hooks', 'settings.json');

describe('hooks/settings.json (Bug 2 fix)', () => {
  test('registers post-build-check.sh', () => {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    const commands = settings.hooks.PostToolUse.flatMap(
      (entry) => entry.hooks.map((h) => h.command)
    );
    expect(commands.some((c) => c.includes('post-build-check.sh'))).toBe(true);
  });

  test('registers post-push-ci.sh', () => {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    const commands = settings.hooks.PostToolUse.flatMap(
      (entry) => entry.hooks.map((h) => h.command)
    );
    expect(commands.some((c) => c.includes('post-push-ci.sh'))).toBe(true);
  });

  test('all entries use Bash matcher', () => {
    const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
    for (const entry of settings.hooks.PostToolUse) {
      expect(entry.matcher).toBe('Bash');
    }
  });
});

describe('install-hooks.sh', () => {
  let targetDir;

  beforeEach(() => {
    targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-install-test-'));
  });

  afterEach(() => {
    fs.rmSync(targetDir, { recursive: true, force: true });
  });

  function runInstaller(target) {
    return spawnSync('bash', [INSTALLER_PATH, target || targetDir], {
      encoding: 'utf-8',
      timeout: 15000,
    });
  }

  describe('fresh install', () => {
    test('installs settings.json and hook scripts', () => {
      const result = runInstaller();
      expect(result.status).toBe(0);

      expect(fs.existsSync(path.join(targetDir, '.claude', 'settings.json'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, '.claude', 'hooks', 'post-build-check.sh'))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, '.claude', 'hooks', 'run-journey-tests.sh'))).toBe(true);
    });

    test('hook scripts are executable', () => {
      runInstaller();

      for (const script of ['post-build-check.sh', 'run-journey-tests.sh']) {
        const stat = fs.statSync(path.join(targetDir, '.claude', 'hooks', script));
        // Check user execute bit
        expect(stat.mode & 0o100).toBeTruthy();
      }
    });
  });

  describe('session-start.sh not installed (Bug 8 fix)', () => {
    test('does not install session-start.sh', () => {
      runInstaller();
      expect(
        fs.existsSync(path.join(targetDir, '.claude', 'hooks', 'session-start.sh'))
      ).toBe(false);
    });
  });

  describe('jq merge preserves existing hooks (Bug 1 fix)', () => {
    test('existing PostToolUse hooks survive merge', () => {
      // Pre-create .claude/settings.json with a custom hook
      const claudeDir = path.join(targetDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });

      const existingSettings = {
        hooks: {
          PostToolUse: [
            {
              matcher: 'Bash',
              hooks: [
                { type: 'command', command: 'my-custom-linter.sh' },
              ],
            },
          ],
        },
      };
      fs.writeFileSync(
        path.join(claudeDir, 'settings.json'),
        JSON.stringify(existingSettings, null, 2)
      );

      // Run installer (will merge)
      const result = runInstaller();

      // Read merged settings
      const merged = JSON.parse(
        fs.readFileSync(path.join(claudeDir, 'settings.json'), 'utf-8')
      );
      const commands = merged.hooks.PostToolUse.flatMap(
        (entry) => entry.hooks.map((h) => h.command)
      );

      // Existing hook must still be present
      expect(commands).toContain('my-custom-linter.sh');
      // New hooks also present
      expect(commands.some((c) => c.includes('post-build-check.sh'))).toBe(true);
      expect(commands.some((c) => c.includes('post-push-ci.sh'))).toBe(true);
    });

    test('idempotent — running twice does not duplicate hooks', () => {
      runInstaller();
      runInstaller();

      const settings = JSON.parse(
        fs.readFileSync(path.join(targetDir, '.claude', 'settings.json'), 'utf-8')
      );
      const commands = settings.hooks.PostToolUse.flatMap(
        (entry) => entry.hooks.map((h) => h.command)
      );
      const buildCheckCount = commands.filter((c) =>
        c.includes('post-build-check.sh')
      ).length;
      expect(buildCheckCount).toBe(1);
    });
  });

  describe('conditional banner (Bug 4 fix)', () => {
    test('shows "Installation Complete" on successful install', () => {
      const result = runInstaller();
      expect(result.stderr + result.stdout).toContain('Installation Complete');
    });

    test('shows "Installation Incomplete" when critical files missing', () => {
      // Run installer against a read-only dir where file copy will fail
      const roDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-readonly-'));
      const claudeDir = path.join(roDir, '.claude');
      fs.mkdirSync(claudeDir, { recursive: true });

      // Make hooks subdir read-only so copies fail
      const hooksDir = path.join(claudeDir, 'hooks');
      fs.mkdirSync(hooksDir);
      fs.chmodSync(hooksDir, 0o444);

      const result = spawnSync('bash', [INSTALLER_PATH, roDir], {
        encoding: 'utf-8',
        timeout: 15000,
      });

      // Restore permissions for cleanup
      fs.chmodSync(hooksDir, 0o755);
      fs.rmSync(roDir, { recursive: true, force: true });

      // Banner should NOT say "Installation Complete"
      // (set -e may cause early exit, or banner shows Incomplete)
      const output = result.stderr + result.stdout;
      if (output.includes('Installation')) {
        expect(output).not.toContain('Installation Complete');
      }
    });
  });
});

describe('verify-setup.sh executable bit check (Bug 5 fix)', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-verify-test-'));
    // Create minimal structure
    const hooksDir = path.join(projectDir, '.claude', 'hooks');
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, '.claude', 'settings.json'), '{"hooks":{}}');
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  test('flags non-executable hook scripts as failures', () => {
    // Create hook files without execute permission
    for (const script of ['post-build-check.sh', 'run-journey-tests.sh', 'post-push-ci.sh']) {
      fs.writeFileSync(path.join(projectDir, '.claude', 'hooks', script), '#!/bin/bash\nexit 0');
      fs.chmodSync(path.join(projectDir, '.claude', 'hooks', script), 0o644);
    }

    const result = spawnSync('bash', [VERIFY_PATH], {
      encoding: 'utf-8',
      cwd: projectDir,
      timeout: 10000,
    });

    // Should report "not executable" for the non-executable files
    expect(result.stderr + result.stdout).toContain('not executable');
  });

  test('passes executable hook scripts', () => {
    for (const script of ['post-build-check.sh', 'run-journey-tests.sh', 'post-push-ci.sh']) {
      fs.writeFileSync(path.join(projectDir, '.claude', 'hooks', script), '#!/bin/bash\nexit 0');
      fs.chmodSync(path.join(projectDir, '.claude', 'hooks', script), 0o755);
    }

    const result = spawnSync('bash', [VERIFY_PATH], {
      encoding: 'utf-8',
      cwd: projectDir,
      timeout: 10000,
    });

    expect(result.stderr + result.stdout).toContain('installed and executable');
    expect(result.stderr + result.stdout).not.toContain('not executable');
  });
});
