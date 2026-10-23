'use strict';
const fs=require('fs'),assert=require('assert'),yaml=require('js-yaml');let executed=0;
const s=fs.readFileSync('docs/specs/improve-untrusted/story.md','utf8'),p=fs.readFileSync('docs/specs/improve-untrusted/preparation.md','utf8');
const mapped=new Set([...p.matchAll(/FENCE-(\d+(?:\/\d+)*)/g)].flatMap(m=>m[1].split('/').map(Number)));
for(let i=1;i<=5;i++){assert(s.includes('FENCE-'+i));assert(mapped.has(i));executed++;}
for(const t of ['BEGIN_UNTRUSTED_EVIDENCE','END_UNTRUSTED_EVIDENCE','binary','symlink','not universal']){assert(p.includes(t));executed++;}
const c=yaml.load(fs.readFileSync('docs/contracts/feature_improve_core.yml','utf8'));for(let i=1;i<=13;i++){assert(c.invariants.some(x=>x.id==='I-IMPROVE-'+String(i).padStart(3,'0')));executed++;}
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'preparation mapping only'}));
