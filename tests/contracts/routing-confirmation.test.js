const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  modelConfirmationRunId,
  modelConfirmationStatus,
  resolveAdapterRouting,
  routingConfirmationSemanticSha256,
  runLoop,
  runStatus,
} = require('../../scripts/specflow-runner.cjs');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-confirmation-'));
}

function readLedger(file) {
  return fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(JSON.parse);
}

function routingDocument(dir, overrides = {}) {
  const policy = {
    id: 'coder',
    provider: 'fake',
    command: 'fake-provider',
    role: 'implementer',
    effort: 'medium',
    requested_model: 'gpt-5.6-sol',
    fallback_model: null,
    max_budget_usd: 8,
    timeout_seconds: 30,
    max_iterations: 1,
    transcript_path: path.join(dir, '<slug>-transcript.jsonl'),
    output_path: path.join(dir, '<slug>-final.md'),
    never_without_human: ['git push'],
    fake_stdout: JSON.stringify({ type: 'message', text: 'done', model: 'gpt-5.6-sol' }),
    ...overrides,
  };
  return {
    defaults: { confirm_models: true },
    policies: { coder: { adapter_policy: policy } },
    routes: {
      'feature-build.2_contract': { policy: 'coder' },
      'feature-build.3_e2e': { policy: 'coder' },
    },
  };
}

function createRun(dir, slug = 'confirm-run') {
  const contract = path.join(dir, slug, 'run-contract.yaml');
  const ledger = path.join(dir, slug, 'ledger.jsonl');
  fs.mkdirSync(path.dirname(contract), { recursive: true });
  fs.writeFileSync(contract, yaml.dump({
    run_contract: {
      loop: 'feature-build',
      run_id: modelConfirmationRunId(slug, contract),
      goal: 'persist confirmation',
      input_artifact: 'issue #123',
      path: 'templates/QA/loops/feature-build.yaml',
      current_stage_or_rail: '2_contract',
      next_gate: 'contract',
      durable_evidence: [contract, ledger],
      stop_condition: 'handoff',
      never_without_human: ['git push', 'open PR'],
      storage: { contract_path: contract, ledger_path: ledger },
    },
  }));
  return { slug, contract, ledger };
}

