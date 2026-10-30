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
    const runtime = layer(), library = runtime.files.find(f => f.destination !== '/node/bin/node');
    const libraryCopy = path.join(root, 'runtime-library'); fs.copyFileSync(library.source, libraryCopy); library.source = libraryCopy;
    runtime.sha256 = hash(JSON.stringify({ files: runtime.files, directories: runtime.directories }));
    worker = new DockerWorker({ image: DockerWorker.ensureImage(root), layer: runtime, stateRoot: root, jobId: 'boundary-fixture', maxMilliseconds: 60000 });
    const seed = worker.create({ role: 'setup', resourceProfile: 'offline-dependencies-v1', mounts: [{ source: native, destination: '/input/addon.node' }] });
    worker.exec(seed, ['/node/bin/node', '-e', `const f=require('fs');for(const d of ['app','app/node_modules','app/.next','deps','foreign'])f.mkdirSync('/work/'+d);f.writeFileSync('/work/app/package.json','{}');f.writeFileSync('/work/app/pnpm-lock.yaml','lockfileVersion: 9.0');f.writeFileSync('/work/foreign/canary','foreign-positive');f.copyFileSync('/input/addon.node','/work/deps/addon.node');f.mkdirSync('/work/deps/next/dist/bin',{recursive:true});f.writeFileSync('/work/deps/next/dist/bin/next',JSON.stringify('placeholder'));for(const kind of ['link','file','nonempty']){const p='/work/'+kind;f.mkdirSync(p);f.mkdirSync(p+'/node_modules');f.writeFileSync(p+'/package.json','{}');if(kind==='link')f.symlinkSync('node_modules',p+'/.next');else if(kind==='file')f.writeFileSync(p+'/.next','bad');else{f.mkdirSync(p+'/.next');f.writeFileSync(p+'/.next/entry','bad')}}`], { cwd: '/work' });
    worker.exec(seed, ['/node/bin/node', '-e', `require('fs').writeFileSync('/work/deps/next/dist/bin/next', process.argv[1])`, "const f=require('fs');if(process.argv[2]!=='build')throw Error('fixed command required');f.writeFileSync('/app/.next/BUILD_ID','isolated-fixture-build');f.writeFileSync('/app/.next/result.json',JSON.stringify({native:require('/app/node_modules/addon.node')}));"], { cwd: '/work' });
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
      dependencySource, runtimeSha256: build.runtimeIdentity(worker), command: [...build.COMMAND], resourceProfile: build.PROFILE.id,
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
    const runtimeCalls = jest.spyOn(worker, 'call'), originalImage = worker.image;
    worker.image = 'sha256:' + 'f'.repeat(64);
    expect(() => build.inputIdentity(worker, input)).toThrow('build_input_changed');
    worker.image = originalImage;
    worker.layer.files[0].destination += '-changed';
    expect(() => build.inputIdentity(worker, input)).toThrow('build_input_changed');
    worker.layer.files[0].destination = worker.layer.files[0].destination.replace(/-changed$/, '');
    expect(runtimeCalls).not.toHaveBeenCalled(); runtimeCalls.mockRestore();
    const built = build.runProductionBuild(worker, input, root + '/built');
    expect(built.receipt.schema).toBe('specflow.production-build-receipt/v1');
    expect(built.receipt.inputSha256).toBe(bound.inputSha256);
    expect(hash(fs.readFileSync(path.join(built.evidenceDirectory, 'input-identity.json')))).toBe(built.receipt.inputSha256);
    expect(hash(fs.readFileSync(path.join(built.evidenceDirectory, 'producer-identity.json')))).toBe(built.receipt.producerIdentitySha256);
    expect(built.receipt.buildIdSha256).toBe(hash('isolated-fixture-build'));
    expect(worker.containers.has(built.receipt.output.identity.sourceContainerId)).toBe(false);
    const consumer = build.createProductionConsumer(worker, input, built.receipt, built.target);
    expect(consumer.id).not.toBe(built.receipt.output.identity.sourceContainerId);
    const consumed = consumer.exec(['/node/bin/node', '-e', `const f=require('fs'),a=require('assert');a.equal(f.readFileSync('/app/.next/BUILD_ID','utf8'),'isolated-fixture-build');a.equal(JSON.parse(f.readFileSync('/app/.next/result.json')).native,42);let denied=false;try{f.writeFileSync('/app/.next/change','no')}catch(e){denied=['EROFS','EACCES'].includes(e.code)}a(denied);console.log('consumed-read-only')`]);
    expect(consumed.stdout.trim()).toBe('consumed-read-only'); consumer.close();
    expect(Object.keys(built.receipt).sort()).toEqual([...require('../../docs/specs/improve-worker/production-build-receipt.schema.json').required].sort());
    expect(built.receipt.output.identity.sourceInputSha256).toBe(bound.inputSha256);
    const mutationFiles = [pkg, path.join(dependencies.target, 'tree/addon.node'), libraryCopy, path.join(built.target, 'tree/BUILD_ID')];
    for (const file of mutationFiles) {
      const bytes = fs.readFileSync(file), calls = jest.spyOn(worker, 'call');
      try { fs.appendFileSync(file, 'changed'); expect(() => build.createProductionConsumer(worker, input, built.receipt, built.target)).toThrow(); expect(calls).not.toHaveBeenCalled(); }
      finally { fs.writeFileSync(file, bytes); calls.mockRestore(); }
    }
    const addon = path.join(dependencies.target, 'tree/addon.node'), originalMode = fs.statSync(addon).mode & 0o777;
    const modeCalls = jest.spyOn(worker, 'call');
    try { fs.chmodSync(addon, originalMode ^ 0o040); expect(() => build.createProductionConsumer(worker, input, built.receipt, built.target)).toThrow(); expect(modeCalls).not.toHaveBeenCalled(); }
    finally { fs.chmodSync(addon, originalMode); modeCalls.mockRestore(); }
    for (const change of [x => x.command.push('--webpack'), x => { x.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'changed-fixture'; }]) {
      const changedInput = JSON.parse(JSON.stringify(input)); change(changedInput); const calls = jest.spyOn(worker, 'call');
      try { expect(() => build.createProductionConsumer(worker, changedInput, built.receipt, built.target)).toThrow(); expect(calls).not.toHaveBeenCalled(); }
      finally { calls.mockRestore(); }
    }
    const foreignWorker = new DockerWorker({ image: worker.image, layer: worker.layer, stateRoot: root, jobId: 'other-job' });
    const foreignCalls = jest.spyOn(foreignWorker, 'call');
    expect(() => build.createProductionConsumer(foreignWorker, input, built.receipt, built.target)).toThrow('build_input_changed');
    expect(foreignCalls).not.toHaveBeenCalled(); foreignCalls.mockRestore();
    const guardedInput = JSON.parse(JSON.stringify(input)), guarded = build.createProductionConsumer(worker, guardedInput, built.receipt, built.target);
    guardedInput.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'changed-after-creation';
    const guardedCalls = jest.spyOn(worker, 'call');
    expect(() => guarded.exec(['/node/bin/node', '-e', 'throw Error("must not execute")'])).toThrow('build_receipt_changed');
    expect(guardedCalls.mock.calls.some(([args]) => args[0] === 'exec')).toBe(false); guardedCalls.mockRestore();
    expect(worker.containers.has(guarded.id)).toBe(false);
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

