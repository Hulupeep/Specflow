'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process'),policy=require('./specflow-tier.cjs');
const read=(root,file)=>JSON.parse(fs.readFileSync(policy.localFile(root,file),'utf8'));
function privacy(root,record,payload,options={}) {
  const config=read(root,'.specflow/publication-policy.json');
  if(typeof config.privateBaselineRequired!=='boolean'||!config.command?.length)throw Error('Publication requires the project’s configured mechanical privacy gate');
  const dir=path.join(root,'.specflow/specification/private');
  for(let at=dir;at!==path.dirname(at);at=path.dirname(at))if(fs.existsSync(at)&&fs.lstatSync(at).isSymbolicLink())throw Error('Privacy staging cannot follow symlinks');
  fs.mkdirSync(dir,{recursive:true,mode:0o700});const file=path.join(dir,crypto.randomUUID()+'.txt');fs.writeFileSync(file,payload,{mode:0o600});
  try {
    const result=(options.execute||spawnSync)(config.command[0],[...config.command.slice(1),file],{cwd:root,encoding:'utf8',timeout:60000,maxBuffer:1024*1024});
    let report;try{report=JSON.parse(result.stdout);}catch{throw Error('Privacy scanner did not return a valid result; raw output retained privately by the project scanner');}
    let details=report.actual;try{if(typeof details==='string')details=JSON.parse(details);}catch{details={};}
    if(result.status!==0||report.success!==true||(config.privateBaselineRequired&&(details?.canary_detected!==true||!(details?.secret_forms_checked>0))))throw Error('Required privacy check or private-baseline canary failed; publication blocked');
    return {status:'passed',privateBaseline:config.privateBaselineRequired,canaryDetected:details?.canary_detected===true};
  }finally{fs.rmSync(file,{force:true});}
}

function publish(root, request, options={}) {
  const action=request.action||'comment';
  if (!['comment','create'].includes(action) || !/^[\w.-]+\/[\w.-]+$/.test(request.repo||'') || (action==='comment'&&!Number.isSafeInteger(request.issue)) || (action==='create'&&!request.title?.trim())) throw Error('Publication requires repository and issue, or create plus title');
  const paths = [request.bodyFile, ...(request.linkedFiles||[])];
  const contents = paths.map(file=>fs.readFileSync(policy.localFile(root,file),'utf8'));
  privacy(root, null, [request.title||'',...contents].join('\n'), options);
  if(paths.some((file,i)=>fs.readFileSync(policy.localFile(root,file),'utf8')!==contents[i])) throw Error('Publication content changed after privacy verification');
  const args=action==='create'?['issue','create','--title',request.title]:['issue','comment',String(request.issue)];
  const r=(options.run||spawnSync)('gh',[...args,'--repo',request.repo,'--body-file','-'],{cwd:root,encoding:'utf8',input:contents[0],timeout:30000});
  return {status:r.status===0?'published':'blocked',next_action:r.status===0?'Retain the sanitized publication receipt':'GitHub write failed; preserve the pending publication'};
}
function cli(args=process.argv.slice(2),root=process.cwd()) {
  try { const request=read(root,args[0]);const result=publish(root,request);console.log(JSON.stringify(result));return result.status==='published'?0:2; }
  catch(error){console.error(error.message);return 2;}
}
module.exports={privacy,publish,cli};
if(require.main===module)process.exitCode=cli();
