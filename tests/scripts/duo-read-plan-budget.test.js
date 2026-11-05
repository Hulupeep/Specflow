const fs=require('fs'),os=require('os'),path=require('path');
const duo=require('../../scripts/duo-build.cjs');
const receipts=require('../../scripts/duo-review-receipts.cjs');
const reviews=require('../../scripts/specflow-reviews.cjs');
const policy=require('../../scripts/specflow-tier.cjs');
let dir;
beforeEach(()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'duo-read-plan-'));});
afterEach(()=>fs.rmSync(dir,{recursive:true,force:true}));
const linesOf=text=>text.match(/[^\n]*\n|[^\n]+$/g)||[];
// A frozen round shaped like tabstax#1071: the scoped record is both in request.json and a required tree file.
function round({sameRecord=true}={}){
 const record={issue:{number:1071,body:'REQ-RUN-13: '.repeat(1500)},profile:{artifacts:[],gates:[{id:'SPEC_TRACE'}]}};
 const request={context:{specification:{record:'evidence/specification-1071.json',targetTier:'build-ready'}},
  requiredReads:['request.json','goal.md','manifest.json','diff.patch','index.patch','commits.txt','tree/evidence/specification-1071.json'],
  batch:{id:'b',criteria:['REQ-RUN-13'],evidence:[]},
  instruction_review:{version:1,artifactHashes:Object.fromEntries(Array.from({length:800},(_,i)=>[`tree/f${i}.js`,'a'.repeat(64)])),nextInstructionIds:[]},
  specification_review:{tier:'build-ready',record,prior_findings:[{id:'REVIEW-002',criterion:null,status:'open'}],gates:[]}};
 fs.writeFileSync(path.join(dir,'request.json'),duo.requestText(request));
 fs.mkdirSync(path.join(dir,'tree/evidence'),{recursive:true});
 fs.writeFileSync(path.join(dir,'tree/evidence/specification-1071.json'),JSON.stringify(sameRecord?record:{...record,issue:{number:1071,body:'changed'}},null,2));
 for(const f of ['goal.md','commits.txt'])fs.writeFileSync(path.join(dir,f),'x\n');
 for(const f of ['diff.patch','index.patch','manifest.json'])fs.writeFileSync(path.join(dir,f),'');
 return request;
}
test('#334 request.json keeps the scoped record last and the plan reads it once, from the required record file',()=>{
 const request=round(),text=fs.readFileSync(path.join(dir,'request.json'),'utf8'),parsed=JSON.parse(text),lines=linesOf(text);
 expect(Object.keys(parsed.specification_review).at(-1)).toBe('record');
 expect(Object.keys(parsed).slice(-2)).toEqual(['specification_review','instruction_review']);
 const plan=duo.planReads(dir,request.requiredReads),entry=plan.entries.find(e=>e.file==='request.json');
 expect(entry.onDemand.map(o=>o.note.split(',')[0])).toEqual(['specification_review.record','instruction_review.artifactHashes, a per-file SHA-256 listing that duplicates manifest.json. Read bounded ranges of it only when you need a specific hash.'.split(',')[0]]);
 const recordStart=lines.findIndex(l=>/^ {4}"record": \{/.test(l))+1;
 const text2=duo.readingPlan(dir,request.requiredReads,'claude-code',plan);
 expect(text2).toMatch(new RegExp(`request\\.json lines ${recordStart}-\\d+ hold specification_review\\.record, identical to tree/evidence/specification-1071\\.json`));
 const ranges=[...text2.matchAll(/^ {4}(sed .+request\.json)$/gm)].map(m=>receipts.commandRead(m[1]));
 for(const r of ranges){
  for(const o of entry.onDemand)expect(r.end<o.span[0]||r.start>o.span[1]).toBe(true);
  expect(Buffer.byteLength(lines.slice(r.start-1,r.end).join(''))).toBeLessThanOrEqual(16000);
 }
 // Every review-content line outside the on-demand listings is planned exactly once.
 const covered=new Set(ranges.flatMap(r=>Array.from({length:r.end-r.start+1},(_,i)=>r.start+i)));
 for(let n=1;n<=lines.length;n++)if(!entry.onDemand.some(o=>n>=o.span[0]&&n<=o.span[1]))expect(covered.has(n)).toBe(true);
 expect(entry.planned).toBeLessThan(Buffer.byteLength(text)-30000);
});
test('#334 a record that differs from the required file stays in the planned review content',()=>{
 const request=round({sameRecord:false});
 const entry=duo.planReads(dir,request.requiredReads).entries.find(e=>e.file==='request.json');
 expect(entry.onDemand.map(o=>o.note)).toEqual([expect.stringMatching(/^instruction_review\.artifactHashes/)]);
});
test('#335 the scoped journal accepts one re-attachment of an orphan finding and records it',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'scoped-orphan-'));
 try{
  const ev=(name,bytes=name)=>{fs.writeFileSync(path.join(root,name),bytes);return {path:name,sha256:policy.sha(bytes)};};
  const identity={provider:'codex',family:'gpt',model:'fixture-only',mode:'simulated'};
  const finding=o=>({id:'REVIEW-002',basis:'Raw CI log not inspected',action:'Inspect it',severity:'SERIOUS',status:'open',impact:'current',origin:'original',evidence:[ev('finding')],...o});
  const r={issue:{number:9,body:'AC-1'},profile:{ui:false,materialSeams:[]}};
  const first=reviews.begin(root,r,'build-ready','claude-code');
  reviews.complete(root,first,{nativeOutcome:'changes_required',readinessComplete:false,identity,evidence:[ev('raw')],findings:[finding({criterion:null})],gates:[]});
  r.profile.repairEvidence=ev('repair');
  const second=reviews.begin(root,r,'build-ready','claude-code');
  reviews.complete(root,second,{nativeOutcome:'changes_required',readinessComplete:false,identity,evidence:[ev('raw')],findings:[finding({criterion:'GATE-REMOTE-CI'})],gates:[]});
  const state=reviews.load(root,9),round=state.reviews['build-ready'].at(-1);
  expect(round.status).toBe('complete');expect(round.protocolErrors).toEqual([]);
  expect(round.findings.find(f=>f.id==='REVIEW-002')).toMatchObject({criterion:'GATE-REMOTE-CI',reattached:{from:null,to:'GATE-REMOTE-CI'}});
  expect(state.events.filter(e=>e.kind==='finding-reattached')).toEqual([expect.objectContaining({id:'REVIEW-002',from:null,to:'GATE-REMOTE-CI',round:second.id,tier:'build-ready'})]);
  // A second change of criterion is still a repurpose.
  const result=reviews.classify(root,round,[finding({criterion:'AC-1'})],[],identity);
  expect(result.protocolErrors).toEqual(['REVIEW-002: cannot repurpose an existing finding ID']);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
