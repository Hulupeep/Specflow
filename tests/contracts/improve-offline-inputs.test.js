'use strict';
const worker = require('../../scripts/improve-worker.cjs');

describe('offline resource admission', () => {
  test('legacy resources retain defaults and the per-mount ceiling', () => {
    expect(worker.resourcePlan()).toEqual({ memory: 768 * 1024 * 1024, tmpfs: [] });
    expect(() => worker.resourcePlan({ tmpfs: [{ path: '/work', bytes: 257 * 1024 * 1024 }] }))
      .toThrow('worker_tmpfs_invalid');
  });
  test('the named setup profile selects a bounded larger work area', () => {
    expect(worker.resourcePlan({ role: 'setup', resourceProfile: 'offline-dependencies-v1' })).toEqual({
      memory: 2147483648, tmpfs: [{ path: '/work', bytes: 1073741824 }], phaseMilliseconds: 600000
    });
    const p = worker.OFFLINE_RESOURCE_PROFILE;
    expect(p.aggregateTmpfsBytes).toBe(p.workBytes + p.tmpBytes);
    expect(p.aggregateTmpfsBytes).toBeLessThan(p.memoryBytes);
  });
  test.each([
    { resourceProfile: 'unknown' }, { role: 'app' }, { memory: Infinity },
    { memory: 2147483648 }, { cpus: Infinity }, { tmpfs: null }, { tmpfs: [{ path: '/extra', bytes: 1 }] }
  ])('profile rejects overrides before probing Docker: %j', change => {
    const probe = jest.spyOn(worker.DockerWorker, 'probe').mockImplementation(() => { throw Error('unexpected probe'); });
    try {
      expect(() => worker.DockerWorker.prototype.create.call({}, {
        role: 'setup', resourceProfile: 'offline-dependencies-v1', ...change
      })).toThrow('offline_resource_invalid');
      expect(probe).not.toHaveBeenCalled();
    } finally { probe.mockRestore(); }
  });
  test.each([NaN, Infinity, -1, 0, 1.5, true])('invalid legacy memory cannot reach Docker: %s', memory => {
    expect(() => worker.resourcePlan({ memory })).toThrow('worker_memory_invalid');
  });
  test.each([
    [{ role: 'setup', resourceProfile: 'offline-dependencies-v1',
      mounts: [{ source: '/approved/input', destination: '/tmp' }] }, 'offline_resource_invalid'],
    [{ role: 'setup', resourceProfile: 'offline-dependencies-v1',
      mounts: [{ source: '/approved/input', destination: '/work/child' }] }, 'offline_resource_invalid'],
    [{ role: 'setup', resourceProfile: 'offline-dependencies-v1',
      mounts: [{ source: '/approved/cache', destination: '/cache', writable: true }] }, 'offline_resource_invalid'],
    [{ memory: Infinity }, 'worker_memory_invalid'],
    [{ tmpfs: [{ path: '/work', bytes: 1073741824 }] }, 'worker_tmpfs_invalid']
  ])('create rejects unsafe configuration before docker run: %j', (options, code) => {
    const subject = Object.create(worker.DockerWorker.prototype);
    subject.layer = { files: [], directories: [] };
    subject.call = jest.fn(() => { throw Error('unexpected Docker call'); });
    const probe = jest.spyOn(worker.DockerWorker, 'probe').mockImplementation(() => {});
    try {
      expect(() => subject.create(options)).toThrow(code);
      expect(subject.call).not.toHaveBeenCalled();
    } finally { probe.mockRestore(); }
  });
  test('disjoint paths with common prefixes are permitted', () => {
    expect(worker.validateMountTopology(['/tmp', '/node/bin/node', '/tools/pnpm', '/cache', '/work', '/worker'])).toBe(true);
  });
  test.each([
    ['/work', '/work'], ['/tools/pnpm', '/tools'], ['/tmp', '/tmp/cache'],
    ['/node', '/node/bin/node'], ['/work/'], ['//work'], ['/work/../tools'],
    ['/work/./cache'], ['work'], ['/'], ['/work\\cache'], ['/work,ro']
  ])('rejects shadowing/noncanonical destinations: %j', (...paths) => {
    expect(() => worker.validateMountTopology(paths)).toThrow('offline_resource_invalid');
  });
});

function inspection() {
  const expected = { image: 'sha256:' + 'a'.repeat(64), uid: 1000, network: 'none', memory: 2147483648,
    mounts: [{ source: '/approved/cache', destination: '/source-cache', writable: false }],
    tmpfs: ['/tmp', '/work'], tmpfsLimits: {
      '/tmp': { bytes: 134217728, mode: '1777' },
      '/work': { bytes: 1073741824, mode: '0700', uid: 1000, gid: 1000 }
    } };
  const actual = { Image: expected.image, Config: { User: '1000:1000' },
    HostConfig: { ReadonlyRootfs: true, Privileged: false, CapDrop: ['ALL'], CapAdd: [],
      PidsLimit: 128, Memory: expected.memory, MemorySwap: expected.memory, NanoCpus: 1000000000,
      SecurityOpt: ['no-new-privileges'], NetworkMode: 'none', PidMode: '', IpcMode: 'private',
      Tmpfs: { '/tmp': 'rw,nosuid,nodev,size=128m,mode=1777',
        '/work': 'rw,nosuid,nodev,size=1073741824,mode=0700,uid=1000,gid=1000' } },
    Mounts: [{ Type: 'bind', Source: '/approved/cache', Destination: '/source-cache', RW: false }] };
  return { expected, actual };
}
describe('offline observed isolation', () => {
  test('accepts inspected exact sizes, modes and read-only source bind', () => {
    const { actual, expected } = inspection();
    expect(worker.validateInspection(actual, expected)).toBe(true);
  });
  test.each([
    'rw,nosuid,nodev,size=2g,mode=0700,uid=1000,gid=1000',
    'rw,nosuid,nodev,size=1g,mode=0777,uid=1000,gid=1000',
    'rw,nosuid,nodev,size=1g,mode=0700garbage,uid=1000,gid=1000',
    'rw,nosuid,nodev,size=1g,mode=0700,uid=0,gid=0',
    'rw,nodev,size=1g,mode=0700,uid=1000,gid=1000',
    'rw,nosuid,nodev,size=2g,size=1g,mode=0700,uid=1000,gid=1000'
  ])('rejects changed observed tmpfs options: %s', options => {
    const { actual, expected } = inspection(); actual.HostConfig.Tmpfs['/work'] = options;
    expect(() => worker.validateInspection(actual, expected)).toThrow('worker_unconfined');
  });
  test('rejects actual writable cache despite matching destinations', () => {
    const { actual, expected } = inspection(); actual.Mounts[0].RW = true;
    expect(() => worker.validateInspection(actual, expected)).toThrow('worker_unconfined');
  });
});
