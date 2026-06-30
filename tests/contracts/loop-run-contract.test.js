const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  buildAdapterCommand,
  containsForbiddenAction,
  normalizeAdapterPolicy,
  runAdapter,
  runLoop,
  validateRunContract,
} = require('../../scripts/specflow-runner.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-run-'));
}

function readJsonl(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
}

describe('local contracted loop runner', () => {
  test('creates a default run_contract and ledger at .specflow/runs/<slug>', () => {
    const dir = tempDir();
    const contract = path.join(dir, '.specflow/runs/demo/run-contract.yaml');
    const ledger = path.join(dir, '.specflow/runs/demo/ledger.jsonl');

    const result = runLoop({
      loop: 'spec-build',
      slug: 'demo',
      goal: 'ready tickets',
      input: 'docs/idea.md',
      contract,
      ledger,
    });

    expect(result.status).toBe('agent_action_required');
    expect(fs.existsSync(contract)).toBe(true);
    expect(fs.existsSync(ledger)).toBe(true);

    const saved = yaml.load(fs.readFileSync(contract, 'utf8')).run_contract;
    expect(saved.loop).toBe('spec-build');
    expect(saved.storage.contract_path).toBe(contract);
    expect(saved.storage.ledger_path).toBe(ledger);

    const entries = readJsonl(ledger);
    expect(entries).toHaveLength(1);
    expect(entries[0].stop_reason).toBe('agent_action_required');
  });

  test('resumes from an existing contract instead of restarting discovery', () => {
    const dir = tempDir();
    const contract = path.join(dir, 'run-contract.yaml');
    const ledger = path.join(dir, 'ledger.jsonl');
    fs.writeFileSync(contract, yaml.dump({
      run_contract: {
        loop: 'spec-build',
        goal: 'resume demo',
        input_artifact: 'docs/idea.md',
        path: 'templates/QA/loops/spec-build.yaml',
        current_stage_or_rail: 'GATE_B5',
        next_gate: 'simulation',
        durable_evidence: [contract, ledger],
        stop_condition: 'handoff',
        never_without_human: ['git push'],
      },
    }));

    const result = runLoop({ loop: 'spec-build', slug: 'demo', contract, ledger });
    expect(result.status).toBe('agent_action_required');
    expect(readJsonl(ledger)[0].stage).toBe('GATE_B5');
  });

  test('invalid run_contract names missing fields and does not advance', () => {
    const dir = tempDir();
    const contract = path.join(dir, 'run-contract.yaml');
    const ledger = path.join(dir, 'ledger.jsonl');
    fs.writeFileSync(contract, yaml.dump({
      run_contract: {
        loop: 'spec-build',
        goal: 'bad',
        input_artifact: 'docs/idea.md',
      },
    }));

    const result = runLoop({ loop: 'spec-build', slug: 'bad', contract, ledger });
    expect(result.status).toBe('invalid_contract');
    expect(result.errors).toContain('run_contract.next_gate is required');
    expect(readJsonl(ledger)[0].stop_reason).toBe('invalid_contract');
  });

  test('validateRunContract rejects unsupported loops', () => {
    const result = validateRunContract({
      loop: 'made-up',
      goal: 'x',
      input_artifact: 'x',
      path: 'x',
      current_stage_or_rail: 'x',
      next_gate: 'x',
      durable_evidence: ['x'],
      stop_condition: 'x',
      never_without_human: ['x'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('unsupported');
  });
});

describe('generative adapter policy and command builders', () => {
  test('normalizes and validates adapter policy', () => {
    const policy = normalizeAdapterPolicy({
      id: 'safe',
      provider: 'claude-print',
      command: 'claude',
      timeout_seconds: 30,
      max_iterations: 1,
      transcript_path: '.specflow/runs/<slug>/adapter/out.jsonl',
      output_path: '.specflow/runs/<slug>/adapter/final.md',
      never_without_human: ['git push'],
    }, { slug: 'demo' });

    expect(policy.transcript_path).toBe('.specflow/runs/demo/adapter/out.jsonl');
    expect(policy.output_path).toBe('.specflow/runs/demo/adapter/final.md');
  });

  test('builds Claude print command with safety flags', () => {
    const command = buildAdapterCommand({
      provider: 'claude-print',
      command: 'claude',
      args: [],
      model: 'sonnet',
      max_budget_usd: 2,
      allowed_tools: ['Read'],
      denied_tools: ['Bash(git push *)'],
    });
    expect(command.command).toBe('claude');
    expect(command.args).toContain('-p');
    expect(command.args).toContain('--output-format');
    expect(command.args).toContain('--max-budget-usd');
    expect(command.args).toContain('--allowedTools');
    expect(command.args).toContain('--disallowedTools');
  });

  test('builds Codex exec command with JSONL output controls', () => {
    const command = buildAdapterCommand({
      provider: 'codex-exec',
      command: 'codex',
      args: ['--sandbox', 'workspace-write', '--ask-for-approval', 'never'],
      model: 'gpt-5',
      profile: 'pro',
    });
    expect(command.command).toBe('codex');
    expect(command.args.slice(0, 2)).toEqual(['exec', '--sandbox']);
    expect(command.args).toContain('--json');
    expect(command.args).toContain('--model');
    expect(command.args).toContain('--profile');
  });

  test('detects forbidden human-gate actions in provider output', () => {
    expect(containsForbiddenAction('I will now run git push origin branch', ['git push'])).toBe('git push');
    expect(containsForbiddenAction('safe output', ['git push'])).toBe(null);
  });
});

describe('generative adapter execution with fake provider', () => {
  function fakePolicy(dir, overrides = {}) {
    return {
      id: 'fake',
      provider: 'fake',
      command: 'fake-provider',
      args: [],
      timeout_seconds: 10,
      max_iterations: 1,
      transcript_path: path.join(dir, 'transcript.jsonl'),
      output_path: path.join(dir, 'final.md'),
      never_without_human: ['git push'],
      ...overrides,
    };
  }

  test('dry-run prints planned command without invoking provider', () => {
    const dir = tempDir();
    const result = runAdapter(fakePolicy(dir), { dryRun: true });
    expect(result.status).toBe('dry_run');
    expect(result.entry.stop_reason).toBe('dry_run');
    expect(fs.existsSync(path.join(dir, 'transcript.jsonl'))).toBe(false);
  });

  test('successful fake provider writes transcript/output and requires gate rerun', () => {
    const dir = tempDir();
    const result = runAdapter(fakePolicy(dir, { fake_stdout: '{"ok":true}\n' }), {
      owningGateCommand: 'node scripts/verify-falsification.cjs ...',
    });
    expect(result.status).toBe('gate_rerun_required');
    expect(result.entry.owning_gate_command).toContain('verify-falsification');
    expect(fs.readFileSync(path.join(dir, 'final.md'), 'utf8')).toContain('"ok"');
  });

  test('provider failure preserves transcript evidence', () => {
    const dir = tempDir();
    const result = runAdapter(fakePolicy(dir, { fake_exit_code: 2, fake_stderr: 'bad output' }));
    expect(result.status).toBe('adapter_failed');
    expect(result.entry.stop_reason).toBe('adapter_failed');
    expect(fs.readFileSync(path.join(dir, 'transcript.jsonl'), 'utf8')).toContain('bad output');
  });

  test('missing provider stops before invocation with adapter_unavailable', () => {
    const dir = tempDir();
    const result = runAdapter({
      id: 'missing',
      provider: 'claude-print',
      command: 'definitely-not-a-real-specflow-provider',
      args: ['-p'],
      timeout_seconds: 1,
      max_iterations: 1,
      transcript_path: path.join(dir, 'transcript.jsonl'),
      output_path: path.join(dir, 'final.md'),
      never_without_human: ['git push'],
    });

    expect(result.status).toBe('adapter_unavailable');
    expect(result.entry.stop_reason).toBe('adapter_unavailable');
    expect(fs.existsSync(path.join(dir, 'transcript.jsonl'))).toBe(false);
  });

  test('forbidden action blocks stage advance', () => {
    const dir = tempDir();
    const result = runAdapter(fakePolicy(dir, { fake_stdout: 'next I will git push origin main' }));
    expect(result.status).toBe('blocked_human_required');
    expect(result.entry.forbidden_action_detected).toBe('git push');
  });
});
