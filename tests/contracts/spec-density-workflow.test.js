// Dependency/provider receipts are seeded harness data unless a test invokes a
// real process explicitly. These tests prove workflow control, not live review.
const fs=require('fs'),os=require('os'),path=require('path');
const spec=require('../../scripts/specflow-specification.cjs'),reviews=require('../../scripts/specflow-reviews.cjs'),policy=require('../../scripts/specflow-tier.cjs');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'progressive-spec-'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function ref(file,text=file){return spec.write(root,file,typeof text==='object'?text:{text});}
function record(n=1,tier='thin'){
 const issue={number:n,title:`Slice ${n}`,body:`AC-${n}: observable result`,labels:[`spec:${tier}`]};spec.write(root,`issue-${n}.json`,issue);
 const r={issue,source:{kind:'file',path:`issue-${n}.json`},profile:{ui:false,materialSeams:[],artifacts:[],gates:[{id:'test',command:[process.execPath,'check.cjs']}]}};
 fs.writeFileSync(path.join(root,'check.cjs'),'console.log(JSON.stringify({executed:1,skipped:0,failed:0}))');
 for(const role of ['acceptance-checks','simulation','preflight'])r.profile.artifacts.push({id:role,role,reuse:true,...ref(`${n}-${role}.json`)});
 save(r);return r;
}
function save(r){const file=`record-${r.issue.number}.json`;spec.write(root,file,r);spec.register(root,file);return file;}
function seededReview(r,tier='build-ready'){
 const reservation=reviews.begin(root,r,tier,'codex');
 return reviews.complete(root,reservation,{nativeOutcome:'accepted',readinessComplete:true,findings:[],gates:Object.values(reviews.load(root,r.issue.number).gates||{}).map(g=>({...g,evidence:[g.evidence]})),evidence:[ref(`review-${r.issue.number}-${tier}`)],identity:{provider:'claude',family:'claude',model:'seeded-provider-boundary',mode:'live'}});
}
function ready(r){spec.gate(root,r,'test');seededReview(r);expect(spec.promote(root,save(r),'build-ready','Selected now').status).toBe('promoted');return spec.read(root,savePath(r));}
const savePath=r=>`record-${r.issue.number}.json`;
function discovery(r,id='D1'){return {id,kind:'observation',observation:'Parser stopped before producing output',proposedEdit:'Revalidate parser support before depending on it',publicSummary:'Parser support remains unverified',references:['parser-capability'],tickets:[r.issue.number],evidence:[ref('observed.json',{exitCode:1})]};}
test('one slice promotes using actual executed gate evidence; B and C stay thin',()=>{
 const a=record(1),b=record(2),c=record(3);b.dependencies=[{issue:1,record:savePath(a),reason:'Consumes A',evidence:[ref('b-needs-a')]}];c.dependencies=[{issue:2,record:savePath(b),reason:'Consumes B',evidence:[ref('c-needs-b')]}];save(b);save(c);const ar=ready(a);
 expect(spec.boundary(root,ar,{route:'duo-build',operation:'build'}).status).toBe('eligible');
 expect(spec.frontier(root,[savePath(a),savePath(b),savePath(c)],[1]).map(r=>r.tier)).toEqual(['build-ready','thin','thin']);
 const changed=spec.read(root,'issue-1.json');changed.body+='\nAC-2: changed';spec.write(root,'issue-1.json',changed);
 expect(spec.boundary(root,ar,{route:'duo-build',operation:'resume'}).status).toBe('blocked');
});
test('closed or ready dependencies are not capability evidence; cycles and unavailable dependencies block',()=>{
 const a=record(1),b=record(2);a.dependencies=[{issue:2,record:savePath(b),reason:'Needs parsing',evidence:[ref('why')]}];save(a);
 expect(spec.dependencyCheck(root,a).errors.join()).toContain('implemented capability');
 b.dependencies=[{issue:1,record:savePath(a),reason:'Circular',evidence:[ref('why2')]}];save(b);
 expect(spec.dependencyCheck(root,a).errors.join()).toContain('Circular');
 fs.rmSync(path.join(root,'issue-2.json'));expect(spec.dependencyCheck(root,a).errors.length).toBeGreaterThan(0);
});
test('dependency execution and changed raw evidence are validated at promotion and subsequent build',()=>{
 const a=record(1),b=record(2);b.capability={status:'tested',scope:policy.inputHash(b),evidence:[ref('capability',{exitCode:0,executed:1,skipped:0,failed:0})]};save(b);
 a.dependencies=[{issue:2,record:savePath(b),reason:'Needs observed parse result',evidence:[ref('why')]}];save(a);const ar=ready(a);
 expect(spec.boundary(root,ar,{route:'feature-build',operation:'build'}).status).toBe('eligible');
 ref('capability',{exitCode:0,executed:1,skipped:1,failed:0});expect(spec.boundary(root,ar,{route:'feature-build',operation:'resume'}).status).toBe('blocked');
});
test('failed, skipped and absent test execution cannot pass a declared gate',()=>{
 const r=record();
 for(const result of [{executed:1,skipped:1,failed:0},{executed:0,skipped:0,failed:0},{executed:1,skipped:0,failed:1},{}]){
  const out=spec.gate(root,r,'test',{execute:()=>({status:0,stdout:JSON.stringify(result)})});expect(out.status).toBe('blocked');
 }
});
test('simulated peer or changed scope cannot promote even with green jobs',()=>{
 const r=record();spec.gate(root,r,'test');const reservation=reviews.begin(root,r,'build-ready','codex');reviews.complete(root,reservation,{nativeOutcome:'accepted',readinessComplete:true,evidence:[ref('review')],findings:[],identity:{provider:'claude',family:'claude',model:'fixture',mode:'simulated'}});
 expect(spec.promote(root,savePath(r),'build-ready','selected').errors.join()).toContain('Simulated');
});
test.each(['success','failed','blocked','interrupted'])('%s collection persists explicit none separately from a missing report',outcome=>{
 const r=ready(record());spec.beginBatch(root,r,'work');expect(spec.boundary(root,r,{route:'duo-build',operation:'finish'}).errors.join()).toContain('collection missing');
 spec.collect(root,r,'work',{outcome,discoveries:[]});expect(spec.pending(root,r).batches).toHaveLength(0);
 expect(spec.collect(root,r,'work',{outcome,discoveries:[]}).collection).toBe('reported');
});
test('failed experiment discovery stales a shared consumer and preserves unrelated work',()=>{
 const a=record(1),b=ready(record(2)),c=record(3);b.assumptions=['parser-capability'];save(b);
 spec.beginBatch(root,a,'parser');spec.collect(root,a,'parser',{outcome:'failed',discoveries:[discovery(a)]});
 expect(spec.boundary(root,b,{route:'duo-build',operation:'resume'}).errors.join()).toContain('Discovery D1');expect(spec.pending(root,c).discoveries).toHaveLength(0);
 const d=discovery(a);expect(()=>spec.collect(root,a,'parser',{outcome:'failed',discoveries:[{...d,observation:'different'}]})).toThrow('immutable');
 expect(spec.frontier(root,[savePath(a),savePath(b),savePath(c)],[1]).find(r=>r.issue===2).stale).toBe(true);
});
test('accepted discoveries require changed reference and revalidation; contradictions remain separate',()=>{
 const r=ready(record());spec.beginBatch(root,r,'work');spec.collect(root,r,'work',{outcome:'failed',discoveries:[discovery(r)]});
 expect(()=>spec.reconcile(root,r,1,'D1',{kind:'accepted',reason:'fixed',evidence:[ref('fix')]})).toThrow('changed reference');
 spec.reconcile(root,r,1,'D1',{kind:'nonimpact',reason:'Current slice does not parse this format',evidence:[ref('nonimpact')]});
 expect(spec.boundary(root,r,{route:'duo-build',operation:'finish'}).errors.join()).toContain('Discovery history changed');
 spec.beginBatch(root,r,'contradiction');spec.collect(root,r,'contradiction',{outcome:'success',discoveries:[{...discovery(r,'D2'),observation:'A different representative input succeeded',contradicts:['D1']}]});
 expect(reviews.load(root,1).discoveries).toHaveLength(2);
});
function experimentPlan(r){
 const permission=ref('permission',{allowed:'synthetic input only; adapter isolation fixture'}),input=ref('input',{synthetic:true}),code=ref('code-policy',{sandbox:'fixture'});
 const command=[process.execPath,'experiment.cjs'];fs.writeFileSync(path.join(root,'experiment.cjs'),"console.log(JSON.stringify(process.argv.includes('--probe')?{success:true,sandboxReady:true,simulated:true}:{observed:1,synthetic:true}))");
 spec.write(root,'.specflow/experiment-policy.json',{adapters:{fixture:{sandboxed:true,command,probeCommand:[...command,'--probe'],maxTimeoutMs:1000,maxOutputBytes:4096,permissionEvidence:[permission]}}});
 return {id:'parse',adapter:'fixture',question:'Can it read representative input?',expectedObservation:'One observed count',permissionEvidence:[permission],inputs:[input],code:[code],command,timeoutMs:1000,maxOutputBytes:4096};
}
test('thin experiment retains real process output, cannot grant readiness, and blocks unchanged repetition',()=>{
 const r=record(),plan=experimentPlan(r),out=spec.experiment(root,savePath(r),plan);expect(out.status).toBe('observed');expect(out.productionAccepted).toBe(false);expect(spec.read(root,out.evidence.path).stdout).toContain('observed');
 expect(spec.boundary(root,r,{route:'duo-build',operation:'build'}).status).toBe('blocked');expect(()=>spec.experiment(root,savePath(r),plan)).toThrow('No new experiment');
});
test.each([['failed',{status:1,stdout:'failure'}],['budget_exhausted',{status:null,error:{code:'ETIMEDOUT'}}]])('experiment %s retains raw evidence and pending collection', (status,result)=>{
 const r=record(),out=spec.experiment(root,savePath(r),experimentPlan(r),{execute:()=>result});expect(out.status).toBe(status);expect(spec.pending(root,r).batches).toHaveLength(1);
});
test('unavailable input blocks without invoking the experiment',()=>{
 const r=record(),plan=experimentPlan(r),execute=jest.fn();fs.rmSync(path.join(root,'input'));expect(spec.experiment(root,savePath(r),plan,{execute}).status).toBe('blocked');expect(execute).not.toHaveBeenCalled();
});
test('scope changes during a gate retain raw failure evidence and do not save readiness',()=>{
 const r=record();expect(()=>spec.gate(root,r,'test',{execute:()=>{const issue=spec.read(root,'issue-1.json');issue.body+='\nAC-99: concurrent owner change';spec.write(root,'issue-1.json',issue);return{status:0,stdout:JSON.stringify({executed:1,skipped:0,failed:0})};}})).toThrow('acceptance changed');
 expect(spec.read(root,savePath(r)).readiness).toBeUndefined();expect(spec.read(root,'issue-1.json').body).toContain('AC-99');
});
test('owner scope exception requires a freshly verified owner comment and remains non-passing',()=>{
 const r=record();r.source={kind:'github',repo:'owner/project',number:1};
 expect(()=>spec.ownerException(root,r,'--reason')).toThrow('not a CLI reason');
 const body=`override:owner:prepare shared seam early\nscope:${policy.inputHash(r)}\nrisks:implementation remains unknown`;
 expect(()=>spec.ownerException(root,r,1,{run:()=>({status:0,stdout:JSON.stringify({user:{login:'agent'},author_association:'CONTRIBUTOR',body})})})).toThrow('owner-authored');
 const crypto=require('crypto'),keys=crypto.generateKeyPairSync('ed25519');spec.write(root,'.specflow/owner-authorization.json',{owner:'owner',publicKey:keys.publicKey.export({type:'spki',format:'pem'})});
 const payload={who:'owner',scope:policy.inputHash(r),commentId:'1',body};spec.write(root,'owner-signature.json',{payload,signature:crypto.sign(null,Buffer.from(JSON.stringify(payload)),keys.privateKey).toString('base64')});
 const out=spec.ownerException(root,r,1,{signatureFile:'owner-signature.json',run:()=>({status:0,stdout:JSON.stringify({user:{login:'owner'},author_association:'OWNER',body,html_url:'https://github.com/owner/project/issues/1#issuecomment-1'})})});
 expect(out.status).toBe('override:owner:prepare shared seam early');expect(reviews.status(root,r,'contracted').passed).toBe(false);
});
test('failed publication remains pending, retries are idempotent and ordinary remote comments do not stale scope',()=>{
 const r=record();r.source={kind:'github',repo:'owner/project',number:1};save(r);spec.beginBatch(root,r,'failed');spec.collect(root,r,'failed',{outcome:'failed',discoveries:[discovery(r)]});
 spec.write(root,'.specflow/publication-policy.json',{command:['fixture-scanner'],privateBaselineRequired:true});
 const comments=[];let writes=0,denied=true;const run=(cmd,args,opts)=>{
  if(args[1]==='view')return{status:0,stdout:JSON.stringify({...r.issue,comments})};
  if(args[1]==='comment'){writes++;if(denied)return{status:1};comments.push({body:opts.input});return{status:0};}throw Error('Unexpected remote command');
 };
 const options={run,execute:()=>({status:0,stdout:JSON.stringify({success:true,actual:{canary_detected:true,secret_forms_checked:8}})})};
 expect(spec.publish(root,r,1,'D1',options).status).toBe('blocked');expect(spec.pending(root,r).discoveries[0].publication.status).toBe('pending');
 denied=false;expect(spec.publish(root,r,1,'D1',options).status).toBe('published');expect(spec.publish(root,r,1,'D1',options).status).toBe('already_published');expect(writes).toBe(2);
 expect(spec.current(root,r,options).issue.comments).toHaveLength(1);expect(spec.pending(root,r).discoveries).toHaveLength(1);
});

