// #194 research adapter. Requires Linux bubblewrap; no unsandboxed fallback.
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const privateRoot = path.join(root, '.specflow/research-194');
fs.mkdirSync(privateRoot, { recursive: true });
const work = fs.mkdtempSync(path.join(privateRoot, 'sandbox-'));
const kit = path.join(work, 'kit'), writable = path.join(work, 'writable');
fs.mkdirSync(kit); fs.mkdirSync(writable);
// Mount only selected public code and dependencies, never the host checkout,
// home, Git credentials, .specflow state, or environment secrets.
for (const name of ['scripts', 'templates']) fs.cpSync(path.join(root, name), path.join(kit, name), { recursive: true });
for (const name of ['js-yaml', 'argparse']) fs.cpSync(path.join(root, 'node_modules', name), path.join(kit, 'node_modules', name), { recursive: true });
for (const name of ['tests/contracts/improve-core.test.js', 'evidence/improve-trust-spike/lifecycle-probe.cjs']) {
  fs.mkdirSync(path.dirname(path.join(kit, name)), { recursive: true });
  fs.copyFileSync(path.join(root, name), path.join(kit, name));
}
const probe = process.argv.includes('--probe');
const nodeDir = path.dirname(fs.realpathSync(process.execPath));
const args = ['--die-with-parent', '--new-session', '--unshare-all', '--ro-bind', '/usr', '/usr'];
for (const p of ['/lib', '/lib64']) if (fs.existsSync(p)) args.push('--ro-bind', p, p);
args.push('--symlink', 'usr/bin', '/bin', '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp',
  '--ro-bind', nodeDir, '/node', '--ro-bind', kit, '/kit', '--bind', writable, '/work',
  '--chdir', '/work', '--clearenv', '--setenv', 'PATH', '/node:/usr/bin:/bin',
  '--setenv', 'HOME', '/work', '--setenv', 'TMPDIR', '/work',
  '--setenv', 'GIT_CONFIG_NOSYSTEM', '1', '--setenv', 'GIT_TERMINAL_PROMPT', '0',
  '--', '/node/node');
if (probe) {
  const code = `const fs=require('fs'),net=require('net');
    let readOnly=false;try{fs.writeFileSync('/kit/probe-denied','x')}catch(e){readOnly=e.code==='EROFS'||e.code==='EACCES'}
    const hidden=!fs.existsSync(${JSON.stringify(root)})&&!fs.existsSync(${JSON.stringify(os.homedir())});
    fs.writeFileSync('/work/probe-write','ok');
    const namespace=fs.readlinkSync('/proc/self/ns/net');
    const isolated=namespace!==${JSON.stringify(fs.readlinkSync('/proc/self/ns/net'))};
    const success=readOnly&&hidden&&isolated&&fs.readFileSync('/work/probe-write','utf8')==='ok';
    console.log(JSON.stringify({success,sandboxReady:success,readOnly,hostPathsHidden:hidden,networkNamespaceIsolated:isolated,writableFixture:true}));process.exit(success?0:1);`;
  args.push('-e', code);
} else args.push('/kit/evidence/improve-trust-spike/lifecycle-probe.cjs');
const result = spawnSync('bwrap', args, { encoding: 'utf8', timeout: probe ? 15000 : 180000, maxBuffer: 4 * 1024 * 1024 });
fs.writeFileSync(path.join(work, 'execution.json'), JSON.stringify({ command: 'bwrap', args, exitCode: result.status, error: result.error?.code || null, stdout: result.stdout || '', stderr: result.stderr || '' }, null, 2));
// Raw fixture/run evidence stays available under this adapter's private work dir.
if (!probe) fs.writeFileSync(path.join(privateRoot, 'last-execution.json'), JSON.stringify({ directory: path.relative(root, work), exitCode: result.status, error: result.error?.code || null }));
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
process.exitCode = result.status === 0 && !result.error ? 0 : 2;
