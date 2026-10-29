'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');
const cache = require('../../scripts/improve-offline-cache.cjs');
let root, source, output, manifest;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'offline-cache-')); source = path.join(root, 'source'); output = path.join(root, 'output');
  fs.mkdirSync(source); fs.mkdirSync(path.join(source, 'empty'), { mode: 0o755 }); fs.mkdirSync(path.join(source, 'files'), { mode: 0o755 });
  fs.writeFileSync(path.join(source, 'files/data'), 'approved bytes', { mode: 0o644 });
  manifest = { schema: 'specflow.offline-cache/v1', bytes: 14, entryCount: 3, entries: [
    { path: 'empty', kind: 'directory', mode: 0o755 }, { path: 'files', kind: 'directory', mode: 0o755 },
    { path: 'files/data', kind: 'file', mode: 0o644, size: 14,
      sha256: crypto.createHash('sha256').update('approved bytes').digest('hex'),
      sha512: crypto.createHash('sha512').update('approved bytes').digest('hex') }
  ] };
});
afterEach(() => { jest.restoreAllMocks(); fs.rmSync(root, { recursive: true, force: true }); });
test('offline-cache-copy: approved source hardlinks become independent single-link copies with complete empty directories', () => {
  fs.linkSync(path.join(source, 'files/data'), path.join(root, 'other-link'));
  expect(fs.statSync(path.join(source, 'files/data')).nlink).toBe(2);
  expect(cache.copyCache(source, output, manifest)).toEqual({ copiedBytes: 14, entryCount: 3, singleLinkCopies: true });
  expect(fs.readFileSync(path.join(output, 'files/data'), 'utf8')).toBe('approved bytes');
  expect(fs.statSync(path.join(output, 'files/data')).nlink).toBe(1);
  expect(fs.statSync(path.join(output, 'files/data')).ino).not.toBe(fs.statSync(path.join(source, 'files/data')).ino);
  expect(fs.readdirSync(path.join(output, 'empty'))).toEqual([]);
});
test.each(['bytes', 'mode', 'added-file', 'missing-directory', 'symlink', 'privileged-mode'])('offline-input-mutation rejects %s', kind => {
  const file = path.join(source, 'files/data');
  if (kind === 'bytes') fs.writeFileSync(file, 'unapproved!!!!');
  if (kind === 'mode') fs.chmodSync(file, 0o600);
  if (kind === 'added-file') fs.writeFileSync(path.join(source, 'extra'), 'extra');
  if (kind === 'missing-directory') fs.rmdirSync(path.join(source, 'empty'));
  if (kind === 'symlink') { fs.unlinkSync(file); fs.symlinkSync('/etc/passwd', file); }
  if (kind === 'privileged-mode') fs.chmodSync(file, 0o4644);
  expect(() => cache.copyCache(source, output, manifest)).toThrow();
});
test('offline-source-race does not follow a replaced source parent into a canary directory', () => {
  const canary = path.join(root, 'canary'); fs.mkdirSync(canary); fs.writeFileSync(path.join(canary, 'data'), 'canary');
  const open = fs.openSync; let triggered = false, canaryOpened = false;
  jest.spyOn(fs, 'openSync').mockImplementation((file, flags, ...args) => {
    if (String(file).endsWith('/files') && !triggered) {
      triggered = true; fs.renameSync(path.join(source, 'files'), path.join(source, 'old-files')); fs.symlinkSync(canary, path.join(source, 'files'));
    }
    const fd = open(file, flags, ...args);
    if (fs.readlinkSync('/proc/self/fd/' + fd).startsWith(canary + '/')) canaryOpened = true;
    return fd;
  });
  expect(() => cache.copyCache(source, output, manifest)).toThrow(); expect(triggered).toBe(true); expect(canaryOpened).toBe(false);
  expect(fs.readFileSync(path.join(canary, 'data'), 'utf8')).toBe('canary');
});
test('offline-source-race rejects a file changed after opening', () => {
  const read = fs.readSync; let changed = false;
  jest.spyOn(fs, 'readSync').mockImplementation((fd, ...args) => {
    const n = read(fd, ...args);
    if (!changed) { changed = true; fs.writeFileSync(path.join(source, 'files/data'), 'unapproved!!!!'); }
    return n;
  });
  expect(() => cache.copyCache(source, output, manifest)).toThrow('offline_input_changed'); expect(changed).toBe(true);
});
test('offline-cache-copy refuses existing output instead of overwriting it', () => {
  fs.mkdirSync(output); fs.writeFileSync(path.join(output, 'keep'), 'existing');
  expect(() => cache.copyCache(source, output, manifest)).toThrow();
  expect(fs.readFileSync(path.join(output, 'keep'), 'utf8')).toBe('existing');
});
test('offline-cache manifest canonical parser rejects duplicate keys even with the matching byte hash', () => {
  const raw = Buffer.from('{"schema":"wrong","schema":"specflow.offline-cache/v1","entries":[],"bytes":0,"entryCount":0}');
  expect(() => cache.parseManifest(raw, cache.sha256(raw))).toThrow('offline_input_changed');
  const valid = Buffer.from(cache.canonical(manifest)); expect(cache.parseManifest(valid, cache.sha256(valid))).toEqual(manifest);
});

