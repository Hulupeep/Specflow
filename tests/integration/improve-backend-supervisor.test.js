const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const processIdentity=require('../../scripts/improve-process-identity.cjs');
// Real subprocess/SIGKILL proof for independent monitoring. This does not qualify
// Docker cleanup: pinned service creation and owned/foreign controls are separate.
test('independent monitor records controller death after SIGKILL',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'backend-monitor-'));fs.chmodSync(root,0o700);
 const controller=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
 const closed=new Promise(resolve=>controller.once('close',resolve));let monitor;
 try {
  const identity=processIdentity.identity(controller.pid);expect(identity).not.toBeNull();
  const modulePath=path.resolve('scripts/improve-backend-supervisor.cjs');
  const code=`const fs=require('fs');const {BackendJournal,monitorJournal}=require(process.argv[1]);const j=new BackendJournal({root:process.argv[2],jobId:'process-test',generation:'generation-1',controller:JSON.parse(process.argv[3])});fs.writeFileSync(process.argv[2]+'/ready','ready');monitorJournal(j).then(s=>{fs.writeFileSync(process.argv[2]+'/terminal.json',JSON.stringify(s));j.close();}).catch(()=>{j.close();process.exitCode=2;});`;
  monitor=cp.spawn(process.execPath,['-e',code,modulePath,root,JSON.stringify(identity)],{stdio:['ignore','pipe','pipe']});
  let stderr='';monitor.stderr.on('data',b=>stderr+=b);
  const monitorDone=new Promise(resolve=>monitor.once('close',resolve));
  const end=Date.now()+10000;
  while(!fs.existsSync(path.join(root,'ready'))&&Date.now()<end){if(monitor.exitCode!==null)throw Error('monitor exited: '+stderr);await new Promise(r=>setTimeout(r,20));}
  expect(fs.existsSync(path.join(root,'ready'))).toBe(true);
  controller.kill('SIGKILL');await closed;
  const status=await Promise.race([monitorDone,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('monitor timeout')),10000);timer.unref();})]);
  expect(status).toBe(0);const s=JSON.parse(fs.readFileSync(path.join(root,'terminal.json')));
  expect(s).toMatchObject({phase:'cleaned',cause:'backend_controller_died',successReceipt:false,resources:[]});
  expect(s.controller).toEqual(identity);expect(s.deadlineEpochMs-s.startedEpochMs).toBe(300000);
 }finally{if(controller.exitCode===null)controller.kill('SIGKILL');if(monitor&&monitor.exitCode===null)monitor.kill('SIGKILL');fs.rmSync(root,{recursive:true,force:true});}
},20000);
