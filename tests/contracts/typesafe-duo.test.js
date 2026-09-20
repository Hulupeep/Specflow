const directionFixture = require('../helpers/duo-direction.js');
const fs=require('fs'),os=require('os'),path=require('path'),{execFileSync}=require('child_process');
const duo=require('../../scripts/duo-build.cjs'),advisory=require('../../scripts/typesafe-duo.cjs'),client=require('../../scripts/typesafe-client.cjs');
let root,spy;
const put=(name,value)=>{const p=path.join(root,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,value);};
const git=(...args)=>execFileSync('git',args,{cwd:root,stdio:'pipe'});
const context={goal:'goal.md',task:'task.md',objective:'Correct balance',finish:'AC-1 demonstrated',criteria:[{id:'AC-1',source:'task.md',anchor:'AC-1: balance equals 18',kind:'acceptance'}]};
const batch=()=>({id:'balance',scope:'Correct balance',criteria:['AC-1'],claims:['Balance equals 18'],assumptions:[],resolutions:[],evidence:['raw.txt'],typesafe:[{criterion:'AC-1',claimIndex:0,assertionPath:'test.cjs',evidencePaths:['raw.txt']}]});
function peer(outcome='accepted',omit=false){return(exe,args,opts)=>{
 if(args[0]==='--version')return'test-double';if(args[0]==='auth')return'{"loggedIn":true}';if(args[0]==='login')return'Logged in using ChatGPT';
 const req=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));
 expect(opts.env.TYPESAFE_API).toBeUndefined();
 const r={outcome,summary:'Synthetic peer transport',inspected:[...req.requiredReads,'tree/test.cjs'],index_complete:true,findings:outcome==='accepted'?[]:[{id:'F1',criterion:'AC-1',kind:'acceptance',basis:'AC-1',evidence:'tree/raw.txt',action:'Fix balance',verification:'Assert 18'}],unrelated:[],assessments:[{id:'AC-1',status:outcome==='accepted'?'verified':'blocked',evidence:['raw.txt'],reason:'Fixture'}],resolutions:req.open_findings.map(f=>({id:f.id,status:outcome==='accepted'?'closed':'open',evidence:['raw.txt'],reason:'Fresh evidence'})),diagnostics:[{observation:fs.readFileSync(path.join(opts.cwd,'tree/raw.txt'),'utf8'),evidence:['raw.txt']}]};
 if(req.typesafe&&!omit)r.typesafe_dispositions=req.typesafe.flags.map(id=>({id,status:'rejected',evidence:['raw.txt','tree/test.cjs'],reason:'Independently inspected fixture; simulated false flag'}));
 directionFixture.feedback(req, r);
 if(exe==='codex')fs.writeFileSync(path.join(opts.cwd,'response.json'),JSON.stringify(r));return JSON.stringify({structured_output:r});
};}
function worker(status='completed') {return jest.fn((exe,args)=>{
 const input=JSON.parse(fs.readFileSync(args[1]));
 const response={model:input.model,usage:{input_tokens:12,output_tokens:3},answers:Object.fromEntries(Object.entries(input.questions).map(([id,q])=>{const keys=Object.keys(q.criteria);const selected=keys.includes('insufficient')?'insufficient':keys[0];return[id,{type:'choice',choice:selected,confidence:1,probabilities:Object.fromEntries(keys.map(k=>[k,k===selected?1:0]))}];}))};
 client.atomic(args[2],{status,reason:status==='unavailable'?'provider_error':undefined,snapshotHash:input.snapshotHash,response:status==='completed'?response:undefined});return{status:0};
});}
function installWorker(w){const original=advisory.run;spy=jest.spyOn(advisory,'run').mockImplementation(args=>original({...args,execute:w}));}
function run(builder='codex',mode='advisory'){return duo.start(root,'#1',builder,{...context,typesafe:{mode}});}
const review=(r,b=batch(),p=peer())=>duo.review(root,r.id,directionFixture.respond(duo.load(root,r.id).state, b),p,r.owner.session);
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'ts-duo-'));git('init');git('config','user.name','Fixture');git('config','user.email','fixture@example.test');put('goal.md','Explain correct balance');put('task.md','AC-1: balance equals 18');put('balance.cjs','module.exports=20');put('test.cjs','assert(balance === 18)');put('raw.txt','Observed 20 expected 18; failed');git('add','.');git('commit','-m','fixture');process.env.TYPESAFE_API='test-only-credential';});
afterEach(()=>{spy?.mockRestore();spy=null;delete process.env.TYPESAFE_API;delete process.env.SPECFLOW_DUO_REVIEWER;fs.rmSync(root,{recursive:true,force:true});});
test.each(['codex','claude-code'])('J-TSAFE-EPIC/J-TSAFE-DUO: %s correction preserves snapshot, findings and dispositions',builder=>{
 const w=worker();installWorker(w);const r=run(builder);const before=duo.fingerprint(root,['raw.txt']);
 expect(review(r,batch(),peer('changes_required')).outcome).toBe('changes_required');expect(duo.fingerprint(root,['raw.txt'])).toBe(before);
 put('balance.cjs','module.exports=18');put('raw.txt','Observed 18 expected 18; executed 1 passed 1 skipped 0');
 const b={...batch(),resolutions:[{id:'F1',change:'Correct balance',evidence:['raw.txt']}]};b.typesafe[0].repair={description:'Correct balance rule',observation:'Observed 18'};
 const second=review(r,b);expect(second.outcome).toBe('accepted');expect(second.typesafe.calls).toBe(2);expect(Object.keys(JSON.parse(fs.readFileSync(w.mock.calls[1][1][1])).questions)).toHaveLength(5);expect(duo.finish(root,r.id,r.owner.session).goalStatus).toBe('complete');
});
test('off makes zero calls; shadow excludes advice from request/tree',()=>{
 const w=worker();installWorker(w);const off=run('codex','off');expect(review(off).outcome).toBe('accepted');expect(w).not.toHaveBeenCalled();
 const shadow=run('codex','shadow');expect(review(shadow).outcome).toBe('accepted');
 const round=path.join(root,'.specflow/duo',shadow.id,'round-001');expect(JSON.parse(fs.readFileSync(path.join(round,'request.json'))).typesafe).toBeUndefined();expect(fs.existsSync(path.join(round,'typesafe-advice.json'))).toBe(false);expect(fs.existsSync(path.join(round,'tree/.specflow'))).toBe(false);
});
test('provider failures suppress calls; owner recovery and host takeover preserve used budget',()=>{
 const w=worker('unavailable');installWorker(w);const r=run();
 review(r,batch(),peer('changes_required'));put('raw.txt','New diagnostic failure A');review(r,batch(),peer('changes_required'));put('raw.txt','New diagnostic failure B');
 const result=review(r,batch(),peer('changes_required'));expect(result.history.at(-1).typesafe.reason).toBe('circuit_open');expect(w).toHaveBeenCalledTimes(2);
 expect(()=>duo.configureTypesafe(root,r.id,'stale',{recover:true},'recover')).toThrow(/own/);
 duo.release(root,r.id,r.owner.session);const transferred=duo.resume(root,r.id,'claude-code');
 const recovered=duo.configureTypesafe(root,r.id,transferred.owner.session,{recover:true,maxCalls:2},'provider restored');expect(recovered.typesafe.calls).toBe(2);expect(recovered.typesafe.consecutiveFailures).toBe(0);
 put('raw.txt','New diagnostic failure C');expect(review(transferred).history.at(-1).typesafe.reason).toBe('budget_exhausted');expect(w).toHaveBeenCalledTimes(2);
});
test('missing key and selection are explicit without blocking ordinary peer',()=>{
 delete process.env.TYPESAFE_API;const r=run();const out=review(r);expect(out.outcome).toBe('accepted');expect(out.history.at(-1).typesafe.reason).toBe('missing_credentials');
 const other=run();expect(review(other,{...batch(),typesafe:[]}).history.at(-1).typesafe.reason).toBe('missing_selection');
});
test('missing dispositions and stale source cannot be accepted',()=>{
 installWorker(worker());const r=run();expect(review(r,batch(),peer('accepted',true)).blocker).toMatch(/dispositions/);
 const second=run();const p=peer();expect(review(second,batch(),(exe,args,opts)=>{const result=p(exe,args,opts);if(opts)put('balance.cjs','mutated');return result;}).blocker).toMatch(/Source changed/);
});
test('sensitive files are absent from peer snapshots and cannot be selected',()=>{
 put('.env','TYPESAFE_API=do-not-share-this');put('credentials.json','{\"password\":\"do-not-share-this\"}');git('add','.env','credentials.json');const r=run();review(r);
 expect(fs.existsSync(path.join(root,'.specflow/duo',r.id,'round-001/tree/.env'))).toBe(false);
 expect(JSON.parse(fs.readFileSync(path.join(root,'.specflow/duo',r.id,'round-001/request.json'))).omittedPaths).toEqual(['.env','credentials.json']);
 for(const name of ['diff.patch','index.patch'])expect(fs.readFileSync(path.join(root,'.specflow/duo',r.id,'round-001',name),'utf8')).not.toContain('do-not-share-this');
 const next=run();const b=batch();b.typesafe[0].assertionPath='.env';expect(review(next,b).history.at(-1).typesafe.reason).toBe('invalid_selection');
});
test.each(['codex','claude-code'])('installed %s workflow exposes TypeSafe config through CLI and rejects stale owner',runtime=>{
 execFileSync('bash',[path.resolve(__dirname,'../../install-hooks.sh'),root,'--runtime',runtime],{stdio:'pipe'});
 for(const name of ['typesafe-client.cjs','typesafe-duo.cjs','typesafe-questions.cjs','typesafe-eval.cjs'])expect(fs.existsSync(path.join(root,'scripts',name))).toBe(true);
 put('context.json',JSON.stringify(context));
 const cli=path.join(root,'scripts/duo-build.cjs');const started=execFileSync(process.execPath,[cli,'start','#1','--builder',runtime,'--context','context.json'],{cwd:root,encoding:'utf8'});
 const id=started.match(/Run: (\S+)/)[1],session=started.match(/Owner session: (\S+)/)[1];put('config.json',JSON.stringify({mode:'off'}));
 expect(execFileSync(process.execPath,[cli,'typesafe',id,'--session',session,'--config','config.json','--reason','Explicitly disabled'],{cwd:root,encoding:'utf8'})).toContain('TypeSafe: off');
 expect(()=>execFileSync(process.execPath,[cli,'typesafe',id,'--session','stale','--config','config.json','--reason','wrong owner'],{cwd:root,stdio:'pipe'})).toThrow();
});
test('native response schema constrains evidence arrays to executable ledger paths',()=>{
 installWorker(worker());const r=run();review(r);
 const schema=JSON.parse(fs.readFileSync(path.join(root,'.specflow/duo',r.id,'round-001/schema.json')));
 for(const key of ['assessments','resolutions','typesafe_dispositions'])expect(schema.properties[key].items.properties.evidence.items.enum).toEqual(['raw.txt']);
 expect(schema.properties.diagnostics.items.properties.evidence.items.enum).toContain('diff.patch');
 expect(schema.properties.diagnostics.items.properties.evidence.items.enum).not.toContain('tree/test.cjs:3');
});
// Deterministic transport tests; the live advisory pilot is recorded separately (#143).
test('partial TypeSafe selection discloses omitted criteria without narrowing peer acceptance',()=>{
 const w=worker();installWorker(w);
 put('task.md','AC-1: balance equals 18\nAC-2: explanation names transactions');
 const second={id:'AC-2',source:'task.md',anchor:'AC-2: explanation names transactions',kind:'acceptance'};
 const r=duo.start(root,'#143','codex',{...context,criteria:[...context.criteria,second],typesafe:{mode:'advisory'}});
 const b={...batch(),criteria:['AC-1','AC-2']};let peerCalls=0;const ordinary=peer();
 const result=review(r,b,(exe,args,opts)=>{
  const raw=ordinary(exe,args,opts);if(!opts?.cwd)return raw;
  peerCalls++;const request=JSON.parse(fs.readFileSync(path.join(opts.cwd,'request.json')));
  expect(request.batch.criteria).toEqual(['AC-1','AC-2']);
  expect(Object.keys(request.acceptance).sort()).toEqual(['AC-1','AC-2']);
  const response=JSON.parse(raw);response.structured_output.assessments.push({id:'AC-2',status:'verified',evidence:['raw.txt'],reason:'Synthetic peer assessment of the unselected criterion'});
  directionFixture.feedback(request,response.structured_output);
  return JSON.stringify(response);
 });
 expect(result.outcome).toBe('accepted');expect(peerCalls).toBe(1);expect(w).toHaveBeenCalledTimes(1);
 const input=JSON.parse(fs.readFileSync(w.mock.calls[0][1][1]));
 expect(input.state.omittedCriteria).toEqual(['AC-2']);expect(input.state.items.map(i=>i.criterionId)).toEqual(['AC-1']);
 const advice=JSON.parse(fs.readFileSync(path.join(root,'.specflow/duo',r.id,'typesafe/round-001/advice.json')));
 expect(advice.omittedCriteria).toEqual(['AC-2']);expect(advice.selected.map(s=>s.criterion)).toEqual(['AC-1']);
 expect(result.criteria['AC-2'].status).toBe('verified');
 expect(duo.finish(root,r.id,r.owner.session).goalStatus).toBe('complete');
});
test.each([
 ['ASCII at limit','a',32768,32768,1],
 ['ASCII above limit','a',32769,32769,0],
 ['multibyte at limit','é',16384,32768,1],
 ['multibyte above limit','é',16385,32770,0],
])('per-file byte boundary: %s retains ordinary peer review',(label,character,count,bytes,calls)=>{
 const content=character.repeat(count);expect(Buffer.byteLength(content)).toBe(bytes);put('test.cjs',content);
 const w=worker();installWorker(w);const r=run();let peerCalls=0;const ordinary=peer();
 const result=review(r,batch(),(exe,args,opts)=>{if(opts?.cwd)peerCalls++;return ordinary(exe,args,opts);});
 expect(result.outcome).toBe('accepted');expect(peerCalls).toBe(1);expect(w).toHaveBeenCalledTimes(calls);
 const check=JSON.parse(fs.readFileSync(path.join(root,'.specflow/duo',r.id,'typesafe/round-001/check.json')));
 if(calls){expect(check.status).toBe('completed');const input=JSON.parse(fs.readFileSync(w.mock.calls[0][1][1]));expect(input.state.items[0].assertion.text).toBe(content);}
 else{expect(check.status).toBe('unavailable');expect(check.reason).toBe('input_limit');expect(check.response).toBeUndefined();expect(result.typesafe.calls).toBe(0);}
});
