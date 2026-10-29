'use strict';
// Low-level filesystem acceptance; real Docker authority is a separate integration gate.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const helper = path.resolve(__dirname, '../../scripts/improve-worker-capsule.py');
const crypto = require('crypto');
let root, source, target;
const identity = {
  jobId: 'capsule-fixture', sourceContainerId: 'c'.repeat(64),
  recipeSha256: 'a'.repeat(64), sourceInputSha256: 'b'.repeat(64)
};
function call(action, request) {
  const r = spawnSync('/usr/bin/python3', [helper, action], {
    input: JSON.stringify(request), encoding: 'utf8', timeout: 20000,
    env: { PATH: '/usr/bin:/bin', HOME: '/nonexistent' }
  });
  let output;
  try { output = JSON.parse(r.stdout); } catch { throw Error(`Capsule helper did not return JSON: ${r.stderr}`); }
  return { code: r.status, output };
}
function seal(extra = {}) { return call('seal', { source, target, identity, ...extra }); }
function verify(receipt, extra = {}) {
  return call('verify', { target, expected: { identity, manifestSha256: receipt.manifestSha256 }, ...extra });
}
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'capsule-contract-'));
  source = path.join(root, 'source'); target = path.join(root, 'capsule');
  fs.mkdirSync(source, { mode: 0o700 }); fs.writeFileSync(path.join(source, 'value'), 'actual bytes');
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
test('capsule-round-trip preserves bytes, empty directories, executable modes and internal links', () => {
  fs.mkdirSync(path.join(source, 'empty'));
  fs.mkdirSync(path.join(source, 'bin'));
  fs.writeFileSync(path.join(source, 'bin/tool'), 'fixture, never executed', { mode: 0o755 });
  fs.symlinkSync('bin/tool', path.join(source, 'tool'));
  const r = seal(); expect(r.code).toBe(0); expect(r.output.status).toBe('admitted');
  const tree = path.join(target, 'tree');
  expect(fs.readFileSync(path.join(tree, 'value'), 'utf8')).toBe('actual bytes');
  expect(fs.readdirSync(path.join(tree, 'empty'))).toEqual([]);
  expect(fs.statSync(path.join(tree, 'bin/tool')).mode & 0o777).toBe(0o755);
  expect(fs.readlinkSync(path.join(tree, 'tool'))).toBe('bin/tool');
  expect(verify(r.output).code).toBe(0);
});
test.each(['absolute', 'escape', 'dangling', 'cycle', 'ancestor', 'hardlink', 'privileged', 'fifo'])(
  'capsule-unsafe-graph rejects %s without admitting output or changing the canary', kind => {
    const canary = path.join(root, 'canary'); fs.writeFileSync(canary, 'unchanged');
    if (kind === 'absolute') fs.symlinkSync(canary, path.join(source, 'bad'));
    if (kind === 'escape') fs.symlinkSync('../canary', path.join(source, 'bad'));
    if (kind === 'dangling') fs.symlinkSync('absent', path.join(source, 'bad'));
    if (kind === 'cycle') { fs.symlinkSync('b', path.join(source, 'a')); fs.symlinkSync('a', path.join(source, 'b')); }
    if (kind === 'ancestor') fs.symlinkSync('.', path.join(source, 'bad'));
    if (kind === 'hardlink') fs.linkSync(canary, path.join(source, 'bad'));
    if (kind === 'privileged') fs.chmodSync(path.join(source, 'value'), 0o4755);
    if (kind === 'fifo') expect(spawnSync('/usr/bin/mkfifo', [path.join(source, 'fifo')]).status).toBe(0);
    const r = seal(); expect(r.code).not.toBe(0); expect(r.output.error).toMatch(/^capsule_/);
    expect(fs.existsSync(target)).toBe(false); expect(fs.readFileSync(canary, 'utf8')).toBe('unchanged');
  }
);
test.each(['bytes', 'mode', 'link', 'missing', 'extra'])(
  'capsule-mutation rejects changed %s before use', kind => {
    fs.symlinkSync('value', path.join(source, 'alias'));
    const r = seal(); expect(r.code).toBe(0); const tree = path.join(target, 'tree');
    if (kind === 'bytes') fs.writeFileSync(path.join(tree, 'value'), 'changed');
    if (kind === 'mode') fs.chmodSync(path.join(tree, 'value'), 0o755);
    if (kind === 'link') { fs.unlinkSync(path.join(tree, 'alias')); fs.symlinkSync('/etc/passwd', path.join(tree, 'alias')); }
    if (kind === 'missing') fs.unlinkSync(path.join(tree, 'value'));
    if (kind === 'extra') fs.writeFileSync(path.join(tree, 'extra'), 'unbound');
    expect(verify(r.output).code).not.toBe(0);
  }
);
test('capsule-resource-limits rejects excess bytes without admission', () => {
  const r = seal({ limits: { maxBytes: 3 } }); expect(r.code).not.toBe(0);
  expect(fs.existsSync(target)).toBe(false);
});
test.each([
  { maxFileBytes: 3 }, { maxEntries: 1 }, { maxDepth: 1 },
  { maxBytes: -1 }, { maxBytes: true }, { maxBytes: 1.5 }, { maxBytes: 3 * 1024 ** 3 }
])('capsule-resource-limits rejects breached or invalid profile %j', limits => {
  fs.mkdirSync(path.join(source, 'nested/deep'), { recursive: true });
  fs.writeFileSync(path.join(source, 'nested/deep/data'), 'more data');
  expect(seal({ limits }).code).not.toBe(0); expect(fs.existsSync(target)).toBe(false);
});
test('capsule-worker-authority prepare creates no admitted target; trusted admission verifies the staged identity', () => {
  const prepared = call('prepare', { source, target, identity }); expect(prepared.code).toBe(0);
  expect(prepared.output.status).toBe('staged'); expect(fs.existsSync(target)).toBe(false);
  const expected = { identity, manifestSha256: prepared.output.manifestSha256 };
  expect(call('admit', { target, expected: { ...expected, identity: { ...identity, jobId: 'wrong' } }, stageName: prepared.output.stageName }).code).not.toBe(0);
  expect(fs.existsSync(target)).toBe(false);
  const admitted = call('admit', { target, expected, stageName: prepared.output.stageName });
  expect(admitted.code).toBe(0); expect(verify(admitted.output).code).toBe(0);
});
test('capsule-no-replace retries the same complete identity but cannot overwrite conflicting data', () => {
  const first = seal(); expect(first.code).toBe(0);
  const again = seal(); expect(again.code).toBe(0);
  expect(again.output.manifestSha256).toBe(first.output.manifestSha256);
  fs.writeFileSync(path.join(source, 'value'), 'different');
  expect(seal().code).not.toBe(0);
  expect(fs.readFileSync(path.join(target, 'tree/value'), 'utf8')).toBe('actual bytes');
});
test('capsule-worker-authority low-level receipt rejects wrong job or expected manifest digest', () => {
  const r = seal(); expect(r.code).toBe(0);
  expect(verify(r.output, { expected: { identity: { ...identity, jobId: 'other' }, manifestSha256: r.output.manifestSha256 } }).code).not.toBe(0);
  expect(verify(r.output, { expected: { identity, manifestSha256: '0'.repeat(64) } }).code).not.toBe(0);
});
test.each(['whitespace', 'duplicate-key', 'float-count', 'boolean-mode'])(
  'capsule-canonical-manifest rejects %s even with a matching supplied digest', kind => {
    const r = seal(); expect(r.code).toBe(0);
    const file = path.join(target, 'manifest.json'); let raw = fs.readFileSync(file, 'utf8');
    if (kind === 'whitespace') raw += '\n';
    if (kind === 'duplicate-key') raw = raw.replace('"entryCount":1', '"entryCount":1,"entryCount":1');
    if (kind === 'float-count') raw = raw.replace('"entryCount":1', '"entryCount":1.0');
    if (kind === 'boolean-mode') raw = raw.replace(/"mode":\d+/, '"mode":true');
    fs.writeFileSync(file, raw);
    const manifestSha256 = crypto.createHash('sha256').update(raw).digest('hex');
    fs.writeFileSync(path.join(target, 'receipt.json'), JSON.stringify({ identity, manifestSha256 }));
    expect(verify({ manifestSha256 }).code).not.toBe(0);
  }
);
