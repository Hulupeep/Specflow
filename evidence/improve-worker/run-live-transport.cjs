'use strict';
// The captured command REALLY runs Docker/browser/package/Git/subscription probes.
// Only redacted fixture evidence is exported to the native review's excluded dir.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  os = require('os');
const q = require('../../scripts/improve-worker-qualify.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  const ownerFile = process.argv[2],
    destination = path.resolve(process.argv[3]);
  if (!destination.startsWith(path.join(process.cwd(), '.specflow/duo/')))
    throw Error('excluded_review_output_required');
  const o = JSON.parse(fs.readFileSync(ownerFile));
  const root = fs.mkdtempSync(path.join(o.state_root, 'qualification-'));
  fs.chmodSync(root, 0o700);
  fs.writeFileSync(path.join(o.state_root, 'current-root.json'), JSON.stringify({ root }), { mode: 0o600 });
  await q.transport(o, root);
  fs.mkdirSync(destination, { recursive: true, mode: 0o700 });
  const token = fs.readFileSync(path.join(root, 'fixture/token'), 'utf8');
  function clean(value) {
    if (typeof value === 'string')
      return value.split(token).join('[REDACTED_FIXTURE]').split(root).join('$JOB').split(os.homedir()).join('$HOME');
    if (Array.isArray(value)) return value.map(clean);
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v)]));
    return value;
  }
  const records = [
    'transport.json',
    'boundary-qualification.json',
    'transport-output/boundary.json',
    'transport-output/playwright.json',
    'transport-output/execution.json'
  ];
  for (const file of records) {
    const original = fs.readFileSync(path.join(root, file));
    const dest = path.join(destination, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true, mode: 0o700 });
    fs.writeFileSync(dest, JSON.stringify(clean(JSON.parse(original)), null, 2) + '\n', { mode: 0o600 });
  }
  const runtime = [
    'improve-worker.cjs',
    'improve-worker-store.py',
    'improve-worker-role.cjs',
    'improve-worker-watchdog.cjs',
    'improve-worker-boundary.cjs',
    'improve-worker-qualify.cjs'
  ].map((f) => ({ path: 'scripts/' + f, sha256: sha(fs.readFileSync(path.join(__dirname, '../../scripts', f))) }));
  fs.writeFileSync(path.join(destination, 'runtime-files.json'), JSON.stringify(runtime, null, 2) + '\n', {
    mode: 0o600
  });
  const t = JSON.parse(fs.readFileSync(path.join(root, 'transport.json')));
  console.log(
    JSON.stringify({
      status: 'passed',
      actualExecution: true,
      root,
      rawEvidence: path.relative(process.cwd(), destination),
      journeys: { passed: t.browser.passed, failed: t.browser.failed, skipped: t.browser.skipped },
      trustedControls:{hostPositive:t.boundaryQualification.hostPositive,openedPathPositive:t.boundaryQualification.openedPathPositive,jobBPositive:t.boundaryQualification.jobBPositive,appDenied:t.boundaryQualification.appDenied,checkerDenied:t.boundaryQualification.checkerDenied,unconfinedRejected:t.boundaryQualification.unconfinedRejected,processLoss:t.boundaryQualification.processLoss},
      models: t.roles.map((r) => ({
        model: r.model,
        session: r.session,
        io_tool_calls: r.io_tool_calls,
        raw_sha256: r.raw_sha256
      })),
      usage_mode: t.usage_mode,
      actual_charges: 'unmeasured',
      runtime_files: runtime
    })
  );
})().catch((e) => {
  console.error(JSON.stringify({ status: 'failed', code: e.code || e.message }));
  process.exitCode = 1;
});