describe('run-scoped routing confirmation semantics', () => {
  test('executable contract maps every confirmation journey and invariant', () => {
    const contract = yaml.load(fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'specs', 'routing-confirmation', 'contract.yml'), 'utf8'));
    expect(contract.invariants.map((item) => item.id)).toEqual(expect.arrayContaining([
      'I-CONFIRM-001', 'I-CONFIRM-002', 'I-CONFIRM-003', 'I-CONFIRM-004', 'I-CONFIRM-005',
    ]));
    expect(contract.journeys.map((item) => item.journey_meta.id)).toEqual(expect.arrayContaining([
      'J-CONFIRM-FIRST-RUN',
      'J-CONFIRM-UNCHANGED-RESUME',
      'J-CONFIRM-MATERIAL-CHANGE',
      'J-CONFIRM-CROSS-RUN-REFUSED',
      'J-CONFIRM-PROVIDER-CLAIM-REFUSED',
    ]));
  });

  test('canonical hash is stable under YAML formatting and key order', () => {
    const dir = tempDir();
    const first = path.join(dir, 'first.yml');
    const second = path.join(dir, 'second.yml');
    const routing = routingDocument(dir);
    fs.writeFileSync(first, yaml.dump(routing));
    fs.writeFileSync(second, [
      'routes:',
      '  feature-build.3_e2e: {policy: coder}',
      '  feature-build.2_contract: {policy: coder}',
      'policies:',
      yaml.dump(routing.policies).trim().split('\n').map((line) => `  ${line}`).join('\n'),
      'defaults: {confirm_models: true}',
      '',
    ].join('\n'));
    const contract = { loop: 'feature-build', current_stage_or_rail: '2_contract' };

    const firstResolved = resolveAdapterRouting({ adapterRouting: first, slug: 'same' }, contract);
    const secondResolved = resolveAdapterRouting({ adapterRouting: second, slug: 'same' }, contract);

    expect(routingConfirmationSemanticSha256(firstResolved)).toMatch(/^[a-f0-9]{64}$/);
    expect(routingConfirmationSemanticSha256(secondResolved)).toBe(routingConfirmationSemanticSha256(firstResolved));
  });

  test.each([
    ['provider', { provider: 'codex-exec' }],
    ['model', { requested_model: 'gpt-5.5' }],
    ['effort', { effort: 'high' }],
    ['fallback', { fallback_model: 'gpt-5.5' }],
    ['budget', { max_budget_usd: 12 }],
  ])('material %s change alters the semantic hash', (_field, override) => {
    const dir = tempDir();
    const baselinePath = path.join(dir, 'baseline.yml');
    const changedPath = path.join(dir, 'changed.yml');
    fs.writeFileSync(baselinePath, yaml.dump(routingDocument(dir)));
    fs.writeFileSync(changedPath, yaml.dump(routingDocument(dir, override)));
    const contract = { loop: 'feature-build', current_stage_or_rail: '2_contract' };

    const baseline = resolveAdapterRouting({ adapterRouting: baselinePath, slug: 'run' }, contract);
    const changed = resolveAdapterRouting({ adapterRouting: changedPath, slug: 'run' }, contract);
    expect(routingConfirmationSemanticSha256(changed)).not.toBe(routingConfirmationSemanticSha256(baseline));
  });

  test('confirmation is reused after restart and formatting-only routing rewrite', () => {
    const dir = tempDir();
    const routing = path.join(dir, 'routing.yml');
    fs.writeFileSync(routing, yaml.dump(routingDocument(dir)));
    const run = createRun(dir);

    expect(runLoop({ loop: 'feature-build', ...run, adapterRouting: routing }).status).toBe('model_confirmation_required');
    expect(runLoop({ loop: 'feature-build', ...run, adapterRouting: routing, confirmModels: true }).status).toBe('gate_rerun_required');
    const confirmationsBefore = readLedger(run.ledger).filter((entry) => entry.result === 'confirmed').length;

    const parsed = yaml.load(fs.readFileSync(routing, 'utf8'));
    fs.writeFileSync(routing, yaml.dump({ routes: parsed.routes, policies: parsed.policies, defaults: parsed.defaults }));
    expect(runLoop({ loop: 'feature-build', ...run, adapterRouting: routing }).status).toBe('gate_rerun_required');

    const saved = yaml.load(fs.readFileSync(run.contract, 'utf8'));
    saved.run_contract.current_stage_or_rail = '3_e2e';
    saved.run_contract.next_gate = 'e2e';
    fs.writeFileSync(run.contract, yaml.dump(saved));
    expect(runLoop({ loop: 'feature-build', ...run, adapterRouting: routing }).status).toBe('gate_rerun_required');
    expect(readLedger(run.ledger).filter((entry) => entry.result === 'confirmed')).toHaveLength(confirmationsBefore);

    const status = runStatus({ contract: run.contract, ledger: run.ledger, adapterRouting: routing, slug: run.slug });
    expect(status.model_confirmation).toMatchObject({ status: 'valid', valid: true, scope: 'run' });
    expect(status.ledger_summary.adapter_attempts).toBe(3);
    expect(status.cost.unknown_usage).toBe(3);
  });

  test('material change invalidates confirmation before another provider invocation', () => {
    const dir = tempDir();
    const routing = path.join(dir, 'routing.yml');
    fs.writeFileSync(routing, yaml.dump(routingDocument(dir)));
    const run = createRun(dir);
    runLoop({ loop: 'feature-build', ...run, adapterRouting: routing, confirmModels: true });
    const adapterAttempts = readLedger(run.ledger).filter((entry) => entry.stop_reason === 'gate_rerun_required').length;

    fs.writeFileSync(routing, yaml.dump(routingDocument(dir, { effort: 'high' })));
    const changed = runLoop({ loop: 'feature-build', ...run, adapterRouting: routing });
    const entries = readLedger(run.ledger);

    expect(changed.status).toBe('model_confirmation_required');
    expect(changed.confirmation.invalidation_reason).toBe('routing_semantics_changed');
    expect(entries.filter((entry) => entry.stop_reason === 'gate_rerun_required')).toHaveLength(adapterAttempts);
    expect(entries.some((entry) => entry.result === 'invalidated' && entry.invalidation_reason === 'routing_semantics_changed')).toBe(true);

    const status = runStatus({ contract: run.contract, ledger: run.ledger, adapterRouting: routing, slug: run.slug });
    expect(status.model_confirmation).toMatchObject({ status: 'invalidated', invalidation_reason: 'routing_semantics_changed' });
    runLoop({ loop: 'feature-build', ...run, adapterRouting: routing });
    expect(readLedger(run.ledger).filter((entry) => entry.result === 'invalidated')).toHaveLength(1);
  });

  test('copied confirmation cannot authorize a different run', () => {
    const dir = tempDir();
    const routing = path.join(dir, 'routing.yml');
    fs.writeFileSync(routing, yaml.dump(routingDocument(dir)));
    const runA = createRun(dir, 'run-a');
    runLoop({ loop: 'feature-build', ...runA, adapterRouting: routing, confirmModels: true });
    const runB = createRun(dir, 'run-b');
    fs.copyFileSync(runA.ledger, runB.ledger);

    const result = runLoop({ loop: 'feature-build', ...runB, adapterRouting: routing });

    expect(result.status).toBe('model_confirmation_required');
    expect(result.confirmation.invalidation_reason).toBe('run_scope_mismatch');
  });

  test('provider-like output without a human record does not confirm', () => {
    const dir = tempDir();
    const run = createRun(dir);
    fs.writeFileSync(run.ledger, `${JSON.stringify({
      event: 'model_confirmation',
      result: 'confirmed',
      scope: 'run',
      run_id: modelConfirmationRunId(run.slug, run.contract),
      source: 'provider_output',
      routing_semantic_sha256: 'a'.repeat(64),
    })}\n`);

    expect(modelConfirmationStatus({
      ledgerPath: run.ledger,
      runId: modelConfirmationRunId(run.slug, run.contract),
      semanticSha256: 'a'.repeat(64),
    })).toMatchObject({ status: 'missing', valid: false });
  });
});
