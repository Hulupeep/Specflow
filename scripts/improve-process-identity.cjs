'use strict';
// Local Linux identity probe. Unavailable/other-boot visibility is never death proof.
const fs=require('fs');
function boot(){try{return fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch{return null;}}
function stat(pid){
 if(!Number.isSafeInteger(pid)||pid<=1)return {error:'invalid'};
 try{const raw=fs.readFileSync('/proc/'+pid+'/stat','utf8'),p=raw.slice(raw.lastIndexOf(')')+2).split(' ');return {state:p[0],group:Number(p[2]),start:p[19]};}
 catch(e){return {error:e.code};}
}
function identity(pid=process.pid){const b=boot(),p=stat(pid);return b&&!p.error?{boot_id:b,pid,start:p.start,group:p.group}:null;}
function state(value){
 if(!value||!Number.isSafeInteger(value.pid)||value.pid<=1||typeof value.start!=='string'||typeof value.boot_id!=='string')return 'unknown';
 const b=boot();if(!b||b!==value.boot_id)return 'unknown';
 const p=stat(value.pid);if(p.error==='ENOENT'&&fs.existsSync('/proc/self/stat'))return 'dead';if(p.error)return 'unknown';
 return p.start!==value.start||['Z','X'].includes(p.state)?'dead':'live';
}
module.exports={boot,identity,state};