describe('offline acquisition rejects untrusted inputs before creating a worker', () => {
  const { DockerWorker } = require('../../scripts/improve-worker.cjs');
  const { prepareOfflineInputs, validateGraph } = require('../../scripts/improve-offline-inputs.cjs');
  const yaml = require('js-yaml');
  function fixture() {
    const pkg = { dependencies: { example: '^1.0.0' } };
    const lock = { lockfileVersion: '9.0', settings: { autoInstallPeers: true },
      importers: { '.': { dependencies: { example: { specifier: '^1.0.0', version: '1.0.0' } } } },
      packages: { 'example@1.0.0': { resolution: { integrity: 'sha512-' + Buffer.alloc(64).toString('base64') } } },
      snapshots: { 'example@1.0.0': {} } };
    return { pkg, lock };
  }
  test('supported registry graph is accepted; the negative cases are not a permanently failing fixture', () => {
    const { pkg, lock } = fixture(); expect(validateGraph(pkg, lock)).toBe(1);
  });
  const unsupported = ['workspace:*', 'file:../local', 'link:../local', 'git+https://example.invalid/repo',
    'https://example.invalid/package.tgz', 'npm:other@1.0.0'];
  test.each(unsupported)('complete graph rejects unsupported transitive resolution %s', form => {
    const { pkg, lock } = fixture(); lock.snapshots['example@1.0.0'].dependencies = { other: form };
    expect(() => validateGraph(pkg, lock)).toThrow('offline_dependency_unsupported');
  });
  test.each(['package-bytes', 'lock-bytes', 'manifest-bytes', 'tool-bytes', 'layer-identity',
    'tool-version', 'package-manager', 'lock-specifier', 'missing-snapshot', 'duplicate-package-key',
    'duplicate-lock-key', 'duplicate-manifest-key', ...unsupported])('prepareOfflineInputs rejects %s without output or Docker creation', kind => {
    const { pkg, lock } = fixture(); const layerFile = path.join(root, 'tool'); fs.writeFileSync(layerFile, 'pinned tool');
    const layer = { files: [{ source: layerFile, destination: '/node/bin/node', sha256: cache.sha256('pinned tool') }], directories: [] };
    layer.sha256 = cache.sha256(JSON.stringify({ files: layer.files, directories: layer.directories }));
    if (unsupported.includes(kind)) { pkg.dependencies.example = kind; lock.importers['.'].dependencies.example.specifier = kind; }
    if (kind === 'package-manager') pkg.packageManager = 'pnpm@9.0.0';
    if (kind === 'lock-specifier') lock.importers['.'].dependencies.example.specifier = '^2.0.0';
    if (kind === 'missing-snapshot') delete lock.snapshots['example@1.0.0'];
    const write = (name, raw) => { const file = path.join(root, name); fs.writeFileSync(file, raw); return { path: file, sha256: cache.sha256(raw) }; };
    const request = { version: 1, package: write('package.json', kind === 'duplicate-package-key' ? '{"dependencies":{},"dependencies":{}}' : JSON.stringify(pkg)),
      lock: write('pnpm-lock.yaml', yaml.dump(lock) + (kind === 'duplicate-lock-key' ? "lockfileVersion: '9.0'\n" : '')),
      cache: { root: source, manifest: write('manifest.json', kind === 'duplicate-manifest-key' ? '{"schema":1,"schema":2}' : cache.canonical(manifest)) },
      tool: { version: '10.7.1', softwareLayerSha256: layer.sha256 }, platform: 'linux-x64-glibc',
      resourceProfile: 'offline-dependencies-v1', destination: path.join(root, 'capsule') };
    if (kind === 'package-bytes') fs.appendFileSync(request.package.path, ' ');
    if (kind === 'lock-bytes') fs.appendFileSync(request.lock.path, '\n');
    if (kind === 'manifest-bytes') fs.appendFileSync(request.cache.manifest.path, ' ');
    if (kind === 'tool-bytes') fs.writeFileSync(layerFile, 'changed tool');
    if (kind === 'layer-identity') request.tool.softwareLayerSha256 = 'a'.repeat(64);
    if (kind === 'tool-version') request.tool.version = '10.6.0';
    const worker = new DockerWorker({ image: 'sha256:' + 'a'.repeat(64), layer, stateRoot: root, jobId: 'input-negatives' });
    const create = jest.spyOn(worker, 'create').mockImplementation(() => { throw Error('unexpected Docker creation'); });
    let observed;
    try { prepareOfflineInputs(worker, request); } catch (e) { observed = e; }
    expect(observed).toBeDefined(); expect(observed.message).not.toBe('unexpected Docker creation');
    const expectedCode = unsupported.includes(kind) ? 'offline_dependency_unsupported' :
      ['package-manager', 'lock-specifier', 'missing-snapshot', 'duplicate-lock-key'].includes(kind) ? 'offline_lock_mismatch' :
        kind === 'tool-bytes' ? 'runtime_input_changed' : kind === 'duplicate-package-key' ? 'duplicate_json_key' : 'offline_input_changed';
    expect(observed.code).toBe(expectedCode);
    expect(create).not.toHaveBeenCalled(); expect(fs.existsSync(request.destination)).toBe(false);
  });
});
