'use strict';
const fs=require('fs'),assert=require('assert'),yaml=require('js-yaml');
let executed=0;const story=fs.readFileSync('docs/specs/runtime-integrity/story.md','utf8'),prep=fs.readFileSync('docs/specs/runtime-integrity/preparation.md','utf8'),tests=fs.readFileSync('tests/contracts/improve-core.test.js','utf8');
for(let i=1;i<=6;i++){assert(story.includes('FIX-'+i));assert(prep.includes('FIX-'+i));executed++;}
for(const term of ['symlink ancestor','generated input changed after','generated input changed during','generated input changed after evaluation','unignored generated output']){assert(tests.includes(term));executed++;}
const contract=yaml.load(fs.readFileSync('docs/contracts/feature_improve_core.yml','utf8'));for(let i=1;i<=13;i++){assert(contract.invariants.some(x=>x.id==='I-IMPROVE-'+String(i).padStart(3,'0')));executed++;}
const contractsLoaded=fs.readdirSync('docs/contracts').filter(x=>x.endsWith('.yml')).map(x=>({path:'docs/contracts/'+x,firstField:Object.keys(yaml.load(fs.readFileSync('docs/contracts/'+x,'utf8')))[0]}));
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'preparation/check mapping only; unbuilt implementation need not pass yet',contractsLoaded}));
