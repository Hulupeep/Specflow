'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const {fixture}=require('./improve-controller.cjs'),profiles=require('../../scripts/improve-profiles.cjs'),c=require('../../scripts/improve-controller.cjs'),proc=require('../../scripts/improve-process-identity.cjs');
function recoveryFixture({initialProcess=null,policyOverrides={}}={}){
 const f=fixture();f.clock=Date.now();f.update(p=>{p.grants.delegate=['read','preflight','execute'];});
 const registry=path.join(f.root,'recovery-registry'),root=path.join(f.root,'recovery-controller');fs.mkdirSync(registry,{mode:0o700});
 const lockTool={path:'/usr/bin/flock',sha256:crypto.createHash('sha256').update(fs.readFileSync('/usr/bin/flock')).digest('hex'),version:cp.execFileSync('/usr/bin/flock',['--version'],{encoding:'utf8'}).trim()};
 profiles.registerProfile(registry,f.profile,{lockTool});
 let current={principal:'owner',holder:'worker-A',revision:'assignment-1',process:initialProcess||proc.identity()},execution=null;
 const successors=new Map(),actualRoutes=Object.fromEntries(['builder','oracle','peer','judge'].map(role=>[role,{requested_model:'sonnet',effective_model:'fixture-'+role,billing:'subscription_cli'}]));
 const recovery={format:2,lockTool,resolveAssignment:()=>structuredClone(current),resolveExecution:()=>execution?structuredClone(execution):null,
  resolveSuccessor:key=>{const value=successors.get(JSON.stringify(key));if(!value)throw Error('Unregistered successor');return structuredClone(value);},resolveProcess:proc.state,
  resolveRoute:role=>structuredClone(actualRoutes[role]),resolveReceipt:id=>new (require('../../scripts/improve-operation-receipts.cjs').OperationReceipts)({root:path.join(root,'operation-receipts'),registry,lockTool}).get(id),resolveTerminalArchive:()=>{throw Error('No terminal archive registered in this boundary fixture');}};
 const config=()=>({...f.config(),registry,root,recovery}),service=()=>c.createControllerService(config());
 const policy=(extra={})=>({version:2,repo_id:'fixture',profile_revision:f.revision,limits:{maxCycles:2},schedule:null,
  routes:Object.entries(actualRoutes).map(([role,r])=>({role,...r,cost:'ordinary',maxStarts:null})),...extra});
 service().registerPolicy(policy(policyOverrides));const admitted=service().admit({repo_id:'fixture',request_id:'job'}),req={repo_id:'fixture',run_id:admitted.run_id};
 function command(extra={},id='cmd-'+crypto.randomUUID()){const r=service().status(req).runs[0];return {...req,request_id:id,expected_generation:r.recovery.generation,...extra};}
 function claim(id){const result=service().resume(command({},id));if(result.allowed)execution={...structuredClone(current),generation:result.generation};return result;}
 function successor(value){successors.set(JSON.stringify({principal:value.principal,holder:value.holder,revision:value.revision}),structuredClone(value));return value;}
 function use(value,{generation=null}={}){current=structuredClone(value);execution=generation===null?null:{...structuredClone(current),generation};}
 return Object.assign(f,{registryV2:registry,rootV2:root,recovery,configV2:config,serviceV2:service,policyV2:policy,req,command,claim,successor,use,actualRoutes,
  current:()=>structuredClone(current),execution:()=>execution?structuredClone(execution):null});
}
module.exports={recoveryFixture};
