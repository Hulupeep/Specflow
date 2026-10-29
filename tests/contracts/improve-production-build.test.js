'use strict';
const { parseMountInfo, validateBuildTopology, validateKernelMounts } = require('../../scripts/improve-production-build.cjs');
const { validateMountTopology } = require('../../scripts/improve-worker.cjs');
const base = [
  '1 0 0:1 / / ro - overlay overlay ro',
  '10 1 8:1 /source /app ro,nosuid,nodev - ext4 /dev/sda1 rw',
  '11 10 8:1 /deps /app/node_modules ro,nosuid,nodev - ext4 /dev/sda1 rw',
  '12 10 0:12 / /app/.next rw,nosuid,nodev,noexec - tmpfs tmpfs rw,size=1048576k',
  '13 1 0:13 / /tmp rw,nosuid,nodev,noexec - tmpfs tmpfs rw,size=131072k'
];
const mounts = () => base.join('\n') + '\n';
describe('production build closed mount topology (isolated contract fixtures)', () => {
  test('only the closed layout allows exact nested pairs; default remains closed', () => {
    const paths = ['/node/bin/node', '/tmp', '/app', '/app/node_modules', '/app/.next'];
    expect(validateBuildTopology(paths)).toBe(true);
    expect(() => validateMountTopology(paths)).toThrow();
  });
  test.each(['/app/extra', '/app/node_modules/native', '/app/.next/cache', '/app/node_modules', '/node', '/app/', '/app/../tmp', '//app', '/app\\x'])('rejects extra or noncanonical mount %s', extra => {
    expect(() => validateBuildTopology(['/node/bin/node', '/tmp', '/app', '/app/node_modules', '/app/.next', extra])).toThrow('build_mount_topology');
  });
  test.each(['/app', '/app/node_modules', '/app/.next', '/tmp'])('requires %s', absent => {
    expect(() => validateBuildTopology(['/tmp', '/app', '/app/node_modules', '/app/.next'].filter(x => x !== absent))).toThrow();
  });
  test('parses actual mountinfo grammar including kernel escapes and optional fields', () => {
    const parsed = parseMountInfo('23 1 8:1 /some\\040root /a\\134b ro shared:4 - ext4 /dev/sda1 rw\n');
    expect(parsed[0]).toMatchObject({ id: 23, parent: 1, device: '8:1', root: '/some root', destination: '/a\\b', fs: 'ext4' });
    expect(parsed[0].options).toEqual(['ro']);
  });
  test.each([
    '', '1 0 0:1 / / ro overlay overlay ro',
    '1 0 0:1 / / ro - overlay overlay',
    '1 0 0:1 / / ro - overlay overlay ro extra',
    '1 0 0:1 /bad\\999 / ro - overlay overlay ro',
    '1 0 0:1 /bad\\ / ro - overlay overlay ro',
    '1 0 bad / / ro - overlay overlay ro',
    '1 0 0:1 / / ro,ro - overlay overlay ro',
    '1 0 0:1 / / ro - overlay overlay ro\n1 0 0:2 / /tmp rw - tmpfs tmpfs rw'
  ])('rejects malformed or duplicate observation %#', text => expect(() => parseMountInfo(text)).toThrow('build_mountinfo_invalid'));
  test('accepts read-only native inputs with bounded noexec output and scratch', () => {
    expect(validateKernelMounts(mounts(), 'build')).toBe(true);
  });
  test.each([
    s => s.replace('/app ro,', '/app rw,'),
    s => s.replace('/app/node_modules ro,', '/app/node_modules rw,'),
    s => s.replace('/app/node_modules ro,', '/app/node_modules ro,noexec,'),
    s => s.replace('11 10', '11 1'),
    s => s.replace('12 10', '12 1'),
    s => s.replace('rw,nosuid,nodev,noexec - tmpfs', 'rw,nosuid,nodev - tmpfs'),
    s => s.replace('size=1048576k', 'size=2048576k'),
    s => s.replace('0:12', '8:1'),
    s => s.replace('size=131072k', 'size=128k'),
    s => s + '14 10 8:1 /other /app/extra ro - ext4 /dev/sda1 rw\n',
    s => s + '14 10 8:1 /other /app ro - ext4 /dev/sda1 rw\n'
  ])('rejects contradictory actual topology %#', mutate => expect(() => validateKernelMounts(mutate(mounts()), 'build')).toThrow());
  test('consumer requires read-only output; never overlays a writable cache', () => {
    const consumer = mounts().replace('12 10 0:12 / /app/.next rw,nosuid,nodev,noexec - tmpfs tmpfs rw,size=1048576k', '12 10 8:1 /output /app/.next ro,nosuid,nodev - ext4 /dev/sda1 rw');
    expect(validateKernelMounts(consumer, 'consumer')).toBe(true);
    expect(() => validateKernelMounts(mounts(), 'consumer')).toThrow();
    expect(() => validateKernelMounts(consumer, 'unknown')).toThrow();
  });
});
describe('production entry admission', () => {
 const { DockerWorker } = require('../../scripts/improve-worker.cjs');
 test.each(['production-build-v1', 'production-consumer-v1'])('generic create cannot select %s', resourceProfile => {
  const probe=jest.spyOn(DockerWorker,'probe').mockImplementation(()=>{throw Error('unexpected probe');});
  try {expect(()=>DockerWorker.prototype.create.call({}, {resourceProfile})).toThrow('offline_resource_invalid');expect(probe).not.toHaveBeenCalled();}
  finally {probe.mockRestore();}
 });
 test.each([{ mounts: [] }, { tmpfs: [] }, { network: 'host' }, { memory: 1 }, { role: 'git' }, { source: {}, dependencies: {} }])('rejects options before capsule or Docker operations: %j', options => {
  const subject=Object.create(DockerWorker.prototype);subject.capsuleMount=jest.fn();subject.create=jest.fn();
  expect(()=>subject.createProduction(options)).toThrow('build_layout_invalid');expect(subject.capsuleMount).not.toHaveBeenCalled();expect(subject.create).not.toHaveBeenCalled();
 });
 test('runtime profile agrees exactly with the accepted design', () => {
  expect(require('../../scripts/improve-production-build.cjs').PROFILE).toEqual(require('../../docs/specs/improve-worker/production-build-profile.json'));
 });
});
describe('complete build input semantics', () => {
 const { canonical, validateInput, COMMAND, FIXED_ENV } = require('../../scripts/improve-production-build.cjs');
 const hash = x => require('crypto').createHash('sha256').update(x).digest('hex');
 function fixture() {
  const h='a'.repeat(64), dependencySource={packageSha256:h,lockSha256:h,manifestSha256:h};
  const receipt={identity:{jobId:'fixture',sourceContainerId:h,recipeSha256:h,sourceInputSha256:hash(canonical(dependencySource))},manifestSha256:h};
  return {schema:'specflow.production-build-input/v1',jobId:'fixture',source:{target:'/job/source',receipt:JSON.parse(JSON.stringify(receipt))},dependencies:{target:'/job/deps',receipt},dependencySource,runtimeSha256:h,command:[...COMMAND],environment:{...FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'compile-only-fixture'},resourceProfile:'production-build-v1'};
 }
 test('valid input and Unicode canonical vector retain exact logical values',()=>{
  const x=fixture();expect(validateInput(JSON.stringify(x))).toEqual(x);
  expect(canonical({z:[true,null,3],a:{b:'x'}})).toBe('{"a":{"b":"x"},"z":[true,null,3]}');
  expect(canonical({a:'é😀'})).toBe('{"a":"é😀"}');
 });
 test.each([NaN,Infinity,1.5,9007199254740992,'x\0y','\ud800','\udc00',undefined])('rejects invalid canonical value %#',value=>expect(()=>canonical(value)).toThrow());
 test.each([
  x=>{x.extra=true},x=>{x.command.push('--webpack')},x=>{x.resourceProfile='other'},
  x=>{x.source.receipt.identity.jobId='foreign'},x=>{x.dependencies.receipt.manifestSha256='wrong'},
  x=>{x.dependencySource.packageSha256='b'.repeat(64)},x=>{x.environment.NODE_OPTIONS='--require=/app/evil.js'},
  x=>{x.environment.NEXT_PUBLIC_AUTH_BYPASS='true'},x=>{x.environment.SECRET='value'},
  x=>{x.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY=''},x=>{x.environment.NEXT_PUBLIC_SUPABASE_URL='https://127.0.0.1:80'},
  x=>{x.environment.NEXT_PUBLIC_SUPABASE_URL='http://example.com:80'},x=>{x.environment.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1'},
  x=>{x.environment.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:65536'},x=>{x.environment.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:80?key=x'}
 ])('rejects unauthorized identity or configuration %#',change=>{const x=fixture();change(x);expect(()=>validateInput(x)).toThrow();});
 test('duplicate keys cannot disappear during parse',()=>{
  const raw=JSON.stringify(fixture()).replace('"jobId":"fixture"','"jobId":"foreign","jobId":"fixture"');
  expect(()=>validateInput(raw)).toThrow();
 });
 test.each(['http://127.0.0.1:80','http://[::1]:54321'])('explicit bounded loopback address %s is accepted',url=>{const x=fixture();x.environment.NEXT_PUBLIC_SUPABASE_URL=url;expect(validateInput(x)).toEqual(x);});
});
test('a delimiter-containing unknown key cannot impersonate two required fields', () => {
 const b=require('../../scripts/improve-production-build.cjs'),h='a'.repeat(64);
 const origin={'lockSha256|manifestSha256':h,packageSha256:h};
 const receipt={identity:{jobId:'fixture',sourceContainerId:h,recipeSha256:h,sourceInputSha256:require('crypto').createHash('sha256').update(b.canonical(origin)).digest('hex')},manifestSha256:h};
 const input={schema:'specflow.production-build-input/v1',jobId:'fixture',source:{target:'/job/source',receipt},dependencies:{target:'/job/deps',receipt},dependencySource:origin,runtimeSha256:h,command:[...b.COMMAND],environment:{...b.FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'explicit-fixture'},resourceProfile:b.PROFILE.id};
 expect(()=>b.validateInput(input)).toThrow('build_input_invalid');
});
