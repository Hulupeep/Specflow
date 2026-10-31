'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const {DockerWorker,DurableStore}=require('../../scripts/improve-worker.cjs'),a=require('../../scripts/improve-backend-attempt.cjs'),managed=require('../../scripts/improve-managed-worker.cjs');
const base=path.resolve('.specflow/specification/backend-recipe'),binding=JSON.parse(fs.readFileSync(path.join(base,'fresh-input-binding.json'))),bytes=fs.readFileSync(binding.workerConfig.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),binding.workerConfig.sha256);const cfg=JSON.parse(bytes);
const root=fs.mkdtempSync(path.join(base,'managed-checker-live-'));fs.chmodSync(root,0o700);
const store=new DurableStore({root,sourceRoot:root}),jobId='managed-checker-'+crypto.randomUUID(),deadlineAtMs=Date.now()+120000;
const ref=a.begin(store,{jobId,runId:'checker-transport',phase:'dev-r1',contractSha256:'a'.repeat(64),constructionSha256:'b'.repeat(64),authoritySha256:'c'.repeat(64),deadlineAtMs});
const worker=new DockerWorker({image:cfg.image,layer:cfg.layer,stateRoot:root,jobId,maxMilliseconds:60000});managed.bind(worker,{store,attempt:ref,authorize:()=>DockerWorker.probe()});
try{
 managed.select(worker,'app');const anchor=worker.create({role:'app'});
 managed.select(worker,'checker');const checker=worker.create({role:'checker',network:'container:'+anchor});
 assert.equal(worker.exec(checker,['/node/bin/node','-e','process.stdout.write("managed-checker-executed")'],{cwd:'/tmp'}).stdout,'managed-checker-executed');
 const app=JSON.parse(worker.call(['inspect',anchor]).stdout)[0],check=JSON.parse(worker.call(['inspect',checker]).stdout)[0];assert.equal(check.Config.Hostname,app.Config.Hostname);assert.equal(check.HostConfig.NetworkMode,'container:'+anchor);
 worker.destroy(checker);worker.destroy(anchor);assert.equal(worker.containers.size,0);
 for(const slot of ['app','checker']){const rows=a.resourceEvents(store,ref,slot);assert.deepEqual(rows.map(x=>x.state),['dispatching','created','started','removed']);assert.equal(new Set(rows.filter(x=>x.inspectionSha256).map(x=>x.inspectionSha256)).size,1);}
 a.seal(store,ref);const terminal=a.finish(store,ref,{cause:'backend_qualification_only',backendTerminalSha256:null,productReceiptSha256:null});assert.equal(terminal.state,'cleaned');assert.equal(terminal.credentialEnvelopeRemoved,true);assert.equal(terminal.resources.length,2);assert(terminal.resources.every(r=>r.status==='removed'));
 const result={status:'passed',scope:'Real managed shared-network checker create/start/execute/remove and complete attempt release; no core outcome claim',checks:8,skipped:0,terminal:terminal.state,slots:terminal.resources.map(r=>r.slot),originalDeadlineAtMs:deadlineAtMs,root};fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result),{mode:0o600});console.log(JSON.stringify(result));
}finally{worker.close();}
