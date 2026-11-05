const directionFixture = require('../helpers/duo-direction.js');
const fs = require('fs');
const path = require('path');
const os = require('os');
const {execFileSync, spawn} = require('child_process');
const duo = require('../../scripts/duo-build.cjs');
let root;
const put = (name, text) => { const f=path.join(root,name); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,text); };
const context = () => ({workKind:'preparation',goal:'goal.md', task:'task.md', objective:'Explain a correct balance', finish:'All criteria and required tests verified', criteria:[
  {id:'AC-1', source:'task.md', anchor:'AC-1: correct value', kind:'acceptance'},
  {id:'AC-2', source:'task.md', anchor:'AC-2: explanation', kind:'acceptance'},
  {id:'GATE-TESTS', source:'CLAUDE.md', anchor:'Tests must pass before finishing.', kind:'gate'},
]});
const batch = (extra={}) => ({id:'work', scope:'balance explanation', criteria:['AC-1','AC-2','GATE-TESTS'], claims:['locally verified'], assumptions:[], evidence:['raw.txt'], resolutions:[], ...extra});
const readRun = id => duo.load(root,id).state;
const token = id => readRun(id).owner.session;
const start = builder => duo.start(root,'#135-137',builder || 'claude-code',context());
const finding = () => ({id:'F1', criterion:'AC-1', kind:'acceptance', basis:'AC-1 value is wrong', evidence:'tree/raw.txt', action:'Correct value', verification:'Re-run assertion for the displayed value'});
function peer({outcome='accepted', diagnostic='new observation', change=()=>{}, invokeLog=[]}={}) {
  return (exe,args,opts) => {
    if(args[0]==='--version') return 'fixture-version';
    if(args[0]==='auth') return '{"loggedIn":true}';
    if(args[0]==='login') return 'Logged in using ChatGPT';
    invokeLog.push(exe);
    const request=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));
    const result={outcome, summary:outcome, inspected:request.requiredReads, index_complete:true,
      findings:outcome==='changes_required'?[finding()]:[], unrelated:[],
      assessments:request.batch.criteria.map(id=>({id,status:outcome==='accepted'?'verified':'unverified',evidence:[...request.batch.evidence],reason:'fixture evidence inspected'})),
      resolutions:request.open_findings.map(f=>({id:f.id,status:outcome==='accepted'?'closed':'open',evidence:[...request.batch.evidence],reason:'fixture disposition'})),
      diagnostics:diagnostic?[{observation:diagnostic,evidence:[...request.batch.evidence]}]:[]};
    change(result,request,opts);
    directionFixture.feedback(request, result);
    if(exe==='codex') fs.writeFileSync(path.join(opts.cwd,'response.json'),JSON.stringify(result));
    return directionFixture.transport(result,exe,opts.cwd);
  };
}
const review = (run,b,provider) => duo.review(root,run.id,directionFixture.respond(readRun(run.id), b || batch()),provider || peer(),token(run.id));
beforeEach(()=>{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'duo-ops-'));
  for(const args of [['init'],['config','user.email','test@example.test'],['config','user.name','Test']])execFileSync('git',args,{cwd:root,stdio:'pipe'});
  put('goal.md','Accurate explainable balances. Unknown jurisdiction remains unknown.');
  put('task.md','AC-1: correct value\nAC-2: explanation\n');put('CLAUDE.md','Tests must pass before finishing.');put('code.cjs','module.exports = 41;');put('raw.txt','Observed 41, expected 42.');
  execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-m','fixture'],{cwd:root,stdio:'pipe'});
});
afterEach(()=>{delete process.env.SPECFLOW_DUO_REVIEWER;fs.rmSync(root,{recursive:true,force:true});});
describe('portable: REQ-P1..P4',()=>{
  test('review requires only instructions applicable to its source paths',()=>{
    put('AGENTS.md','Root guidance.');
    put('src/AGENTS.md','Source guidance.');
    put('src/thing.js','module.exports = true;');
    put('docs/archive/extension-legacy/AGENTS.md','Archived guidance.');
    put('docs/archive/extension-legacy/old.js','module.exports = false;');
    const run=duo.start(root,'#247','claude-code',{...context(),references:['src/thing.js']});
    let required;
    expect(review(run,batch(),peer({change:(_result,request)=>{required=request.requiredReads;}})).outcome).toBe('accepted');
    expect(required).toContain('tree/AGENTS.md');
    expect(required).toContain('tree/CLAUDE.md');
    expect(required).toContain('tree/src/AGENTS.md');
    expect(required).not.toContain('tree/docs/archive/extension-legacy/AGENTS.md');
    expect(fs.existsSync(path.join(root,'.specflow/duo',run.id,'round-001/tree/docs/archive/extension-legacy/AGENTS.md'))).toBe(true);

    const archived=duo.start(root,'#247-archive','claude-code',{...context(),references:['docs/archive/extension-legacy/old.js']});
    let archiveReads;
    expect(review(archived,batch(),peer({change:(_result,request)=>{archiveReads=request.requiredReads;}})).outcome).toBe('accepted');
    expect(archiveReads).toContain('tree/docs/archive/extension-legacy/AGENTS.md');
    expect(()=>duo.validateReview({
      outcome:'accepted',summary:'checked',findings:[],unrelated:[],
      inspected:['tree/AGENTS.md'],
    },{requiredReads:['tree/AGENTS.md','tree/docs/archive/extension-legacy/AGENTS.md']}))
      .toThrow(/Peer did not inspect required artifact/);
  });
  test('J-DUO-HANDOFF: change host, preserve goal/findings/budget, and flip peer',()=>{
    const run=start(), initialGoal=fs.readFileSync(path.join(root,'.specflow/duo',run.id,'goal.md'),'utf8'), calls=[];
    expect(review(run,batch(),peer({outcome:'changes_required',invokeLog:calls})).outcome).toBe('changes_required');
    const old=token(run.id), moved=duo.resume(root,run.id,'codex',{takeover:true,reason:'user moved from Claude'});
    expect(moved.id).toBe(run.id);expect(moved.repairCycle.attempts).toBe(1);expect(moved.findings.F1.status).toBe('open');expect(token(run.id)).not.toBe(old);
    expect(()=>duo.review(root,run.id,batch(),peer(),old)).toThrow(/does not own/);
    put('code.cjs','module.exports = 42;');put('raw.txt','Observed correct value and explanation; tests passed.');
    const result=review(run,batch({resolutions:[{id:'F1',change:'fixed value',evidence:['raw.txt']}]}),peer({invokeLog:calls}));
    expect(result.outcome).toBe('accepted');expect(calls).toEqual(['codex','claude']);expect(result.history).toHaveLength(2);
    expect(fs.readFileSync(path.join(root,'.specflow/duo',run.id,'goal.md'),'utf8')).toBe(initialGoal);
    expect(duo.finish(root,run.id,token(run.id)).goalStatus).toBe('complete');
  });
  test('owner-fencing: stale tokens cannot capture, release or finish',()=>{
    const run=start(), old=token(run.id);duo.resume(root,run.id,'codex',{takeover:true,reason:'explicit transfer'});
    expect(()=>duo.capture(root,run.id,old,['node','-e','process.exit(0)'])).toThrow(/does not own/);
    expect(()=>duo.release(root,run.id,old)).toThrow(/does not own/);
    expect(()=>duo.finish(root,run.id,old)).toThrow(/does not own/);
    expect(()=>duo.inspect(root,run.id,old)).toThrow(/does not own/);
    expect(()=>duo.resume(root,run.id,'claude-code')).toThrow(/explicit/);
    duo.release(root,run.id,token(run.id));expect(duo.resume(root,run.id,'claude-code').owner.builder).toBe('claude-code');
  });
  test('operation-lock: a real capture process blocks takeover until it exits',async()=>{
    const run=start(), script=path.resolve(__dirname,'../../scripts/duo-build.cjs');
    const child=spawn(process.execPath,[script,'capture',run.id,'--session',token(run.id),'--',process.execPath,'-e','setTimeout(()=>console.log("done"),500)'],{cwd:root,stdio:'pipe'});
    const completed=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});
    for(let i=0;i<100&&!fs.existsSync(path.join(root,'.specflow/duo',run.id,'review.lock'));i++)await new Promise(r=>setTimeout(r,10));
    try { expect(duo.inspect(root,run.id).owner.builder).toBe('claude-code'); expect(()=>duo.resume(root,run.id,'codex',{takeover:true,reason:'competing session'})).toThrow(/active/); }
    finally { expect(await completed).toBe(0); }
    expect(readRun(run.id).builder).toBe('claude-code');
  });
  test('legacy-resume: migrate old records without inventing criterion verification or resetting counts',()=>{
    const run=start(), file=path.join(root,'.specflow/duo',run.id,'run.json'), legacy=readRun(run.id);
    legacy.version=1;legacy.history=[{batch:'old',attempted:true,outcome:'changes_required',review:{findings:[{id:'F1',basis:'risk',evidence:'raw.txt',action:'fix'}]}}];
    fs.writeFileSync(file,JSON.stringify(legacy));
    const state=duo.resume(root,run.id,'codex');expect(state.history).toHaveLength(1);expect(state.batchAttempts.old).toBe(1);expect(state.findings.F1.status).toBe('open');
    expect(()=>duo.finish(root,run.id,state.owner.session)).toThrow(/incomplete/);
    duo.indexGoal(root,run.id,state.owner.session,context().criteria);expect(Object.keys(readRun(run.id).criteria)).toHaveLength(3);
  });
  test('unsupported host and recursive reviewer cannot acquire ownership',()=>{
    const run=start();expect(()=>duo.resume(root,run.id,'unknown',{takeover:true,reason:'test'})).toThrow(/builder must/);
    process.env.SPECFLOW_DUO_REVIEWER='1';expect(()=>duo.resume(root,run.id,'codex',{takeover:true,reason:'test'})).toThrow(/Recursive/);
  });
});
describe('acceptance: REQ-A1..A4',()=>{
  test('J-DUO-GOAL: accepted partial batch is not a completed goal; omitted gate blocks finish',()=>{
    const run=start();expect(review(run,batch({criteria:['AC-1','AC-2']})).outcome).toBe('accepted');
    expect(()=>duo.finish(root,run.id,token(run.id))).toThrow(/GATE-TESTS/);
    expect(review(run,batch({id:'gate',criteria:['GATE-TESTS']})).outcome).toBe('accepted');
    const done=duo.finish(root,run.id,token(run.id));expect(done.goalStatus).toBe('complete');expect(duo.status(done)).toContain('3/3 verified');
  });
  test('missing-criteria: absent, duplicate, false anchors and substring IDs fail closed',()=>{
    expect(()=>duo.start(root,'task','codex',{...context(),criteria:[]})).toThrow(/index/);
    expect(()=>duo.start(root,'task','codex',{...context(),criteria:context().criteria.slice(1)})).toThrow(/AC-1/);
    expect(()=>duo.start(root,'task','codex',{...context(),criteria:[...context().criteria,context().criteria[0]]})).toThrow(/duplicate/);
    expect(()=>duo.start(root,'task','codex',{...context(),criteria:[{...context().criteria[0],anchor:'missing'},...context().criteria.slice(1)]})).toThrow(/anchor/);
    put('task.md','AC-1: correct value\nAC-10: other\nAC-2: explanation');
    expect(()=>duo.start(root,'task','codex',{...context(),criteria:[{...context().criteria[0],anchor:'AC-10: other'},...context().criteria.slice(1)]})).toThrow(/anchor/);
  });
  test.each(['AC-UNKNOWN','constructor'])('unknown batch criterion %s never invokes peer',id=>{
    const run=start(), invoke=jest.fn();expect(review(run,batch({criteria:[id]}),invoke).outcome).toBe('blocked');expect(invoke).not.toHaveBeenCalled();
  });
  test('peer cannot invent evidence, omit assessment or accept an incomplete index',()=>{
    for(const change of [r=>r.assessments[0].evidence=['invented.txt'],r=>r.assessments.pop(),r=>r.index_complete=false]){
      const run=start();expect(review(run,batch(),peer({change})).outcome).toBe('blocked');expect(readRun(run.id).criteria['AC-1'].status).not.toBe('verified');
    }
  });
  test('stale-evidence: ignored captured output tampering invalidates completion',()=>{
    const run=start(), cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','console.log("passed")']);
    const b=batch({evidence:[cap.lastCapture.path]});expect(review(run,b).outcome).toBe('accepted');duo.finish(root,run.id,token(run.id));
    const file=path.join(root,cap.lastCapture.path);fs.appendFileSync(file,'tampered');
    expect(()=>duo.finish(root,run.id,token(run.id))).toThrow(/incomplete/);expect(readRun(run.id).goalStatus).toBe('incomplete');
  });
  test('pinned-acceptance and criterion removal are blocked',()=>{
    const run=start();expect(()=>duo.indexGoal(root,run.id,token(run.id),context().criteria.slice(0,2))).toThrow(/remove/);
    put('task.md','AC-1: accept any value\nAC-2: explanation');expect(()=>duo.resume(root,run.id,'codex',{takeover:true,reason:'resume'})).toThrow(/Pinned/);
  });
  test('source change invalidates goal verification and old captured test output',()=>{
    const run=start(), cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','console.log("passed")']);
    expect(review(run,batch({evidence:[cap.lastCapture.path]})).outcome).toBe('accepted');put('code.cjs','module.exports=0;');
    expect(()=>duo.finish(root,run.id,token(run.id))).toThrow(/incomplete/);
    expect(review(run,batch({evidence:[cap.lastCapture.path]})).blocker).toMatch(/stale/);
  });
});
describe('repairs: REQ-R1..R5',()=>{
  function twoOpenFindings() {
    const run=start();
    const first=review(run,batch(),peer({outcome:'changes_required',change:r=>{
      r.findings.push({...finding(),id:'F2',criterion:'AC-2',basis:'AC-2 explanation is wrong'});
    }}));
    expect(first.outcome).toBe('changes_required');
    return run;
  }
  function partialPeer(outcome='changes_required', change=()=>{}) {
    return peer({outcome,change:r=>{
      r.findings=[];
      r.assessments[0].status='verified';
      r.resolutions.find(x=>x.id==='F1').status='closed';
      r.resolutions.find(x=>x.id==='F2').status='open';
      change(r);
    }});
  }
  test('SCOPED-289 closes an evidenced finding while retaining an explicitly open finding',()=>{
    const run=twoOpenFindings();
    const b=batch({id:'partial',criteria:['AC-1'],resolutions:[{id:'F1',change:'corrected',evidence:['raw.txt']}]});
    const result=review(run,b,partialPeer());
    expect(result.outcome).toBe('changes_required');
    expect(result.findings.F1.status).toBe('closed');
    expect(result.findings.F2.status).toBe('open');
    expect(result.progress.findings_closed).toBe(1);
    expect(result.history.at(-1).stage).toBe('validated');
    expect(result.history.at(-1).review.resolutions).toHaveLength(2);
    expect(()=>duo.finish(root,run.id,token(run.id))).toThrow(/incomplete/);
  });
  test('SCOPED-289 changes required with no new or retained finding remains invalid',()=>{
    const run=start();
    const result=review(run,batch(),peer({outcome:'changes_required',change:r=>{r.findings=[];}}));
    expect(result.outcome).toBe('blocked');expect(result.blocker).toMatch(/without evidenced findings/);
  });
  test('SCOPED-289 missing disposition or unsupported closure remains invalid',()=>{
    const omitted=twoOpenFindings();
    const b=batch({id:'omit',criteria:['AC-1'],resolutions:[{id:'F1',change:'corrected',evidence:['raw.txt']}]});
    const missing=review(omitted,b,partialPeer('changes_required',r=>{r.resolutions=r.resolutions.filter(x=>x.id!=='F2');}));
    expect(missing.outcome).toBe('blocked');expect(missing.blocker).toMatch(/disposition/);
    const unsupported=twoOpenFindings();
    const noResolution=review(unsupported,batch({id:'unsupported',criteria:['AC-1']}),partialPeer());
    expect(noResolution.outcome).toBe('blocked');expect(noResolution.blocker).toMatch(/builder resolution/);
    expect(readRun(unsupported.id).findings.F1.status).toBe('open');
  });
  test('SCOPED-289 accepted outcome cannot retain an open finding',()=>{
    const run=twoOpenFindings();
    const b=batch({id:'unsafe-acceptance',criteria:['AC-1'],resolutions:[{id:'F1',change:'corrected',evidence:['raw.txt']}]});
    const result=review(run,b,partialPeer('accepted'));
    expect(result.outcome).toBe('blocked');expect(result.blocker).toMatch(/open findings/);
    expect(readRun(run.id).findings.F2.status).toBe('open');
  });
  test('missing-disposition: accepting a new batch cannot forget an earlier finding',()=>{
    const run=start();review(run,batch(),peer({outcome:'changes_required'}));put('raw.txt','new output');
    const result=review(run,batch({id:'renamed'}),peer({change:r=>{r.resolutions=[];}}));
    expect(result.outcome).toBe('blocked');expect(result.blocker).toMatch(/disposition/);expect(readRun(run.id).findings.F1.status).toBe('open');
  });
  test('closure without a submitted builder resolution is rejected',()=>{
    const run=start();review(run,batch(),peer({outcome:'changes_required'}));put('raw.txt','new passing output');
    expect(review(run,batch()).blocker).toMatch(/builder resolution/);expect(readRun(run.id).findings.F1.status).toBe('open');
  });
  test('captured-failure: argv is literal, raw failure persists and cannot verify a criterion',()=>{
    const run=start(), cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','console.log(process.argv[1]);console.error("failed");process.exit(7)','$(touch MUST_NOT_EXIST)']);
    const raw=JSON.parse(fs.readFileSync(path.join(root,cap.lastCapture.path)));
    expect(raw.exitCode).toBe(7);expect(raw.stdout).toContain('$(touch MUST_NOT_EXIST)');expect(raw.stderr).toContain('failed');expect(fs.existsSync(path.join(root,'MUST_NOT_EXIST'))).toBe(false);
    expect(review(run,batch({evidence:[cap.lastCapture.path]})).blocker).toMatch(/Failed command/);
  });
  test('capture changing source is recorded as unstable and rejected for verification',()=>{
    const run=start(), cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','require("fs").writeFileSync("code.cjs","changed")']);
    expect(cap.lastCapture.stable).toBe(false);expect(review(run,batch({evidence:[cap.lastCapture.path]})).blocker).toMatch(/source-mutating/);
  });
  test('no-progress: cosmetic edits and repeated observations stop across batch names and host transfer',()=>{
    const run=start();review(run,batch(),peer({outcome:'changes_required',diagnostic:'same observation'}));
    for(let i=0;i<1;i++){
      put('code.cjs',`// cosmetic ${i}\nmodule.exports=41;`);put('raw.txt',`same failure; timestamp ${i}`);
      const result=review(run,batch({id:`alias${i}`}),peer({outcome:'changes_required',diagnostic:'same observation'}));expect(result.outcome).toBe('changes_required');
    }
    duo.resume(root,run.id,'codex',{takeover:true,reason:'new host'});put('raw.txt','another timestamp');
    const invoke=jest.fn();const result=review(run,batch({id:'new-alias'}),invoke);expect(result.history.at(-1).summary).toMatch(/No new evidence-backed progress/);expect(duo.status(result)).toContain('Correct value');expect(invoke).not.toHaveBeenCalled();
  });
  test('new diagnostic wording alone cannot unlock unlimited reviews',()=>{
    const run=start();
    for(let i=0;i<2;i++){put('raw.txt',`diagnostic evidence ${i}`);expect(review(run,batch({id:`alias${i}`}),peer({outcome:'changes_required',diagnostic:`different observation ${i}`})).outcome).toBe('changes_required');}
    duo.resume(root,run.id,'codex',{takeover:true,reason:'resume'});put('raw.txt','extra evidence');
    const result=review(run,batch({id:'third'}));
    expect(result.history.at(-1).summary).toMatch(/No new evidence-backed progress/);
    expect(duo.status(result)).toContain('Correct value');
  });
  test('J-DUO-CONVERGE: actual command capture, peer finding, corrected capture and explicit closure',()=>{
    const run=start();let cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','require("assert").equal(require("./code.cjs"),42)']);
    expect(cap.lastCapture.exitCode).toBe(1);expect(review(run,batch({evidence:[cap.lastCapture.path]}),peer({outcome:'changes_required'})).outcome).toBe('changes_required');
    put('code.cjs','module.exports=42;');cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','require("assert").equal(require("./code.cjs"),42);console.log("passed")']);
    const result=review(run,batch({evidence:[cap.lastCapture.path],resolutions:[{id:'F1',change:'corrected value',evidence:[cap.lastCapture.path]}]}));
    expect(result.outcome).toBe('accepted');expect(result.progress.findings_closed).toBe(1);expect(result.progress.newly_verified).toBe(3);expect(duo.finish(root,run.id,token(run.id)).goalStatus).toBe('complete');
  });
});
test('a failed capture can prove an observed fact while the execution gate stays unverified',()=>{
  const run=start(), cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','console.log("explanation observed");process.exit(1)']);
  const result=review(run,batch({evidence:[cap.lastCapture.path]}),peer({outcome:'changes_required',change:(r)=>{
    r.assessments.find(a=>a.id==='AC-2').status='verified';
    r.inspected.push('tree/code.cjs', 'diff.patch');r.diagnostics[0].evidence.push('tree/code.cjs');
    r.diagnostics.push({observation:'Uncommitted source change',evidence:['diff.patch:1','tree/code.cjs:1']});
    r.diagnostics[0].evidence=r.diagnostics[0].evidence.map(p=>p==='tree/code.cjs'?p:`tree/${p}:9`);
  }}));
  expect(result.outcome).toBe('changes_required');expect(result.criteria['AC-2'].status).toBe('verified');expect(result.criteria['GATE-TESTS'].status).toBe('unverified');
  expect(()=>duo.finish(root,run.id,token(run.id))).toThrow(/incomplete/);
});
test('J-DUO-RECOVERY: different executed diagnosis permits another recovery without erasing history',()=>{
 const run=start();
 for(let i=0;i<2;i++){put('raw.txt',`failure ${i}`);review(run,batch({id:`fail${i}`}),peer({outcome:'changes_required'}));}
 expect(duo.eligibility(root,run.id).blockers[0]).toMatchObject({kind:'stagnation',recoverable:true});
 const cap=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','console.log("diagnosis: fixture value remains 41")'],{diagnosis:true});
 const file=cap.lastCapture.path,sha256=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 const input={kind:'stagnation',cause:'write never reaches exported value',action:'replace the exported value and re-run assertion',evidence:[{path:file,sha256}]};
 expect(()=>duo.recoverReview(root,run.id,'wrong-owner',input)).toThrow('does not own');
 put('recovery.json',JSON.stringify(input));
 const log=jest.spyOn(console,'log').mockImplementation(()=>{});
 try{expect(duo.cli(['recover-review',run.id,'--session',token(run.id),'--input','recovery.json'],root)).not.toBe(2);}finally{log.mockRestore();}
 expect(duo.eligibility(root,run.id).eligible).toBe(true);
 put('raw.txt','different attempt still failed');review(run,batch({id:'recovery'}),peer({outcome:'changes_required'}));
 const after=readRun(run.id);expect(after.reviewControl.recoveries[0].consumed).toBe(true);
 expect(duo.eligibility(root,run.id).blockers[0]).toMatchObject({kind:'stagnation',recoverable:true});
 expect(duo.status(after)).toContain('Correct value');expect(duo.status(after)).toContain('replace the exported value');
 expect(()=>duo.recoverReview(root,run.id,token(run.id),input)).toThrow(/predates|No new recovery observation/);
 const next=duo.capture(root,run.id,token(run.id),[process.execPath,'-e','console.log("diagnosis: changed batch now exposes a different missing field")'],{diagnosis:true});
 const second=next.lastCapture.path,secondHash=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,second))).digest('hex');
 duo.recoverReview(root,run.id,token(run.id),{...input,action:'repair the newly observed field using a smaller batch',evidence:[{path:second,sha256:secondHash}]});
 expect(readRun(run.id).reviewControl.recoveries).toHaveLength(2);
 expect(duo.eligibility(root,run.id).eligible).toBe(true);
 review(run,batch({id:'second-recovery'}),peer({outcome:'changes_required'}));
 expect(readRun(run.id).reviewControl.calls).toBe(4);
 expect(()=>duo.finish(root,run.id,token(run.id))).toThrow(/incomplete/);
});
test('J-DUO-LONG: more than four progressing reviews can finish with current independent evidence',()=>{
 const criteria=Array.from({length:6},(_,i)=>({id:`AC-${i+1}`,kind:'acceptance',source:'task.md',anchor:`AC-${i+1}: requirement ${i+1}`}));
 put('task.md',criteria.map(c=>c.anchor).join('\n'));
 const run=duo.start(root,'long task','codex',{...context(),criteria});
 for(let i=0;i<6;i++){
   put('raw.txt',`requirement ${i+1} observed`);
   const result=review(run,batch({id:`slice${i}`,criteria:[`AC-${i+1}`]}),peer());
   expect(result.outcome).toBe('accepted');
 }
 const result=review(run,batch({id:'all',criteria:criteria.map(c=>c.id)}),peer());
 expect(result.reviewControl.calls).toBe(7);expect(result.outcome).toBe('accepted');
 expect(duo.finish(root,run.id,token(run.id)).goalStatus).toBe('complete');
});
test('J-DUO-CHECKPOINT: configured call ceiling prevents invocation and explicit extension preserves acceptance',()=>{
 const run=duo.start(root,'limited task','codex',{...context(),reviewPolicy:{usageMode:'subscription',maxCalls:1}});
 review(run,batch({criteria:['AC-1']}),peer());
 const invoke=jest.fn();review(run,batch({id:'more',criteria:['AC-2']}),invoke);expect(invoke).not.toHaveBeenCalled();
 expect(duo.eligibility(root,run.id).blockers[0].kind).toBe('checkpoint');
 expect(duo.status(readRun(run.id))).toContain('subscription; monetary cost unmeasured');
 duo.recoverReview(root,run.id,token(run.id),{ownerAuthorized:true,reason:'Explicit owner request',policy:{maxCalls:2}},true);
 expect(readRun(run.id).reviewControl.calls).toBe(1);
 expect(readRun(run.id).criteria['AC-1'].status).toBe('verified');
 expect(duo.eligibility(root,run.id).eligible).toBe(true);
});
describe('REVIEW-PREFLIGHT (#269)',()=>{
 test('duplicate evidence blocks eligibility and review before provider invocation without charging product repair',()=>{
  const run=start(),b=batch({evidence:['raw.txt','raw.txt']}),calls=[];const eligible=duo.eligibility(root,run.id,token(run.id),b);expect(eligible.eligible).toBe(false);expect(eligible.blockers.map(x=>x.reason).join()).toMatch(/duplicate evidence/i);
  const result=review(run,b,peer({invokeLog:calls}));expect(result.outcome).toBe('blocked');expect(calls).toEqual([]);expect(result.history.at(-1).attempted).not.toBe(true);expect(result.repairCycle?.attempts||0).toBe(0);expect(result.blocker).toMatch(/duplicate evidence/i);
 });
 test('all six mandatory root artifacts are explicit unique checklist entries, including empty patches',()=>{
  const run=start();let required;const result=review(run,batch(),peer({change:(_r,request)=>{required=request.requiredReads;}}));expect(result.outcome).toBe('accepted');expect(required).toEqual(expect.arrayContaining(['request.json','goal.md','manifest.json','diff.patch','index.patch','commits.txt']));expect(new Set(required).size).toBe(required.length);expect(fs.readFileSync(path.join(root,'.specflow/duo',run.id,'round-001/index.patch'),'utf8')).toBe('');
 });
 test('omitted mandatory root receipt never becomes acceptance',()=>{
  const run=start(),result=review(run,batch(),peer({change:r=>{r.inspected=r.inspected.filter(p=>p!=='manifest.json');}}));expect(result.outcome).toBe('blocked');expect(result.blocker).toMatch(/manifest.json|inspect/i);
 });
 test('Claude peer receives bounded manifest read guidance without waiving inspection',()=>{
  const run=start('codex');
  expect(review(run,batch()).outcome).toBe('accepted');
  const prompt=fs.readFileSync(path.join(root,'.specflow/duo',run.id,'round-001/prompt.txt'),'utf8');
  expect(prompt).toContain('offset: 1 and limit: 100');
  expect(prompt).toContain('A failed read or a partial read never proves full coverage');
  expect(()=>duo.validateReview({outcome:'accepted',summary:'checked',findings:[],unrelated:[],inspected:[]},{requiredReads:['manifest.json']})).toThrow(/did not inspect/);
 });
});

