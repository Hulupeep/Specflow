'use strict';
// Explicit owner qualification, fixed #217 Node recipe only. No timer/API/fallback.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  { spawnSync } = require('child_process');
const kit = path.resolve(__dirname, '../..');
const w = require(path.join(kit, 'scripts/improve-worker.cjs')),
  q = require(path.join(kit, 'scripts/improve-worker-qualify.cjs')),
  core = require(path.join(kit, 'scripts/specflow-improve.cjs'));
const c = require(path.join(kit, 'scripts/improve-controller.cjs')),
  gateway = require(path.join(kit, 'scripts/improve-controller-provider.cjs')),
  controlledWorker = require(path.join(kit, 'scripts/improve-controller-worker.cjs')),
  watch = require(path.join(kit, 'scripts/improve-controller-watchdog.cjs'));
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const [ownerFile, phase, rootArg] = process.argv.slice(2),
  need = (v, code) => {
    if (!v) throw new c.ControllerError(code);
  };
const json = (file, value) =>
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }),
  read = (file) => JSON.parse(fs.readFileSync(file));
function service(root) {
  const cfg = read(path.join(root, 'bin/job.json'));
  return c.createControllerService({
    root: path.join(root, 'controller'),
    registry: cfg.authority.registry,
    resolvePrincipal: () => cfg.authority.principal,
    ownerPrincipal: cfg.authority.principal,
    hostCapabilities: () => cfg.authority.host
  });
}
async function main() {
  const o = require(path.join(kit, 'scripts/improve-controller-cli.cjs')).readPrivate(ownerFile);
  let root = rootArg && path.resolve(rootArg);
  const permittedParent = path.join(path.dirname(o.state_root), '181-qualification');
  if (phase === 'transport') {
    need(!rootArg, 'transport_requires_fresh_case');
    const parent = path.join(path.dirname(o.state_root), '181-qualification');
    fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
    root = fs.mkdtempSync(path.join(parent, 'controller-'));
    fs.chmodSync(root, 0o700);
    const pointer = path.join(parent, 'current-root.json');
    fs.writeFileSync(pointer, JSON.stringify({ root }), { mode: 0o600 });
    await q.transport(o, root);
    console.log(
      JSON.stringify({
        phase,
        actualExecution: true,
        root,
        status: 'passed',
        note: 'Two approved native transport probes are outside the not-yet-admitted controller job.'
      })
    );
    return;
  }
  need(
    root &&
      root.startsWith(permittedParent + path.sep) &&
      /^controller-[A-Za-z0-9]+$/.test(path.basename(root)) &&
      !fs.lstatSync(root).isSymbolicLink() &&
      fs.realpathSync(root) === root &&
      fs.statSync(root).uid === process.getuid() &&
      !(fs.statSync(root).mode & 0o077),
    'owner_private_root_required'
  );
  if (phase === 'configure') {
    need(!fs.existsSync(path.join(root, 'controller-binding.json')), 'configuration_already_bound');
    const cfg = q.configure(o, root),
      svc = service(root);
    let carry = null;
    if (o.qualification_carry) {
      const source = path.resolve(o.qualification_carry);
      need(source.startsWith(permittedParent + path.sep) && source !== root, 'invalid_qualification_carry');
      const prior = require(path.join(kit, 'scripts/improve-controller-cli.cjs')).readPrivate(
        path.join(source, 'controller/controller.json')
      );
      const previous = Object.values(prior.runs).find((r) => r.consumed_cycles > 0);
      need(
        previous && previous.operations.every((op) => op.state === 'complete'),
        'carry_requires_known_quiescence'
      );
      const active = read(path.join(source, 'active-core.json')).runDir;
      need(
        !core
          .events(active)
          .some((e) => ['contract_frozen', 'implementation_started', 'holdout_consumed'].includes(e.event)),
        'consumed_case_cannot_be_reused'
      );
      carry = {
        source,
        original_deadline_ms: previous.deadline_ms,
        remaining_attempts: previous.limits.maxAttempts - previous.consumed_attempts,
        previous_attempts: previous.consumed_attempts
      };
      need(
        carry.remaining_attempts > 0 && carry.original_deadline_ms > Date.now() + 30000,
        'qualification_allowance_exhausted'
      );
    }

    svc.registerPolicy({
      version: 1,
      repo_id: cfg.authority.repo_id,
      profile_revision: cfg.authority.revision,
      limits: { maxCycles: 1, maxAttempts: 24, maxConsecutiveNoProgress: 2, maxWallMs: 1800000 },
      schedule: null
    });
    // Controlled empty discovery input against the REAL approved repository.
    // No candidate, model, core cycle or publisher operation is admitted.
    const probeWorker = new w.DockerWorker(cfg.worker),
      repo = read(path.join(root, 'configuration.json')).repo;
    let before, after;
    try {
      const inspectGit = (args) => {
        const observed = w.isolatedGit(probeWorker, cfg.gitArea, args, { cwd: repo });
        return {
          command: args,
          status: observed.status,
          stdout: observed.stdout,
          stderr: observed.stderr,
          error: observed.error?.code || null
        };
      };
      const inspect = () => ({
        status: inspectGit(['status', '--porcelain']),
        head: inspectGit(['rev-parse', 'HEAD']),
        branches: inspectGit(['branch', '--list']),
        source_sha256: sha(fs.readFileSync(path.join(repo, 'server.cjs')))
      });
      before = inspect();
      const empty = svc.admit({
        repo_id: cfg.authority.repo_id,
        request_id: 'empty-' + sha(root).slice(0, 24)
      });
      need(empty.run_id, 'empty_probe_admission_failed');
      const emptyEvidence = path.join(root, 'empty-opportunities.json');
      json(emptyEvidence, {
        kind: 'controlled-empty-discovery-input',
        eligible_opportunities: [],
        repository_head: before.head.stdout.trim(),
        no_full_repo_discovery_claim: true
      });
      const emptyReq = { repo_id: cfg.authority.repo_id, run_id: empty.run_id };
      svc.stop(emptyReq, {
        reason_code: 'no_safe_work',
        stage: 'selection',
        failed_check: null,
        evidence: [emptyEvidence]
      });
      const report = svc.report(emptyReq);
      need(
        report.consumed.cycles === 0 && report.consumed.attempts === 0 && report.reserved.length === 0,
        'empty_probe_did_work'
      );
      after = inspect();
      need(
        [before, after].every(
          (x) => x.status.status === 0 && x.head.status === 0 && x.branches.status === 0
        ) && JSON.stringify(before) === JSON.stringify(after),
        'empty_probe_changed_repository'
      );
      json(path.join(root, 'controller-empty-proof.json'), {
        actualExecution: true,
        input: 'controlled empty opportunity set, not a claimed repo discovery run',
        report,
        before,
        after,
        noPatchOrBranch: true,
        publisherConfigured: false,
        publicationAllowed: false,
        noControllerWorkerOrModelOperation: true
      });
    } finally {
      probeWorker.close();
    }
    if (carry) {
      // Lower, never refresh: retain the earlier absolute wall bound and the
      // native allowance left by the failed input qualification.
      svc.registerPolicy({
        version: 1,
        repo_id: cfg.authority.repo_id,
        profile_revision: cfg.authority.revision,
        limits: {
          maxCycles: 1,
          maxAttempts: carry.remaining_attempts,
          maxConsecutiveNoProgress: 2,
          maxWallMs: Math.max(1, carry.original_deadline_ms - Date.now() - 15000)
        },
        schedule: null
      });
    }
    const admitted = svc.admit({
        repo_id: cfg.authority.repo_id,
        request_id: 'qualification-' + sha(root).slice(0, 24)
      }),
      req = { repo_id: cfg.authority.repo_id, run_id: admitted.run_id };
    need(admitted.run_id, 'admission_failed');
    if (carry) {
      need(admitted.run.deadline_ms <= carry.original_deadline_ms, 'qualification_deadline_was_extended');
      json(path.join(root, 'qualification-carried-allowance.json'), {
        ...carry,
        new_deadline_ms: admitted.run.deadline_ms,
        new_limits: admitted.run.limits,
        no_counter_reset: true
      });
    }
    const binding = {
        job_id: 'qualification-' + sha(root).slice(0, 24),
        operation_id: 'worker-core-once',
        core_run_id: 'worker-core-once'
      },
      cycle = svc.reserveCycle({ ...req, binding });
    need(cycle.allowed, 'cycle_denied');
    const bound = { ...req, cycle_id: cycle.cycle.id, worker_binding: binding };
    json(
      path.join(root, 'controller-initial-run.json'),
      svc.status({ repo_id: req.repo_id, run_id: req.run_id }).runs[0]
    );
    json(path.join(root, 'controller-binding.json'), bound);
    const seedHelper = path.join(kit, 'evidence/improve-worker/run-core-phase.cjs');
    const ctx = {
      uid: process.getuid(),
      principal: cfg.authority.principal,
      ownerPrincipal: cfg.authority.principal,
      store: path.join(root, 'controller'),
      registry: cfg.authority.registry,
      host: cfg.authority.host,
      ...req,
      profile_revision: cfg.authority.revision,
      cycle_id: cycle.cycle.id,
      cli: cfg.claude,
      routing: cfg.models,
      requested_models: { builder: 'sonnet', oracle: 'opus', peer: 'opus', judge: 'opus' },
      proof_inputs: [
        {
          path: path.join(root, 'controller-binding.json'),
          sha256: sha(fs.readFileSync(path.join(root, 'controller-binding.json')))
        },
        {
          path: path.join(root, 'controller-initial-run.json'),
          sha256: sha(fs.readFileSync(path.join(root, 'controller-initial-run.json')))
        },
        { path: seedHelper, sha256: sha(fs.readFileSync(seedHelper)) }
      ]
    };
    const provider = gateway.writeGateway(path.join(root, 'gateway'), ctx);
    // These launchers have never run a core stage. Preserve them, then compile
    // the controller-bound closure before any contract/oracle/workspace freezes.
    fs.renameSync(path.join(root, 'bin'), path.join(root, 'unbound-configuration'));
    fs.mkdirSync(path.join(root, 'bin'), { mode: 0o700 });
    const controlled = { ...cfg, claude: provider, controller_binding: bound };
    w.pinnedLauncher({ directory: cfg.bin, config: controlled, mode: 'git' });
    w.pinnedLauncher({ directory: cfg.bin, config: controlled, mode: 'worker' });
    console.log(
      JSON.stringify({
        phase,
        actualExecution: true,
        status: 'passed',
        run_id: req.run_id,
        cycle_id: bound.cycle_id,
        usage_mode: 'subscription_cli',
        actual_charges: 'unmeasured'
      })
    );
    return;
  }
  const cfg = read(path.join(root, 'bin/job.json')),
    ctx = require(path.join(root, 'gateway/controller-provider'));
  for (const input of ctx.proof_inputs)
    need(sha(fs.readFileSync(input.path)) === input.sha256, 'proof_input_changed');
  const req = read(path.join(root, 'controller-binding.json')),
    svc = service(root),
    file = path.join(root, 'controller-proof-phases.json');
  const history = fs.existsSync(file) ? read(file) : [],
    order = [
      'begin',
      'critique',
      'oracle',
      'seed',
      'freeze',
      'baseline',
      'build',
      'verify',
      'judge',
      'evaluate',
      'finalize',
      'persist'
    ];
  need(!history.some((r) => r.status === 'started'), 'reconciliation_required');
  need(
    history.every((r) => r.status === 'complete'),
    'qualification_requires_diagnosis'
  );
  need(order[history.length] === phase, 'phase_order_or_replay_denied');
  const adapter = controlledWorker.createControllerWorker({
    service: svc,
    binding: req,
    configFile: path.join(root, 'bin/job.json'),
    evidenceDir: path.join(root, 'controller-stage-evidence')
  });
  // Qualification-only, one-job process binding of the old helper's public
  // launch/wait seams. The production adapter itself has no global mutation.
  w.startAuthorizedStage = (configFile, stage, args) => {
    need(path.resolve(configFile) === path.join(root, 'bin/job.json'), 'cross_job_stage_denied');
    if (stage === 'oracle') {
      const prompt = args[1]?.prompt;
      need(
        typeof prompt === 'string' && path.resolve(prompt).startsWith(root + path.sep),
        'oracle_prompt_outside_case'
      );
      fs.appendFileSync(
        prompt,
        '\nFixture timing clarification from a preserved failed qualification: the role=status element is intentionally empty and may have zero visible size BEFORE any response. Do not demand initial visibility. First perform the real authorised POST, confirm it reached/persisted on the backend, THEN require visible Saved feedback; the broken seed must fail for empty feedback after that write. Two viewport tests share one app within a check invocation: do not require seed state at each test start. Each separate check invocation gets a fresh backend. Preserve all success/403/reload/direct-readback and screenshot assertions. No builder access to the hidden file.\n'
      );
    }
    return adapter.start(stage, args);
  };
  w.awaitStage = (child) => adapter.wait(child);
  history.push({ phase, status: 'started', host_pid: process.pid, at: new Date().toISOString() });
  fs.writeFileSync(file, JSON.stringify(history, null, 2), { mode: 0o600 });
  try {
    let result;
    if (phase === 'begin') result = await q.beginCore(root);
    else if (phase === 'seed') {
      const helper = ctx.proof_inputs.find((i) => i.path.endsWith('/run-core-phase.cjs')).path;
      const admitted = svc.startStage(
        { repo_id: req.repo_id, run_id: req.run_id, cycle_id: req.cycle_id, stage: 'qualification-seed' },
        (entry) => {
          const child = require('child_process').spawn(process.execPath, [helper, root, 'seed'], {
              stdio: ['ignore', 'pipe', 'pipe'],
              detached: true,
              env: w.controlledEnvironment()
            }),
            birth = watch.birth(child.pid);
          need(birth, 'stage_launch_unconfirmed');
          const guardian = require('child_process').spawn(
            process.execPath,
            [
              path.join(kit, 'scripts/improve-controller-watchdog.cjs'),
              JSON.stringify({
                parent: child.pid,
                group: child.pid,
                started: birth.start,
                deadline: entry.deadline_ms + 1000
              })
            ],
            { stdio: 'ignore', detached: true }
          );
          guardian.unref();
          child.controllerGuardian = guardian;
          return child;
        }
      );
      need(admitted.result.allowed, 'seed_stage_denied');
      admitted.started.controllerOperation = admitted.result.operation.id;
      const r = await adapter.wait(admitted.started);
      json(path.join(root, 'controller-seed-execution.json'), {
        command: [process.execPath, helper, root, 'seed'],
        exitCode: r.status,
        stdout: r.stdout,
        stderr: r.stderr
      });
      need(r.status === 0, 'fresh_seed_diagnostic_failed');
      result = { status: 'passed' };
    } else if (phase === 'persist') {
      const active = read(path.join(root, 'active-core.json')).runDir;
      need(core.status(active).terminal, 'core_not_terminal');
      json(path.join(root, 'controller-core-summary.json'), {
        decision: core.status(active).decision,
        ledger: core.verifyLedger(active),
        holdoutConsumed: core.events(active).filter((e) => e.event === 'holdout_consumed').length
      });
      await q.persist(root);
      const store = new w.DurableStore({ root: path.join(root, 'durable'), sourceRoot: active }),
        before = svc.status({ repo_id: req.repo_id, run_id: req.run_id }).runs[0].consumed_attempts;
      const first = svc.completeCycle(
          { repo_id: req.repo_id, run_id: req.run_id, cycle_id: req.cycle_id },
          store
        ),
        second = svc.completeCycle(
          { repo_id: req.repo_id, run_id: req.run_id, cycle_id: req.cycle_id },
          store
        );
      need(
        first.terminal_cycles === 1 &&
          second.terminal_cycles === 1 &&
          first.consumed_attempts === before &&
          second.consumed_attempts === before,
        'controller_terminal_retry_mismatch'
      );
      need(
        first.operations.every((o) => o.state === 'complete') && before > 0,
        'native_accounting_incomplete'
      );
      json(
        path.join(root, 'controller-final-report.json'),
        svc.report({ repo_id: req.repo_id, run_id: req.run_id })
      );
      const original = read(path.join(root, 'controller-initial-run.json'));
      need(
        JSON.stringify(first.limits) === JSON.stringify(original.limits) &&
          first.deadline_ms === original.deadline_ms,
        'original_limits_changed'
      );
      const completed = history.filter((r) => r.status === 'complete');
      need(new Set(completed.map((r) => r.host_pid)).size > 1, 'controller_restart_not_observed');
      json(path.join(root, 'controller-restart-proof.json'), {
        actualExecution: true,
        original_limits: original.limits,
        original_deadline_ms: original.deadline_ms,
        final_limits: first.limits,
        final_deadline_ms: first.deadline_ms,
        phase_processes: completed.map((r) => ({
          phase: r.phase,
          pid: r.host_pid,
          state: r.controller_state
        })),
        terminalCycles: second.terminal_cycles,
        actualNativeStarts: second.consumed_attempts,
        noLimitRefresh: true,
        noConsumedHoldoutReplay: true
      });
      result = {
        status: 'passed',
        decision: first.cycles[0].decision,
        actualNativeStarts: before,
        remaining: first.remaining,
        manifest: first.cycles[0].manifest_sha256,
        coreSourceDestroyed: !fs.existsSync(active),
        gitDestroyed: !fs.existsSync(cfg.gitArea),
        noNewProviderOnTerminalRetry: true
      };
    } else {
      result = await q.phase(root, phase);
      if (phase === 'critique') need(result.verdict === 'pursue', 'independent_critique_not_pursue');
      if (phase === 'finalize')
        need(core.status(read(path.join(root, 'active-core.json')).runDir).terminal, 'core_not_terminal');
    }
    const observed = svc.status({ repo_id: req.repo_id, run_id: req.run_id }).runs[0];
    history[history.length - 1] = {
      ...history.at(-1),
      status: 'complete',
      controller_state: {
        limits: observed.limits,
        deadline_ms: observed.deadline_ms,
        consumed_attempts: observed.consumed_attempts,
        consumed_cycles: observed.consumed_cycles
      },
      ended_at: new Date().toISOString()
    };
    fs.writeFileSync(file, JSON.stringify(history, null, 2), { mode: 0o600 });
    console.log(
      JSON.stringify({
        phase,
        actualExecution: true,
        status: 'passed',
        ...(phase === 'persist' ? result : {}),
        ...(phase === 'evaluate' ? { decision: result.decision } : {})
      })
    );
  } catch (error) {
    history[history.length - 1] = {
      ...history.at(-1),
      status: 'failed',
      ended_at: new Date().toISOString(),
      code: error.code || error.message
    };
    fs.writeFileSync(file, JSON.stringify(history, null, 2), { mode: 0o600 });
    throw error;
  }
}
main().catch((e) => {
  console.error(
    JSON.stringify({
      phase,
      status: 'failed',
      reason_code: e.code || e.message,
      next_action:
        e.next_action ||
        'Inspect private phase/worker/controller evidence; never replay a consumed holdout or reset the original allowance.'
    })
  );
  process.exitCode = 1;
});
