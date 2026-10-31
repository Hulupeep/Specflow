'use strict';
// Actual runtime isolation qualification. Private descriptors are mandatory; no skip fallback.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const runtime=require('../../scripts/improve-backend-runtime.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=ref=>{const b=fs.readFileSync(ref.path);assert.equal(hash(b),ref.sha256);return JSON.parse(b);};
async function live(file,targetsFile){
 const d=JSON.parse(fs.readFileSync(file)),r=read(d.request),m=read(d.manifest),product=read(d.product),pi=read(product.inputs),pr=read(product.request),built=read(product.built);
 const targets=JSON.parse(fs.readFileSync(targetsFile));runtime.readInputs(d.root,r,m);
 const {DockerWorker}=require('../../scripts/improve-worker.cjs'),workerConfig=read(pi.workerConfig);
 const worker=new DockerWorker({...workerConfig,gitArea:null,stateRoot:pi.root,jobId:pr.jobId,maxMilliseconds:300000});
 let consumer,session,report;
 try{
  consumer=require('../../scripts/improve-production-build.cjs').createProductionConsumer(worker,pr,built.receipt,built.target);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root:d.root,request:r,inputs:m});
  report=await require('./fixtures/backend-boundary-probe.cjs').run({worker,anchor:consumer.id,base:pi.root,workerConfig,jobId:pr.jobId,productionTargets:targets});
  assert.equal(report.status,'passed');assert.equal(report.failed,0);assert.equal(report.skipped,0);assert.equal(report.executed,report.checks.length);assert(report.executed>=51);
  worker.inspectProduction(consumer.id);
 }finally{
  if(session){const terminal=await runtime.closeBackend(session);assert.equal(terminal.phase,'cleaned');assert.equal(terminal.cause,null);assert(terminal.resources.every(r=>r.status==='removed'));}
  if(consumer)consumer.close();worker.close();
 }
 return {...report,scope:'Current real backend app/checker isolation; no browser, core after/evaluate or whole-backend acceptance claim.'};
}
module.exports={live};
if(require.main===module)live(process.argv[2],process.argv[3]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(JSON.stringify({status:'failed',failed:1,skipped:0,cause:e.code||e.message}));process.exitCode=1;});
