'use strict';
const fs=require('fs'),path=require('path'),os=require('os');
const m=require('../../scripts/improve-memory.cjs');
const who={principal:'owner',holder:'researcher-A',assignment_revision:'assignment-1',role:'researcher'};
const state=()=>({history:[],runs:{R:{canonical_repo:'/fixture'}}});
const descriptor={affected_paths:['src/resume.js'],observable:'Resume.steps'};
test('MEM-IDENTITY structural identity survives punctuation, ordering and hypothesis paraphrase',()=>{
  expect(m.familyKey('/fixture',descriptor)).toBe(m.familyKey('/fixture',{affected_paths:['src/resume.js','src/resume.js'],observable:'RESUME / steps'}));
  expect(m.familyKey('/other',descriptor)).not.toBe(m.familyKey('/fixture',descriptor));
  expect(()=>m.family({...descriptor,principal:'owner'})).toThrow('invalid_memory_request');
  expect(()=>m.family({...descriptor,affected_paths:['../outside']})).toThrow('invalid_memory_paths');
});
test('MEM-ATOMIC immutable chained observations detect edits, removed internal rows and missing anchored tail',()=>{
  const s=state();m.append(s,'/fixture','R',who,'outcome',{decision:'REVERT'},1);m.append(s,'/fixture','R',who,'outcome',{decision:'INCONCLUSIVE'},2);
  const changed=structuredClone(s);changed.history[0].memory.data.decision='KEEP';expect(()=>m.events(changed,'/fixture')).toThrow('memory_chain_corrupt');
  const missing=structuredClone(s);missing.history.shift();expect(()=>m.events(missing,'/fixture')).toThrow('memory_chain_corrupt');
  const tail=structuredClone(s);tail.history.pop();expect(()=>m.events(tail,'/fixture')).toThrow('memory_chain_corrupt');
  expect(m.events(s,'/fixture').map(e=>e.data.decision)).toEqual(['REVERT','INCONCLUSIVE']);
});
test('MEM-ATOMIC committed command retry precedes revision check; conflicting input cannot overwrite',()=>{
  const s=state(),req={request_id:'command-A',expected_revision:m.ZERO,reason:'first'};
  expect(m.priorCommand(s,'/fixture',who,req)).toBeNull();const receipt=m.finishCommand(s,'/fixture','R',who,req,'resolution',{}, {allowed:true},1);
  expect(m.priorCommand(s,'/fixture',who,req)).toMatchObject({...receipt,duplicate:true});
  expect(()=>m.priorCommand(s,'/fixture',who,{...req,reason:'rewritten'})).toThrow('memory_idempotency_conflict');
  expect(()=>m.priorCommand(s,'/fixture',who,{...req,request_id:'other'})).toThrow('memory_revision_conflict');
});
test('MEM-CONSUME bounded pack does not evict suppression history or lose original provenance',()=>{
  const s=state();for(let i=0;i<130;i++)m.append(s,'/fixture','R',who,'observation',{number:i},i);
  const p=m.pack(s,'/fixture','registered');expect(p.events).toHaveLength(128);expect(p.truncated).toBe(true);expect(m.events(s,'/fixture')).toHaveLength(130);expect(p.events[0].actor).toEqual(who);
});
test('MEM-ISOLATION actual private resolver binds immutable bytes and rejects symlink escape',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'memory-evidence-'));fs.chmodSync(root,0o700);
  try{const file=path.join(root,'observation.json'),doc={version:1,id:'observation',repo_id:'fixture',family_key:m.familyKey('/fixture',descriptor),source_revision:'a'.repeat(64),affected_paths:descriptor.affected_paths,actor:who,executed:1,failed:0,skipped:0,exit_code:0,valid:true,failure_category:'none'};
    const ref=require('../helpers/memory-evidence.cjs').writeCapturedEvidence(root,doc),resolve=m.createFileEvidenceResolver(root);
    expect(m.resolveEvidence({resolveEvidence:resolve},[ref],{repoId:'fixture',familyKey:doc.family_key,paths:descriptor.affected_paths})[0]).toMatchObject(ref);
    fs.appendFileSync(file,' ');expect(()=>resolve(ref)).toThrow('memory_evidence_changed');fs.unlinkSync(file);fs.symlinkSync('/etc/passwd',file);expect(()=>resolve(ref)).toThrow('memory_unsafe_source');
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});

