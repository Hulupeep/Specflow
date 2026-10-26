'use strict';
// Preparation integrity; checks actual retained upstream receipt, not new feature.
const fs=require('fs'),assert=require('assert'),crypto=require('crypto'),cp=require('child_process'),yaml=require('js-yaml');
const read=f=>fs.readFileSync(f,'utf8');
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
let executed=0;const check=(v,m)=>{assert(v,m);executed++;};
const story=read('docs/specs/improve-memory/story.md'),prep=read('docs/specs/improve-memory/preparation.md');
for(let i=1;i<=5;i++)check(story.includes(`AC-10-${i}`),'original acceptance '+i);
for(let i=1;i<=13;i++)check((i<=10?story:prep).includes(`AC-MEMORY-${String(i).padStart(2,'0')}`),'memory acceptance '+i);
for(const row of ['MEM-IDENTITY','MEM-CONSUME','MEM-BASELINE','MEM-AUTH','MEM-ATOMIC','MEM-VERDICT','MEM-ISOLATION'])check(prep.includes(row),'verification '+row);
const ids=new Set(),loaded=[];
for(const name of fs.readdirSync('docs/contracts').filter(n=>n.endsWith('.yml'))){
  const file='docs/contracts/'+name,doc=yaml.load(read(file));
  loaded.push({path:file,firstField:Object.keys(doc)[0],sha256:sha(file)});
  for(const inv of doc.invariants||[]){check(!ids.has(inv.id),'unique invariant '+inv.id);ids.add(inv.id);}
}
const contract=yaml.load(read('docs/contracts/feature_improve_memory.yml'));
check(contract.invariants.length===6,'six selected memory invariants');
for(const inv of contract.invariants)for(const row of inv.tests)check(prep.includes(row),'mapped '+row);
for(const file of ['feature_improve_core','feature_improve_profiles','feature_improve_worker','feature_improve_controller']){
  const f='docs/contracts/'+file+'.yml';
  check(cp.execFileSync('git',['show','a7c23f2046c0c05438e695857b0e93ffeef4afda:'+f],{encoding:'utf8'})===read(f),'existing contract unchanged '+file);
}
const cap=JSON.parse(read('tmp/memory/upstream-capability.json'));
const raw=JSON.parse(read(cap.raw.path));
check(sha(cap.raw.path)===cap.raw.sha256,'raw dependency receipt unchanged');
check(cap.exitCode===0&&cap.executed===raw.numPassedTests&&raw.success&&raw.numFailedTests===0&&raw.numPendingTests===0&&raw.numTodoTests===0,'current upstream execution passed');
check(typeof require('../../scripts/improve-controller.cjs').createControllerService==='function','existing controller API');
check(typeof require('../../scripts/specflow-improve.cjs').recordCandidates==='function','existing candidate seam');
check(read('docs/specs/improve-memory/interface.d.ts').includes('resolveEvidence(ref: EvidenceRef): ResolvedEvidence'),'trusted evidence resolver seam specified');
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'Preparation/schema/mapping checks only; no #182 runtime claim',upstreamPreviouslyExecuted:cap.executed,contractsLoaded:loaded}));
