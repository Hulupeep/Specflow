const fs = require('fs');
const path = require('path');
const os = require('os');
const {execFileSync, spawn} = require('child_process');
const duo = require('../../scripts/duo-build.cjs');
let root;
const put = (name, text) => { const f=path.join(root,name); fs.mkdirSync(path.dirname(f),{recursive:true}); fs.writeFileSync(f,text); };
const context = () => ({goal:'goal.md', task:'task.md', objective:'Explain a correct balance', finish:'All criteria and required tests verified', criteria:[
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
    if(exe==='codex') fs.writeFileSync(path.join(opts.cwd,'response.json'),JSON.stringify(result));
    return JSON.stringify({type:'result',structured_output:result});
  };
}
const review = (run,b,provider) => duo.review(root,run.id,b || batch(),provider || peer(),token(run.id));
beforeEach(()=>{
  root=fs.mkdtempSync(path.join(os.tmpdir(),'duo-ops-'));
  for(const args of [['init'],['config','user.email','test@example.test'],['config','user.name','Test']])execFileSync('git',args,{cwd:root,stdio:'pipe'});
  put('goal.md','Accurate explainable balances. Unknown jurisdiction remains unknown.');
  put('task.md','AC-1: correct value\nAC-2: explanation\n');put('CLAUDE.md','Tests must pass before finishing.');put('code.cjs','module.exports = 41;');put('raw.txt','Observed 41, expected 42.');
  execFileSync('git',['add','.'],{cwd:root});execFileSync('git',['commit','-m','fixture'],{cwd:root,stdio:'pipe'});
});
afterEach(()=>{delete process.env.SPECFLOW_DUO_REVIEWER;fs.rmSync(root,{recursive:true,force:true});});
describe('portable: REQ-P1..P4',()=>{
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
    for(let i=0;i<2;i++){
      put('code.cjs',`// cosmetic ${i}\nmodule.exports=41;`);put('raw.txt',`same failure; timestamp ${i}`);
      const result=review(run,batch({id:`alias${i}`}),peer({outcome:'changes_required',diagnostic:'same observation'}));expect(result.outcome).toBe('changes_required');
    }
    duo.resume(root,run.id,'codex',{takeover:true,reason:'new host'});put('raw.txt','another timestamp');
    const invoke=jest.fn();const result=review(run,batch({id:'new-alias'}),invoke);expect(result.blocker).toMatch(/No new evidence-backed progress/);expect(invoke).not.toHaveBeenCalled();
  });
  test('renamed-batch-budget: at most initial plus three repairs despite new diagnostics',()=>{
    const run=start();
    for(let i=0;i<4;i++){put('raw.txt',`new diagnostic evidence ${i}`);expect(review(run,batch({id:`alias${i}`}),peer({outcome:'changes_required',diagnostic:`different observation ${i}`})).outcome).toBe('changes_required');}
    duo.resume(root,run.id,'codex',{takeover:true,reason:'resume'});put('raw.txt','extra evidence');expect(review(run,batch({id:'fifth'})).blocker).toMatch(/three repair rounds/);
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