function faultFixture(script) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'production-fault-'));fs.chmodSync(root,0o700);
 const worker=new DockerWorker({image:DockerWorker.ensureImage(root),layer:layer(),stateRoot:root,jobId:'fault-fixture'});
 const build=require('../../scripts/improve-production-build.cjs');
 try {
  const seed=worker.create({role:'setup',resourceProfile:'offline-dependencies-v1'});
  worker.exec(seed,['/node/bin/node','-e',`const f=require('fs');for(const d of ['app','app/node_modules','app/.next','deps'])f.mkdirSync('/work/'+d);f.writeFileSync('/work/app/package.json','{}');f.writeFileSync('/work/app/pnpm-lock.yaml','fixture-lock');f.mkdirSync('/work/deps/next/dist/bin',{recursive:true});f.writeFileSync('/work/deps/next/dist/bin/next',process.argv[1]);`,script],{cwd:'/work'});
  worker.pause(seed);
  const dependencySource={packageSha256:hash('{}'),lockSha256:hash('fixture-lock'),manifestSha256:hash('fixture-store')};
  const source=capsule(worker,seed,'/work/app',root+'/source');
  const dependencies=capsule(worker,seed,'/work/deps',root+'/deps',hash(build.canonical(dependencySource)));worker.destroy(seed);
  const input={schema:'specflow.production-build-input/v1',jobId:worker.jobId,source,dependencies,dependencySource,runtimeSha256:build.runtimeIdentity(worker),
   command:[...build.COMMAND],resourceProfile:build.PROFILE.id,environment:{...build.FIXED_ENV,NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:54321',NEXT_PUBLIC_SUPABASE_ANON_KEY:'compile-only-fixture'}};
  return {root,worker,input,build};
 } catch(error) {worker.close();fs.rmSync(root,{recursive:true,force:true});throw error;}
}
test.each([
 ['command',"process.stderr.write('deliberate fixture failure');process.exit(7)",'build_command_failed'],
 ['invalid-output',"require('fs').writeFileSync('/app/.next/other','no BUILD_ID')",'build_output_invalid'],
 ['ENOSPC',"const f=require('fs'),fd=f.openSync('/app/.next/full','w'),b=Buffer.alloc(16*1024*1024,1);while(true)f.writeSync(fd,b)",'build_resource_exhausted'],
 ['memory',"const held=[];while(true)held.push(Buffer.alloc(64*1024*1024,1))",'build_memory_exhausted'],
 ['deadline',"setInterval(()=>{},1000)",'worker_deadline'],
 ['process-loss',"setInterval(()=>{},1000)",'build_process_lost'],
 ['staged-capture-interruption',"require('fs').writeFileSync('/app/.next/BUILD_ID','fixture')",'capsule_interrupted']
])('live build failure %s emits no receipt and confirms teardown', (kind,script,expectedCode) => {
 const {root,worker,input,build}=faultFixture(script);let injected=false,callSpy;
 try {
  if(['deadline','process-loss'].includes(kind)) {
   const original=worker.call.bind(worker);
   callSpy=jest.spyOn(worker,'call').mockImplementation((args,options)=>{
    if(args[0]==='exec'&&args.includes('/app/node_modules/next/dist/bin/next')) {
     injected=true;expect(options.timeout).toBe(build.PROFILE.phaseMilliseconds);
     // Assert the real production bound; inject an earlier real transport timeout.
     if(kind==='deadline')return original(args,{...options,timeout:100});
     const id=args[args.indexOf('/node/bin/node')-1];expect(original(['kill',id]).status).toBe(0);
    }
    return original(args,options);
   });
  }
  if(kind==='staged-capture-interruption') worker.capsuleDiagnostic=(action,result)=>{
   if(action==='prepare') {expect(JSON.parse(result.stdout).status).toBe('staged');injected=true;throw Error('capsule_interrupted');}
  };
  let error;try {build.runProductionBuild(worker,input,root+'/output');}catch(e){error=e;}
  expect(error).toBeDefined();expect(error.code||error.message).toBe(expectedCode);
  expect(error.evidenceDirectory).toBeTruthy();expect(fs.existsSync(path.join(error.evidenceDirectory,'receipt.json'))).toBe(false);
  const files=fs.readdirSync(error.evidenceDirectory);
  expect(files.some(f=>f.endsWith('.stdout'))).toBe(true);expect(files.some(f=>f.endsWith('.stderr'))).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(error.evidenceDirectory,'failure.json'))).receiptEmitted).toBe(false);
  expect(worker.containers.size).toBe(0);
  if(['deadline','process-loss','staged-capture-interruption'].includes(kind))expect(injected).toBe(true);
  if(kind==='staged-capture-interruption')expect(fs.existsSync(root+'/output')).toBe(false);
 } finally {callSpy?.mockRestore();worker.close();fs.rmSync(root,{recursive:true,force:true});}
},120000);

