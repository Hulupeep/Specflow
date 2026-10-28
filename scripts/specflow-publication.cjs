'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process'),policy=require('./specflow-tier.cjs'),volume=require('./specflow-volume.cjs');
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
  const action=request.action||'comment', updating=['update','propose-update'].includes(action);
  if (!['comment','create','update','propose-update'].includes(action) || !/^[\w.-]+\/[\w.-]+$/.test(request.repo||'') || (action!=='create'&&!Number.isSafeInteger(request.issue)) || (action==='create'&&!request.title?.trim())) throw Error('Publication requires repository and issue, or create plus title');
  if(request.tier!==undefined&&!policy.TIERS.includes(request.tier))throw Error('Unknown publication tier');
  const run=options.run||spawnSync;
  const paths=[request.bodyFile,...(request.linkedFiles||[])];
  if(updating){if(!request.expectedBodyFile)throw Error('Body updates require expectedBodyFile');paths.push(request.expectedBodyFile);}
  const contents=paths.map(file=>fs.readFileSync(policy.localFile(root,file),'utf8'));
  let current;
  const loadCurrent=()=>{
    const r=run('gh',['issue','view',String(request.issue),'--repo',request.repo,'--json','body,labels'],{cwd:root,encoding:'utf8',timeout:30000});
    if(r.status!==0)throw Error('Cannot read current issue; no update applied');
    const issue=JSON.parse(r.stdout);if(typeof issue.body!=='string'||!Array.isArray(issue.labels))throw Error('Invalid current issue snapshot');return issue;
  };
  if(updating){current=loadCurrent();if(current.body!==contents.at(-1))throw Error('Current issue body differs from expected; preserve intervening edits');}
  let measured;
  if(action==='create'||updating){
    const artifacts=(request.linkedFiles||[]).map((file,i)=>({id:file,path:file,sha256:policy.sha(contents[i+1]),reuse:true}));
    const labels=updating?current.labels:request.labels|| (request.tier?['spec:'+request.tier]:[]);
    const record={issue:{body:contents[0],labels},profile:{artifacts}};
    const baseline=updating?volume.report(root,{issue:{body:current.body,labels},profile:{artifacts:[]}}):undefined;
    const fullReport=volume.report(root,record,baseline);
    // Keep acceptance definitions private even when size/reference validation blocks before scanning.
    measured={status:fullReport.status,counts:fullReport.counts,brief:fullReport.brief,errors:fullReport.errors,warnings:fullReport.warnings};
    for(const artifact of fullReport.artifacts){
      if(!paths.includes(artifact.path)){paths.push(artifact.path);contents.push(fs.readFileSync(policy.localFile(root,artifact.path),'utf8'));}
    }
    if(measured.errors.length)return{status:'blocked',volume:measured,next_action:measured.errors.join('; ')};
  }
  privacy(root,null,[request.title||'',...contents].join('\n'),options);
  if(paths.some((file,i)=>fs.readFileSync(policy.localFile(root,file),'utf8')!==contents[i]))throw Error('Publication content changed after privacy verification');
  if(updating){
    const latest=loadCurrent();
    if(latest.body!==current.body||JSON.stringify(latest.labels)!==JSON.stringify(current.labels))throw Error('Issue changed during validation; preserve intervening edits');
    if(action==='update')return {status:contents[0]===current.body?'unchanged':'blocked',volume:measured,next_action:contents[0]===current.body?'Body already matches; no write required':'Atomic GitHub issue-body replacement unavailable; no body update applied. Use explicit propose-update for discussion only, then reconcile authoritative scope.'};
  }
  const args=action==='create'?['issue','create','--title',request.title]:['issue','comment',String(request.issue)];
  if(action==='create')for(const label of request.labels||(request.tier?['spec:'+request.tier]:[]))args.push('--label',typeof label==='string'?label:label.name);
  const body=action==='propose-update'?'## Proposed body update (not applied)\n\nThis is discussion only; the current issue body remains authoritative until explicitly reconciled.\n\n'+contents[0]:contents[0];
  // The fixed proposal heading contains no untrusted material; all proposed content was scanned above.
  const r=run('gh',[...args,'--repo',request.repo,'--body-file','-'],{cwd:root,encoding:'utf8',input:body,timeout:30000});
  return {status:r.status===0?(action==='propose-update'?'proposed':'published'):'blocked',...(measured?{volume:measured}:{}),next_action:r.status===0?'Retain the sanitized publication receipt; proposals do not change acceptance':'GitHub write failed; preserve the pending publication'};
}
function cli(args=process.argv.slice(2),root=process.cwd()) {
  try { const request=read(root,args[0]);const result=publish(root,request);console.log(JSON.stringify(result));return ['published','proposed','unchanged'].includes(result.status)?0:2; }
  catch(error){console.error(error.message);return 2;}
}
module.exports={privacy,publish,cli};
if(require.main===module)process.exitCode=cli();
