// Synthetic provider boundary for deterministic state/CLI tests, not live proof.
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const duo=require('../../scripts/duo-build.cjs');
function fixture(builder='claude-code',extraCriteria=0) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'duo-actions-'));
 const put=(name,value)=>{const f=path.join(root,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,typeof value==='string'?value:JSON.stringify(value));};
 const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
 git('init');git('config','user.email','fixture@example.test');git('config','user.name','Fixture');
 put('goal.md','Display the correct customer total; preserve real consent gates.');put('task.md','AC-TOTAL: display 42\nOWNER-GATE: actual owner consent');put('display.cjs','console.log(41)');put('unrelated.cjs','console.log("7 unrelated tests passed")');
 const extra=Array.from({length:extraCriteria},(_,i)=>({id:`AC-EXTRA-${i+1}`,source:'task.md',anchor:`AC-EXTRA-${i+1}: fixture subtask ${i+1} verified`,kind:'acceptance'}));
 if(extra.length)fs.appendFileSync(path.join(root,'task.md'),'\n'+extra.map(c=>c.anchor).join('\n'));git('add','.');git('commit','-m','fixture');
 const context={workKind:'preparation',goal:'goal.md',task:'task.md',objective:'Customer total is accurate',finish:'Total and owner consent verified',criteria:[{id:'AC-TOTAL',source:'task.md',anchor:'AC-TOTAL: display 42',kind:'acceptance'},{id:'OWNER-GATE',source:'task.md',anchor:'OWNER-GATE: actual owner consent',kind:'gate'},...extra],typesafe:{mode:'off'}};
 let run=duo.start(root,'#149',builder,context,builder==='claude-code'?'fixture-session':undefined);
 const state=()=>duo.load(root,run.id).state;
 const capture=(file='display.cjs')=>{run=duo.capture(root,run.id,run.owner.session,[process.execPath,file]);return run.lastCapture.path;};
 const batch=(evidence,extra={})=>({id:'total',scope:'Customer total diagnosis',criteria:['AC-TOTAL'],claims:['Done'],assumptions:[],resolutions:[],evidence:[evidence],...extra});
 function peer(edit=()=>{}) { return (exe,args,opts)=>{
  if(args[0]==='--version')return 'SIMULATED provider adapter';if(args[0]==='auth')return '{"loggedIn":true}';if(args[0]==='login')return 'Logged in using fixture';
  const req=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));
  const raw=JSON.parse(fs.readFileSync(path.join(opts.cwd,'tree',req.batch.evidence[0])));
  const corrected=raw.stdout?.trim()==='42',inspected=[...new Set([...req.requiredReads,'tree/display.cjs'])];
  const result={outcome:corrected?'accepted':'changes_required',summary:corrected?'Total proven; owner gate still open':'Total wrong or not executed',inspected,index_complete:true,unrelated:[],
   findings:corrected?[]:[{id:'TOTAL',criterion:'AC-TOTAL',kind:'acceptance',basis:'AC-TOTAL requires visible42',evidence:req.batch.evidence[0],action:'Correct and execute display.cjs',verification:'Raw display output equals42'}],
   assessments:req.batch.criteria.map(id=>({id,status:id==='AC-TOTAL'&&corrected?'verified':'blocked',evidence:req.batch.evidence,reason:'Synthetic review of captured fixture output'})),
   resolutions:req.open_findings.map(f=>({id:f.id,status:corrected?'closed':'open',evidence:req.batch.evidence,reason:'Fixture output checked'})),diagnostics:['41','42'].includes(raw.stdout?.trim())?[{observation:'Customer total observed as '+raw.stdout.trim(),evidence:req.batch.evidence}]:[],
   instruction_assessments:req.instruction_review.instructions.map(s=>({instructionId:s.id,outcome:s.criterion==='AC-TOTAL'&&corrected?'satisfied':'unproven',reason:'Observed scope is the captured command; other activity unknown',snapshotHash:req.snapshot,inspected:req.batch.evidence.map(f=>'tree/'+f),evidence:req.batch.evidence,dependencyOwner:null,missingDependency:null,replacementId:null})),
   direction:{assessment:corrected?'blocked':'redirect',goal_connection:'Correct customer-visible total; do not infer consent',next_steps:corrected?[{criterion:'OWNER-GATE',owner:'user',action:'Supply owner consent evidence',done_when:'Real owner consent is recorded'}]:[{criterion:'AC-TOTAL',owner:'builder',action:'Correct and execute display.cjs',done_when:'Raw display output equals42'}],preserve:['Do not invent owner consent']}};
  edit(result,req,opts);if(exe==='codex')fs.writeFileSync(path.join(opts.cwd,'response.json'),JSON.stringify(result));return require('./duo-direction.js').transport(result,exe,opts.cwd);
 };}
 return {root,context,put,git,state,capture,batch,peer,get run(){return run;},review:(b,p=peer())=>duo.review(root,run.id,b,p,run.owner.session),transfer:()=>{run=duo.resume(root,run.id,run.builder==='codex'?'claude-code':'codex',{takeover:true,reason:'Fixture host transfer'});return run;},close:()=>fs.rmSync(root,{recursive:true,force:true})};
}
module.exports={fixture};
