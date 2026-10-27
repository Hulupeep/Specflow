'use strict';
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),{ControllerStore}=require('../../scripts/improve-controller.cjs');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'controller-snapshot-'));});
afterEach(()=>{jest.restoreAllMocks();fs.rmSync(root,{recursive:true,force:true});});
function fixture(){const s=new ControllerStore({root});s.change(()=>null);return s;}
// Labelled boundary fault: obtain REAL detached-inode metadata after an actual
// atomic rename. Both pathname and descriptor observations are intercepted so
// the same case applies before and after a descriptor-based implementation.
function replaceAtInspection(store,repeat=false){
 const stat=fs.statSync,fstat=fs.fstatSync,open=fs.openSync,close=fs.closeSync;let watched,swaps=0;
 function detach(fd){const bytes=fs.readFileSync(store.file),tmp=path.join(root,'replacement-'+swaps);fs.writeFileSync(tmp,bytes,{mode:0o600});fs.renameSync(tmp,store.file);swaps++;return fstat(fd);}
 jest.spyOn(fs,'openSync').mockImplementation((file,...args)=>{const fd=open(file,...args);if(file===store.file)watched=fd;return fd;});
 jest.spyOn(fs,'statSync').mockImplementation((file,...args)=>{if(file===store.file&&(repeat||!swaps)){const fd=open(file,'r');try{return detach(fd);}finally{close(fd);}}return stat(file,...args);});
 jest.spyOn(fs,'fstatSync').mockImplementation((fd,...args)=>{if(fd===watched&&(repeat||!swaps)){if(swaps>20)throw Error('Unbounded detached-inode retry');return detach(fd);}return fstat(fd,...args);});
 return ()=>swaps;
}
test('STORE-READ actual detached inode at inspection retries a fresh private snapshot',()=>{
 const s=fixture(),swaps=replaceAtInspection(s);expect(s.read()).toMatchObject({version:1,revision:1});expect(swaps()).toBeGreaterThan(0);
});
test('STORE-READ repeated replacement has a bounded availability result, not a privacy accusation',()=>{
 const s=fixture(),swaps=replaceAtInspection(s,true);expect(()=>s.read()).toThrow('store_snapshot_busy');expect(swaps()).toBeGreaterThan(0);expect(swaps()).toBeLessThan(20);
});
test.each(['public','hardlink','symlink','dangling','directory','oversize'])('STORE-READ preserves %s fail-closed guard',kind=>{
 const s=fixture();
 if(kind==='public')fs.chmodSync(s.file,0o644);
 if(kind==='hardlink')fs.linkSync(s.file,path.join(root,'alias'));
 if(kind==='symlink'){const other=path.join(root,'other');fs.renameSync(s.file,other);fs.symlinkSync(other,s.file);}
 if(kind==='dangling'){fs.unlinkSync(s.file);fs.symlinkSync(path.join(root,'missing'),s.file);}
 if(kind==='directory'){fs.unlinkSync(s.file);fs.mkdirSync(s.file,{mode:0o700});}
 if(kind==='oversize')fs.writeFileSync(s.file,'x'.repeat(16*1024*1024+1),{mode:0o600});
 expect(()=>s.read()).toThrow(['symlink','dangling'].includes(kind)?'unsafe_store_path':kind==='oversize'?'store_limit':'private_store_required');
});
test('STORE-READ real concurrent commits yield coherent state or explicit snapshot contention',async()=>{
 const s=fixture(),source=path.resolve('scripts/improve-controller.cjs');let running=true,errors=[],revisions=[],stderr='';
 const child=cp.spawn(process.execPath,['-e',`const {ControllerStore}=require(process.argv[1]);const s=new ControllerStore({root:process.argv[2]});for(let i=0;i<1000;i++)s.change(()=>null);`,source,root],{stdio:['ignore','ignore','pipe']});child.stderr.on('data',b=>stderr+=b);
 const finished=new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',code=>{running=false;resolve(code);});});
 const timer=setTimeout(()=>child.kill('SIGTERM'),20000);
 try{
  await new Promise(resolve=>{function read(){if(!running)return resolve();for(let i=0;i<25;i++){try{const state=s.read();expect(state.version).toBe(1);revisions.push(state.revision);}catch(e){errors.push(e.code||e.message);}}setImmediate(read);}read();});
  expect(await finished).toBe(0);expect(stderr).toBe('');expect(revisions.length).toBeGreaterThan(0);expect(errors.filter(e=>e!=='store_snapshot_busy')).toEqual([]);expect(s.read().revision).toBe(1001);
 }finally{clearTimeout(timer);if(running){child.kill('SIGKILL');await finished;}}
},30000);

test('STORE-READ rejects a foreign owner in path and descriptor metadata (unit counterfactual)',()=>{
 const s=fixture(),stat=fs.statSync,fstat=fs.fstatSync;
 const foreign=value=>Object.assign(Object.create(Object.getPrototypeOf(value)),value,{uid:process.getuid()+1});
 jest.spyOn(fs,'statSync').mockImplementation((file,...args)=>file===s.file?foreign(stat(file,...args)):stat(file,...args));
 jest.spyOn(fs,'fstatSync').mockImplementation((fd,...args)=>foreign(fstat(fd,...args)));
 expect(()=>s.read()).toThrow('private_store_required');
});
test('STORE-READ FIFO is rejected without blocking or reading it (actual process)',()=>{
 const s=fixture();fs.unlinkSync(s.file);expect(cp.spawnSync('mkfifo',[s.file],{encoding:'utf8'}).status).toBe(0);fs.chmodSync(s.file,0o600);
 const child=cp.spawnSync(process.execPath,['-e',`const {ControllerStore}=require(process.argv[1]);try{new ControllerStore({root:process.argv[2]}).read();process.exit(1);}catch(e){console.log(e.code);process.exit(e.code==='private_store_required'?0:2);}`,path.resolve('scripts/improve-controller.cjs'),root],{encoding:'utf8',timeout:5000});
 expect(child.error).toBeUndefined();expect(child.status).toBe(0);expect(child.stdout.trim()).toBe('private_store_required');
});
