'use strict';
// Real filesystem/process boundaries here; Docker/browser/model execution is a
// separate mandatory live qualification gate, not a skipped Jest stub.
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  { spawnSync } = require('child_process');
const worker = require('../../scripts/improve-worker.cjs');
let root;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'worker-integration-'));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('worker-runtime-tamper generated executable rejects changed adapter dependencies before any command runs', () => {
  const dir = path.join(root, 'bin');
  fs.mkdirSync(dir, { mode: 0o700 });
  const launcher = worker.pinnedLauncher({ directory: dir, config: { marker: 'original' }, mode: 'worker' });
  fs.writeFileSync(path.join(dir, 'job.json'), JSON.stringify({ marker: 'substituted' }));
  const r = spawnSync(launcher, ['check'], { encoding: 'utf8' });
  expect(r.status).not.toBe(0);
  expect(r.stderr).toContain('runtime_input_changed');
});
test('worker-output-escape durable traversal refuses a genuine hardlink to a host file', () => {
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'decision.json'), '{"decision":"REVERT"}');
  fs.writeFileSync(path.join(root, 'host'), 'must remain private');
  fs.linkSync(path.join(root, 'host'), path.join(source, 'link'));
  const store = new worker.DurableStore({ root: path.join(root, 'durable'), sourceRoot: source });
  expect(() =>
    store.commit(
      {
        job_id: 'hardlink-job',
        operation_id: 'op',
        principal: 'owner',
        repo_id: 'fixture',
        profile_revision: 'rev',
        core_run_id: 'run'
      },
      source
    )
  ).toThrow(/artifact_hardlink/);
  expect(fs.readdirSync(path.join(root, 'durable/jobs'))).toHaveLength(0);
});
test('worker-stale-authority refuses missing current authority before a stage executable starts', () => {
  const config = path.join(root, 'job.json');
  fs.writeFileSync(
    config,
    JSON.stringify({
      authority: {
        uid: process.getuid(),
        registry: path.join(root, 'absent'),
        principal: 'owner',
        repo_id: 'absent',
        revision: 'stale',
        host: { revision: 'host', operations: ['read', 'preflight', 'execute'], adapters: [] }
      },
      launcher: '/not-executed',
      emptyCwd: root,
      bin: root
    })
  );
  expect(() => worker.startAuthorizedStage(config, 'evaluate', [])).toThrow(/preflight_blocked|profile|unavailable/);
});
test('worker-core-compatible refuses persistence of an unexecuted or nonterminal core', () => {
  const source = path.join(root, 'unexecuted');
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, 'decision.json'), '{"decision":"KEEP"}');
  expect(() =>
    worker.durableCoreResult({ store: null, meta: {}, runDir: source, workers: { containers: new Set() } })
  ).toThrow();
});
test('worker-output-escape current role data curation rejects a host-directed symlink without following it', () => {
  const source = path.join(root, 'source');
  fs.mkdirSync(source);
  fs.symlinkSync('/etc/passwd', path.join(source, 'host.txt'));
  expect(() => worker.curatedText(source)).toThrow(/role_input_link/);
});
test('worker-role-provenance preserves UI failures while omitting bulky non-UX container metadata from model presentation only', () => {
  fs.writeFileSync(path.join(root, 'execution.json'), JSON.stringify({ runtimePolicy: 'x'.repeat(300000) }));
  fs.writeFileSync(
    path.join(root, 'playwright.json'),
    JSON.stringify({ actualUIFailure: 'Saved was empty', stats: { unexpected: 2, skipped: 0 } })
  );
  expect(() => worker.curatedText(root)).toThrow(/role_input_limit/);
  const input = worker.curatedText(root, { omitRuntimeMetadata: true });
  expect(input).toContain('Saved was empty');
  expect(input).toContain('unexpected');
  expect(input).not.toContain('runtimePolicy');
  expect(fs.statSync(path.join(root, 'execution.json')).size).toBeGreaterThan(300000);
});

test('WORKER-ENTRYPOINTS imports expose callable helpers without launching IO or timers', () => {
  const role = require('../../scripts/improve-worker-role.cjs');
  const watchdog = require('../../scripts/improve-worker-watchdog.cjs');
  expect(typeof role.run).toBe('function');
  expect(typeof watchdog.start).toBe('function');
});
