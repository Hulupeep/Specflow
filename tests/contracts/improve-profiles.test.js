'use strict';
const fs = require('fs'),
  path = require('path'),
  os = require('os'),
  crypto = require('crypto');
const profiles = require('../../scripts/improve-profiles.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
let root, repo, registry, profile;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'profiles-contract-'));
  repo = path.join(root, 'repo');
  registry = path.join(root, 'registry');
  fs.mkdirSync(repo);
  fs.writeFileSync(path.join(repo, 'routing.json'), '{}');
  profile = {
    version: 1,
    repo_id: 'alpha',
    repository: {
      path: repo,
      remote: 'https://github.com/example/alpha.git',
      refs: [{ name: 'main', commit: 'a'.repeat(40) }]
    },
    mission: 'Improve the existing task list.',
    scope: {
      allowed: ['src/**'],
      protected: ['.git/**', '.env*', 'AGENTS.md']
    },
    recipes: {
      setup: ['node', 'setup.cjs'],
      test: ['node', 'test.cjs'],
      backend: null
    },
    toolchain: [
      {
        id: 'node',
        path: fs.realpathSync(process.execPath),
        sha256: sha(fs.readFileSync(process.execPath)),
        version: process.version
      }
    ],
    verifier: { path: 'src/test.cjs', sha256: sha('fixture verifier') },
    routing: {
      path: path.join(repo, 'routing.json'),
      sha256: sha('{}'),
      usage_mode: 'subscription_cli',
      providers: []
    },
    runtime: { adapter: 'local-bwrap', revision: 'qualification-pending' },
    secret_references: [],
    evidence: { path: path.join(root, 'evidence') },
    publication: {
      allowed: false,
      branch_prefix: 'improve/',
      automatic_merge: false
    },
    grants: {
      alice: ['read', 'preflight', 'execute'],
      bob: ['read', 'preflight']
    }
  };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('AC-PROFILES-01 owner registration pins a content revision, not caller URLs or commands', () => {
  const saved = profiles.registerProfile(registry, profile);
  expect(saved.revision).toBe(sha(JSON.stringify(profile)));
  expect(fs.statSync(path.join(registry, 'profiles', 'alpha.json')).mode & 0o777).toBe(0o600);
  const service = profiles.createProfileService({
    registry,
    resolvePrincipal: () => 'alice',
    hostCapabilities: () => ({
      revision: 'host1',
      operations: ['read', 'preflight', 'execute'],
      adapters: []
    })
  });
  expect(service.inspect({ repo_id: 'alpha', revision: saved.revision })).toMatchObject({
    repo_id: 'alpha',
    revision: saved.revision,
    available: true
  });
  for (const extra of [
    { url: 'https://evil.example/repo' },
    { path: '/private' },
    { command: ['sh'] },
    { secret: 'private-value' },
    { principal: 'bob' },
    { operation: 'publish' }
  ])
    expect(service.preflight({ repo_id: 'alpha', ...extra })).toMatchObject({
      ready: false,
      findings: [expect.objectContaining({ code: 'invalid_request' })]
    });
  expect(service.preflight({ repo_id: 'alpha', revision: 'forged' }).findings[0].code).toBe('stale_profile');
});
test.each([
  ['unknown field', (p) => (p.extra = true)],
  [
    'credentials instead of references',
    (p) => (p.secret_references = [{ id: 'db', kind: 'value', value: 'private-value', purpose: 'fixture' }])
  ],
  [
    'production secret purpose',
    (p) =>
      (p.secret_references = [
        {
          id: 'db',
          kind: 'environment',
          name: 'TEST_DB',
          purpose: 'production'
        }
      ])
  ],
  ['unsafe scope', (p) => (p.scope.allowed = ['../other/**'])],
  ['remote credentials', (p) => (p.repository.remote = 'https://user:private-value@example.test/repo')],
  ['automatic merge', (p) => (p.publication.automatic_merge = true)],
  [
    'repo executable as trusted tool',
    (p) => {
      p.toolchain[0].path = path.join(repo, 'tool');
      fs.writeFileSync(p.toolchain[0].path, 'tool');
    }
  ],
  ['caller-controlled shell', (p) => (p.recipes.test = ['sh', '-c', 'do something'])],
  ['unknown mode', (p) => (p.routing.usage_mode = 'automatic')]
])('AC-PROFILES-02 rejects profile authority expansion: %s', (_, change) => {
  change(profile);
  expect(() => profiles.registerProfile(registry, profile)).toThrow(profiles.ProfileError);
});
test('AC-PROFILES-04 unknown and inaccessible aliases return the same safe result', () => {
  profiles.registerProfile(registry, profile);
  const service = profiles.createProfileService({
    registry,
    resolvePrincipal: () => 'outsider',
    hostCapabilities: () => ({
      revision: 'host1',
      operations: ['read', 'preflight'],
      adapters: []
    })
  });
  expect(service.inspect({ repo_id: 'alpha' })).toEqual(service.inspect({ repo_id: 'absent' }));
  expect(JSON.stringify(service.preflight({ repo_id: 'alpha' }))).not.toContain(repo);
});
test('registry owner permissions and symlink components are enforced', () => {
  profiles.registerProfile(registry, profile);
  fs.chmodSync(path.join(registry, 'profiles', 'alpha.json'), 0o644);
  expect(() => profiles.readProfile(registry, 'alpha')).toThrow(/private/i);
  fs.chmodSync(path.join(registry, 'profiles', 'alpha.json'), 0o600);
  fs.symlinkSync(registry, path.join(root, 'link'));
  expect(() => profiles.readProfile(path.join(root, 'link'), 'alpha')).toThrow(/symbolic/i);
});
test('service construction never accepts a principal from request data', () => {
  profiles.registerProfile(registry, profile);
  expect(() =>
    profiles.createProfileService({
      registry,
      principal: 'alice',
      hostCapabilities: () => ({})
    })
  ).toThrow(/resolver/i);
});
