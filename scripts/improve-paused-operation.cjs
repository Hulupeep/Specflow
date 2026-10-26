'use strict';
// Fixed owner-host supervisor: no protected executable starts before fd3 release.
const fs=require('fs'),cp=require('child_process'),path=require('path');
const {OperationReceipts}=require('./improve-operation-receipts.cjs');
function spawnOperation({executable,args,options,receipt,binding,kind,expected}){
 const dir=path.join(receipt.root,'launches');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const file=path.join(dir,binding.operation_id+'.json');
 fs.writeFileSync(file,JSON.stringify({executable,args,receipt,binding,kind,expected}),{mode:0o600,flag:'wx'});
 const child=cp.spawn(process.execPath,[__filename,file],{...options,stdio:['pipe','pipe','pipe','pipe'],detached:true});
 child.recoveryRelease=()=>child.stdio[3].end('RELEASE\n');
 return child;
}
async function run(file){
 const plan=require('./improve-controller-cli.cjs').readPrivate(file),receipts=new OperationReceipts(plan.receipt);
 let data='';
 const permission=await new Promise(resolve=>{const gate=fs.createReadStream(null,{fd:3,autoClose:true});gate.on('data',b=>{data+=b;if(data.length>16){gate.destroy();resolve(false);}});gate.on('end',()=>resolve(data==='RELEASE\n'));gate.on('error',()=>resolve(false));});
 if(!permission){receipts.put({binding:plan.binding,phase:'not_started',result:{exit_code:2,reason_code:'launch_not_released',estimate_usd:null}});return 2;}
 let stdout='',stderr='',error=null,size=0;
 const child=cp.spawn(plan.executable,plan.args,{stdio:['pipe','pipe','pipe'],env:process.env});
 process.stdout.on('error',()=>{});process.stderr.on('error',()=>{});
 const status=await new Promise(resolve=>{
  const add=(kind,b)=>{size+=b.length;if(size>8*1024*1024){error='output_limit';child.kill('SIGKILL');return;}if(kind==='stdout'){stdout+=b;process.stdout.write(b);}else{stderr+=b;process.stderr.write(b);}};
  child.stdout.on('data',b=>add('stdout',b));child.stderr.on('data',b=>add('stderr',b));child.on('error',()=>{error='launch_failure';});child.on('close',code=>{process.stdin.unpipe(child.stdin);process.stdin.destroy();resolve(code??2);});
  process.stdin.pipe(child.stdin);child.stdin.on('error',()=>{});
 });
 let reason=error?(error==='output_limit'?'protocol_failure':'provider_failure'):status===0?null:plan.kind==='stage'?'stage_failure':'provider_failure',estimate=null;
 if(plan.kind==='provider'){
  reason=require('./improve-controller-provider.cjs').classify(stdout,error,status)||reason;
  if(status===0&&!reason)try{estimate=require('./improve-worker.cjs').validateRoleResponse(stdout,plan.expected).provenance.cli_estimate_usd;}catch{reason='protocol_failure';}
 }
 receipts.put({binding:plan.binding,result:{exit_code:status,reason_code:reason,estimate_usd:estimate},stdout,stderr});
 return status;
}
if(require.main===module)run(process.argv[2]).then(code=>{process.exitCode=code;},e=>{process.stderr.write(JSON.stringify({code:e.code||'operation_supervisor_failure'})+'\n');process.exitCode=2;});
module.exports={spawnOperation,run};
