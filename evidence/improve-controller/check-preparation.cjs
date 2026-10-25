'use strict';
// Preparation integrity and real upstream API tests. Not controller qualification.
const fs=require('fs'),assert=require('assert'),crypto=require('crypto'),yaml=require('js-yaml'),{spawnSync}=require('child_process');
const read=p=>fs.readFileSync(p,'utf8'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
let executed=0;const check=(v,m)=>{assert(v,m);executed++;};
const story=read('docs/specs/improve-controller/story.md'),prep=read('docs/specs/improve-controller/preparation.md'),contract=yaml.load(read('docs/contracts/feature_improve_controller.yml'));
for(let i=1;i<=5;i++)check(story.includes('AC-09-'+i),'preserved original AC '+i);
for(let i=1;i<=13;i++)check((i<=9?story:prep).includes('AC-LIMITS-'+String(i).padStart(2,'0')),'preserved/supplemental limits AC '+i);
for(const marker of ['Simulation Findings','Audit phase1','Audit phase2','Kill check','Pre-flight Findings','reconciliation_required','unmeasured_spend_limit','CTRL-IDENTITY','CTRL-LIMITS','CTRL-RACE','CTRL-INTERRUPT','CTRL-AUTH','CTRL-TERMINAL','CTRL-SCHEDULE','CTRL-NOWORK'])check(prep.includes(marker),'prepared '+marker);
check(contract.invariants.length===8,'eight invariants');for(const inv of contract.invariants){check(inv.tests.length>0,'mapped '+inv.id);for(const name of inv.tests)check(prep.includes(name),'scenario '+name);}
for(const f of ['feature_improve_core','feature_improve_profiles','feature_improve_worker']){const old=spawnSync('git',['show','8e30c68:docs/contracts/'+f+'.yml'],{encoding:'utf8'});check(old.status===0&&old.stdout===read('docs/contracts/'+f+'.yml'),'existing contract unchanged '+f);}
const report='tmp/controller/upstream-tests.json',r=spawnSync(process.execPath,['node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','tests/contracts/improve-profiles.test.js','tests/integration/improve-preflight.test.js','tests/contracts/improve-worker.test.js','tests/integration/improve-worker.test.js','--json','--outputFile',report],{encoding:'utf8',timeout:110000,maxBuffer:8*1024*1024});fs.writeFileSync('tmp/controller/upstream-tests.log',r.stdout+'\n'+r.stderr);
const tests=JSON.parse(read(report));check(r.status===0&&tests.numFailedTests===0&&tests.numPendingTests===0&&tests.numPassedTests>0,'real current upstream tests');
console.log(JSON.stringify({executed:executed+tests.numPassedTests,skipped:0,failed:0,preparationChecks:executed,upstreamTests:tests.numPassedTests,upstreamRaw:{path:report,sha256:sha(report)},scope:'preparation and current #216/#217 APIs; controller implementation/live scheduling not established'}));
