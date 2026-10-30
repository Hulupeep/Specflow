'use strict';
// Live qualification, explicit private descriptor required. No skipped fallback.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('node:assert/strict');
const runtime=require('../../scripts/improve-backend-runtime.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=ref=>{const b=fs.readFileSync(ref.path);assert.equal(hash(b),ref.sha256);return JSON.parse(b);};
async function live(file){
 const d=JSON.parse(fs.readFileSync(file)),r=read(d.request),m=read(d.manifest),product=read(d.product),pi=read(product.inputs),pr=read(product.request),built=read(product.built);
 const admitted=runtime.readInputs(d.root,r,m),{DockerWorker}=require('../../scripts/improve-worker.cjs');
 const worker=new DockerWorker({...read(pi.workerConfig),gitArea:null,stateRoot:pi.root,jobId:pr.jobId,maxMilliseconds:300000});
 const privateRoot=fs.mkdtempSync(path.join(path.dirname(d.root),'auth-checker-'));fs.chmodSync(privateRoot,0o700);
 fs.writeFileSync(path.join(privateRoot,'public.json'),JSON.stringify({anonKey:admitted.credentials.anonKey}),{mode:0o400});
 let consumer,session,checker,report;
 try{
  consumer=require('../../scripts/improve-production-build.cjs').createProductionConsumer(worker,pr,built.receipt,built.target);
  session=await runtime.startBackend({worker,anchorId:consumer.id,root:d.root,request:r,inputs:m});
  checker=worker.create({role:'checker',network:'container:'+consumer.id,mounts:[{source:privateRoot,destination:'/inputs'},{source:path.resolve(__dirname,'fixtures/backend-auth-probe.cjs'),destination:'/oracle/auth.cjs'}],tmpfs:[{path:'/output',bytes:64*1024*1024}]});
  const result=worker.exec(checker,['/node/bin/node','/oracle/auth.cjs'],{cwd:'/tmp',allowFailure:true,timeout:45000,maxBuffer:65536});
  report=JSON.parse(result.stdout);assert.equal(report.skipped,0);assert.equal(report.executed,29);assert.equal(report.failed,0);assert.equal(result.status,0);
  assert.equal(report.results.length,29);assert(report.results.every(x=>x.result==='pass'));
 }catch(error){error.qualificationReport=report;throw error;}finally{
  if(checker)worker.destroy(checker);
  if(session){const t=await runtime.closeBackend(session);assert.equal(t.phase,'cleaned');assert.equal(t.cause,null);assert(t.resources.every(x=>x.status==='removed'));}
  if(consumer)consumer.close();worker.close();fs.rmSync(privateRoot,{recursive:true,force:true});
 }
 return {...report,scope:'Real ordinary-user Auth and RLS through the owned gateway; no product browser or core receipt claim.'};
}
module.exports={live};
if(require.main===module)live(process.argv[2]).then(r=>console.log(JSON.stringify(r))).catch(e=>{console.log(JSON.stringify({...e.qualificationReport,executed:e.qualificationReport?.executed||0,failed:Math.max(1,e.qualificationReport?.failed||0),skipped:0,cause:e.code||e.name}));process.exitCode=1;});
