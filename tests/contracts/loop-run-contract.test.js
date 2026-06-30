const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  buildAdapterCommand,
  containsForbiddenAction,
  executeVerifierRegistry,
  forbiddenFromProviderEvents,
  isSimulationFresh,
  loopSequence,
  materializeStagePrompt,
  normalizeAdapterPolicy,
  parseProviderEvents,
  planAdapterSmoke,
  runAdapter,
  runLoop,
  runStatus,
  runUntilTerminal,
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

  test('loads stage order from loop YAML instead of only hardcoded defaults', () => {
    const sequence = loopSequence({
      loop: 'spec-build',
      path: 'templates/QA/loops/spec-build.yaml',
      current_stage_or_rail: 'GATE_B',
    });

    expect(sequence).toEqual(['discover', 'draft', 'adversary', 'GATE_A', 'tickets', 'GATE_B', 'GATE_B5']);
  });

  test('materializes a stage prompt when agent action is required', () => {
    const dir = tempDir();
    const contractPath = path.join(dir, 'run-contract.yaml');
    const result = materializeStagePrompt({
      loop: 'feature-build',
      goal: 'finish loop runtime',
      input_artifact: 'docs/specs/genuine-looper/prd.md',
      path: 'templates/QA/loops/feature-build.yaml',
      current_stage_or_rail: '5_impl',
      next_gate: 'smallest mergeable slice',
      durable_evidence: [contractPath],
      stop_condition: 'handoff',
      never_without_human: ['git push'],
      storage: { contract_path: contractPath },
    }, { contractPath });

    expect(fs.existsSync(result.promptPath)).toBe(true);
    expect(fs.readFileSync(result.promptPath, 'utf8')).toContain('Current stage: 5_impl');
    expect(fs.readFileSync(result.promptPath, 'utf8')).toContain('Never without human: git push');
  });

  test('bounded run-until-terminal advances through green registries and stops at next agent stage', () => {
    const dir = tempDir();
    const specDir = path.join(dir, 'spec');
    fs.mkdirSync(specDir);
    fs.writeFileSync(path.join(specDir, 'contract.yml'), yaml.dump({
      journeys: [{ journey_meta: { id: 'J-LOOP-RUNTIME' } }],
    }));
    fs.writeFileSync(path.join(specDir, 'issues.json'), JSON.stringify([
      { number: 82, title: 'runtime', body: 'Journey IDs: J-LOOP-RUNTIME' },
    ]));
    fs.writeFileSync(path.join(specDir, 'tickets.json'), JSON.stringify([
      { id: 'LOOP-RUNTIME-04', writes: ['runner'], reads: [], adrNone: 'no ADRs', reuses: ['scripts/specflow-runner.cjs'] },
    ]));
    const contract = path.join(dir, 'run-contract.yaml');
    const ledger = path.join(dir, 'ledger.jsonl');
    fs.writeFileSync(contract, yaml.dump({
      run_contract: {
        loop: 'spec-build',
        goal: 'runtime',
        input_artifact: 'docs/specs/genuine-looper/prd.md',
        path: 'templates/QA/loops/spec-build.yaml',
        current_stage_or_rail: 'GATE_B',
        next_gate: 'Gate B checks',
        durable_evidence: [contract, ledger],
        stop_condition: 'handoff',
        never_without_human: ['git push'],
        storage: { contract_path: contract, ledger_path: ledger },
      },
    }));

    const result = runUntilTerminal({ loop: 'spec-build', contract, ledger, specDir, maxIterations: 3 });
    const saved = yaml.load(fs.readFileSync(contract, 'utf8')).run_contract;

    expect(result.status).toBe('agent_action_required');
    expect(result.iterations).toBe(2);
    expect(saved.current_stage_or_rail).toBe('GATE_B5');
    expect(readJsonl(ledger).some((entry) => entry.prompt_path && entry.stage === 'GATE_B5')).toBe(true);
  });

  test('run status reports the current contract and ledger tail', () => {
    const dir = tempDir();
    const contract = path.join(dir, 'run-contract.yaml');
    const ledger = path.join(dir, 'ledger.jsonl');
    fs.writeFileSync(contract, yaml.dump({
      run_contract: {
        loop: 'feature-build',
        goal: 'status',
        input_artifact: 'docs/specs/genuine-looper/prd.md',
        path: 'templates/QA/loops/feature-build.yaml',
        current_stage_or_rail: '6_provenance',
        next_gate: 'provenance',
        durable_evidence: [contract, ledger],
        stop_condition: 'handoff',
        never_without_human: ['git push'],
        storage: { contract_path: contract, ledger_path: ledger },
      },
    }));
    fs.writeFileSync(ledger, `${JSON.stringify({ stage: '6_provenance', result: 'pass' })}\n`);

    const status = runStatus({ contract });
    expect(status.status).toBe('ok');
    expect(status.current_stage_or_rail).toBe('6_provenance');
    expect(status.ledger_tail).toHaveLength(1);
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

  test('builds provider resume commands when a session id exists', () => {
    const claude = buildAdapterCommand({
      provider: 'claude-print',
      command: 'claude',
      args: [],
      session_id: 'claude-session',
      allowed_tools: [],
      denied_tools: [],
    });
    const codex = buildAdapterCommand({
      provider: 'codex-exec',
      command: 'codex',
      args: ['--ask-for-approval', 'never'],
      session_id: 'codex-session',
    });

    expect(claude.args).toEqual(expect.arrayContaining(['--resume', 'claude-session']));
    expect(codex.args.slice(0, 3)).toEqual(['exec', 'resume', 'codex-session']);
  });

  test('adapter smoke includes a bounded prompt by default', () => {
    const smoke = planAdapterSmoke('claude-print', { live: false });
    expect(smoke.policy.prompt).toContain('SPECFLOW_ADAPTER_SMOKE_OK');
    expect(smoke.planned.args.join(' ')).toContain('SPECFLOW_ADAPTER_SMOKE_OK');
  });

  test('detects forbidden human-gate actions in provider output', () => {
    expect(containsForbiddenAction('I will now run git push origin branch', ['git push'])).toBe('git push');
    expect(containsForbiddenAction('safe output', ['git push'])).toBe(null);
  });

  test('parses provider JSONL events into final text and tool events', () => {
    const parsed = parseProviderEvents('codex-exec', [
      JSON.stringify({ type: 'session', session_id: 's-1' }),
      JSON.stringify({ type: 'message', text: 'done' }),
      JSON.stringify({ type: 'tool_call', command: 'git push origin main' }),
    ].join('\n'));

    expect(parsed.session_id).toBe('s-1');
    expect(parsed.final_text).toBe('done');
    expect(parsed.tool_events).toHaveLength(1);
    expect(forbiddenFromProviderEvents(parsed, ['git push'], [])).toBe('git push');
  });
});