test('REVIEW-PREFLIGHT diagnostic root-name collisions keep the native schema enum valid',()=>{
 put('diff.patch','Existing repository execution evidence, distinct from root review patch.');const run=start();const out=review(run,batch({evidence:['raw.txt','diff.patch']}));expect(out.outcome).toBe('accepted');const schema=JSON.parse(fs.readFileSync(path.join(root,'.specflow/duo',run.id,'round-001/schema.json')));const values=schema.properties.diagnostics.items.properties.evidence.items.enum;expect(new Set(values).size).toBe(values.length);
});

describe('REVIEW-READS (#332): peers reach scoped files past oversized root artifacts',()=>{
 const receipts=require('../../scripts/duo-review-receipts.cjs');
 const BUDGET=24000;
 const large=()=>{
  for(let i=0;i<700;i++)put(`src/generated/module-${String(i).padStart(4,'0')}-fixture-with-a-long-descriptive-name.js`,`module.exports=${i};\n`);
  execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-m','large'],{cwd:root,stdio:'pipe'});
 };
 const roundFile=(run,name)=>path.join(root,'.specflow/duo',run.id,'round-001',name);
 const planned=prompt=>[...prompt.matchAll(/^ {4}((?:cat|sed) .+)$/gm)].map(m=>m[1]);
 const linesOf=text=>text.match(/[^\n]*\n|[^\n]+$/g)||[];
 const output=(cwd,command)=>{const read=receipts.commandRead(command),text=fs.readFileSync(path.join(cwd,read.files[0]),'utf8');return read.tool==='cat'?text:linesOf(text).slice(read.start-1,read.end).join('');};
 // A Codex peer that runs only the commands it was given, then cats the remaining required reads.
 function codexPeer({combined=false}={}) {
  return (exe,args,opts)=>{
   if(args[0]==='--version') return 'fixture-version';
   if(args[0]==='auth') return '{"loggedIn":true}';
   if(args[0]==='login') return 'Logged in using ChatGPT';
   const request=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));
   const roots=['request.json','goal.md','manifest.json','diff.patch','index.patch','commits.txt'];
   let commands=combined?[`cat -- ${roots.join(' ')}`]:planned(opts.input);
   const named=new Set(commands.flatMap(c=>receipts.commandRead(c).files));
   commands=[...commands,...request.requiredReads.filter(f=>!named.has(f)&&!roots.includes(f)).map(f=>`cat -- '${f}'`)];
   const events=commands.map((command,i)=>{
    let out=combined&&i===0?roots.map(f=>fs.readFileSync(path.join(opts.cwd,f),'utf8')).join(''):output(opts.cwd,command);
    if(combined&&i===0)out=out.slice(0,['request.json','goal.md'].reduce((n,f)=>n+fs.readFileSync(path.join(opts.cwd,f),'utf8').length,0)+500); // native output cap cuts manifest.json
    return {type:'item.completed',item:{id:`cmd-${i}`,type:'command_execution',command:`/bin/bash -lc "${command}"`,aggregated_output:out,status:'completed',exit_code:0}};
   });
   const result={outcome:'accepted',summary:'accepted',inspected:[],index_complete:true,findings:[],unrelated:[],
    assessments:request.batch.criteria.map(id=>({id,status:'verified',evidence:[...request.batch.evidence],reason:'fixture evidence inspected'})),
    resolutions:[],diagnostics:[]};
   directionFixture.feedback(request,result);
   fs.writeFileSync(path.join(opts.cwd,'response.json'),JSON.stringify(result));
   return [...events,{type:'result',structured_output:result}].map(e=>JSON.stringify(e)).join('\n');
  };
 }
 test('Codex peer gets a per-file bounded reading plan first and following it earns every required receipt',()=>{
  large();
  const run=start('claude-code');
  expect(review(run,batch(),codexPeer()).outcome).toBe('accepted');
  const prompt=fs.readFileSync(roundFile(run,'prompt.txt'),'utf8');
  const requestText=fs.readFileSync(roundFile(run,'request.json'),'utf8'),manifestText=fs.readFileSync(roundFile(run,'manifest.json'),'utf8');
  expect(Buffer.byteLength(requestText)).toBeGreaterThan(BUDGET);expect(Buffer.byteLength(manifestText)).toBeGreaterThan(BUDGET);
  expect(prompt.indexOf('Reading plan')).toBe(0);
  expect(prompt.indexOf('Reading plan')).toBeLessThan(prompt.indexOf('Required-read checklist'));
  expect(prompt).toContain('never read request.json and manifest.json in the same command');
  const commands=planned(prompt);
  for(const command of commands)expect(receipts.commandRead(command).files).toHaveLength(1);
  expect(commands).not.toContain('cat -- request.json');expect(commands).not.toContain('cat -- manifest.json');
  expect(commands.filter(c=>/manifest\.json$/.test(c))).toEqual(["sed -n '1,100p' -- manifest.json"]);
  expect(commands[0]).toBe('cat -- goal.md');
  // The hash listing is written last; the plan reads the review content before it, in bounded ranges.
  const parsed=JSON.parse(requestText);
  expect(Object.keys(parsed).at(-1)).toBe('instruction_review');expect(Object.keys(parsed.instruction_review).at(-1)).toBe('artifactHashes');
  const lines=linesOf(requestText),hashLine=lines.findIndex(l=>/^ {4}"artifactHashes": \{/.test(l))+1;
  expect(hashLine).toBeGreaterThan(1);
  const ranges=commands.filter(c=>/request\.json$/.test(c)).map(c=>receipts.commandRead(c));
  expect(ranges.length).toBeGreaterThan(0);
  expect(ranges[0].start).toBe(1);expect(ranges.at(-1).end).toBe(hashLine-1);
  ranges.forEach((r,i)=>{if(i)expect(r.start).toBe(ranges[i-1].end+1);expect(Buffer.byteLength(lines.slice(r.start-1,r.end).join(''))).toBeLessThanOrEqual(BUDGET);});
  expect(prompt).toContain(`request.json lines ${hashLine}-${lines.length} hold instruction_review.artifactHashes`);
  // Verification is unchanged: bounded reads are receipted as partial and never as full coverage.
  const access=JSON.parse(fs.readFileSync(roundFile(run,'access-receipts.json'),'utf8'));
  expect(access.inspected).toEqual(expect.arrayContaining(['request.json','manifest.json','goal.md','tree/task.md','tree/raw.txt']));
  expect(access.receipts.filter(r=>r.path==='manifest.json').map(r=>r.extent)).toEqual(['partial']);
  const events=fs.readFileSync(roundFile(run,'stdout.txt'),'utf8').trim().split('\n').map(l=>JSON.parse(l));
  const coverage=receipts.collect(events,path.dirname(roundFile(run,'x')),['manifest.json','request.json'],{coverage:true}).coverage;
  expect(coverage['manifest.json'].complete).toBe(false);expect(coverage['request.json'].complete).toBe(false);
 });
 test('a truncated combined first read of request.json and manifest.json still earns no manifest receipt',()=>{
  large();
  const run=start('claude-code'),result=review(run,batch(),codexPeer({combined:true}));
  expect(result.outcome).toBe('blocked');expect(result.blocker).toMatch(/did not inspect required artifact: manifest\.json/);
 });
 test('Claude peer keeps bounded manifest guidance and also gets bounded request.json ranges',()=>{
  large();
  const run=start('codex');
  expect(review(run,batch()).outcome).toBe('accepted');
  const prompt=fs.readFileSync(roundFile(run,'prompt.txt'),'utf8');
  expect(prompt.indexOf('Reading plan')).toBe(0);
  expect(prompt).toContain('offset: 1 and limit: 100');
  expect(prompt).toContain('A failed read or a partial read never proves full coverage');
  expect(prompt).toMatch(/Read request\.json with offset: 1 and limit: \d+/);
  expect(prompt).not.toMatch(/^ {4}(?:cat|sed) /m);
 });
});

