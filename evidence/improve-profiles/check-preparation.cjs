'use strict';
const fs=require('fs'),assert=require('assert');const story=fs.readFileSync('docs/specs/improve-profiles/story.md','utf8'),prep=fs.readFileSync('docs/specs/improve-profiles/preparation.md','utf8');let executed=0;
for(let i=1;i<=5;i++){assert(story.includes('AC-PROFILES-0'+i));executed++;}
for(const marker of ['Simulation Findings','Kill check','Audit phase 1','Audit phase 2','Pre-flight Findings','resolvePrincipal','invalid_lease','permission_revoked','stale_profile','tests/integration/improve-preflight.test.js','worker_unavailable','No UI']){assert(prep.includes(marker));executed++;}
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'preparation completeness only; not implementation or worker qualification'}));
