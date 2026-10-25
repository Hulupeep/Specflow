'use strict';
// Genuine Git/profile/store processes; native provider is an explicit protocol double.
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  crypto = require('crypto'),
  { execFileSync } = require('child_process');
const profiles = require('../../scripts/improve-profiles.cjs'),
  controller = require('../../scripts/improve-controller.cjs');
const sha = (v) => crypto.createHash('sha256').update(v).digest('hex');
function fixture({ simulation = false } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'controller-test-')),
    repo = path.join(root, 'repo'),
    registry = path.join(root, 'registry'),
    store = path.join(root, 'controller');
  fs.mkdirSync(repo);
  const git = (...args) =>
    execFileSync(
      '/usr/bin/git',
      [
        '-c',
        'core.hooksPath=/dev/null',
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.test',
        '-C',
        repo,
        ...args
      ],
      {
        encoding: 'utf8',
        env: {
          PATH: '/usr/bin:/bin',
          HOME: '/nonexistent',
          GIT_CONFIG_NOSYSTEM: '1',
          GIT_CONFIG_GLOBAL: '/dev/null'
        }
      }
    ).trim();
  git('init', '--initial-branch=main', '--quiet');
  fs.writeFileSync(path.join(repo, 'test.cjs'), 'process.exit(0);');
  git('add', '.');
  git('commit', '--quiet', '-m', 'seed');
  git('remote', 'add', 'origin', 'https://github.com/example/controller-fixture.git');
  const cli = path.join(root, 'provider-double');
  fs.writeFileSync(
    cli,
    '#!' +
      process.execPath +
      '\n' +
      fs.readFileSync(
        path.join(__dirname, '../fixtures/improve-worker/controller-provider-double.cjs'),
        'utf8'
      ),
    { mode: 0o700 }
  );
  const routing = path.join(root, 'routing.json');
  fs.writeFileSync(routing, '{}');
  const evidence = path.join(root, 'host-proof.json');
  fs.writeFileSync(evidence, '{"protocolFixture":true}', { mode: 0o600 });
  const tool = (id, file) => ({
    id,
    path: fs.realpathSync(file),
    sha256: sha(fs.readFileSync(file)),
    version: execFileSync(file, ['--version'], { encoding: 'utf8' }).trim()
  });
  let profile = {
    version: 1,
    repo_id: 'fixture',
    repository: {
      path: repo,
      remote: 'https://github.com/example/controller-fixture.git',
      refs: [{ name: 'main', commit: git('rev-parse', 'HEAD') }]
    },
    mission: 'Protocol fixture only; no product improvement qualification.',
    scope: { allowed: ['test.cjs'], protected: ['.git/**'] },
    recipes: { setup: ['git', '--version'], test: ['git', '--version'], backend: null },
    toolchain: [tool('git', '/usr/bin/git'), tool('claude', cli)],
    verifier: { path: 'test.cjs', sha256: sha(fs.readFileSync(path.join(repo, 'test.cjs'))) },
    routing: {
      path: routing,
      sha256: sha('{}'),
      usage_mode: 'subscription_cli',
      providers: [{ id: 'claude', kind: 'claude-cli', tool: 'claude' }]
    },
    runtime: { adapter: 'protocol-fixture', revision: 'v1' },
    secret_references: [],
    evidence: { path: path.join(root, 'evidence') },
    publication: { allowed: false, branch_prefix: 'improve/', automatic_merge: false },
    grants: { owner: ['read', 'preflight', 'execute'], viewer: ['read', 'preflight'] }
  };
  let saved = profiles.registerProfile(registry, profile),
    principal = 'owner',
    clock = Date.parse('2026-10-25T00:30:00Z');
  const host = {
    revision: 'host1',
    operations: ['read', 'preflight', 'execute'],
    adapters: [
      {
        id: 'protocol-fixture',
        revision: 'v1',
        qualified: true,
        usage_modes: ['subscription_cli'],
        noninteractive_roles: true,
        evidence: { path: evidence, sha256: sha(fs.readFileSync(evidence)) }
      }
    ]
  };
  const config = () => ({
    root: store,
    registry,
    resolvePrincipal: () => principal,
    ownerPrincipal: 'owner',
    hostCapabilities: () => host,
    now: () => clock,
    simulation
  });
  const service = () => controller.createControllerService(config());
  const policy = (extra = {}) => ({
    version: 1,
    repo_id: 'fixture',
    profile_revision: saved.revision,
    limits: { maxCycles: 2, maxAttempts: 3, maxConsecutiveNoProgress: 2, maxWallMs: 60000 },
    schedule: { id: 'nightly', timezone: 'Europe/Dublin', local_time: '01:30' },
    ...extra
  });
  const register = (extra) => service().registerPolicy(policy(extra));
  return {
    root,
    repo,
    registry,
    store,
    cli,
    host,
    profile,
    service,
    config,
    policy,
    register,
    get revision() {
      return saved.revision;
    },
    set principal(v) {
      principal = v;
    },
    set clock(v) {
      clock = v;
    },
    get clock() {
      return clock;
    },
    update(edit) {
      edit(profile);
      saved = profiles.registerProfile(registry, profile);
      return saved;
    },
    cleanup() {
      fs.rmSync(root, { recursive: true, force: true });
    }
  };
}
module.exports = { fixture, sha };
