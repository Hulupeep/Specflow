'use strict';
// Explicit live Docker qualification, never represented as a Jest mock test.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert'),cp=require('child_process');
const {DockerWorker,DurableStore}=require('../../scripts/improve-worker.cjs');
const attempts=require('../../scripts/improve-backend-attempt.cjs'),managed=require('../../scripts/improve-managed-worker.cjs');
const identity=require('../../scripts/improve-process-identity.cjs');
const base=path.resolve('.specflow/specification/backend-recipe'),binding=JSON.parse(fs.readFileSync(path.join(base,'fresh-input-binding.json')));
const bytes=fs.readFileSync(binding.workerConfig.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),binding.workerConfig.sha256);
const cfg=JSON.parse(bytes);
function setup(root){const store=new DurableStore({root,sourceRoot:root}),jobId='managed-worker-qualification';const ref=attempts.begin(store,{jobId,runId:'run',phase:'dev-r1',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+120000});const worker=new DockerWorker({image:cfg.image,layer:cfg.layer,stateRoot:root,jobId,maxMilliseconds:60000});managed.bind(worker,{store,attempt:ref,authorize:()=>DockerWorker.probe()});return {store,ref,worker};}
async function main(){
 if(process.argv[2]==='child'){const root=process.argv[3],{store,ref,worker}=setup(root);managed.select(worker,'app');const id=worker.create({role:'app'});fs.writeFileSync(path.join(root,'child-ready.json'),JSON.stringify({ref,id,owner:identity.identity()}),{mode:0o600});setInterval(()=>{},1000);return;}
 const root=fs.mkdtempSync(path.join(base,'managed-worker-live-'));fs.chmodSync(root,0o700);
 const first=path.join(root,'normal');fs.mkdirSync(first,{mode:0o700});const {store,ref,worker}=setup(first);let id;
 try{managed.select(worker,'app');id=worker.create({role:'app'});assert.equal(worker.exec(id,['/node/bin/node','-e','process.stdout.write("managed-worker-live")'],{cwd:'/tmp'}).stdout,'managed-worker-live');worker.destroy(id);assert.equal(worker.containers.size,0);const events=attempts.resourceEvents(store,ref,'app');assert.deepEqual(events.map(e=>e.state),['dispatching','created','started','removed']);assert(events.every(e=>e.state==='dispatching'||e.id===id));assert.throws(()=>attempts.begin(store,{jobId:ref.jobId,runId:'other',phase:'after',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs:Date.now()+60000}),/backend_attempt_active/);}finally{worker.close();}
 const killed=path.join(root,'killed');fs.mkdirSync(killed,{mode:0o700});const child=cp.spawn(process.execPath,[__filename,'child',killed],{stdio:'ignore'});let error;child.on('error',e=>error=e);
 const wait=async(fn,ms)=>{const end=Date.now()+ms;for(;;){if(error)throw error;const r=fn();if(r)return r;if(Date.now()>=end)throw Error('qualification_deadline');await new Promise(r=>setTimeout(r,100));}};
 const ready=await wait(()=>fs.existsSync(path.join(killed,'child-ready.json'))&&JSON.parse(fs.readFileSync(path.join(killed,'child-ready.json'))),45000);assert.equal(ready.owner.pid,child.pid);assert.equal(identity.state(ready.owner),'live');child.kill('SIGKILL');
 const reopened=new DurableStore({root:killed,sourceRoot:killed});await wait(()=>attempts.resourceEvents(reopened,ready.ref,'app').some(e=>e.state==='removed'&&e.id===ready.id),15000);
 const inspect=cp.spawnSync('/usr/bin/docker',['--host','unix:///var/run/docker.sock','container','inspect',ready.id],{encoding:'utf8',env:{PATH:'/usr/bin:/bin',HOME:'/nonexistent',DOCKER_CONFIG:'/nonexistent'}});assert.notEqual(inspect.status,0);assert.match(inspect.stderr,/No such (container|object)/i);assert.equal(attempts.read(reopened,ready.ref).attemptId,ready.ref.attemptId);
 const result={status:'passed',normalExecution:true,signedRemoval:true,controllerKilled:true,supervisorRemovedOwned:true,reservationRetained:true,skipped:0,root};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1;});
