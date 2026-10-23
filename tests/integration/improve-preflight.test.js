'use strict';
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  crypto = require('crypto'),
  { execFileSync, spawnSync } = require('child_process');
const profiles = require('../../scripts/improve-profiles.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let root, registry, a, b, principal, host, clock, service;
const git = (repo, ...args) =>
  execFileSync(
    '/usr/bin/git',
    [
      '-c',
      'core.hooksPath=/dev/null',
      '-c',
      'core.fsmonitor=false',
      '-c',
      'user.name=Fixture Owner',
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
function tool(id, exe) {
  exe = fs.realpathSync(exe);
  return {
    id,
    path: exe,
    sha256: sha(fs.readFileSync(exe)),
    version: execFileSync(exe, ['--version'], { encoding: 'utf8' }).trim()
  };
}
function makeRepo(name, kind) {
  const repo = path.join(root, name);
  fs.mkdirSync(repo);
  git(repo, 'init', '--initial-branch=main', '--quiet');
  fs.mkdirSync(path.join(repo, 'src'));
  const t = kind === 'node' ? tool('node', process.execPath) : tool('python', '/usr/bin/python3');
  const script =
    kind === 'node'
      ? "require('fs').writeFileSync('RECIPE_WAS_EXECUTED','bad');"
      : "open('RECIPE_WAS_EXECUTED','w').write('bad')";
  fs.writeFileSync(
    path.join(repo, kind === 'node' ? 'package.json' : 'pyproject.toml'),
    kind === 'node' ? ' {"name":"fixture-alpha","private":true}' : '[project]\nname="fixture-beta"\nversion="0.0.0"\n'
  );
  fs.writeFileSync(path.join(repo, 'src', kind === 'node' ? 'test.cjs' : 'test.py'), script);
  fs.writeFileSync(path.join(repo, 'routing.json'), '{}');
  git(repo, 'add', '.');
  git(repo, 'commit', '--quiet', '-m', 'seed fixture');
  git(repo, 'remote', 'add', 'origin', 'https://github.com/example/' + name + '.git');
  return {
    version: 1,
    repo_id: name,
    repository: {
      path: repo,
      remote: 'https://github.com/example/' + name + '.git',
      refs: [{ name: 'main', commit: git(repo, 'rev-parse', 'HEAD') }]
    },
    mission: 'Improve only the existing ' + name + ' workflow.',
    scope: {
      allowed: ['src/**'],
      protected: ['.git/**', '.env*', 'AGENTS.md']
    },
    recipes: {
      setup: [t.id, 'src/' + (kind === 'node' ? 'test.cjs' : 'test.py')],
      test: [t.id, 'src/' + (kind === 'node' ? 'test.cjs' : 'test.py')],
      backend: null
    },
    toolchain: [t, tool('git', '/usr/bin/git')],
    verifier: { path: 'src/' + (kind === 'node' ? 'test.cjs' : 'test.py'), sha256: sha(script) },
    routing: {
      path: path.join(repo, 'routing.json'),
      sha256: sha('{}'),
      usage_mode: 'subscription_cli',
      providers: []
    },
    runtime: { adapter: 'local-bwrap', revision: 'unqualified' },
    secret_references: [],
    evidence: { path: path.join(root, 'private-evidence-' + name) },
    publication: {
      allowed: false,
      branch_prefix: 'improve/',
      automatic_merge: false
    },
    grants:
      name === 'alpha'
        ? {
            alice: ['read', 'preflight', 'execute', 'publish'],
            viewer: ['read', 'preflight']
          }
        : { bob: ['read', 'preflight', 'execute'] }
  };
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'profiles-integration-'));
  registry = path.join(root, 'registry');
  a = makeRepo('alpha', 'node');
  b = makeRepo('beta', 'python');
  profiles.registerProfile(registry, a);
  profiles.registerProfile(registry, b);
  principal = 'alice';
  clock = 100000;
  host = {
    revision: 'observed-host-unqualified',
    operations: ['read', 'preflight', 'execute', 'publish'],
    adapters: []
  };
  service = profiles.createProfileService({
    registry,
    resolvePrincipal: () => principal,
    hostCapabilities: () => host,
    environment: {
      PATH: '/usr/bin:/bin',
      HOME: '/nonexistent',
      TEST_FIXTURE: 'fixture-canary-never-output'
    },
    now: () => clock
  });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('J-PROFILES-TWO-REPOS actual Node/Python Git profiles and scoped reports survive independent failures', () => {
  const before = git(b.repository.path, 'status', '--porcelain');
  a.toolchain[0].sha256 = '0'.repeat(64);
  profiles.registerProfile(registry, a);
  const reportA = service.preflight({ repo_id: 'alpha' });
  expect(reportA.ready).toBe(false);
  expect(reportA.findings).toContainEqual(
    expect.objectContaining({
      code: 'toolchain_unavailable',
      check: 'tool:node',
      retryable: true,
      next_action: expect.stringContaining('owner-pinned')
    })
  );
  principal = 'bob';
  const reportB = service.preflight({ repo_id: 'beta' });
  expect(
    reportB.findings
      .filter((x) => x.check === 'repository' || x.check.startsWith('tool:'))
      .every((x) => x.status === 'passed')
  ).toBe(true);
  expect(reportB.findings).toContainEqual(expect.objectContaining({ code: 'worker_unavailable' }));
  expect(reportB.ready).toBe(false);
  expect(git(b.repository.path, 'status', '--porcelain')).toBe(before);
  expect(profiles.readProfile(registry, 'beta').profile).toEqual(b);
  expect(service.history({ repo_id: 'beta' }).reports.map((r) => r.report_id)).toEqual([reportB.report_id]);
  expect(JSON.stringify(service.history({ repo_id: 'beta' }))).not.toContain(reportA.report_id);
  expect(service.inspect({ repo_id: 'alpha' }).available).toBe(false);
  expect(fs.existsSync(path.join(a.repository.path, 'RECIPE_WAS_EXECUTED'))).toBe(false);
  expect(fs.existsSync(path.join(b.repository.path, 'RECIPE_WAS_EXECUTED'))).toBe(false);
});
test('J-PROFILES-READONLY viewer cannot execute; another authorised viewer cannot read the owner report', () => {
  const owner = service.preflight({ repo_id: 'alpha' });
  principal = 'viewer';
  expect(service.history({ repo_id: 'alpha' }).reports).toEqual([]);
  expect(service.authorize(owner.lease, 'execute').findings[0].code).toBe('invalid_lease');
  const own = service.preflight({ repo_id: 'alpha' });
  let started = false;
  expect(service.withAuthorized(own.lease, 'execute', () => (started = true))).toMatchObject({
    allowed: false,
    findings: [expect.objectContaining({ code: 'permission_revoked' })]
  });
  expect(started).toBe(false);
  expect(service.history({ repo_id: 'alpha' }).reports.map((x) => x.report_id)).toEqual([own.report_id]);
});
test('J-PROFILES-REVOKE new execute/publish denied after revocation while separately authorised history remains', () => {
  const before = service.preflight({ repo_id: 'alpha' });
  a.grants.alice = ['read', 'preflight'];
  profiles.registerProfile(registry, a);
  for (const op of ['execute', 'publish'])
    expect(service.authorize(before.lease, op).findings[0].code).toBe('permission_revoked');
  expect(service.history({ repo_id: 'alpha' }).reports[0].report_id).toBe(before.report_id);
});
test.each(['profile', 'routing', 'ref', 'host'])('J-PROFILES-STALE rejects changed %s after preflight', (kind) => {
  const before = service.preflight({ repo_id: 'alpha' });
  if (kind === 'profile') {
    a.mission += ' Revised.';
    profiles.registerProfile(registry, a);
  }
  if (kind === 'routing') fs.writeFileSync(a.routing.path, '{"changed":true}');
  if (kind === 'ref') {
    fs.writeFileSync(path.join(a.repository.path, 'other.txt'), 'new');
    git(a.repository.path, 'add', '.');
    git(a.repository.path, 'commit', '--quiet', '-m', 'changed ref');
  }
  if (kind === 'host') host = { ...host, revision: 'new-host-revision' };
  expect(service.authorize(before.lease, 'execute').findings[0].code).toBe('stale_profile');
});
test('J-PROFILES-FORGED modified, expired and other-caller leases never start work', () => {
  const before = service.preflight({ repo_id: 'alpha' }),
    [payload, mac] = before.lease.split('.'),
    changed = JSON.parse(Buffer.from(payload, 'base64url'));
  changed.repo_id = 'beta';
  expect(
    service.authorize(Buffer.from(JSON.stringify(changed)).toString('base64url') + '.' + mac, 'execute').findings[0]
      .code
  ).toBe('invalid_lease');
  clock += 300001;
  expect(service.authorize(before.lease, 'execute').findings[0].code).toBe('invalid_lease');
});
test('J-PROFILES-NO-FALLBACK unqualified worker, unknown usage and unavailable auth have exact remedies', () => {
  a.routing.usage_mode = 'unknown';
  a.routing.providers = [{ id: 'reviewer', kind: 'claude-cli', tool: 'node' }];
  profiles.registerProfile(registry, a);
  const r = service.preflight({ repo_id: 'alpha' });
  for (const code of [
    'usage_mode_unknown',
    'provider_auth_unavailable',
    'worker_unavailable',
    'noninteractive_unverified'
  ])
    expect(r.findings).toContainEqual(
      expect.objectContaining({
        code,
        next_action: expect.any(String),
        observed: expect.any(String),
        retryable: expect.any(Boolean)
      })
    );
  expect(service.authorize(r.lease, 'execute').allowed).toBe(false);
  expect(r.ready).toBe(false);
  expect(fs.existsSync(path.join(a.repository.path, 'RECIPE_WAS_EXECUTED'))).toBe(false);
});
test('J-PROFILES-SECRETS presence-only fixture references never return their values', () => {
  a.secret_references = [
    {
      id: 'seed',
      kind: 'environment',
      name: 'TEST_FIXTURE',
      purpose: 'fixture'
    }
  ];
  profiles.registerProfile(registry, a);
  const r = service.preflight({ repo_id: 'alpha' });
  expect(r.findings.find((x) => x.check === 'fixture:seed').status).toBe('passed');
  expect(JSON.stringify(r)).not.toContain('fixture-canary-never-output');
  expect(JSON.stringify(service.history({ repo_id: 'alpha' }))).not.toContain('fixture-canary-never-output');
});
test('J-PROFILES-PRIVATE failed history persistence cannot yield a usable lease or readiness', () => {
  const r = service.preflight({ repo_id: 'alpha' });
  const bucket = path.join(registry, 'history', sha(JSON.stringify('alice')), 'alpha');
  fs.chmodSync(bucket, 0o500);
  const failed = service.preflight({ repo_id: 'alpha' });
  expect(failed).toMatchObject({ ready: false, report_id: null });
  expect(failed.lease).toBeUndefined();
  expect(failed.findings).toContainEqual(expect.objectContaining({ code: 'evidence_not_durable' }));
  fs.chmodSync(bucket, 0o700);
  expect(service.history({ repo_id: 'alpha' }).reports[0].report_id).toBe(r.report_id);
});
test('J-PROFILES-CLI actual local UID and safe CLI output never expose the internal lease', () => {
  a.grants = { ['uid:' + process.getuid()]: ['read', 'preflight'] };
  const ownerFile = path.join(root, 'owner-profile.json');
  fs.writeFileSync(ownerFile, JSON.stringify(a), { mode: 0o600 });
  const registered = spawnSync(
    process.execPath,
    ['bin/specflow.js', 'profiles', 'register', '--registry', registry, '--file', ownerFile],
    { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }
  );
  expect(registered.status).toBe(0);
  expect(JSON.parse(registered.stdout).repo_id).toBe('alpha');
  const r = spawnSync(
    process.execPath,
    ['scripts/improve-profiles.cjs', 'preflight', 'alpha', '--registry', registry],
    { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }
  );
  expect(r.status).toBe(2);
  const out = JSON.parse(r.stdout);
  expect(out.lease).toBeUndefined();
  expect(out.lease_issued).toBe(true);
  expect(out.findings.some((f) => f.code === 'worker_unavailable')).toBe(true);
  const inspect = spawnSync(
    process.execPath,
    ['scripts/improve-profiles.cjs', 'inspect', 'alpha', '--registry', registry],
    { cwd: path.resolve(__dirname, '../..'), encoding: 'utf8' }
  );
  expect(inspect.status).toBe(0);
  expect(JSON.parse(inspect.stdout).available).toBe(true);
});
test('J-PROFILES-AUTH-CWD authentication metadata cannot execute a repository-relative auth script', () => {
  a.routing.providers = [{ id: 'reviewer', kind: 'claude-cli', tool: 'node' }];
  profiles.registerProfile(registry, a);
  const script = path.join(a.repository.path, 'auth'),
    marker = path.join(root, 'unexpected-auth-execution');
  fs.writeFileSync(script, "require('fs').writeFileSync(" + JSON.stringify(marker) + ",'bad');console.log('{}');");
  const previous = process.cwd();
  try {
    process.chdir(a.repository.path);
    const report = service.preflight({ repo_id: 'alpha' });
    expect(report.findings.some((x) => x.code === 'provider_auth_unavailable')).toBe(true);
  } finally {
    process.chdir(previous);
  }
  expect(fs.existsSync(marker)).toBe(false);
});
test('J-PROFILES-TOOL-CWD version probes cannot load repository-relative tool configuration', () => {
  const exe = path.join(root, 'trusted-version-probe'),
    marker = path.join(root, 'unexpected-version-execution');
  fs.writeFileSync(
    exe,
    '#!' +
      process.execPath +
      '\n' +
      "const fs=require('fs');if(fs.existsSync('repo-tool-config'))fs.writeFileSync(" +
      JSON.stringify(marker) +
      ",'bad');console.log('fixture-tool v1');\n",
    { mode: 0o700 }
  );
  a.toolchain.push({ id: 'configured-tool', path: exe, sha256: sha(fs.readFileSync(exe)), version: 'fixture-tool v1' });
  profiles.registerProfile(registry, a);
  fs.writeFileSync(path.join(a.repository.path, 'repo-tool-config'), 'fixture');
  const previous = process.cwd();
  try {
    process.chdir(a.repository.path);
    service.preflight({ repo_id: 'alpha' });
  } finally {
    process.chdir(previous);
  }
  expect(fs.existsSync(marker)).toBe(false);
});
test('J-PROFILES-VERIFIER missing pinned verifier and unobserved backend have exact actionable blockers', () => {
  a.verifier.sha256 = '0'.repeat(64);
  a.recipes.backend = ['node', 'src/test.cjs'];
  profiles.registerProfile(registry, a);
  const report = service.preflight({ repo_id: 'alpha' });
  expect(report.findings).toContainEqual(
    expect.objectContaining({
      check: 'verifier',
      code: 'verifier_unavailable',
      next_action: expect.stringContaining('approved commit')
    })
  );
  expect(report.findings).toContainEqual(
    expect.objectContaining({
      check: 'backend',
      code: 'backend_unverified',
      next_action: expect.stringContaining('#217')
    })
  );
  expect(report.ready).toBe(false);
});
test('J-PROFILES-POLICY-TRANSITION permits only a current authorised start (fixture metadata; no worker/provider qualification)', () => {
  const exe = path.join(root, 'fixture-auth-metadata'),
    evidence = path.join(root, 'policy-only-evidence.json');
  fs.writeFileSync(
    exe,
    '#!' +
      process.execPath +
      '\n' +
      "if(process.argv[2]==='--version')console.log('fixture-auth v1');else if(process.argv[2]==='auth'&&process.argv[3]==='status')console.log(JSON.stringify({loggedIn:true,authMethod:'claude.ai',apiProvider:'firstParty'}));else process.exit(42);\n",
    { mode: 0o700 }
  );
  fs.writeFileSync(
    evidence,
    JSON.stringify({
      scope: 'synthetic trusted host policy metadata only; no worker, inference or isolation qualification'
    }),
    { mode: 0o600 }
  );
  a.toolchain.push({ id: 'fixture-auth', path: exe, sha256: sha(fs.readFileSync(exe)), version: 'fixture-auth v1' });
  a.routing.providers = [{ id: 'fixture', kind: 'claude-cli', tool: 'fixture-auth' }];
  a.runtime = { adapter: 'policy-test-fixture', revision: 'fixture-v1' };
  profiles.registerProfile(registry, a);
  host.adapters = [
    {
      id: 'policy-test-fixture',
      revision: 'fixture-v1',
      qualified: true,
      noninteractive_roles: true,
      usage_modes: ['subscription_cli'],
      evidence: { path: evidence, sha256: sha(fs.readFileSync(evidence)) }
    }
  ];
  const report = service.preflight({ repo_id: 'alpha' });
  expect(report.ready).toBe(true);
  let transitioned = false;
  const result = service.withAuthorized(report.lease, 'execute', (p) => {
    transitioned = p.repo_id === 'alpha';
    return 'metadata-only-start';
  });
  expect(result).toMatchObject({ allowed: true, result: 'metadata-only-start' });
  expect(transitioned).toBe(true);
  expect(fs.existsSync(path.join(a.repository.path, 'RECIPE_WAS_EXECUTED'))).toBe(false);
  const overridden = profiles
    .createProfileService({
      registry,
      resolvePrincipal: () => 'alice',
      hostCapabilities: () => host,
      environment: { PATH: '/usr/bin:/bin', HOME: '/nonexistent', ANTHROPIC_API_KEY: 'fixture-override-not-an-api-key' }
    })
    .preflight({ repo_id: 'alpha' });
  expect(overridden.findings.some((f) => f.code === 'provider_billing_mode_mismatch')).toBe(true);
  expect(JSON.stringify(overridden)).not.toContain('fixture-override-not-an-api-key');
  host.operations = ['read', 'preflight'];
  expect(
    service.withAuthorized(report.lease, 'execute', () => {
      throw Error('must not start');
    }).findings[0].code
  ).toBe('permission_revoked');
});
test('J-PROFILES-HOST failure of trusted host capability discovery has its own remedy', () => {
  const unavailable = profiles
    .createProfileService({
      registry,
      resolvePrincipal: () => 'alice',
      hostCapabilities: () => {
        throw Error('private backend config path must not be disclosed');
      }
    })
    .preflight({ repo_id: 'alpha' });
  expect(unavailable.findings[0]).toMatchObject({
    check: 'host',
    code: 'host_capabilities_unavailable',
    retryable: true
  });
  expect(JSON.stringify(unavailable)).not.toContain('private backend config path');
});
test('J-PROFILES-BILLING subscription preflight refuses API authentication metadata', () => {
  const exe = path.join(root, 'fixture-api-auth');
  fs.writeFileSync(
    exe,
    '#!' +
      process.execPath +
      '\n' +
      "if(process.argv[2]==='--version')console.log('fixture-api-auth v1');else console.log(JSON.stringify({loggedIn:true,authMethod:'api_key',apiProvider:'firstParty'}));\n",
    { mode: 0o700 }
  );
  a.toolchain.push({
    id: 'fixture-api-auth',
    path: exe,
    sha256: sha(fs.readFileSync(exe)),
    version: 'fixture-api-auth v1'
  });
  a.routing.providers = [{ id: 'fixture-api', kind: 'claude-cli', tool: 'fixture-api-auth' }];
  profiles.registerProfile(registry, a);
  const report = service.preflight({ repo_id: 'alpha' });
  expect(report.findings).toContainEqual(
    expect.objectContaining({
      code: 'provider_billing_mode_mismatch',
      next_action: expect.stringContaining('No fallback')
    })
  );
  expect(report.ready).toBe(false);
});
test('J-PROFILES-HISTORICAL-TEARDOWN historical reads survive missing source without reviving execution or recreating the repo', () => {
  const before = service.preflight({ repo_id: 'alpha' });
  fs.rmSync(a.repository.path, { recursive: true });
  expect(service.inspect({ repo_id: 'alpha' })).toMatchObject({ available: true, repo_id: 'alpha' });
  expect(service.history({ repo_id: 'alpha' }).reports.map((r) => r.report_id)).toContain(before.report_id);
  expect(service.preflight({ repo_id: 'alpha' }).ready).toBe(false);
  let started = false;
  expect(
    service.withAuthorized(before.lease, 'execute', () => {
      started = true;
    })
  ).toMatchObject({ allowed: false });
  expect(started).toBe(false);
  expect(fs.existsSync(a.repository.path)).toBe(false);
  principal = 'viewer';
  expect(service.inspect({ repo_id: 'alpha' }).available).toBe(true);
  expect(service.history({ repo_id: 'alpha' }).reports).toEqual([]);
  principal = 'bob';
  expect(service.inspect({ repo_id: 'alpha' }).available).toBe(false);
});
test('J-PROFILES-HISTORICAL-TEARDOWN current read revocation still denies historical metadata after source removal', () => {
  const before = service.preflight({ repo_id: 'alpha' });
  a.grants.alice = ['preflight', 'execute'];
  profiles.registerProfile(registry, a);
  fs.rmSync(a.repository.path, { recursive: true });
  expect(service.inspect({ repo_id: 'alpha' }).available).toBe(false);
  expect(service.history({ repo_id: 'alpha' }).available).toBe(false);
  expect(service.authorize(before.lease, 'execute').allowed).toBe(false);
  expect(() => profiles.registerProfile(registry, a)).toThrow();
});
