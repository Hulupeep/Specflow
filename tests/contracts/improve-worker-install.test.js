'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process');
const SOURCE=path.resolve(__dirname,'../..');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'worker-install-'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function fixture(layout){
 const pkg=path.join(root,'node_modules/@fixture/specflow');
 fs.mkdirSync(pkg,{recursive:true});fs.cpSync(path.join(SOURCE,'scripts'),path.join(pkg,'scripts'),{recursive:true});
 const template='templates/improve/UX_REFINEMENT_PROFILE.md';fs.mkdirSync(path.dirname(path.join(pkg,template)),{recursive:true});fs.copyFileSync(path.join(SOURCE,template),path.join(pkg,template));
 const modules=layout==='nested'?path.join(pkg,'node_modules'):path.join(root,'node_modules');
 const dep=path.join(modules,'pinned-fixture/index.js');fs.mkdirSync(path.dirname(dep),{recursive:true});fs.writeFileSync(dep,'module.exports=1;');
 const entry=path.join(pkg,'scripts/improve-worker.cjs'),pin=path.join(root,'pin');
 const code=`const entry=${JSON.stringify(entry)};require('module').createRequire(entry)('pinned-fixture');console.log(require(entry).pinnedLauncher({directory:${JSON.stringify(pin)},config:{authority:{}},mode:'worker'}));`;
 const made=cp.spawnSync(process.execPath,['-e',code],{encoding:'utf8'});
 if(made.status!==0)throw Error('Installed launcher creation failed: '+made.stderr);
 return {pkg,modules,dep,launcher:made.stdout.trim()};
}
const launch=f=>cp.spawnSync(f.launcher,[],{encoding:'utf8',timeout:10000});
test.each(['nested','hoisted'])('capsule-launcher-identity %s install rejects changed capsule helper before command authority',layout=>{
 const f=fixture(layout),before=launch(f);
 expect(before.status).toBe(2);expect(JSON.parse(before.stderr).code).toBe('principal_unavailable');
 fs.appendFileSync(path.join(f.pkg,'scripts/improve-worker-capsule.py'),'\n# changed after pin\n');
 const after=launch(f);expect(after.status).not.toBe(0);expect(after.stderr).toMatch(/runtime_input_changed/);
 expect(after.stderr).not.toMatch(/principal_unavailable/);
});
test.each(['nested','hoisted'])('worker-installed-module-layout %s npm layout validates pinned code before rejecting missing authority',layout=>{
 const f=fixture(layout),r=launch(f);expect(r.status).toBe(2);expect(JSON.parse(r.stderr).code).toBe('principal_unavailable');
});
test.each(['insert-shadow','dangling-shadow','replace-root','change-dependency'])('worker-installed-module-layout hoisted launcher rejects %s before executing a command',change=>{
 const f=fixture('hoisted');
 if(change==='dangling-shadow')fs.symlinkSync(path.join(root,'missing'),path.join(f.pkg,'node_modules'));
 if(change==='insert-shadow')fs.mkdirSync(path.join(f.pkg,'node_modules'));
 if(change==='replace-root'){const at=path.join(root,'replacement');fs.mkdirSync(at);fs.renameSync(f.modules,path.join(root,'original-modules'));fs.symlinkSync(at,f.modules);}
 if(change==='change-dependency')fs.appendFileSync(f.dep,'\nmodule.exports=2;');
 const r=launch(f);expect(r.status).not.toBe(0);expect(r.stderr).toMatch(/runtime_input_changed/);expect(r.stderr).not.toMatch(/principal_unavailable/);
});
test.each(['nested','hoisted'])('production-build helper mutation is rejected before command authority (%s)', layout => {
 const f=fixture(layout);fs.appendFileSync(path.join(f.pkg,'scripts/improve-production-build.cjs'),'\n// mutated helper\n');
 const r=launch(f);expect(r.status).not.toBe(0);expect(r.stderr).toMatch(/runtime_input_changed/);expect(r.stderr).not.toMatch(/principal_unavailable/);
});
test.each(['nested','hoisted'])('production-build helper absence is rejected before command authority (%s)', layout => {
 const f=fixture(layout);fs.unlinkSync(path.join(f.pkg,'scripts/improve-production-build.cjs'));
 const r=launch(f);expect(r.status).not.toBe(0);expect(r.stderr).toMatch(/runtime_input_changed|ENOENT/);expect(r.stderr).not.toMatch(/principal_unavailable/);
});

describe('cold versioned npm production-build payload', () => {
 let packedRoot, tarball;
 beforeAll(() => {
  packedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'production-npm-pack-'));
  const packed = cp.spawnSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', packedRoot],
   { cwd: SOURCE, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  expect(packed.status).toBe(0);
  const manifest = JSON.parse(packed.stdout)[0];
  expect(manifest.version).toBe(require('../../package.json').version);
  expect(manifest.files.some(file => file.path === 'scripts/improve-production-build.cjs')).toBe(true);
  tarball = path.join(packedRoot, manifest.filename);
 }, 120000);
 afterAll(() => { if (packedRoot) fs.rmSync(packedRoot, { recursive: true, force: true }); });
 test.each(['nested', 'hoisted'])('tarball installs %s and rejects changed or missing helper before authority', layout => {
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ private: true }));
  const installed = cp.spawnSync('npm', ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund',
   '--package-lock=false', '--install-strategy=' + layout], { cwd: root, encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  expect(installed.status).toBe(0);
  const pkg = path.join(root, 'node_modules/@colmbyrne/specflow'), helper = path.join(pkg, 'scripts/improve-production-build.cjs');
  const bytes = fs.readFileSync(helper);
  expect(bytes.equals(fs.readFileSync(path.join(SOURCE, 'scripts/improve-production-build.cjs')))).toBe(true);
  expect(JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'))).version).toBe(require('../../package.json').version);
  const entry = path.join(pkg, 'scripts/improve-worker.cjs');
  const code = `const entry=${JSON.stringify(entry)},r=require('module').createRequire(entry);r('js-yaml');console.log(JSON.stringify({dependency:r.resolve('js-yaml'),launcher:r(entry).pinnedLauncher({directory:${JSON.stringify(path.join(root, 'pin'))},config:{authority:{}},mode:'worker'})}));`;
  const made = cp.spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  expect(made.status).toBe(0);
  const result = JSON.parse(made.stdout);
  expect(result.dependency.startsWith(path.join(layout === 'nested' ? pkg : root, 'node_modules/js-yaml') + path.sep)).toBe(true);
  const f = { launcher: result.launcher }, before = launch(f);
  expect(before.status).toBe(2); expect(JSON.parse(before.stderr).code).toBe('principal_unavailable');
  fs.appendFileSync(helper, '\n// changed after cold-package pin\n');
  const changed = launch(f);
  expect(changed.status).not.toBe(0); expect(changed.stderr).toMatch(/runtime_input_changed/);
  expect(changed.stderr).not.toMatch(/principal_unavailable/);
  fs.writeFileSync(helper, bytes);
  expect(JSON.parse(launch(f).stderr).code).toBe('principal_unavailable');
  fs.unlinkSync(helper);
  const missing = launch(f);
  expect(missing.status).not.toBe(0); expect(missing.stderr).toMatch(/runtime_input_changed|ENOENT/);
  expect(missing.stderr).not.toMatch(/principal_unavailable/);
 }, 180000);
});
