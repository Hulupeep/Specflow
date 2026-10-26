'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),kernel=require('../../scripts/improve-kernel-lock.cjs');
let root;beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'kernel-v2-test-'));fs.chmodSync(root,0o700);});afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
const tool=()=>({path:'/usr/bin/flock',sha256:crypto.createHash('sha256').update(fs.readFileSync('/usr/bin/flock')).digest('hex'),version:cp.execFileSync('/usr/bin/flock',['--version'],{encoding:'utf8'}).trim()});
test('REC-LOCK permanent kernel inode excludes a real competing process and survives helper exit',()=>{
 const file=path.join(root,'writer.lock'),t=tool();kernel.prepare(file,t);const ino=fs.statSync(file).ino;
 kernel.withLock(file,t,()=>{
  const r=cp.spawnSync(process.execPath,['-e','const k=require(process.argv[1]);try{k.withLock(process.argv[2],JSON.parse(process.argv[3]),()=>{});process.exit(9)}catch(e){console.log(e.code);process.exit(e.code==="store_busy"?0:2)}',require.resolve('../../scripts/improve-kernel-lock.cjs'),file,JSON.stringify(t)],{encoding:'utf8'});
  expect(r.status).toBe(0);expect(r.stdout.trim()).toBe('store_busy');
 });
 expect(kernel.withLock(file,t,()=>42)).toBe(42);expect(fs.statSync(file).ino).toBe(ino);
});
test('REC-LOCK released descriptor on throw retains the permanent inode',()=>{
 const file=path.join(root,'writer.lock'),t=tool();kernel.prepare(file,t);expect(()=>kernel.withLock(file,t,()=>{throw Error('test fault');})).toThrow('test fault');
 expect(kernel.withLock(file,t,()=>true)).toBe(true);expect(fs.existsSync(file)).toBe(true);
});
test('REC-LOCK legacy lock and private symlink/hardlink/tool changes are never adopted',()=>{
 const t=tool(),file=path.join(root,'writer.lock');fs.writeFileSync(file,JSON.stringify({pid:999999}),{mode:0o600});const raw=fs.readFileSync(file);
 expect(()=>kernel.prepare(file,t)).toThrow('legacy_recovery_unavailable');expect(fs.readFileSync(file)).toEqual(raw);fs.unlinkSync(file);
 kernel.prepare(file,t);const other=path.join(root,'unowned-alias');fs.linkSync(file,other);expect(()=>kernel.withLock(file,t,()=>{})).toThrow('kernel_unexpected_link');fs.unlinkSync(other);
 expect(()=>kernel.withLock(file,{...t,sha256:'a'.repeat(64)},()=>{})).toThrow('kernel_tool_changed');
 const link=path.join(root,'symlink');fs.symlinkSync(file,link);expect(()=>kernel.withLock(link,t,()=>{})).toThrow('kernel_unsafe_path');
});
test('REC-LOCK authority format fences old mkdir clients and refuses unknown legacy directories',()=>{
 const t=tool(),file=kernel.prepareAuthority(root,t);expect(fs.statSync(file).isFile()).toBe(true);
 expect(()=>fs.mkdirSync(path.join(root,'.authority-lock'))).toThrow();expect(kernel.withLock(file,t,()=>1)).toBe(1);
 const other=path.join(root,'legacy');fs.mkdirSync(other,{mode:0o700});fs.mkdirSync(path.join(other,'.authority-lock'),{mode:0o700});
 expect(()=>kernel.prepareAuthority(other,t)).toThrow('legacy_recovery_unavailable');expect(fs.readdirSync(path.join(other,'.authority-lock'))).toEqual([]);
});
test('REC-LOCK async callback cannot release exclusion before its work',()=>{
 const file=path.join(root,'writer.lock'),t=tool();kernel.prepare(file,t);expect(()=>kernel.withLock(file,t,()=>Promise.resolve())).toThrow('kernel_synchronous_transition_required');
});
