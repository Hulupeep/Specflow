'use strict';
// Preparation only: schema/traceability, actual upstream receipt and unchanged trust floors.
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert'),yaml=require('js-yaml');
let executed=0;const check=(v,msg)=>{assert(v,msg);executed++;},read=p=>fs.readFileSync(p,'utf8'),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const prep=read('docs/specs/improve-service/preparation.md'),story=read('docs/specs/improve-service/story.md'),types=read('docs/specs/improve-service/interface.d.ts'),record=JSON.parse(read('.specflow/service-prep/record.json'));
const source=[record.issue.body,...record.issue.comments.map(c=>c.body)].join('\n');
const contract=yaml.load(read('docs/contracts/feature_improve_service.yml'));
for(let n=1;n<=20;n++){const suffix=String(n).padStart(2,'0');check(source.includes('REQ-SERVICE-'+suffix),'Original requirement '+suffix);check(contract.contract_meta.covers_reqs.includes('REQ-SERVICE-'+suffix),'Contract coverage '+suffix);check(prep.includes('| SERVICE-'+suffix+' |'),'Executable mapping '+suffix);}
const ids=new Set();for(const f of fs.readdirSync('docs/contracts').filter(f=>f.endsWith('.yml'))){for(const inv of yaml.load(read('docs/contracts/'+f)).invariants||[]){check(!ids.has(inv.id),'Unique '+inv.id);ids.add(inv.id);}}
for(const name of ['core','profiles','worker','controller','memory','recovery']){const file='docs/contracts/feature_improve_'+name+'.yml';check(cp.execFileSync('git',['show','bba7a9a:'+file],{encoding:'utf8'})===read(file),'Unchanged trust floor '+name);}
for(const word of ['PreparedPlan','DispatchIntent','ServiceRetryReceipt','TaskClaim','ControlBinding','AuthenticatedActor','TaskRef'])check(types.includes('interface '+word),'Typed '+word);
for(const phrase of ['never relabel','original internal command','separately trusted owner-host','actual canary/trace/launch evidence'])check((prep+story).includes(phrase),'Authority persona closure '+phrase);
for(const phrase of ['one authorised `store.change`','reserved\noperation','consumed holdout','original finite horizon','not an execution claim','no graphical','No SQL'])check((prep+story).toLowerCase().includes(phrase.toLowerCase()),'Selected decision '+phrase);
const cap=JSON.parse(read('.specflow/service-prep/upstream-capability.json')),raw=JSON.parse(read(cap.raw.path));check(sha(cap.raw.path)===cap.raw.sha256,'Current upstream receipt hash');check(raw.success&&raw.numPassedTests===cap.executed&&raw.numFailedTests===0&&raw.numPendingTests===0,'Actual upstream passing unskipped suite');
const sdk=JSON.parse(read('.specflow/service-prep/sdk-probe-result.json'));check(sdk.executed===5&&sdk.clients===2&&sdk.calls===2&&sdk.failed===0&&sdk.skipped===0,'Actual two-client SDK capability');
const volume=require('../../scripts/specflow-volume.cjs').report(process.cwd(),record);check(!volume.errors.length,'Current artifacts: '+volume.errors.join('; '));
cp.execFileSync('git',['diff','--check']);executed++;
console.log(JSON.stringify({executed,failed:0,skipped:0,upstreamPreviouslyExecuted:cap.executed,scope:'Preparation traceability and current upstream capability only; no service runtime/journey or production readiness claim'}));