describe('REVIEW-BUDGET (#334): one read per step and a hard read budget',()=>{
 const roundFile=(run,name)=>path.join(root,'.specflow/duo',run.id,'round-001',name);
 afterEach(()=>{delete process.env.SPECFLOW_DUO_READ_BUDGET_BYTES;});
 test('the plan requires one read per step and keeps every planned range within 16,000 bytes',()=>{
  for(let i=0;i<700;i++)put(`src/generated/module-${String(i).padStart(4,'0')}-fixture-with-a-long-descriptive-name.js`,`module.exports=${i};\n`);
  put('evidence-large.md',Array.from({length:900},(_,i)=>`line ${i} ${'z'.repeat(70)}`).join('\n')+'\n');
  execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-m','large'],{cwd:root,stdio:'pipe'});
  const run=start('claude-code');
  expect(review(run,batch({evidence:['raw.txt','evidence-large.md']})).outcome).toBe('accepted');
  const prompt=fs.readFileSync(roundFile(run,'prompt.txt'),'utf8'),receipts=require('../../scripts/duo-review-receipts.cjs');
  expect(prompt).toContain('Issue exactly one read per step and wait for its output before issuing the next: never batch or parallelize reads');
  const commands=[...prompt.matchAll(/^ {4}((?:cat|sed) .+)$/gm)].map(m=>m[1]);
  expect(commands.some(c=>/evidence-large\.md$/.test(c))).toBe(true);
  for(const command of commands.filter(c=>c.startsWith('sed'))){
   const read=receipts.commandRead(command),text=fs.readFileSync(roundFile(run,read.files[0]),'utf8').match(/[^\n]*\n|[^\n]+$/g);
   expect(Buffer.byteLength(text.slice(read.start-1,read.end).join(''))).toBeLessThanOrEqual(16000);
  }
 });
 test('an over-budget read set fails fast before the peer call and consumes no allowance',()=>{
  process.env.SPECFLOW_DUO_READ_BUDGET_BYTES='2000';
  put('raw.txt','Observed 41, expected 42.\n'+'detail '.repeat(600));
  const run=start('claude-code'),calls=[];
  const result=review(run,batch(),peer({invokeLog:calls}));
  expect(result.outcome).toBe('blocked');
  expect(result.blocker).toMatch(/over the 2000-byte review read budget.*no review allowance was consumed/);
  expect(calls).toEqual([]);
  expect(result.history.at(-1).attempted).not.toBe(true);
  expect(result.peerFailures||0).toBe(0);
  const budget=JSON.parse(fs.readFileSync(roundFile(run,'read-budget.json'),'utf8'));
  expect(budget.budgetBytes).toBe(2000);expect(budget.plannedBytes).toBeGreaterThan(2000);
  expect(budget.largest.map(r=>r.file)).toContain('tree/raw.txt');
  delete process.env.SPECFLOW_DUO_READ_BUDGET_BYTES;
  expect(review(run,batch(),peer({invokeLog:calls})).outcome).toBe('accepted');
  expect(calls).toEqual(['codex']);
 });
 test('an invalid budget override is rejected',()=>{
  expect(()=>duo.readBudget({SPECFLOW_DUO_READ_BUDGET_BYTES:'lots'})).toThrow(/positive integer/);
  expect(duo.readBudget({})).toBe(480000);
 });
});

