'use strict';
// Closed recipe paths only. Capacity comes from a bounded command in an
// already ownership-checked service, never from application log text.
const paths=Object.freeze({database:Object.freeze(['/work']),gateway:Object.freeze(['/work','/tmp'])});
function mounts(role){return Object.hasOwn(paths,role)?[...paths[role]]:[];}
function parse(role,text){
 const expected=mounts(role),lines=text.trim().split(/\r?\n/);
 const bad=()=>{throw Error('backend_readiness_failed');};
 if(!expected.length||lines.length!==expected.length+1||!lines[0].startsWith('Filesystem'))bad();
 const seen=new Set(),rows=[];
 for(const line of lines.slice(1)){
  const f=line.trim().split(/\s+/),mount=f[5];
  if(f.length!==6||f[0]!=='tmpfs'||!expected.includes(mount)||seen.has(mount)||!f.slice(1,4).every(x=>/^\d+$/.test(x)))bad();
  const [total,used,available]=f.slice(1,4).map(Number);
  if(![total,used,available].every(Number.isSafeInteger)||total<=0||used>total||available>total||used+available!==total)bad();
  seen.add(mount);rows.push({mount,totalBlocks:total,availableBlocks:available});
 }
 return rows;
}
module.exports={mounts,parse};
