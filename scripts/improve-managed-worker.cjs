'use strict';
// Trusted host adapter for managed worker slots. No repository-provided argv,
// executable, environment or Docker endpoint is accepted by the supervisor.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {canonical}=require('./improve-production-build.cjs');
const identity=require('./improve-process-identity.cjs'),attempts=require('./improve-backend-attempt.cjs');
const need=(v,c='backend_input_invalid')=>{if(!v)throw Error(c);};
const hash=v=>crypto.createHash('sha256').update(canonical(v)).digest('hex');
const bindings=new WeakMap(),handles=new WeakMap();
const slots=['source-producer','build','app','checker','seed'];
const exact=(v,keys)=>{need(v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k)));need(Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>d.enumerable&&Object.hasOwn(d,'value')));};
const absolute=p=>typeof p==='string'&&p.startsWith('/')&&!/[,\r\n\0]/.test(p)&&p.split('/').slice(1).every(x=>x&&x!=='.'&&x!=='..');
function validatePlan(p){
 exact(p,['image','uid','network','memory','mounts','tmpfs','phaseMilliseconds',...(Object.hasOwn(p,'backendProfile')?['backendProfile']:[])]);
 need(typeof p.image==='string'&&/^sha256:[a-f0-9]{64}$/.test(p.image)&&p.image.length===71);
 need(Number.isSafeInteger(p.uid)&&p.uid>0&&Number.isSafeInteger(p.memory)&&p.memory>=16777216&&p.memory<=2147483648);
 need(p.network==='none'||(/^container:[a-f0-9]{64}$/.test(p.network)&&p.network.length===74));
 if(Object.hasOwn(p,'backendProfile')){
  exact(p.backendProfile,['id','sha256','slot']);
  let limits;try{limits=require('./improve-backend-profiles.cjs').workerLimits(p.backendProfile.id,p.backendProfile.slot);}catch{throw Error('backend_input_invalid');}
  need(canonical(p.backendProfile)===canonical(limits.binding)&&p.memory===limits.memory&&p.phaseMilliseconds===limits.phaseMilliseconds&&canonical(p.tmpfs)===canonical(limits.tmpfs));
  need(p.backendProfile.slot==='app'?p.network==='none':/^container:[a-f0-9]{64}$/.test(p.network));
 }else need(Number.isSafeInteger(p.phaseMilliseconds)&&p.phaseMilliseconds>0&&p.phaseMilliseconds<=600000);
 need(Array.isArray(p.mounts)&&p.mounts.length<=256&&Array.isArray(p.tmpfs)&&p.tmpfs.length<=8);
 for(const m of p.mounts){exact(m,['source','destination','writable']);need(absolute(m.source)&&absolute(m.destination)&&m.writable===false);}
 for(const t of p.tmpfs){exact(t,['path','bytes']);need(absolute(t.path)&&Number.isSafeInteger(t.bytes)&&t.bytes>0&&t.bytes<=2147483648);}
 need(new Set(['/tmp',...p.mounts.map(m=>m.destination),...p.tmpfs.map(t=>t.path)]).size===1+p.mounts.length+p.tmpfs.length);
 return JSON.parse(canonical(p));
}
function createArgs(p,name){
 p=validatePlan(p);if(p.backendProfile)need(name.endsWith('-'+p.backendProfile.slot));need(/^specflow-[a-f0-9-]{36}-(source-producer|build|app|checker|seed)$/.test(name));
 return ['create','--name',name,'--label','specflow.worker=owned','--entrypoint','/node/bin/node','--network',p.network,
 '--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user',`${p.uid}:${p.uid}`,'--pids-limit','128','--cpus','1',
 '--memory',String(p.memory),'--memory-swap',String(p.memory),'--env','PATH=/node/bin:/usr/bin:/bin','--env','HOME=/tmp',
 '--tmpfs','/tmp:rw,nosuid,nodev,noexec,size=128m,mode=1777',
 ...p.mounts.flatMap(m=>['--mount',`type=bind,src=${m.source},dst=${m.destination}${m.writable?'':',readonly'}`]),
 ...p.tmpfs.flatMap(t=>['--tmpfs',`${t.path}:rw,nosuid,nodev,noexec,size=${t.bytes},mode=0700,uid=${p.uid},gid=${p.uid}`]),p.image,'-e','setInterval(()=>{},1000)'];
}
function workerFingerprint(c,expectedHostname){
 if(expectedHostname!==undefined){
  need(/^container:[a-f0-9]{64}$/.test(c.HostConfig?.NetworkMode||'')&&typeof expectedHostname==='string'&&/^[a-zA-Z0-9_.-]{1,64}$/.test(expectedHostname),'backend_input_changed');
  const initial=c.State?.Status==='created'&&/^[a-f0-9]{64}$/.test(c.Id||'')&&c.Config?.Hostname===c.Id.slice(0,12);
  need(c.Config?.Hostname===expectedHostname||initial,'backend_input_changed');
 }
 return require('./improve-backend-supervisor.cjs').fingerprint(c,true,expectedHostname);
}
function bind(worker,{store,attempt,authorize}){
 const {DockerWorker,DurableStore}=require('./improve-worker.cjs');
 need(worker instanceof DockerWorker&&store instanceof DurableStore&&worker.jobId===attempt.jobId&&typeof authorize==='function');
 need(!bindings.has(worker));authorize();attempts.read(store,attempt);
 bindings.set(worker,{store,attempt,authorize,slot:null});handles.set(worker,new Map());
}
function context(worker){const b=bindings.get(worker);if(!b)return null;b.authorize();attempts.read(b.store,b.attempt);return Object.freeze({store:b.store,attempt:JSON.parse(canonical(b.attempt))});}
function select(worker,slot){const b=bindings.get(worker);need(b&&slots.includes(slot)&&b.slot===null);b.authorize();b.slot=slot;}
function readFile(file){const fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{const s=fs.fstatSync(fd);need(s.isFile()&&s.uid===process.getuid()&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size<=65536);return require('./improve-worker.cjs').strictJSON(fs.readFileSync(fd,'utf8'));}finally{fs.closeSync(fd);}}
function write(file,value){const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{fs.writeFileSync(fd,canonical(value));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}const parent=fs.openSync(path.dirname(file),fs.constants.O_RDONLY|fs.constants.O_DIRECTORY|fs.constants.O_NOFOLLOW);try{fs.fsyncSync(parent);}finally{fs.closeSync(parent);}}
const pause=()=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,20);
function waitFile(file,b,child,deadline){for(;;){try{return readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}if(Date.now()>=deadline||identity.state(child)!=='live'){attempts.operatorRequired(b.store,b.attempt);throw Error('backend_cleanup_unconfirmed');}pause();}}
function create(worker,raw){
 const b=bindings.get(worker);if(!b)return null;
 b.authorize();const attempt=attempts.read(b.store,b.attempt),slot=b.slot;need(slots.includes(slot));b.slot=null;
 const plan=validatePlan(raw);if(plan.backendProfile)need(plan.backendProfile.slot===slot);const root=fs.mkdtempSync(path.join(attempts.envelope(b.store,b.attempt),'managed-create-'));fs.chmodSync(root,0o700);
 const end=Math.min(attempt.deadlineAtMs,Date.now()+plan.phaseMilliseconds);
 const value={schema:'specflow.managed-worker/v1',storeRoot:b.store.root,sourceRoot:b.store.sourceRoot,attempt:b.attempt,slot,plan,controller:identity.identity(),root,deadlineAtMs:end};
 write(path.join(root,'descriptor.json'),{value,mac:b.store.mac(JSON.parse(canonical(value)))});
 const child=cp.spawn(process.execPath,[path.join(__dirname,'improve-worker-watchdog.cjs'),'--intent',path.join(root,'descriptor.json')],{env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent'},stdio:'ignore',detached:true});
 child.on('error',()=>{});child.unref();
 need(Number.isSafeInteger(child.pid)&&child.pid>1,'backend_attempt_owner_unavailable');
 const childIdentity=identity.identity(child.pid);need(childIdentity,'backend_attempt_owner_unavailable');
 const ready=waitFile(path.join(root,'ready.json'),b,childIdentity,end);
 need(ready.state==='ready'&&ready.planSha256===hash(plan)&&canonical(ready.supervisor)===canonical(childIdentity));
 b.authorize();write(path.join(root,'dispatch.json'),{attemptId:b.attempt.attemptId,slot});
 const result=waitFile(path.join(root,'result.json'),b,childIdentity,end);
 need(result.state==='started'&&typeof result.id==='string'&&/^[a-f0-9]{64}$/.test(result.id),'backend_cleanup_unconfirmed');
 const events=attempts.resourceEvents(b.store,b.attempt,slot);need(events.some(e=>e.state==='started'&&e.id===result.id));
 handles.get(worker).set(result.id,{root,slot,childIdentity,end});return result.id;
}
function destroy(worker,id){
 const b=bindings.get(worker);if(!b)return false;
 const h=handles.get(worker).get(id);need(h,'backend_cleanup_unconfirmed');
 try{write(path.join(h.root,'stop.json'),{attemptId:b.attempt.attemptId,slot:h.slot});}catch(e){if(e.code!=='EEXIST')throw e;}
 const result=waitFile(path.join(h.root,'terminal.json'),b,h.childIdentity,h.end);
 need(result.state==='removed'&&result.id===id,'backend_cleanup_unconfirmed');
 need(attempts.resourceEvents(b.store,b.attempt,h.slot).some(e=>e.state==='removed'&&e.id===id),'backend_cleanup_unconfirmed');
 handles.get(worker).delete(id);return true;
}
module.exports={bind,context,select,create,destroy,validatePlan,createArgs,workerFingerprint};

// Invoked only by the watchdog's separate intent mode. The supervisor owns the
// create response for its lifetime; a controller exit cannot cancel that response.
async function runIntent(file){
 const {DurableStore,validateInspection}=require('./improve-worker.cjs');
 const descriptor=readFile(file);exact(descriptor,['value','mac']);const d=descriptor.value;
 exact(d,['schema','storeRoot','sourceRoot','attempt','slot','plan','controller','root','deadlineAtMs']);
 need(d.schema==='specflow.managed-worker/v1'&&absolute(d.storeRoot)&&absolute(d.sourceRoot)&&absolute(d.root)&&slots.includes(d.slot));
 const store=new DurableStore({root:d.storeRoot,sourceRoot:d.sourceRoot});
 need(typeof descriptor.mac==='string'&&descriptor.mac.length===64&&/^[a-f0-9]+$/.test(descriptor.mac));
 need(crypto.timingSafeEqual(Buffer.from(descriptor.mac,'hex'),Buffer.from(store.mac(JSON.parse(canonical(d))),'hex')));
 const a=attempts.read(store,d.attempt),p=validatePlan(d.plan),self=identity.identity();
 if(p.backendProfile)need(p.backendProfile.slot===d.slot);
 need(canonical(a.owner)===canonical(d.controller)&&identity.state(d.controller)==='live');
 const intent=attempts.intent(store,d.attempt,{slot:d.slot,expectedConfigSha256:hash(p),creator:d.controller,supervisor:self});
 need(Number.isSafeInteger(d.deadlineAtMs)&&d.deadlineAtMs<=a.deadlineAtMs&&d.deadlineAtMs<=Date.now()+p.phaseMilliseconds);
 const end=d.deadlineAtMs,executionEnd=end-10000;
 const monoEnd=performance.now()+Math.max(0,end-Date.now());
 const remaining=()=>Math.max(1,Math.min(end-Date.now(),monoEnd-performance.now()));
 const live=()=>identity.state(d.controller)==='live'&&Date.now()<executionEnd&&performance.now()<monoEnd-10000;
 const event=(state,id=null,inspectionSha256=null)=>attempts.resourceEvent(store,d.attempt,d.slot,{state,id,inspectionSha256});
 const output=(name,value)=>write(path.join(d.root,name+'.json'),value);
 let id=null,anchor=null,expectedHostname,dispatched=false,unknown=false;
 const sleep=()=>new Promise(resolve=>setTimeout(resolve,20));
 async function docker(args){
  return new Promise((resolve,reject)=>{
   const child=cp.spawn('/usr/bin/docker',['--host','unix:///var/run/docker.sock',...args],{env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'},stdio:['ignore','pipe','pipe']});
   let out='',err='',bytes=0,limited=false;const timer=setTimeout(()=>{limited=true;child.kill('SIGKILL');},remaining());
   for(const [stream,key]of [[child.stdout,'out'],[child.stderr,'err']])stream.on('data',b=>{bytes+=b.length;if(bytes>262144){limited=true;child.kill('SIGKILL');return;}if(key==='out')out+=b;else err+=b;});
   child.on('error',()=>{limited=true;});child.on('close',code=>{clearTimeout(timer);if(limited)reject(Error('backend_cleanup_unconfirmed'));else resolve({code,out,err});});
  });
 }
 const inspect=async target=>{const r=await docker(['container','inspect',target]);if(r.code===1&&/No such (container|object)/i.test(r.err))return null;need(r.code===0,'backend_cleanup_unconfirmed');const list=JSON.parse(r.out);need(Array.isArray(list)&&list.length===1);return list[0];};
 const fingerprint=c=>workerFingerprint(c,expectedHostname);
 const owned=c=>{try{return c&&c.Id===id&&c.Name==='/'+intent.name&&c.Image===p.image&&c.Config?.Labels?.['specflow.worker']==='owned'&&fingerprint(c)===anchor;}catch{return false;}};
 try{
  output('ready',{state:'ready',supervisor:self,planSha256:hash(p)});
  while(live()){
   try{const command=readFile(path.join(d.root,'dispatch.json'));exact(command,['attemptId','slot']);need(command.attemptId===d.attempt.attemptId&&command.slot===d.slot);break;}
   catch(e){if(e.code!=='ENOENT')throw e;}await sleep();
  }
  if(!live()){event('not_dispatched');output('terminal',{state:'not_dispatched',id:null});return;}
  // Recheck operator fencing immediately before dispatch. A recorded dispatch
  // with no returned ID is unknown even when inspect currently reports absence.
  if(p.network.startsWith('container:')){
   const networkId=p.network.slice('container:'.length),networkOwner=await inspect(networkId);
   need(networkOwner?.Id===networkId&&networkOwner.State.Running&&!networkOwner.State.Paused,'backend_service_died');
   expectedHostname=networkOwner.Config.Hostname;
  }
  event('dispatching');dispatched=true;
  const created=await docker(createArgs(p,intent.name));
  if(created.code!==0||!(/^[a-f0-9]{64}$/.test(created.out.trim()))){unknown=true;throw Error('backend_cleanup_unconfirmed');}
  id=created.out.trim();const c=await inspect(id);
  need(c&&c.Id===id&&c.Name==='/'+intent.name&&c.Image===p.image,'backend_input_changed');
  const expected={image:p.image,uid:p.uid,network:p.network,memory:p.memory,mounts:p.mounts,tmpfs:['/tmp',...p.tmpfs.map(t=>t.path)]};
  validateInspection(c,expected);need(!c.State.Running,'backend_input_changed');anchor=fingerprint(c);event('created',id,anchor);
  if(live()){
   const start=await docker(['start',id]);need(start.code===0,'backend_service_died');const running=await inspect(id);
   need(owned(running)&&running.State.Running&&!running.State.Paused,'backend_input_changed');event('started',id,anchor);
   output('result',{state:'started',id});
   while(live()){
    try{const command=readFile(path.join(d.root,'stop.json'));exact(command,['attemptId','slot']);need(command.attemptId===d.attempt.attemptId&&command.slot===d.slot);break;}
    catch(e){if(e.code!=='ENOENT')throw e;}await sleep();
   }
  }
 }catch{if(dispatched&&!id)unknown=true;}
 try{
  if(unknown||Date.now()>=end||performance.now()>=monoEnd)throw Error('backend_cleanup_unconfirmed');
  if(!dispatched){event('not_dispatched');output('terminal',{state:'not_dispatched',id:null});return;}
  need(id&&anchor,'backend_cleanup_unconfirmed');const c=await inspect(id);
  if(c){if(!owned(c)){event('foreign',id);throw Error('backend_cleanup_unconfirmed');}const removed=await docker(['container','rm','--force',id]);need(removed.code===0,'backend_cleanup_unconfirmed');}
  need(await inspect(id)===null,'backend_cleanup_unconfirmed');event('removed',id,anchor);output('terminal',{state:'removed',id});
 }catch{
  try{event('unconfirmed',id);}catch{/* Existing event/corruption remains fenced. */}
  attempts.operatorRequired(store,d.attempt);try{output('terminal',{state:'operator_required',id});}catch{/* Never replace a prior terminal. */}
 }
}
module.exports.runIntent=runIntent;
