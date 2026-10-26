'use strict';

// Explicit owner-only qualification of fixed Node/backend/native recovery. No timer or publisher.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  cp = require('child_process');
const kit = path.resolve(__dirname, '../..'),
  w = require(path.join(kit, 'scripts/improve-worker.cjs')),
  q = require(path.join(kit, 'scripts/improve-worker-qualify.cjs')),
  c = require(path.join(kit, 'scripts/improve-controller.cjs')),
  p = require(path.join(kit, 'scripts/improve-profiles.cjs')),
  proc = require(path.join(kit, 'scripts/improve-process-identity.cjs'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex'),
  read = file => JSON.parse(fs.readFileSync(file)),
  write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', {
    mode: 0o600
  }),
  need = (ok, code) => {
    if (!ok) throw Error(code);
  };
function currentService(root) {
  const cfg = read(path.join(root, 'bin/job.json')),
    recovery = require(path.join(kit, 'scripts/improve-recovery-host.cjs')).fromConfig(cfg.recovery, {
      principal: cfg.authority.principal,
      store: cfg.recovery.store,
      registry: cfg.authority.registry,
      routing: cfg.models,
      requested_models: {
        builder: 'sonnet',
        oracle: 'opus',
        peer: 'opus',
        judge: 'opus'
      }
    });
  return c.createControllerService({
    root: cfg.recovery.store,
    registry: cfg.authority.registry,
    resolvePrincipal: () => recovery.resolveAssignment().principal,
    ownerPrincipal: cfg.authority.principal,
    hostCapabilities: () => cfg.authority.host,
    recovery
  });
}
const clarification = '\nFixture timing: role=status is intentionally empty and may have zero visible size BEFORE a response. First perform the real authorised POST, confirm persisted backend data, THEN require visible Saved. Broken seed must fail for empty feedback after that write. Two viewport tests share one app within a check invocation: do not require seed at every test start. Each separate check invocation has a fresh backend. Preserve all success/403/reload/direct-readback and screenshot assertions.\n';
async function executePhase(root, phase) {
  const cfg = read(path.join(root, 'bin/job.json')),
    service = currentService(root),
    binding = cfg.controller_binding,
    adapter = require(path.join(kit, 'scripts/improve-controller-worker.cjs')).createControllerWorker({
      service,
      binding,
      configFile: path.join(cfg.bin, 'job.json'),
      evidenceDir: path.join(root, 'stage-evidence')
    });
  w.startAuthorizedStage = (config, stage, args) => {
    need(config === path.join(cfg.bin, 'job.json'), 'cross_job_stage');
    if (stage === 'oracle') fs.appendFileSync(args[1].prompt, clarification);
    return adapter.start(stage, args);
  };
  w.awaitStage = child => adapter.wait(child);
  const log = path.join(root, 'phases.json'),
    history = fs.existsSync(log) ? read(log) : [];
  need(!history.some(h => h.state !== 'complete'), 'phase_reconciliation_required');
  history.push({
    phase,
    state: 'started',
    pid: process.pid,
    startedAt: new Date().toISOString()
  });
  write(log, history);
  let result;
  if (phase === 'begin') result = await q.beginCore(root);else if (phase === 'seed') {
    const args = [read(path.join(root, 'active-core.json')).runDir],
      stage = 'qualification-seed',
      input = require(path.join(kit, 'scripts/improve-operation-inputs.cjs')).stageInput(stage, args, path.join(cfg.bin, 'job.json')),
      bound = service.status(bindingOnly(binding)).runs[0];
    const receipt = {
      root: path.join(cfg.recovery.store, 'operation-receipts'),
      registry: cfg.authority.registry,
      lockTool: cfg.recovery.lockTool
    };
    new (require(path.join(kit, 'scripts/improve-operation-receipts.cjs')).OperationReceipts)({
      ...receipt,
      create: true
    });
    const launched = service.startStage({
      ...bindingOnly(binding),
      cycle_id: binding.cycle_id,
      stage,
      input_sha256: input
    }, entry => require(path.join(kit, 'scripts/improve-paused-operation.cjs')).spawnOperation({
      executable: process.execPath,
      args: [path.join(kit, 'evidence/improve-worker/run-core-phase.cjs'), root, 'seed'],
      options: {
        cwd: cfg.emptyCwd,
        env: {
          ...w.controlledEnvironment(),
          PATH: cfg.bin + ':' + w.controlledEnvironment().PATH
        }
      },
      receipt,
      binding: require(path.join(kit, 'scripts/improve-operation-receipts.cjs')).forOperation(bound, entry.operation),
      kind: 'stage',
      inputCheck: {
        stage,
        args,
        configFile: path.join(cfg.bin, 'job.json')
      },
      control: {
        store: cfg.recovery.store,
        deadline_ms: entry.deadline_ms
      }
    }));
    need(launched.result.allowed, 'seed_stage_denied');
    const child = launched.started;
    child.controllerOperation = launched.result.operation.id;
    child.controllerGeneration = launched.result.operation.generation;
    result = await adapter.wait(child);
    need(result.status === 0, 'seed_diagnostic_failed');
  } else result = await q.phase(root, phase);
  if (result && ['blocked', 'rejected', 'baseline_blocked'].includes(result.status)) throw Error('qualification_' + phase + '_' + result.status);
  if (phase === 'critique') need(result.verdict === 'pursue', 'qualification_candidate_not_pursue');
  history.at(-1).state = 'complete';
  history.at(-1).finishedAt = new Date().toISOString();
  write(log, history);
  return result;
}
const bindingOnly = b => ({
  repo_id: b.repo_id,
  run_id: b.run_id
});
async function holder(root) {
  process.on('message', async msg => {
    try {
      if (msg.action === 'phase') {
        const result = await executePhase(root, msg.phase);
        process.send({
          ok: true,
          result
        });
      } else if (msg.action === 'finish') {
        const f = read(path.join(root, 'finish-request.json')),
          svc = currentService(root),
          archive = new w.DurableStore({
            root: f.archiveRoot,
            sourceRoot: f.sourceRoot
          }),
          before = svc.status(f.req).runs[0],
          first = svc.completeCycle({
            ...f.req,
            cycle_id: f.binding.cycle_id
          }, archive),
          second = svc.completeCycle({
            ...f.req,
            cycle_id: f.binding.cycle_id
          }, archive);
        need(first.terminal_cycles === 1 && second.terminal_cycles === 1 && second.consumed_attempts === before.consumed_attempts, 'native_terminal_duplicate');
        const report = svc.report(f.req);
        write(path.join(root, 'final-controller.json'), second);
        write(path.join(root, 'final-report.json'), report);
        process.send({
          ok: true,
          terminal_cycles: second.terminal_cycles,
          consumed_attempts: second.consumed_attempts,
          deadline_ms: second.deadline_ms,
          report
        });
      } else if (msg.action === 'orphan') {
        const child = cp.spawn(process.execPath, [path.join(kit, 'tests/fixtures/improve-worker/ticket-orphan-probe.cjs'), path.join(root, 'bin/job.json'), path.join(root, 'orphan-trigger'), path.join(root, 'orphan-result.json'), path.join(root, 'forbidden-marker')], {
          detached: true,
          stdio: 'ignore'
        });
        process.send({
          ok: true,
          pid: child.pid
        });
      }
    } catch (e) {
      process.send({
        ok: false,
        code: e.code || e.message
      });
    }
  });
  process.send({
    ready: true
  });
}
function launchHolder(root) {
  const child = cp.fork(__filename, ['--holder', root], {
    stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    env: w.controlledEnvironment()
  });
  const stderr = [];
  child.stderr.on('data', b => stderr.push(b));
  child.once('exit', () => fs.writeFileSync(path.join(root, 'holder-' + child.pid + '.stderr'), Buffer.concat(stderr), {
    mode: 0o600
  }));
  return new Promise((resolve, reject) => {
    child.once('message', () => resolve(child));
    child.once('error', reject);
  });
}
function ask(child, msg) {
  return new Promise((resolve, reject) => {
    const done = result => {
        cleanup();
        result.ok ? resolve(result) : reject(Error(result.code));
      },
      exit = () => {
        cleanup();
        reject(Error('holder_exited'));
      },
      cleanup = () => {
        child.off('message', done);
        child.off('exit', exit);
      };
    child.on('message', done);
    child.once('exit', exit);
    child.send(msg);
  });
}
async function until(check, timeout = 360000) {
  const end = Date.now() + timeout;
  for (;;) {
    const result = check();
    if (result) return result;
    need(Date.now() < end, 'qualification_observation_timeout');
    await new Promise(r => setTimeout(r, 100));
  }
}
async function qualify(ownerFile, root) {
  const startedAt = new Date().toISOString(),
    owner = require(path.join(kit, 'scripts/improve-controller-cli.cjs')).readPrivate(ownerFile);
  need(path.isAbsolute(root) && fs.realpathSync(root) === root && !fs.lstatSync(root).isSymbolicLink() && fs.statSync(root).uid === process.getuid() && !(fs.statSync(root).mode & 0o077), 'private_qualification_root_required');
  let first, next;
  const proof = {
    actualExecution: true,
    startedAt,
    source_manifest_sha256: hash(fs.readFileSync(path.join(kit, 'runtime-manifest.json'))),
    scope: 'Actual native subscription/Node backend single-cycle interruption; original two-cycle core/archive/memory proof is separate. No publication or timer.'
  };
  try {
    need(!fs.existsSync(path.join(root, 'controller-binding.json')), 'fresh_unadmitted_case_required');
    const cfg = q.configure(owner, root),
      profile = read(path.join(cfg.authority.registry, 'profiles', cfg.authority.repo_id + '.json')).profile,
      registry = path.join(root, 'recovery-registry'),
      store = path.join(root, 'controller'),
      lockTool = {
        path: '/usr/bin/flock',
        sha256: hash(fs.readFileSync('/usr/bin/flock')),
        version: cp.execFileSync('/usr/bin/flock', ['--version'], {
          encoding: 'utf8'
        }).trim()
      };
    p.registerProfile(registry, profile, {
      lockTool
    });
    cfg.authority.registry = registry;
    first = await launchHolder(root);
    let actor = {
        principal: cfg.authority.principal,
        holder: 'native-A',
        revision: 'native-assignment-1',
        process: proc.identity(first.pid)
      },
      execution = null;
    const successors = [],
      routes = Object.fromEntries(Object.entries(cfg.models).map(([role, effective_model]) => [role, {
        requested_model: role === 'builder' ? 'sonnet' : 'opus',
        effective_model,
        billing: 'subscription_cli'
      }]));
    const recovery = {
      format: 2,
      registry,
      ticketRoot: path.join(root, 'tickets'),
      lockTool,
      resolveAssignment: () => structuredClone(actor),
      resolveExecution: () => execution ? structuredClone(execution) : null,
      resolveSuccessor: key => successors.find(a => a.principal === key.principal && a.holder === key.holder && a.revision === key.revision),
      resolveProcess: proc.state,
      resolveRoute: role => routes[role],
      resolveReceipt: id => new (require(path.join(kit, 'scripts/improve-operation-receipts.cjs')).OperationReceipts)({
        root: path.join(store, 'operation-receipts'),
        registry,
        lockTool
      }).completion(id),
      resolveTerminalArchive: () => new w.DurableStore({
        root: path.join(root, 'durable'),
        sourceRoot: path.join(root, 'core/worker-core-once')
      })
    };
    const service = () => c.createControllerService({
      root: store,
      registry,
      resolvePrincipal: () => actor.principal,
      ownerPrincipal: cfg.authority.principal,
      hostCapabilities: () => cfg.authority.host,
      recovery
    });
    service().registerPolicy({
      version: 2,
      repo_id: profile.repo_id,
      profile_revision: cfg.authority.revision,
      limits: {
        maxCycles: 1
      },
      schedule: null,
      routes: Object.entries(routes).map(([role, r]) => ({
        role,
        ...r,
        cost: 'ordinary',
        maxStarts: null
      }))
    });
    const admitted = service().admit({
      repo_id: profile.repo_id,
      request_id: 'native-recovery-' + hash(root).slice(0, 24)
    });
    need(admitted.allowed, 'native_admission_denied');
    const req = {
        repo_id: profile.repo_id,
        run_id: admitted.run_id
      },
      command = extra => ({
        ...req,
        request_id: crypto.randomUUID(),
        expected_generation: service().status(req).runs[0].recovery.generation,
        ...extra
      }),
      claim = () => {
        const r = service().resume(command({}));
        need(r.allowed, 'native_claim_denied');
        execution = {
          ...actor,
          generation: r.generation
        };
        service().issueExecutionTicket(req);
        return r;
      };
    claim();
    const worker_binding = {
        job_id: 'qualification-' + hash(root).slice(0, 24),
        operation_id: 'worker-core-once',
        core_run_id: 'worker-core-once'
      },
      cycle = service().reserveCycle({
        ...req,
        binding: worker_binding
      });
    need(cycle.allowed, 'native_cycle_denied');
    const binding = {
      ...req,
      cycle_id: cycle.cycle.id,
      worker_binding
    };
    write(path.join(root, 'controller-binding.json'), binding);
    const initial = service().status(req).runs[0];
    write(path.join(root, 'initial-controller.json'), initial);
    const dynamic = {
        format: 2,
        lockTool,
        ticketRoot: recovery.ticketRoot,
        scope: req,
        store,
        routes,
        archiveStore: {
          root: path.join(root, 'durable'),
          sourceRoot: path.join(root, 'core/worker-core-once')
        }
      },
      ctx = {
        uid: process.getuid(),
        principal: cfg.authority.principal,
        ownerPrincipal: cfg.authority.principal,
        store,
        registry,
        host: cfg.authority.host,
        ...req,
        profile_revision: cfg.authority.revision,
        cycle_id: binding.cycle_id,
        cli: cfg.claude,
        routing: cfg.models,
        requested_models: {
          builder: 'sonnet',
          oracle: 'opus',
          peer: 'opus',
          judge: 'opus'
        },
        recovery: dynamic
      };
    const gateway = require(path.join(kit, 'scripts/improve-controller-provider.cjs')).writeGateway(path.join(root, 'gateway'), ctx);
    fs.renameSync(cfg.bin, path.join(root, 'unbound-bin'));
    fs.mkdirSync(cfg.bin, {
      mode: 0o700
    });
    const controlled = {
      ...cfg,
      claude: gateway,
      recovery: dynamic,
      controller_binding: binding
    };
    w.pinnedLauncher({
      directory: cfg.bin,
      config: controlled,
      mode: 'git'
    });
    w.pinnedLauncher({
      directory: cfg.bin,
      config: controlled,
      mode: 'worker'
    });
    const pinned = [path.join(cfg.bin, 'job.json'), cfg.launcher, path.join(cfg.bin, 'git'), gateway, path.join(root, 'gateway/controller-context.json')].filter(fs.existsSync),
      before = pinned.map(file => ({
        file,
        sha256: hash(fs.readFileSync(file))
      }));
    proof.pinnedBefore = before;
    await ask(first, {
      action: 'phase',
      phase: 'begin'
    });
    await ask(first, {
      action: 'phase',
      phase: 'critique'
    });
    await ask(first, {
      action: 'orphan'
    });
    const pending = ask(first, {
      action: 'phase',
      phase: 'oracle'
    }).catch(e => ({
      interrupted: e.message
    }));
    const originalProvider = await until(() => service().status(req).runs[0].operations.find(o => o.kind === 'provider' && o.role === 'oracle' && o.state === 'reserved' && o.process_identity));
    const originalStage = service().status(req).runs[0].operations.find(o => o.id === service().status(req).runs[0].active_stage);
    proof.plannedHolder = proc.identity(first.pid);
    proof.originalProvider = originalProvider.id;
    proof.originalStage = originalStage.id;
    proof.issuedProtectedChild = await until(() => {
      try {
        const children = fs.readFileSync('/proc/' + originalProvider.process_identity.pid + '/task/' + originalProvider.process_identity.pid + '/children', 'utf8').trim().split(/\s+/).filter(Boolean).map(Number);
        return children.map(pid => proc.identity(pid)).find(Boolean);
      } catch {
        return null;
      }
    }, 10000);
    const exited = new Promise(r => first.once('exit', r));
    const sent = first.kill('SIGKILL');
    proof.actual_sigkill = {target: proof.plannedHolder, signal: 'SIGKILL', sent, at: new Date().toISOString()};
    need(sent, 'holder_signal_not_sent');
    await exited;
    proof.actual_sigkill.observed_state = proc.state(proof.plannedHolder);
    need(proof.actual_sigkill.observed_state === 'dead', 'holder_death_not_observed');
    await pending;
    next = await launchHolder(root);
    const successor = {
      principal: actor.principal,
      holder: 'native-B',
      revision: 'native-assignment-2',
      process: proc.identity(next.pid)
    };
    successors.push(successor);
    service().assign(command({
      principal: successor.principal,
      holder: successor.holder,
      assignment_revision: successor.revision
    }));
    actor = successor;
    execution = null;
    const blocked = service().resume(command({}));
    need(!blocked.allowed, 'replacement_claimed_issued_work');
    proof.preAdoption = blocked;
    const receipts = new (require(path.join(kit, 'scripts/improve-operation-receipts.cjs')).OperationReceipts)({
      root: path.join(store, 'operation-receipts'),
      registry,
      lockTool
    });
    for (const op of [originalProvider, originalStage]) {
      await until(() => fs.existsSync(path.join(receipts.root, 'receipts', op.id + '.json')) && proc.state(op.process_identity) === 'dead');
      const sealed = receipts.get(op.id);
      need(sealed.phase === 'complete' && sealed.result.exit_code === 0, 'native_original_operation_failed');
      const adopted = service().reconcile(command({
        receipt_id: op.id
      }));
      need(adopted.allowed, 'native_receipt_not_adopted');
    }
    const history = read(path.join(root, 'phases.json'));
    need(history.at(-1).phase === 'oracle' && history.at(-1).state === 'started', 'oracle_history_not_interrupted');
    history[history.length - 1] = {
      ...history.at(-1),
      state: 'complete',
      acknowledgement: 'recovered_from_authenticated_original_stage_receipt',
      receipt_id: originalStage.id,
      seal: receipts.get(originalStage.id).seal
    };
    write(path.join(root, 'phases.json'), history);
    need(claim().generation === 2, 'replacement_generation');
    fs.writeFileSync(path.join(root, 'orphan-trigger'), 'probe', {
      mode: 0o600
    });
    await until(() => fs.existsSync(path.join(root, 'orphan-result.json')), 10000);
    proof.oldOrphan = read(path.join(root, 'orphan-result.json'));
    need(proof.oldOrphan.code === 'stale_execution_generation' && proof.oldOrphan.calls === 0 && !fs.existsSync(path.join(root, 'forbidden-marker')), 'orphan_executed');
    proof.pinnedAfterReplacement = pinned.map(file => ({
      file,
      sha256: hash(fs.readFileSync(file))
    }));
    need(JSON.stringify(before) === JSON.stringify(proof.pinnedAfterReplacement), 'frozen_bytes_changed');
    need(service().status(req).runs[0].deadline_ms === initial.deadline_ms, 'deadline_extended');
    for (const phase of ['seed', 'freeze', 'baseline', 'build', 'verify', 'judge', 'evaluate', 'finalize']) await ask(next, {
      action: 'phase',
      phase
    });
    const runDir = read(path.join(root, 'active-core.json')).runDir,
      core = require(path.join(kit, 'scripts/specflow-improve.cjs')),
      status = core.status(runDir),
      events = core.events(runDir);
    need(status.terminal, 'native_core_not_terminal');
    proof.core = {
      decision: status.decision,
      ledger: core.verifyLedger(runDir),
      holdoutConsumed: events.filter(e => e.event === 'holdout_consumed').length,
      oracleAuthored: events.filter(e => e.event === 'oracle_authored').length
    };
    need(proof.core.holdoutConsumed === 1 && proof.core.oracleAuthored === 1, 'native_core_repeated');
    const applied = events.filter(e => e.event === 'decision_applied').at(-1),
      workers = new w.DockerWorker(cfg.worker);
    let bundle = null;
    if (applied.branch_retained) {
      const staged = path.join(cfg.gitArea, 'retained.bundle');
      need(w.isolatedGit(workers, cfg.gitArea, ['bundle', 'create', staged, applied.branch], {
        cwd: read(path.join(root, 'configuration.json')).repo
      }).status === 0, 'native_bundle_failed');
      bundle = path.join(runDir, 'retained.bundle');
      fs.copyFileSync(staged, bundle);
    }
    workers.close();
    const archive = new w.DurableStore({
        root: path.join(root, 'durable'),
        sourceRoot: runDir
      }),
      meta = {
        ...worker_binding,
        principal: cfg.authority.principal,
        repo_id: req.repo_id,
        profile_revision: cfg.authority.revision
      },
      receipt = w.durableCoreResult({
        store: archive,
        meta,
        runDir,
        workers,
        retainedBundle: bundle
      });
    write(path.join(root, 'terminal-ack.json'), receipt); // Actual current holder, not the unscoped coordinator, acknowledges terminal state below.
    proof.archive = receipt;
    write(path.join(root, 'finish-request.json'), {
      req,
      binding,
      archiveRoot: archive.root,
      sourceRoot: runDir
    });
    const terminal = await ask(next, {
      action: 'finish'
    });
    proof.terminal = terminal;
    proof.finalOperations = service().status(req).runs[0].operations.map(o => ({
      id: o.id,
      kind: o.kind,
      role: o.role,
      stage: o.stage,
      state: o.state,
      generation: o.generation,
      input_sha256: o.input_sha256
    }));
    need(proof.finalOperations.filter(o => o.id === originalProvider.id).length === 1 && proof.finalOperations.every(o => o.state === 'complete'), 'native_operation_accounting');
    need(terminal.deadline_ms === initial.deadline_ms, 'terminal_deadline_changed');
    proof.pinnedFinal = pinned.map(file => ({
      file,
      sha256: hash(fs.readFileSync(file))
    }));
    need(JSON.stringify(before) === JSON.stringify(proof.pinnedFinal), 'final_frozen_bytes_changed');
    proof.exitCode = 0;
  } catch (e) {
    proof.exitCode = 1;
    proof.error = {
      code: e.code || e.message
    };
    process.exitCode = 1;
  } finally {
    for (const child of [first, next]) if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
    }
    proof.finishedAt = new Date().toISOString();
    write(path.join(root, 'native-recovery-execution.json'), proof);
    console.log(JSON.stringify({
      root,
      exitCode: proof.exitCode,
      error: proof.error,
      core: proof.core
    }));
  }
}
if (require.main === module) {
  const [action, root] = process.argv.slice(2);
  if (action === '--holder') holder(root);else if (action === 'run') qualify(process.argv[4], root);else throw Error('explicit_qualification_action_required');
}
