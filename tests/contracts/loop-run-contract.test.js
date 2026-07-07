const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
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
  resolveAdapterRouting,
  modelConfirmationPlan,
  modelRoutingBriefing,
  installDefaultAdapterRouting,
  parseProviderEvents,
  planAdapterSmoke,
  appendStateMemory,
  prepareWorktree,
  runAdapter,
  runLoop,
  runStatus,
  runUntilTerminal,
  scaffoldRoutineManifest,
  summarizeLedger,
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

  test('state memory writes STATE.md, one lesson file, and prompt digest', () => {
    const dir = tempDir();
    const statePath = path.join(dir, '.specflow/STATE.md');
    const lessonDir = path.join(dir, '.specflow/lessons');
    const contractPath = path.join(dir, '.specflow/runs/demo/run-contract.yaml');

    const state = appendStateMemory({
      statePath,
      lessonDir,
      update: {
        verified_fact: 'adapter policy supports requested_model',
        distilled_rule: 'never infer effective_model from requested_model',
        lesson_summary: 'Do not infer effective model',
        lesson_body: 'Record unknown unless provider reports the effective model.',
      },
    });

    expect(fs.existsSync(statePath)).toBe(true);
    expect(fs.existsSync(state.lessonPath)).toBe(true);
    expect(fs.readFileSync(state.lessonPath, 'utf8')).toContain('# Do not infer effective model');

    const prompt = materializeStagePrompt({
      loop: 'feature-build',
      goal: 'state memory',
      input_artifact: 'docs/specs/fable-loop-compounding/tickets.md',
      path: 'templates/QA/loops/feature-build.yaml',
      current_stage_or_rail: '5_impl',
      next_gate: 'implementation',
      durable_evidence: [contractPath],
      stop_condition: 'handoff',
      never_without_human: ['git push'],
      storage: { contract_path: contractPath, statePath, lessonDir },
    }, { contractPath, statePath, lessonDir });

    expect(prompt.content).toContain('## State Memory');
    expect(prompt.content).toContain('adapter policy supports requested_model');
    expect(prompt.content).toContain('lesson:do-not-infer-effective-model.md');
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
    fs.writeFileSync(ledger, `${JSON.stringify({ stage: '6_provenance', verifier: 'provenance', result: 'pass' })}\n`);

    const status = runStatus({ contract });
    expect(status.status).toBe('ok');
    expect(status.current_stage_or_rail).toBe('6_provenance');
    expect(status.ledger_tail).toHaveLength(1);
    expect(status.ledger_summary.gate_passes).toBe(1);
    expect(status.model_routing.status).toBe('not_configured');
    expect(status.model_routing.setup[0]).toBe('specflow run --setup-routing');
  });

  test('prepares isolated delegated worktree metadata without auto merge or push', () => {
    const dir = tempDir();
    const wt = path.join(dir, 'delegate-wt');
    spawnSync('git', ['init'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['config', 'user.name', 'Specflow Test'], { cwd: dir, encoding: 'utf8' });
    fs.writeFileSync(path.join(dir, 'README.md'), 'demo\n');
    spawnSync('git', ['add', 'README.md'], { cwd: dir, encoding: 'utf8' });
    spawnSync('git', ['commit', '-m', 'init'], { cwd: dir, encoding: 'utf8' });

    const result = prepareWorktree({
      repoRoot: dir,
      worktreePath: wt,
      branch: 'specflow/delegate',
      create: true,
      readOnly: true,
    });

    expect(result.action).toBe('created');
    expect(result.worktree_path).toBe(wt);
    expect(result.read_only).toBe(true);
    expect(result.auto_merge).toBe(false);
    expect(result.auto_push).toBe(false);
    expect(fs.existsSync(path.join(wt, 'README.md'))).toBe(true);
  });

  test('scaffolds routine manifests that call specflow run and preserve human gates', () => {
    const dir = tempDir();
    const outPath = path.join(dir, 'docs/routines/nightly.yml');
    const result = scaffoldRoutineManifest({
      slug: 'nightly',
      kind: 'github-actions',
      loop: 'spec-build',
      input: 'docs/idea.md',
      outPath,
    });

    expect(fs.existsSync(outPath)).toBe(true);
    expect(result.manifest.routine.command).toContain('specflow run spec-build');
    expect(result.manifest.routine.command).toContain('--until-terminal');
    expect(result.manifest.routine.never_without_human).toContain('git push');
    expect(result.manifest.routine.proposal_policy).toContain('spec-build');
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
      role: 'planner',
      effort: 'high',
      model: 'claude-fable-5',
      fallback_model: 'claude-opus-4-8',
      transcript_path: '.specflow/runs/<slug>/adapter/out.jsonl',
      output_path: '.specflow/runs/<slug>/adapter/final.md',
      never_without_human: ['git push'],
    }, { slug: 'demo' });

    expect(policy.transcript_path).toBe('.specflow/runs/demo/adapter/out.jsonl');
    expect(policy.output_path).toBe('.specflow/runs/demo/adapter/final.md');
    expect(policy.requested_model).toBe('claude-fable-5');
    expect(policy.effective_model).toBe('unknown');
    expect(policy.role).toBe('planner');
    expect(policy.effort).toBe('high');
    expect(policy.fallback_model).toBe('claude-opus-4-8');
  });

  test('rejects unsupported adapter roles and effort levels before invocation', () => {
    expect(() => normalizeAdapterPolicy({
      id: 'bad-role',
      provider: 'fake', // contract-allowed: fake provider fixture default
      command: 'fake', // contract-allowed: fake provider fixture default
      timeout_seconds: 30,
      max_iterations: 1,
      role: 'boss',
      transcript_path: 'out.jsonl',
      output_path: 'final.md',
      never_without_human: ['git push'],
    })).toThrow('adapter_policy.role is unsupported');

    expect(() => normalizeAdapterPolicy({
      id: 'bad-effort',
      provider: 'fake', // contract-allowed: fake provider fixture default
      command: 'fake', // contract-allowed: fake provider fixture default
      timeout_seconds: 30,
      max_iterations: 1,
      effort: 'heroic',
      transcript_path: 'out.jsonl',
      output_path: 'final.md',
      never_without_human: ['git push'],
    })).toThrow('adapter_policy.effort is unsupported');
  });

  test('builds Claude print command with safety flags', () => {
    const command = buildAdapterCommand({
      provider: 'claude-print',
      command: 'claude',
      args: [],
      model: 'sonnet',
      fallback_model: 'opus',
      max_budget_usd: 2,
      allowed_tools: ['Read'],
      denied_tools: ['Bash(git push *)'],
    });
    expect(command.command).toBe('claude');
    expect(command.args).toContain('-p');
    expect(command.args).toContain('--output-format');
    expect(command.args).toContain('--max-budget-usd');
    expect(command.args).toContain('--fallback-model');
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

  test('resolves default adapter routing for the current loop stage', () => {
    const dir = tempDir();
    const routing = path.join(dir, 'adapter-routing.yml');
    fs.writeFileSync(routing, yaml.dump({
      defaults: { confirm_models: true },
      policies: {
        planner: {
          adapter_policy: {
            id: 'planner',
            provider: 'claude-print',
            command: 'claude',
            role: 'planner',
            effort: 'xhigh',
            requested_model: 'fable-5',
            fallback_model: 'opus-4.8',
            timeout_seconds: 30,
            max_iterations: 1,
            transcript_path: path.join(dir, '<slug>-planner.jsonl'),
            output_path: path.join(dir, '<slug>-planner.md'),
            never_without_human: ['git push'],
          },
        },
      },
      routes: {
        'spec-build.discover': { policy: 'planner', reason: 'requirements thinking' },
      },
    }));

    const resolved = resolveAdapterRouting({ adapterRouting: routing, slug: 'auth' }, {
      loop: 'spec-build',
      current_stage_or_rail: 'discover',
    });

    expect(resolved.status).toBe('resolved');
    expect(resolved.policyId).toBe('planner');
    expect(resolved.policy.requested_model).toBe('fable-5');
    expect(resolved.policy.transcript_path).toContain('auth-planner.jsonl');
    expect(resolved.confirmationRequired).toBe(true);

    const plan = modelConfirmationPlan(resolved, { slug: 'auth' });
    expect(plan.status).toBe('model_confirmation_required');
    expect(plan.confirm_with).toContain('--confirm-models');

    const briefing = modelRoutingBriefing({ adapterRouting: routing, slug: 'auth' }, {
      loop: 'spec-build',
      current_stage_or_rail: 'discover',
    });
    expect(briefing.message).toContain('Model routing active');
    expect(briefing.requested_model).toBe('fable-5');
  });

  test('installs default adapter routing from the local policy template', () => {
    const dir = tempDir();
    const template = path.join(dir, '.specflow', 'adapter-policies', 'claude-code-large-routing.yml');
    const routing = path.join(dir, '.specflow', 'adapter-routing.yml');
    fs.mkdirSync(path.dirname(template), { recursive: true });
    fs.writeFileSync(template, 'routes:\n  spec-build.discover:\n    policy: none\n');

    const result = installDefaultAdapterRouting({ adapterRouting: routing, routingTemplate: template });

    expect(result.status).toBe('installed');
    expect(fs.existsSync(routing)).toBe(true);
    expect(fs.readFileSync(routing, 'utf8')).toContain('spec-build.discover');
  });

  test('runLoop blocks routed adapter execution until model choices are confirmed', () => {
    const dir = tempDir();
    const contract = path.join(dir, 'run-contract.yaml');
    const ledger = path.join(dir, 'ledger.jsonl');
    const routing = path.join(dir, 'adapter-routing.yml');
    fs.writeFileSync(routing, yaml.dump({
      defaults: { confirm_models: true },
      policies: {
        coder: {
          adapter_policy: {
            id: 'coder',
            provider: 'fake',
            command: 'fake-provider',
            role: 'implementer',
            effort: 'medium',
            requested_model: 'gpt-5.5',
            timeout_seconds: 30,
            max_iterations: 1,
            transcript_path: path.join(dir, '<slug>-transcript.jsonl'),
            output_path: path.join(dir, '<slug>-final.md'),
            never_without_human: ['git push'],
            fake_stdout: JSON.stringify({ type: 'message', text: 'done', model: 'gpt-5.5' }),
          },
        },
      },
      routes: { 'feature-build.2_contract': { policy: 'coder' } },
    }));
    fs.writeFileSync(contract, yaml.dump({
      run_contract: {
        loop: 'feature-build',
        goal: 'auth',
        input_artifact: 'issue 1',
        path: 'templates/QA/loops/feature-build.yaml',
        current_stage_or_rail: '2_contract',
        next_gate: 'contract',
        durable_evidence: [contract, ledger],
        stop_condition: 'handoff',
        never_without_human: ['git push'],
        storage: { contract_path: contract, ledger_path: ledger },
      },
    }));

    const result = runLoop({ loop: 'feature-build', slug: 'auth', contract, ledger, adapterRouting: routing });
    expect(result.status).toBe('model_confirmation_required');
    expect(result.requested_model).toBe('gpt-5.5');
    expect(result.budget_note).toContain('not a guaranteed charge');
    expect(fs.existsSync(path.join(dir, 'auth-final.md'))).toBe(false);
    expect(readJsonl(ledger)[0].stop_reason).toBe('model_confirmation_required');

    const confirmed = runLoop({ loop: 'feature-build', slug: 'auth', contract, ledger, adapterRouting: routing, confirmModels: true });
    expect(confirmed.status).toBe('gate_rerun_required');
    expect(fs.readFileSync(path.join(dir, 'auth-final.md'), 'utf8')).toBe('done');
    expect(readJsonl(ledger).some((entry) => entry.model_confirmation === 'confirmed')).toBe(true);
  });

  test('Codex routed confirmations explain ChatGPT quota semantics', () => {
    const resolved = {
      routingPath: '.specflow/adapter-routing.yml',
      loop: 'feature-build',
      stage: '5_impl',
      policyId: 'gpt55-coder',
      reason: 'implementation',
      policy: {
        id: 'gpt55-coder',
        provider: 'codex-exec',
        role: 'implementer',
        effort: 'medium',
        requested_model: 'gpt-5.5',
        max_budget_usd: 8,
        transcript_path: 'transcript.jsonl',
        output_path: 'out.md',
      },
    };

    const plan = modelConfirmationPlan(resolved, { slug: 'auth' });
    const briefing = modelRoutingBriefing({ adapterRouting: 'missing.yml' }, null);

    expect(plan.budget_note).toContain('Codex plan quota/credits');
    expect(plan.budget_note).toContain('rather than OpenAI API billing');
    expect(briefing.status).toBe('not_configured');
  });

  test('detects forbidden human-gate actions in provider output', () => {
    expect(containsForbiddenAction('I will now run git push origin branch', ['git push'])).toBe('git push');
    expect(containsForbiddenAction('safe output', ['git push'])).toBe(null);
  });

  test('parses provider JSONL events into final text and tool events', () => {
    const parsed = parseProviderEvents('codex-exec', [
      JSON.stringify({ type: 'session', session_id: 's-1' }),
      JSON.stringify({ type: 'message', text: 'done', model: 'claude-opus-4-8', usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 } }),
      JSON.stringify({ type: 'tool_call', command: 'git push origin main' }),
    ].join('\n'));

    expect(parsed.session_id).toBe('s-1');
    expect(parsed.final_text).toBe('done');
    expect(parsed.effective_model).toBe('claude-opus-4-8');
    expect(parsed.usage.total_tokens).toBe(15);
    expect(parsed.usage.estimated_cost_usd).toBe(0.001);
    expect(parsed.tool_events).toHaveLength(1);
    expect(forbiddenFromProviderEvents(parsed, ['git push'], [])).toBe('git push');
  });

  test('summarizes requested and effective model accounting without guessing unknowns', () => {
    const summary = summarizeLedger([
      { verifier: 'unit', result: 'pass' },
      {
        provider: 'claude-print',
        requested_model: 'claude-fable-5',
        effective_model: 'claude-opus-4-8',
        estimated_cost_usd: 0.5,
        stop_reason: 'gate_rerun_required',
      },
      {
        provider: 'codex-exec',
        requested_model: 'gpt-5',
        effective_model: 'unknown',
        estimated_cost_usd: null,
        stop_reason: 'adapter_failed',
      },
    ]);

    expect(summary.gate_passes).toBe(1);
    expect(summary.adapter_attempts).toBe(2);
    expect(summary.unknown_usage_entries).toBe(1);
    expect(summary.known_estimated_cost_usd).toBe(0.5);
    expect(summary.cost_per_gate_pass_usd).toBe(0.5);
    expect(summary.requested_models['claude-fable-5']).toBe(1);
    expect(summary.effective_models['claude-opus-4-8']).toBe(1);
    expect(summary.effective_models.unknown).toBe(1);
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
    const result = runAdapter(fakePolicy(dir, {
      role: 'planner',
      effort: 'xhigh',
      requested_model: 'claude-fable-5',
      fallback_model: 'claude-opus-4-8',
      fake_stdout: [ // contract-allowed: fake provider fixture default
        JSON.stringify({
          type: 'message',
          text: 'done',
          model: 'claude-opus-4-8',
          fallback_reason: 'safety_reroute',
          usage: { input_tokens: 100, output_tokens: 20, cost_usd: 0.006 },
        }),
      ].join('\n'),
    }), {
      owningGateCommand: 'node scripts/verify-falsification.cjs ...',
    });
    expect(result.status).toBe('gate_rerun_required');
    expect(result.entry.owning_gate_command).toContain('verify-falsification');
    expect(result.entry.requested_model).toBe('claude-fable-5');
    expect(result.entry.effective_model).toBe('claude-opus-4-8');
    expect(result.entry.fallback_refusal_reason).toBe('safety_reroute');
    expect(result.entry.estimated_cost_usd).toBe(0.006);
    expect(fs.readFileSync(path.join(dir, 'final.md'), 'utf8')).toContain('done');
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
