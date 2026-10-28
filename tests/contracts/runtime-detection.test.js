const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const routing=require('../../scripts/runtime-routing.cjs');
const ROOT=path.resolve(__dirname,'../..'),uuid='12345678-abcd-4321-89ef-123456789abc';
describe('J-INSTALL-HOST-DETECTION (#124)',()=>{
 test.each([
  [{CODEX_THREAD_ID:uuid},'codex'],[{CLAUDECODE:'1'},'claude-code'],
  [{SPECFLOW_RUNTIME:'codex'},'codex'],[{SPECFLOW_RUNTIME:'claude-code'},'claude-code'],
  [{CODEX_THREAD_ID:uuid,SPECFLOW_RUNTIME:'codex'},'codex'],
 ])('auto resolves only supported host hints %j',(env,runtime)=>{
  expect(routing.resolveRuntime({runtime:'auto',env,interactive:false})).toBe(runtime);
 });
 test.each([{}, {CODEX_THREAD_ID:'bogus',CLAUDECODE:'true'}, {CODEX_THREAD_ID:uuid,CLAUDECODE:'1'}])('missing/invalid/conflicting signals fail with both recoveries %j',env=>{
  expect(()=>routing.resolveRuntime({runtime:'auto',env,interactive:false})).toThrow('npx @colmbyrne/specflow init . --runtime codex');
  expect(()=>routing.resolveRuntime({runtime:'auto',env,interactive:false})).toThrow('npx @colmbyrne/specflow init . --runtime claude-code');
 });
 test.each(['codex','claude-code'])('explicit %s wins without reading host signals',runtime=>{
  const env=new Proxy({}, {get(){throw Error('detection must not run');}});
  expect(routing.resolveRuntime({runtime,env,interactive:false})).toBe(runtime);
 });
 test('noninteractive public init preserves routing on ambiguity, irrespective of installed directories',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'specflow detect '));try{
   routing.installRuntimeRouting({sourceRoot:ROOT,targetRoot:dir,runtime:'codex',interactive:false});
   const active=path.join(dir,'.specflow/adapter-routing.yml'),before=fs.readFileSync(active);
   fs.mkdirSync(path.join(dir,'.claude'),{recursive:true});fs.mkdirSync(path.join(dir,'.codex'),{recursive:true});
   const result=cp.spawnSync(process.execPath,[path.join(ROOT,'bin/specflow.js'),'init',dir,'--runtime','auto'],{encoding:'utf8',env:{...process.env,SPECFLOW_RUNTIME:'',CODEX_THREAD_ID:uuid,CLAUDECODE:'1'},timeout:20000});
   expect(result.status).not.toBe(0);expect(result.stderr+result.stdout).toContain('npx @colmbyrne/specflow init . --runtime claude-code');expect(fs.readFileSync(active)).toEqual(before);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
 });
});
test.each(['constructor','toString','__proto__'])('undeclared prototype name %s is never a runtime',value=>{
 expect(routing.detectRuntime({SPECFLOW_RUNTIME:value})).toMatchObject({detected:null,ambiguous:false});expect(()=>routing.resolveRuntime({runtime:value,interactive:false})).toThrow('unknown runtime');
});
