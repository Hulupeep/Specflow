const fs=require('fs'),os=require('os'),path=require('path');const volume=require('../../scripts/specflow-volume.cjs'),policy=require('../../scripts/specflow-tier.cjs');
let root;beforeEach(()=>root=fs.mkdtempSync(path.join(os.tmpdir(),'spec-volume-')));afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function artifact(file,text,extra={}){fs.writeFileSync(path.join(root,file),text);return{id:file,role:'decision',path:file,sha256:policy.sha(text),...extra};}
const record=(body,artifacts=[])=>({issue:{number:1,body},profile:{artifacts}});
test('body thresholds and 40 requirements are signals independent of readiness',()=>{
 expect(volume.report(root,record('x'.repeat(19999))).warnings).toEqual([]);
 expect(volume.report(root,record('x'.repeat(20000))).warnings).toEqual([]);
 expect(policy.evaluate(record('Short'),{root,operation:'build'}).status).toBe('blocked');
 expect(volume.report(root,record('x'.repeat(20001))).warnings.join()).toContain('target');
 expect(volume.report(root,record('x'.repeat(30000))).status).toBe('reported');expect(volume.report(root,record('x'.repeat(30001))).status).toBe('blocked');
 expect(volume.report(root,record(Array.from({length:40},(_,i)=>`REQ-${i}: relevant outcome`).join('\n'))).warnings.join()).toContain('scope');
});
test('moving prose does not reduce maintained volume; duplicates and historical evidence are separate',()=>{
 const body='AC-1: returns the correct value',before=volume.report(root,record(body));
 const a=artifact('canonical.md',body,{reuse:true,shared:true}),b=artifact('duplicate.md',body),old=artifact('old.md','Old observation',{maintenance:'historical'});
 const moved=volume.report(root,record('',[a,b,old]),before);
 expect(moved.errors).toEqual([]);expect(moved.counts.linkedMaintainedCharacters).toBe(body.length*2);expect(moved.counts.uniqueMaintainedCharacters).toBe(body.length);expect(moved.counts.historicalCharacters).toBe(15);expect(moved.warnings.join()).toContain('Duplicated');
});
test('missing or conflicting IDs block while an exact canonical move preserves all IDs',()=>{
 const baseline=volume.report(root,record('REQ-1: output a count\nAC-1: shows 3'));
 expect(volume.report(root,record('REQ-1: output a count'),baseline).errors.join()).toContain('Lost identifier AC-1');
 const art=artifact('canonical.md','REQ-1: output a count\nAC-1: shows 3',{reuse:true});
 expect(volume.report(root,record('Details in canonical.md',[art]),baseline).errors).toEqual([]);
 expect(volume.report(root,record('AC-1: shows 4',[art]),baseline).errors.join()).toContain('Conflicting');
 expect(volume.report(root,record('AC-1: shows 4'),baseline).errors.join()).toContain('Changed meaning');
});
test('thin has no forced artifact paths, missing applicable and unjustified N/A remain visible',()=>{
 expect(volume.report(root,record('AC-1: useful thin outcome')).errors).toEqual([]);
 const r=record('AC-1: same',[{id:'future',applicable:false},{id:'gone',path:'missing',sha256:'0'.repeat(64)}]);expect(volume.report(root,r).errors).toHaveLength(2);
});
test('a model-written ownerVerified flag cannot authorize an ID removal',()=>{
 const baseline=volume.report(root,record('AC-1: preserve this acceptance'));
 const r=record('');r.identifierDecisions=[{id:'AC-1',ownerVerified:true,reason:'fit limit',evidence:artifact('fake','approval')}];
 expect(volume.report(root,r,baseline).errors.join()).toContain('Lost identifier');
});

test('moving prose into an undeclared local link cannot hide its maintained volume',()=>{
 const text='AC-1: the original observed behaviour';artifact('details.md',text);
 const r=record('[Details](details.md)');const result=volume.report(root,r);
 expect(result.counts.linkedMaintainedCharacters).toBe(text.length);expect(result.identifiers['AC-1']).toHaveLength(1);
 fs.rmSync(path.join(root,'details.md'));expect(volume.report(root,r).errors.join()).toContain('Broken linked reference');
});
test('linked remote specification cannot disappear from total volume and copied child documents are reported',()=>{
 const url='https://github.com/owner/project/blob/main/docs/spec.md';expect(volume.report(root,record(`[Spec](${url})`)).errors.join()).toContain('Unmeasured');
 const a=artifact('a.md','AC-1: one shared definition',{sourceUrl:url,shared:true,reuse:true});const b=artifact('b.md','AC-1: one shared definition',{reuse:true});
 const r=record(`[Spec](${url})`,[a]);expect(volume.report(root,r).errors).toEqual([]);
 const out=volume.portfolio(root,[r,record('Second ticket',[b])]);expect(out.linkedMaintainedCharacters).toBe(54);expect(out.uniqueLinkedMaintainedCharacters).toBe(27);expect(out.warnings.join()).toContain('Duplicated across');
});
