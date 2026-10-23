'use strict';
// Verify retained historical receipts. Never executes a browser, model or consumed holdout.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const binding=require('../../scripts/improve-binding.cjs'),improve=require('../../scripts/specflow-improve.cjs');
const state=path.resolve(process.argv[2]||'');if(!process.argv[2])throw Error('Pass the private retained proof-state directory');
const original=fs.readFileSync(path.join(state,'run-path.txt'),'utf8').trim(),run=path.join(state,'runs',path.basename(original));
const read=file=>JSON.parse(fs.readFileSync(file,'utf8')),sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const locate=file=>file.startsWith(original+path.sep)?path.join(run,file.slice(original.length+1)):file;
const events=fs.readFileSync(path.join(run,'ledger.jsonl'),'utf8').trim().split('\n').map(JSON.parse),last=(name,phase)=>events.findLast(e=>e.event===name&&(!phase||e.phase===phase));
let executed=0;const check=(condition,message)=>{assert(condition,message);executed++;};
check(improve.verifyLedger(run).ok,'ledger chain');
const source=read(path.join(run,'run.json')),contract=read(path.join(run,'improvement-contract.v1.json')),decision=read(path.join(run,'decision.json'));
check(source.base_commit==='a8de4e92850e4ffe46da241e0bfd9c6703f792ae','actual source base');
check(contract.created_after_implementation===false,'freeze precedes implementation');
check(last('contract_frozen').contract_sha256===sha(path.join(run,'improvement-contract.v1.json')),'frozen contract hash');
for(const [file,hash] of Object.entries(contract.artifact_sha256))check(sha(path.join(run,file))===hash,'unchanged oracle/practice '+file);
check(events.filter(e=>e.event==='holdout_consumed').length===1,'candidate holdout consumed exactly once');
check(events.filter(e=>e.event==='verification_completed'&&e.phase==='after').length===1,'one completed candidate verification');
const evidence=fs.readFileSync(path.join(run,'evidence.jsonl'),'utf8').trim().split('\n').map(JSON.parse),receipts={};
for(const phase of ['baseline','after']){
 const event=last('verification_receipt',phase),file=locate(event.path);check(sha(file)===event.sha256,'receipt hash '+phase);const receipt=read(file);receipts[phase]=receipt;
 check(receipt.identity.run_id===source.run_id&&receipt.identity.base_commit===source.base_commit,'receipt identity '+phase);
 for(const ref of receipt.evidence){const item=evidence.find(e=>e.id===ref.id);check(item&&binding.digest(item)===ref.sha256,'bound evidence '+ref.id);check(sha(locate(item.evidence_path))===item.evidence_sha256,'raw evidence '+ref.id);}
}
check(receipts.baseline.identity.verifier===receipts.after.identity.verifier,'matched historical verifier');
check(receipts.baseline.identity.contract_sha256===receipts.after.identity.contract_sha256,'matched contract');
check(decision.decision==='INCONCLUSIVE','truthful final decision');check(decision.binding_errors.length===0,'no binding failure in tested cycle');
check(decision.gains.length===1&&decision.gains[0].established,'binary gain established without automatic KEEP');
check(decision.criteria.find(c=>c.id==='UX-RESTRAINT').status==='missing','blocked UX verdict not imported');
check(decision.peer_recommendation===null,'invalid peer advice not promoted');
check(decision.side_effects_attempted===0&&decision.base.unchanged,'side-effect/base boundaries');
const applied=last('decision_applied');check(applied.branch_retained===false,'no product branch retained');check(sha(path.join(run,'workspace.patch'))===applied.patch_sha256,'attempted patch preserved');
const archive=read(path.join(state,'tested-runtime-before-protocol-fix/manifest.json'));
for(const [file,hash]of Object.entries(archive.files))check(sha(path.join(state,'tested-runtime-before-protocol-fix',file))===hash,'tested runtime archive '+file);
const diagnosis=read(path.join(state,'ux-diagnosis.json'));check(diagnosis.acceptedByCore===false&&diagnosis.successfulImageReads.length===9,'actual independent image inspection and blocked result');
check(diagnosis.unacceptedVerbatimVerdict.judgments[0].result==='fail','raw UX rejection preserved');
const replay=read(path.join(state,'protocol-replay.json'));check(replay.modelCalled===false&&replay.fakeTransport===true&&replay.newAdapterStatus==='gate_rerun_required'&&!replay.qualifyingEvidenceImported,'parser replay has no model/gate authority');
const counts={};
for(const phase of ['baseline','after']){
 counts[phase]={};for(const criterion of ['GAIN-RESPONSIVE','PRESERVE-DESKTOP','PRESERVE-BACKEND']){
  const item=evidence.findLast(e=>e.phase===phase&&e.criterion===criterion&&e.set==='holdout');const m=item.measurements;
  check(m.executed===m.expected&&m.skipped===0,'real executed counts '+phase+'/'+criterion);counts[phase][criterion]={executed:m.executed,passed:m.passed,failed:m.failed,skipped:m.skipped};
  const raw=read(locate(m.reportPath));check(raw.stats.expected===m.passed&&raw.stats.unexpected===m.failed&&raw.stats.skipped===m.skipped,'actual Playwright JSON agrees '+phase+'/'+criterion);
 }
}
check(counts.baseline['GAIN-RESPONSIVE'].failed===5&&counts.after['GAIN-RESPONSIVE'].passed===6,'declared responsive comparison');
const report=fs.readFileSync(path.join(run,'report.md'),'utf8'),next=report.split('## Human next decision\n')[1].split('\n## ')[0];
check(next.includes('UX-RESTRAINT')&&next.includes('no valid Duo peer recommendation')&&next.includes('Never rerun a consumed holdout'),'correct evidence-based next action');
console.log(JSON.stringify({executed,failed:0,skipped:0,scope:'retained historical receipt verification only; no browser/model/holdout replay',decision:decision.decision,playwright:counts,successfulIndependentImageReads:9,productBranchRetained:false,ledgerEntries:events.length,verifier:receipts.baseline.identity.verifier}));
