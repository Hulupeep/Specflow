const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const { modelConfirmationRunId, runLoop } = require('../../scripts/specflow-runner.cjs');

test('J-CONFIRM-FIRST-RUN ledgers confirmation before provider completion', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-confirm-order-'));
  const contract = path.join(dir, 'run-contract.yaml');
  const ledger = path.join(dir, 'ledger.jsonl');
  const routing = path.join(dir, 'routing.yml');
  fs.writeFileSync(routing, yaml.dump({
    defaults: { confirm_models: true },
    policies: {
      coder: {
        adapter_policy: {
          id: 'coder',
          provider: 'fake',
          command: 'fake-provider',
          requested_model: 'gpt-5.6-sol',
          effort: 'medium',
          timeout_seconds: 30,
          max_iterations: 1,
          transcript_path: path.join(dir, 'transcript.jsonl'),
          output_path: path.join(dir, 'output.md'),
          never_without_human: ['git push'],
          fake_stdout: JSON.stringify({ type: 'message', text: 'provider-complete' }),
        },
      },
    },
    routes: { 'feature-build.2_contract': { policy: 'coder' } },
  }));
  fs.writeFileSync(contract, yaml.dump({
    run_contract: {
      loop: 'feature-build',
      run_id: modelConfirmationRunId('order', contract),
      goal: 'ordering',
      input_artifact: 'issue #123',
      path: 'templates/QA/loops/feature-build.yaml',
      current_stage_or_rail: '2_contract',
      next_gate: 'contract',
      durable_evidence: [contract, ledger],
      stop_condition: 'handoff',
      never_without_human: ['git push'],
      storage: { contract_path: contract, ledger_path: ledger },
    },
  }));

  const blocked = runLoop({ loop: 'feature-build', slug: 'order', contract, ledger, adapterRouting: routing });
  expect(blocked.status).toBe('model_confirmation_required');
  expect(fs.existsSync(path.join(dir, 'output.md'))).toBe(false);

  runLoop({ loop: 'feature-build', slug: 'order', contract, ledger, adapterRouting: routing, confirmModels: true });
  const entries = fs.readFileSync(ledger, 'utf8').trim().split('\n').map(JSON.parse);
  const confirmationIndex = entries.findIndex((entry) => entry.event === 'model_confirmation' && entry.result === 'confirmed');
  const providerIndex = entries.findIndex((entry) => entry.stop_reason === 'gate_rerun_required');

  expect(confirmationIndex).toBeGreaterThanOrEqual(0);
  expect(providerIndex).toBeGreaterThan(confirmationIndex);
  expect(entries[confirmationIndex].source).toBe('human_cli_flag');
  expect(entries[confirmationIndex].routing_semantic_sha256).toMatch(/^[a-f0-9]{64}$/);
});
