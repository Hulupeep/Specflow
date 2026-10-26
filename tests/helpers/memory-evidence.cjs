'use strict';
// Real child execution and private immutable traces over controlled fixture data.
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process'),m=require('../../scripts/improve-memory.cjs');
function writeCapturedEvidence(root,doc,{sourceFile=null,metric='resume.steps',observed=3}={}) {
  if(!sourceFile){sourceFile=path.join(root,'input-'+doc.id+'.json');fs.writeFileSync(sourceFile,JSON.stringify({steps:observed}),{mode:0o600});}
  const before=m.hash(fs.readFileSync(sourceFile)),startedAt=new Date().toISOString();
  const command=[process.execPath,'-e','const fs=require("fs");const raw=fs.readFileSync(process.argv[1],"utf8");let data;try{data=JSON.parse(raw)}catch{data=raw}const observed=data&&typeof data==="object"?data.steps:data;console.log(JSON.stringify({metric:process.argv[2],observed}));',sourceFile,metric];
  const result=spawnSync(command[0],command.slice(1),{encoding:'utf8',timeout:10000});
  if(result.status!==0)throw Error('Fixture observation did not execute: '+result.stderr);
  const after=m.hash(fs.readFileSync(sourceFile)),trace={duo_capture:1,command,exitCode:result.status,error:null,
    stdout:result.stdout,stderr:result.stderr,sourceBefore:before,sourceAfter:after,stable:before===after,
    startedAt,finishedAt:new Date().toISOString()};
  const traceFile=path.join(root,doc.id+'.capture.json');fs.writeFileSync(traceFile,JSON.stringify(trace),{mode:0o600});
  const file=path.join(root,doc.id+'.json');fs.writeFileSync(file,JSON.stringify({...doc,capture_sha256:m.hash(fs.readFileSync(traceFile))}),{mode:0o600});
  return {id:doc.id,sha256:m.hash(fs.readFileSync(file))};
}
module.exports={writeCapturedEvidence};
