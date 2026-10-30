const fs=require('fs'),crypto=require('crypto'),cp=require('child_process');
const delivery=require('../../scripts/improve-backend-server.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
describe('closed server credential envelope (#293)',()=>{
 let directory,value,expected;
 const now=1700000000000,container='a'.repeat(64);
 beforeEach(()=>{
  directory='/tmp/sf-secret-'+crypto.randomBytes(16).toString('hex');
  value={job:'job-1',generation:'generation-1',container,nonce:crypto.randomUUID(),issued:now,expires:now+60000,key:'header.'+crypto.randomBytes(32).toString('base64url')+'.signature'};
  expected={job:value.job,generation:value.generation,container,nonce:value.nonce,envelopeSha256:hash(JSON.stringify(value))};
 });
 afterEach(()=>fs.rmSync(directory,{recursive:true,force:true}));
 function write(bytes=JSON.stringify(value)){
  const argv=delivery.writerArgv(directory);return cp.spawnSync(process.execPath,argv.slice(1),{input:bytes,encoding:'utf8',timeout:5000});
 }
 const consume=()=>delivery.consumeEnvelope(directory,expected,now,container.slice(0,12));
 test('real stdin writer creates private envelope and reader unlinks before returning key',()=>{
  expect(write().status).toBe(0);expect(fs.statSync(directory).mode&0o777).toBe(0o700);expect(fs.statSync(directory+'/envelope').mode&0o777).toBe(0o600);
  expect(consume()).toEqual(value);expect(fs.existsSync(directory)).toBe(false);
 });
 test.each(['job','generation','container','nonce'])('rejects mismatched %s even with matching envelope hash',field=>{
  value[field]='foreign';expected.envelopeSha256=hash(JSON.stringify(value));expect(write().status).toBe(0);expect(consume).toThrow('backend_envelope_'+field);
 });
 test.each([['stale',v=>v.issued=now-30001],['future',v=>v.issued=now+1001],['expired',v=>v.expires=now],['long-lived',v=>v.expires=now+600001],['extra-field',v=>v.extra=true]])('rejects %s envelope',(_,change)=>{
  change(value);expected.envelopeSha256=hash(JSON.stringify(value));expect(write().status).toBe(0);expect(consume).toThrow(/^backend_envelope_/);
 });
 test('rejects bytes modified after expected hash was bound',()=>{
  expect(write().status).toBe(0);fs.appendFileSync(directory+'/envelope',' ');expect(consume).toThrow('backend_envelope_binding');
 });
 test('real hostname mismatch fails independently of supplied envelope',()=>{
  expect(write().status).toBe(0);expect(()=>delivery.consumeEnvelope(directory,expected,now,'other')).toThrow('backend_envelope_container');
 });
 test('missing envelope gives fixed non-secret error',()=>expect(consume).toThrow('backend_envelope_missing'));
 test('oversize stdin never creates an accepted envelope',()=>{
  const r=write('x'.repeat(8193));expect(r.status).toBe(23);expect(r.stdout).toBe('backend_envelope_write_failed');expect(fs.existsSync(directory)).toBe(false);
 });
 test('exclusive writer refuses an existing directory',()=>{fs.mkdirSync(directory,{mode:0o700});expect(write().status).toBe(23);expect(fs.existsSync(directory+'/envelope')).toBe(false);});
 test.each(['symlink','hardlink','public-file','public-directory','fifo'])('rejects %s filesystem substitution',kind=>{
  expect(write().status).toBe(0);const file=directory+'/envelope';
  if(kind==='symlink'){fs.renameSync(file,directory+'/saved');fs.symlinkSync(directory+'/saved',file);}
  if(kind==='hardlink')fs.linkSync(file,directory+'/link');
  if(kind==='public-file')fs.chmodSync(file,0o644);
  if(kind==='public-directory')fs.chmodSync(directory,0o755);
  if(kind==='fifo'){fs.unlinkSync(file);expect(cp.spawnSync('mkfifo',[file]).status).toBe(0);}
  expect(consume).toThrow(/^backend_envelope_/);
 });
 test('one-use envelope cannot be consumed twice',()=>{expect(write().status).toBe(0);consume();expect(consume).toThrow('backend_envelope_missing');});
 test('launcher and writer argv never contain the credential',()=>{
  expect(JSON.stringify(delivery.writerArgv(directory))).not.toContain(value.key);
  expect(JSON.stringify(delivery.launcherArgv(directory,expected))).not.toContain(value.key);
 });
});
describe('server secret artifact scanning',()=>{
 let root;const key='header.'+crypto.randomBytes(32).toString('base64url')+'.'+crypto.randomBytes(32).toString('base64url');
 beforeEach(()=>{root=fs.mkdtempSync('/tmp/specflow-server-scan-');});afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
 test('counts actual files and bytes without disclosing contents',()=>{fs.writeFileSync(root+'/clean','safe');expect(delivery.scanArtifacts(root,key)).toEqual({files:1,bytes:4,canaryHits:0});});
 test.each(['raw','base64','payload','signature'])('detects %s secret representation with fixed diagnostic',kind=>{
  const forms={raw:key,base64:Buffer.from(key).toString('base64'),payload:key.split('.')[1],signature:key.split('.')[2]};fs.writeFileSync(root+'/leak',forms[kind]);expect(()=>delivery.scanArtifacts(root,key)).toThrow('backend_server_secret_exposed');
 });
 test('does not misclassify common JWT header as a secret',()=>{fs.writeFileSync(root+'/public',key.split('.')[0]);expect(delivery.scanArtifacts(root,key).canaryHits).toBe(0);});
 test('rejects symlinks rather than reading outside evidence',()=>{fs.symlinkSync('/etc/passwd',root+'/link');expect(()=>delivery.scanArtifacts(root,key)).toThrow('backend_input_invalid');});
 test('rejects oversized evidence without allocating it',()=>{fs.writeFileSync(root+'/large','');fs.truncateSync(root+'/large',16*1024*1024+1);expect(()=>delivery.scanArtifacts(root,key)).toThrow('backend_output_limit');});
});
