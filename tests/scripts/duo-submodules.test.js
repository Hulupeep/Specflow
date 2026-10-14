const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { fixture } = require('../helpers/duo-action-fixture.cjs');
const duo = require('../../scripts/duo-build.cjs');
let f;
const sha = '1234567890123456789012345678901234567890';
const marker = 'web/.specflow-gitlink.json';
const gitAt = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString().trim();
function link(name = 'web', oid = sha) { f.git('update-index', '--add', '--cacheinfo', `160000,${oid},${name}`); }
function initialize(name = 'web', addRootLink = true) {
  const dir = path.join(f.root, name); fs.mkdirSync(dir, { recursive: true });
  gitAt(dir, 'init'); gitAt(dir, 'config', 'user.email', 'fixture@example.test'); gitAt(dir, 'config', 'user.name', 'Fixture');
  f.put(`${name}/index.js`, 'module.exports = 1;'); gitAt(dir, 'add', '.'); gitAt(dir, 'commit', '-m', 'child fixture');
  if (addRootLink) link(name, gitAt(dir, 'rev-parse', 'HEAD')); return dir;
}
beforeEach(() => { f = fixture(); });
afterEach(() => f.close());
test('missing and empty uninitialized gitlinks remain explicit, fingerprinted unavailable dependencies', () => {
  link();
  const missing = duo.manifest(f.root);
  expect(JSON.parse(missing[marker].virtual)).toMatchObject({ path: 'web', indexCommit: sha, initialized: false, sourceAvailable: false });
  const before = duo.fingerprint(f.root);
  fs.mkdirSync(path.join(f.root, 'web'));
  expect(duo.manifest(f.root)).toEqual(missing);
  link('web', 'abcdefabcdefabcdefabcdefabcdefabcdefabcd');
  expect(duo.fingerprint(f.root)).not.toBe(before);
});
test('initialized source and dirty/untracked edits are frozen recursively; credentials stay excluded', () => {
  const child = initialize();
  f.put('web/.env', 'TOKEN=never-copy-fixture'); f.put('web/untracked.js', 'new code');
  const entries = duo.manifest(f.root);
  expect(entries['web/index.js']).toBeDefined(); expect(entries['web/untracked.js']).toBeDefined();
  expect(entries['web/.env']).toBeUndefined();
  expect(JSON.parse(entries[marker].virtual)).toMatchObject({ initialized: true, sourceAvailable: true, headCommit: gitAt(child, 'rev-parse', 'HEAD') });
  const before = duo.fingerprint(f.root); f.put('web/index.js', 'module.exports = 2;');
  expect(duo.fingerprint(f.root)).not.toBe(before);
});
test('full review copies virtual gitlink metadata and validates the resulting frozen tree', () => {
  link(); f.put('display.cjs', 'console.log(42)');
  const evidence = f.capture();
  const state = f.review(f.batch(evidence), f.peer((result, req, opts) => {
    expect(req.submodules).toEqual([{ path: 'web', evidence: marker, sourceAvailable: false }]);
    expect(req.requiredReads).toContain(`tree/${marker}`);
    expect(JSON.parse(fs.readFileSync(path.join(opts.cwd, 'tree', marker)))).toMatchObject({ indexCommit: sha, sourceAvailable: false });
  }));
  expect(state.outcome).toBe('accepted');
});
test('nested gitlinks retain both identities and real nested source', () => {
  const child = initialize();
  const nested = initialize('web/nested', false);
  gitAt(child, 'update-index', '--add', '--cacheinfo', `160000,${gitAt(nested, 'rev-parse', 'HEAD')},nested`);
  const entries = duo.manifest(f.root);
  expect(entries['web/nested/index.js']).toBeDefined();
  expect(JSON.parse(entries['web/nested/.specflow-gitlink.json'].virtual).path).toBe('web/nested');
  expect(entries[marker]).toBeDefined();
});
test('a different checked-out commit and staged-only edit change the fingerprint', () => {
  const child = initialize(), first = duo.fingerprint(f.root);
  gitAt(child, 'commit', '--allow-empty', '-m', 'new child revision');
  const second = duo.fingerprint(f.root); expect(second).not.toBe(first);
  f.put('web/index.js', 'staged version'); gitAt(child, 'add', 'index.js');
  f.put('web/index.js', 'module.exports = 1;');
  expect(duo.fingerprint(f.root)).not.toBe(second);
});
test('deleted child source disappears from the frozen tree and invalidates prior evidence', () => {
  initialize(); const before = duo.fingerprint(f.root);
  fs.unlinkSync(path.join(f.root, 'web/index.js'));
  expect(duo.manifest(f.root)['web/index.js']).toBeUndefined();
  expect(duo.fingerprint(f.root)).not.toBe(before);
});
test('nonempty uninitialized source is rejected instead of silently discarded', () => {
  link(); f.put('web/unreviewed.js', 'do not hide me');
  expect(() => duo.manifest(f.root)).toThrow('Nonempty uninitialized submodule');
});
test('symlinked submodules and child source are refused', () => {
  link(); fs.symlinkSync(f.root, path.join(f.root, 'web'));
  expect(() => duo.manifest(f.root)).toThrow('Symlink unsupported');
  fs.unlinkSync(path.join(f.root, 'web')); initialize();
  fs.symlinkSync(path.join(f.root, 'goal.md'), path.join(f.root, 'web/leak'));
  expect(() => duo.manifest(f.root)).toThrow('Symlink unsupported');
});
test('reserved marker collisions are rejected even when ignored by Git', () => {
  initialize(); f.put('web/.gitignore', '.specflow-gitlink.json\n');
  f.put(marker, 'actual source must never be overwritten');
  expect(() => duo.manifest(f.root)).toThrow('Reserved snapshot metadata path');
});
test.each(['tracked-child', 'ignored-marker', 'submodule'])('dangling symlink %s fails closed', kind => {
  if (kind === 'submodule') {
    link(); fs.symlinkSync('/missing-fixture-path', path.join(f.root, 'web'));
  } else {
    const child = initialize();
    const name = kind === 'ignored-marker' ? '.specflow-gitlink.json' : 'dangling.js';
    if (kind === 'ignored-marker') f.put('web/.gitignore', `${name}\n`);
    fs.symlinkSync('/missing-fixture-path', path.join(child, name));
    if (kind === 'tracked-child') gitAt(child, 'add', name);
  }
  expect(() => duo.manifest(f.root)).toThrow('Symlink unsupported');
});
test('unmerged gitlinks fail closed rather than choosing one revision', () => {
  execFileSync('git', ['update-index', '--index-info'], { cwd: f.root, input: `160000 ${sha} 1\tweb\n160000 ${sha} 2\tweb\n`, stdio: ['pipe', 'pipe', 'pipe'] });
  expect(() => duo.manifest(f.root)).toThrow('Unmerged index entry: web');
});
test('sensitive explicit evidence is still refused inside submodules', () => {
  initialize(); f.put('web/.env', 'TOKEN=never-copy-fixture');
  expect(() => duo.manifest(f.root, ['web/.env'])).toThrow('Sensitive file');
  expect(JSON.parse(duo.manifest(f.root)[marker].virtual).omittedPaths).toContain('web/.env');
});
test.each(['source', 'frozen'])('review rejects %s submodule changes after capture', target => {
  initialize(); f.put('display.cjs', 'console.log(42)'); const evidence = f.capture();
  const state = f.review(f.batch(evidence), f.peer((result, req, opts) => {
    const file = target === 'source' ? path.join(f.root, 'web/index.js') : path.join(opts.cwd, 'tree', marker);
    fs.writeFileSync(file, 'changed during review');
  }));
  expect(state.outcome).toBe('blocked');
  expect(state.blocker).toMatch(target === 'source' ? /Source changed during review/ : /snapshot modified/);
});
