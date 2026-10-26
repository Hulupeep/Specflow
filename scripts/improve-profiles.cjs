'use strict';
// Trusted control plane. Registry and host constructor options must never be
// writable by repository workers or reconstructed from an MCP request body.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  { spawnSync } = require('child_process');
const OPERATIONS = ['read', 'preflight', 'execute', 'publish'],
  MODES = ['subscription_cli', 'api_billed', 'unknown'];
const sha = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex'),
  digest = (value) => sha(JSON.stringify(value));
class ProfileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ProfileError';
  }
}
const demand = (ok, message) => {
  if (!ok) throw new ProfileError(message);
};
const text = (v) => typeof v === 'string' && v.length > 0 && v.length <= 4096 && !/[\x00-\x1f]/.test(v);
const id = (v) => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(v);
function shape(v, keys) {
  demand(
    v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      Object.keys(v).every((k) => keys.includes(k)) &&
      keys.every((k) => Object.hasOwn(v, k)),
    'Unexpected or missing profile fields'
  );
}
function noLinks(file) {
  demand(typeof file === 'string' && path.isAbsolute(file), 'Absolute owner-approved path required');
  for (let p = path.resolve(file); p !== path.dirname(p); p = path.dirname(p))
    if (fs.existsSync(p)) demand(!fs.lstatSync(p).isSymbolicLink(), 'Symbolic path component refused');
  return path.resolve(file);
}
function privatePath(file, directory = false) {
  file = noLinks(file);
  const s = fs.statSync(file);
  demand(
    s.uid === process.getuid() && !(s.mode & 0o077) && Boolean(s.mode & 0o600),
    'Registry paths must be private and owner controlled'
  );
  demand(directory ? s.isDirectory() : s.isFile(), 'Unexpected registry file type');
  return file;
}
function mkdirPrivate(dir) {
  noLinks(dir);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  privatePath(dir, true);
  return dir;
}
function atomic(file, value) {
  noLinks(file);
  mkdirPrivate(path.dirname(file));
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', {
      mode: 0o600,
      flag: 'wx'
    });
    fs.renameSync(tmp, file);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
}
function under(child, parent) {
  return child === parent || child.startsWith(parent + path.sep);
}
function relPattern(v) {
  return (
    text(v) && !path.isAbsolute(v) && !v.includes('\\') && !v.split('/').some((p) => !p || p === '.' || p === '..')
  );
}
function validateProfile(p, { allowMissingRepository = false } = {}) {
  shape(p, [
    'version',
    'repo_id',
    'repository',
    'mission',
    'scope',
    'recipes',
    'verifier',
    'toolchain',
    'routing',
    'runtime',
    'secret_references',
    'evidence',
    'publication',
    'grants'
  ]);
  demand(p.version === 1 && id(p.repo_id) && text(p.mission), 'Unsupported profile identity/version');
  shape(p.repository, ['path', 'remote', 'refs']);
  const repo = noLinks(p.repository.path);
  if (!allowMissingRepository || fs.existsSync(repo))
    demand(
      fs.statSync(repo).isDirectory() && fs.realpathSync(repo) === repo,
      'Canonical repository directory required'
    );
  demand(
    typeof p.repository.remote === 'string' &&
      (/^https:\/\/[^/@\s]+\/[^\s]+$/.test(p.repository.remote) ||
        /^git@[A-Za-z0-9.-]+:[A-Za-z0-9/_.-]+$/.test(p.repository.remote)),
    'Credential-free canonical Git remote required'
  );
  if (p.repository.remote.startsWith('https:')) {
    const remote = new URL(p.repository.remote);
    demand(
      !remote.username && !remote.password && !remote.search && !remote.hash,
      'Credential-free canonical Git remote required'
    );
  }
  demand(
    Array.isArray(p.repository.refs) && p.repository.refs.length > 0 && p.repository.refs.length <= 20,
    'Approved base refs required'
  );
  for (const ref of p.repository.refs) {
    shape(ref, ['name', 'commit']);
    demand(
      text(ref.name) &&
        /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(ref.name) &&
        !ref.name.includes('..') &&
        !ref.name.includes('//') &&
        !ref.name.endsWith('/') &&
        !ref.name.endsWith('.lock') &&
        /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(ref.commit),
      'Invalid pinned Git ref'
    );
  }
  shape(p.scope, ['allowed', 'protected']);
  for (const list of [p.scope.allowed, p.scope.protected])
    demand(Array.isArray(list) && list.length > 0 && list.every(relPattern), 'Unsafe or empty scope');
  demand(Array.isArray(p.toolchain) && p.toolchain.length > 0, 'Pinned toolchain required');
  const tools = new Set();
  for (const tool of p.toolchain) {
    shape(tool, ['id', 'path', 'sha256', 'version']);
    demand(id(tool.id) && !tools.has(tool.id), 'Unique tool ID required');
    tools.add(tool.id);
    const exe = noLinks(tool.path);
    demand(
      !under(exe, repo) && /^[a-f0-9]{64}$/.test(tool.sha256) && text(tool.version),
      'Trusted tool must be pinned outside repository'
    );
  }
  shape(p.recipes, ['setup', 'test', 'backend']);
  for (const key of ['setup', 'test', 'backend']) {
    const argv = p.recipes[key];
    if (key === 'backend' && argv === null) continue;
    demand(
      Array.isArray(argv) && argv.length > 0 && argv.length <= 100 && argv.every(text) && tools.has(argv[0]),
      'Recipe must use an approved tool ID and argv'
    );
  }
  shape(p.verifier, ['path', 'sha256']);
  demand(
    relPattern(p.verifier.path) && !/[?*]/.test(p.verifier.path) && /^[a-f0-9]{64}$/.test(p.verifier.sha256),
    'Pinned repository verifier file required'
  );
  shape(p.routing, ['path', 'sha256', 'usage_mode', 'providers']);
  noLinks(p.routing.path);
  demand(
    /^[a-f0-9]{64}$/.test(p.routing.sha256) &&
      MODES.includes(p.routing.usage_mode) &&
      Array.isArray(p.routing.providers),
    'Pinned routing and explicit usage mode required'
  );
  for (const provider of p.routing.providers) {
    shape(provider, ['id', 'kind', 'tool']);
    demand(
      id(provider.id) && ['claude-cli', 'codex-cli'].includes(provider.kind) && tools.has(provider.tool),
      'Unsupported provider authentication probe'
    );
  }
  shape(p.runtime, ['adapter', 'revision']);
  demand(id(p.runtime.adapter) && text(p.runtime.revision), 'Approved adapter identity required');
  demand(Array.isArray(p.secret_references), 'Secret references required');
  for (const ref of p.secret_references) {
    demand(ref && ref.purpose === 'fixture', 'Only dedicated test-fixture secret references are permitted');
    if (ref.kind === 'environment') {
      shape(ref, ['id', 'kind', 'name', 'purpose']);
      demand(id(ref.id) && /^[A-Z][A-Z0-9_]*$/.test(ref.name), 'Invalid environment reference');
    } else {
      shape(ref, ['id', 'kind', 'path', 'purpose']);
      demand(ref.kind === 'file' && id(ref.id), 'Unsupported secret reference');
      noLinks(ref.path);
    }
  }
  shape(p.evidence, ['path']);
  const evidence = noLinks(p.evidence.path);
  demand(!under(evidence, repo), 'Private evidence must be outside repository');
  shape(p.publication, ['allowed', 'branch_prefix', 'automatic_merge']);
  demand(
    typeof p.publication.allowed === 'boolean' &&
      p.publication.automatic_merge === false &&
      text(p.publication.branch_prefix) &&
      p.publication.branch_prefix.endsWith('/') &&
      relPattern(p.publication.branch_prefix.slice(0, -1)),
    'Explicit publication policy required; automatic merge forbidden'
  );
  demand(
    p.grants && typeof p.grants === 'object' && !Array.isArray(p.grants) && Object.keys(p.grants).length > 0,
    'Principal grants required'
  );
  for (const [principal, ops] of Object.entries(p.grants))
    demand(
      text(principal) &&
        Array.isArray(ops) &&
        ops.every((op) => OPERATIONS.includes(op)) &&
        new Set(ops).size === ops.length,
      'Invalid authority grant'
    );
  return p;
}
function registryKey(registry) {
  privatePath(registry, true);
  return fs.readFileSync(privatePath(path.join(registry, 'lease-key')));
}
function locked(registry, fn, lockTool = null, fault = () => {}, retainV2 = false) {
  privatePath(registry, true);
  const lock = path.join(registry, '.authority-lock');
  if (lockTool) {
    const kernel = require('./improve-kernel-lock.cjs');
    try {
      return kernel.withLock(path.join(lock, 'kernel-v2.lock'), lockTool, () => {
        fault('authority_locked');
        return fn();
      });
    } catch (e) {
      if (e.code === 'store_busy') throw new ProfileError('Owner registry operation active; retry without overriding the lock');
      throw e;
    }
  }
  try {
    fs.mkdirSync(lock, { mode: 0o700 });
  } catch {
    throw new ProfileError('Owner registry operation active; retry without overriding the lock');
  }
  try {
    return fn();
  } finally {
    if (!(retainV2 && (fs.existsSync(path.join(lock, 'kernel-v2.lock')) || fs.existsSync(path.join(lock, '.migration-owner.json'))))) fs.rmdirSync(lock);
  }
}
function registerProfile(registry, profile, { lockTool = null, fault = () => {} } = {}) {
  registry = mkdirPrivate(path.resolve(registry));
  validateProfile(profile);
  demand(!under(registry, profile.repository.path), 'Registry must be outside repository');
  if (lockTool) require('./improve-kernel-lock.cjs').prepareAuthority(registry, lockTool, { fault });
  return locked(registry, () => {
    const key = path.join(registry, 'lease-key');
    if (!fs.existsSync(key))
      fs.writeFileSync(key, crypto.randomBytes(32), {
        mode: 0o600,
        flag: 'wx'
      });
    privatePath(key);
    const revision = digest(profile);
    atomic(path.join(registry, 'profiles', profile.repo_id + '.json'), {
      profile,
      revision
    });
    return { repo_id: profile.repo_id, revision };
  }, lockTool, fault);
}
function readProfile(registry, repoId, { allowMissingRepository = false } = {}) {
  demand(id(repoId), 'Invalid repository alias');
  privatePath(registry, true);
  privatePath(path.join(registry, 'profiles'), true);
  const record = JSON.parse(fs.readFileSync(privatePath(path.join(registry, 'profiles', repoId + '.json')), 'utf8'));
  demand(record.revision === digest(record.profile), 'Profile integrity failure');
  validateProfile(record.profile, { allowMissingRepository });
  return record;
}
const finding = (check, code, observed, next_action, retryable = false) => ({
  check,
  code,
  status: code === 'ok' ? 'passed' : 'blocked',
  observed,
  retryable,
  next_action
});
const passed = (check, observed) => finding(check, 'ok', observed, 'No action needed.');
const unavailable = () => ({
  available: false,
  findings: [
    finding(
      'authority',
      'repo_unavailable',
      'Repository alias is unavailable for this caller.',
      'Ask the owner to register the alias and grant access.'
    )
  ]
});
function validRequest(req) {
  return (
    req &&
    typeof req === 'object' &&
    !Array.isArray(req) &&
    id(req.repo_id) &&
    Object.keys(req).every((k) => ['repo_id', 'revision'].includes(k)) &&
    (!Object.hasOwn(req, 'revision') || typeof req.revision === 'string')
  );
}
function gitRead(repo, args, raw = false) {
  const r = spawnSync(
    '/usr/bin/git',
    ['--no-optional-locks', '-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-C', repo, ...args],
    {
      encoding: 'utf8',
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      env: {
        PATH: '/usr/bin:/bin',
        HOME: '/nonexistent',
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_TERMINAL_PROMPT: '0'
      }
    }
  );
  if (r.status !== 0) throw new ProfileError('Git identity unavailable');
  return raw ? r.stdout : r.stdout.trim();
}
function capabilities(value) {
  demand(
    value &&
      text(value.revision) &&
      Array.isArray(value.operations) &&
      value.operations.every((op) => OPERATIONS.includes(op)) &&
      Array.isArray(value.adapters),
    'Trusted host capability resolver is incomplete'
  );
  return value;
}
// Metadata CLIs must not discover repository-local scripts/configuration.
function probe(registry, executable, argv, env, timeout = 10000) {
  const directory = fs.mkdtempSync(path.join(mkdirPrivate(path.join(registry, 'metadata-probes')), 'probe-'));
  try {
    return spawnSync(executable, argv, { cwd: directory, encoding: 'utf8', timeout, maxBuffer: 65536, env });
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
function checkInputs(profile, host, environment, registry) {
  const findings = [],
    facts = {};
  try {
    facts.gitExecutable = sha(fs.readFileSync('/usr/bin/git'));
    demand(
      profile.toolchain.some((t) => t.id === 'git' && t.path === '/usr/bin/git' && t.sha256 === facts.gitExecutable),
      'Pinned Git reader unavailable'
    );
    const top = gitRead(profile.repository.path, ['rev-parse', '--show-toplevel']),
      remote = gitRead(profile.repository.path, ['config', '--local', '--get', 'remote.origin.url']);
    demand(
      fs.realpathSync(top) === profile.repository.path && remote === profile.repository.remote,
      'Git identity mismatch'
    );
    facts.refs = profile.repository.refs.map((ref) => ({
      name: ref.name,
      commit: gitRead(profile.repository.path, [
        'rev-parse',
        '--verify',
        (ref.name.startsWith('refs/heads/') ? ref.name : 'refs/heads/' + ref.name) + '^{commit}'
      ])
    }));
    demand(
      facts.refs.every((ref, i) => ref.commit === profile.repository.refs[i].commit),
      'Pinned ref changed'
    );
    findings.push(passed('repository', 'Canonical Git identity and approved commits match.'));
  } catch {
    findings.push(
      finding(
        'repository',
        'repository_mismatch',
        'Canonical Git identity or approved ref is unavailable or changed.',
        'Owner must inspect repository access and approve the intended identity/ref.'
      )
    );
  }
  try {
    const bytes = gitRead(
      profile.repository.path,
      ['cat-file', 'blob', profile.repository.refs[0].commit + ':' + profile.verifier.path],
      true
    );
    facts.verifier = sha(bytes);
    demand(facts.verifier === profile.verifier.sha256, 'Verifier input mismatch');
    findings.push(
      passed('verifier', 'Approved repository verifier is available at the pinned base commit; no tests were executed.')
    );
  } catch {
    findings.push(
      finding(
        'verifier',
        'verifier_unavailable',
        'Approved repository verifier blob is absent or its bytes differ.',
        'Owner must restore the verifier at the approved commit or register the intended new revision.'
      )
    );
  }
  facts.tools = [];
  if (!profile.toolchain.some((t) => t.id === 'git' && t.path === '/usr/bin/git' && t.sha256 === facts.gitExecutable))
    findings.push(
      finding(
        'tool:git',
        'git_toolchain_unpinned',
        'The metadata reader is not pinned by the approved toolchain.',
        'Owner must pin the actual host Git executable bytes/version.'
      )
    );
  for (const tool of profile.toolchain) {
    try {
      const file = noLinks(tool.path);
      demand(fs.statSync(file).isFile(), 'Tool unavailable');
      fs.accessSync(file, fs.constants.X_OK);
      const actual = sha(fs.readFileSync(file));
      demand(actual === tool.sha256, 'Tool bytes changed');
      const r = probe(registry, file, ['--version'], { PATH: '/usr/bin:/bin', HOME: '/nonexistent' });
      demand(r.status === 0 && r.stdout.trim() === tool.version, 'Tool version changed');
      facts.tools.push({ id: tool.id, sha256: actual, version: tool.version });
      findings.push(passed('tool:' + tool.id, 'Approved executable bytes and version match.'));
    } catch {
      findings.push(
        finding(
          'tool:' + tool.id,
          'toolchain_unavailable',
          'Approved executable is absent, changed or reports an unexpected version.',
          'Install the owner-pinned toolchain or ask the owner to approve its new bytes/version.',
          true
        )
      );
    }
  }
  try {
    facts.routing = sha(fs.readFileSync(noLinks(profile.routing.path)));
    demand(facts.routing === profile.routing.sha256, 'Routing changed');
    findings.push(passed('routing', 'Pinned routing bytes match; usage mode is ' + profile.routing.usage_mode + '.'));
  } catch {
    findings.push(
      finding(
        'routing',
        'routing_mismatch',
        'Pinned routing input is unavailable or changed.',
        'Restore the approved routing file or request a new profile revision.'
      )
    );
  }
  if (profile.routing.usage_mode === 'unknown')
    findings.push(
      finding(
        'usage',
        'usage_mode_unknown',
        'Execution billing mode is not established.',
        'Owner must choose subscription_cli or explicitly approve api_billed; no automatic fallback.'
      )
    );
  if (!profile.routing.providers.length)
    findings.push(
      finding(
        'auth',
        'provider_not_configured',
        'No approved provider authentication route is configured.',
        'Owner must register the actual subscription CLI or explicitly approved API route; no fallback.'
      )
    );
  for (const provider of profile.routing.providers) {
    const tool = profile.toolchain.find((t) => t.id === provider.tool);
    try {
      demand(
        facts.tools.some((t) => t.id === tool.id),
        'Untrusted auth executable'
      );
      const argv = provider.kind === 'claude-cli' ? ['auth', 'status'] : ['--no-daemon', 'login', 'status'];
      const r = probe(registry, tool.path, argv, environment, 15000);
      if (r.error?.code === 'ETIMEDOUT') {
        findings.push(
          finding(
            'auth:' + provider.id,
            'auth_probe_timeout',
            'Approved authentication metadata probe exceeded its time limit.',
            'Repair noninteractive CLI startup, then retry the auth probe; do not infer a quota or budget failure.',
            true
          )
        );
        continue;
      }
      let ok,
        mode = 'unknown';
      if (provider.kind === 'claude-cli') {
        const status = JSON.parse(r.stdout);
        ok = r.status === 0 && status.loggedIn === true;
        if (status.authMethod === 'claude.ai' && status.apiProvider === 'firstParty') mode = 'subscription_cli';
        else if (/api.?key/i.test(status.authMethod || '')) mode = 'api_billed';
      } else {
        const metadata = r.stdout + '\n' + r.stderr;
        ok = r.status === 0 && /logged in/i.test(metadata);
        if (/chatgpt/i.test(metadata) && !/api key/i.test(metadata)) mode = 'subscription_cli';
        else if (/api key/i.test(metadata)) mode = 'api_billed';
      }
      demand(ok, 'No configured login');
      const apiVariables =
        provider.kind === 'claude-cli'
          ? ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL']
          : ['OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL'];
      const apiOverridePresent = apiVariables.some(
        (name) => typeof environment[name] === 'string' && environment[name].length > 0
      );
      (facts.auth ||= []).push({
        provider: provider.id,
        mode,
        apiOverridePresent,
        metadata: sha(r.stdout + '\n' + r.stderr)
      });
      if (
        mode === 'unknown' ||
        (profile.routing.usage_mode !== 'unknown' && mode !== profile.routing.usage_mode) ||
        (profile.routing.usage_mode === 'subscription_cli' && apiOverridePresent)
      ) {
        findings.push(
          finding(
            'auth:' + provider.id,
            'provider_billing_mode_mismatch',
            'Configured authentication route does not establish the approved execution mode, or an API override is present.',
            'Use the approved subscription login with API overrides removed, or obtain explicit approval for a separately qualified API-billed profile. No fallback is permitted.'
          )
        );
        continue;
      }
      findings.push(
        passed(
          'auth:' + provider.id,
          'Configured CLI login observed without inference. Server validity, capacity and quota are unmeasured.'
        )
      );
    } catch {
      findings.push(
        finding(
          'auth:' + provider.id,
          'provider_auth_unavailable',
          'Approved CLI does not report a configured login.',
          'Sign in through the approved CLI account route, then retry; do not supply a key in caller input.',
          true
        )
      );
    }
  }
  for (const ref of profile.secret_references) {
    try {
      if (ref.kind === 'environment')
        demand(
          typeof environment[ref.name] === 'string' && environment[ref.name].length > 0,
          'Missing fixture reference'
        );
      else privatePath(ref.path);
      findings.push(
        passed('fixture:' + ref.id, 'Dedicated fixture reference is present; contents were not read or returned.')
      );
    } catch {
      findings.push(
        finding(
          'fixture:' + ref.id,
          'fixture_secret_unavailable',
          'Dedicated fixture reference is absent or lacks required private permissions.',
          'Owner must provision the approved test fixture reference outside repository inputs.',
          true
        )
      );
    }
  }
  findings.push(
    passed(
      'recipes',
      'Setup/test' +
        (profile.recipes.backend ? '/backend' : '') +
        ' argv are approved; no repository recipe was executed.'
    )
  );
  if (profile.recipes.backend) {
    const recipe = digest({
      repo_id: profile.repo_id,
      commit: profile.repository.refs[0].commit,
      argv: profile.recipes.backend
    });
    const backend = (host.backends || []).find((b) => b.recipe === recipe && b.ready === true);
    try {
      demand(
        backend?.evidence && sha(fs.readFileSync(privatePath(backend.evidence.path))) === backend.evidence.sha256,
        'Backend qualification unavailable'
      );
      facts.backend = { recipe, evidence: backend.evidence.sha256 };
      findings.push(
        passed(
          'backend',
          'Matching host-observed backend recipe evidence is available; live health is rechecked during the cycle.'
        )
      );
    } catch {
      findings.push(
        finding(
          'backend',
          'backend_unverified',
          'No matching observed backend recipe evidence is available.',
          'Qualify the dedicated seeded backend recipe under #217; do not substitute mocked success.',
          true
        )
      );
    }
  } else findings.push(passed('backend', 'Owner profile declares no backend recipe for this slice.'));
  const adapter = host.adapters.find(
    (a) => a.id === profile.runtime.adapter && a.revision === profile.runtime.revision
  );
  if (!adapter?.qualified)
    findings.push(
      finding(
        'worker',
        'worker_unavailable',
        'No matching host-qualified isolated worker is available.',
        'Complete #217 qualification and approve the adapter revision; never run unconfined.',
        true
      )
    );
  else {
    try {
      demand(
        adapter.evidence && sha(fs.readFileSync(privatePath(adapter.evidence.path))) === adapter.evidence.sha256,
        'Qualification evidence unavailable'
      );
      findings.push(passed('worker', 'Owner-approved adapter qualification evidence matches the selected revision.'));
    } catch {
      findings.push(
        finding(
          'worker',
          'worker_evidence_stale',
          'Host adapter qualification evidence is missing or changed.',
          'Requalify the adapter before protected work.'
        )
      );
    }
  }
  if (adapter?.qualified && !adapter.usage_modes?.includes(profile.routing.usage_mode))
    findings.push(
      finding(
        'usage',
        'usage_mode_unavailable',
        'Selected worker is not qualified for the approved usage mode.',
        'Qualify the intended mode explicitly; never fall back to API billing.'
      )
    );
  if (!adapter?.noninteractive_roles)
    findings.push(
      finding(
        'noninteractive_roles',
        'noninteractive_unverified',
        'Unattended role capability has not been observed for the selected adapter.',
        'Qualify actual noninteractive role invocations; configured login alone is insufficient.'
      )
    );
  try {
    const dir = mkdirPrivate(profile.evidence.path),
      file = path.join(dir, 'preflight-' + crypto.randomUUID());
    try {
      fs.writeFileSync(file, 'private evidence probe', {
        mode: 0o600,
        flag: 'wx'
      });
      demand(fs.readFileSync(file, 'utf8') === 'private evidence probe', 'Evidence readback failed');
    } finally {
      fs.rmSync(file, { force: true });
    }
    findings.push(
      passed('evidence', 'Private evidence create/read/delete probe passed. Host/disk loss durability is not implied.')
    );
  } catch {
    findings.push(
      finding(
        'evidence',
        'evidence_unavailable',
        'Private durable evidence destination cannot be verified.',
        'Owner must restore private evidence access before starting work.',
        true
      )
    );
  }
  return { findings, facts };
}
function createProfileService({
  registry,
  resolvePrincipal,
  hostCapabilities,
  environment = process.env,
  now = Date.now,
  leaseSeconds = 300,
  lockTool = null,
  fault = () => {}
} = {}) {
  demand(typeof resolvePrincipal === 'function', 'Trusted principal resolver required');
  demand(typeof hostCapabilities === 'function', 'Trusted host capability resolver required');
  demand(Number.isInteger(leaseSeconds) && leaseSeconds > 0 && leaseSeconds <= 300, 'Invalid lease lifetime');
  registry = path.resolve(registry);
  const identity = () => {
    const principal = resolvePrincipal();
    demand(text(principal), 'Trusted principal resolver failed');
    return principal;
  };
  function lookup(req, op, fixedPrincipal) {
    if (!validRequest(req))
      return {
        error: {
          available: false,
          findings: [
            finding(
              'request',
              'invalid_request',
              'Only a registered repo_id and optional revision are accepted.',
              'Remove URL, path, command, secret, principal and other override fields.'
            )
          ]
        }
      };
    try {
      const principal = fixedPrincipal || identity(),
        record = readProfile(registry, req.repo_id, { allowMissingRepository: op === 'read' });
      if (!record.profile.grants[principal]?.includes(op)) return { error: unavailable() };
      let host;
      try {
        host = capabilities(hostCapabilities());
      } catch {
        return {
          error: {
            available: true,
            findings: [
              finding(
                'host',
                'host_capabilities_unavailable',
                'Trusted host capability observations are unavailable or invalid.',
                'Restore the host capability resolver and repeat preflight; do not replace it with caller-provided assertions.',
                true
              )
            ]
          }
        };
      }
      if (!host.operations.includes(op)) return { error: unavailable() };
      if (req.revision !== undefined && req.revision !== record.revision)
        return {
          error: {
            available: true,
            findings: [
              finding(
                'profile',
                'stale_profile',
                'Requested profile revision is no longer current.',
                'Re-read the owner-approved profile and repeat preflight.'
              )
            ]
          }
        };
      return { principal, ...record, host };
    } catch {
      return { error: unavailable() };
    }
  }
  const sign = (value) => {
    const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
    return payload + '.' + crypto.createHmac('sha256', registryKey(registry)).update(payload).digest('hex');
  };
  function decode(lease, principal = identity()) {
    demand(typeof lease === 'string' && lease.length < 16384, 'Invalid lease');
    const [payload, mac, ...rest] = lease.split('.');
    demand(!rest.length && /^[a-f0-9]{64}$/.test(mac || ''), 'Invalid lease');
    const expected = crypto.createHmac('sha256', registryKey(registry)).update(payload).digest();
    demand(crypto.timingSafeEqual(Buffer.from(mac, 'hex'), expected), 'Invalid lease');
    const value = JSON.parse(Buffer.from(payload, 'base64url'));
    demand(
      value.version === 1 && value.expires > now() && value.principal === principal,
      'Expired or mismatched lease'
    );
    return value;
  }
  const historyDir = (principal, repoId) => path.join(registry, 'history', digest(principal), repoId);
  function inspect(req) {
    const c = lookup(req, 'read');
    return (
      c.error || {
        available: true,
        repo_id: c.profile.repo_id,
        revision: c.revision,
        mission: c.profile.mission,
        usage_mode: c.profile.routing.usage_mode,
        operations: c.profile.grants[c.principal].filter((op) => c.host.operations.includes(op))
      }
    );
  }
  function preflight(req) {
    const c = lookup(req, 'preflight');
    if (c.error) return { ready: false, ...c.error };
    const checked = checkInputs(c.profile, c.host, environment, registry),
      report = {
        available: true,
        repo_id: c.profile.repo_id,
        revision: c.revision,
        ready: checked.findings.every((f) => f.status === 'passed'),
        findings: checked.findings,
        report_id: crypto.randomUUID(),
        checked_at: new Date(now()).toISOString(),
        expires_at: new Date(now() + leaseSeconds * 1000).toISOString()
      };
    try {
      report.lease = sign({
        version: 1,
        principal: c.principal,
        repo_id: c.profile.repo_id,
        revision: c.revision,
        host: digest(c.host),
        facts: digest(checked.facts),
        expires: now() + leaseSeconds * 1000
      });
      atomic(path.join(historyDir(c.principal, c.profile.repo_id), report.report_id + '.json'), report);
    } catch {
      delete report.lease;
      report.report_id = null;
      report.ready = false;
      report.findings.push(
        finding(
          'history',
          'evidence_not_durable',
          'Preflight report could not be persisted privately.',
          'Restore private registry history access before starting work.',
          true
        )
      );
    }
    return report;
  }
  function authorize(lease, operation) {
    if (!['execute', 'publish'].includes(operation))
      return {
        allowed: false,
        findings: [
          finding(
            'authority',
            'invalid_operation',
            'Unsupported protected operation.',
            'Use the host-defined execute or publish operation.'
          )
        ]
      };
    let value, principal;
    try {
      principal = identity();
      value = decode(lease, principal);
    } catch {
      return {
        allowed: false,
        findings: [
          finding(
            'lease',
            'invalid_lease',
            'Lease is invalid, expired or belongs to another caller.',
            'Run a fresh authorised preflight.'
          )
        ]
      };
    }
    const c = lookup({ repo_id: value.repo_id }, 'read', principal);
    if (c.error?.findings?.some((f) => f.code === 'host_capabilities_unavailable'))
      return { allowed: false, findings: c.error.findings };
    if (c.error)
      return {
        allowed: false,
        findings: [
          finding(
            'authority',
            'permission_revoked',
            'Current caller access is unavailable.',
            'Ask the owner to restore the required grant; historical access is separately authorised.'
          )
        ]
      };
    if (
      !c.profile.grants[c.principal]?.includes(operation) ||
      !c.host.operations.includes(operation) ||
      (operation === 'publish' && !c.profile.publication.allowed)
    )
      return {
        allowed: false,
        findings: [
          finding(
            'authority',
            'permission_revoked',
            'The current caller/repository/host intersection denies this operation.',
            'Owner must explicitly approve the operation; no scope or credential override is accepted.'
          )
        ]
      };
    const checked = checkInputs(c.profile, c.host, environment, registry);
    if (c.revision !== value.revision || digest(c.host) !== value.host || digest(checked.facts) !== value.facts)
      return {
        allowed: false,
        findings: [
          finding(
            'profile',
            'stale_profile',
            'Profile, host capability or pinned runtime input changed after preflight.',
            'Run preflight against the new owner-approved configuration.'
          )
        ]
      };
    return {
      allowed: checked.findings.every((f) => f.status === 'passed'),
      findings: checked.findings
    };
  }
  function withAuthorized(lease, operation, transition) {
    demand(typeof transition === 'function', 'Trusted synchronous transition required');
    return locked(registry, () => {
      if (lockTool && fs.existsSync(path.join(registry, '.migration-v2.json'))) {
        const migration = JSON.parse(fs.readFileSync(privatePath(path.join(registry, '.migration-v2.json'))));
        if (migration.status !== 'complete') throw new (require('./improve-kernel-lock.cjs').KernelLockError)('recovery_migration_incomplete');
      }
      const result = authorize(lease, operation);
      if (!result.allowed) return result;
      const value = decode(lease),
        record = readProfile(registry, value.repo_id),
        out = transition(record.profile);
      demand(
        !out || typeof out.then !== 'function',
        'Protected transition must synchronously start work; revalidate each later protected operation'
      );
      return { ...result, result: out };
    }, lockTool, fault);
  }
  function withMigration(lease, transition) {
    demand(lockTool && typeof transition === 'function', 'Qualified v2 owner migration required');
    const mode = fs.existsSync(path.join(registry, '.authority-lock', 'kernel-v2.lock')) ? lockTool : null;
    return locked(registry, () => {
      const checked = authorize(lease, 'execute');
      if (!checked.allowed) return checked;
      const value = decode(lease), record = readProfile(registry, value.repo_id), out = transition(record.profile);
      demand(!out || typeof out.then !== 'function', 'Synchronous migration required');
      return { ...checked, result: out };
    }, mode, fault, true);
  }
  function history(req) {
    const c = lookup(req, 'read');
    if (c.error) return c.error;
    const dir = historyDir(c.principal, c.profile.repo_id);
    try {
      if (!fs.existsSync(dir)) return { available: true, reports: [] };
      privatePath(dir, true);
      return {
        available: true,
        reports: fs
          .readdirSync(dir)
          .filter((n) => /^[a-f0-9-]+\.json$/.test(n))
          .sort()
          .map((n) => {
            const report = JSON.parse(fs.readFileSync(privatePath(path.join(dir, n))));
            delete report.lease;
            return report;
          })
      };
    } catch {
      return {
        available: true,
        reports: [],
        findings: [
          finding(
            'history',
            'history_unavailable',
            'Private history cannot be read safely.',
            'Restore owner-private history permissions; do not read another caller’s records.'
          )
        ]
      };
    }
  }
  return { inspect, preflight, authorize, withAuthorized, withMigration, history };
}
function cli(args = process.argv.slice(2)) {
  try {
    const action = args[0],
      at = args.indexOf('--registry');
    demand(
      at > 0 && args[at + 1],
      'Use profiles <register|inspect|preflight|history> [repo_id] --registry OWNER_PRIVATE_DIR [--file PROFILE.json]'
    );
    const registry = path.resolve(args[at + 1]);
    let result;
    if (action === 'register') {
      const i = args.indexOf('--file');
      demand(i > 0 && args[i + 1] && args.length === 5, 'Owner registration requires --file and --registry only');
      result = registerProfile(registry, JSON.parse(fs.readFileSync(noLinks(path.resolve(args[i + 1])))));
    } else {
      demand(
        ['inspect', 'preflight', 'history'].includes(action) && args.length === 4 && id(args[1]),
        'Invalid profiles request'
      );
      const service = createProfileService({
        registry,
        resolvePrincipal: () => `uid:${process.getuid()}`,
        hostCapabilities: () => ({
          revision: 'local-cli-unqualified-v1',
          operations: ['read', 'preflight'],
          adapters: []
        })
      });
      result = service[action]({ repo_id: args[1] });
      if (result.lease) {
        result.lease_issued = true;
        delete result.lease;
      }
    }
    console.log(JSON.stringify(result, null, 2));
    return result.ready === false || result.available === false ? 2 : 0;
  } catch (error) {
    console.error(
      JSON.stringify({
        status: 'blocked',
        findings: [
          finding(
            'registry',
            'profile_operation_failed',
            error instanceof ProfileError ? error.message : 'Owner profile operation could not be completed safely.',
            'Check the documented owner-private registry and profile schema; never supply secret values in a request.'
          )
        ]
      })
    );
    return 2;
  }
}
module.exports = {
  ProfileError,
  validateProfile,
  registerProfile,
  readProfile,
  createProfileService,
  cli
};
if (require.main === module) process.exitCode = cli();