describe('ORPHAN-FINDINGS (#335): an inherited criterion-less finding never voids a valid response',()=>{
 const roundFile=(run,n,name)=>path.join(root,'.specflow/duo',run.id,`round-00${n}`,name);
 const orphan=()=>({id:'REVIEW-002',criterion:null,kind:'risk',basis:'Raw CI job log was not inspected',evidence:'tree/raw.txt',action:'Inspect the raw job log',verification:'Raw job log inspected'});
 function withOrphan(run){
  // Seed the open orphan through a real review round.
  expect(review(run,batch(),peer({outcome:'changes_required',change:r=>{r.findings=[orphan()];}})).outcome).toBe('changes_required');
  expect(readRun(run.id).findings['REVIEW-002']).toMatchObject({criterion:null,status:'open'});
 }
 test('attaching the orphan to a criterion is accepted once and recorded',()=>{
  const run=start();withOrphan(run);
  put('raw.txt','Observed 41, expected 42. More evidence.');
  const out=review(run,batch(),peer({outcome:'changes_required',change:r=>{r.findings=[{...orphan(),criterion:'GATE-TESTS',kind:'gate'}];r.assessments.forEach(a=>{a.status='unverified';});}}));
  expect(out.outcome).toBe('changes_required');
  const f=readRun(run.id).findings['REVIEW-002'];
  expect(f).toMatchObject({criterion:'GATE-TESTS',kind:'gate',status:'open',reattached:{from:null,to:'GATE-TESTS'}});
  expect(readRun(run.id).criteria['GATE-TESTS'].status).toBe('blocked');
  // Once attached, the normal repurpose rule applies.
  const progress=require('../../scripts/duo-progress.cjs'),state=structuredClone(readRun(run.id));
  const again={outcome:'changes_required',index_complete:true,diagnostics:[],
   assessments:batch().criteria.map(id=>({id,status:'unverified',evidence:[],reason:'not yet'})),
   resolutions:[{id:'REVIEW-002',status:'open',evidence:[],reason:'still open'}],
   findings:[{...orphan(),criterion:'AC-1',kind:'acceptance'}]};
  expect(()=>progress.applyReview(state,batch(),again,{},'source')).toThrow(/Cannot repurpose a finding ID/);
 });
 test('re-raising the orphan without a criterion under another kind keeps it open as a risk',()=>{
  const run=start();withOrphan(run);
  put('raw.txt','Observed 41, expected 42. More evidence.');
  const out=review(run,batch(),peer({outcome:'changes_required',change:r=>{r.findings=[{...orphan(),kind:'gate'}];r.assessments.forEach(a=>{a.status='unverified';});}}));
  expect(out.outcome).toBe('changes_required');
  expect(readRun(run.id).findings['REVIEW-002']).toMatchObject({criterion:null,kind:'risk',reportedKind:'gate',status:'open'});
 });
 test('a new criterion-less non-risk finding is still rejected',()=>{
  const run=start();
  const out=review(run,batch(),peer({outcome:'changes_required',change:r=>{r.findings=[{...orphan(),id:'NEW-1',kind:'gate'}];r.assessments.forEach(a=>{a.status='unverified';});}}));
  expect(out.outcome).toBe('blocked');expect(out.blocker).toMatch(/Only concrete material risks may lack a criterion ID/);
 });
});

