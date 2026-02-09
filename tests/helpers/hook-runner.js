/**
 * Shared helper: spawn hook shell scripts with JSON stdin and capture output.
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const HOOKS_DIR = path.join(__dirname, '..', '..', 'hooks');
const TEMPLATE_HOOKS_DIR = path.join(__dirname, '..', '..', 'templates', 'hooks');

/**
 * Run a hook script with optional JSON input on stdin.
 * Returns { stdout, stderr, status, signal }.
 */
function runHook(scriptName, { stdin = '', env = {}, cwd } = {}) {
  // Check hooks/ first, then templates/hooks/
  let scriptPath = path.join(HOOKS_DIR, scriptName);
  if (!fs.existsSync(scriptPath)) {
    scriptPath = path.join(TEMPLATE_HOOKS_DIR, scriptName);
  }

  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Hook script not found: ${scriptName} (checked hooks/ and templates/hooks/)`);
  }

  const result = spawnSync('bash', [scriptPath], {
    input: stdin,
    encoding: 'utf-8',
    cwd: cwd || path.join(__dirname, '..', '..'),
    env: {
      ...process.env,
      // Override CLAUDE_PROJECT_DIR to a temp dir to avoid touching real config
      CLAUDE_PROJECT_DIR: cwd || path.join(__dirname, '..', '..'),
      ...env,
    },
    timeout: 10000,
  });

  return {
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    status: result.status,
    signal: result.signal,
  };
}

/**
 * Build a PostToolUse-style JSON payload for Bash commands.
 */
function buildBashInput(command, exitCode = 0) {
  return JSON.stringify({
    tool_name: 'Bash',
    inputs: { command },
    response: { exit_code: exitCode },
  });
}

/**
 * Build a push-style JSON payload (for post-push-ci).
 * post-push-ci uses a simpler format with "command" at top level.
 */
function buildPushInput(command, exitCode = 0) {
  return JSON.stringify({
    command,
    exit_code: exitCode,
  });
}

module.exports = {
  runHook,
  buildBashInput,
  buildPushInput,
  HOOKS_DIR,
  TEMPLATE_HOOKS_DIR,
};
