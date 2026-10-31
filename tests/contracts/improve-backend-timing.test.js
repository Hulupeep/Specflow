'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const {open}=require('../../scripts/improve-backend-timing.cjs');
test('private bounded timing preserves sync/async results and failures without recording their contents',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backend-timing-'));let trace;
 try{
  trace=open(dir,'baseline');const secret='fixture-sensitive-value',failure=new Error(secret);
  expect(trace.sync('identity',()=>secret)).toBe(secret);
  expect(()=>trace.sync('git_identity',()=>{throw failure;})).toThrow(failure);
  await expect(trace.run('admit',async()=>{await new Promise(r=>setTimeout(r,5));return secret;})).resolves.toBe(secret);
  await expect(trace.run('checks',async()=>{throw failure;})).rejects.toBe(failure);
  expect(()=>trace.sync(secret,()=>{})).toThrow('backend_timing_span_invalid');
  trace.close();trace.close();expect(()=>trace.sync('checks',()=>{})).toThrow('backend_timing_span_invalid');
  const bytes=fs.readFileSync(trace.file,'utf8'),rows=bytes.trim().split('\n').map(JSON.parse);
  expect(bytes).not.toContain(secret);expect(fs.statSync(trace.file).mode&0o777).toBe(0o600);
  expect(rows[0]).toMatchObject({phase:'baseline',diagnosticOnly:true});
  expect(rows.slice(1).filter(x=>x.event==='end').map(x=>x.status)).toEqual(['returned','threw','returned','threw']);
  for(const row of rows.slice(1)){expect(row.elapsedMs).toBeGreaterThanOrEqual(0);if(row.event==='end')expect(row.durationMs).toBeGreaterThanOrEqual(0);}
  expect(rows.find(x=>x.step==='admit'&&x.event==='end').durationMs).toBeGreaterThanOrEqual(1);
 }finally{trace?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('span ceiling rejects further instrumentation and invalid phases create no artifact',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'backend-timing-'));let trace;
 try{expect(()=>open(dir,'arbitrary-input')).toThrow();expect(fs.readdirSync(dir)).toEqual([]);trace=open(dir,'dev-r2');for(let i=0;i<128;i++)trace.sync('identity',()=>{});expect(()=>trace.sync('identity',()=>{})).toThrow();}
 finally{trace?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