const {memoryFixture}=require('../helpers/improve-memory.cjs');
let f;afterEach(()=>{f?.cleanup();f=null;});
test('MEM-CONSUME memory-enabled admission cannot reserve a cycle without selection; successor reads a safe repo pack',()=>{
  f=memoryFixture();const binding={job_id:'job',operation_id:'operation',core_run_id:'core'};
  expect(()=>f.s.reserveCycle({...f.req,binding})).toThrow('memory_selection_required');
  const first=f.s.selectMemory(f.command({selection:f.selection()}));expect(first.allowed).toBe(true);
  const cycle=f.s.reserveCycle({...f.req,binding});expect(cycle.allowed).toBe(true);
  f.config().resolvePrincipal();
  // The existing viewer grant is a genuinely different principal, not just a renamed bot.
  f.principal='viewer';
  expect(()=>f.service().status(f.req)).toThrow('run_unavailable');
  const pack=f.service().decisionPack({repo_id:'fixture'});expect(pack.events[0].actor.principal).toBe('owner');
  expect(JSON.stringify(pack)).not.toContain('controller-provider-double');
});
test('MEM-IDENTITY a real restart blocks a renamed/paraphrased failed family and accepts only relevant new evidence',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const previous=f.seededOutcome();
  const retry=f.service().selectMemory(f.command({selection:f.selection({id:'renamed',hypothesis:'Skip the unnecessary confirm step'})}));
  expect(retry).toMatchObject({allowed:false,reason_code:'memory_equivalent_attempt'});
  const irrelevant=f.evidence('unrelated',{affected_paths:['README.md']});
  expect(()=>f.s.selectMemory(f.command({selection:f.selection({retry:{reason:'New note',evidence:[irrelevant]}})}))).toThrow('memory_evidence_unavailable');
  const observation=f.evidence();
  const changed=f.service().selectMemory(f.command({selection:f.selection({retry:{reason:'Fresh independent measurement on affected input',evidence:[observation]},consumed:[previous.hash]})}));
  expect(changed.allowed).toBe(true);
  expect(f.s.decisionPack({repo_id:'fixture'}).events.filter(e=>e.kind==='outcome')[0].data.decision).toBe('REVERT');
});
test('MEM-AUTH pending KEEP and closed-unmerged observation cannot unlock a repeat; owner rejection commits without rewriting KEEP',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const old=f.seededOutcome('KEEP');
  f.s.observeMemory(f.command({outcome_id:old.hash,source_revision:'proposal-closed',evidence:[],observation:{kind:'proposal',state:'closed_unmerged'}}));
  expect(f.s.selectMemory(f.command({selection:f.selection()})).reason_code).toBe('pending_review');
  const resolution=f.command({outcome_id:old.hash,action:'reject_idea',reason:'Do not pursue this family',source_revision:'owner-decision-1',evidence:[],baseline:null,alias_family:null},'resolve');
  expect(()=>f.s.resolveMemory({...resolution,principal:'owner'})).toThrow('invalid_memory_request');
  expect(f.s.resolveMemory(resolution).allowed).toBe(true);
  expect(f.s.resolveMemory(resolution).duplicate).toBe(true);
  expect(f.s.status(f.req).runs[0].reasons).not.toContain('pending_review');
  const rows=f.s.decisionPack({repo_id:'fixture'}).events;expect(rows.find(e=>e.kind==='outcome').data.decision).toBe('KEEP');
  expect(f.s.selectMemory(f.command({selection:f.selection()})).reason_code).toBe('memory_owner_rejected');
});
test('MEM-BASELINE stale pack and unregistered retained baseline fail before a provider or cycle starts',()=>{
  f=memoryFixture();const first=f.command({selection:f.selection()});f.s.selectMemory(first);
  expect(()=>f.s.selectMemory({...first,request_id:'stale'})).toThrow('memory_revision_conflict');
  const bad=f.selection();bad.base_ref='unmerged';expect(()=>f.s.selectMemory(f.command({selection:bad}))).toThrow('memory_baseline_not_registered');
  expect(f.s.status(f.req).runs[0].consumed_attempts).toBe(0);
});
test('MEM-VERDICT invalid fixture remains needs-change; no empty or invalid evidence can make it disproof',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const old=f.seededOutcome('INCONCLUSIVE',false);
  const input=f.command({outcome_id:old.hash,source_revision:'experiment-review',evidence:[],observation:{kind:'experiment',verdict:'disproven',criteria_revision:f.task.criteria_revision,rationale:'A failed fixture is not disproof'}});
  expect(()=>f.s.observeMemory(input)).toThrow('invalid_memory_evidence');
  const invalid=f.evidence('invalid',{valid:false,failure_category:'verification'});
  expect(()=>f.s.observeMemory({...input,evidence:[invalid]})).toThrow('memory_evidence_unavailable');
  const pack=f.s.decisionPack({repo_id:'fixture'});expect(pack.events.find(e=>e.kind==='outcome').data.experiment_verdict).toBe('needs-change');
});
test('MEM-AUTH execute revocation prevents another memory write while authorised historical pack remains readable',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));
  f.update(p=>{p.grants.owner=['read','preflight'];});
  const before=f.service().decisionPack({repo_id:'fixture'});
  expect(()=>f.service().selectMemory(f.command({selection:f.selection({id:'B',observable:'saved.feedback'})}))).toThrow('authority_revoked');
  expect(f.service().decisionPack({repo_id:'fixture'})).toEqual(before);
});
test('MEM-AUTH pending denial does not consume owner-authorized evidence and an old grant cannot bypass a later rejection',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const old=f.seededOutcome('KEEP'),e=f.evidence('pending-new');
  const retry=()=>f.s.selectMemory(f.command({selection:f.selection({retry:{reason:'Independent measurement',evidence:[e]}})}));
  expect(retry().reason_code).toBe('pending_review');
  const resolve=(action,evidence=[])=>f.s.resolveMemory(f.command({outcome_id:old.hash,action,reason:'Authenticated current owner decision',source_revision:'owner-1',evidence,baseline:null,alias_family:null}));
  expect(resolve('retry_with_new_evidence',[e]).allowed).toBe(true);
  expect(retry().allowed).toBe(true);
  f.seededOutcome('REVERT');expect(resolve('reject_idea').allowed).toBe(true);
  // A prior grant is superseded by the explicit later rejection. The new input
  // is real and distinct, but cannot turn the old grant into current permission.
  fs.appendFileSync(path.join(f.repo,'test.cjs'),'\n// new controlled input');const fresh=f.evidence('after-reject');
  const denied=f.s.selectMemory(f.command({selection:f.selection({retry:{reason:'New measurement plus old grant',evidence:[e,fresh]}})}));
  expect(denied.reason_code).toBe('memory_owner_rejected');
});
test('MEM-BASELINE a real unmerged branch does not replace registered main',()=>{
  f=memoryFixture();const original=f.git('rev-parse','main');
  f.git('checkout','-b','retained');fs.writeFileSync(path.join(f.repo,'unmerged.txt'),'retained only');f.git('add','unmerged.txt');f.git('commit','-m','retained fixture');const retained=f.git('rev-parse','HEAD');f.git('checkout','main');
  const changed=f.selection();changed.base_ref='retained';changed.base_commit=retained;
  expect(()=>f.s.selectMemory(f.command({selection:changed}))).toThrow('memory_baseline_not_registered');
  expect(f.git('rev-parse','main')).toBe(original);expect(f.s.status(f.req).runs[0].consumed_attempts).toBe(0);
});
test('MEM-BASELINE altered criteria or a candidate mismatch cannot reach a protected stage',()=>{
  f=memoryFixture();const changed=f.selection();changed.task={...changed.task,criteria:[{id:'steps',statement:'An easier condition'}]};
  expect(()=>f.s.selectMemory(f.command({selection:changed}))).toThrow('memory_criteria_revision_mismatch');
  const original=f.selection();f.s.selectMemory(f.command({selection:original}));const cycle=f.s.reserveCycle({...f.req,binding:{job_id:'job',operation_id:'op',core_run_id:'core'}}).cycle;
  const request={...f.req,cycle_id:cycle.id,stage:'freezeContract'},value={core_run_id:'core',base_commit:original.base_commit,candidate_digest:m.digest(original.candidates),criteria_revision:'0'.repeat(64)};
  expect(()=>f.s.validateMemoryStage(request,value)).toThrow('memory_criteria_revision_mismatch');
  let calls=0;expect(()=>f.s.startStage({...f.req,cycle_id:cycle.id,stage:'critique'},()=>++calls)).toThrow('memory_stage_binding_required');
  expect(calls).toBe(0);
  expect(()=>f.s.startAttempt({...f.req,cycle_id:cycle.id,role:'builder'},()=>++calls)).toThrow('memory_stage_required');
  expect(f.s.status(f.req).runs[0].consumed_attempts).toBe(0);
});
test('MEM-AUTH historical decision projection survives removal of its registered checkout',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const before=f.s.decisionPack({repo_id:'fixture'});
  fs.renameSync(f.repo,f.repo+'-removed');
  expect(f.service().decisionPack({repo_id:'fixture'})).toEqual(before);
});
test('MEM-AUTH another registered canonical repo cannot read or mutate this decision family',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const before=f.s.decisionPack({repo_id:'fixture'});
  const other=path.join(f.root,'other-repo');fs.cpSync(f.repo,other,{recursive:true});
  const profile=structuredClone(f.profile);profile.repo_id='other';profile.repository.path=other;
  require('../../scripts/improve-profiles.cjs').registerProfile(f.registry,profile);
  expect(f.service().decisionPack({repo_id:'other'}).events).toEqual([]);
  expect(()=>f.service().selectMemory({...f.command({selection:f.selection()}),repo_id:'other'})).toThrow('memory_run_unavailable');
  expect(f.service().decisionPack({repo_id:'fixture'})).toEqual(before);
});
test('MEM-CONSUME changed candidate selection cites preserved evidence; A/B/A does not escape under a new holder',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const previous=f.seededOutcome();
  f.holder='replacement-researcher';
  const choice=f.selection({id:'B',observable:'saved.feedback',consumed:[previous.hash]});
  expect(f.service().selectMemory(f.command({selection:choice})).allowed).toBe(true);
  const row=f.s.decisionPack({repo_id:'fixture'}).events.filter(e=>e.data.type==='selection').at(-1);
  expect(row.data.selected.id).toBe('B');expect(row.data.consumed_observations).toEqual([previous.hash]);expect(row.actor.holder).toBe('replacement-researcher');
  f.seededOutcome();
  expect(f.s.selectMemory(f.command({selection:f.selection({id:'restored',hypothesis:'Return to the original confirmation idea'})})).reason_code).toBe('memory_equivalent_attempt');
});

