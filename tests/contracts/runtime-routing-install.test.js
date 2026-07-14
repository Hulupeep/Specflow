const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  installRuntimeRouting,
  sha256,
  verifyRuntimeRouting,
} = require('../../scripts/runtime-routing.cjs');

const SOURCE_ROOT = path.join(__dirname, '..', '..');

describe('J-RUNTIME-ROUTING-INSTALL', () => {
  let targetRoot;

  beforeEach(() => {
    targetRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-runtime-routing-'));
  });

  afterEach(() => {
    fs.rmSync(targetRoot, { recursive: true, force: true });
  });

  function install(options = {}) {
    return installRuntimeRouting({ sourceRoot: SOURCE_ROOT, targetRoot, interactive: false, envRuntime: '', ...options });
  }

  function active() {
    return path.join(targetRoot, '.specflow', 'adapter-routing.yml');
  }

  function state() {
    return path.join(targetRoot, '.specflow', 'install-state.yml');
  }

  test.each([
    ['codex', 'codex-gpt56-sol-routing.yml', 'gpt-5.6-sol'],
    ['claude-code', 'claude-code-large-routing.yml', 'claude-fable-5'],
  ])('fresh %s install writes both profiles, active routing, and state', (runtime, template, model) => {
    const result = install({ runtime });

    expect(result.status).toBe('installed');
    expect(fs.readFileSync(active(), 'utf8')).toContain(model);
    for (const shipped of ['codex-gpt56-sol-routing.yml', 'claude-code-large-routing.yml']) {
      expect(fs.existsSync(path.join(targetRoot, '.specflow', 'adapter-policies', shipped))).toBe(true);
    }
    const recorded = yaml.load(fs.readFileSync(state(), 'utf8'));
    expect(recorded).toMatchObject({
      schema_version: 1,
      specflow_version: require('../../package.json').version,
      routing: { runtime, template, managed: true },
    });
    expect(recorded.routing.installed_sha256).toBe(sha256(fs.readFileSync(active())));
    expect(verifyRuntimeRouting({ targetRoot })).toMatchObject({ ok: true, runtime });
  });

  test('same-runtime rerun refreshes and runtime change switches', () => {
    install({ runtime: 'codex' });
    expect(install({ runtime: 'codex' }).status).toBe('refreshed');

    const switched = install({ runtime: 'claude-code' });
    expect(switched.status).toBe('switched');
    expect(fs.readFileSync(active(), 'utf8')).toContain('runtime: claude-code');
  });

  test('semantically unchanged legacy profile migrates despite formatting differences', () => {
    const legacy = fs.readFileSync(path.join(SOURCE_ROOT, 'templates', 'adapter-policies', 'claude-code-large-routing.yml'), 'utf8');
    fs.mkdirSync(path.dirname(active()), { recursive: true });
    fs.writeFileSync(active(), `# legacy formatting\n${legacy}`);

    expect(install({ runtime: 'codex' }).status).toBe('legacy_migrated');
    expect(fs.readFileSync(active(), 'utf8')).toContain('runtime: codex');
  });

  test('custom routing is preserved byte-for-byte until explicit replacement', () => {
    const custom = 'routing_profile:\n  id: private-routing\nroutes: {}\n';
    fs.mkdirSync(path.dirname(active()), { recursive: true });
    fs.writeFileSync(active(), custom);

    const preserved = install({ runtime: 'codex' });
    expect(preserved.status).toBe('custom_routing_preserved');
    expect(fs.readFileSync(active(), 'utf8')).toBe(custom);
    expect(yaml.load(fs.readFileSync(state(), 'utf8')).routing.managed).toBe(false);

    const replaced = install({ runtime: 'codex', replaceRouting: true });
    expect(replaced.status).toBe('refreshed');
    expect(fs.readFileSync(active(), 'utf8')).toContain('runtime: codex');
    expect(yaml.load(fs.readFileSync(state(), 'utf8')).routing.managed).toBe(true);
  });

  test('invalid custom YAML is preserved rather than treated as migratable', () => {
    const custom = 'routing_profile: [unterminated\n';
    fs.mkdirSync(path.dirname(active()), { recursive: true });
    fs.writeFileSync(active(), custom);

    expect(install({ runtime: 'codex' }).status).toBe('custom_routing_preserved');
    expect(fs.readFileSync(active(), 'utf8')).toBe(custom);
  });

  test.each([undefined, 'vscode'])('invalid non-interactive runtime %p mutates no routing files', (runtime) => {
    install({ runtime: 'codex' });
    const activeBefore = fs.readFileSync(active());
    const stateBefore = fs.readFileSync(state());

    expect(() => installRuntimeRouting({
      sourceRoot: SOURCE_ROOT,
      targetRoot,
      runtime,
      envRuntime: runtime === undefined ? '' : undefined,
      interactive: false,
    })).toThrow(/codex\|claude-code/);
    expect(fs.readFileSync(active()).equals(activeBefore)).toBe(true);
    expect(fs.readFileSync(state()).equals(stateBefore)).toBe(true);
  });

  test('CLI runtime takes precedence over environment runtime', () => {
    const result = installRuntimeRouting({
      sourceRoot: SOURCE_ROOT,
      targetRoot,
      runtime: 'codex',
      envRuntime: 'claude-code',
      interactive: false,
    });
    expect(result.runtime).toBe('codex');
  });

  test('strict verifier detects drift and provides an exact repair command', () => {
    install({ runtime: 'codex' });
    fs.appendFileSync(active(), '\n# local edit\n');

    const result = verifyRuntimeRouting({ targetRoot });
    expect(result).toMatchObject({ ok: false, status: 'stale_routing' });
    expect(result.error).toContain('npx @colmbyrne/specflow update . --runtime <codex|claude-code> --replace-routing');
  });

  test('strict verifier detects active runtime metadata mismatch', () => {
    install({ runtime: 'codex' });
    const recorded = yaml.load(fs.readFileSync(state(), 'utf8'));
    const changed = fs.readFileSync(active(), 'utf8').replace('runtime: codex', 'runtime: claude-code');
    fs.writeFileSync(active(), changed);
    recorded.routing.installed_sha256 = sha256(fs.readFileSync(active()));
    fs.writeFileSync(state(), yaml.dump(recorded));

    expect(verifyRuntimeRouting({ targetRoot })).toMatchObject({ ok: false, status: 'runtime_mismatch' });
  });
});
