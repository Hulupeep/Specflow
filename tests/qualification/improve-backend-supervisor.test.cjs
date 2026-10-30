'use strict';
// Mandatory live Docker ownership/monitor qualification, run explicitly with
// node --test. No skip path and no pretend Auth/database readiness claim.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const identity=require('../../scripts/improve-process-identity.cjs');
const {RECIPE}=require('../../scripts/improve-backend.cjs');
function docker(args){const r=cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,maxBuffer:262144,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});assert.equal(r.status,0,'Docker operation failed: '+args[0]);return r.stdout;}
const inspect=id=>JSON.parse(docker(['inspect',id]))[0];
function anchor(name){return docker(['run','-d','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','268435456','--memory-swap','268435456','--cpus','1','--pids-limit','64','--user','postgres','--entrypoint','/bin/sh',RECIPE.images.database,'-c','sleep 120']).trim();}
async function waitFile(file,child,diagnostic=()=>""){const deadline=Date.now()+15000;while(!fs.existsSync(file)){assert(child.exitCode===null,'supervisor exited before readiness: '+diagnostic());assert(Date.now()<deadline,'readiness timeout');await new Promise(r=>setTimeout(r,25));}}
for(const scenario of ['controller_after_ack','controller_before_ack','service_death','phase_lease_expiry'])test(scenario,{timeout:45000},async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'backend-docker-monitor-'));fs.chmodSync(root,0o700);
 const name='sf-monitor-test-'+crypto.randomUUID();let a,foreign,monitor,controller,owned;
 try{
  a=anchor(name+'-anchor');foreign=anchor(name+'-foreign');
  controller=cp.spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});
  const controllerDone=new Promise(r=>controller.once('close',r));
  const controllerIdentity=identity.identity(controller.pid);assert(controllerIdentity);
  const modulePath=path.resolve('scripts/improve-backend-supervisor.cjs');
  const code=`
const fs=require('fs'),cp=require('child_process');const {BackendJournal,monitorJournal}=require(process.argv[1]);
const [root,anchor,scenario,controller]=process.argv.slice(2);const j=new BackendJournal({root,jobId:'live-monitor',generation:'generation-1',controller:JSON.parse(controller)});
const call=args=>{const r=cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{encoding:'utf8',timeout:10000,maxBuffer:262144,env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});if(r.status!==0)throw Error('docker_failed');return r.stdout;};
const s=j.reserve('database');const args=['create','--name',s.name,'--network','container:'+anchor,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--memory','268435456','--memory-swap','268435456','--cpus','1','--pids-limit','64','--user','postgres','--log-driver','local','--log-opt','max-size=1m','--log-opt','max-file=1','--log-opt','compress=false'];
for(const [k,v]of Object.entries({job:'live-monitor',generation:'generation-1',reservation:s.reservation,role:s.role}))args.push('--label','specflow.backend.'+k+'='+v);
args.push('--entrypoint','/bin/sh',s.image,'-c','sleep 120');const id=call(args).trim();fs.writeFileSync(root+'/owned',id);
if(scenario!=='controller_before_ack'){const before=JSON.parse(call(['inspect',id]))[0];j.created('database',before,JSON.parse(call(['inspect',anchor]))[0]);call(['start',id]);const after=JSON.parse(call(['inspect',id]))[0];try{j.started('database',after);}catch(error){const changes=[];function walk(a,b,p){if(JSON.stringify(a)===JSON.stringify(b))return;if(a&&b&&typeof a==='object'&&typeof b==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b)]))walk(a[k],b[k],p+'.'+k);}else changes.push({path:p,beforeType:typeof a,afterType:typeof b});}for(const k of ['Config','HostConfig','Mounts'])walk(before[k],after[k],k);process.stderr.write(JSON.stringify({changes,running:after.State.Running,exitCode:after.State.ExitCode})+'\\n');throw error;}}
if(scenario==='phase_lease_expiry'){j.phase('bootstrap');j.phase('readiness');j.phase('measured');}
fs.writeFileSync(root+'/ready','ready');monitorJournal(j).then(state=>{fs.writeFileSync(root+'/terminal.json',JSON.stringify(state));j.close();}).catch(()=>{j.close();process.exitCode=2;});`;
  monitor=cp.spawn(process.execPath,['-e',code,modulePath,root,a,scenario,JSON.stringify(controllerIdentity)],{stdio:['ignore','pipe','pipe']});
  let diagnostic='';monitor.stderr.on('data',b=>{if(diagnostic.length<4096)diagnostic+=b;});
  const monitorDone=new Promise(r=>monitor.once('close',r));await waitFile(path.join(root,'ready'),monitor,()=>diagnostic);owned=fs.readFileSync(path.join(root,'owned'),'utf8');
  if(scenario.startsWith('controller_')){controller.kill('SIGKILL');await controllerDone;}
  if(scenario==='service_death')docker(['kill',owned]);
  const result=await Promise.race([monitorDone,new Promise((_,reject)=>{const t=setTimeout(()=>reject(Error('supervisor terminal timeout')),25000);t.unref();})]);assert.equal(result,0,diagnostic);const state=JSON.parse(fs.readFileSync(path.join(root,'terminal.json')));
  assert.equal(state.phase,'cleaned');assert.equal(state.cause,scenario.startsWith('controller_')?'backend_controller_died':scenario==='service_death'?'backend_service_died':'backend_lease_expired');
  assert.equal(state.successReceipt,false);assert.equal(state.resources.length,1);assert.equal(state.resources[0].status,'removed');
  assert.equal(state.resources[0].id,owned);assert.equal(state.deadlineEpochMs-state.startedEpochMs,300000);
  const gone=cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock','inspect',owned],{encoding:'utf8',timeout:5000});assert.notEqual(gone.status,0);assert.match(gone.stderr,/No such (object|container)/i);
  assert.equal(inspect(foreign).State.Running,true);assert.equal(inspect(a).State.Running,true);
 }finally{
  if(controller&&controller.exitCode===null)controller.kill('SIGKILL');if(monitor&&monitor.exitCode===null)monitor.kill('SIGKILL');
  if(!owned&&fs.existsSync(path.join(root,'owned')))owned=fs.readFileSync(path.join(root,'owned'),'utf8');
  for(const id of [owned,foreign,a].filter(Boolean))cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock','rm','-f',id],{stdio:'ignore',timeout:10000});
  fs.rmSync(root,{recursive:true,force:true});
 }
});
