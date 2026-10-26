'use strict';
// Independent owner-host guardian. Never signal a reused/unproved group identity.
const fs=require('fs'),proc=require('./improve-process-identity.cjs');
function birth(pid){try{const s=fs.readFileSync('/proc/'+pid+'/stat','utf8'),p=s.slice(s.lastIndexOf(')')+2).split(' ');return {state:p[0],group:Number(p[2]),start:p[19]};}catch{return null;}}
function decision({parent,group,started,deadline,boot_id,group_started},now=Date.now(),witnesses=[]){
 const currentBoot=proc.boot();if(!currentBoot||boot_id&&boot_id!==currentBoot)return {done:true,signalGroup:null,reason:'boot_identity_changed'};
 const p=birth(parent);if(p&&p.start!==started)return {done:true,signalGroup:null,reason:'parent_identity_changed'};
 if(p&&p.group!==group)return {done:true,signalGroup:null,reason:'group_identity_changed'};
 if(p&&!['Z','X'].includes(p.state)&&now<deadline)return {done:false,signalGroup:null,reason:null};
 const status=proc.state({boot_id:boot_id||currentBoot,pid:parent,start:started,group});
 if(status==='unknown')return {done:true,signalGroup:null,reason:'parent_visibility_unknown'};
 const expected=group_started||(group===parent?started:null),g=birth(group);
 if(!expected||(g&&g.start!==expected)||(!g&&!witnesses.some(i=>{const p=birth(i.pid);return i.boot_id===currentBoot&&p&&p.start===i.start&&p.group===group&&!['Z','X'].includes(p.state);})))return {done:true,signalGroup:null,reason:'group_identity_unavailable'};
 return {done:true,signalGroup:group,reason:now>=deadline?'deadline':'parent_exited'};
}
function signalGroup(identity,witnesses=[]){
 if(!identity||identity.boot_id!==proc.boot()||!Number.isSafeInteger(identity.pid)||identity.pid<=1)return false;
 const current=birth(identity.pid);if(current?(current.start!==identity.start||current.group!==identity.pid):!witnesses.some(i=>{const p=birth(i.pid);return i.boot_id===identity.boot_id&&p&&p.start===i.start&&p.group===identity.pid&&!['Z','X'].includes(p.state);}))return false;
 try{process.kill(-identity.pid,'SIGKILL');return true;}catch(e){if(e.code==='ESRCH')return false;throw e;}
}
function start(value){
 if(!Number.isSafeInteger(value.parent)||value.parent<=1||!Number.isSafeInteger(value.group)||value.group<=1||!Number.isFinite(value.deadline)||typeof value.started!=='string')process.exit(2);
 let witnesses=[];
 const sample=()=>{const p=birth(value.parent);if(!p||p.start!==value.started||p.group!==value.group||['Z','X'].includes(p.state))return;
  // Retain only actual membership observed while the original holder is live.
  witnesses=fs.readdirSync('/proc').filter(n=>/^\d+$/.test(n)).flatMap(n=>{const i=proc.identity(Number(n));return i&&i.group===value.group?[i]:[];});};
 sample();
 const timer=setInterval(()=>{sample();const result=decision(value,Date.now(),witnesses);if(!result.done)return;clearInterval(timer);if(result.signalGroup===null)return;
  try{signalGroup({pid:result.signalGroup,start:value.group_started||(value.group===value.parent?value.started:null),boot_id:value.boot_id||proc.boot()},witnesses);}catch(e){if(e.code!=='ESRCH')process.exitCode=2;}
 },100);
}
if(require.main===module)start(JSON.parse(process.argv[2]));
module.exports={birth,decision,signalGroup,start};
