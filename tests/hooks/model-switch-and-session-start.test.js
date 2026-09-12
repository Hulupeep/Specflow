/**
 * Tests for the Claude Code binding hooks (#128):
 *   - session-start.sh   → re-entry briefing from durable run state (CB-004)
 *   - model-switch-hook.sh pre  → blocks a downgrade during top-thinker stages (CB-003)
 *   - model-switch-hook.sh post → ledgers every switch (CB-002)
 *
 * The hooks run against a scratch project containing .specflow/runs/<slug>/run-contract.yaml
 * and .specflow/adapter-routing.yml. js-yaml is resolved from this repo's node_modules via
 * a symlink so the hook exercises the same lookup path an installed project uses.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const HOOKS_DIR = path.join(__dirname, '..', '..', 'hooks');
const SESSION_START = path.join(HOOKS_DIR, 'session-start.sh');
const MODEL_SWITCH = path.join(HOOKS_DIR, 'model-switch-hook.sh');
const SETTINGS_PATH = path.join(HOOKS_DIR, 'settings.json');
const REPO_NODE_MODULES = path.join(__dirname, '..', '..', 'node_modules');

function runHook(script, args, projectDir, stdinJson) {
  return spawnSync('bash', [script, ...args], {
    cwd: projectDir,
    encoding: 'utf-8',
    timeout: 15000,
    input: JSON.stringify(stdinJson || {}),
    env: { ...process.env, CLAUDE_PROJECT_DIR: projectDir },
  });
}

function writeRun(projectDir, slug, contract, ledgerLines = []) {
  const dir = path.join(projectDir, '.specflow', 'runs', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'run-contract.yaml'), yaml.dump({ run_contract: contract }));
  fs.writeFileSync(path.join(dir, 'ledger.jsonl'), ledgerLines.map((l) => JSON.stringify(l)).join('\n') + (ledgerLines.length ? '\n' : ''));
  return dir;
}

function writeRouting(projectDir, doc) {
  const dir = path.join(projectDir, '.specflow');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'adapter-routing.yml'), yaml.dump(doc));
}

const ROUTING = {
  policies: {
    'fable-reviewer': {
      adapter_policy: {
        id: 'fable-reviewer', provider: 'claude-print', command: 'claude', role: 'verifier',
        effort: 'xhigh', model: 'claude-fable-5', requested_model: 'claude-fable-5', fallback_model: 'claude-opus-4-8',
      },
    },
    'gpt55-coder': {
      adapter_policy: { id: 'gpt55-coder', provider: 'codex-exec', command: 'codex', role: 'implementer', model: 'gpt-5.5' },
    },
  },
  routes: {
    'spec-build': {
      adversary: { policy: 'fable-reviewer' },
      tickets: { policy: 'gpt55-coder' },
    },
  },
};

const ADVERSARY_RUN = {
  loop: 'spec-build',
  current_stage_or_rail: 'adversary',
  next_gate: 'verdict written to PRDs/demo-verdict.md',
  terminal_status: 'in_progress',
};

describe('hooks/settings.json registers the binding hooks', () => {
  const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
  const commandsFor = (event) => (settings.hooks[event] || []).flatMap((e) => e.hooks.map((h) => h.command));

  test('SessionStart runs session-start.sh', () => {
    expect(commandsFor('SessionStart').some((c) => c.includes('session-start.sh'))).toBe(true);
  });
  test('PreModelSwitch runs model-switch-hook.sh pre', () => {
    expect(commandsFor('PreModelSwitch').some((c) => c.endsWith('model-switch-hook.sh pre'))).toBe(true);
  });
  test('PostModelSwitch runs model-switch-hook.sh post', () => {
    expect(commandsFor('PostModelSwitch').some((c) => c.endsWith('model-switch-hook.sh post'))).toBe(true);
  });
});

describe('binding hooks', () => {
  let projectDir;

  beforeEach(() => {
    projectDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-hooks-'));
    fs.symlinkSync(REPO_NODE_MODULES, path.join(projectDir, 'node_modules'), 'dir');
  });

  afterEach(() => {
    fs.rmSync(projectDir, { recursive: true, force: true });
  });

  describe('session-start.sh', () => {
    test('exits 0 silently when there are no runs', () => {
      const result = runHook(SESSION_START, [], projectDir, { hook_event_name: 'SessionStart', reason: 'startup' });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe('');
    });

    test('prints the durable position of every non-terminal run and skips handed-off runs', () => {
      writeRun(projectDir, 'demo', ADVERSARY_RUN, [
        { recorded_at: '2026-09-12T10:00:00Z', stage: 'draft', event: 'stage_evidence' },
        { recorded_at: '2026-09-12T10:05:00Z', stage: 'adversary', event: 'gate_failed' },
      ]);
      writeRun(projectDir, 'finished', { ...ADVERSARY_RUN, current_stage_or_rail: 'handoff', terminal_status: 'handoff' });
      const result = runHook(SESSION_START, [], projectDir, { hook_event_name: 'SessionStart', reason: 'resume' });
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('run: demo');
      expect(result.stdout).toContain('stage: adversary');
      expect(result.stdout).toContain('next gate: verdict written to PRDs/demo-verdict.md');
      expect(result.stdout).toContain('last ledger: 2026-09-12T10:05:00Z · adversary · gate_failed');
      expect(result.stdout).not.toContain('run: finished');
    });
  });

  describe('model-switch-hook.sh pre', () => {
    test('allows the routed model during a top-thinker stage', () => {
      writeRun(projectDir, 'demo', ADVERSARY_RUN);
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { hook_event_name: 'PreModelSwitch', from_model: 'claude-opus-5', to_model: 'claude-fable-5' });
      expect(result.status).toBe(0);
    });

    test('allows the declared fallback model (provider-forced fallback lands here)', () => {
      writeRun(projectDir, 'demo', ADVERSARY_RUN);
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-opus-4-8' });
      expect(result.status).toBe(0);
    });

    test('blocks a downgrade below the routed tier during adversary (exit 2, reason on stderr)', () => {
      writeRun(projectDir, 'demo', ADVERSARY_RUN);
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5' });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("run 'demo' is at 'adversary'");
      expect(result.stderr).toContain("requires 'claude-fable-5'");
    });

    test('GATE_B5 inherits the adversary tier when it has no route of its own', () => {
      writeRun(projectDir, 'demo', { ...ADVERSARY_RUN, current_stage_or_rail: 'GATE_B5' });
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-sonnet-5' });
      expect(result.status).toBe(2);
    });

    test('does not guard muscle stages', () => {
      writeRun(projectDir, 'demo', { ...ADVERSARY_RUN, current_stage_or_rail: 'tickets' });
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5' });
      expect(result.status).toBe(0);
    });

    test('fails open when there is no routing file', () => {
      writeRun(projectDir, 'demo', ADVERSARY_RUN);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5' });
      expect(result.status).toBe(0);
    });

    test('fails open when the run is terminal', () => {
      writeRun(projectDir, 'demo', { ...ADVERSARY_RUN, terminal_status: 'handoff' });
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['pre'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5' });
      expect(result.status).toBe(0);
    });
  });

  describe('model-switch-hook.sh post', () => {
    test('appends a model_switch ledger entry to every non-terminal run', () => {
      const dir = writeRun(projectDir, 'demo', ADVERSARY_RUN);
      writeRun(projectDir, 'finished', { ...ADVERSARY_RUN, terminal_status: 'handoff' });
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['post'], projectDir, { session_id: 'sess-1', from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5' });
      expect(result.status).toBe(0);
      const lines = fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf-8').trim().split('\n').map((l) => JSON.parse(l));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatchObject({
        event: 'model_switch', stage: 'adversary', from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5',
        kind: 'switch', routed_policy: 'fable-reviewer', requested_model: 'claude-fable-5', session_id: 'sess-1',
      });
      expect(lines[0].recorded_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(fs.readFileSync(path.join(projectDir, '.specflow', 'runs', 'finished', 'ledger.jsonl'), 'utf-8')).toBe('');
    });

    test('classifies a switch to the declared fallback as kind=fallback', () => {
      const dir = writeRun(projectDir, 'demo', ADVERSARY_RUN);
      writeRouting(projectDir, ROUTING);
      runHook(MODEL_SWITCH, ['post'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-opus-4-8' });
      const entry = JSON.parse(fs.readFileSync(path.join(dir, 'ledger.jsonl'), 'utf-8').trim());
      expect(entry.kind).toBe('fallback');
    });

    test('never blocks, even on a downgrade', () => {
      writeRun(projectDir, 'demo', ADVERSARY_RUN);
      writeRouting(projectDir, ROUTING);
      const result = runHook(MODEL_SWITCH, ['post'], projectDir, { from_model: 'claude-fable-5', to_model: 'claude-haiku-4-5' });
      expect(result.status).toBe(0);
    });
  });
});
