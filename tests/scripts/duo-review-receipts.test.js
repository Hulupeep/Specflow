const fs=require('fs'),os=require('os'),path=require('path');
const access=require('../../scripts/duo-review-receipts.cjs');
const direction=require('../../scripts/duo-direction.cjs');
let dir;
beforeEach(()=>{dir=fs.mkdtempSync(path.join(os.tmpdir(),'duo-access-'));fs.writeFileSync(path.join(dir,'proof.txt'),'line one\nline two\n');});
afterEach(()=>fs.rmSync(dir,{recursive:true,force:true}));
const codex=(command,output='line one\nline two\n',exit_code=0)=>[{type:'item.completed',item:{id:'cmd-1',type:'command_execution',command,aggregated_output:output,exit_code,status:'completed'}}];
const claude=(name='Read',input={file_path:'proof.txt'},is_error=false)=>[{type:'assistant',message:{content:[{type:'tool_use',id:'read-1',name,input}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'read-1',content:'1\tline one\n2\tline two',is_error}]}}];
test.each(["cat -- proof.txt", "/bin/bash -lc 'cat -- proof.txt'"] )('successful Codex content receipt: %s',command=>{
 const result=access.collect(codex(command),dir,['proof.txt']);expect(result.inspected).toEqual(['proof.txt']);expect(result.receipts[0]).toMatchObject({callId:'cmd-1',tool:'cat',extent:'full'});
});
test('Claude content is derived without a self-reported inspected list',()=>{
 const result=access.collect(claude(),dir,['proof.txt']);expect(access.apply({summary:'read'},result).inspected).toEqual(['proof.txt']);expect(result.receipts[0].callId).toBe('read-1');
});
test.each(['rg --files proof.txt','cat proof.txt; true','cat missing.txt || cat proof.txt','cat proof.txt | head','cat proof.txt > /dev/null','node -e "read file"','cat ../proof.txt','cat "$FILE"'])('unsupported/discovery shell call earns no receipt: %s',command=>{
 expect(access.collect(codex(command),dir,['proof.txt']).inspected).toEqual([]);
});
test('failed, denied, discovery-only and contentless tool calls earn no receipt',()=>{
 for(const events of [codex('cat proof.txt','',1),codex('cat proof.txt',''),claude('Read',{file_path:'proof.txt'},true),claude('Glob',{pattern:'*'}),claude('Grep',{path:'proof.txt',output_mode:'files_with_matches'})])expect(access.collect(events,dir,['proof.txt']).inspected).toEqual([]);
});
test('explicit source slices retain partial extent; truncation cannot masquerade as a full read',()=>{
 const result=access.collect(codex("sed -n '2,2p' -- proof.txt",'line two\n'),dir,['proof.txt']);expect(result.receipts[0].extent).toBe('partial');
 expect(access.collect(codex('cat proof.txt','line one\n'),dir,['proof.txt']).inspected).toEqual([]);
});
test('invented citation is rejected even if another file was really read',()=>{
 expect(()=>access.apply({inspected:['manifest.json']},access.collect(claude(),dir,['proof.txt']))).toThrow(/receipt/);
});
test('native completion schema cannot generate complete plus another finish instruction',()=>{
 const complete=direction.responseSchema.anyOf.find(s=>s.properties.assessment.enum.includes('complete'));
 expect(complete.properties.next_steps.maxItems).toBe(0);
 const continuing=direction.responseSchema.anyOf.find(s=>!s.properties.assessment.enum.includes('complete'));
 expect(continuing.properties.next_steps.minItems).toBe(1);
 expect(direction.prompt).toContain('never add running finish');
});

test('successful cat of an actually empty artifact records access without inventing contents',()=>{
 fs.writeFileSync(path.join(dir,'empty.patch'),'');
 expect(access.collect(codex('cat empty.patch',''),dir,['empty.patch']).inspected).toEqual(['empty.patch']);
});

test('partial acceptance, closed findings and diagnostics also require actual raw evidence access',()=>{
 for(const result of [{assessments:[{status:'verified',evidence:['missing.txt']}]},{resolutions:[{status:'closed',evidence:['missing.txt']}]},{diagnostics:[{evidence:['missing.txt']}]}])expect(()=>access.apply(result,{inspected:['proof.txt']},{batch:{evidence:['missing.txt']}})).toThrow(/receipt/);
});

test('directory Grep content earns only verified partial file receipts, never filename discovery',()=>{
 fs.mkdirSync(path.join(dir,'tree'));fs.writeFileSync(path.join(dir,'tree/source.js'),'first\nassert.equal(actual,42)\nlast\n');
 const events=claude('Grep',{path:'tree',output_mode:'content'});events[1].message.content[0].content='tree/source.js-1-first\ntree/source.js:2:assert.equal(actual,42)\ntree/source.js-3-last';
 const found=access.collect(events,dir,['tree/source.js']);expect(found.inspected).toEqual(['tree/source.js']);expect(found.receipts).toHaveLength(1);expect(found.receipts.every(r=>r.extent==='partial')).toBe(true);
 for(const text of ['tree/source.js','tree/source.js:2:invented assertion','tree/source.js:99:first']){events[1].message.content[0].content=text;expect(access.collect(events,dir,['tree/source.js']).inspected).toEqual([]);}
 events[0].message.content[0].input.output_mode='files_with_matches';events[1].message.content[0].content='tree/source.js:2:assert.equal(actual,42)';expect(access.collect(events,dir,['tree/source.js']).inspected).toEqual([]);
});
