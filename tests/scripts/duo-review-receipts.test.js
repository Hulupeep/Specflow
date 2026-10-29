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
test('opt-in full coverage joins actual Codex slices without treating a one-line access as completion',()=>{
 const one=codex("sed -n '1p' -- proof.txt",'line one\n'),two=codex("sed -n '2p' -- proof.txt",'line two\n');two[0].item.id='cmd-2';
 expect(access.collect(one,dir,['proof.txt'],{coverage:true}).complete).toEqual([]);
 expect(access.collect([...one,...two],dir,['proof.txt'],{coverage:true}).coverage['proof.txt']).toEqual({totalLines:2,linesRead:2,complete:true});
 expect(access.collect(one,dir,['proof.txt']).coverage).toBeUndefined();
});
test('opt-in full coverage joins only matching Claude line contents and handles empty successful reads',()=>{
 const one=claude();one[1].message.content[0].content='1→line one';const two=claude();two[0].message.content[0].id='read-2';two[1].message.content[0].tool_use_id='read-2';two[1].message.content[0].content='2→line two';
 expect(access.collect(one,dir,['proof.txt'],{coverage:true}).complete).toEqual([]);
 expect(access.collect([...one,...two],dir,['proof.txt'],{coverage:true}).complete).toEqual(['proof.txt']);
 two[1].message.content[0].content='2→invented';expect(access.collect([...one,...two],dir,['proof.txt'],{coverage:true}).complete).toEqual([]);
 fs.writeFileSync(path.join(dir,'empty.patch'),'');const empty=claude('Read',{file_path:'empty.patch'});empty[1].message.content[0].content='The file exists but is empty';expect(access.collect(empty,dir,['empty.patch'],{coverage:true}).complete).toEqual(['empty.patch']);
});
test('bounded native read of a large manifest earns partial, not full, coverage',()=>{
 const lines=Array.from({length:12000},(_,i)=>`entry ${i} ${'x'.repeat(60)}`);
 fs.writeFileSync(path.join(dir,'manifest.json'),lines.join('\n')+'\n');
 const events=claude('Read',{file_path:'manifest.json',offset:1,limit:100});
 events[1].message.content[0].content=lines.slice(0,100).map((line,i)=>`${i+1}\t${line}`).join('\n');
 const result=access.collect(events,dir,['manifest.json'],{coverage:true});
 expect(result.inspected).toEqual(['manifest.json']);
 expect(result.coverage['manifest.json']).toEqual({totalLines:12000,linesRead:100,complete:false});
 events[1].message.content[0].is_error=true;
 expect(access.collect(events,dir,['manifest.json'],{coverage:true}).inspected).toEqual([]);
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

test.each(['claude','codex'])('instruction evidence derives duplicate inspection metadata from current %s receipts',provider=>{
 fs.mkdirSync(path.join(dir,'tree'));fs.copyFileSync(path.join(dir,'proof.txt'),path.join(dir,'tree/proof.txt'));
 const events=provider==='claude'?claude('Read',{file_path:'tree/proof.txt'}):codex('cat tree/proof.txt');
 const receipts=access.collect(events,dir,['tree/proof.txt']);
 const request={batch:{evidence:['proof.txt']},instruction_review:{artifactHashes:{'tree/proof.txt':'frozen-hash'}}};
 const result={instruction_assessments:[{outcome:'satisfied',inspected:[],evidence:['proof.txt']}]};
 const normalized=access.apply(result,receipts,request);
 expect(normalized.instruction_assessments[0]).toEqual({outcome:'satisfied',inspected:['tree/proof.txt'],evidence:['proof.txt']});
});

test.each(['unsubmitted','unbound','unread','denied','discovery'])('instruction projection cannot invent %s proof',kind=>{
 fs.mkdirSync(path.join(dir,'tree'));fs.copyFileSync(path.join(dir,'proof.txt'),path.join(dir,'tree/proof.txt'));
 const events=kind==='unread'?[]:kind==='discovery'?claude('Glob',{pattern:'tree/*'}):claude('Read',{file_path:'tree/proof.txt'},kind==='denied');
 const receipts=access.collect(events,dir,['tree/proof.txt']);
 const request={batch:{evidence:kind==='unsubmitted'?[]:['proof.txt']},instruction_review:{artifactHashes:kind==='unbound'?{}:{'tree/proof.txt':'frozen-hash'}}};
 const normalized=access.apply({instruction_assessments:[{outcome:'satisfied',inspected:[],evidence:['proof.txt']}]},receipts,request);
 expect(normalized.instruction_assessments[0].inspected).toEqual([]);
});

test('normalization retains explicit invalid claims for rejection and leaves malformed fields invalid',()=>{
 const request={batch:{evidence:['proof.txt']},instruction_review:{artifactHashes:{'tree/proof.txt':'frozen-hash'}}};
 const result={instruction_assessments:[{inspected:['invented'],evidence:['proof.txt']},{inspected:null,evidence:['proof.txt']},{inspected:[],evidence:null}]};
 access.apply(result,{inspected:['tree/proof.txt']},request);
 expect(result.instruction_assessments[0].inspected).toContain('invented');
 expect(result.instruction_assessments[1].inspected).toBeNull();expect(result.instruction_assessments[2].evidence).toBeNull();
});

// Deterministic synthetic 16x16 codec fixtures, not product or native-run evidence.
const receiptImages={"png": {"mime": "image/png", "base64": "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGUlEQVR4nGPUiFrAQApgIkn1qIZRDUNKAwCpoQFCcQgOjQAAAABJRU5ErkJggg=="}, "jpg": {"mime": "image/jpeg", "base64": "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAQABADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDkqKKK+mPDP//Z"}, "gif": {"mime": "image/gif", "base64": "R0lGODdhEAAQAIEAAChaoAAAAAAAAAAAACwAAAAAEAAQAEAIHQABCBxIsKDBgwgTKlzIsKHDhxAjSpxIsaLFgQEBADs="}, "webp": {"mime": "image/webp", "base64": "UklGRjgAAABXRUJQVlA4ICwAAADwAQCdASoQABAAAUAmJaACdLoB+AAF9AAA/vFNr/zNExzH7V//hV8bkLCgAA=="}};
function imageRead({ ext = 'png', content, data, mime, sourceType = 'base64', text, is_error = false, file = `pixel.${ext}` } = {}) {
  const sample = receiptImages[ext];
  fs.writeFileSync(path.join(dir, `pixel.${ext}`), Buffer.from(sample.base64, 'base64'));
  const blocks = content === undefined ? [{type:'image',source:{type:sourceType,media_type:mime || sample.mime,data:data === undefined ? sample.base64 : data}}] : content;
  if (text && Array.isArray(blocks)) blocks.push({type:'text',text});
  return [
    {type:'assistant',message:{content:[{type:'tool_use',id:'image-read',name:'Read',input:{file_path:file}}]}},
    {type:'user',message:{content:[{type:'tool_result',tool_use_id:'image-read',content:blocks,is_error}]}},
  ];
}

test.each(Object.keys(receiptImages))('IMAGE-225 native-shaped %s image-only content earns exact binary receipt', ext => {
  const events = imageRead({ext});
  const result = access.collect(events, dir, [`pixel.${ext}`]);
  expect(result.inspected).toEqual([`pixel.${ext}`]);
  expect(result.receipts).toEqual([expect.objectContaining({
    path:`pixel.${ext}`,tool:'Read',callId:'image-read',extent:'full',
    outputHash:require('crypto').createHash('sha256').update(Buffer.from(receiptImages[ext].base64,'base64')).digest('hex'),
  })]);
});

test('IMAGE-225 explanatory text alongside exact image does not replace binary identity', () => {
  const result = access.collect(imageRead({text:'Rendered image follows'}),dir,['pixel.png']);
  expect(result.inspected).toEqual(['pixel.png']);
  expect(result.receipts[0]).toMatchObject({extent:'full',outputHash:require('crypto').createHash('sha256').update(Buffer.from(receiptImages.png.base64,'base64')).digest('hex')});
});

test.each([
  ['different bytes', {data:receiptImages.gif.base64}],
  ['malformed base64', {data:'%%%not-base64%%%'}],
  ['noncanonical whitespace', {data:receiptImages.png.base64+'\n'}],
  ['empty bytes', {data:''}],
  ['non-string bytes', {data:{claim:'read'}}],
  ['wrong media type', {mime:'image/jpeg'}],
  ['unknown media type', {mime:'image/not-real'}],
  ['non-base64 source', {sourceType:'url'}],
  ['missing image source', {content:[{type:'image'}]}],
  ['null content part', {content:[null]}],
  ['non-array image claim', {content:{type:'image',source:{type:'base64',media_type:'image/png',data:receiptImages.png.base64}}}],
  ['no image payload', {content:[]}],
])('IMAGE-225 %s cannot earn inspection via an appended text claim', (_name, overrides) => {
  expect(access.collect(imageRead({...overrides,text:'I read pixel.png'}),dir,['pixel.png']).inspected).toEqual([]);
});

test('IMAGE-225 multiple image payloads are not an exact single-artifact receipt', () => {
  const events=imageRead({text:'Both images were read'});
  events[1].message.content[0].content.push({type:'image',source:{type:'base64',media_type:'image/gif',data:receiptImages.gif.base64}});
  expect(access.collect(events,dir,['pixel.png']).inspected).toEqual([]);
});

test.each(['failed','wrong-path','unallowed','discovery'])('IMAGE-225 %s image access earns no receipt', kind => {
  const events=imageRead({is_error:kind==='failed',file:kind==='wrong-path'?'wrong.png':'pixel.png'});
  if(kind==='discovery')events[0].message.content[0].name='Glob';
  expect(access.collect(events,dir,kind==='unallowed'?[]:['pixel.png']).inspected).toEqual([]);
});

test('IMAGE-225 caller cannot credit an image outside its frozen round', () => {
  const outside=fs.mkdtempSync(path.join(os.tmpdir(),'outside-image-'));
  try {
    const file=path.join(outside,'pixel.png');fs.writeFileSync(file,Buffer.from(receiptImages.png.base64,'base64'));
    expect(access.collect(imageRead({file}),dir,[path.relative(dir,file)]).inspected).toEqual([]);
  } finally { fs.rmSync(outside,{recursive:true,force:true}); }
});

test('IMAGE-225 image-shaped output cannot masquerade as text-file access', () => {
  const events=imageRead({file:'proof.txt',text:'line one\nline two\n'});
  expect(access.collect(events,dir,['proof.txt']).inspected).toEqual([]);
});

test('IMAGE-225 actual image receipt satisfies citation checks; substitute bytes do not', () => {
  fs.mkdirSync(path.join(dir,'tree'));
  fs.writeFileSync(path.join(dir,'tree/pixel.png'),Buffer.from(receiptImages.png.base64,'base64'));
  const request={batch:{evidence:['pixel.png']}};
  const valid=access.collect(imageRead({file:'tree/pixel.png'}),dir,['tree/pixel.png']);
  expect(access.apply({assessments:[{status:'verified',evidence:['pixel.png']}]},valid,request).inspected).toEqual(['tree/pixel.png']);
  const invalid=access.collect(imageRead({file:'tree/pixel.png',data:receiptImages.gif.base64,text:'read it'}),dir,['tree/pixel.png']);
  expect(()=>access.apply({assessments:[{status:'verified',evidence:['pixel.png']}]},invalid,request)).toThrow(/receipt/);
});

test.each([
  ['png',Buffer.from('89504e470d0a1a0a','hex')],
  ['jpg',Buffer.from('ffd8ffd9','hex')],
  ['gif',Buffer.from('GIF89a;')],
  ['webp',Buffer.from('RIFF\x04\x00\x00\x00WEBP','binary')],
])('IMAGE-225 truncated %s container cannot gain credit even when the bytes match', (ext,bytes) => {
  const events=imageRead({ext,data:bytes.toString('base64'),text:'Image read'});
  fs.writeFileSync(path.join(dir,`pixel.${ext}`),bytes);
  expect(access.collect(events,dir,[`pixel.${ext}`]).inspected).toEqual([]);
});
