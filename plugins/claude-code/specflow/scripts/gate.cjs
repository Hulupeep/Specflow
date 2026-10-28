#!/usr/bin/env node
'use strict';
// Explicit CLI payload, not an automatic hook or native-session attestation.
const fs=require('fs'),path=require('path'),cp=require('child_process');
try{
 const p=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
 if(Object.keys(p).sort().join(',')!=='reportDir,runDir,target'||Object.values(p).some(v=>typeof v!=='string'||!v.trim()))throw Error('Expected only target, runDir and reportDir strings');
 const target=fs.realpathSync(p.target);
 const r=cp.spawnSync(process.execPath,[path.join(target,'scripts/teardown-gate.cjs'),'accept-gate-d',path.resolve(target,p.reportDir),'--run-dir',path.resolve(target,p.runDir),'--repo-root',target],{cwd:target,stdio:'inherit'});
 if(r.error)console.error(r.error.message);process.exitCode=r.status===null?1:r.status;
}catch(e){console.error(e.message);process.exitCode=1;}
