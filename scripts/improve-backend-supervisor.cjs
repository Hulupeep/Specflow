'use strict';
// Durable ownership journal used by the trusted backend supervisor (#293).
// A journal is not a backend capability and never grants verification success.
const fs=require('fs'), crypto=require('crypto');
const {directory}=require('./improve-offline-cache.cjs');
const {canonical}=require('./improve-production-build.cjs');
const {PROFILE,RECIPE,FAILURE_CAUSES}=require('./improve-backend.cjs');
const processIdentity=require('./improve-process-identity.cjs');
const profiles=require('./improve-backend-profiles.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const validId=x=>typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(x);
const clone=x=>JSON.parse(JSON.stringify(x));
const need=(ok,code='backend_restart_invalid')=>{if(!ok)throw Error(code);};
const imageFor=role=>RECIPE.images[role==='authMigration'?'auth':role];
const roles=['database','authMigration','auth','rest','gateway'];
const phaseLimits=profile=>({initializing:profile.time.bootstrapMilliseconds,bootstrap:profile.time.bootstrapMilliseconds,
 readiness:profile.time.readinessMilliseconds,measured:profile.time.measurementMilliseconds,
 execution:profile.time.executionMilliseconds,quiescing:profile.time.cleanupMilliseconds});
const nextPhase={initializing:'bootstrap',bootstrap:'readiness',readiness:'measured',measured:'execution',execution:'quiescing'};
function fingerprint(c,normalizeCreation=false,expectedHostname) {
 const host=clone(c.HostConfig),config=clone(c.Config);if(normalizeCreation&&host.OomKillDisable===false)host.OomKillDisable=null;
 if(expectedHostname!==undefined)config.Hostname=expectedHostname;
 return hash(canonical({image:c.Image,config,host,mounts:[...c.Mounts].sort((a,b)=>a.Destination.localeCompare(b.Destination))}));
}
function owned(c,state,slot) {
 return !!c&&/^[a-f0-9]{64}$/.test(c.Id)&&(!slot.id||slot.id===c.Id)&&c.Image===slot.image&&
 c.Name==='/'+slot.name&&c.Config?.Labels?.['specflow.backend.job']===state.jobId&&
 c.Config.Labels['specflow.backend.generation']===state.generation&&
 c.Config.Labels['specflow.backend.reservation']===slot.reservation&&c.Config.Labels['specflow.backend.role']===slot.role;
}
class BackendJournal {
 #fd; #state; #monoStart; #phaseMono; #closed=false; #attemptId; #profile; #phaseLimits;
 constructor({root,jobId,generation,controller,attemptId,deadlineAtMs,resourceProfile=PROFILE.id}) {
  this.#profile=profiles.profileFor(resourceProfile);this.#phaseLimits=phaseLimits(this.#profile);
  if(attemptId!==undefined)need(typeof attemptId==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(attemptId)&&attemptId.length===36,'backend_input_invalid');
  if(deadlineAtMs!==undefined)need(Number.isSafeInteger(deadlineAtMs)&&deadlineAtMs>Date.now(),'backend_lease_expired');
  this.#attemptId=attemptId;
  need(validId(jobId)&&validId(generation)&&processIdentity.state(controller)==='live','backend_input_invalid');
  this.#fd=directory(root);
  try {
   const stat=fs.fstatSync(this.#fd);need(stat.uid===process.getuid()&&!(stat.mode&0o077),'backend_input_invalid');
   this.#monoStart=this.#phaseMono=performance.now();const now=Date.now();
   this.#state={schema:'specflow.backend-journal/v1',jobId,generation,controller:clone(controller),startedEpochMs:now,
    resourceProfile,resourceProfileSha256:hash(profiles.profileBytes(resourceProfile)),
    deadlineEpochMs:Math.min(now+this.#profile.time.totalMilliseconds,deadlineAtMs??Infinity),phaseDeadlineEpochMs:Math.min(now+this.#phaseLimits.initializing,deadlineAtMs??Infinity),
    phase:'initializing',cause:null,resources:[],outputBytes:0,successReceipt:false};
   const initial=fs.openSync(this.#at('journal.json'),fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
   try{fs.writeFileSync(initial,canonical(this.#state));fs.fsyncSync(initial);}finally{fs.closeSync(initial);}fs.fsyncSync(this.#fd);
  }catch(e){fs.closeSync(this.#fd);this.#closed=true;throw e;}
 }
 #at(name){return `/proc/self/fd/${this.#fd}/${name}`;}
 #persist(){
  need(!this.#closed);const name='.journal-'+crypto.randomUUID();const file=fs.openSync(this.#at(name),fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
  try{fs.writeFileSync(file,canonical(this.#state));fs.fsyncSync(file);}finally{fs.closeSync(file);}
  fs.renameSync(this.#at(name),this.#at('journal.json'));fs.fsyncSync(this.#fd);
 }
 snapshot(){return clone(this.#state);}
 #active(){need(!this.#closed&&!['failing','cleaned','cleanup_failed'].includes(this.#state.phase));}
 reserve(role){
  this.#active();need(roles.includes(role)&&!this.#state.resources.some(r=>r.role===role),'backend_input_invalid');
  const reservation=crypto.randomUUID(),name=this.#attemptId?'specflow-'+this.#attemptId+'-'+role:'sf-backend-'+hash(canonical({job:this.#state.jobId,generation:this.#state.generation,role,reservation})).slice(0,40);
  const slot={role,image:imageFor(role),name,reservation,id:null,status:'reserved',createdFingerprint:null,startupFingerprint:null,runningFingerprint:null,outputBytes:0};
  this.#state.resources.push(slot);this.#persist();return clone(slot);
 }
 #slot(role){const slot=this.#state.resources.find(r=>r.role===role);need(slot,'backend_input_invalid');return slot;}
 created(role,c,anchor){
  if(!(this.#attemptId&&this.#state.phase==='failing'))this.#active();const slot=this.#slot(role);need(slot.status==='reserved'&&owned(c,this.#state,slot),'backend_input_changed');
  const h=c.HostConfig,limits=PROFILE.slots[role];
  need(anchor&&/^[a-f0-9]{64}$/.test(anchor.Id)&&anchor.State?.Running&&
   typeof anchor.Config?.Hostname==='string'&&/^[A-Za-z0-9.-]{1,64}$/.test(anchor.Config.Hostname)&&
   h.NetworkMode==='container:'+anchor.Id,'backend_input_changed');
  need(h.ReadonlyRootfs&&!h.Privileged&&h.CapDrop?.includes('ALL')&&!(h.CapAdd||[]).length&&
   h.SecurityOpt?.includes('no-new-privileges')&&!(h.SecurityOpt||[]).some(x=>x.includes('unconfined'))&&
   h.Memory===limits.memoryBytes&&h.MemorySwap===limits.memorySwapBytes&&h.NanoCpus===limits.cpus*1e9&&h.PidsLimit===limits.pids&&
   /^container:[a-f0-9]{64}$/.test(h.NetworkMode)&&!h.PidMode&&h.IpcMode!=='host'&&
   !Object.keys(h.PortBindings||{}).length&&!c.State.Running,'backend_input_changed');
  slot.id=c.Id;slot.anchor={id:anchor.Id,hostname:anchor.Config.Hostname};
  // Sign the exact acknowledged object, including Docker's pre-start hostname.
  // Normalization belongs only to the checked create -> running transition.
  slot.createdFingerprint=fingerprint(c);slot.startupFingerprint=fingerprint(c,true,slot.anchor.hostname);slot.status='created';this.#persist();
 }
 started(role,c){
  this.#active();const slot=this.#slot(role);need(slot.status==='created'&&owned(c,this.#state,slot)&&
   !c.State.Paused&&c.Config.Hostname===slot.anchor.hostname&&fingerprint(c,true)===slot.startupFingerprint,'backend_input_changed');
  const completed=role==='authMigration'&&c.State.Status==='exited'&&!c.State.OOMKilled&&c.State.ExitCode===0&&
   Number.isFinite(Date.parse(c.State.StartedAt))&&Date.parse(c.State.StartedAt)>=this.#state.startedEpochMs&&Date.parse(c.State.FinishedAt)>=Date.parse(c.State.StartedAt);
  need(c.State.Running||completed,'backend_service_died');
  slot.runningFingerprint=fingerprint(c);slot.status=completed?'completed':'running';this.#persist();
 }
 phase(next){
  this.#active();need(nextPhase[this.#state.phase]===next,'backend_restart_invalid');
  this.check();this.#active();const initializing=this.#state.phase==='initializing';this.#state.phase=next;if(!initializing)this.#phaseMono=performance.now();
  this.#state.phaseDeadlineEpochMs=Math.min(this.#state.deadlineEpochMs-(next==='quiescing'?0:PROFILE.time.cleanupMilliseconds),(initializing?this.#state.startedEpochMs:Date.now())+this.#phaseLimits[next]);this.#persist();
 }
 fail(cause,detail){
  need(FAILURE_CAUSES.includes(cause),'backend_input_invalid');if(['cleaned','cleanup_failed'].includes(this.#state.phase))return;
  if(this.#state.phase!=='failing') {this.#state.cause=cause;if(typeof detail==='string'&&/^[A-Za-z_]{1,120}$/.test(detail))this.#state.failureDetail=detail;this.#state.phase='failing';this.#phaseMono=performance.now();
   this.#state.phaseDeadlineEpochMs=Math.min(this.#state.deadlineEpochMs,Date.now()+PROFILE.time.cleanupMilliseconds);this.#persist();}
 }
 check(){
  this.#active();const s=this.#state;
  const controllerState=processIdentity.state(s.controller);
  if(controllerState==='dead')this.fail('backend_controller_died');
  else if(controllerState!=='live')this.fail('backend_restart_invalid');
  else if(Date.now()>=s.phaseDeadlineEpochMs||Date.now()>=s.deadlineEpochMs||performance.now()-this.#monoStart>=this.#profile.time.totalMilliseconds||performance.now()-this.#phaseMono>=this.#phaseLimits[s.phase])this.fail('backend_lease_expired');
  return this.snapshot();
 }
 observe(role,c){
  this.#active();const slot=this.#slot(role);need(['running','completed'].includes(slot.status));
  if(c===null){this.fail('backend_service_died');return;}
  if(!owned(c,this.#state,slot)||fingerprint(c)!==slot.runningFingerprint){this.fail('backend_input_changed');return;}
  if(slot.status==='completed'){if(role!=='authMigration'||c.State.Running||c.State.Paused||c.State.ExitCode!==0||c.State.OOMKilled)this.fail('backend_input_changed');return;}
  if(!c.State.Running||c.State.Paused){
   if(role==='authMigration'&&!c.State.Running&&c.State.ExitCode===0&&!c.State.OOMKilled){slot.status='completed';this.#persist();}
   else this.fail('backend_service_died');
  }
 }
 output(role,bytes){
  this.#active();need(Number.isSafeInteger(bytes)&&bytes>=0,'backend_input_invalid');const slot=this.#slot(role);
  need(Number.isSafeInteger(slot.outputBytes+bytes)&&Number.isSafeInteger(this.#state.outputBytes+bytes),'backend_input_invalid');
  slot.outputBytes+=bytes;this.#state.outputBytes+=bytes;
  if(slot.outputBytes>PROFILE.output.perServiceBytes||this.#state.outputBytes>PROFILE.output.aggregateBytes)this.fail('backend_output_limit');else this.#persist();
 }
 cleanupTarget(role,c){
  need(['failing','quiescing'].includes(this.#state.phase));const slot=this.#slot(role);
  need(owned(c,this.#state,slot),'backend_input_changed');
  // Resolve a reserved name after create returned but before its acknowledgement.
  // Persist the exact ID before removal; image and all four ownership labels must match.
  if(!slot.id){slot.id=c.Id;this.#persist();}return slot.id;
 }
 removed(role,observedAbsent){
  need(['failing','quiescing'].includes(this.#state.phase));need(observedAbsent===true,'backend_cleanup_failed');
  const slot=this.#slot(role);slot.status='removed';this.#persist();
 }
 finishCleanup(){
  need(['failing','quiescing'].includes(this.#state.phase));const all=this.#state.resources.every(r=>r.status==='removed');
  const timely=Date.now()<=this.#state.phaseDeadlineEpochMs&&performance.now()-this.#phaseMono<=PROFILE.time.cleanupMilliseconds;
  this.#state.phase=all&&timely?'cleaned':'cleanup_failed';if(!all||!timely)this.#state.cleanupCause='backend_cleanup_failed';
  this.#persist();return this.snapshot();
 }
 cleanupFailed(){
  need(['cleaned','cleanup_failed'].includes(this.#state.phase));
  this.#state.phase='cleanup_failed';this.#state.cleanupCause='backend_cleanup_failed';this.#persist();return this.snapshot();
 }
 close(){if(!this.#closed){this.#closed=true;fs.closeSync(this.#fd);}}
}
module.exports={BackendJournal,fingerprint};

// Closed host operations. No caller-selected executable, Docker arguments or env.
async function dockerRead(kind, target, timeoutMs) {
 need(['inspect','remove'].includes(kind)&&typeof target==='string'&&
  (/^[a-f0-9]{64}$/.test(target)||(/^sf-backend-[a-f0-9]{40}$/.test(target)||/^specflow-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}-(database|authMigration|auth|rest|gateway)$/.test(target))),'backend_input_invalid');
 const {spawn}=require('child_process');
 const args=['--host','unix:///var/run/docker.sock',...(kind==='inspect'?['container','inspect',target]:['container','rm','--force',target])];
 return new Promise((resolve,reject)=>{
  const child=spawn('/usr/bin/docker',args,{env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'},stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',bytes=0,limit=false;
  // A forced removal can outlast a read-only inspection under host load.
  // Both remain inside the journal's original, finite cleanup lease.
  const operationLimit=kind==='remove'?20000:2000;
  const timer=setTimeout(()=>{limit=true;child.kill('SIGKILL');},Math.max(1,Math.min(operationLimit,timeoutMs)));
  for(const [stream,name] of [[child.stdout,'stdout'],[child.stderr,'stderr']])stream.on('data',b=>{bytes+=b.length;if(bytes>262144){limit=true;child.kill('SIGKILL');return;}if(name==='stdout')stdout+=b;else stderr+=b;});
  child.on('error',()=>{clearTimeout(timer);reject(Error('backend_readiness_failed'));});
  child.on('close',code=>{clearTimeout(timer);if(limit)return reject(Error('backend_readiness_failed'));
   if(kind==='inspect'&&code===1&&/No such (container|object)/i.test(stderr))return resolve(null);
   if(code!==0)return reject(Error('backend_readiness_failed'));
   try{if(kind==='remove')return resolve(true);const list=JSON.parse(stdout);need(Array.isArray(list)&&list.length===1);resolve(list[0]);}catch{reject(Error('backend_input_changed'));}
  });
 });
}
async function cleanupJournal(journal) {
 const s=journal.snapshot();need(['failing','quiescing'].includes(s.phase));
 // Run owned removals concurrently so N services do not each acquire a fresh lease.
 const end=s.phaseDeadlineEpochMs,monoEnd=performance.now()+Math.max(0,Math.min(PROFILE.time.cleanupMilliseconds,end-Date.now()));
 const remaining=()=>Math.max(1,Math.min(end-Date.now(),monoEnd-performance.now()));
 await Promise.all(s.resources.map(async slot=>{
  try {
   if(slot.status==='removed')return;
   const current=await dockerRead('inspect',slot.id||slot.name,remaining());
   if(current){const id=journal.cleanupTarget(slot.role,current);await dockerRead('remove',id,remaining());
    if(await dockerRead('inspect',id,remaining())!==null)return;
   }
   journal.removed(slot.role,true);
  } catch { /* Unavailable inspection is never proof of absence or ownership. */ }
 }));
 return journal.finishCleanup();
}
async function monitorJournal(journal,{beforeCleanup=async()=>{},observeStorage=async()=>{}}={}) {
 async function cleanup(){await beforeCleanup();return cleanupJournal(journal);}
 // This loop belongs in the independent supervisor process. Its journal retains
 // the controller's boot/PID/starttime identity; a reused PID does not renew it.
 while(true){
  let s=journal.snapshot();if(['cleaned','cleanup_failed'].includes(s.phase))return s;
  if(s.phase==='failing')return cleanup();
  journal.check();s=journal.snapshot();if(s.phase==='failing')continue;
  if(s.phase==='quiescing')return cleanup();
  for(const slot of s.resources.filter(r=>r.status==='running')){
   try{const c=await dockerRead('inspect',slot.id,Math.min(2000,s.phaseDeadlineEpochMs-Date.now()));
    if(journal.snapshot().phase==='failing')break;journal.observe(slot.role,c);
    if(journal.snapshot().phase!=='failing'&&c?.State?.Running)await observeStorage(slot);
   }catch(error){
    if(journal.snapshot().phase!=='failing')journal.check();
    if(journal.snapshot().phase!=='failing')journal.fail('backend_readiness_failed','inspect_'+slot.role+'_'+(error.message||'unknown'));
    break;
   }
  }
  await new Promise(resolve=>setTimeout(resolve,PROFILE.time.pollMilliseconds));
 }
}
Object.assign(module.exports,{cleanupJournal,monitorJournal});