describe('REMOTE-RELEVANCE (#337): CI evidence only where it can bear on a criterion',()=>{
 const roundFile=(run,name)=>path.join(root,'.specflow/duo',run.id,'round-001',name);
 const gitIn=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'}).toString();
 const commitAll=message=>{gitIn('add','.');gitIn('commit','-m',message);};
 let request;
 const capture=()=>peer({change:(_r,req)=>{request=req;}});
 test('a preparation branch that changes only specification and evidence paths marks remote CI not applicable',()=>{
  gitIn('update-ref','refs/remotes/origin/main','HEAD');
  put('PRDs/feature.md','# Amended spec\n');put('evidence/probe.cjs','console.log(1)\n');put('.specflow/runs/feature/task.md','AC\n');commitAll('spec only');
  const run=start('claude-code');
  expect(review(run,batch(),capture()).outcome).toBe('accepted');
  expect(request.remote_ci).toMatchObject({required:false,base:'origin/main',codePaths:[],codePathCount:0});
  expect(request.remote_ci.changedPaths).toBeGreaterThanOrEqual(3);
  const prompt=fs.readFileSync(roundFile(run,'prompt.txt'),'utf8');
  expect(prompt).toContain('when request.remote_ci.required is false, remote CI runs and job logs cannot verify or block any criterion of this review');
  expect(prompt).toContain('never demand or read a raw log larger than the read budget');
  expect(prompt).toContain("A closed or merged pull request's head is historical: never compare against it or block on it.");
  expect(prompt).toContain('An unmet, unavailable or not-applicable gate, a remote fact you cannot observe, or one open finding blocks only the criteria it concerns');
  expect(prompt).not.toContain('checks and raw job logs yourself');
 });
 test('a code change, implementation work, or an unknown base keeps remote CI required',()=>{
  gitIn('update-ref','refs/remotes/origin/main','HEAD');
  put('PRDs/feature.md','# Amended spec\n');put('src/app.cjs','module.exports = 1;\n');commitAll('spec and code');
  expect(duo.remoteCi(root,'preparation')).toMatchObject({required:true,codePaths:['src/app.cjs'],codePathCount:1});
  put('scratch.cjs','untracked code\n');
  expect(duo.remoteCi(root,'preparation').codePaths).toEqual(['scratch.cjs','src/app.cjs']);
  expect(duo.remoteCi(root,'implementation').required).toBe(true);
  gitIn('update-ref','-d','refs/remotes/origin/main');
  expect(duo.remoteCi(root,'preparation')).toMatchObject({required:true,reason:expect.stringMatching(/relevance is unknown/)});
 });
 test('the helper observes the pushed branch head, not a closed pull request head',()=>{
  const bare=fs.mkdtempSync(path.join(os.tmpdir(),'duo-origin-'));
  try{
   execFileSync('git',['init','--bare','-q',bare]);
   gitIn('remote','add','origin',bare);gitIn('checkout','-q','-b','spec/feature');gitIn('push','-q','origin','spec/feature');
   const pushed=gitIn('rev-parse','HEAD').trim();
   put('PRDs/later.md','unpushed\n');commitAll('local only');
   expect(duo.remoteBranch(root)).toMatchObject({branch:'spec/feature',remote_head:pushed});
   expect(gitIn('rev-parse','HEAD').trim()).not.toBe(pushed);
   gitIn('checkout','-q','--detach');
   expect(duo.remoteBranch(root)).toMatchObject({branch:null,remote_head:null});
  }finally{fs.rmSync(bare,{recursive:true,force:true});}
 });
});