describe('stage verifier registry and freshness gates', () => {
  test('runs Gate B verifier registry and advances only on pass', () => {
    const dir = tempDir();
    fs.writeFileSync(path.join(dir, 'contract.yml'), yaml.dump({
      journeys: [{ journey_meta: { id: 'J-REGISTRY-PASS' } }],
    }));
    fs.writeFileSync(path.join(dir, 'issues.json'), JSON.stringify([
      { number: 1, title: 'registry', body: 'Journey IDs: J-REGISTRY-PASS' },
    ]));
    fs.writeFileSync(path.join(dir, 'tickets.json'), JSON.stringify([
      { id: 'REGISTRY-1', writes: ['verify'], reads: [], adrNone: 'no ADRs', reuses: ['scripts/verify-seams.cjs'] },
    ]));

    const result = executeVerifierRegistry({
      loop: 'spec-build',
      current_stage_or_rail: 'GATE_B',
    }, { specDir: dir });

    expect(result.status).toBe('gate_passed');
    expect(result.entries.map((e) => e.verifier)).toEqual(['verify-seams', 'verify-adr', 'verify-ticket-journey']);
  });

  test('simulation freshness detects stale simulation evidence', () => {
    const dir = tempDir();
    const input = path.join(dir, 'ticket.md');
    const simulation = path.join(dir, 'simulation.md');
    fs.writeFileSync(simulation, 'old');
    const now = new Date();
    fs.writeFileSync(input, 'new');
    fs.utimesSync(simulation, new Date(now.getTime() - 10000), new Date(now.getTime() - 10000));
    fs.utimesSync(input, now, now);

    const result = isSimulationFresh({ simulationPath: simulation, inputPaths: [input] });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('older');
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
