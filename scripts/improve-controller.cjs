'use strict';
// Trusted owner-local admission/control plane. No HTTP/MCP, timer or resume engine.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const profiles = require('./improve-profiles.cjs'),
  { resolveSlot } = require('./improve-controller-time.cjs');
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex'),
  digest = (v) => sha(JSON.stringify(v));
const id = (v) => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(v);
const DEFAULT_LIMITS = Object.freeze({
  maxCycles: 1,
  maxAttempts: 24,
  maxConsecutiveNoProgress: 2,
  maxWallMs: 1800000
});
const DEFAULT_LIMITS_V2 = Object.freeze({ maxCycles: 1, maxAttempts: null, maxConsecutiveNoProgress: null, maxWallMs: 7200000 });
class ControllerError extends Error {
  constructor(code, next_action = 'Inspect the retained controller evidence; do not replay unknown work.') {
    super(code);
    this.code = code;
    this.next_action = next_action;
  }
}
const need = (v, c) => {
  if (!v) throw new ControllerError(c);
};
function shape(v, allowed, required = allowed) {
  need(
    v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).every((k) => allowed.includes(k)) &&
      required.every((k) => Object.hasOwn(v, k)),
    'invalid_request'
  );
}
function limits(value = DEFAULT_LIMITS, ceiling = null) {
  need(value && typeof value === 'object' && !Array.isArray(value), 'invalid_limits');
  if (Object.hasOwn(value, 'actualApiSpendCeilingUsd'))
    throw new ControllerError(
      'unmeasured_spend_limit',
      'Remove the actual-dollar ceiling; use finite attempts/cycles/deadline with the approved subscription route.'
    );
  shape(value, Object.keys(DEFAULT_LIMITS), []);
  const out = { ...DEFAULT_LIMITS, ...value };
  for (const k of Object.keys(out)) {
    need(Number.isSafeInteger(out[k]) && out[k] > 0, 'invalid_limits');
    if (ceiling) need(out[k] <= ceiling[k], 'limit_escalation');
  }
  need(
    out.maxWallMs <= 7 * 86400000 &&
      out.maxCycles <= 100 &&
      out.maxAttempts <= 10000 &&
      out.maxConsecutiveNoProgress <= 100,
    'invalid_limits'
  );
  return out;
}
function limitsV2(value = {}, ceiling = null) {
  shape(value, Object.keys(DEFAULT_LIMITS_V2), []);
  const out = { ...DEFAULT_LIMITS_V2, ...(ceiling || {}), ...value };
  for (const key of Object.keys(out)) {
    const optional = ['maxAttempts', 'maxConsecutiveNoProgress'].includes(key);
    need((optional && out[key] === null) || (Number.isSafeInteger(out[key]) && out[key] > 0), 'invalid_limits');
    if (ceiling && ceiling[key] !== null) need(out[key] !== null && out[key] <= ceiling[key], 'limit_escalation');
  }
  need(out.maxWallMs <= 7 * 86400000 && out.maxCycles <= 100 &&
    (out.maxAttempts === null || out.maxAttempts <= 10000) &&
    (out.maxConsecutiveNoProgress === null || out.maxConsecutiveNoProgress <= 100), 'invalid_limits');
  return out;
}
function privatePath(file, directory = false) {
  need(path.isAbsolute(file), 'private_store_required');
  for (let p = file; p !== path.dirname(p); p = path.dirname(p))
    if (fs.existsSync(p)) need(!fs.lstatSync(p).isSymbolicLink(), 'unsafe_store_path');
  const s = fs.statSync(file);
  need(
    s.uid === process.getuid() &&
      !(s.mode & 0o077) &&
      (directory ? s.isDirectory() : s.isFile() && s.nlink === 1),
    'private_store_required'
  );
  return file;
}
function readPrivateSnapshot(file) {
  need(path.isAbsolute(file), 'private_store_required');
  // A valid atomic rename can detach an inode between lookup and inspection.
  // Retry its current path; never accept nlink0 or read a different pathname
  // after checking privacy. The descriptor binds validation, size and bytes.
  for (let attempt = 0; attempt < 3; attempt++) {
    let fd;
    try {
      for (let p = file; p !== path.dirname(p); p = path.dirname(p))
        if (fs.existsSync(p)) need(!fs.lstatSync(p).isSymbolicLink(), 'unsafe_store_path');
      const before = fs.lstatSync(file);
      need(!before.isSymbolicLink(), 'unsafe_store_path');
      need(before.uid === process.getuid() && !(before.mode & 0o077) && before.isFile(), 'private_store_required');
      if (before.nlink === 0) continue;
      need(before.nlink === 1, 'private_store_required');
      fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
      const stat = fs.fstatSync(fd);
      need(stat.uid === process.getuid() && !(stat.mode & 0o077) && stat.isFile(), 'private_store_required');
      if (stat.nlink === 0) continue;
      need(stat.nlink === 1, 'private_store_required');
      need(stat.size <= 16 * 1024 * 1024, 'store_limit');
      const text = fs.readFileSync(fd, 'utf8');
      need(Buffer.byteLength(text) <= 16 * 1024 * 1024, 'store_limit');
      return text;
    } catch (error) {
      if (error instanceof ControllerError) throw error;
      if (['ENOENT', 'ESTALE'].includes(error.code)) continue;
      if (error.code === 'ELOOP') throw new ControllerError('unsafe_store_path');
      throw new ControllerError('store_corrupt');
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }
  throw new ControllerError('store_snapshot_busy', 'Retry read-only status after concurrent replacement; no execution authority or limits changed.');
}
function directory(dir) {
  dir = path.resolve(dir);
  for (let p = dir; p !== path.dirname(p); p = path.dirname(p))
    if (fs.existsSync(p)) need(!fs.lstatSync(p).isSymbolicLink(), 'unsafe_store_path');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  return privatePath(dir, true);
}
function syncDir(dir) {
  const fd = fs.openSync(dir, 'r');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function empty(simulation, version = 1) {
  return {
    version,
    simulation,
    revision: 0,
    policies: {},
    requests: {},
    owners: {},
    runs: {},
    occurrences: {},
    schedules: {},
    history: []
  };
}
class ControllerStore {
  constructor({ root, simulation = false, fault = () => {}, format = 1, lockTool = null }) {
    this.root = directory(root);
    this.simulation = simulation;
    this.fault = fault;
    need(format === 1 || (format === 2 && lockTool), 'invalid_store_format');
    this.format = format;
    this.lockTool = lockTool;
    this.file = path.join(this.root, 'controller.json');
    this.lock = path.join(this.root, 'writer.lock');
  }
  read() {
    try {
      fs.lstatSync(this.file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      privatePath(this.root, true);
      return empty(this.simulation, this.format);
    }
    const snapshot = readPrivateSnapshot(this.file);
    let s;
    try {
      s = JSON.parse(snapshot);
    } catch {
      throw new ControllerError('store_corrupt');
    }
    shape(s, Object.keys(empty(this.simulation)));
    need(
      (s.version === 1 || (this.format === 2 && s.version === 2)) &&
        s.simulation === this.simulation &&
        Number.isSafeInteger(s.revision) &&
        s.revision >= 0,
      'store_corrupt'
    );
    for (const k of ['policies', 'requests', 'owners', 'runs', 'occurrences', 'schedules'])
      need(s[k] && typeof s[k] === 'object' && !Array.isArray(s[k]), 'store_corrupt');
    need(Array.isArray(s.history) && s.history.length <= 50000, 'store_limit');
    for (const [key, r] of Object.entries(s.runs)) {
      need(
        id(key) &&
          r.id === key &&
          id(r.repo_id) &&
          id(r.principal) &&
          Array.isArray(r.operations) &&
          Array.isArray(r.cycles) &&
          Array.isArray(r.reasons) &&
          r.limits &&
          Number.isFinite(r.deadline_ms),
        'store_corrupt'
      );
      (s.version === 2 ? limitsV2 : limits)(r.limits);
      for (const n of ['consumed_cycles', 'consumed_attempts', 'terminal_cycles', 'no_progress'])
        need(Number.isSafeInteger(r[n]) && r[n] >= 0, 'store_corrupt');
    }
    return s;
  }
  change(fn, afterCommit) {
    if (this.format === 2) {
      need(this.read().version === 2, 'legacy_recovery_unavailable');
      return require('./improve-kernel-lock.cjs').withLock(this.lock, this.lockTool,
        () => this.commit(fn, afterCommit), { create: true, fault: this.fault });
    }
    let fd;
    try {
      fd = fs.openSync(this.lock, 'wx', 0o600);
    } catch (e) {
      if (e.code === 'EEXIST')
        throw new ControllerError(
          'store_busy',
          'Read committed status. If its writer is gone, retain the lock for #183 reconciliation; never remove it automatically.'
        );
      throw e;
    }
    try {
      fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, started_at: new Date().toISOString() }));
      fs.fsyncSync(fd);
      return this.commit(fn, afterCommit);
    } catch (e) {
      if (e instanceof require('./improve-service-errors.cjs').ServiceError || e instanceof ControllerError || e instanceof require('./improve-memory.cjs').MemoryError || e instanceof require('./improve-recovery-controller.cjs').RecoveryError) throw e;
      throw new ControllerError('storage_commit_unconfirmed', 'Read the committed request and preserve any uncertain intent; do not replay unknown work.');
    } finally {
      fs.closeSync(fd);
      fs.unlinkSync(this.lock);
    }
  }
  commit(fn, afterCommit) {
    const tmp = this.file + '.' + crypto.randomUUID() + '.tmp';
    try {
      this.fault('before_transition');
      const s = this.read(),
        result = fn(s);
      s.revision++;
      need(s.history.length <= 50000, 'store_limit');
      const bytes = JSON.stringify(s);
      need(Buffer.byteLength(bytes) <= 16 * 1024 * 1024, 'store_limit');
      this.fault('write');
      const out = fs.openSync(tmp, 'wx', 0o600);
      try {
        fs.writeFileSync(out, bytes);
        this.fault('fsync');
        fs.fsyncSync(out);
      } finally {
        fs.closeSync(out);
      }
      this.fault('rename');
      fs.renameSync(tmp, this.file);
      this.fault('directory_fsync');
      syncDir(this.root);
      const started = afterCommit ? afterCommit(result, s) : undefined;
      return afterCommit ? { result, started } : result;
    } catch (e) {
      if (e instanceof require('./improve-service-errors.cjs').ServiceError || e instanceof ControllerError || e instanceof require('./improve-memory.cjs').MemoryError || e instanceof require('./improve-recovery-controller.cjs').RecoveryError) throw e;
      throw new ControllerError(
        'storage_commit_unconfirmed',
        'Read the last committed request using the same ID; preserve any uncertain intent and original limits for #183.'
      );
    } finally {
      fs.rmSync(tmp, { force: true });
    }
  }
}
const ACTIONS = {
  operator_cancelled: 'Wait for the owned operation to quiesce; #183 must reconcile incomplete work.',
  reconciliation_required:
    'Use #183 reconciliation with the retained operation/evidence; do not replay the cycle or holdout.',
  pending_review:
    'Review the retained result; #182 must record an authenticated owner decision before another run.',
  deadline:
    'Inspect retained evidence; request a new authorised run only after incomplete work is reconciled.',
  attempts_exhausted:
    'Inspect the last failure and original attempt history; do not reset the request allowance.',
  cycles_exhausted: 'Review the recorded cycle decisions; cycle count alone does not establish improvement.',
  no_progress: 'Review the non-progress evidence and choose a different justified opportunity.',
  no_safe_work: 'Review the retained selection reasons; no patch or PR was created.',
  provider_quota:
    'Restore the approved subscription quota/access, then reconcile any incomplete cycle; no API fallback.',
  provider_auth: 'Restore the approved subscription login, then reconcile incomplete work.',
  protocol_failure: 'Inspect the retained invalid provider response and repair the protocol.',
  test_failure: 'Inspect the named failing check and its evidence before another attempt.',
  stale_profile: 'Restore the job-bound approved revision or reconcile this run; do not adopt new limits.',
  authority_revoked:
    'Ask the owner to restore the exact bound grant; historical access does not permit new work.'
};
function view(r, now) {
  const remaining = {
    cycles: Math.max(0, r.limits.maxCycles - r.consumed_cycles),
    attempts: r.limits.maxAttempts === null ? null : Math.max(0, r.limits.maxAttempts - r.consumed_attempts),
    consecutive_no_progress: r.limits.maxConsecutiveNoProgress === null ? null : Math.max(0, r.limits.maxConsecutiveNoProgress - r.no_progress),
    wall_ms: Math.max(0, r.deadline_ms - now),
    actual_spend_usd: null
  };
  const unresolved = r.operations.some((o) => o.state === 'reserved'),
    reasons = [...r.reasons];
  if (r.cancel_requested && !reasons.includes('operator_cancelled')) reasons.unshift('operator_cancelled');
  for(const op of r.operations.filter(o=>o.state==='reserved'&&o.unknown_reason))if(!reasons.includes(op.unknown_reason))reasons.push(op.unknown_reason);
  if (unresolved && !reasons.includes('reconciliation_required')) reasons.push('reconciliation_required');
  if (now >= r.deadline_ms && !reasons.includes('deadline')) reasons.push('deadline');
  if (r.last_failure && !reasons.includes(r.last_failure.reason_code))
    reasons.push(r.last_failure.reason_code);
  const reason = reasons[0] || null;
  return {
    ...JSON.parse(JSON.stringify(r)),
    remaining,
    reason_code: reason,
    reasons,
    unresolved_operation: unresolved,
    actual_spend_usd: null,
    actual_remaining_spend_usd: null,
    usage_mode: 'subscription_cli',
    usage_measurement: 'native CLI starts; internal provider retries and actual charges unmeasured',
    retryable: Boolean(
      r.last_failure?.retryable &&
      !r.reasons.length &&
      !unresolved &&
      remaining.wall_ms > 0 &&
      (remaining.attempts === null || remaining.attempts > 0) &&
      (remaining.consecutive_no_progress === null || remaining.consecutive_no_progress > 0)
    ),
    next_action: reason
      ? ACTIONS[reason] || 'Inspect the retained diagnosis; do not assume budget or success.'
      : 'Continue only with a fresh authorised protected transition.',
    product_success: r.cycles.some((c) => c.decision === 'KEEP')
      ? 'verified_retained_result'
      : 'not_established'
  };
}
function createControllerService({
  root,
  registry,
  resolvePrincipal,
  hostCapabilities,
  ownerPrincipal,
  now = Date.now,
  simulation = false,
  fault,
  memory,
  recovery,
  serviceBinding
} = {}) {
  need(
    typeof resolvePrincipal === 'function' && typeof hostCapabilities === 'function' && id(ownerPrincipal),
    'trusted_host_required'
  );
  const store = new ControllerStore({ root, simulation, fault, format: recovery?.format || 1, lockTool: recovery?.lockTool }),
    profileService = profiles.createProfileService({ registry, resolvePrincipal, hostCapabilities, now, lockTool: recovery?.lockTool, fault });
  function identity() {
    const p = resolvePrincipal();
    need(id(p), 'authority_unresolved');
    return p;
  }
  function migrate(req) {
    need(!recovery?.scope,'scoped_execution_only');
    shape(req, ['repo_id', 'request_id']);
    need(id(req.repo_id) && id(req.request_id) && recovery?.format === 2 && identity() === ownerPrincipal, 'migration_owner_required');
    need(recovery.migration?.dedicated === true && Array.isArray(recovery.migration.stores) && recovery.migration.stores.length === 1 &&
      typeof recovery.migration.stores[0] === 'string' && path.isAbsolute(recovery.migration.stores[0]) &&
      path.resolve(recovery.migration.stores[0]) === store.root, 'legacy_recovery_unavailable');
    const inspected = profileService.inspect({ repo_id: req.repo_id });
    need(inspected.available && inspected.operations?.includes('execute'), 'authority_revoked');
    const pre = profileService.preflight({ repo_id: req.repo_id, revision: inspected.revision });
    need(pre.ready, pre.findings?.find(f => f.status !== 'passed')?.code || 'preflight_blocked');
    require('./improve-recovery-migration.cjs').recoverAuthority({ store, registry, recovery, request: req, principal: ownerPrincipal });
    if (fs.existsSync(path.join(registry, '.authority-lock')) && !fs.existsSync(path.join(registry, '.authority-lock', 'kernel-v2.lock')))
      throw new ControllerError('legacy_recovery_unavailable', 'Legacy authority mutex has no confirmed migration ownership; preserve it and inspect retained evidence. No protected work started.');
    const out = profileService.withMigration(pre.lease, () =>
      require('./improve-recovery-migration.cjs').migrate({ store, registry, recovery, request: req, principal: ownerPrincipal, fault }));
    need(out.allowed, 'authority_revoked');
    return out.result;
  }
  function access(repo_id, execute = false, revision = null, fn) {
    need(id(repo_id), 'invalid_request');
    if(recovery?.scope)need(repo_id===recovery.scope.repo_id,'authority_revoked');
    const principal = identity(),
      inspected = profileService.inspect({ repo_id });
    need(
      inspected.available && inspected.operations?.includes(execute ? 'execute' : 'read'),
      'authority_revoked'
    );
    if (revision) need(inspected.revision === revision, 'stale_profile');
    if (!execute) {
      const loaded = profiles.readProfile(registry, repo_id, { allowMissingRepository: true });
      need(loaded.revision === inspected.revision, 'stale_profile');
      return fn({ principal, revision: inspected.revision, profile: loaded.profile });
    }
    const pre = profileService.preflight({ repo_id, revision: inspected.revision });
    need(pre.ready, pre.findings?.find((f) => f.status !== 'passed')?.code || 'preflight_blocked');
    let r;
    try {
      r = profileService.withAuthorized(pre.lease, 'execute', (profile) =>
        fn({ principal, revision: inspected.revision, profile })
      );
    } catch (e) {
      if (e.message === 'Owner registry operation active; retry without overriding the lock')
        throw new ControllerError(
          'authority_busy',
          'Retry the same request after the active authority transaction; never override its lock.'
        );
      throw e;
    }
    need(r.allowed, r.findings?.find((f) => f.status !== 'passed')?.code || 'authority_revoked');
    return r.result;
  }
  function run(s, repo_id, run_id, principal) {
    const r = s.runs[run_id];
    need((!recovery?.scope||recovery.scope.run_id===run_id)&&r && r.repo_id === repo_id && (r.principal === principal ||
      (r.policy_version === 2 && (principal === ownerPrincipal || r.recovery.authorised.principal === principal))), 'run_unavailable');
    return r;
  }
  function event(s, event, run_id = null, details = {}) {
    s.history.push({ at_ms: now(), event, run_id, ...details });
  }
  function guard(r, newCycle = false, insideStage = false, needsAttempt = true) {
    const reasons = [];
    if (r.cancel_requested) reasons.push('operator_cancelled');
    if (
      r.operations.some(
        (o) => o.state === 'reserved' && !(insideStage && o.kind === 'stage' && o.id === r.active_stage)
      )
    )
      reasons.push('reconciliation_required');
    if (r.reasons.includes('pending_review')) reasons.push('pending_review');
    if (now() >= r.deadline_ms) reasons.push('deadline');
    if (needsAttempt && r.limits.maxAttempts !== null && r.consumed_attempts >= r.limits.maxAttempts) reasons.push('attempts_exhausted');
    if (newCycle && r.consumed_cycles >= r.limits.maxCycles) reasons.push('cycles_exhausted');
    if (r.limits.maxConsecutiveNoProgress !== null && r.no_progress >= r.limits.maxConsecutiveNoProgress) reasons.push('no_progress');
    if (r.reasons.length) reasons.push(...r.reasons);
    r.reasons = [...new Set(reasons)];
    if (r.reasons.length) {
      r.stopped_at_ms ??= now();
      r.state = r.active_cycle ? 'incomplete' : 'stopped';
    }
    return r.reasons.length === 0;
  }
  function admitIn(s, request, ctx, synthetic = false) {
    const policy = s.policies[request.repo_id];
    need(policy && policy.creator === ctx.principal, 'policy_unavailable');
    const key = digest([ctx.principal, fs.realpathSync(ctx.profile.repository.path), request.request_id]);
    const bound = digest({
      repo_id: request.repo_id,
      request_id: request.request_id,
      limits: request.limits || {}
    });
    const previous = s.requests[key];
    if (previous) {
      need(previous.input_hash === bound, 'idempotency_conflict');
      return {
        ...previous,
        duplicate: true,
        run: previous.run_id ? view(s.runs[previous.run_id], now()) : null
      };
    }
    if (policy.profile_revision !== ctx.revision) {
      const receipt = {
        input_hash: bound,
        repo_id: request.repo_id,
        principal: ctx.principal,
        request_id: request.request_id,
        allowed: false,
        reason_code: 'stale_profile',
        run_id: null,
        retryable: false,
        next_action:
          'Owner must register a policy for the new approved profile; then use a fresh request or intended slot. This blocked request is immutable.'
      };
      s.requests[key] = receipt;
      event(s, 'admission_blocked', null, { repo_id: request.repo_id, reason_code: 'stale_profile' });
      return receipt;
    }
    const canonical = fs.realpathSync(ctx.profile.repository.path),
      owner = s.owners[canonical];
    if (owner) {
      const receipt = {
        input_hash: bound,
        repo_id: request.repo_id,
        principal: ctx.principal,
        request_id: request.request_id,
        allowed: false,
        reason_code: 'busy',
        run_id: null
      };
      s.requests[key] = receipt;
      event(s, 'admission_busy', null, { repo_id: request.repo_id });
      return receipt;
    }
    const chosen = request.limits
      ? (policy.version === 2 ? limitsV2 : limits)({ ...policy.limits, ...request.limits }, policy.limits)
      : policy.limits;
    const run_id = crypto.randomUUID(),
      r = {
        id: run_id,
        repo_id: request.repo_id,
        principal: ctx.principal,
        canonical_repo: canonical,
        profile_revision: ctx.revision,
        policy_digest: policy.digest,
        request_id: request.request_id,
        created_at_ms: now(),
        deadline_ms: now() + chosen.maxWallMs,
        limits: chosen,
        consumed_cycles: 0,
        terminal_cycles: 0,
        consumed_attempts: 0,
        no_progress: 0,
        last_failure: null,
        stopped_at_ms: null,
        active_cycle: null,
        active_stage: null,
        cycles: [],
        operations: [],
        state: 'admitted',
        reasons: [],
        stage: 'admission',
        last_completed_action: 'admitted',
        failed_check: null,
        evidence: [],
        cancel_requested: false,
        estimates: [],
        synthetic
      };
    recoveryService.admit(r, ctx, policy);
    if (memory) r.memory_required = true;
    s.runs[run_id] = r;
    s.owners[canonical] = run_id;
    const receipt = {
      input_hash: bound,
      repo_id: request.repo_id,
      principal: ctx.principal,
      request_id: request.request_id,
      allowed: true,
      run_id,
      reason_code: null
    };
    s.requests[key] = receipt;
    event(s, 'admitted', run_id);
    return { ...receipt, run: view(r, now()) };
  }
  function registerPolicy(policy) {
    need(!recovery?.scope,'scoped_execution_only');
    shape(policy, ['version', 'repo_id', 'profile_revision', 'limits', 'schedule', ...(policy?.version === 2 ? ['routes'] : [])]);
    need(
      [1, 2].includes(policy.version) && id(policy.repo_id) && /^[a-f0-9]{64}$/.test(policy.profile_revision),
      'invalid_policy'
    );
    need(identity() === ownerPrincipal, 'owner_required');
    const bound = (policy.version === 2 ? limitsV2 : limits)(policy.limits);
    if (policy.version === 2) {
      need(store.format === 2, 'recovery_store_required');
      recoveryService.host();
      require('./improve-recovery-controller.cjs').routes(policy.routes);
    }
    if (policy.schedule !== null) {
      shape(policy.schedule, ['id', 'timezone', 'local_time']);
      need(id(policy.schedule.id), 'invalid_schedule');
      resolveSlot({
        canonicalRepo: 'validation',
        scheduleId: policy.schedule.id,
        timezone: policy.schedule.timezone,
        localDate: '2026-01-01',
        localTime: policy.schedule.local_time
      });
    }
    return access(policy.repo_id, true, policy.profile_revision, (ctx) =>
      store.change((s) => {
        const value = {
          ...policy,
          limits: bound,
          creator: ctx.principal,
          canonical_repo: ctx.profile.repository.path
        };
        value.digest = digest(value);
        s.policies[policy.repo_id] = value;
        s.schedules[policy.repo_id] ||= { state: 'paused', activation: 'recovery_required' };
        event(s, 'policy_registered', null, { repo_id: policy.repo_id });
        return { repo_id: policy.repo_id, digest: value.digest, activation: 'recovery_required' };
      })
    );
  }
  function admit(req) {
    need(!recovery?.scope,'scoped_execution_only');
    shape(req, ['repo_id', 'request_id', 'limits'], ['repo_id', 'request_id']);
    need(id(req.request_id), 'invalid_request');
    return access(req.repo_id, true, null, (ctx) => store.change((s) => admitIn(s, req, ctx, simulation)));
  }
  function status(req) {
    shape(req, ['repo_id', 'run_id'], ['repo_id']);
    return access(req.repo_id, false, null, (ctx) => {
      const s = store.read();
      const runs = req.run_id
        ? [view(run(s, req.repo_id, req.run_id, ctx.principal), now())]
        : Object.values(s.runs)
            .filter((r) => (!recovery?.scope||r.id===recovery.scope.run_id) && r.repo_id === req.repo_id && (r.principal === ctx.principal ||
              (r.policy_version === 2 && (ctx.principal === ownerPrincipal || r.recovery.authorised.principal === ctx.principal))))
            .map((r) => view(r, now()));
      return {
        version: 1,
        revision: s.revision,
        activation: 'recovery_required',
        simulation,
        schedule:
          !recovery?.scope && s.policies[req.repo_id]?.creator === ctx.principal
            ? { ...s.schedules[req.repo_id], next_intended: nextSlot(s.policies[req.repo_id], now()) }
            : null,
        runs: runs.map((r) => ({
          ...r,
          authority: {
            bound_profile_revision: r.profile_revision,
            current_profile_revision: ctx.revision,
            revision_matches: r.profile_revision === ctx.revision,
            execution_capabilities: 'not_reprobed_by_read_only_status'
          }
        })),
        admissions: Object.values(s.requests).filter(
          (a) => a.repo_id === req.repo_id && a.principal === ctx.principal && (!recovery?.scope||a.run_id===recovery.scope.run_id)
        ),
        occurrences: Object.values(s.occurrences).filter(
          (o) => o.repo_id === req.repo_id && o.principal === ctx.principal && (!recovery?.scope||o.result?.run_id===recovery.scope.run_id)
        )
      };
    });
  }
  function report(req) {
    shape(req, ['repo_id', 'run_id']);
    return access(req.repo_id, false, null, (ctx) => {
      const snapshot = store.read(), r = run(snapshot, req.repo_id, req.run_id, ctx.principal);
      const asOf = r.stopped_at_ms ?? (now() >= r.deadline_ms ? r.deadline_ms : now()),
        v = view(r, asOf);
      if(r.policy_version===2)return require('./improve-recovery-report.cjs').report({r,ctx,now:now(),host:recoveryService.host(),memory:r.memory_required?memoryService.summary(snapshot,r):null,view:view(r,now()),verifyTerminalArchive,ownsRepo:snapshot.owners[r.canonical_repo]===r.id});
      return {
        version: 1,
        kind: 'controller-report',
        run_id: r.id,
        repo_id: r.repo_id,
        profile_revision: r.profile_revision,
        report_at_ms: asOf,
        final: r.reasons.length > 0 || r.state === 'stopped' || now() >= r.deadline_ms,
        complete: r.active_cycle === null && !v.unresolved_operation,
        state: r.state,
        original_limits: r.limits,
        consumed: {
          cycles: r.consumed_cycles,
          terminal_cycles: r.terminal_cycles,
          attempts: r.consumed_attempts,
          consecutive_no_progress: r.no_progress
        },
        reserved: r.operations.filter((o) => o.state === 'reserved').map((o) => o.id),
        remaining: v.remaining,
        reason_code: v.reason_code,
        reasons: v.reasons,
        stage: r.stage,
        last_completed_action: r.last_completed_action,
        failed_check: r.failed_check,
        evidence: r.evidence,
        cycle_decisions: r.cycles.map((c) => ({
          cycle_id: c.id,
          state: c.state,
          decision: c.decision,
          manifest_sha256: c.manifest_sha256 || null,
          core_diagnosis: c.core_diagnosis || null
        })),
        usage_mode: 'subscription_cli',
        estimates: r.estimates,
        actual_spend_usd: null,
        actual_remaining_spend_usd: null,
        actual_charges: 'unmeasured',
        retryable: v.retryable,
        next_action: v.next_action,
        product_success: v.product_success,
        ...(r.memory_required ? { memory: memoryService.summary(snapshot, r) } : {}),
        activation: 'recovery_required'
      };
    });
  }
  function mutation(req, fn, launch, historical = false, control = false) {
    need(id(req.run_id), 'invalid_request');
    const initial = access(req.repo_id, false, null, (ctx) =>
      run(store.read(), req.repo_id, req.run_id, ctx.principal)
    );
    return access(req.repo_id, !historical, historical ? null : initial.profile_revision, (ctx) =>
      store.change((s) => {
        const r = run(s, req.repo_id, req.run_id, ctx.principal);
        recoveryService.guard(r, ctx, { historical, control });
        if(!historical&&!control&&!r.reasons.length)need(s.owners[r.canonical_repo]===r.id,'run_ownership_unavailable');
        return fn(s, r, ctx);
      }, launch)
    );
  }
  function reserveCycle(req) {
    shape(req, ['repo_id', 'run_id', 'binding']);
    shape(req.binding, ['job_id', 'operation_id', 'core_run_id']);
    need(Object.values(req.binding).every(id), 'invalid_cycle_binding');
    return mutation(req, (s, r, ctx) => {
      if (!guard(r, true)) return { allowed: false, run: view(r, now()) };
      memoryService.beforeCycle(s, r, ctx);
      need(!r.active_cycle, 'reconciliation_required');
      need(!r.synthetic, 'synthetic_execution_denied');
      need(
        !Object.values(s.runs).some((other) =>
          other.cycles.some((c) => c.binding.job_id === req.binding.job_id)
        ),
        'cycle_binding_reused'
      );
      const c = {
        id: crypto.randomUUID(),
        number: ++r.consumed_cycles,
        binding: req.binding,
        state: 'reserved',
        decision: null
      };
      memoryService.bindCycle(s, r, c);
      r.cycles.push(c);
      r.active_cycle = c.id;
      r.state = 'active';
      r.stage = 'cycle';
      event(s, 'cycle_reserved', r.id, { cycle_id: c.id });
      return { allowed: true, cycle: structuredClone(c), run: view(r, now()) };
    });
  }
  function startStage(req, launch) {
    shape(req, ['repo_id', 'run_id', 'cycle_id', 'stage', 'input_sha256'], ['repo_id', 'run_id', 'cycle_id', 'stage']);
    need(id(req.stage) && typeof launch === 'function', 'invalid_stage');
    const admitted = mutation(
      req,
      (s, r) => {
        if (!guard(r, false, false, false)) return { allowed: false, run: view(r, now()) };
        memoryService.beforeStage(s, r, req.stage);
        need(!r.synthetic && r.active_cycle === req.cycle_id && !r.active_stage, 'cycle_unavailable');
        const op = {
          id: crypto.randomUUID(),
          kind: 'stage',
          cycle_id: req.cycle_id,
          stage: req.stage,
          state: 'reserved',
          started_at_ms: now(),
          pid: null,
          birth: null
        };
        recoveryService.bindOperation(r, op, req.input_sha256);
        r.operations.push(op);
        r.active_stage = op.id;
        r.stage = req.stage;
        event(s, 'stage_reserved', r.id, { operation_id: op.id, stage: req.stage });
        return { allowed: true, operation: structuredClone(op), deadline_ms: r.deadline_ms };
      },
      (entry) => (entry.allowed ? launch(entry) : null)
    );
    if (!admitted.result.allowed) return admitted;
    const child = admitted.started,
      birth = require('./improve-controller-watchdog.cjs').birth(child?.pid);
    need(Number.isSafeInteger(child?.pid) && child.pid > 1 && birth, 'stage_launch_unconfirmed');
    // The intent is already durable. Missing this PID acknowledgement fails
    // ancestry checks closed and never authorises a replacement stage.
    mutation(
      req,
      (s, r) => {
        const op = r.operations.find((o) => o.id === admitted.result.operation.id);
        op.pid = child.pid;
        op.birth = birth.start;
        if (r.policy_version === 2) op.process_identity = require('./improve-process-identity.cjs').identity(child.pid);
        event(s, 'stage_started', r.id, { operation_id: op.id, pid: child.pid });
        return null;
      },
      () => { if (admitted.result.operation.generation) { need(typeof child.recoveryRelease === 'function', 'paused_launch_required'); child.recoveryRelease(); } },
      true
    );
    return admitted;
  }
  function applyStageResult(s,r,req,result){
        const op = r.operations.find((o) => o.id === req.operation_id);
        need(op && op.kind === 'stage', 'stage_unavailable');
        const sealed=recoveryService.verifyResult(r,op,result);if(sealed){result={...result,evidence:[sealed.stdout_sha256,sealed.stderr_sha256]};op.receipt_seal=sealed.seal;}
        const hash = digest(result);
        if (op.state === 'complete') {
          need(op.result_hash === hash, 'idempotency_conflict');
          return view(r, now());
        }
        need(
          r.active_stage === op.id && !r.operations.some((o) => o.kind !== 'stage' && o.state === 'reserved'),
          'reconciliation_required'
        );
        op.state = 'complete';
        op.result_hash = hash;
        op.result = result;
        r.active_stage = null;
        r.last_completed_action = 'stage:' + op.id;
        r.evidence.push(...result.evidence);
        if (result.reason_code && !r.last_failure) {
          r.reasons = [...new Set([...r.reasons, result.reason_code])];
          r.failed_check = 'stage:' + op.stage;
          r.stopped_at_ms ??= now();
          r.state = 'incomplete';
        }
        recoveryService.clearReconciliation(r);
        event(s, 'stage_recorded', r.id, { operation_id: op.id, exit_code: result.exit_code });
        return view(r, now());
  }
  function recordStage(req, result) {
    shape(req, ['repo_id', 'run_id', 'operation_id']);
    shape(result, ['exit_code', 'reason_code', 'evidence']);
    need(
      Number.isInteger(result.exit_code) &&
        Array.isArray(result.evidence) &&
        result.evidence.every((v) => typeof v === 'string'),
      'invalid_stage_result'
    );
    return mutation(
      req,
      (s,r) => applyStageResult(s,r,req,result),
      null,
      true
    );
  }
  function startAttempt(req, launch) {
    shape(req, ['repo_id', 'run_id', 'cycle_id', 'role', 'input_sha256'], ['repo_id', 'run_id', 'cycle_id', 'role']);
    need(
      id(req.cycle_id) &&
        ['builder', 'oracle', 'peer', 'judge'].includes(req.role) &&
        typeof launch === 'function',
      'invalid_attempt'
    );
    const admitted = mutation(
      req,
      (s, r, ctx) => {
        if (r.memory_required) need(r.active_stage, 'memory_stage_required');
        const routeKey = recoveryService.route(r, ctx, req.role);
        if (routeKey === null) return { allowed: false, run: view(r, now()) };
        if (r.active_stage) {
          const parent = r.operations.find((o) => o.id === r.active_stage);
          need(parent && descendsFrom(process.pid, parent.pid, parent.birth), 'stage_owner_mismatch');
        }
        if (!guard(r, false, Boolean(r.active_stage))) return { allowed: false, run: view(r, now()) };
        need(!r.synthetic && r.active_cycle === req.cycle_id, 'cycle_unavailable');
        const o = {
          id: crypto.randomUUID(),
          cycle_id: req.cycle_id,
          kind: 'provider',
          stage_id: r.active_stage || null,
          role: req.role,
          number: ++r.consumed_attempts,
          state: 'reserved',
          started_at_ms: now(),
          host_pid: process.pid
        };
        recoveryService.bindOperation(r, o, req.input_sha256);
        if (r.policy_version === 2) o.route_key = routeKey;
        r.operations.push(o);
        r.stage = req.role;
        event(s, 'attempt_reserved', r.id, { operation_id: o.id });
        return { allowed: true, operation: structuredClone(o), deadline_ms: r.deadline_ms };
      },
      (out) => (out.allowed ? launch(out) : null)
    );
    if (admitted.result.allowed && admitted.result.operation.generation) {
      const child=admitted.started,identity=require('./improve-process-identity.cjs').identity(child?.pid);
      need(identity&&typeof child.recoveryRelease==='function','paused_launch_required');
      mutation(req,(s,r)=>{ const op=r.operations.find(o=>o.id===admitted.result.operation.id);op.process_identity=identity;event(s,'attempt_started',r.id,{operation_id:op.id,pid:identity.pid}); },()=>child.recoveryRelease(),true);
    }
    return admitted;
  }
  function applyAttemptResult(s,r,req,result){
        const o = r.operations.find((o) => o.id === req.operation_id);
        need(o, 'operation_unavailable');
        const sealed=recoveryService.verifyResult(r,o,result);if(sealed){result={...result,evidence:[sealed.stdout_sha256,sealed.stderr_sha256]};o.receipt_seal=sealed.seal;}
        const hash = digest(result);
        if (o.state === 'complete') {
          need(o.result_hash === hash, 'idempotency_conflict');
          return view(r, now());
        }
        o.state = 'complete';
        o.result_hash = hash;
        o.result = result;
        r.last_completed_action = 'attempt:' + o.id;
        r.evidence.push(...result.evidence);
        if (result.estimate_usd !== null)
          r.estimates.push({
            operation_id: o.id,
            usd: result.estimate_usd,
            measurement: 'partial native CLI estimate; not actual charges'
          });
        if (result.reason_code) {
          const retryable = ['protocol_failure', 'provider_failure', 'test_failure'].includes(
            result.reason_code
          );
          r.last_failure = { reason_code: result.reason_code, operation_id: o.id, retryable };
          if (!retryable) {
            r.reasons = [...new Set([...r.reasons, result.reason_code])];
            r.stopped_at_ms ??= now();
          }
          r.no_progress++;
          r.failed_check = result.reason_code;
          r.state = retryable ? 'active' : 'incomplete';
        } else r.last_failure = null;
        recoveryService.clearReconciliation(r);
        event(s, 'attempt_recorded', r.id, { operation_id: o.id });
        return view(r, now());
  }
  function recordAttempt(req, result) {
    shape(req, ['repo_id', 'run_id', 'operation_id']);
    shape(result, ['exit_code', 'reason_code', 'evidence', 'estimate_usd']);
    need(
      Number.isInteger(result.exit_code) &&
        Array.isArray(result.evidence) &&
        result.evidence.every((x) => typeof x === 'string') &&
        (result.estimate_usd === null ||
          (typeof result.estimate_usd === 'number' &&
            Number.isFinite(result.estimate_usd) &&
            result.estimate_usd >= 0)),
      'invalid_attempt_result'
    );
    need(
      result.reason_code === null ||
        [
          'provider_quota',
          'provider_auth',
          'protocol_failure',
          'test_failure',
          'deadline',
          'operator_cancelled',
          'provider_failure',
          'authority_unavailable'
        ].includes(result.reason_code),
      'invalid_attempt_result'
    );
    return mutation(
      req,
      (s,r) => applyAttemptResult(s,r,req,result),
      null,
      true
    );
  }
  function completeCycle(req, durableStore) {
    shape(req, ['repo_id', 'run_id', 'cycle_id']);
    need(
      durableStore instanceof require('./improve-worker.cjs').DurableStore,
      'trusted_worker_store_required'
    );
    const snapshot = access(req.repo_id, false, null, (ctx) =>
      structuredClone(run(store.read(), req.repo_id, req.run_id, ctx.principal))
    );
    const cycle = snapshot.cycles.find((c) => c.id === req.cycle_id);
    need(cycle, 'cycle_unavailable');
    const meta = {
      ...cycle.binding,
      principal: snapshot.principal,
      repo_id: snapshot.repo_id,
      profile_revision: snapshot.profile_revision
    };
    let proof;
    try {
      proof = verifyTerminalArchive(durableStore, meta, snapshot.canonical_repo);
    } catch (e) {
      // Failure cannot free ownership or supply an experimental decision.
      mutation(
        req,
        (s, r) => {
          r.reasons = [...new Set([...r.reasons, 'reconciliation_required'])];
          r.state = 'incomplete';
          event(s, 'terminal_evidence_rejected', r.id, { cycle_id: cycle.id });
          return null;
        },
        null,
        true
      );
      throw e;
    }
    return mutation(
      req,
      (s, r, ctx) => {
        const c = r.cycles.find((c) => c.id === req.cycle_id);
        if (c.state === 'terminal') {
          need(c.manifest_sha256 === proof.manifest_sha256, 'idempotency_conflict');
          return view(r, now());
        }
        need(
          r.active_cycle === c.id && !r.operations.some((o) => o.state === 'reserved'),
          'reconciliation_required'
        );
        c.state = 'terminal';
        c.decision = proof.decision;
        c.manifest_sha256 = proof.manifest_sha256;
        c.core_diagnosis = proof.core_diagnosis;
        memoryService.terminal(s, r, c, proof, ctx);
        const failed = proof.core_diagnosis.gates_failed[0];
        r.failed_check =
          proof.decision === 'KEEP'
            ? null
            : typeof failed === 'string'
              ? failed
              : failed?.id || proof.core_diagnosis.reasons[0] || null;
        r.terminal_cycles++;
        r.active_cycle = null;
        r.last_completed_action = 'cycle:' + c.id;
        r.evidence.push(proof.manifest_sha256);
        r.no_progress = proof.decision === 'KEEP' ? 0 : r.no_progress + 1;
        if (proof.decision === 'KEEP') r.reasons = [...new Set([...r.reasons, 'pending_review'])];
        guard(r, true);
        r.state = r.reasons.length ? 'stopped' : 'between_cycles';
        if (
          r.state === 'stopped' &&
          !r.reasons.includes('pending_review') &&
          s.owners[r.canonical_repo] === r.id
        )
          delete s.owners[r.canonical_repo];
        event(s, 'cycle_terminal', r.id, {
          cycle_id: c.id,
          decision: proof.decision,
          manifest_sha256: proof.manifest_sha256
        });
        return view(r, now());
      },
      null,
      true
    );
  }
  function stop(req, diagnosis) {
    shape(req, ['repo_id', 'run_id']);
    shape(diagnosis, ['reason_code', 'stage', 'failed_check', 'evidence']);
    need(
      Object.hasOwn(ACTIONS, diagnosis.reason_code) &&
        typeof diagnosis.stage === 'string' &&
        Array.isArray(diagnosis.evidence) &&
        diagnosis.evidence.every((v) => typeof v === 'string'),
      'invalid_diagnosis'
    );
    return mutation(req, (s, r) => {
      r.reasons = [...new Set([...r.reasons, diagnosis.reason_code])];
      r.stage = diagnosis.stage;
      r.failed_check = diagnosis.failed_check;
      r.evidence.push(...diagnosis.evidence);
      r.state = r.active_cycle ? 'incomplete' : 'stopped';
      r.stopped_at_ms ??= now();
      if (
        !r.active_cycle &&
        !r.operations.some((o) => o.state === 'reserved') &&
        !r.reasons.includes('pending_review') &&
        s.owners[r.canonical_repo] === r.id
      )
        delete s.owners[r.canonical_repo];
      event(s, 'stopped', r.id, { reason_code: diagnosis.reason_code });
      return view(r, now());
    }, null, false, true);
  }
  function cancelIn(s,r,ctx){
    recoveryService.guard(r,ctx,{control:true,historical:true});
    r.cancel_requested=true;r.stopped_at_ms??=now();r.reasons=[...new Set(['operator_cancelled',...r.reasons])];r.state=r.active_cycle?'cancelling':'stopped';
    if(!r.active_cycle&&!r.operations.some(o=>o.state==='reserved')&&!r.reasons.includes('pending_review')&&s.owners[r.canonical_repo]===r.id)delete s.owners[r.canonical_repo];
    event(s,'cancel_requested',r.id);return view(r,now());
  }
  function cancel(req) {
    shape(req,['repo_id','run_id']);
    return access(req.repo_id,false,null,ctx=>{
      need(profileService.inspect({repo_id:req.repo_id}).operations.includes('execute'),'authority_revoked');
      return store.change(s=>cancelIn(s,run(s,req.repo_id,req.run_id,ctx.principal),ctx));
    });
  }
  function controlSchedule(req) {
    need(!recovery?.scope,'scoped_execution_only');
    shape(req, ['repo_id', 'state']);
    need(['enabled', 'paused', 'disabled'].includes(req.state), 'invalid_schedule');
    return access(req.repo_id, true, null, (ctx) =>
      store.change((s) => {
        need(s.policies[req.repo_id]?.creator === ctx.principal, 'authority_unresolved');
        if (req.state === 'enabled' && !simulation)
          return {
            allowed: false,
            reason_code: 'recovery_required',
            next_action: 'Complete #183 recovery evidence before live activation.'
          };
        s.schedules[req.repo_id] = { state: req.state, activation: 'recovery_required' };
        event(s, 'schedule_control', null, { repo_id: req.repo_id, state: req.state });
        return { allowed: true, ...s.schedules[req.repo_id] };
      })
    );
  }
  function syntheticOccurrence(req) {
    shape(req, ['repo_id', 'local_date', 'local_time']);
    need(simulation, 'synthetic_only');
    return access(req.repo_id, true, null, (ctx) =>
      store.change((s) => {
        const policy = s.policies[req.repo_id];
        need(policy && policy.creator === ctx.principal && policy.schedule, 'authority_unresolved');
        need(req.local_time === policy.schedule.local_time, 'invalid_slot');
        const slot = resolveSlot({
          canonicalRepo: fs.realpathSync(ctx.profile.repository.path),
          scheduleId: policy.schedule.id,
          timezone: policy.schedule.timezone,
          localDate: req.local_date,
          localTime: req.local_time,
          now: now()
        });
        if (s.occurrences[slot.id]) {
          const o = s.occurrences[slot.id];
          need(o.principal === ctx.principal, 'authority_revoked');
          return { ...o, duplicate: true };
        }
        let disposition = slot.disposition,
          admission = null;
        if (disposition === 'not_due') return { ...slot, reason_code: 'not_due' };
        if (disposition === 'due') {
          if (s.schedules[req.repo_id].state !== 'enabled')
            disposition = 'skipped_' + s.schedules[req.repo_id].state;
          else {
            admission = admitIn(s, { repo_id: req.repo_id, request_id: 'slot-' + slot.id }, ctx, true);
            disposition =
              admission.reason_code === 'busy'
                ? 'skipped_busy'
                : admission.allowed === false
                  ? 'blocked_' + admission.reason_code
                  : 'admitted';
          }
        }
        const o = {
          ...slot,
          disposition,
          repo_id: req.repo_id,
          principal: ctx.principal,
          profile_revision: ctx.revision,
          run_id: admission?.run_id || null,
          reason_code: admission?.reason_code || null,
          synthetic: true
        };
        s.occurrences[slot.id] = o;
        event(s, 'synthetic_occurrence', o.run_id, { occurrence_id: slot.id, disposition });
        return o;
      })
    );
  }
  const recoveryService = require('./improve-recovery-controller.cjs').attach({ store, access, ownerPrincipal, now, recovery, applyReceipt:(s,r,op,doc)=>{
    const result={...doc.result,evidence:[doc.stdout_sha256,doc.stderr_sha256]};
    if(op.kind==='stage')delete result.estimate_usd;
    if(doc.phase==='not_started'){
      need(op.state==='reserved','reconciliation_required');
      if(op.kind==='stage')need(!r.operations.some(o=>o.kind!=='stage'&&o.state==='reserved'),'reconciliation_required');
      op.state='complete';op.result=result;op.result_hash=digest(result);op.not_started=true;
      if(r.active_stage===op.id)r.active_stage=null;
      event(s,'operation_not_started',r.id,{operation_id:op.id});
    }else if(op.kind==='stage')applyStageResult(s,r,{operation_id:op.id},result);
    else applyAttemptResult(s,r,{operation_id:op.id},result);
    if(!r.operations.some(o=>o.state==='reserved'))r.reasons=r.reasons.filter(x=>x!=='reconciliation_required');
  } });
  const memoryService = require('./improve-memory-controller.cjs').attach({
    store, access, ownerPrincipal, now, memory, guardWrite: recoveryService.guard
  });
  const serviceExtension = require('./improve-service-controller.cjs').attach({store,access,admitIn,cancelIn,now,need,serviceBinding,ownerPrincipal,scoped:Boolean(recovery?.scope),canControl:repo=>profileService.inspect({repo_id:repo}).operations?.includes('execute')});
  return {
    ...serviceExtension,
    migrate,
    registerPolicy,
    report,
    admit,
    status,
    cancel,
    controlSchedule,
    syntheticOccurrence,
    reserveCycle,
    startStage,
    recordStage,
    startAttempt,
    recordAttempt,
    completeCycle,
    stop,
    store,
    ...recoveryService.public,
    ...memoryService.public
  };
}
function descendsFrom(pid, ancestor, started) {
  if (!Number.isSafeInteger(ancestor) || ancestor <= 1 || typeof started !== 'string') return false;
  const initial = require('./improve-controller-watchdog.cjs').birth(ancestor);
  if (!initial || initial.start !== started || ['Z', 'X'].includes(initial.state)) return false;
  for (let depth = 0; depth < 128 && pid > 1; depth++) {
    if (pid === ancestor) return true;
    try {
      const text = fs.readFileSync('/proc/' + pid + '/stat', 'utf8'),
        fields = text.slice(text.lastIndexOf(')') + 2).split(' ');
      pid = Number(fields[1]);
    } catch {
      return false;
    }
  }
  return false;
}
function nextSlot(policy, now) {
  if (!policy.schedule) return null;
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: policy.schedule.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: policy.schedule.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now),
    p = Object.fromEntries(parts.map((v) => [v.type, v.value]));
  const base = Date.parse(p.year + '-' + p.month + '-' + p.day + 'T12:00Z');
  for (let i = 0; i < 3; i++) {
    const slot = resolveSlot({
      canonicalRepo: policy.canonical_repo,
      scheduleId: policy.schedule.id,
      timezone: policy.schedule.timezone,
      localDate: new Date(base + i * 86400000).toISOString().slice(0, 10),
      localTime: policy.schedule.local_time,
      now
    });
    if (slot.intended_at_utc && Date.parse(slot.intended_at_utc) > now) return slot;
  }
  return { disposition: 'unavailable', local_date: day };
}
function canonical(v) {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (v && typeof v === 'object')
    return (
      '{' +
      Object.keys(v)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
        .join(',') +
      '}'
    );
  return JSON.stringify(v);
}
function verifyTerminalArchive(store, meta, canonicalRepo) {
  const receipt = store.recover(meta.job_id, meta),
    bytes = {};
  for (const name of ['run.json', 'decision.json', 'ledger.jsonl', 'workspace.patch', 'report.md']) {
    const entry = receipt.files.find((f) => f.path === name);
    need(entry, 'terminal_artifact_missing');
    const file = privatePath(path.join(store.root, 'blobs', entry.sha256));
    bytes[name] = fs.readFileSync(file);
    need(sha(bytes[name]) === entry.sha256 && bytes[name].length === entry.size, 'terminal_artifact_corrupt');
  }
  const r = JSON.parse(bytes['run.json']),
    d = JSON.parse(bytes['decision.json']);
  need(
    r.run_id === meta.core_run_id &&
      r.target_repo === canonicalRepo &&
      d.run_id === r.run_id &&
      d.decision === receipt.decision,
    'terminal_identity_mismatch'
  );
  const scratch = fs.mkdtempSync(path.join(store.root, 'verify-controller-'));
  try {
    fs.writeFileSync(path.join(scratch, 'ledger.jsonl'), bytes['ledger.jsonl'], { mode: 0o600 });
    const core = require('./specflow-improve.cjs'),
      status = core.status(scratch),
      events = core.events(scratch);
    const last = (n) => events.filter((e) => e.event === n).at(-1);
    need(
      status.ledger.ok &&
        status.ledger.improve_entries > 0 &&
        status.terminal &&
        status.decision === d.decision,
      'core_not_terminal'
    );
    need(
      last('run_started')?.run_sha256 === sha(canonical(r)) &&
        last('decision_made')?.decision_sha256 === sha(bytes['decision.json']) &&
        last('decision_applied')?.decision === d.decision,
      'terminal_ledger_binding'
    );
    if (d.decision === 'KEEP')
      need(
        receipt.files.some((f) => f.path === 'retained.bundle'),
        'retained_commit_missing'
      );
    return {
      ...receipt,
      base_commit: r.base_commit,
      retained_commit: last('decision_applied')?.commit || null,
      contract_revision: last('contract_frozen')?.contract_sha256 || null,
      candidate_digest: (() => {
        const entry = receipt.files.find(f => f.path === 'candidates.json');
        if (!entry) return null;
        const file = privatePath(path.join(store.root, 'blobs', entry.sha256));
        const content = fs.readFileSync(file);
        need(sha(content) === entry.sha256 && last('candidates_recorded')?.candidates_sha256 === entry.sha256,
          'terminal_candidates_binding');
        return require('./improve-memory.cjs').digest(JSON.parse(content));
      })(),
      core_diagnosis: {
        decision_sha256: sha(bytes['decision.json']),
        reasons: d.reasons || [],
        gates_failed: d.gates_failed || [],
        gates_missing: d.gates_missing || [],
        baseline_blocker: d.baseline_blocker || null,
        binding_errors: d.binding_errors || [],
        holdout_exposed: Array.isArray(d.holdout_exposed) ? d.holdout_exposed.length > 0 : d.holdout_exposed === true
      }
    };
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
module.exports = {
  descendsFrom,
  nextSlot,
  verifyTerminalArchive,
  ControllerError,
  ControllerStore,
  DEFAULT_LIMITS,
  DEFAULT_LIMITS_V2,
  limits,
  limitsV2,
  view,
  createControllerService
};