// Reproduces the real generated-output mode that prevented managed cleanup.
test('live build seals generated group-writable output before capsule identity is frozen', () => {
 const {root,worker,input,build}=faultFixture("const f=require('fs');f.writeFileSync('/app/.next/BUILD_ID','fixture');f.chmodSync('/app/.next/BUILD_ID',0o664);f.mkdirSync('/app/.next/generated');f.chmodSync('/app/.next/generated',0o775);f.writeFileSync('/app/.next/generated/executable','content');f.chmodSync('/app/.next/generated/executable',0o775)");
 try {
  const built=build.runProductionBuild(worker,input,root+'/output');
  const manifest=JSON.parse(fs.readFileSync(built.target+'/manifest.json'));
  expect(manifest.entries.find(e=>e.path==='BUILD_ID').mode).toBe(0o644);
  expect(manifest.entries.find(e=>e.path==='generated').mode).toBe(0o755);
  expect(manifest.entries.find(e=>e.path==='generated/executable').mode).toBe(0o755);
  expect(fs.readFileSync(built.target+'/tree/generated/executable','utf8')).toBe('content');
  expect(build.verifyProductionOutput(worker,input,built.receipt,built.target)).toBeTruthy();
  expect(worker.containers.size).toBe(0);
 }finally{worker.close();fs.rmSync(root,{recursive:true,force:true});}
},120000);
