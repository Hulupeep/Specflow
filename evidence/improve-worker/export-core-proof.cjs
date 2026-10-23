'use strict';
// Historical archive verification/export only. No Docker, provider, Git product
// operation, evaluator, or Playwright invocation; a consumed holdout never replays.
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  crypto = require('crypto');
const w = require('../../scripts/improve-worker.cjs'),
  q = require('../../scripts/improve-worker-qualify.cjs'),
  core = require('../../scripts/specflow-improve.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
const root = path.resolve(process.argv[2]),
  dest = path.resolve(process.argv[3]);
const need = (ok, code) => {
  if (!ok) throw Error(code);
};
try {
  need(dest.startsWith(path.join(process.cwd(), '.specflow/duo/')), 'excluded_review_output_required');
  const recovered = q.recover(root),
    ack = JSON.parse(fs.readFileSync(path.join(root, 'terminal-ack.json'))),
    retry = JSON.parse(fs.readFileSync(path.join(root, 'actual-lost-ack-retry.json'))),
    cfg = JSON.parse(fs.readFileSync(path.join(root, 'bin/job.json'))),
    originalRun = path.join(root, 'core/worker-core-once'),
    store = path.join(root, 'durable'),
    token = fs.readFileSync(path.join(root, 'fixture/token'), 'utf8');
  need(
    ack.manifest_sha256 === recovered.manifest_sha256 &&
      retry.manifest_sha256 === ack.manifest_sha256 &&
      retry.idempotent,
    'historical_recovery_mismatch'
  );
  need(!fs.existsSync(originalRun) && !fs.existsSync(cfg.gitArea), 'ephemeral_working_files_not_removed');
  const byPath = new Map(recovered.files.map((f) => [f.path, f]));
  const blob = (rel) => {
    const item = byPath.get(rel);
    need(item, 'required_artifact_missing:' + rel);
    const b = fs.readFileSync(path.join(store, 'blobs', item.sha256));
    need(b.length === item.size && sha(b) === item.sha256, 'artifact_hash_mismatch');
    return b;
  };
  const checkDir = fs.mkdtempSync(path.join(root, 'archive-check-'));
  fs.chmodSync(checkDir, 0o700);
  fs.writeFileSync(path.join(checkDir, 'ledger.jsonl'), blob('ledger.jsonl'), { mode: 0o600 });
  const ledger = core.verifyLedger(checkDir),
    events = core.events(checkDir);
  need(ledger.ok, 'core_ledger_invalid');
  need(
    events.filter((e) => e.event === 'holdout_consumed').length === 1 &&
      events.filter((e) => e.event === 'decision_made').length === 1 &&
      events.filter((e) => e.event === 'decision_applied').length === 1,
    'core_not_once_only'
  );
  const decision = JSON.parse(blob('decision.json')),
    made = events.find((e) => e.event === 'decision_made');
  need(
    made.decision_sha256 === sha(blob('decision.json')) && decision.decision === recovered.decision,
    'decision_binding_mismatch'
  );
  const frozen = events.find((e) => e.event === 'contract_frozen');
  need(
    frozen && frozen.contract_sha256 === sha(blob(path.relative(originalRun, frozen.path))),
    'contract_binding_mismatch'
  );
  for (const [file, digest] of Object.entries(frozen.artifact_sha256 || {}))
    need(sha(blob(file)) === digest, 'oracle_artifact_binding_mismatch');
  const stats = [];
  for (const item of recovered.files.filter(
    (f) => /playwright\.json$/.test(f.path) && /^verification\//.test(f.path)
  )) {
    const report = JSON.parse(blob(item.path));
    w.validateJourneyReport(report);
    stats.push({ path: item.path, stats: report.stats });
  }
  const after = stats.filter((s) => s.path.startsWith('verification/after/'));
  need(
    after.length === 1 &&
      after[0].stats.expected === 2 &&
      after[0].stats.unexpected === 0 &&
      after[0].stats.skipped === 0,
    'actual_after_journey_missing'
  );
  const roles = [];
  for (const item of recovered.files.filter((f) =>
    /^qualified-provenance\/native-roles\/.*\.request\.json$/.test(f.path)
  )) {
    const req = JSON.parse(blob(item.path)),
      schema = JSON.parse(req.args[req.args.indexOf('--json-schema') + 1]),
      binding = Object.fromEntries(Object.entries(schema.properties._binding.properties).map(([k, v]) => [k, v.const])),
      session = req.args[req.args.indexOf('--session-id') + 1],
      role = binding.role,
      expectedModel = role === 'builder' ? 'claude-sonnet-5-5' : 'claude-opus-5-5',
      raw = blob('qualified-provenance/native-roles/' + session + '.jsonl').toString(),
      validated = w.validateRoleResponse(raw, { ...binding, session, model: expectedModel }),
      message = JSON.parse(req.input).message,
      images = message.content.filter((c) => c.type === 'image');
    roles.push({
      role,
      ...validated.provenance,
      image_count: images.length,
      image_sha256: images.map((i) => sha(Buffer.from(i.source.data, 'base64')))
    });
  }
  const judge = roles.filter((r) => r.role === 'judge').at(-1);
  need(
    judge && judge.image_count > 0 && roles.some((r) => r.role === 'builder' && r.model !== judge.model),
    'actual_role_independence_missing'
  );
  const imageDigests = recovered.files
    .filter((f) => /^verification\/(after|baseline)\//.test(f.path) && f.path.endsWith('.png'))
    .map((f) => f.sha256);
  need(
    imageDigests.every((s) => judge.image_sha256.includes(s)),
    'judge_missed_required_image'
  );
  if (decision.decision === 'KEEP') need(byPath.has('retained.bundle'), 'retained_commit_bundle_missing');
  fs.mkdirSync(dest, { recursive: true, mode: 0o700 });
  const exports = [];
  const clean = (b) =>
    b.toString().split(token).join('[REDACTED_FIXTURE]').split(root).join('$JOB').split(os.homedir()).join('$HOME');
  function out(name, bytes, originalSha = null) {
    const file = path.join(dest, name);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, bytes, { mode: 0o600 });
    exports.push({
      path: name,
      original_sha256: originalSha,
      exported_sha256: sha(bytes),
      redacted: originalSha !== null && originalSha !== sha(bytes)
    });
  }
  for (const file of [
    'run.json',
    'decision.json',
    'report.md',
    'workspace.patch',
    'ledger.jsonl',
    path.relative(originalRun, frozen.path)
  ])
    out(file, clean(blob(file)), byPath.get(file).sha256);
  for (const item of recovered.files.filter(
    (f) =>
      /^verification\//.test(f.path) && /playwright\.json$|execution\.json$|boundary\.json$|\.out\.txt$/.test(f.path)
  ))
    out(item.path, clean(blob(item.path)), item.sha256);
  for (const file of [
    'terminal-ack.json',
    'recovered.json',
    'actual-persistence-failure.json',
    'actual-lost-ack.json',
    'actual-lost-ack-retry.json',
    'core-event-summary.json',
    'seed-diagnostics.json',
    'critique-resolution.json'
  ]) {
    const b = fs.readFileSync(path.join(root, file));
    out(file, clean(b), sha(b));
  }
  const selectedRuntime = [
    'improve-worker.cjs',
    'improve-worker-store.py',
    'improve-worker-role.cjs',
    'improve-worker-watchdog.cjs',
    'improve-worker-boundary.cjs',
    'improve-worker-qualify.cjs'
  ].map((f) => ({ path: 'scripts/' + f, sha256: sha(fs.readFileSync(path.join(__dirname, '../../scripts', f))) }));
  const originalLauncher = blob('qualified-provenance/pinned-launcher/worker-command').toString();
  const inputMarker = 'for(const x of ';
  const inputStart = originalLauncher.indexOf(inputMarker) + inputMarker.length;
  const inputEnd = originalLauncher.indexOf("){if(fs.realpathSync", inputStart);
  need(inputStart >= inputMarker.length && inputEnd > inputStart, 'original_launcher_inputs_missing');
  const originalInputs = JSON.parse(originalLauncher.slice(inputStart, inputEnd));
  for (const item of selectedRuntime) {
    const pinned = originalInputs.find((i) => i.file === path.join(process.cwd(), item.path));
    need(pinned && pinned.sha256 === item.sha256, 'executed_runtime_changed:' + item.path);
  }
  const profileInput = originalInputs.find((i) => i.file === path.join(process.cwd(), 'scripts/improve-profiles.cjs'));
  need(profileInput, 'original_profile_input_missing');
  const postTerminalProfileCorrection = {
    original_sha256: profileInput.sha256,
    current_sha256: sha(fs.readFileSync(path.join(__dirname, '../../scripts/improve-profiles.cjs'))),
    scope: 'Authorised historical-read metadata correction after terminal cycle; no worker, model or holdout replay.'
  };
  const transport = JSON.parse(fs.readFileSync(path.join(root, 'transport.json')));
  need(
    transport.code_sha256 === selectedRuntime.find((f) => f.path.endsWith('/improve-worker.cjs')).sha256,
    'executed_adapter_changed'
  );
  const summary = {
    version: 1,
    scope:
      'Historical actual once-only Node HTTP fixture core cycle; no HeyStax product gain or arbitrary-repository qualification claim.',
    decision: decision.decision,
    reasons: decision.reasons,
    ledger: { ok: ledger.ok, entries: ledger.entries, head_sha256: ledger.head_sha256 },
    events: { holdout_consumed: 1, decision_made: 1, decision_applied: 1 },
    actualJourneys: stats,
    roles,
    judgeAllRecordedFramesPresent: true,
    manifest_sha256: recovered.manifest_sha256,
    artifactCount: recovered.files.length,
    artifactBytes: recovered.files.reduce((n, f) => n + f.size, 0),
    workerGitAndCoreWorkingFilesRemoved: true,
    lostAcknowledgementIdempotent: true,
    realPersistenceFailure: JSON.parse(fs.readFileSync(path.join(root, 'actual-persistence-failure.json'))),
    postCommitLostAck: JSON.parse(fs.readFileSync(path.join(root, 'actual-lost-ack.json'))),
    retainedBundle: byPath.has('retained.bundle')
      ? { sha256: byPath.get('retained.bundle').sha256, size: byPath.get('retained.bundle').size }
      : null,
    usage_mode: 'subscription_cli',
    actual_charges: 'unmeasured',
    cli_estimates_scope:
      'Partial subscription CLI telemetry for final-root roles only; excludes prior unfrozen probes and Duo reviews; not an invoice.',
    cli_estimate_usd: roles.reduce((n, r) => n + (r.cli_estimate_usd || 0), 0),
    unqualified: [
      'Next/Supabase worker recipe',
      'OpenAI managed/API-billed route',
      'general MCP/service/plugin/scheduler'
    ],
    runtime_files: selectedRuntime,
    executedRuntimeMatchesArchivedLauncher: true,
    postTerminalProfileCorrection,
    exportNote:
      'Root/home/fixture redactions change exported hashes. The ORIGINAL private archive and ledger were verified before export; redacted JSONL is not claimed to preserve original chained byte hashes.',
    exports
  };
  out('summary.json', JSON.stringify(summary, null, 2) + '\n');
  console.log(
    JSON.stringify({
      status: 'passed',
      historicalArchiveOnly: true,
      noProviderOrWorkerOrHoldoutReplay: true,
      decision: summary.decision,
      holdoutConsumed: 1,
      afterJourneys: after[0].stats,
      imagesPresented: judge.image_count,
      artifactCount: summary.artifactCount,
      manifest: summary.manifest_sha256,
      output: path.relative(process.cwd(), dest)
    })
  );
  fs.rmSync(checkDir, { recursive: true });
} catch (e) {
  console.error(JSON.stringify({ status: 'failed', code: e.code || e.message }));
  process.exitCode = 1;
}
