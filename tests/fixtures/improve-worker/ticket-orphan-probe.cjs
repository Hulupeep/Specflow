'use strict';
const fs=require('fs'),w=require('../../../scripts/improve-worker.cjs'),cfg=require('../../../scripts/improve-controller-cli.cjs').readPrivate(process.argv[2]),[trigger,result,marker]=process.argv.slice(3);const timer=setInterval(()=>{
 if(!fs.existsSync(trigger))return;clearInterval(timer);let code=null,calls=0;try{w.authorizedStart(cfg,()=>{calls++;fs.writeFileSync(marker,'unexpected outbound');});}catch(e){code=e.code||e.message;}fs.writeFileSync(result,JSON.stringify({code,calls}),{mode:0o600});
},20);
