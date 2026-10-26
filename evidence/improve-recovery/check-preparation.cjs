'use strict';
const fs=require('fs'),cp=require('child_process'),crypto=require('crypto'),assert=require('assert'),yaml=require('js-yaml');
let executed=0;const check=(ok,why)=>{assert(ok,why);executed++;},read=p=>fs.readFileSync(p,'utf8'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const story=read('docs/specs/improve-recovery/story.md'),effort=read('docs/specs/improve-recovery/effort-policy-source.md'),prep=read('docs/specs/improve-recovery/preparation.md'),types=read('docs/specs/improve-recovery/interface.d.ts');
for(let i=1;i<=6;i++)check(story.includes('AC-11-'+i),'Original recovery AC');
for(let i=1;i<=14;i++)check((i<=10?story:prep).includes('AC-RECOVERY-'+String(i).padStart(2,'0')),'Recovery AC'+i);
for(let i=1;i<=5;i++)check(effort.includes('AC-EFFORT-'+String(i).padStart(2,'0')),'Effort AC'+i);
for(const row of ['REC-LOCK','REC-FENCE','REC-RECEIPT','REC-CYCLE','EFFORT-V2','REC-REPORT','GATE-FULL','GATE-LIVE'])check(prep.includes(row),'Mapped '+row);
const ids=new Set();for(const file of fs.readdirSync('docs/contracts').filter(n=>n.endsWith('.yml'))){const d=yaml.load(read('docs/contracts/'+file));for(const inv of d.invariants||[]){check(!ids.has(inv.id),'Unique '+inv.id);ids.add(inv.id);}}
for(const c of ['feature_improve_core','feature_improve_profiles','feature_improve_worker','feature_improve_controller','feature_improve_memory']){const file='docs/contracts/'+c+'.yml';check(cp.execFileSync('git',['show','0fee60a:'+file],{encoding:'utf8'})===read(file),'Original contract unchanged '+c);}
for(const word of ['ProcessIdentity','RecoveryHost','LimitsV2','OperationReceipt','ControllerRecoveryExtension','MorningReportV2'])check(types.includes(word),'Exact selected interface '+word);
const cap=JSON.parse(read('tmp/recovery/upstream-capability.json')),raw=JSON.parse(read(cap.raw.path));check(hash(cap.raw.path)===cap.raw.sha256,'Actual upstream receipt');check(cap.executed===raw.numPassedTests&&raw.success&&raw.numFailedTests===0&&raw.numPendingTests===0,'Upstream1776 passed');
const volume=require('../../scripts/specflow-volume.cjs').report(process.cwd(),JSON.parse(read('tmp/recovery/record.json')));check(volume.errors.length===0,'Specification references/conflicts: '+volume.errors.join('; '));
const probe=cp.spawnSync(process.execPath,['evidence/improve-recovery/check-lock-capability.cjs'],{encoding:'utf8',timeout:15000});check(probe.status===0,'Actual kernel SIGKILL capability');const result=JSON.parse(probe.stdout);check(result.executed===6&&result.failed===0&&result.skipped===0&&result.termination.signal==='SIGKILL','Real process evidence');
cp.execFileSync('git',['diff','--check']);executed++;
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'Preparation/schema/traceability and real Linux capability only; no production recovery compliance or native/backend execution claim',kernel:result,upstreamPreviouslyExecuted:cap.executed,upstreamRaw:cap.raw}));
