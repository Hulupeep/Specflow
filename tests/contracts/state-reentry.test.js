const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  reentryBriefing,
  assertSafeReentry,
  reconcileAssumedStage,
  runLoop,
  runStatus,
  appendStateMemory,
} = require('../../scripts/specflow-runner.cjs');

// STATE-REENTRY-01 / J-STATE-SAFE-REENTRY (#85)
// Bar: a resumed agent re-enters from durable state, not its own memory.

function durableRun(stage = '2_contract') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-reentry-'));
  const runDir = path.join(dir, '.specflow/runs/slice');
  fs.mkdirSync(runDir, { recursive: true });
  const contractPath = path.join(runDir, 'run-contract.yaml');
  const ledgerPath = path.join(runDir, 'ledger.jsonl');
  fs.writeFileSync(contractPath, yaml.dump({
    run_contract: {
      loop: 'feature-build', goal: 'g', input_artifact: 'x', path: 'templates/QA/loops/feature-build.yaml',
      current_stage_or_rail: stage, next_gate: 'contract confirmed', durable_evidence: [contractPath],
      stop_condition: 'handoff', never_without_human: ['git push'], terminal_status: 'in_progress',
      storage: { contract_path: contractPath, ledger_path: ledgerPath },
    },
  }));
  return { dir, runDir, contractPath, ledgerPath };
}
function ledgerEvents(file) {
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(JSON.parse) : [];
}

describe('STATE-REENTRY-01 — safe durable re-entry (#85)', () => {
  test('reentryBriefing reads the durable position + state digest from disk, not memory', () => {
    const env = durableRun('4_oracle');
    const b = reentryBriefing({ contract: env.contractPath });
    expect(b.durable_position_present).toBe(true);
    expect(b.current_stage_or_rail).toBe('4_oracle');
    expect(b.next_gate).toBe('contract confirmed');
    expect(b.source).toBe('durable_state');
  });

  test('assertSafeReentry: safe with a durable position, unsafe without', () => {
    const env = durableRun();
    expect(assertSafeReentry({ contract: env.contractPath }).safe).toBe(true);
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-reentry-empty-'));
    const r = assertSafeReentry({ contract: path.join(empty, 'nope.yaml') });
    expect(r.safe).toBe(false);
    expect(r.reason).toMatch(/cannot safely re-enter/);
  });

  test('reconcileAssumedStage: durable wins over a conflicting assumed stage', () => {
    const env = durableRun('5_impl');
    expect(reconcileAssumedStage({ contract: env.contractPath }).conflict).toBe(false);
    expect(reconcileAssumedStage({ contract: env.contractPath, assumeStage: '5_impl' }).conflict).toBe(false);
    const rec = reconcileAssumedStage({ contract: env.contractPath, assumeStage: '1_ticket' });
    expect(rec.conflict).toBe(true);
    expect(rec.durable_wins).toBe(true);
    expect(rec.stage).toBe('5_impl'); // durable, not assumed
  });

  test('HOSTILE: resuming with a wrong assumed stage proceeds from durable state and ledgers the conflict', () => {
    const env = durableRun('2_contract'); // registry has no command here -> agent_action_required, no advance
    const res = runLoop({ slug: 'slice', contract: env.contractPath, ledger: env.ledgerPath, assumeStage: '1_ticket' });

    // durable stage is untouched — the agent's assumed memory did NOT move the run
    const saved = yaml.load(fs.readFileSync(env.contractPath, 'utf8')).run_contract;
    expect(saved.current_stage_or_rail).toBe('2_contract');

    const conflict = ledgerEvents(env.ledgerPath).find((e) => e.event === 'reentry_conflict');
    expect(conflict).toBeTruthy();
    expect(conflict.assumed_stage).toBe('1_ticket');
    expect(conflict.durable_stage).toBe('2_contract');
    expect(conflict.durable_wins).toBe(true);
    expect(res.status).not.toBe('invalid_contract');
  });

  test('runStatus exposes the re-entry briefing; terminal stops append compact state', () => {
    const env = durableRun('3_e2e');
    appendStateMemory({
      statePath: path.join(env.runDir, '..', '..', 'STATE.md'),
      lessonDir: path.join(env.runDir, '..', '..', 'lessons'),
      update: { verified_fact: 'seam re-read added at GATE B' },
    });
    const status = runStatus({ contract: env.contractPath, ledger: env.ledgerPath });
    expect(status.reentry.durable_position_present).toBe(true);
    expect(status.reentry.current_stage_or_rail).toBe('3_e2e');
  });
});
