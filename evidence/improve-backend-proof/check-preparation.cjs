'use strict';
const fs=require('fs'),assert=require('assert'),crypto=require('crypto');let executed=0;
const story=fs.readFileSync('docs/specs/improve-backend-proof/story.md','utf8'),prep=fs.readFileSync('docs/specs/improve-backend-proof/preparation.md','utf8'),spec=fs.readFileSync('evidence/improve-backend-proof/journey_180.spec.cjs','utf8'),e=JSON.parse(fs.readFileSync('evidence/improve-backend-proof/initial-journey.json'));
for(let i=1;i<=9;i++){assert(story.includes('AC-08-'+i));assert(prep.includes('AC-08-'));executed++;}
for(let i=1;i<=7;i++){assert(story.includes('AC-PROOF-'+String(i).padStart(2,'0')));executed++;}
for(const marker of ['J-IMPROVE-HEYSTAX-BACKEND','1280,360,390,768','Forbidden','await page.reload()','toEqual(before.data)']){assert(spec.includes(marker));executed++;}
assert(!/test\.(skip|fixme)/.test(spec));executed++;
assert.equal(e.stats.expected,2);assert.equal(e.stats.unexpected,3);assert.equal(e.stats.skipped,0);executed++;
assert(/^[a-f0-9]{64}$/.test(e.initialFixtureDigest));assert.equal(e.productionBuildExit,0);assert.equal(e.tscExit,0);assert.equal(e.scopedEslintExit,0);executed++;
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'scoped preparation mapping plus actual executed prototype summary',journey:e.journey,specSha256:crypto.createHash('sha256').update(spec).digest('hex')}));