test('a missing discovery journal and a hand-written readiness receipt cannot bypass promotion',()=>{
 const r=ready(record());fs.rmSync(reviews.statePath(root,1));
 const decision=spec.boundary(root,r,{route:'duo-build',operation:'build'});expect(decision.status).toBe('blocked');expect(decision.errors.join()).toContain('discovery source');expect(decision.errors.join()).toContain('durable promotion');
});

test('accepted discovery can be revalidated with new review and gates without bypassing the old receipt',()=>{
 const r=ready(record());spec.beginBatch(root,r,'learn');spec.collect(root,r,'learn',{outcome:'failed',discoveries:[discovery(r)]});
 r.profile.artifacts[0]={...r.profile.artifacts[0],...ref('1-acceptance-checks.json',{changed:'checks revised after observed parser failure'})};save(r);
 spec.reconcile(root,r,1,'D1',{kind:'accepted',reason:'Narrowed the unsupported assumption',changedReference:'acceptance-checks',evidence:[ref('repair-proof')]});
 expect(spec.boundary(root,r,{route:'duo-build',operation:'build'}).status).toBe('blocked');
 spec.gate(root,r,'test');seededReview(r);
 expect(spec.promote(root,savePath(r),'build-ready','Revalidate the affected slice').status).toBe('promoted');
 expect(spec.boundary(root,spec.read(root,savePath(r)),{route:'duo-build',operation:'build'}).status).toBe('eligible');
});
test('remote discovery marker requires its local journal; ordinary notes do not invalidate unchanged acceptance',()=>{
 const r=ready(record()),issue=spec.read(root,'issue-1.json');issue.comments=[{body:'Ordinary progress note'}];spec.write(root,'issue-1.json',issue);
 expect(spec.boundary(root,r,{route:'duo-build',operation:'resume'}).status).toBe('eligible');
 issue.comments.push({body:'<!-- specflow-discovery:99:D1 -->\nProposed correction'});spec.write(root,'issue-1.json',issue);
 expect(spec.boundary(root,r,{route:'duo-build',operation:'resume'}).errors.join()).toContain('journal unavailable');
});
test('an owner-token comment alone cannot impersonate separate owner authorization',()=>{
 const r=record();r.source={kind:'github',repo:'owner/project',number:1};
 const body=`override:owner:do it\nscope:${policy.inputHash(r)}\nrisks:unknown`;
 expect(()=>spec.ownerException(root,r,1,{run:()=>({status:0,stdout:JSON.stringify({user:{login:'owner'},author_association:'OWNER',body})})})).toThrow('detached owner authorization');
});
test('a renamed unchanged experiment cannot repeat; changed code preserves both attempts under the same display ID',()=>{
 const r=record(),plan=experimentPlan(r),first=spec.experiment(root,savePath(r),plan);
 spec.collect(root,r,first.batch,{outcome:'success',discoveries:[]});
 expect(()=>spec.experiment(root,savePath(r),{...plan,id:'renamed'})).toThrow('No new experiment');
 plan.code=[ref('code-policy',{sandbox:'new synthetic question instrumentation'})];const second=spec.experiment(root,savePath(r),plan);
 expect(second.batch).not.toBe(first.batch);expect(reviews.load(root,1).experiments).toHaveLength(2);expect(Object.keys(reviews.load(root,1).batches)).toHaveLength(2);
});
test('publication stays pending until every affected target has an idempotent comment',()=>{
 const a=record(1),b=record(2);for(const r of [a,b]){r.source={kind:'github',repo:'owner/project',number:r.issue.number};save(r);}
 spec.beginBatch(root,a,'batch');spec.collect(root,a,'batch',{outcome:'failed',discoveries:[{...discovery(a),tickets:[1,2]}]});
 spec.write(root,'.specflow/publication-policy.json',{command:['scanner'],privateBaselineRequired:false});
 const comments={1:[],2:[]};const options={execute:()=>({status:0,stdout:JSON.stringify({success:true})}),run:(exe,args,opts)=>{const n=Number(args[2]);if(args[1]==='view')return{status:0,stdout:JSON.stringify({...([a,b].find(r=>r.issue.number===n).issue),comments:comments[n]})};comments[n].push({body:opts.input});return{status:0};}};
 spec.publish(root,a,1,'D1',options);expect(reviews.load(root,1).discoveries[0].publication.status).toBe('pending');
 spec.publish(root,b,1,'D1',options);expect(reviews.load(root,1).discoveries[0].publication.status).toBe('published');
 spec.publish(root,b,1,'D1',options);expect(comments[2]).toHaveLength(1);
});
test.each(['input','sandbox'])('a restored %s permits one unchanged blocked-plan retry; unchanged completed plans still stop',kind=>{
 const r=record(),plan=experimentPlan(r),input=fs.readFileSync(path.join(root,'input'));let available=false;
 if(kind==='input')fs.rmSync(path.join(root,'input'));
 const opts=kind==='sandbox'?{probeExecute:()=>({status:available?0:2,stdout:JSON.stringify({success:available,sandboxReady:available})})}:{};
 const first=spec.experiment(root,savePath(r),plan,opts);expect(first.status).toBe('blocked');spec.collect(root,r,first.batch,{outcome:'blocked',discoveries:[]});
 expect(spec.experiment(root,savePath(r),plan,opts).status).toBe('blocked');expect(reviews.load(root,1).experiments).toHaveLength(1);
 if(kind==='input')fs.writeFileSync(path.join(root,'input'),input);available=true;
 const retry=spec.experiment(root,savePath(r),plan,opts);expect(retry.status).toBe('observed');expect(reviews.load(root,1).experiments.at(-1).retryOf).toBe(first.batch);
 expect(()=>spec.experiment(root,savePath(r),plan,opts)).toThrow('No new experiment');
});
test('removing an assumption reference cannot hide a discovery and preserve old readiness',()=>{
 const r=record();r.assumptions=['parser-capability'];save(r);const readyRecord=ready(r),producer=record(2);
 spec.beginBatch(root,producer,'failure');spec.collect(root,producer,'failure',{outcome:'failed',discoveries:[discovery(producer)]});
 readyRecord.assumptions=[];save(readyRecord);expect(spec.boundary(root,readyRecord,{route:'duo-build',operation:'build'}).status).toBe('blocked');
});
