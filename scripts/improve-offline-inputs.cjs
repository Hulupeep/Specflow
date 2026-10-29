'use strict';
const fs = require('fs'), path = require('path'), yaml = require('js-yaml');
const cache = require('./improve-offline-cache.cjs');
const { WorkerError, strictJSON, verifySoftwareLayer, OFFLINE_RESOURCE_PROFILE } = require('./improve-worker.cjs');
const CONFIG = Object.freeze({ cwd: '/work', argv: ['/node/bin/node', '/tools/pnpm/bin/pnpm.cjs', 'install',
  '--offline', '--frozen-lockfile', '--ignore-scripts', '--ignore-pnpmfile', '--package-import-method=copy', '--store-dir=/cache'],
  env: { CI: 'true', HOME: '/tmp', PATH: '/node/bin:/usr/bin:/bin', NPM_CONFIG_USERCONFIG: '/dev/null', NPM_CONFIG_GLOBALCONFIG: '/dev/null' } });
const IMPLEMENTATION = ['improve-offline-inputs.cjs', 'improve-offline-cache.cjs', 'improve-worker.cjs',
  'improve-worker-capsule.py', 'improve-worker-store.py', 'improve-worker-watchdog.cjs'];
const hash = value => cache.sha256(Buffer.from(cache.canonical(value)));
function need(ok, code = 'offline_input_changed') { if (!ok) throw new WorkerError(code, 'offline'); }
function object(value) { return value && typeof value === 'object' && !Array.isArray(value); }
function exact(value, keys) { need(object(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|')); }
function validateGraph(pkg, lock) {
  const unsupported = 'offline_dependency_unsupported', mismatch = 'offline_lock_mismatch';
  need(object(pkg) && object(lock), mismatch);
  need(String(lock.lockfileVersion) === '9.0' && Object.keys(lock).every(k =>
    ['lockfileVersion', 'settings', 'importers', 'packages', 'snapshots'].includes(k)), unsupported);
  need(object(lock.importers) && Object.keys(lock.importers).join() === '.', unsupported);
  need(object(lock.settings || {}) && Object.entries(lock.settings || {}).every(([k, v]) =>
    ['autoInstallPeers', 'excludeLinksFromLockfile'].includes(k) && typeof v === 'boolean'), unsupported);
  need(!['pnpm', 'workspaces', 'overrides', 'resolutions'].some(k => Object.hasOwn(pkg, k)), unsupported);
  need((pkg.packageManager ?? 'pnpm@10.7.1') === 'pnpm@10.7.1', mismatch);
  const groups = ['dependencies', 'devDependencies', 'optionalDependencies'], importer = lock.importers['.'];
  const packages = lock.packages || {}, snapshots = lock.snapshots || {};
  need(object(importer) && Object.keys(importer).every(k => groups.includes(k)) && object(packages) && object(snapshots), unsupported);
  const form = version => need(typeof version === 'string' && !/[:\\]/.test(version) && !version.split('(')[0].includes('/'), unsupported);
  const edge = (name, version) => { form(version); const key = name + '@' + version;
    need(Object.hasOwn(snapshots, key) && Object.hasOwn(packages, key.split('(')[0]), mismatch); };
  for (const group of groups) {
    const declared = pkg[group] || {}, locked = importer[group] || {};
    need(object(declared) && object(locked), mismatch);
    need(Object.keys(declared).sort().join('|') === Object.keys(locked).sort().join('|'), mismatch);
    for (const [name, spec] of Object.entries(declared)) {
      form(spec); need(/^[0-9~^<>=*xXv. +|\-]+$/.test(spec), unsupported);
      const row = locked[name]; need(object(row) && Object.keys(row).sort().join('|') === 'specifier|version', unsupported);
      need(row.specifier === spec, mismatch); edge(name, row.version);
    }
  }
  for (const [key, p] of Object.entries(packages)) {
    need(!key.includes(':') && !key.split('@').at(-1).includes('/') && object(p) && object(p.resolution) &&
      Object.keys(p.resolution).join() === 'integrity' && /^sha512-[A-Za-z0-9+/]{86}==$/.test(p.resolution.integrity), unsupported);
  }
  for (const [key, s] of Object.entries(snapshots)) {
    need(Object.hasOwn(packages, key.split('(')[0]), mismatch);
    need(object(s) && Object.keys(s).every(k => ['dependencies', 'optionalDependencies', 'transitivePeerDependencies', 'optional'].includes(k)), unsupported);
    for (const group of ['dependencies', 'optionalDependencies']) {
      need(object(s[group] || {}), unsupported);
      for (const [name, version] of Object.entries(s[group] || {})) edge(name, version);
    }
  }
  return Object.keys(snapshots).length;
}
function reference(base, ref, limit) {
  exact(ref, ['path', 'sha256']); need(typeof ref.path === 'string' && /^[a-f0-9]{64}$/.test(ref.sha256));
  const file = path.resolve(base, ref.path), bytes = cache.readRegular(file, limit);
  need(cache.sha256(bytes) === ref.sha256); return bytes;
}
function implementationIdentity() {
  return hash(Object.fromEntries(IMPLEMENTATION.map(f => ['scripts/' + f, cache.sha256(cache.readRegular(path.join(__dirname, f)))])));
}
function prepareOfflineInputs(worker, request, { base = process.cwd() } = {}) {
  exact(request, ['version', 'package', 'lock', 'cache', 'tool', 'platform', 'resourceProfile', 'destination']);
  exact(request.cache, ['root', 'manifest']); exact(request.tool, ['version', 'softwareLayerSha256']);
  need(request.version === 1 && request.platform === 'linux-x64-glibc' && request.tool.version === '10.7.1');
  need(request.resourceProfile === OFFLINE_RESOURCE_PROFILE.id, 'offline_resource_invalid');
  need(path.isAbsolute(request.destination) && path.normalize(request.destination) === request.destination);
  worker.capsuleLocation(request.destination); need(!fs.existsSync(request.destination));
  const pkgBytes = reference(base, request.package, 8 * 1024 * 1024), lockBytes = reference(base, request.lock, 8 * 1024 * 1024);
  const manifestBytes = reference(base, request.cache.manifest, cache.LIMITS.manifestBytes);
  const manifest = cache.parseManifest(manifestBytes, request.cache.manifest.sha256);
  const pkg = strictJSON(pkgBytes.toString()); let lock;
  try { lock = yaml.load(lockBytes.toString(), { schema: yaml.JSON_SCHEMA }); } catch { throw new WorkerError('offline_lock_mismatch', 'offline'); }
  validateGraph(pkg, lock); verifySoftwareLayer(worker.layer);
  need(worker.layer.sha256 === request.tool.softwareLayerSha256 &&
    cache.sha256(JSON.stringify({ files: worker.layer.files, directories: worker.layer.directories })) === worker.layer.sha256);
  const implementationSha256 = implementationIdentity();
  const preimage = { schema: 'specflow.offline-recipe/v1', packageSha256: request.package.sha256, lockSha256: request.lock.sha256,
    cacheManifestSha256: request.cache.manifest.sha256, softwareLayerSha256: worker.layer.sha256, implementationSha256,
    toolVersion: request.tool.version, platform: request.platform, effectiveConfigSha256: hash(CONFIG), resourceProfileSha256: hash(OFFLINE_RESOURCE_PROFILE) };
  const recipeSha256 = hash(preimage), area = fs.mkdtempSync(path.join(worker.stateRoot, 'offline-'));
  fs.chmodSync(area, 0o700);
  const put = (name, bytes) => { const f = path.join(area, name); fs.writeFileSync(f, bytes, { mode: 0o600, flag: 'wx' }); return f; };
  const manifestFile = put('cache.json', manifestBytes), pkgFile = put('package.json', pkgBytes), lockFile = put('pnpm-lock.yaml', lockBytes);
  put('identity.json', cache.canonical(preimage));
  let id;
  const exec = (argv, options = {}) => worker.exec(id, argv, { cwd: CONFIG.cwd, env: CONFIG.env, ...options });
  const record = (name, r) => {
    put(name + '.stdout', r.stdout || ''); put(name + '.stderr', r.stderr || '');
    put(name + '.json', JSON.stringify({ status: r.status, signal: r.signal || null, error: r.error?.code || null }));
  };
  const checkResult = (r, fallback = 'offline_install_failed') => {
    if (r.status === 0) return;
    const text = (r.stdout || '') + (r.stderr || ''); let code = fallback;
    if (fallback === 'offline_install_failed' && /ERR_PNPM_NO_OFFLINE_(TARBALL|META)\b/.test(text)) code = 'offline_cache_miss';
    else if (/\bENOSPC\b/.test(text)) code = 'offline_resource_exhausted';
    // Exit 137 alone cannot distinguish a resource failure from external termination.
    // Inspect this exact owned container; a daemon/transport error is not proof of either.
    const observed = worker.call(['inspect', id], { allowFailure: true, timeout: 10000 });
    if (observed.status === 0) {
      let state; try { state = JSON.parse(observed.stdout)[0]?.State; } catch { /* retain original diagnostic */ }
      if (state?.OOMKilled === true) code = 'offline_resource_exhausted';
      else if (state?.Running === false) code = 'offline_interrupted';
    } else if (/No such (object|container)/i.test(observed.stderr || '')) code = 'offline_interrupted';
    throw new WorkerError(code, 'offline', code, true, 'Inspect the private acquisition diagnostic.');
  };
  try {
    id = worker.create({ role: 'setup', resourceProfile: request.resourceProfile, mounts: [
      { source: request.cache.root, destination: '/source-cache' }, { source: manifestFile, destination: '/inputs/cache.json' },
      { source: path.join(__dirname, 'improve-offline-cache.cjs'), destination: '/inputs/copy.cjs' }] });
    exec(['/node/bin/node', '-e', "require('fs').mkdirSync('/work/store',{mode:0o700})"]);
    const copied = exec(['/node/bin/node', '/inputs/copy.cjs', '/inputs/cache.json', request.cache.manifest.sha256,
      '/source-cache', '/work/store/v10'], { allowFailure: true }); record('copy', copied);
    checkResult(copied, 'offline_input_changed');
    worker.pause(id);
    const store = worker.captureCapsule(id, '/work/store', path.join(area, 'store'), { recipeSha256, sourceInputSha256: request.cache.manifest.sha256 });
    // Compare every admitted file/directory against the approved copy, not just the copier's exit code.
    const actual = strictJSON(cache.readRegular(path.join(store.target, 'manifest.json')).toString());
    const expected = [{ path: 'v10', kind: 'directory', mode: 0o700 }, ...manifest.entries.map(({ sha512, ...e }) => ({ ...e, path: 'v10/' + e.path }))];
    need(hash(actual.entries) === hash(expected) && actual.bytes === manifest.bytes);
    worker.destroy(id); id = undefined;
    const receipt = { identity: store.identity, manifestSha256: store.manifestSha256 };
    id = worker.create({ role: 'setup', resourceProfile: request.resourceProfile,
      capsules: [{ target: store.target, expected: receipt, destination: '/cache' }], mounts: [
        { source: pkgFile, destination: '/inputs/package.json' }, { source: lockFile, destination: '/inputs/pnpm-lock.yaml' }] });
    exec(['/node/bin/node', '-e', "const f=require('fs');f.copyFileSync('/inputs/package.json','/work/package.json');f.copyFileSync('/inputs/pnpm-lock.yaml','/work/pnpm-lock.yaml')"]);
    const version = exec(['/node/bin/node', '/tools/pnpm/bin/pnpm.cjs', '--version']); need(version.stdout.trim() === request.tool.version);
    const installed = exec(CONFIG.argv, { allowFailure: true }); record('install', installed); checkResult(installed);
    need(implementationIdentity() === implementationSha256); verifySoftwareLayer(worker.layer);
    worker.pause(id);
    const capsule = worker.captureCapsule(id, '/work/node_modules', request.destination, { recipeSha256,
      sourceInputSha256: hash({ packageSha256: request.package.sha256, lockSha256: request.lock.sha256, manifestSha256: store.manifestSha256 }) });
    return { status: 'admitted', recipeSha256, capsule: { identity: capsule.identity, manifestSha256: capsule.manifestSha256 } };
  } catch (e) {
    if (e.code === 'worker_deadline') throw new WorkerError('offline_interrupted', 'offline');
    throw e;
  } finally { if (id !== undefined) worker.destroy(id); }
}
module.exports = { prepareOfflineInputs, validateGraph, CONFIG, implementationIdentity };
