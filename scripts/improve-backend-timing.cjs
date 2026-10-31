'use strict';
// Diagnostic timing only: fixed labels, no arguments, output, or exception text.
// A trace never grants admission, extends a lease, or supplies check evidence.
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const steps=new Set(['generation_open','identity','git_identity','workspace_identity','admit','product_binding','checker_prepare','server_start','checks','continuity','generation_shutdown','generation_close']);
function open(directory,phase){
 if(!/^(baseline|after|dev-r[1-9][0-9]*)$/.test(phase))throw Error('backend_timing_phase_invalid');
 const file=path.join(directory,'backend-timing-'+crypto.randomUUID()+'.jsonl');
 const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);
 const start=performance.now();let count=0,closed=false;
 function write(value){fs.writeSync(fd,JSON.stringify(value)+'\n');}
 write({schema:'specflow.backend-timing/v1',phase,startedAt:new Date().toISOString(),diagnosticOnly:true});
 function begin(step){
  if(closed||!steps.has(step)||count>=128)throw Error('backend_timing_span_invalid');
  const span=++count,at=performance.now();write({span,step,event:'start',elapsedMs:at-start});return {span,step,at};
 }
 function end(s,status){const now=performance.now();write({span:s.span,step:s.step,event:'end',status,elapsedMs:now-start,durationMs:now-s.at});}
 return Object.freeze({file,
  sync(step,fn){const s=begin(step);let status='threw';try{const value=fn();status='returned';return value;}finally{end(s,status);}},
  async run(step,fn){const s=begin(step);let status='threw';try{const value=await fn();status='returned';return value;}finally{end(s,status);}},
  close(){if(!closed){closed=true;try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}}
 });
}
module.exports={open};