describe('CI-DIGEST and ASSESSMENT-PROTOCOL (#339)',()=>{
 const roundFile=(run,name)=>path.join(root,'.specflow/duo',run.id,'round-001',name);
 const raw=['2026-11-05T10:00:00Z Run npm test','  PASS tests/a.test.js','  FAIL tests/b.test.js','##[error]Process completed with exit code 1.',...Array.from({length:3000},(_,i)=>`noise line ${i} ${'n'.repeat(60)}`),'Tests:       1 failed, 41 passed, 42 total'].join('\n')+'\n';
 const withGh=(base,calls=[])=>(exe,args,opts)=>{if(exe==='gh'&&args[0]==='run'){calls.push(args.join(' '));return raw;}return base(exe,args,opts);};
 const github=()=>execFileSync('git',['remote','add','origin','https://github.com/owner/repository.git'],{cwd:root});
 test('a digest is bounded, verbatim and verifiable against the raw log',()=>{
  const digest=duo.ciLogDigest({repository:'owner/repository',run:7,job:9,raw});
  expect(digest.rawLog).toEqual({bytes:Buffer.byteLength(raw),lines:raw.split('\n').length,sha256:require('crypto').createHash('sha256').update(raw).digest('hex')});
  expect(digest.excerpts.map(e=>e.line)).toEqual([3,4,3005]);
  expect(Buffer.byteLength(JSON.stringify(digest))).toBeLessThan(Buffer.byteLength(raw)/50);
  expect(duo.verifyCiLogDigest(digest,raw)).toEqual([]);
  expect(duo.verifyCiLogDigest({...digest,excerpts:[{line:3,text:'  PASS tests/b.test.js'}]},raw)).toEqual(['excerpt at line 3 is not verbatim']);
  expect(duo.verifyCiLogDigest(digest,raw+'x')).toEqual(expect.arrayContaining(['raw log SHA-256 differs','raw log byte count differs']));
  const created=duo.createCiDigest('owner/repository',7,9,(exe,args)=>args.includes('--log')?raw:JSON.stringify({jobs:[{databaseId:9,name:'verify',conclusion:'failure',steps:[{number:1,name:'test',conclusion:'failure'}]}]}));
  expect(created).toMatchObject({jobName:'verify',jobConclusion:'failure',steps:[{number:1,name:'test',conclusion:'failure'}]});
  expect(()=>duo.createCiDigest('owner/repository','x',9)).toThrow(/ci-digest --repo/);
 });
 test('a submitted digest is re-verified by the helper and offered to the peer as satisfying log inspection',()=>{
  github();put('ci-digest.json',JSON.stringify(duo.ciLogDigest({repository:'owner/repository',run:7,job:9,raw})));
  const run=start('claude-code'),calls=[];let request;
  expect(review(run,batch({evidence:['raw.txt','ci-digest.json']}),withGh(peer({change:(_r,req)=>{request=req;}}),calls)).outcome).toBe('accepted');
  expect(calls).toEqual(['run view 7 --repo owner/repository --job 9 --log']);
  expect(request.ci_log_digests).toEqual([expect.objectContaining({path:'ci-digest.json',run:7,job:9,excerpts:3,verified:true})]);
  const prompt=fs.readFileSync(roundFile(run,'prompt.txt'),'utf8');
  expect(prompt).toContain('A digest listed in request.ci_log_digests with verified true satisfies raw job-log inspection for its job');
  expect(prompt).toContain('never demand or read a raw log larger than the read budget');
 });
 test('a tampered or foreign digest fails fast before the peer call',()=>{
  github();const digest=duo.ciLogDigest({repository:'owner/repository',run:7,job:9,raw});
  put('ci-digest.json',JSON.stringify({...digest,excerpts:[{line:4,text:'##[error]nothing failed'}]}));
  const run=start('claude-code'),invoked=[];
  const out=review(run,batch({evidence:['raw.txt','ci-digest.json']}),withGh(peer({invokeLog:invoked})));
  expect(out.outcome).toBe('blocked');expect(out.blocker).toMatch(/does not match the re-fetched raw log.*no review allowance was consumed/);
  expect(invoked).toEqual([]);expect(out.history.at(-1).attempted).not.toBe(true);
  put('ci-digest.json',JSON.stringify({...digest,repository:'someone/else'}));
  const foreign=review(run,batch({evidence:['raw.txt','ci-digest.json']}),withGh(peer({invokeLog:invoked})));
  expect(foreign.blocker).toMatch(/is for someone\/else, not owner\/repository/);expect(invoked).toEqual([]);
 });
 test('generic "review incomplete" rows are a protocol failure, not a verdict',()=>{
  const run=start('claude-code');
  const out=review(run,batch(),peer({outcome:'changes_required',change:r=>{r.assessments.forEach(a=>{a.status='unverified';a.reason='Independent review incomplete.';});}}));
  expect(out.outcome).toBe('blocked');
  expect(out.blocker).toMatch(/Peer did not assess 3 criterion row\(s\) \(AC-1, AC-2, GATE-TESTS\): "Independent review incomplete\." is not a verdict/);
  expect(out.history.at(-1).attempted).toBe(true);
  expect(Object.values(readRun(run.id).criteria).every(c=>c.status!=='verified')).toBe(true);
  expect(()=>duo.validateAssessmentReasons({assessments:[{id:'A',status:'unverified',reason:'Full independent comparison was not completed.'}]})).toThrow(/is not a verdict/);
  expect(()=>duo.validateAssessmentReasons({assessments:[
   {id:'A',status:'unverified',reason:'Rotation oracle remains open.'},
   {id:'B',status:'blocked',reason:'The lock-order comparison remains incomplete because hop 7.3 omits the class order for worker rows and the rotation path.'},
   {id:'C',status:'verified',reason:'Independent review incomplete.'}]})).not.toThrow();
  const prompt=fs.readFileSync(roundFile(run,'prompt.txt'),'utf8');
  expect(prompt).toContain("is a protocol failure, not a verdict: the helper rejects the whole response");
 });
});

