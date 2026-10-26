'use strict';
const cp=require('child_process'),path=require('path'),proc=require('../../scripts/improve-process-identity.cjs');
let children=[];afterEach(async()=>{for(const child of children)if(child.exitCode===null&&child.signalCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGKILL');await end;}children=[];});
function target(){const child=cp.spawn(process.execPath,['-e','process.stdin.resume();process.stdin.on("end",()=>process.exit());setInterval(()=>{},1000);'],{detached:true,stdio:['pipe','ignore','ignore']});children.push(child);return {child,identity:proc.identity(child.pid)};}
const guardian=value=>new Promise((resolve,reject)=>{const p=cp.spawn(process.execPath,[path.resolve('scripts/improve-controller-watchdog.cjs'),JSON.stringify(value)],{stdio:['ignore','ignore','pipe']});let error='';p.stderr.on('data',b=>{error+=b;});p.once('error',reject);p.once('close',code=>code===0?resolve():reject(Error(error)));});
const args=i=>({parent:i.pid,group:i.group,started:i.start,group_started:i.start,boot_id:i.boot_id,deadline:Date.now()-1});
test('REC-FENCE actual guardian with a stale parent birth signals no live process',async()=>{
 const {identity}=target();await guardian({...args(identity),started:identity.start+'00'});expect(proc.state(identity)).toBe('live');
},10000);
test('REC-FENCE actual guardian refuses a stale group birth after its parent has exited',async()=>{
 const a=target(),b=target(),end=new Promise(r=>a.child.once('exit',r));a.child.stdin.end();await end;
 const unknown={...args(a.identity),group:b.identity.pid,group_started:b.identity.start+'00'};expect(require('../../scripts/improve-controller-watchdog.cjs').decision(unknown).reason).toBe('group_identity_unavailable');await guardian(unknown);expect(proc.state(a.identity)).toBe('dead');expect(proc.state(b.identity)).toBe('live');
},10000);
test('REC-FENCE actual guardian from a different boot has no signal authority',async()=>{
 const {identity}=target();await guardian({...args(identity),boot_id:'different-boot'});expect(proc.state(identity)).toBe('live');
},10000);
test('REC-FENCE deadline guardian terminates only the positively bound owned process group',async()=>{
 const {child,identity}=target(),end=new Promise(r=>child.once('exit',(code,signal)=>r(signal)));await guardian(args(identity));expect(await end).toBe('SIGKILL');
},10000);
