'use strict';
const fs = require('fs'),
  path = require('path');
const { fixture } = require('../helpers/improve-controller.cjs'),
  c = require('../../scripts/improve-controller.cjs'),
  { resolveSlot } = require('../../scripts/improve-controller-time.cjs');
let f;
afterEach(() => f?.cleanup());
function begin(extra = {}) {
  f = fixture();
  f.register(extra);
  const s = f.service(),
    a = s.admit({ repo_id: 'fixture', request_id: 'R' }),
    r = { repo_id: 'fixture', run_id: a.run_id };
  return { s, r, a };
}
const binding = { job_id: 'job', operation_id: 'op', core_run_id: 'core' };
test.each([0, -1, 1.5, NaN, Infinity, '2', null])(
  'CTRL-LIMITS rejects non-positive/non-finite bound %s',
  (value) => {
    expect(() => c.limits({ maxAttempts: value })).toThrow('invalid_limits');
  }
);
test('CTRL-LIMITS subscription actual spend cannot be enforced by estimates or silently ignored', () => {
  expect(() => c.limits({ actualApiSpendCeilingUsd: 0.01 })).toThrow('unmeasured_spend_limit');
});
test('CTRL-IDENTITY replay survives service restart; changed input conflicts, busy is durable', () => {
  const { s, r } = begin();
  const old = s.status(r);
  expect(f.service().admit({ repo_id: 'fixture', request_id: 'R' })).toMatchObject({
    duplicate: true,
    run_id: r.run_id
  });
  expect(() => s.admit({ repo_id: 'fixture', request_id: 'R', limits: { maxCycles: 1 } })).toThrow(
    'idempotency_conflict'
  );
  expect(s.admit({ repo_id: 'fixture', request_id: 'other' })).toMatchObject({
    reason_code: 'busy',
    run_id: null
  });
  expect(s.status(r)).toMatchObject({ runs: old.runs });
});
test('CTRL-AUTH wrong principal cannot learn another run, raise limits or reserve work', () => {
  const { s, r } = begin();
  f.principal = 'viewer';
  expect(() => f.service().admit({ repo_id: 'fixture', request_id: 'R' })).toThrow('authority_revoked');
  expect(() => f.service().status(r)).toThrow('run_unavailable');
  f.principal = 'owner';
  expect(() => s.admit({ repo_id: 'fixture', request_id: 'new', principal: 'owner' })).toThrow(
    'invalid_request'
  );
});
test('CTRL-LIMITS caller can only lower registered original limits', () => {
  f = fixture();
  f.register();
  expect(() =>
    f.service().admit({ repo_id: 'fixture', request_id: 'raise', limits: { maxAttempts: 4 } })
  ).toThrow('limit_escalation');
  const a = f.service().admit({ repo_id: 'fixture', request_id: 'lower', limits: { maxAttempts: 1 } });
  expect(a.run.limits.maxAttempts).toBe(1);
});
test('CTRL-LIMITS every role/retry shares reservations, estimates remain telemetry and equality denies next start', () => {
  const { s, r } = begin();
  const cycle = s.reserveCycle({ ...r, binding }).cycle;
  for (const role of ['builder', 'oracle', 'peer']) {
    let called = 0;
    const out = s.startAttempt({ ...r, cycle_id: cycle.id, role }, () => ++called);
    expect(called).toBe(1);
    expect(out.result.allowed).toBe(true);
    s.recordAttempt(
      { ...r, operation_id: out.result.operation.id },
      { exit_code: 0, reason_code: null, evidence: [], estimate_usd: 99 }
    );
  }
  let called = 0;
  expect(s.startAttempt({ ...r, cycle_id: cycle.id, role: 'judge' }, () => ++called).result).toMatchObject({
    allowed: false,
    run: { reason_code: 'attempts_exhausted', remaining: { attempts: 0 }, actual_spend_usd: null }
  });
  expect(called).toBe(0);
  const state = s.status(r).runs[0];
  expect(state.estimates).toHaveLength(3);
  expect(state.reasons).not.toContain('budget_exhausted');
  expect(s.report(r)).toMatchObject({
    reason_code: 'attempts_exhausted',
    remaining: { attempts: 0 },
    original_limits: { maxAttempts: 3 }
  });
});
test('CTRL-INTERRUPT an unacknowledged provider reservation stays consumed and quarantines restart', () => {
  const { s, r } = begin();
  const cycle = s.reserveCycle({ ...r, binding }).cycle;
  s.startAttempt({ ...r, cycle_id: cycle.id, role: 'oracle' }, () => ({ pid: 123 }));
  const restarted = f.service(),
    status = restarted.status(r).runs[0];
  expect(status).toMatchObject({
    consumed_attempts: 1,
    reason_code: 'reconciliation_required',
    unresolved_operation: true
  });
  let calls = 0;
  expect(
    restarted.startAttempt({ ...r, cycle_id: cycle.id, role: 'oracle' }, () => ++calls).result.allowed
  ).toBe(false);
  expect(calls).toBe(0);
  expect(restarted.admit({ repo_id: 'fixture', request_id: 'another' }).reason_code).toBe('busy');
});
test('CTRL-INTERRUPT an absolute deadline includes downtime and cannot reset on replay', () => {
  const { s, r } = begin();
  const deadline = s.status(r).runs[0].deadline_ms;
  f.clock += 60000;
  const replay = f.service().admit({ repo_id: 'fixture', request_id: 'R' });
  expect(replay.run.deadline_ms).toBe(deadline);
  const denied = s.reserveCycle({ ...r, binding });
  expect(s.report(r)).toMatchObject({
    reason_code: 'deadline',
    remaining: { wall_ms: 0 },
    actual_charges: 'unmeasured'
  });

  expect(denied).toMatchObject({
    allowed: false,
    run: { reason_code: 'deadline', remaining: { wall_ms: 0 } }
  });
});
test('CTRL-AUTH cancellation fences current work; pause is durable and separately visible', () => {
  const { s, r } = begin();
  s.controlSchedule({ repo_id: 'fixture', state: 'paused' });
  s.cancel(r);
  expect(f.service().status(r)).toMatchObject({
    schedule: { state: 'paused' },
    runs: [{ cancel_requested: true, reason_code: 'operator_cancelled' }]
  });
  expect(s.reserveCycle({ ...r, binding }).allowed).toBe(false);
  expect(s.controlSchedule({ repo_id: 'fixture', state: 'enabled' })).toMatchObject({
    allowed: false,
    reason_code: 'recovery_required'
  });
});
test('CTRL-AUTH changed profile cannot rebind a run; revoked grant denies before protected start', () => {
  const { r } = begin();
  f.update((p) => (p.mission += ' revised'));
  expect(() => f.service().reserveCycle({ ...r, binding })).toThrow('stale_profile');
  f.update((p) => (p.grants.owner = ['read', 'preflight']));
  expect(() => f.service().admit({ repo_id: 'fixture', request_id: 'next' })).toThrow('authority_revoked');
});
test('CTRL-NOWORK no candidate creates no cycle and duplicate completed request cannot rerun', () => {
  const { s, r } = begin();
  s.stop(r, {
    reason_code: 'no_safe_work',
    stage: 'selection',
    failed_check: null,
    evidence: ['selection.json']
  });
  expect(f.service().admit({ repo_id: 'fixture', request_id: 'R' })).toMatchObject({
    duplicate: true,
    run: { consumed_cycles: 0, reason_code: 'no_safe_work', product_success: 'not_established' }
  });
  expect(s.admit({ repo_id: 'fixture', request_id: 'fresh' }).run_id).not.toBe(r.run_id);
});
test.each(['provider_quota', 'protocol_failure', 'test_failure', 'provider_auth'])(
  'CTRL-LIMITS preserves submitted %s diagnosis and allowance',
  (reason) => {
    const { s, r } = begin();
    const cycle = s.reserveCycle({ ...r, binding }).cycle;
    const op = s.startAttempt({ ...r, cycle_id: cycle.id, role: 'peer' }, () => 1).result.operation;
    s.recordAttempt(
      { ...r, operation_id: op.id },
      { exit_code: 2, reason_code: reason, evidence: ['failure.json'], estimate_usd: null }
    );
    expect(s.status(r).runs[0]).toMatchObject({
      reason_code: reason,
      remaining: { attempts: 2 },
      evidence: ['failure.json']
    });
  }
);
test('CTRL-SCHEDULE Dublin autumn represents one earliest slot; spring skips without substitute', () => {
  const input = {
    canonicalRepo: 'repo',
    scheduleId: 'daily',
    timezone: 'Europe/Dublin',
    localDate: '2026-10-25',
    localTime: '01:30',
    now: Date.parse('2026-10-25T00:30Z')
  };
  const a = resolveSlot(input),
    b = resolveSlot({ ...input, now: Date.parse('2026-10-25T01:30Z') });
  expect(a).toMatchObject({
    intended_at_utc: '2026-10-25T00:30:00.000Z',
    ambiguity: 'earliest',
    disposition: 'due'
  });
  expect(b.id).toBe(a.id);
  expect(b.disposition).toBe('missed');
  expect(resolveSlot({ ...input, localDate: '2026-03-29' })).toMatchObject({
    intended_at_utc: null,
    disposition: 'skipped_nonexistent'
  });
});
test('CTRL-SCHEDULE synthetic admission/replay/pause is durable and cannot enable provider execution', () => {
  f = fixture({ simulation: true });
  f.register();
  const s = f.service();
  s.controlSchedule({ repo_id: 'fixture', state: 'enabled' });
  const slot = { repo_id: 'fixture', local_date: '2026-10-25', local_time: '01:30' },
    a = s.syntheticOccurrence(slot);
  expect(a.disposition).toBe('admitted');
  expect(() => s.reserveCycle({ repo_id: 'fixture', run_id: a.run_id, binding })).toThrow(
    'synthetic_execution_denied'
  );
  f.clock += 3600000;
  expect(f.service().syntheticOccurrence(slot)).toMatchObject({ duplicate: true, run_id: a.run_id });
  s.controlSchedule({ repo_id: 'fixture', state: 'paused' });
  f.clock = Date.parse('2026-10-26T01:30Z');
  expect(s.syntheticOccurrence({ ...slot, local_date: '2026-10-26' }).disposition).toBe('skipped_paused');
  expect(s.status({ repo_id: 'fixture' }).runs).toHaveLength(1);
});
test('CTRL-RACE replaying an old stop/cancel cannot release a newer repo owner', () => {
  const { s, r } = begin();
  s.stop(r, { reason_code: 'no_safe_work', stage: 'selection', failed_check: null, evidence: [] });
  const next = s.admit({ repo_id: 'fixture', request_id: 'next' });
  expect(next.run_id).toBeTruthy();
  s.cancel(r);
  s.stop(r, { reason_code: 'no_safe_work', stage: 'selection', failed_check: null, evidence: [] });
  expect(s.admit({ repo_id: 'fixture', request_id: 'must-stay-busy' }).reason_code).toBe('busy');
});
test.each([null, undefined])(
  'CTRL-AUTH unresolved trusted principal %s denies before any lookup or launch',
  (principal) => {
    f = fixture();
    f.register();
    const service = c.createControllerService({ ...f.config(), resolvePrincipal: () => principal });
    expect(() => service.admit({ repo_id: 'fixture', request_id: 'R' })).toThrow('authority_unresolved');
    expect(service.store.read().runs).toEqual({});
  }
);
test('CTRL-AUTH revoking execute between cycle and attempt starts no child or reservation', () => {
  const { s, r } = begin();
  const cycle = s.reserveCycle({ ...r, binding }).cycle;
  f.update((p) => (p.grants.owner = ['read', 'preflight']));
  let started = 0;
  expect(() => s.startAttempt({ ...r, cycle_id: cycle.id, role: 'oracle' }, () => ++started)).toThrow(
    'authority_revoked'
  );
  expect(started).toBe(0);
  expect(s.status(r).runs[0].consumed_attempts).toBe(0);
});
test('CTRL-LIMITS completed known protocol retry shares the original allowance and clears only its live diagnosis', () => {
  const { s, r } = begin();
  const cycle = s.reserveCycle({ ...r, binding }).cycle;
  const req = { ...r, cycle_id: cycle.id, role: 'peer' };
  const first = s.startAttempt(req, () => 1).result.operation;
  s.recordAttempt(
    { ...r, operation_id: first.id },
    { exit_code: 2, reason_code: 'protocol_failure', evidence: ['first-invalid.json'], estimate_usd: null }
  );
  expect(s.status(r).runs[0]).toMatchObject({
    reason_code: 'protocol_failure',
    retryable: true,
    consumed_attempts: 1
  });
  const second = s.startAttempt(req, () => 2);
  expect(second.result.allowed).toBe(true);
  s.recordAttempt(
    { ...r, operation_id: second.result.operation.id },
    { exit_code: 0, reason_code: null, evidence: ['valid.json'], estimate_usd: 3 }
  );
  const state = s.status(r).runs[0];
  expect(state).toMatchObject({ consumed_attempts: 2, reason_code: null, remaining: { attempts: 1 } });
  expect(state.operations[0].result.reason_code).toBe('protocol_failure');
  expect(state.evidence).toEqual(['first-invalid.json', 'valid.json']);
});
test('CTRL-LIMITS final report is read-only, byte-stable after stop, with exact remaining limits', () => {
  const { s, r } = begin();
  s.stop(r, {
    reason_code: 'no_safe_work',
    stage: 'selection',
    failed_check: null,
    evidence: ['selection.json']
  });
  const file = path.join(f.store, 'controller.json'),
    before = fs.readFileSync(file),
    first = JSON.stringify(s.report(r));
  f.clock += 10000;
  expect(JSON.stringify(s.report(r))).toBe(first);
  expect(fs.readFileSync(file).equals(before)).toBe(true);
  expect(s.report(r)).toMatchObject({
    final: true,
    complete: true,
    original_limits: { maxAttempts: 3 },
    consumed: { attempts: 0 },
    remaining: { attempts: 3 },
    actual_charges: 'unmeasured',
    reason_code: 'no_safe_work'
  });
});
test('CTRL-RACE separately registered profile alias cannot create another canonical repo owner', () => {
  const { s } = begin(),
    profiles = require('../../scripts/improve-profiles.cjs');
  const alias = profiles.registerProfile(f.registry, { ...f.profile, repo_id: 'alias' });
  s.registerPolicy({ ...f.policy(), repo_id: 'alias', profile_revision: alias.revision });
  expect(s.admit({ repo_id: 'alias', request_id: 'alias-run' })).toMatchObject({
    reason_code: 'busy',
    run_id: null
  });
  expect(s.status({ repo_id: 'fixture' }).runs).toHaveLength(1);
  expect(s.status({ repo_id: 'alias' }).runs).toHaveLength(0);
});
test('CTRL-INTERRUPT qualification rejects foreign or previously consumed worker roots before configuration', () => {
  f = fixture();
  const owner = path.join(f.root, 'proof-owner.json');
  fs.writeFileSync(owner, JSON.stringify({ state_root: path.join(f.root, '217-qualification') }), {
    mode: 0o600
  });
  const result = require('child_process').spawnSync(
    process.execPath,
    [path.resolve('evidence/improve-controller/run-live-controller.cjs'), owner, 'configure', f.root],
    { encoding: 'utf8', timeout: 10000 }
  );
  expect(result.status).toBe(1);
  expect(result.stderr).toContain('owner_private_root_required');
  expect(fs.existsSync(path.join(f.root, 'controller-binding.json'))).toBe(false);
});
test.each(['manual', 'timer'])(
  'CTRL-IDENTITY profile edit plus %s redelivery preserves the original and records blocked fresh work',
  (mode) => {
    f = fixture({ simulation: true });
    f.register();
    const svc = f.service();
    svc.controlSchedule({ repo_id: 'fixture', state: 'enabled' });
    const slot = { repo_id: 'fixture', local_date: '2026-10-25', local_time: '01:30' },
      original =
        mode === 'manual'
          ? svc.admit({ repo_id: 'fixture', request_id: 'original' })
          : svc.syntheticOccurrence(slot);
    expect(original.run_id).toBeTruthy();
    f.update((p) => (p.mission += ' changed profile'));
    const replay =
      mode === 'manual'
        ? f.service().admit({ repo_id: 'fixture', request_id: 'original' })
        : f.service().syntheticOccurrence(slot);
    expect(replay).toMatchObject({ duplicate: true, run_id: original.run_id });
    f.clock = Date.parse('2026-10-26T01:30Z');
    const fresh =
      mode === 'manual'
        ? svc.admit({ repo_id: 'fixture', request_id: 'fresh' })
        : svc.syntheticOccurrence({ ...slot, local_date: '2026-10-26' });
    expect(fresh).toMatchObject({ reason_code: 'stale_profile', run_id: null });
    if (mode === 'timer') expect(fresh.disposition).toBe('blocked_stale_profile');
    const status = f.service().status({ repo_id: 'fixture' });
    expect(status.runs).toHaveLength(1);
    expect(status.runs[0].id).toBe(original.run_id);
    expect(status.admissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason_code: 'stale_profile', allowed: false, run_id: null })
      ])
    );
  }
);
test('CTRL-SCHEDULE missed, paused and nonexistent slots persist through status and immutable replay with zero runs', () => {
  f = fixture({ simulation: true });
  f.register();
  const svc = f.service(),
    dates = [
      ['2026-10-24', 'missed'],
      ['2026-10-25', 'skipped_paused'],
      ['2026-03-29', 'skipped_nonexistent']
    ];
  const records = dates.map(([local_date, disposition]) => {
    const req = { repo_id: 'fixture', local_date, local_time: '01:30' },
      result = svc.syntheticOccurrence(req);
    expect(result).toMatchObject({ disposition, run_id: null });
    return { req, result };
  });
  f.clock = Date.parse('2026-11-01T01:30Z');
  for (const { req, result } of records)
    expect(f.service().syntheticOccurrence(req)).toMatchObject({ ...result, duplicate: true });
  const status = f.service().status({ repo_id: 'fixture' });
  expect(status.runs).toHaveLength(0);
  expect(status.occurrences).toHaveLength(3);
  expect(status.occurrences.map((o) => o.disposition).sort()).toEqual(dates.map((x) => x[1]).sort());
});
test('CTRL-TERMINAL an active nonterminal cycle refuses a second reservation without consuming another cycle', () => {
  const { s, r } = begin();
  s.reserveCycle({ ...r, binding });
  expect(() =>
    s.reserveCycle({
      ...r,
      binding: { job_id: 'second-job', operation_id: 'second-op', core_run_id: 'second-core' }
    })
  ).toThrow('reconciliation_required');
  const state = s.status(r).runs[0];
  expect(state.consumed_cycles).toBe(1);
  expect(state.cycles).toHaveLength(1);
  expect(state.cycles[0].state).toBe('reserved');
});
