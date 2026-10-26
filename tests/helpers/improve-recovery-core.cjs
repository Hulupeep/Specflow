'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),c=require('../../scripts/improve-controller.cjs'),p=require('../../scripts/improve-profiles.cjs'),proc=require('../../scripts/improve-process-identity.cjs');
function configureRecovery(f,{initialProcess=proc.identity()}={}){
 f.clock=Date.now();const base=f.config,registry=path.join(f.root,'v2-registry'),root=path.join(f.root,'v2-controller');fs.mkdirSync(registry,{mode:0o700});
 const lockTool={path:'/usr/bin/flock',sha256:crypto.createHash('sha256').update(fs.readFileSync('/usr/bin/flock')).digest('hex'),version:cp.execFileSync('/usr/bin/flock',['--version'],{encoding:'utf8'}).trim()};p.registerProfile(registry,f.profile,{lockTool});
 let actor={principal:'owner',holder:'executor-A',revision:'executor-assignment-1',process:initialProcess},execution=null;const successors=[];
 const recovery={format:2,lockTool,resolveAssignment:()=>structuredClone(actor),resolveExecution:()=>execution?structuredClone(execution):null,resolveSuccessor:key=>successors.find(v=>v.principal===key.principal&&v.holder===key.holder&&v.revision===key.revision),resolveProcess:proc.state,resolveRoute:role=>({requested_model:'sonnet',effective_model:'fixture-'+role,billing:'subscription_cli'}),resolveReceipt:id=>new (require('../../scripts/improve-operation-receipts.cjs').OperationReceipts)({root:path.join(root,'operation-receipts'),registry,lockTool}).completion(id),resolveTerminalArchive:()=>{throw Error('Register the exact actual archive before report recovery');}};
 f.config=()=>({...base(),root,registry,recovery});f.store=root;f.registry=registry;f.recovery=recovery;
 const service=c.createControllerService(f.config());service.registerPolicy({version:2,repo_id:'fixture',profile_revision:f.revision,limits:{maxCycles:2},schedule:null,routes:['builder','oracle','peer','judge'].map(role=>({role,...recovery.resolveRoute(role),cost:'ordinary',maxStarts:null}))});
 f.recoveryCommand=(extra={},id=crypto.randomUUID())=>({...f.req,request_id:id,expected_generation:f.service().status(f.req).runs[0].recovery.generation,...extra});
 f.claimRecovery=()=>{const result=f.service().resume(f.recoveryCommand());if(result.allowed)execution={...structuredClone(actor),generation:result.generation};return result;};
 f.replaceExecutor=()=>{const next={principal:'owner',holder:'executor-B',revision:'executor-assignment-2',process:proc.identity()};successors.push(next);f.service().assign(f.recoveryCommand({principal:next.principal,holder:next.holder,assignment_revision:next.revision}));actor=next;execution=null;return f.claimRecovery();};
}
module.exports={configureRecovery};
