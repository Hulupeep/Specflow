const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const yaml = require('js-yaml');

const ROOT = path.resolve(__dirname, '..', '..');
const INSTALLER = path.join(ROOT, 'install-hooks.sh');
const CLI = path.join(ROOT, 'bin', 'specflow.js');
const ROUTING = path.join(ROOT, 'scripts', 'runtime-routing.cjs');

describe('J-ROUTING-STRICT-TO-FIRST-STAGE', () => {
  let project;
  let sentinel;

  beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-routing-ready-'));
    sentinel = path.join(project, 'provider-invoked');
    const bin = path.join(project, 'bin');
    fs.mkdirSync(bin);
    for (const provider of ['codex', 'claude']) {
      const command = path.join(bin, provider);
      fs.writeFileSync(command, `#!/bin/sh\ntouch "${sentinel}"\nexit 99\n`);
      fs.chmodSync(command, 0o755);
    }
  });

  afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

  function environment() {
    return {
      ...process.env,
      SPECFLOW_RUNTIME: 'codex',
      PATH: `${path.join(project, 'bin')}:${process.env.PATH}`,
    };
  }

  function install() {
    const result = spawnSync('bash', [INSTALLER, project], {
      encoding: 'utf8',
      env: environment(),
      timeout: 20000,
    });
    expect(result.status).toBe(0);
  }

  function verify() {
    return spawnSync('node', [ROUTING, 'verify', '--target', project, '--source', ROOT], {
      encoding: 'utf8',
      env: environment(),
    });
  }

  test('strict-green Codex install reaches explicit model confirmation without invoking a provider', () => {
    install();
    const strict = verify();
    expect(strict.status).toBe(0);
    expect(JSON.parse(strict.stdout)).toMatchObject({ ok: true, runtime: 'codex', provider_invoked: false });

    const run = spawnSync('node', [CLI, 'run', 'spec-build', '--slug', 'first-run', '--goal', 'Create ready tickets', '--input', 'issue-121'], {
      cwd: project,
      encoding: 'utf8',
      env: environment(),
      timeout: 10000,
    });
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout)).toMatchObject({ status: 'model_confirmation_required' });
    expect(fs.existsSync(sentinel)).toBe(false);
  });

  test('missing routing returns the canonical structured diagnostic without invoking a provider', () => {
    install();
    fs.rmSync(path.join(project, '.specflow', 'adapter-routing.yml'));

    const run = spawnSync('node', [CLI, 'run', 'spec-build', '--slug', 'missing-route', '--goal', 'Create ready tickets', '--input', 'issue-121'], {
      cwd: project,
      encoding: 'utf8',
      env: environment(),
    });
    expect(run.status).toBe(2);
    expect(JSON.parse(run.stdout)).toMatchObject({
      code: 'routing_required',
      status: 'missing_routing',
      runtime: 'codex',
      recovery_command: 'npx @colmbyrne/specflow update . --runtime codex',
      provider_invoked: false,
    });
    expect(fs.existsSync(sentinel)).toBe(false);
  });

  test('strict readiness rejects an outdated installed selector', () => {
    install();
    fs.appendFileSync(path.join(project, '.codex', 'skills', 'specflow-loop-selector', 'SKILL.md'), '\n# stale fixture\n');

    const strict = verify();
    expect(strict.status).toBe(1);
    expect(JSON.parse(strict.stdout)).toMatchObject({
      code: 'routing_required',
      status: 'outdated_selector_skill',
      runtime: 'codex',
      recovery_command: 'npx @colmbyrne/specflow update . --runtime codex',
    });
    expect(fs.existsSync(sentinel)).toBe(false);
  });

  test('strict readiness names the installed Codex runtime when active metadata claims Claude', () => {
    install();
    const active = path.join(project, '.specflow', 'adapter-routing.yml');
    const statePath = path.join(project, '.specflow', 'install-state.yml');
    fs.writeFileSync(active, fs.readFileSync(active, 'utf8').replace('runtime: codex', 'runtime: claude-code'));
    const state = yaml.load(fs.readFileSync(statePath, 'utf8'));
    const crypto = require('crypto');
    state.routing.installed_sha256 = crypto.createHash('sha256').update(fs.readFileSync(active)).digest('hex');
    fs.writeFileSync(statePath, yaml.dump(state));

    const strict = verify();
    expect(strict.status).toBe(1);
    expect(JSON.parse(strict.stdout)).toMatchObject({
      code: 'routing_required',
      status: 'runtime_mismatch',
      runtime: 'codex',
      recovery_command: 'npx @colmbyrne/specflow update . --runtime codex',
    });
    expect(fs.existsSync(sentinel)).toBe(false);
  });
});
