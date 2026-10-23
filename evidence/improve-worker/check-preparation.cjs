'use strict';
// Current upstream API execution + preparation/probe integrity, not worker qualification.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),{spawnSync}=require('child_process');
const read=p=>fs.readFileSync(p,'utf8'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const story=read('docs/specs/improve-worker/story.md'),prep=read('docs/specs/improve-worker/preparation.md'),probe=JSON.parse(read('evidence/improve-worker/preparation-probes.json'));let checks=0;const check=(v,m)=>{assert(v,m);checks++;};
for(let i=1;i<=11;i++)check(story.includes('AC-WORKER-'+String(i).padStart(2,'0')),'preserved worker acceptance '+i);
for(const marker of ['Simulation Findings','Audit phase1','Audit phase2','Kill check','J-WORKER-QUALIFICATION','commit_unconfirmed','--safe-mode','StructuredOutput','quiescence','#216 merged PR227'])check(prep.includes(marker),'prepared '+marker);
check(probe.dockerPair.browser&&probe.dockerPair.realHttpWriteRead&&probe.dockerPair.reloadPersistence&&probe.dockerPair.deniedWriteUnchanged,'actual browser/backend precursor');
check(probe.dockerPair.policies.every(p=>p.readOnlyRootfs&&!p.privileged&&p.capDrop.includes('ALL')&&p.pids===128&&p.memory===805306368),'actual bounded containers');
for(const r of probe.actualRoles)check(r.exitCode===0&&r.sessionMatches&&r.nonceMatches&&r.hostCanaryAbsent&&r.mcpServers.length===0&&r.tools.length===1&&r.tools[0]==='StructuredOutput'&&r.hostIOToolCalls===0,'actual no-I/O role '+r.requested);
check(new Set(probe.actualRoles.map(r=>r.effectiveModel)).size===2,'distinct observed effective models');
check(probe.authMetadata.authMethod==='claude.ai'&&probe.authMetadata.apiKeySource==='none','observed subscription auth route');
const dir='.specflow/specification/private';fs.mkdirSync(dir,{recursive:true,mode:0o700});const report=path.join(dir,'worker-profile-api-tests.json');
const result=spawnSync(process.execPath,['node_modules/jest/bin/jest.js','--runInBand','--runTestsByPath','tests/contracts/improve-profiles.test.js','tests/integration/improve-preflight.test.js','--json','--outputFile',report],{encoding:'utf8',timeout:90000,maxBuffer:4*1024*1024});fs.writeFileSync(path.join(dir,'worker-profile-api-tests.log'),result.stdout+'\n'+result.stderr,{mode:0o600});
const tests=JSON.parse(read(report));assert.equal(result.status,0,'current upstream profile tests must pass');assert.equal(tests.numFailedTests,0);assert.equal(tests.numPendingTests,0);assert(tests.numPassedTests>=31);
console.log(JSON.stringify({executed:checks+tests.numPassedTests,failed:0,skipped:0,scope:'preparation checks and current upstream #216 API tests; not worker/core qualification',preparationChecks:checks,profileTests:tests.numPassedTests,profileModuleSha256:sha('scripts/improve-profiles.cjs'),profileRaw:{path:report,sha256:sha(report)},observedRoleModels:probe.actualRoles.map(r=>r.effectiveModel),workerQualification:'not_established'}));
