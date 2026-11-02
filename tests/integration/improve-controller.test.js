'use strict';
const fs = require('fs'),
  path = require('path'),
  { spawn } = require('child_process');
const { fixture, sha } = require('../helpers/improve-controller.cjs'),
  c = require('../../scripts/improve-controller.cjs'),
  worker = require('../../scripts/improve-worker.cjs'),
  core = require('../../scripts/specflow-improve.cjs');
let f;
afterEach(() => f?.cleanup());
function begin() {
  f = fixture();
  f.register();
  const s = f.service(),
    a = s.admit({ repo_id: 'fixture', request_id: 'R' }),
    r = { repo_id: 'fixture', run_id: a.run_id };
  const cycle = s.reserveCycle({
    ...r,
    binding: { job_id: 'job', operation_id: 'operation', core_run_id: 'core' }
  }).cycle;
  return { s, r, cycle };
}
const canonical = (v) =>
  Array.isArray(v)
    ? '[' + v.map(canonical).join(',') + ']'
    : v && typeof v === 'object'
      ? '{' +
        Object.keys(v)
          .sort()
          .map((k) => JSON.stringify(k) + ':' + canonical(v[k]))
          .join(',') +
        '}'
      : JSON.stringify(v);
function archive(cycle, decision = 'REVERT', change = () => {}, diagnosis = {}) {
  // Authenticated archive/ledger protocol fixture, not evidence of model/evaluation quality.
  const source = path.join(f.root, 'protocol-core-' + cycle.number);
  fs.mkdirSync(source);
  const r = { schema: 'specflow.improve.run/v1', run_id: cycle.binding.core_run_id, target_repo: f.repo },
    d = { run_id: r.run_id, decision, ...diagnosis };
  fs.writeFileSync(path.join(source, 'run.json'), JSON.stringify(r));
  fs.writeFileSync(path.join(source, 'decision.json'), JSON.stringify(d));
  fs.writeFileSync(path.join(source, 'workspace.patch'), '');
  fs.writeFileSync(path.join(source, 'report.md'), 'Protocol fixture only.');
  if (decision === 'KEEP') fs.writeFileSync(path.join(source, 'retained.bundle'), 'protocol bundle fixture');
  core.append(source, 'run_started', { run_sha256: sha(canonical(r)) });
  core.append(source, 'implementation_started', { protocol_fixture: true });
  core.append(source, 'decision_made', {
    decision,
    decision_sha256: sha(fs.readFileSync(path.join(source, 'decision.json')))
  });
  core.append(source, 'decision_applied', { decision });
  change(source);
  const store = new worker.DurableStore({
    root: path.join(f.root, 'durable-' + cycle.number),
    sourceRoot: source
  });
  store.commit(
    { ...cycle.binding, principal: 'owner', repo_id: 'fixture', profile_revision: f.revision },
    source
  );
  return store;
}
test('CTRL-TERMINAL durable archive advances only exact bound terminal ledger, cycle bound never declares gain', () => {
  const { s, r, cycle } = begin();
  const store = archive(cycle);
  let result = s.completeCycle({ ...r, cycle_id: cycle.id }, store);
  expect(result).toMatchObject({
    terminal_cycles: 1,
    state: 'between_cycles',
    product_success: 'not_established'
  });
  expect(s.completeCycle({ ...r, cycle_id: cycle.id }, store).terminal_cycles).toBe(1);
  const next = s.reserveCycle({
    ...r,
    binding: { job_id: 'job2', operation_id: 'operation2', core_run_id: 'core2' }
  }).cycle;
  result = s.completeCycle({ ...r, cycle_id: next.id }, archive(next));
  expect(result).toMatchObject({
    terminal_cycles: 2,
    state: 'stopped',
    product_success: 'not_established',
    remaining: { cycles: 0, consecutive_no_progress: 0 }
  });
  expect(result.reasons).toEqual(expect.arrayContaining(['cycles_exhausted', 'no_progress']));
  expect(s.report(r)).toMatchObject({
    reason_code: 'cycles_exhausted',
    remaining: { cycles: 0 },
    consumed: { terminal_cycles: 2 }
  });
  expect(s.reserveCycle({ ...r, binding: next.binding }).allowed).toBe(false);
});
test('CTRL-TERMINAL KEEP remains pending owner review and blocks all fresh repo admissions', () => {
  const { s, r, cycle } = begin();
  const result = s.completeCycle({ ...r, cycle_id: cycle.id }, archive(cycle, 'KEEP'));
  expect(result).toMatchObject({
    reason_code: 'pending_review',
    product_success: 'verified_retained_result'
  });
  expect(s.admit({ repo_id: 'fixture', request_id: 'next' })).toMatchObject({
    reason_code: 'busy',
    run_id: null
  });
  expect(s.reserveCycle({ ...r, binding: cycle.binding }).allowed).toBe(false);
  s.cancel(r);
  s.stop(r, { reason_code: 'no_safe_work', stage: 'selection', failed_check: null, evidence: [] });
  expect(s.admit({ repo_id: 'fixture', request_id: 'still-pending' }).reason_code).toBe('busy');
});
test.each(['corrupt-ledger', 'missing-ledger', 'wrong-run', 'invented-enum'])(
  'CTRL-TERMINAL rejects %s and retains repo ownership',
  (mode) => {
    const { s, r, cycle } = begin();
    const store = archive(cycle, 'REVERT', (source) => {
      if (mode === 'corrupt-ledger') fs.appendFileSync(path.join(source, 'ledger.jsonl'), 'not-json\n');
      if (mode === 'missing-ledger') fs.unlinkSync(path.join(source, 'ledger.jsonl'));
      if (mode === 'wrong-run')
        fs.writeFileSync(
          path.join(source, 'run.json'),
          JSON.stringify({ run_id: 'other', target_repo: f.repo })
        );
      if (mode === 'invented-enum') {
        const r = { run_id: 'core', target_repo: f.repo };
        fs.writeFileSync(path.join(source, 'run.json'), JSON.stringify(r));
        fs.writeFileSync(path.join(source, 'decision.json'), '{"run_id":"core","decision":"REVERT"}');
        fs.writeFileSync(path.join(source, 'ledger.jsonl'), '');
      }
    });
    expect(() => s.completeCycle({ ...r, cycle_id: cycle.id }, store)).toThrow();
    expect(s.status(r).runs[0]).toMatchObject({ terminal_cycles: 0, reason_code: 'reconciliation_required' });
    expect(s.admit({ repo_id: 'fixture', request_id: 'replacement' }).reason_code).toBe('busy');
  }
);
test.each(['write', 'fsync', 'rename', 'directory_fsync'])(
  'CTRL-INTERRUPT real %s fault acknowledges no admission; lost ack preserves one identity',
  (stage) => {
    f = fixture();
    f.register();
    let fired = false;
    const svc = c.createControllerService({
      ...f.config(),
      fault: (where) => {
        if (where === stage && !fired) {
          fired = true;
          throw Error('injected ' + stage);
        }
      }
    });
    expect(() => svc.admit({ repo_id: 'fixture', request_id: 'lost' })).toThrow('storage_commit_unconfirmed');
    const replay = f.service().admit({ repo_id: 'fixture', request_id: 'lost' });
    expect(replay.run_id).toBeTruthy();
    expect(f.service().status({ repo_id: 'fixture' }).runs).toHaveLength(1);
    expect(replay.duplicate).toBe(stage === 'directory_fsync' ? true : undefined);
  }
);
test('CTRL-INTERRUPT stale writer lock is never auto-cleared and status reads last committed state', () => {
  const { s, r } = begin();
  fs.writeFileSync(path.join(f.store, 'writer.lock'), '{"pid":99999999}', { mode: 0o600 });
  expect(s.status(r).runs[0].id).toBe(r.run_id);
  expect(() => s.cancel(r)).toThrow('store_busy');
  expect(fs.existsSync(path.join(f.store, 'writer.lock'))).toBe(true);
});
test('CTRL-INTERRUPT genuine symlink/corrupt store cannot be interpreted as a fresh store', () => {
  f = fixture();
  f.register();
  const file = path.join(f.store, 'controller.json'),
    backup = path.join(f.root, 'snapshot');
  fs.renameSync(file, backup);
  fs.symlinkSync(backup, file);
  expect(() => f.service().status({ repo_id: 'fixture' })).toThrow('unsafe_store_path');
  fs.unlinkSync(file);
  fs.writeFileSync(file, '{bad', { mode: 0o600 });
  expect(() => f.service().status({ repo_id: 'fixture' })).toThrow('store_corrupt');
});
test('CTRL-RACE twenty cross-process admissions cover simultaneous and both committed orderings with exact durable busy', async () => {
  f = fixture({ simulation: true });
  f.register();
  f.service().controlSchedule({ repo_id: 'fixture', state: 'enabled' });
  const script = path.join(f.root, 'race.cjs'),
    config = path.join(f.root, 'race.json');
  fs.writeFileSync(
    script,
    'const fs=require("fs"),cfg=require(process.argv[2]),C=require(' +
      JSON.stringify(require.resolve('../../scripts/improve-controller.cjs')) +
      ');const mode=process.argv[3],sleep=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,10),s=C.createControllerService({root:cfg.root,registry:cfg.registry,hostCapabilities:()=>cfg.host,resolvePrincipal:()=>"owner",ownerPrincipal:"owner",now:()=>cfg.clock,simulation:true});let out;const end=Date.now()+8000;if(cfg.first&&mode!==cfg.first)while(!fs.existsSync(cfg.barrier)&&Date.now()<end)sleep();do{try{out=mode==="timer"?s.syntheticOccurrence({repo_id:"fixture",local_date:cfg.date,local_time:"01:30"}):s.admit({repo_id:"fixture",request_id:cfg.request});break;}catch(e){if(!["store_busy","authority_busy"].includes(e.code)||Date.now()>end){out={reason_code:e.code||"unexpected_error",message:e.message};break;}sleep();}}while(Date.now()<=end);if(cfg.first===mode)fs.writeFileSync(cfg.barrier,"committed");console.log(JSON.stringify(out));'
  );
  const call = (mode) =>
    new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [script, config, mode]);
      let out = '';
      child.stdout.on('data', (b) => (out += b));
      child.on('close', () => {
        try {
          resolve(JSON.parse(out));
        } catch (e) {
          reject(e);
        }
      });
    });
  const orderings = new Set();
  for (let i = 0; i < 20; i++) {
    const date = new Date(Date.parse('2026-11-01T01:30Z') + i * 86400000).toISOString().slice(0, 10);
    f.clock = Date.parse(date + 'T01:30Z');
    const first = i < 2 ? null : i % 2 ? 'manual' : 'timer';
    fs.writeFileSync(
      config,
      JSON.stringify({
        root: f.store,
        registry: f.registry,
        host: f.host,
        clock: f.clock,
        date,
        request: 'manual-' + i,
        first,
        barrier: path.join(f.root, 'barrier-' + i)
      }),
      { mode: 0o600 }
    );
    const results = await Promise.all([call('manual'), call('timer')]),
      winners = results.filter((r) => r.run_id);
    expect(winners).toHaveLength(1);
    const loser = results.find((r) => !r.run_id);
    expect(['busy', 'skipped_busy']).toContain(loser.reason_code || loser.disposition);
    orderings.add(results[0].run_id ? 'manual' : 'timer');
    expect(f.service().status({ repo_id: 'fixture' }).runs).toHaveLength(i + 1);
    f.service().cancel({ repo_id: 'fixture', run_id: winners[0].run_id });
  }
  expect([...orderings].sort()).toEqual(['manual', 'timer']);
}, 60000);
test('CTRL-LIMITS actual #217 relay traverses gateway once, preserves binding and counts native protocol estimate only', () => {
  f = fixture();
  f.clock = Date.now();
  f.register();
  const svc = f.service(),
    admission = svc.admit({ repo_id: 'fixture', request_id: 'provider' }),
    r = { repo_id: 'fixture', run_id: admission.run_id },
    cycle = svc.reserveCycle({
      ...r,
      binding: { job_id: 'native-protocol', operation_id: 'op', core_run_id: 'core' }
    }).cycle;
  const gateway = require('../../scripts/improve-controller-provider.cjs').writeGateway(
    path.join(f.root, 'gateway'),
    {
      uid: process.getuid(),
      require_stage: false,
      principal: 'owner',
      ownerPrincipal: 'owner',
      store: f.store,
      registry: f.registry,
      host: f.host,
      repo_id: 'fixture',
      profile_revision: f.revision,
      run_id: admission.run_id,
      cycle_id: cycle.id,
      cli: f.cli,
      requested_models: { builder: 'sonnet', oracle: 'opus', peer: 'opus', judge: 'opus' },
      routing: {
        builder: 'fixture-builder',
        oracle: 'fixture-oracle',
        peer: 'fixture-peer',
        judge: 'fixture-judge'
      }
    }
  );
  const cwd = path.join(f.root, 'empty'),
    evidence = path.join(f.root, 'roles');
  fs.mkdirSync(cwd, { mode: 0o700 });
  fs.mkdirSync(evidence, { mode: 0o700 });
  const result = worker.roleCall({
    role: 'builder',
    model: 'sonnet',
    effectiveModel: 'fixture-builder',
    prompt: 'Protocol fixture only',
    schema: { type: 'object', properties: {} },
    cwd,
    evidence,
    claude: gateway
  });
  expect(result.provenance).toMatchObject({
    model: 'fixture-builder',
    io_tool_calls: 0,
    cli_estimate_usd: 99,
    actual_charges: 'unmeasured'
  });
  const status = svc.status(r).runs[0];
  expect(status).toMatchObject({
    consumed_attempts: 1,
    actual_spend_usd: null,
    actual_remaining_spend_usd: null
  });
  expect(status.operations[0].state).toBe('complete');
  expect(status.estimates[0].usd).toBe(99);
  expect(status.reasons).toEqual([]);
});
test('CTRL-IDENTITY actual installed CLI status is read-only and activation returns exact recovery blocker', () => {
  f = fixture();
  f.clock = Date.now();
  f.register();
  const host = path.join(f.root, 'owner-host.json');
  fs.writeFileSync(
    host,
    JSON.stringify({
      version: 1,
      uid: process.getuid(),
      require_stage: false,
      principal: 'owner',
      ownerPrincipal: 'owner',
      registry: f.registry,
      store: f.store,
      host: f.host
    }),
    { mode: 0o600 }
  );
  const call = (...args) =>
    require('child_process').spawnSync(
      process.execPath,
      [path.resolve('bin/specflow.js'), 'improve-controller', ...args, '--host', host],
      { encoding: 'utf8' }
    );
  const a = call('admit', '--repo', 'fixture', '--request', 'cli');
  expect(a.status).toBe(0);
  const admission = JSON.parse(a.stdout);
  expect(admission.run_id).toBeTruthy();
  const before = fs.readFileSync(path.join(f.store, 'controller.json'));
  const status = call('status', '--repo', 'fixture', '--run', admission.run_id);
  expect(status.status).toBe(0);
  expect(JSON.parse(status.stdout).runs[0].consumed_attempts).toBe(0);
  expect(fs.readFileSync(path.join(f.store, 'controller.json')).equals(before)).toBe(true);
  call('cancel', '--repo', 'fixture', '--run', admission.run_id);
  const stopped = fs.readFileSync(path.join(f.store, 'controller.json'));
  const report1 = call('report', '--repo', 'fixture', '--run', admission.run_id),
    report2 = call('report', '--repo', 'fixture', '--run', admission.run_id);
  expect(report1.status).toBe(0);
  expect(report2.stdout).toBe(report1.stdout);
  expect(fs.readFileSync(path.join(f.store, 'controller.json')).equals(stopped)).toBe(true);
  const gate = call('schedule', '--repo', 'fixture', '--state', 'enabled');
  expect(gate.status).toBe(2);
  expect(JSON.parse(gate.stdout).reason_code).toBe('recovery_required');
});
test('CTRL-INTERRUPT independent guardian quiesces an actual orphaned owned process group', async () => {
  f = fixture();
  const childPath = path.join(f.root, 'orphan.cjs'),
    pidFile = path.join(f.root, 'grandchild.pid');
  const guardian = require.resolve('../../scripts/improve-controller-watchdog.cjs');
  fs.writeFileSync(
    childPath,
    'const cp=require("child_process"),fs=require("fs"),W=require(' +
      JSON.stringify(guardian) +
      ');const c=cp.spawn(process.execPath,["-e","setInterval(()=>{},1000)"],{stdio:"ignore"});fs.writeFileSync(process.argv[2],String(c.pid));const self=W.birth(process.pid),g=cp.spawn(process.execPath,[' +
      JSON.stringify(guardian) +
      ',JSON.stringify({parent:process.pid,group:self.group,started:self.start,deadline:Date.now()+5000})],{detached:true,stdio:"ignore"});g.unref();setTimeout(()=>process.exit(0),200);'
  );
  const parent = spawn(process.execPath, [childPath, pidFile], { detached: true, stdio: 'ignore' });
  let grandchild;
  try {
    await new Promise((resolve) => parent.on('exit', resolve));
    grandchild = Number(fs.readFileSync(pidFile));
    const birth = require(guardian).birth;
    let quiescent = false;
    for (let i = 0; i < 40; i++) {
      const p = birth(grandchild);
      if (!p || ['Z', 'X'].includes(p.state)) {
        quiescent = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(quiescent).toBe(true);
  } finally {
    try {
      process.kill(-parent.pid, 'SIGKILL');
    } catch {}
  }
});
test('CTRL-TERMINAL prior job binding cannot count again as a fresh cycle', () => {
  const { s, r, cycle } = begin();
  s.completeCycle({ ...r, cycle_id: cycle.id }, archive(cycle));
  expect(() => s.reserveCycle({ ...r, binding: cycle.binding })).toThrow('cycle_binding_reused');
  expect(s.status(r).runs[0].terminal_cycles).toBe(1);
});
async function gatewayCase(mode, { cancel = false, wallMs = 10000, revoke = false } = {}) {
  f = fixture();
  f.clock = Date.now();
  f.register({ limits: { ...f.policy().limits, maxWallMs: wallMs } });
  const svc = f.service(),
    a = svc.admit({ repo_id: 'fixture', request_id: 'native-' + mode }),
    r = { repo_id: 'fixture', run_id: a.run_id },
    cycle = svc.reserveCycle({
      ...r,
      binding: { job_id: 'native-' + mode, operation_id: 'op', core_run_id: 'core' }
    }).cycle;
  const ctx = {
    uid: process.getuid(),
    require_stage: false,
    principal: 'owner',
    ownerPrincipal: 'owner',
    store: f.store,
    registry: f.registry,
    host: f.host,
    repo_id: 'fixture',
    profile_revision: f.revision,
    run_id: a.run_id,
    cycle_id: cycle.id,
    cli: f.cli,
    requested_models: { builder: 'sonnet', oracle: 'opus', peer: 'opus', judge: 'opus' },
    routing: {
      builder: 'fixture-builder',
      oracle: 'fixture-opus',
      peer: 'fixture-opus',
      judge: 'fixture-opus'
    }
  };
  const gateway = require('../../scripts/improve-controller-provider.cjs').writeGateway(
      path.join(f.root, 'gateway-case'),
      ctx
    ),
    cwd = path.join(f.root, 'empty-case'),
    evidence = path.join(f.root, 'roles-case');
  fs.mkdirSync(cwd, { mode: 0o700 });
  fs.mkdirSync(evidence, { mode: 0o700 });
  fs.writeFileSync(path.join(f.root, 'provider-mode.json'), JSON.stringify({ mode }), { mode: 0o600 });
  const driver = path.join(f.root, 'driver.cjs');
  fs.writeFileSync(
    driver,
    'const w=require(' +
      JSON.stringify(require.resolve('../../scripts/improve-worker.cjs')) +
      ');try{const result=w.roleCall(' +
      JSON.stringify({
        role: 'builder',
        model: 'sonnet',
        effectiveModel: 'fixture-builder',
        prompt: 'Explicit protocol double only',
        schema: { type: 'object', properties: {} },
        cwd,
        evidence,
        claude: gateway
      }) +
      ');console.log(JSON.stringify({passed:true,provenance:result.provenance}));}catch(e){console.error(JSON.stringify({code:e.code}));process.exitCode=2;}'
  );
  if (revoke) f.update((p) => (p.grants.owner = ['read', 'preflight']));
  const child = spawn(process.execPath, [driver], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '',
    stderr = '';
  child.stdout.on('data', (b) => (stdout += b));
  child.stderr.on('data', (b) => (stderr += b));
  const done = new Promise((resolve) => child.on('close', (code) => resolve({ code, stdout, stderr }))),
    timeout = setTimeout(() => child.kill('SIGKILL'), 9000);
  const marker = path.join(f.root, 'provider-started.json');
  try {
    if (cancel) {
      const end = Date.now() + 4000;
      while (!fs.existsSync(marker) && Date.now() < end) await new Promise((r) => setTimeout(r, 25));
      expect(fs.existsSync(marker)).toBe(true);
      f.clock = Date.now();
      svc.cancel(r);
    }
    const result = await done;
    f.clock = Date.now();
    const state = svc.status(r).runs[0];
    return { result, state, svc, request: r, marker, root: f.root };
  } finally {
    clearTimeout(timeout);
    if (fs.existsSync(marker)) {
      const owned = JSON.parse(fs.readFileSync(marker));
      try {
        process.kill(-owned.group, 'SIGKILL');
      } catch {}
    }
  }
}
test.each([
  ['quota', 'provider_quota'],
  ['auth', 'provider_auth'],
  ['malformed', 'protocol_failure'],
  ['binding', 'protocol_failure'],
  ['nonzero', 'provider_failure']
])(
  'CTRL-LIMITS actual gateway diagnoses protocol fixture %s as %s',
  async (mode, reason) => {
    const { state, result } = await gatewayCase(mode);
    expect(result.code).toBe(2);
    expect(state).toMatchObject({
      reason_code: reason,
      consumed_attempts: 1,
      actual_spend_usd: null,
      remaining: { attempts: 2 }
    });
    expect(state.operations[0].state).toBe('complete');
    expect(state.evidence.every((v) => fs.existsSync(v))).toBe(true);
    expect(state.reasons).not.toContain('budget_exhausted');
  },
  15000
);
test('CTRL-LIMITS actual deadline-hang records deadline and preserves original allowance', async () => {
  const { state, result } = await gatewayCase('hang', { wallMs: 2500 });
  expect(result.code).toBe(2);
  expect(state).toMatchObject({
    reason_code: 'deadline',
    consumed_attempts: 1,
    remaining: { attempts: 2, wall_ms: 0 }
  });
}, 15000);
test('CTRL-AUTH actual mid-run cancellation records cancellation separately from future schedule state', async () => {
  const { state, result, svc } = await gatewayCase('hang', { cancel: true });
  expect(result.code).toBe(2);
  expect(state).toMatchObject({
    reason_code: 'operator_cancelled',
    consumed_attempts: 1,
    cancel_requested: true,
    remaining: { attempts: 2 }
  });
  expect(svc.status({ repo_id: 'fixture' }).schedule.state).toBe('paused');
}, 15000);
test('CTRL-AUTH actual gateway after revoke starts no provider and spends no attempt', async () => {
  const { state, result, marker, root } = await gatewayCase('success', { revoke: true });
  expect(result.code).toBe(2);
  expect(state.consumed_attempts).toBe(0);
  expect(fs.existsSync(marker)).toBe(false);
  const raw = fs
    .readdirSync(path.join(root, 'roles-case'))
    .filter((x) => x.endsWith('.stderr'))
    .map((x) => fs.readFileSync(path.join(root, 'roles-case', x), 'utf8'))
    .join('\n');
  expect(raw).toMatch(/authority_revoked|stale_profile/);
}, 15000);
function stageAdapter({ provider = false, wallMs = 10000 } = {}) {
  f = fixture();
  f.clock = Date.now();
  f.register({ limits: { ...f.policy().limits, maxWallMs: wallMs } });
  const service = f.service(),
    a = service.admit({ repo_id: 'fixture', request_id: 'staged' }),
    req = { repo_id: 'fixture', run_id: a.run_id },
    cycle = service.reserveCycle({
      ...req,
      binding: { job_id: 'staged-job', operation_id: 'staged-op', core_run_id: 'core' }
    }).cycle,
    binding = { ...req, cycle_id: cycle.id };
  const bin = path.join(f.root, 'stage-bin'),
    cwd = path.join(f.root, 'stage-cwd'),
    evidence = path.join(f.root, 'stage-evidence');
  for (const dir of [bin, cwd, evidence]) fs.mkdirSync(dir, { mode: 0o700 });
  const marker = path.join(f.root, 'stage-started');
  let source =
    'require("fs").writeFileSync(' +
    JSON.stringify(marker) +
    ',"started");console.log(JSON.stringify({status:"ok"}));';
  if (provider) {
    const gateway = require('../../scripts/improve-controller-provider.cjs').writeGateway(
      path.join(f.root, 'stage-gateway'),
      {
        uid: process.getuid(),
        principal: 'owner',
        ownerPrincipal: 'owner',
        store: f.store,
        registry: f.registry,
        host: f.host,
        ...binding,
        profile_revision: f.revision,
        cli: f.cli,
        require_stage: true,
        requested_models: { builder: 'sonnet' },
        routing: { builder: 'fixture-builder' }
      }
    );
    source =
      'const w=require(' +
      JSON.stringify(require.resolve('../../scripts/improve-worker.cjs')) +
      ');const result=w.roleCall(' +
      JSON.stringify({
        role: 'builder',
        model: 'sonnet',
        effectiveModel: 'fixture-builder',
        prompt: 'Staged protocol fixture only',
        schema: { type: 'object', properties: {} },
        cwd,
        evidence,
        claude: gateway
      }) +
      ');console.log(JSON.stringify({status:"ok",model:result.provenance.model}));';
  }
  const launcher = path.join(bin, 'worker-command'),
    configFile = path.join(bin, 'job.json');
  fs.writeFileSync(launcher, '#!' + process.execPath + '\n' + source, { mode: 0o700 });
  fs.writeFileSync(
    configFile,
    JSON.stringify({
      authority: { uid: process.getuid(), principal: 'owner', repo_id: 'fixture', revision: f.revision },
      controller_binding: binding,
      bin,
      emptyCwd: cwd,
      launcher
    }),
    { mode: 0o600 }
  );
  const adapter = require('../../scripts/improve-controller-worker.cjs').createControllerWorker({
    service,
    binding,
    configFile,
    evidenceDir: path.join(f.root, 'stage-receipts')
  });
  return { service, binding, adapter, marker };
}
test('CTRL-LIMITS a non-model worker stage cannot start after the original deadline or cancellation', () => {
  const { service, binding, adapter, marker } = stageAdapter();
  f.clock += 10000;
  expect(() => adapter.start('verifyPhase', [])).toThrow('deadline');
  expect(fs.existsSync(marker)).toBe(false);
  expect(
    service.status({ repo_id: binding.repo_id, run_id: binding.run_id }).runs[0].operations
  ).toHaveLength(0);
});
test('CTRL-AUTH a cancelled job cannot launch a non-model stage', () => {
  const { service, binding, adapter, marker } = stageAdapter();
  service.cancel({ repo_id: binding.repo_id, run_id: binding.run_id });
  expect(() => adapter.start('prepareWorkspace', [])).toThrow('operator_cancelled');
  expect(fs.existsSync(marker)).toBe(false);
});
test('CTRL-INTERRUPT durable stage intent excludes another stage and retains an unacknowledged owner', async () => {
  const { service, binding, adapter } = stageAdapter();
  const child = adapter.start('prepareWorkspace', []);
  expect(() => adapter.start('verifyPhase', [])).toThrow('reconciliation_required');
  await adapter.wait(child);
  expect(
    service.status({ repo_id: binding.repo_id, run_id: binding.run_id }).runs[0].operations[0].state
  ).toBe('complete');
});
test('CTRL-LIMITS real staged relay admits only the descendant native invocation and retains both receipts', async () => {
  const { service, binding, adapter } = stageAdapter({ provider: true });
  const child = adapter.start('build', []),
    result = await adapter.wait(child);
  expect(result.status).toBe(0);
  const state = service.status({ repo_id: binding.repo_id, run_id: binding.run_id }).runs[0];
  expect(state).toMatchObject({ consumed_attempts: 1, active_stage: null });
  expect(state.operations.map((o) => o.kind)).toEqual(['stage', 'provider']);
  expect(state.operations.every((o) => o.state === 'complete')).toBe(true);
}, 15000);
test('CTRL-LIMITS final report distinguishes exhausted cycle allowance from the authenticated core failure', () => {
  f = fixture();
  f.register({ limits: { ...f.policy().limits, maxCycles: 1 } });
  const s = f.service(),
    a = s.admit({ repo_id: 'fixture', request_id: 'diagnosed' }),
    r = { repo_id: 'fixture', run_id: a.run_id },
    cycle = s.reserveCycle({
      ...r,
      binding: { job_id: 'diagnosed-job', operation_id: 'op', core_run_id: 'core' }
    }).cycle;
  s.completeCycle(
    { ...r, cycle_id: cycle.id },
    archive(cycle, 'INCONCLUSIVE', () => {}, {
      reasons: ['Required check did not pass'],
      gates_failed: ['backend-smoke'],
      gates_missing: [],
      binding_errors: []
    })
  );
  const report = s.report(r);
  expect(report).toMatchObject({
    reason_code: 'cycles_exhausted',
    failed_check: 'backend-smoke',
    product_success: 'not_established',
    cycle_decisions: [
      {
        decision: 'INCONCLUSIVE',
        core_diagnosis: { reasons: ['Required check did not pass'], gates_failed: ['backend-smoke'] }
      }
    ]
  });
});
