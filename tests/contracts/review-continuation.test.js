const fs = require('fs'), os = require('os'), path = require('path');
const reviews = require('../../scripts/specflow-reviews.cjs');
const policy = require('../../scripts/specflow-tier.cjs');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'review-continuation-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
const record = () => ({ issue: { number: 189, body: 'AC-1: honest review' }, profile: { ui: false } });
function evidence(name='raw') { fs.writeFileSync(path.join(root,name),name); return {path:name,sha256:policy.sha(name)}; }
function report(findings=[]) { return { nativeOutcome:'accepted', readinessComplete:true, identity:{provider:'claude',model:'fixture',family:'claude',mode:'simulated'}, evidence:[evidence()], gates:[], findings }; }
function optional(basis) { return {id:'P2-DIAG',severity:'P2',status:'open',impact:'future',basis,action:'Optional diagnostics',evidence:[evidence('detail')]}; }
test('optional finding paraphrase keeps original identity without blocking acceptance', () => {
 const r=record(); reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report([optional('Optional per-path diagnostics')]));
 r.profile.change='new required source';
 const next=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report([optional('Category diagnostics suffice; per-path is optional')]));
 expect(next.outcome).toBe('passed_with_warnings');
 expect(next.findings[0].basis).toBe('Optional per-path diagnostics');
 expect(next.findings[0].latestBasis).toBe('Category diagnostics suffice; per-path is optional');
});
test('scoped gate reports the real failure rather than generic blocked or exhausted', () => {
 const r=record(); const reservation=reviews.begin(root,r,'build-ready','codex');
 reviews.fail(root,reservation,'Peer did not inspect required artifact: tree/task.md',{kind:'protocol'});
 const status=reviews.stageGate(root,r,'preflight');
 expect(status.reason).toContain('tree/task.md');
 expect(status.next_action).toContain('tree/task.md');
});
const continuation=require('../../scripts/review-continuation.cjs');
test('first-time achievements allow long productive runs; repeat achievements and diagnostics do not',()=>{
 const c=continuation.create({usageMode:'subscription'});
 for(let i=0;i<8;i++){continuation.beforeCall(c,()=>{});continuation.observe(c,{achievements:[`criterion:${i}`]});expect(continuation.decision(c)).toBeNull();}
 for(let i=0;i<2;i++){continuation.beforeCall(c,()=>{});continuation.observe(c,{achievements:['criterion:0']});}
 expect(continuation.decision(c)).toMatchObject({kind:'stagnation',recoverable:true});expect(c.calls).toBe(10);
});
test('current evidenced recovery; failure retains diagnosis and rejects reworded notes',()=>{
 const c=continuation.create(); for(let i=0;i<3;i++){continuation.beforeCall(c,()=>{});continuation.observe(c,{protocol:true});}
 expect(()=>continuation.recover(c,{kind:'protocol',cause:'missing required read',action:'read task',evidence:[]},()=>{})).toThrow('evidence');
 const refs=[evidence('diagnosis')],validate=xs=>xs.forEach(r=>{if(policy.sha(fs.readFileSync(path.join(root,r.path)))!==r.sha256)throw Error('changed');});
 continuation.recover(c,{kind:'protocol',cause:'missing required read',action:'read task explicitly',evidence:refs},validate);
 fs.writeFileSync(path.join(root,'diagnosis'),'tampered');expect(()=>continuation.beforeCall(c,validate)).toThrow('changed');expect(c.calls).toBe(3);
 fs.writeFileSync(path.join(root,'diagnosis'),'diagnosis');continuation.beforeCall(c,validate);continuation.observe(c,{protocol:true});
 expect(c.calls).toBe(4);expect(continuation.decision(c)).toMatchObject({kind:'protocol',recoverable:true});
 expect(()=>continuation.recover(c,{kind:'protocol',cause:'new wording',action:'again',evidence:refs},validate)).toThrow('fresh captured execution evidence');
});
test('explicit ceilings preserve state; authorized extension is recorded, not an implicit reset',()=>{
 const c=continuation.create({usageMode:'subscription',maxCalls:1});continuation.beforeCall(c,()=>{});continuation.observe(c,{achievements:['criterion:1']});
 expect(continuation.decision(c)).toMatchObject({kind:'checkpoint'});
 expect(()=>continuation.extend(c,{policy:{maxCalls:2},reason:'continue'})).toThrow('owner authorization');
 continuation.extend(c,{ownerAuthorized:true,policy:{maxCalls:2},reason:'Owner approved one more call'});
 expect(c.calls).toBe(1);expect(c.achievements).toEqual(['criterion:1']);expect(c.extensions).toHaveLength(1);expect(continuation.decision(c)).toBeNull();
 expect(continuation.decision(continuation.create({maxElapsedMs:10},100),110)).toMatchObject({kind:'checkpoint'});
});
test.each([{maxCalls:0},{maxCalls:-1},{maxElapsedMs:Infinity},{usageMode:'free'},{cost:5}])('invalid policy is rejected: %j',input=>expect(()=>continuation.create(input)).toThrow());
test('scoped recovery survives host change, consumes one attempt and cannot grant acceptance',()=>{
 const r=record();for(let i=0;i<3;i++) reviews.fail(root,reviews.begin(root,r,'build-ready','codex'),'Required task read missing',{kind:'protocol'});
 reviews.recover(root,r,'build-ready',{kind:'protocol',cause:'peer omitted task read',action:'include explicit required-read instruction',evidence:[evidence('diagnosis')]});
 expect(reviews.status(root,r,'build-ready').passed).toBe(false);
 reviews.fail(root,reviews.begin(root,r,'build-ready','claude-code'),'Still missing read',{kind:'protocol'});
 expect(()=>reviews.begin(root,r,'build-ready','codex')).toThrow('did not establish progress');
 expect(reviews.load(root,189).events.filter(e=>e.kind==='review-recovery')).toHaveLength(1);
 expect(reviews.load(root,189).reviews['build-ready']).toHaveLength(4);
});
test('scoped reports can advance beyond two reviews and repeated gate passes do not count again',()=>{
 const r=record();
 for(let i=0;i<5;i++) {r.profile.revision=i;const result=report();result.verifiedCriteria=[`AC-${i}`];reviews.complete(root,reviews.begin(root,r,'build-ready','codex',{criteria:Array.from({length:5},(_,i)=>`AC-${i}`)}),result);}
 expect(reviews.status(root,r,'build-ready')).toMatchObject({attempts:5,guard:null});
 for(let i=0;i<2;i++){r.profile.revision++;const result=report();result.verifiedCriteria=['AC-0'];reviews.complete(root,reviews.begin(root,r,'build-ready','codex',{criteria:Array.from({length:5},(_,i)=>`AC-${i}`)}),result);}
 expect(reviews.status(root,r,'build-ready').guard).toMatchObject({kind:'stagnation'});
});
test('J-EFFORT-RETRY scoped state permits a further fresh executed diagnosis across host changes',()=>{
 const r=record();for(let i=0;i<3;i++)reviews.fail(root,reviews.begin(root,r,'build-ready','codex'),'Missing native read',{kind:'protocol'});
 reviews.recover(root,r,'build-ready',{kind:'protocol',cause:'missing read',action:'explicit read list',evidence:[evidence('legacy-diagnosis')]});
 reviews.fail(root,reviews.begin(root,r,'build-ready','claude-code'),'Different source read missing',{kind:'protocol'});
 const raw=JSON.stringify({duo_capture:1,command:['node','diagnose.js'],exitCode:0,error:null,stdout:'new missing source B',stderr:'',sourceBefore:'a'.repeat(64),sourceAfter:'a'.repeat(64),stable:true,finishedAt:new Date().toISOString()});
 fs.writeFileSync(path.join(root,'executed.json'),raw);
 reviews.recover(root,r,'build-ready',{kind:'protocol',cause:'new source omitted',action:'split batch by source',evidence:[{path:'executed.json',sha256:policy.sha(raw)}]});
 reviews.fail(root,reviews.begin(root,r,'build-ready','codex'),'Still unaccepted; no fabricated progress',{kind:'protocol'});
 const s=reviews.load(root,189);expect(s.reviewControl['build-ready'].calls).toBe(5);
 expect(s.events.filter(e=>e.kind==='review-recovery')).toHaveLength(2);
 expect(reviews.status(root,r,'build-ready').passed).toBe(false);
 expect(s.reviewControl['build-ready'].achievements).toEqual([]);
});
test('protocol-invalid findings do not partially replace prior material findings',()=>{
 const r=record(), f={...optional('Original risk'),severity:'SERIOUS',criterion:'AC-1'};
 reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),{...report([f]),nativeOutcome:'changes_required'});
 r.profile.revision=2;
 const result=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report([{...f,status:'resolved',criterion:'AC-2'}]));
 expect(result.status).toBe('protocol_failed');expect(result.findings[0]).toMatchObject({status:'open',criterion:'AC-1'});
 expect(reviews.status(root,r,'build-ready').attempts).toBe(1);
});
test('rephrasing cannot demote a material blocker to an optional warning',()=>{
 const r=record(), f={...optional('Real material failure'),severity:'SERIOUS'};
 reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),{...report([f]),nativeOutcome:'changes_required'});
 r.profile.revision=2;
 const next=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report([{...f,severity:'P2',basis:'Just optional now'}]));
 expect(next.status).toBe('protocol_failed');expect(next.findings[0].severity).toBe('SERIOUS');expect(next.outcome).not.toBe('passed_with_warnings');
});
test('interrupted reservations allow an unchanged retry and count only as protocol failures',()=>{
 const r=record();reviews.fail(root,reviews.begin(root,r,'build-ready','codex'),'Peer process interrupted before response');
 expect(reviews.status(root,r,'build-ready')).toMatchObject({attempts:0,protocolFailures:1,reason:expect.stringContaining('interrupted')});
 expect(reviews.begin(root,r,'build-ready','codex').status).toBe('pending');
});
test('scoped stop reports include the material finding even when generic rejection errors exist',()=>{
 const r=record(),f={...optional('Persistence loses the saved value'),severity:'SERIOUS',action:'Persist the value before returning'};
 for(let i=0;i<2;i++){r.profile.revision=i;reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),{...report([f]),nativeOutcome:'changes_required',readinessComplete:false});}
 const gate=reviews.stageGate(root,r,'preflight');expect(gate.reason).toContain('Persistence loses');expect(gate.next_action).toContain('Persist the value');
 expect(()=>reviews.begin(root,r,'build-ready','codex')).toThrow('Persistence loses');
});
test.each(['finding','gate'])('bad %s evidence cannot close a finding, credit progress or enable later acceptance',kind=>{
 const r=record(),f={...optional('Save failed'),severity:'SERIOUS'};
 reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),{...report([f]),nativeOutcome:'changes_required'});
 r.profile.revision=2;const bad={path:'absent',sha256:'0'.repeat(64)},next=report([{...f,status:'resolved',evidence:kind==='finding'?[bad]:f.evidence}]);
 if(kind==='gate')next.gates=[{id:'GATE-SAVE',executed:true,skipped:false,status:'passed',evidence:[bad]}];
 const result=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),next);
 expect(result.status).toBe('protocol_failed');expect(result.findings[0].status).toBe('open');
 expect(reviews.load(root,189).reviewControl['build-ready'].achievements).toEqual([]);
 r.profile.revision=3;expect(reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report()).outcome).toBe('blocked');
});
test('unknown closures and unindexed criterion IDs cannot earn progress',()=>{
 const r=record(), next=report([{...optional('Invented resolution'),severity:'SERIOUS',status:'resolved'}]);next.verifiedCriteria=['AC-INVENTED'];
 const result=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),next);
 expect(result.status).toBe('protocol_failed');expect(result.findings).toEqual([]);expect(result.verifiedCriteria).toEqual([]);
});
test('invented passing gate IDs cannot earn progress',()=>{
 const r=record(),next=report();next.gates=[{id:'GATE-INVENTED',executed:true,skipped:false,status:'passed',evidence:[evidence('invented')]}];
 const result=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),next);
 expect(result.status).toBe('protocol_failed');expect(reviews.load(root,189).reviewControl['build-ready'].achievements).toEqual([]);
});
test.each(['current impact','missing owner','stale evidence'])('an invalid deferral (%s) stays blocking when omitted on a later review',fault=>{
 const r=record(),f={...optional('Data loss risk'),severity:'SERIOUS',impact:'current'};
 reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),{...report([f]),nativeOutcome:'changes_required'});
 const deferred={...f,status:'deferred',impact:'future',deferral:{nonimpact:'future only',ownerIssue:'https://github.com/example/repo/issues/1',trigger:'future adapter',evidence:[evidence('deferral')]}};
 if(fault==='current impact')deferred.impact='current';if(fault==='missing owner')deferred.deferral.ownerIssue='';if(fault==='stale evidence')fs.writeFileSync(path.join(root,'deferral'),'changed');
 r.profile.revision=2;const invalid=reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report([deferred]));
 expect(invalid.findings[0].status).toBe('open');expect(invalid.progressDiscarded).toBe(true);
 reviews.recover(root,r,'build-ready',{kind:'stagnation',cause:'deferral did not demonstrate nonimpact',action:'review actual data-loss risk',evidence:[evidence('diagnosis')]});
 r.profile.revision=3;expect(reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),report()).outcome).toBe('blocked');
});
test('pending review status retains prior blockers and identifies the unfinished operation',()=>{
 const r=record(),f={...optional('Unresolved actual failure'),severity:'SERIOUS'};
 reviews.complete(root,reviews.begin(root,r,'build-ready','codex'),{...report([f]),nativeOutcome:'changes_required'});
 r.profile.revision=2;reviews.begin(root,r,'build-ready','codex');
 const status=reviews.stageGate(root,r,'preflight');expect(status.findings[0].basis).toBe('Unresolved actual failure');expect(status.next_action).toContain('active reviewer');
});
test('accepted partial batches credit verified progress without granting readiness',()=>{
 const r=record();
 for(let i=0;i<4;i++){
  const next={...report(),readinessComplete:false,verifiedCriteria:[`AC-${i}`]};
  const reservation=reviews.begin(root,r,'build-ready','codex',{criteria:[`AC-${i}`],evidenceFingerprint:policy.sha(`new raw evidence ${i}`)});
  const result=reviews.complete(root,reservation,next);expect(result.progressDiscarded).toBe(false);expect(result.outcome).toBe('blocked');
 }
 const status=reviews.status(root,r,'build-ready');expect(status.passed).toBe(false);expect(status.guard).toBeNull();
 expect(reviews.load(root,189).reviewControl['build-ready'].achievements).toHaveLength(4);
});
