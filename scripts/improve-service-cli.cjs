'use strict';
// Thin client: no local executor or authority inferred from process environment.
const {readPrivate}=require('./improve-controller-cli.cjs');
async function invoke({url,credential_file},tool,input){
 const target=new URL(url);if(target.protocol!=='http:'||target.hostname!=='127.0.0.1'||target.username||target.password||target.pathname!=='/'||target.search||target.hash)throw Error('unsupported_service_address');
 const secret=readPrivate(credential_file);if(secret.version!==1||typeof secret.token!=='string')throw Error('credential_unavailable');
 const route={improve_preflight:'preflight',improve_start:'start',improve_status:'status',improve_cancel:'cancel',improve_resume:'resume'}[tool];if(!route)throw Error('invalid_command');
 const res=await fetch(new URL('/v1/'+route,target),{method:'POST',headers:{authorization:'Bearer '+secret.token,'content-type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(15000)});return {status:res.status,result:await res.json()};
}
async function cli(args=process.argv.slice(2)){
 try{if(args.length!==3)throw Error('invalid_command');const [tool,configFile,requestFile]=args,out=await invoke(readPrivate(configFile),tool,readPrivate(requestFile));console.log(JSON.stringify(out.result));return out.status===200?0:2;}catch{console.error(JSON.stringify({reason_code:'service_client_unavailable',next_action:'Check the private client configuration, local service and matching API version; no job was replayed.'}));return 2;}
}
module.exports={invoke,cli};if(require.main===module)cli().then(code=>process.exitCode=code);
