'use strict';
const fs=require('fs'),os=require('os'),path=require('path');
const {spawnSync}=require('child_process');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'role-deadline-'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function invoke(deadlineAtMs,body='process.stdout.write("completed");'){
 const request={claude:process.execPath,args:['-e',body],cwd:root,input:'',raw:path.join(root,'raw'),stderr:path.join(root,'stderr'),done:path.join(root,'done'),deadlineAtMs};
 const file=path.join(root,'request.json');fs.writeFileSync(file,JSON.stringify(request));
 const child=spawnSync(process.execPath,[path.resolve('scripts/improve-worker-role.cjs'),file],{encoding:'utf8',timeout:5000,detached:true});
 return {child,done:fs.existsSync(request.done)?JSON.parse(fs.readFileSync(request.done)):null,raw:fs.existsSync(request.raw)?fs.readFileSync(request.raw,'utf8'):null};
}
test('expired absolute deadline prevents native invocation',()=>{
 const result=invoke(Date.now()-1,`require('fs').writeFileSync(${JSON.stringify(path.join(root,'should-not-launch'))},'bad');`);
 expect(result.done).toMatchObject({status:null,error:'not_started_deadline'});expect(result.raw).toBe('');expect(fs.existsSync(path.join(root,'should-not-launch'))).toBe(false);
});
test('explicit absolute deadline interrupts actual long-running native process',()=>{
 const result=invoke(Date.now()+300,'setTimeout(()=>process.stdout.write("too late"),1200)');
 expect(result.done).toMatchObject({status:null,error:'ETIMEDOUT'});expect(result.raw).toBe('');
});
test('direct relay within an explicit deadline preserves successful native output',()=>{
 const result=invoke(Date.now()+5000,'setTimeout(()=>process.stdout.write("completed"),350)');
 expect(result.done).toEqual({status:0,error:null});expect(result.raw).toBe('completed');
});
test.each(['invalid',null,0,-1,1.5,Number.MAX_SAFE_INTEGER])('invalid explicit deadline %s fails before launch',value=>{
 const result=invoke(value);expect(result.child.status).not.toBe(0);expect(result.done).toBeNull();expect(result.raw).toBeNull();
});
test('direct observer honors the explicit window beyond the compressed legacy interval',()=>{
 const cli=path.join(root,'native.cjs'),evidence=path.join(root,'evidence');fs.mkdirSync(evidence,{mode:0o700});
 fs.writeFileSync(cli,`#!${process.execPath}\nconst args=process.argv.slice(2),session=args[args.indexOf('--session-id')+1],schema=JSON.parse(args[args.indexOf('--json-schema')+1]);let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>setTimeout(()=>{const b=schema.properties._binding.properties,output={_binding:{role:b.role.const,nonce:b.nonce.const,input_sha256:b.input_sha256.const},claim:'protocol fixture'};for(const e of [{type:'system',subtype:'init',session_id:session,model:'fixture-model',tools:['StructuredOutput'],mcp_servers:[]},{type:'result',subtype:'success',session_id:session,is_error:false,structured_output:output}])process.stdout.write(JSON.stringify(e)+'\\n');},250));`,{mode:0o700});
 // Time compression is explicit: only the host observer's clock advances beyond
 // the legacy interval. The native CLI is a real process and runs to completion.
 const original=Date.now,base=original();let reads=0;const clock=jest.spyOn(Date,'now').mockImplementation(()=>base+(reads++?300000:0));
 try{
  const result=require('../../scripts/improve-worker.cjs').roleCall({role:'oracle',model:'opus',effectiveModel:'fixture-model',prompt:'Protocol fixture',schema:{type:'object',properties:{}},cwd:root,evidence,claude:cli,deadlineAtMs:base+600000});
  expect(result.provenance.model).toBe('fixture-model');
 }finally{clock.mockRestore();}
});

test.each([null, NaN, Infinity, 'invalid', Number.MAX_SAFE_INTEGER])('roleCall rejects missing or invalid direct deadline %s before launch', deadlineAtMs=>{
 expect(()=>require('../../scripts/improve-worker.cjs').roleCall({role:'oracle',model:'opus',effectiveModel:'fixture',prompt:'test',schema:{type:'object',properties:{}},cwd:root,evidence:path.join(root,'evidence'),claude:process.execPath,deadlineAtMs})).toThrow(expect.objectContaining({code:deadlineAtMs===null?'role_deadline_required':'role_deadline_invalid'}));
 expect(fs.existsSync(path.join(root,'evidence'))).toBe(false);
});
function observerCase(mode){
 const identity=require('../../scripts/improve-process-identity.cjs'),originalIdentity=identity.identity,originalState=identity.state;
 const evidence=path.join(root,'evidence'),cli=path.join(root,'waiting-cli');fs.mkdirSync(evidence,{mode:0o700});fs.writeFileSync(cli,`#!${process.execPath}\nsetInterval(()=>{},1000);`,{mode:0o700});
 let spawned;const identitySpy=jest.spyOn(identity,'identity').mockImplementation(pid=>{const value=originalIdentity(pid);if(pid&&pid!==process.pid){spawned=value;if(mode==='missing')return null;}return value;});
 const stateSpy=jest.spyOn(identity,'state').mockImplementation(value=>{
  if(spawned&&value?.pid===spawned.pid){
   if(mode==='unknown')return 'unknown';
   if(mode==='race'){
    const request=JSON.parse(fs.readFileSync(path.join(evidence,fs.readdirSync(evidence).find(f=>f.endsWith('.request.json')))));
    fs.writeFileSync(request.raw,'');fs.writeFileSync(request.stderr,'');fs.writeFileSync(request.done,JSON.stringify({status:1,error:null}));return 'dead';
   }
  }
  return originalState(value);
 });
 try{
  return require('../../scripts/improve-worker.cjs').roleCall({role:'oracle',model:'opus',effectiveModel:'fixture',prompt:'test',schema:{type:'object',properties:{}},cwd:root,evidence,claude:cli,deadlineAtMs:Date.now()+10000});
 }finally{
  identitySpy.mockRestore();stateSpy.mockRestore();
  if(spawned&&originalState(spawned)==='live')require('../../scripts/improve-controller-watchdog.cjs').signalGroup(spawned);
 }
}
test.each(['missing','unknown'])('unavailable relay identity %s reports unknown completion without an infinite wait',mode=>{
 expect(()=>observerCase(mode)).toThrow(expect.objectContaining({code:'role_completion_unknown',retryable:false,next_action:expect.stringContaining('Do not replay')}));
});
test('terminal record arriving during the exit check is processed instead of reported missing',()=>{
 expect(()=>observerCase('race')).toThrow(expect.objectContaining({code:'role_unavailable'}));
});

test('failed spawn with no pid never defaults to the worker identity or signals it',()=>{
 const identity=require('../../scripts/improve-process-identity.cjs'),watch=require('../../scripts/improve-controller-watchdog.cjs');
 const i=jest.spyOn(identity,'identity'),kill=jest.spyOn(watch,'signalGroup');
 try{
  expect(()=>require('../../scripts/improve-worker.cjs').roleCall({role:'oracle',model:'opus',effectiveModel:'fixture',prompt:'test',schema:{type:'object',properties:{}},cwd:root,evidence:path.join(root,'evidence'),claude:process.execPath,deadlineAtMs:Date.now()+5000,authorizeStart:()=>({pid:undefined})})).toThrow(expect.objectContaining({code:'role_not_started'}));
  expect(i).not.toHaveBeenCalled();expect(kill).not.toHaveBeenCalled();
 }finally{i.mockRestore();kill.mockRestore();}
});
