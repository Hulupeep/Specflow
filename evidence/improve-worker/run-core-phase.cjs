'use strict';
// Owner-only proof driver. Delegates to the existing core/adapter; never invents
// provider events, deciding checks or decisions, and never replays a consumed set.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto');
const w = require('../../scripts/improve-worker.cjs'),
  q = require('../../scripts/improve-worker-qualify.cjs'),
  core = require('../../scripts/specflow-improve.cjs');
const root = path.resolve(process.argv[2]),
  phase = process.argv[3],
  sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f))),
  write = (f, v) => fs.writeFileSync(path.join(root, f), JSON.stringify(v, null, 2) + '\n', { mode: 0o600 });
const need = (ok, code) => {
  if (!ok) throw new w.WorkerError(code, 'qualification-proof');
};
async function seed() {
  const cfg = read('bin/job.json'),
    conf = read('configuration.json'),
    run = read('active-core.json').runDir;
  need(
    !core.events(run).some((e) => ['contract_frozen', 'implementation_started', 'holdout_consumed'].includes(e.event)),
    'seed_diagnostic_too_late'
  );
  w.currentAuthority(cfg);
  need(
    read('transport.json').code_sha256 ===
      sha(fs.readFileSync(path.join(__dirname, '../../scripts/improve-worker.cjs'))),
    'runtime_input_changed'
  );
  const worker = new w.DockerWorker(cfg.worker);
  const status = w.isolatedGit(worker, cfg.gitArea, ['status', '--porcelain', '--untracked-files=no'], {
    cwd: conf.repo
  });
  need(status.status === 0 && !status.stdout.trim(), 'seed_not_clean');
  fs.mkdirSync(path.join(run, 'dev'), { recursive: true });
  fs.copyFileSync(
    path.join(__dirname, '../../tests/e2e/journey_worker_qualification.spec.cjs'),
    path.join(run, 'dev/journey_worker_qualification.spec.cjs')
  );
  const reports = {};
  try {
    for (const [set, file] of [
      ['holdout', 'independent.spec.cjs'],
      ['dev', 'journey_worker_qualification.spec.cjs']
    ]) {
      const output = path.join(run, 'prefreeze', set);
      need(!fs.existsSync(output), 'seed_already_executed');
      fs.mkdirSync(output, { recursive: true, mode: 0o700 });
      const result = w.runBrowserCheck(worker, {
        source: conf.repo,
        oracle: path.join(run, set),
        fixture: cfg.fixture,
        output,
        canaries: cfg.canaries,
        checkFile: file
      });
      const pw = JSON.parse(fs.readFileSync(path.join(output, 'playwright.json')));
      let specs = [];
      function walk(s) {
        specs.push(...(s.specs || []));
        for (const c of s.suites || []) walk(c);
      }
      walk(pw);
      const errors = specs.map((s) =>
        s.tests
          .flatMap((t) => t.results.flatMap((r) => r.errors || []))
          .map((e) => e.message || '')
          .join('\n')
          .replace(/\x1b\[[0-9;]*m/g, '')
      );
      const correctReason = errors.length === 2 && errors.every((s) => /Saved/.test(s) && /Received[^]*?""/.test(s));
      need(
        result.status === 1 &&
          pw.stats.unexpected === 2 &&
          pw.stats.expected === 0 &&
          pw.stats.skipped === 0 &&
          correctReason &&
          result.state.value !== 'seed',
        'seed_wrong_failure'
      );
      reports[set] = {
        status: 'expected-seed-failure',
        passed: pw.stats.expected,
        failed: pw.stats.unexpected,
        skipped: pw.stats.skipped,
        reason: 'Expected Saved; actual empty status after persisted owner write',
        persistedValue: result.state.value,
        output: path.relative(run, output)
      };
    }
    write('seed-diagnostics.json', {
      status: 'passed',
      interpretation:
        'Both independently authored and mapped practice seed cases actually fail for the declared UI defect, not setup failure. This is prefreeze diagnostic execution, not a candidate holdout.',
      reports
    });
    return reports;
  } finally {
    worker.close();
  }
}
async function persist() {
  const cfg = read('bin/job.json'),
    conf = read('configuration.json'),
    run = read('active-core.json').runDir;
  need(core.status(run).terminal, 'core_not_terminal');
  const privateExtra = path.join(run, 'qualified-provenance');
  fs.mkdirSync(privateExtra, { recursive: true, mode: 0o700 });
  for (const file of [
    'transport.json',
    'boundary-qualification.json',
    'configuration.json',
    'critique-resolution.json',
    'seed-diagnostics.json'
  ])
    if (fs.existsSync(path.join(root, file))) fs.copyFileSync(path.join(root, file), path.join(privateExtra, file));
  fs.cpSync(path.join(root, 'roles'), path.join(privateExtra, 'native-roles'), { recursive: true });
  fs.cpSync(path.join(root, 'bin'), path.join(privateExtra, 'pinned-launcher'), { recursive: true });
  const worker = new w.DockerWorker(cfg.worker),
    applied = core
      .events(run)
      .filter((e) => e.event === 'decision_applied')
      .at(-1);
  let bundle = null;
  try {
    if (applied.branch_retained) {
      const staged = path.join(cfg.gitArea, 'retained.bundle');
      const r = w.isolatedGit(worker, cfg.gitArea, ['bundle', 'create', staged, applied.branch], { cwd: conf.repo });
      need(r.status === 0, 'retained_bundle_failed');
      bundle = path.join(run, 'retained.bundle');
      fs.copyFileSync(staged, bundle);
    }
    worker.close();
    const meta = {
        job_id: 'qualification-' + sha(root).slice(0, 24),
        operation_id: 'worker-core-once',
        principal: cfg.authority.principal,
        repo_id: cfg.authority.repo_id,
        profile_revision: conf.profile_revision,
        core_run_id: 'worker-core-once'
      },
      storeRoot = path.join(root, 'durable');
    const healthy = new w.DurableStore({ root: storeRoot, sourceRoot: run });
    const blobs = path.join(storeRoot, 'blobs');
    fs.chmodSync(blobs, 0o500);
    let denied;
    try {
      w.durableCoreResult({ store: healthy, meta, runDir: run, workers: worker, retainedBundle: bundle });
    } catch (e) {
      denied = e.code;
    } finally {
      fs.chmodSync(blobs, 0o700);
    }
    need(
      denied === 'artifact_persistence_failed' && !fs.existsSync(path.join(root, 'terminal-ack.json')),
      'persistence_failure_was_acknowledged'
    );
    write('actual-persistence-failure.json', {
      code: denied,
      realEACCES: true,
      terminalAcknowledgement: false,
      coreDecisionUnchanged: core.status(run).decision
    });
    const broken = new w.DurableStore({
      root: storeRoot,
      sourceRoot: run,
      fault: (point) => {
        if (point === 'after_commit_before_ack')
          throw Error('injected lost acknowledgement after real core archive commit');
      }
    });
    let lost;
    try {
      w.durableCoreResult({ store: broken, meta, runDir: run, workers: worker, retainedBundle: bundle });
    } catch (e) {
      lost = e.code;
    }
    need(lost === 'commit_unconfirmed' && !fs.existsSync(path.join(root, 'terminal-ack.json')), 'lost_ack_wrong_state');
    write('actual-lost-ack.json', {
      code: lost,
      terminalAcknowledgement: false,
      commitPresent: fs.existsSync(healthy.location(meta.job_id)),
      coreDecisionUnchanged: core.status(run).decision
    });
    const before = core.events(run);
    write('core-event-summary.json', {
      decisionEvents: before.filter((e) => e.event === 'decision_made').length,
      holdoutConsumed: before.filter((e) => e.event === 'holdout_consumed').length,
      ledger: core.verifyLedger(run),
      decision: core.status(run).decision
    });
    const result = await q.persist(root);
    const retry = healthy.commit(meta, run);
    need(retry.idempotent && retry.manifest_sha256 === result.manifest_sha256, 'idempotent_retry_mismatch');
    write('actual-lost-ack-retry.json', {
      ...retry,
      noCoreSourcePresent: !fs.existsSync(run),
      noGitAreaPresent: !fs.existsSync(cfg.gitArea),
      noNewCoreOrHoldoutInvocation: true
    });
    return {
      result,
      retry: read('actual-lost-ack-retry.json'),
      fault: read('actual-persistence-failure.json'),
      lostAck: read('actual-lost-ack.json'),
      counts: read('core-event-summary.json')
    };
  } finally {
    worker.close();
  }
}
(async () => {
  let result;
  if (phase === 'seed') result = await seed();
  else if (phase === 'persist') result = await persist();
  else result = await q.phase(root, phase);
  console.log(JSON.stringify({ phase, actualExecution: true, result }));
})().catch((e) => {
  console.error(JSON.stringify({ phase, status: 'failed', code: e.code || e.message, stage: e.stage || 'proof' }));
  process.exitCode = 1;
});