describe('CITATION-REPAIR (#341): a citation technicality downgrades one row, never the whole response',()=>{
 // Mutate the peer's final response after the fixture's direction/instruction feedback.
 const after=(base,mutate)=>(exe,args,opts)=>{const out=base(exe,args,opts);const file=opts?.cwd&&path.join(opts.cwd,'response.json');if(exe==='codex'&&args[0]==='exec'&&file&&fs.existsSync(file)){const r=JSON.parse(fs.readFileSync(file,'utf8'));mutate(r);fs.writeFileSync(file,JSON.stringify(r));}return out;};
 test('a verified row without an evidence citation is downgraded; the rest of the response stands and a repair review may reuse the evidence',()=>{
  const run=start('claude-code');
  const out=review(run,batch(),after(peer(),r=>{r.assessments.find(a=>a.id==='AC-1').evidence=[];}));
  expect(out.outcome).toBe('blocked');
  const round=out.history.at(-1);
  expect(round.stage).toBe('validated');
  expect(round.citationRepairs).toEqual([expect.objectContaining({kind:'assessment',id:'AC-1',repair:'downgraded',from:'verified',to:'unverified'})]);
  const state=readRun(run.id);
  expect(state.criteria['AC-1'].status).toBe('unverified');
  expect(state.criteria['AC-1'].reason).toMatch(/^\[helper citation repair: verified without a batch\.evidence citation\]/);
  expect(state.criteria['AC-2'].status).toBe('verified');expect(state.criteria['GATE-TESTS'].status).toBe('verified');
  expect(state.next).toMatch(/^Citation repair: the helper downgraded assessment AC-1/);
  expect(round.review.direction.assessment).not.toBe('complete');
  // Same evidence, no source change: the repair review is permitted and can now accept.
  const repaired=review(run,batch(),peer());
  expect(repaired.outcome).toBe('accepted');
  expect(readRun(run.id).criteria['AC-1'].status).toBe('verified');
 });
 test('another spelling of a read batch.evidence path is normalized, not voided',()=>{
  const run=start('claude-code');
  const out=review(run,batch(),after(peer(),r=>{r.assessments.find(a=>a.id==='AC-1').evidence=['tree/raw.txt'];r.assessments.find(a=>a.id==='AC-2').evidence=['raw.txt:1'];}));
  expect(out.outcome).toBe('accepted');
  expect(out.history.at(-1).citationRepairs.map(r=>[r.id,r.repair])).toEqual([['AC-1','normalized'],['AC-2','normalized']]);
  expect(readRun(run.id).criteria['AC-1'].evidence.map(e=>e.path)).toEqual(['raw.txt']);
 });
 test('a citation of an unsubmitted or unread file never verifies',()=>{
  const run=start('claude-code');
  const out=review(run,batch(),after(peer(),r=>{r.assessments.find(a=>a.id==='AC-1').evidence=['invented.txt'];}));
  expect(out.outcome).toBe('blocked');expect(readRun(run.id).criteria['AC-1'].status).toBe('unverified');
  expect(out.history.at(-1).citationRepairs[0]).toMatchObject({id:'AC-1',repair:'downgraded',issue:'cites invented.txt, not a read batch.evidence path'});
 });
 test('instruction rows: a missing tree/ prefix is normalized; an unread artifact downgrades only that row to unproven',()=>{
  const request={batch:{evidence:['raw.txt']},instruction_review:{artifactHashes:{'tree/raw.txt':'h','tree/PRDs/spec.md':'h','tree/unread.md':'h'}}};
  const result={inspected:['tree/raw.txt','tree/PRDs/spec.md'],instruction_assessments:[
   {instructionId:'I-1',outcome:'satisfied',reason:'done',inspected:['PRDs/spec.md'],evidence:['raw.txt']},
   {instructionId:'I-2',outcome:'replaced_with_justification',replacementId:'I-9',reason:'replaced',inspected:['tree/unread.md'],evidence:['raw.txt']}]};
  const repairs=duo.instructionCitationRepair(result,request);
  expect(result.instruction_assessments[0]).toMatchObject({outcome:'satisfied',inspected:['tree/PRDs/spec.md']});
  expect(result.instruction_assessments[1]).toMatchObject({outcome:'unproven',inspected:[]});
  expect(result.instruction_assessments[1].replacementId).toBeUndefined();
  expect(repairs.map(r=>[r.id,r.repair])).toEqual([['I-1','normalized'],['I-2','downgraded']]);
 });
 test('an otherwise accepting response with one bad instruction citation is kept, not voided',()=>{
  const run=start('claude-code');
  expect(review(run,batch(),peer({outcome:'changes_required'})).outcome).toBe('changes_required');
  expect(Object.keys(readRun(run.id).instructions||{}).length).toBeGreaterThan(0);
  put('code.cjs','module.exports = 42;');put('raw.txt','Observed correct value and explanation; tests passed.');
  const out=review(run,batch({resolutions:[{id:'F1',change:'fixed value',evidence:['raw.txt']}]}),after(peer(),r=>{for(const row of r.instruction_assessments)row.inspected=['raw.txt'];}));
  expect(out.outcome).toBe('accepted');
  expect(out.history.at(-1).citationRepairs.every(r=>r.kind==='instruction'&&r.repair==='normalized')).toBe(true);
  const unread=start('claude-code');
  expect(review(unread,batch(),peer({outcome:'changes_required'})).outcome).toBe('changes_required');
  put('raw.txt','Observed correct value and explanation; tests passed again.');
  const kept=review(unread,batch({resolutions:[{id:'F1',change:'fixed value',evidence:['raw.txt']}]}),after(peer(),r=>{for(const row of r.instruction_assessments)row.inspected=['tree/never-read.md'];}));
  expect(kept.history.at(-1).stage).toBe('validated');expect(kept.outcome).toBe('blocked');
  expect(kept.history.at(-1).citationRepairs.some(r=>r.kind==='instruction'&&r.repair==='downgraded')).toBe(true);
  expect(Object.values(readRun(unread.id).instructions).some(i=>i.state==='outstanding')).toBe(true);
  expect(readRun(unread.id).criteria['AC-1'].status).toBe('verified');
 });
});
