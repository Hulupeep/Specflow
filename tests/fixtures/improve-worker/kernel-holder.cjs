'use strict';
const fs=require('fs'),path=require('path'),k=require('../../../scripts/improve-kernel-lock.cjs');
const c=JSON.parse(fs.readFileSync(process.argv[2])),fault=stage=>{
 if(stage!==c.stage)return;process.stdout.write(stage+'\n');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,60000);
};
const file=c.authority?k.prepareAuthority(c.root,c.tool,{fault}):path.join(c.root,'writer.lock');
if(!c.authority)k.prepare(file,c.tool,{fault});
k.withLock(file,c.tool,()=>{}, {fault});
