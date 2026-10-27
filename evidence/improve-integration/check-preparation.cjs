'use strict';
// Preparation evidence, not runtime implementation/remote side-effect acceptance.
const fs=require('fs'),crypto=require('crypto'),assert=require('assert'),yaml=require('js-yaml'),cp=require('child_process');let executed=0;
const check=f=>{executed++;f();},read=f=>fs.readFileSync(f,'utf8'),json=f=>JSON.parse(read(f)),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
try{
const story=read('docs/specs/improve-integration/story.md'),prep=read('docs/specs/improve-integration/preparation.md'),types=read('docs/specs/improve-integration/interface.d.ts'),contract=yaml.load(read('docs/contracts/feature_improve_integration.yml')),record=json('.specflow/integration-prep/record.json');
for(let n=1;n<=10;n++){const id='AC-INTEGRATION-'+String(n).padStart(2,'0');check(()=>assert([record.issue.body,...record.issue.comments.map(c=>c.body)].join('\n').includes(id)));}
for(let n=11;n<=18;n++)check(()=>assert(story.includes('AC-INTEGRATION-'+n+':')));
for(const token of ['J-INTEGRATION-RETURN','DoD:','owner-principal','GitHub #219'])check(()=>assert(story.includes(token)));
for(const token of ['Decisions','Simulation Findings (proposed)','phase1','Phase2','Phase3','no suitable typed job/result','API lacks CAS','previously issued uncertain','I-IMPROVE-005','DISTINCT external publisher'])check(()=>assert(prep.includes(token)));
for(const token of ['TaskBootstrap','PublicationBinding','DeliveryOperation','Delivery','PluginBinding','recipient_observation','payload_sha256','validated_base_oid','assignment_revision'])check(()=>assert(types.includes(token)));
check(()=>assert(contract.invariants.length===6));check(()=>assert(new Set(contract.invariants.map(i=>i.id)).size===6));
const core=read('docs/contracts/feature_improve_core.yml'),base=cp.execFileSync('git',['show','52b614cf4ac5fa8e26fdf2f722837ae60b1fed63:docs/contracts/feature_improve_core.yml']);check(()=>assert(hash(core)===hash(base)));
const ci=json('.specflow/service-prep/ci244/result.json'),tests=json('.specflow/service-prep/ci244/artifact/canonical-tests.json');check(()=>assert(ci.tree_match&&ci.head==='56e7aa57626b900e05672230b1d0dae071d45b53'&&ci.tests===1933));check(()=>assert(tests.success&&tests.numFailedTests===0&&tests.numPendingTests===0&&tests.numTodoTests===0&&tests.numPassedTests===1933));
const capabilities=json('.specflow/integration-prep/live-capabilities.json');check(()=>assert(capabilities.access_role==='owner'&&capabilities.stax_id==='7af7f0dc-26e7-4491-806a-407028fe1be7'));check(()=>assert(capabilities.atomicRemoteTaskClaim===false&&capabilities.typedJobRecord===false));for(const name of ['stax_get','next_actions_list','next_actions_update'])check(()=>assert(capabilities.tools.some(t=>t.name==='mcp__heystax__'+name)));
const actionRead=json('.specflow/integration-prep/live-action-read.json'),a=actionRead.next_actions_list.actions[0];check(()=>assert(actionRead.accessibleStaxCount===94&&actionRead.stax_get.stax.access_role==='owner'));check(()=>assert(a.id==='feeaf3dd-8e80-42f7-8c7a-4e410e8dd586'&&a.stax_id===actionRead.stax_get.stax.id&&a.created_by===actionRead.stax_get.stax.user_id&&!a.done));check(()=>assert(a.source==='manual'&&hash(a.content)===actionRead.content_sha256));
for(let n=1;n<=18;n++)check(()=>assert(contract.invariants.some(i=>i.tests.includes('INTEGRATION-'+String(n).padStart(2,'0')))));
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'selected preparation only; native installed callers, publisher and HeyStax runtime journeys remain DoD'}));
}catch(e){console.error(JSON.stringify({executed,failed:1,skipped:0,message:e.message}));process.exitCode=2;}
