const fs=require('fs'),os=require('os'),path=require('path');
const {execFileSync}=require('child_process');
const ev=require('../../scripts/typesafe-eval.cjs');
const corpus=require('../fixtures/typesafe/corpus.json');
let dir;
beforeEach(()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'ts-eval-'));});
afterEach(()=>fs.rmSync(dir,{recursive:true,force:true}));
test('J-TSAFE-EVAL: frozen corpus has 30/20 evidence and 10/10 repair family-separated cases',()=>{
 expect(()=>ev.validateCorpus(corpus)).not.toThrow();
 for(const [kind,split,count] of [['evidence','development',30],['evidence','heldout',20],['repair','development',10],['repair','heldout',10]])expect(corpus.cases.filter(c=>c.kind===kind&&c.split===split)).toHaveLength(count);
 const bad=JSON.parse(JSON.stringify(corpus));bad.cases[1].split='heldout';expect(()=>ev.validateCorpus(bad)).toThrow(/leakage/);
});
test('private output refuses Git worktrees and symlinks',()=>{
 execFileSync('git',['init',dir],{stdio:'pipe'});expect(()=>ev.privateDirectory(path.join(dir,'report'))).toThrow(/outside/);
 const link=path.join(os.tmpdir(),'ts-link-'+Date.now());fs.symlinkSync(dir,link);try{expect(()=>ev.privateDirectory(link)).toThrow(/Symlink/);}finally{fs.unlinkSync(link);}
});
test('live transport simulation and zero-call replay retain denominators and model qualification',async()=>{
 const tiny={...corpus,cases:corpus.cases.slice(0,2)};
 const fetchImpl=jest.fn(async(_,o)=>{const q=JSON.parse(o.body).questions;return Response.json({model:'jev-1.13.0',usage:{input_tokens:10,output_tokens:2},answers:Object.fromEntries(Object.entries(q).map(([id,v])=>[id,{type:'choice',choice:Object.keys(v.criteria)[0],probabilities:Object.fromEntries(Object.keys(v.criteria).map((k,i)=>[k,i?0:1])),confidence:1}]))});});
 const options={model:'jev-1.13.0',mode:'live',output:dir,env:{TYPESAFE_API:'test-credential'},fetchImpl};
 const live=await ev.evaluateCorpus(tiny,options);expect(fetchImpl).toHaveBeenCalledTimes(4);expect(live.report.summary.cases).toBe(2);expect(live.report.byControl.control.cases).toBe(1);expect(live.report.byControl.edge.cases).toBe(1);expect(live.report.summary.questions).toBe(4);expect(live.report.summary.baseline.reviewerMissing).toBe(2);expect(live.report.summary.judgments.support.brier).not.toBeNull();
 expect(live.report.transport).toBe('simulated');expect(JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))).transport).toBe('simulated');
 const replay=await ev.evaluateCorpus(tiny,{...options,fetchImpl:undefined,mode:'replay'});expect(fetchImpl).toHaveBeenCalledTimes(4);expect(replay.report.summary.actualCalls).toBe(0);expect(replay.report.repeatCalls).toBe(0);expect(replay.report.transport).toBe('simulated');
 await expect(ev.evaluateCorpus(tiny,{...options,fetchImpl:undefined})).rejects.toThrow(/transport/);
 await expect(ev.evaluateCorpus(tiny,{...options,model:'jev-1.14.0'})).rejects.toThrow(/identity/);
 expect(JSON.parse(fs.readFileSync(ev.qualify(live.file,'shadow','Small synthetic sample only'))).identity).toEqual(live.report.identity);
});
test('unavailable judgments count as missing rather than silently inflating accuracy',async()=>{
 const r=await ev.evaluateCorpus({...corpus,cases:corpus.cases.slice(0,2)},{mode:'live',model:'jev-1.13.0',output:dir,env:{}});
 expect(r.report.summary.unavailable).toBe(2);expect(r.report.summary.judgments.support.total).toBe(2);expect(r.report.summary.judgments.support.available).toBe(0);expect(r.report.summary.judgments.support.accuracy).toBe(0);
 expect(r.report.transport).toBe('live');expect(JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'))).transport).toBe('live');expect(r.report.cost.networkCallsIncludingRepeats).toBe(0);
});
test('legacy replay keeps unknown transport and cannot be relabelled as a live provider run',async()=>{
 const tiny={...corpus,cases:corpus.cases.slice(0,2)},options={mode:'live',model:'jev-1.13.0',output:dir,env:{}};
 await ev.evaluateCorpus(tiny,options);
 const file=path.join(dir,'manifest.json'),manifest=JSON.parse(fs.readFileSync(file));delete manifest.transport;fs.writeFileSync(file,JSON.stringify(manifest));
 const replay=await ev.evaluateCorpus(tiny,{...options,mode:'replay'});expect(replay.report.transport).toBe('unknown');expect(replay.report.cost.networkCallsIncludingRepeats).toBe(0);expect(JSON.parse(fs.readFileSync(file)).transport).toBeUndefined();
 await expect(ev.evaluateCorpus(tiny,options)).rejects.toThrow(/unknown.*transport/);
});
test('independently adjudicated corpus represents every evidence/coverage label and marks controls',()=>{
 const rows=corpus.cases.filter(c=>c.kind==='evidence');
 for(const label of ['supports','contradicts','insufficient'])expect(rows.some(c=>c.labels.support===label)).toBe(true);
 for(const label of ['full','partial','none','insufficient'])expect(rows.some(c=>c.labels.coverage===label)).toBe(true);
 expect(rows.find(c=>c.id==='invoice-presence-edge').labels.coverage).toBe('none');expect(rows.find(c=>c.id==='pagination-edge').labels.coverage).toBe('none');
 expect(corpus.cases.filter(c=>c.control)).toHaveLength(35);
});

test('simulated full-corpus replay exposes separate held-out control and edge denominators',async()=>{
 const fetchImpl=async()=>new Response('',{status:503});
 const options={mode:'live',model:'jev-1.13.0',output:dir,env:{TYPESAFE_API:'synthetic-credential'},fetchImpl};
 await ev.evaluateCorpus(corpus,options);const replay=await ev.evaluateCorpus(corpus,{...options,mode:'replay'});
 expect(replay.report.heldoutByControl.control.cases).toBe(15);expect(replay.report.heldoutByControl.edge.cases).toBe(15);
 expect(replay.report.heldoutByControl.edge.judgments.coverage.total).toBe(10);expect(replay.report.summary.actualCalls).toBe(0);
});