test.each(['non-owner-own-run','non-owner-owner-run','revoked-owner','cross-repo'])(
  'MEM-AUTH resolveMemory denial (%s) preserves the exact pending KEEP',mode=>{
    f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const original=f.seededOutcome('KEEP');
    const req=f.command({outcome_id:original.hash,action:'reject_idea',reason:'Attempted resolution',source_revision:'resolution-source',evidence:[],baseline:null,alias_family:null});
    let svc=f.service(),expected;
    if(mode==='non-owner-own-run'){
      svc=require('../../scripts/improve-controller.cjs').createControllerService({...f.config(),ownerPrincipal:'configured-new-owner',memory:f.memory});
      expected='memory_owner_required';
    }else if(mode==='non-owner-owner-run'){
      f.update(p=>{p.grants.viewer=['read','preflight','execute'];});f.principal='viewer';svc=f.service();expected='memory_run_unavailable';
    }else if(mode==='revoked-owner'){
      f.update(p=>{p.grants.owner=['read','preflight'];});svc=f.service();expected='authority_revoked';
    }else{
      const other=path.join(f.root,'resolution-other');fs.cpSync(f.repo,other,{recursive:true});const profile=structuredClone(f.profile);profile.repo_id='other';profile.repository.path=other;
      require('../../scripts/improve-profiles.cjs').registerProfile(f.registry,profile);req.repo_id='other';expected='memory_run_unavailable';
    }
    expect(()=>svc.resolveMemory(req)).toThrow(expected);f.principal='owner';
    expect(f.service().status(f.req).runs[0].reasons).toContain('pending_review');
    const rows=f.service().decisionPack({repo_id:'fixture'}).events;
    expect(rows.find(e=>e.hash===original.hash).data.decision).toBe('KEEP');
    expect(rows.filter(e=>e.data.type==='resolution')).toHaveLength(0);
  }
);
function advanceMain(name) {
  const before=f.git('rev-parse','main');fs.writeFileSync(path.join(f.repo,name),'New actual input');f.git('add',name);f.git('commit','-m','move fixture main');
  const after=f.git('rev-parse','main');expect(after).not.toBe(before);return {before,after};
}
test('MEM-BASELINE actual moved main is rejected by upstream preflight before selection or cycle admission',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));const moved=advanceMain('changed.txt');
  expect(()=>f.service().selectMemory(f.command({selection:f.selection({id:'B',observable:'other'})}))).toThrow('repository_mismatch');
  expect(()=>f.service().reserveCycle({...f.req,binding:{job_id:'job',operation_id:'op',core_run_id:'core'}})).toThrow('repository_mismatch');
  expect(f.service().status(f.req).runs[0].consumed_attempts).toBe(0);
  expect(f.service().decisionPack({repo_id:'fixture'}).events.filter(e=>e.data.type==='selection'&&e.data.result.allowed)).toHaveLength(1);
  console.log(JSON.stringify({case:'moved-main-before-preflight',...moved,reason_code:'repository_mismatch',consumed_attempts:0}));
});
test.each(['selection','cycle'])('MEM-BASELINE Git move between authority check and %s transaction hits the inner stale guard',stage=>{
  f=memoryFixture();if(stage==='cycle')f.s.selectMemory(f.command({selection:f.selection()}));
  const req=stage==='selection'?f.command({selection:f.selection()}):{...f.req,binding:{job_id:'job',operation_id:'op',core_run_id:'core'}};
  let moved,armed=true;
  const svc=require('../../scripts/improve-controller.cjs').createControllerService({...f.config(),memory:f.memory,fault:where=>{
    if(where==='before_transition'&&armed){armed=false;moved=advanceMain('race.txt');}
  }});
  expect(()=>stage==='selection'?svc.selectMemory(req):svc.reserveCycle(req)).toThrow('memory_stale_baseline');
  expect(f.service().status(f.req).runs[0].consumed_attempts).toBe(0);
  expect(f.service().decisionPack({repo_id:'fixture'}).events.filter(e=>e.data.type==='selection'&&e.data.result.allowed)).toHaveLength(stage==='cycle'?1:0);
  console.log(JSON.stringify({case:'moved-main-during-'+stage,...moved,reason_code:'memory_stale_baseline',consumed_attempts:0}));
});
test('MEM-BASELINE a changed profile after selection cannot rebind the admitted run',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));f.update(p=>{p.mission+=' New approved revision.';});
  expect(()=>f.service().selectMemory(f.command({selection:f.selection({id:'B',observable:'other'})}))).toThrow('memory_selection_unavailable');
  expect(f.service().status(f.req).runs[0].consumed_attempts).toBe(0);
  expect(f.service().decisionPack({repo_id:'fixture'}).events.filter(e=>e.data.type==='selection'&&e.data.result.allowed)).toHaveLength(1);
});
test('MEM-IDENTITY renaming an identical observation cannot authorise another attempt',()=>{
  f=memoryFixture();f.s.selectMemory(f.command({selection:f.selection()}));f.seededOutcome();
  const first=f.evidence('first-observation');
  expect(f.s.selectMemory(f.command({selection:f.selection({retry:{reason:'First independent observation',evidence:[first]}})})).allowed).toBe(true);
  f.seededOutcome();const renamed=f.evidence('same-observation-renamed');
  expect(()=>f.s.selectMemory(f.command({selection:f.selection({retry:{reason:'Same facts under a new ID',evidence:[renamed]}})}))).toThrow('memory_no_new_relevant_evidence');
});
