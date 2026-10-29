'use strict';
// Live Linux/Docker isolation fixture, not the real Next production-build qualification.
// Its native addon is deliberately tiny; actual SWC/product evidence remains separate.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawnSync } = require('child_process');
const { DockerWorker } = require('../../scripts/improve-worker.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function layer() {
  const node = fs.realpathSync(process.execPath);
  const result = spawnSync('/usr/bin/ldd', [node], { encoding: 'utf8' });
  expect(result.status).toBe(0);
  const libraries = [...new Set(result.stdout.split('\n').flatMap(line => {
    const match = line.match(/(?:=>\s*)?(\/[^\s(]+)/); return match ? [match[1]] : [];
  }))];
  const files = [[node, '/node/bin/node'], ...libraries.map(name => [name, name])].map(([source, destination]) => {
    source = fs.realpathSync(source); return { source, destination, sha256: hash(fs.readFileSync(source)) };
  });
  return { files, directories: [], sha256: hash(JSON.stringify({ files, directories: [] })) };
}
function capsule(worker, seed, source, target, sourceInputSha256 = hash('explicit-isolated-fixture')) {
  const result = worker.captureCapsule(seed, source, target, { recipeSha256: hash('live-boundary-fixture-v1'), sourceInputSha256 });
  return { target, receipt: { identity: result.identity, manifestSha256: result.manifestSha256 } };
}
test('live closed layout: native mapping, immutable inputs, isolation, mismatch teardown and same-job ownership', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'production-boundary-'));
  fs.chmodSync(root, 0o700);
  let worker;
  try {
    const nativeSource = path.join(root, 'addon.c'), native = path.join(root, 'addon.node');
    fs.writeFileSync(nativeSource, 'extern int napi_create_int32(void*,int,void**);\nvoid* napi_register_module_v1(void* env,void* exports){void* result;return napi_create_int32(env,42,&result)==0?result:exports;}\n');
    const compile = spawnSync('/usr/bin/cc', ['-shared', '-fPIC', nativeSource, '-o', native], { encoding: 'utf8' });
    expect(compile.status).toBe(0);
    const hostCanary = path.join(root, 'host-canary'); fs.writeFileSync(hostCanary, 'private-positive');
    expect(fs.readFileSync(hostCanary, 'utf8')).toBe('private-positive');
    worker = new DockerWorker({ image: DockerWorker.ensureImage(root), layer: layer(), stateRoot: root, jobId: 'boundary-fixture', maxMilliseconds: 60000 });
    const seed = worker.create({ role: 'setup', resourceProfile: 'offline-dependencies-v1', mounts: [{ source: native, destination: '/input/addon.node' }] });
    worker.exec(seed, ['/node/bin/node', '-e', `const f=require('fs');for(const d of ['app','app/node_modules','app/.next','deps','foreign'])f.mkdirSync('/work/'+d);f.writeFileSync('/work/app/package.json','{}');f.writeFileSync('/work/app/pnpm-lock.yaml','lockfileVersion: 9.0');f.writeFileSync('/work/foreign/canary','foreign-positive');f.copyFileSync('/input/addon.node','/work/deps/addon.node');for(const kind of ['link','file','nonempty']){const p='/work/'+kind;f.mkdirSync(p);f.mkdirSync(p+'/node_modules');f.writeFileSync(p+'/package.json','{}');if(kind==='link')f.symlinkSync('node_modules',p+'/.next');else if(kind==='file')f.writeFileSync(p+'/.next','bad');else{f.mkdirSync(p+'/.next');f.writeFileSync(p+'/.next/entry','bad')}}`], { cwd: '/work' });
    worker.pause(seed);
    const source = capsule(worker, seed, '/work/app', root + '/source');
    const build = require('../../scripts/improve-production-build.cjs');
    const dependencySource = { packageSha256: hash('{}'), lockSha256: hash('lockfileVersion: 9.0'), manifestSha256: hash('explicit fixture store') };
    const dependencies = capsule(worker, seed, '/work/deps', root + '/deps', hash(build.canonical(dependencySource)));
    const foreign = capsule(worker, seed, '/work/foreign', root + '/foreign');
    const invalidSources = ['link','file','nonempty'].map(kind => capsule(worker, seed, '/work/'+kind, root+'/source-'+kind));
    worker.destroy(seed);
    for (const invalidSource of invalidSources) {
      const calls = jest.spyOn(worker, 'call');
      expect(() => worker.createProduction({ source: invalidSource, dependencies })).toThrow('build_reserved_path');
      expect(calls).not.toHaveBeenCalled(); calls.mockRestore();
    }
    const runtimeFile = { source: native, destination: '/app/runtime-shadow', sha256: hash(fs.readFileSync(native)) };
    worker.layer.files.push(runtimeFile);
    const shadowCalls = jest.spyOn(worker, 'call');
    expect(() => worker.createProduction({ source, dependencies })).toThrow('build_mount_topology');
    expect(shadowCalls).not.toHaveBeenCalled(); shadowCalls.mockRestore(); worker.layer.files.pop();
    expect(fs.readFileSync(foreign.target + '/tree/canary', 'utf8')).toBe('foreign-positive');
    const input = { schema: 'specflow.production-build-input/v1', jobId: worker.jobId, source, dependencies,
      dependencySource, runtimeSha256: worker.layer.sha256, command: [...build.COMMAND], resourceProfile: build.PROFILE.id,
      environment: { ...build.FIXED_ENV, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'compile-only-fixture' } };
    const bound = build.inputIdentity(worker, input);
    expect(bound.inputSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(bound.logical.source.target).toBe('/app');
    const changed = JSON.parse(JSON.stringify(input)); changed.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'another-explicit-fixture';
    expect(build.inputIdentity(worker, changed).inputSha256).not.toBe(bound.inputSha256);
    const mutationCalls = jest.spyOn(worker, 'call');
    const pkg = path.join(source.target, 'tree/package.json'); fs.writeFileSync(pkg, '{"changed":true}');
    expect(() => build.inputIdentity(worker, input)).toThrow(); expect(mutationCalls).not.toHaveBeenCalled();
    fs.writeFileSync(pkg, '{}'); mutationCalls.mockRestore();
    expect(build.inputIdentity(worker, input).inputSha256).toBe(bound.inputSha256);
    const id = worker.createProduction({ source, dependencies });
    const probe = worker.exec(id, ['/node/bin/node', '-e', `
const f=require('fs'),a=require('assert'),net=require('net');
a.equal(require('/app/node_modules/addon.node'),42);
const attacks=[()=>f.writeFileSync('/app/forbidden','x'),()=>f.writeFileSync('/app/node_modules/forbidden','x'),()=>f.renameSync('/app/node_modules','/app/replaced'),()=>f.unlinkSync('/app/node_modules'),()=>f.symlinkSync('/tmp','/app/node_modules')];
const denied=attacks.map(fn=>{try{fn();return false}catch(e){return ['EROFS','EACCES','EBUSY','EISDIR','EEXIST','EPERM'].includes(e.code)}});a(denied.every(Boolean));
f.writeFileSync('/app/.next/control','output-positive');a.equal(f.readFileSync('/app/.next/control','utf8'),'output-positive');
for(const p of process.argv.slice(1)){let denied=false;try{f.readFileSync(p)}catch(e){denied=['ENOENT','EACCES'].includes(e.code)}a(denied)}
const connect=(host,port)=>new Promise(resolve=>{const s=net.connect({host,port});let settled=false;const done=value=>{if(settled)return;settled=true;s.destroy();resolve(value)};s.once('connect',()=>done(true));s.once('error',()=>done(false));s.setTimeout(2000,()=>{s.destroy();throw Error('network probe inconclusive timeout')});});
(async()=>{const server=net.createServer(s=>s.end());await new Promise(r=>server.listen(0,'127.0.0.1',r));a(await connect('127.0.0.1',server.address().port));a.equal(await connect('198.51.100.1',443),false);a(Object.keys(require('os').networkInterfaces()).every(x=>x==='lo'));server.close();console.log(JSON.stringify({nativeFixture:42,denied,output:true,hostAndForeignDenied:true,networkPositive:true,egressDenied:true}));})().catch(e=>{console.error(e);process.exitCode=1});
`, hostCanary, foreign.target + '/tree/canary'], { timeout: 10000 });
    const result = JSON.parse(probe.stdout);
    expect(result).toEqual({ nativeFixture: 42, denied: [true, true, true, true, true], output: true, hostAndForeignDenied: true, networkPositive: true, egressDenied: true });
    // Inspect the real worker, then inject a contradictory observed mount flag.
    // This is a fault-injection teardown test, not a claimed real mount change.
    const actualCall = worker.call.bind(worker);
    const callSpy = jest.spyOn(worker, 'call').mockImplementation((args, opts) => {
      const r = actualCall(args, opts);
      if (args[0] === 'inspect') { const rows = JSON.parse(r.stdout); rows[0].Mounts.find(m => m.Destination === '/app').RW = true; return { ...r, stdout: JSON.stringify(rows) }; }
      return r;
    });
    expect(() => worker.exec(id, ['/node/bin/node', '-e', 'throw Error("must not execute")'])).toThrow('worker_unconfined');
    expect(callSpy.mock.calls.filter(([args]) => args[0] === 'exec')).toHaveLength(0);
    callSpy.mockRestore(); expect(worker.containers.has(id)).toBe(false);
    const another = new DockerWorker({ image: worker.image, layer: worker.layer, stateRoot: root, jobId: 'foreign-job' });
    const createSpy = jest.spyOn(another, 'create');
    expect(() => another.createProduction({ source, dependencies })).toThrow('capsule_job_identity');
    expect(createSpy).not.toHaveBeenCalled(); createSpy.mockRestore();
    worker.close(); expect(worker.containers.size).toBe(0);
    expect(worker.call(['ps', '-aq', '--filter', 'label=specflow.worker=owned']).stdout.trim()).toBe('');
  } finally { worker?.close(); fs.rmSync(root, { recursive: true, force: true }); }
}, 120000);
