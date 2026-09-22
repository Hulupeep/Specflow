const fs = require('fs'), os = require('os'), path = require('path');
const client = require('../../scripts/typesafe-client.cjs');
const { questions } = require('../../scripts/typesafe-questions-v1.cjs');
let dir;
const input = () => ({ state: { criterion: 'Show 18', claim: 'Shows 18', assertion: 'equals 18', evidence: 'Observed 18' }, questions: questions(), model: 'jev-1.13.0', questionSetId: 'test', questionVersion: '1', snapshotHash: 'abc' });
function result(i = input()) { return { model: i.model, answers: Object.fromEntries(Object.entries(i.questions).map(([id,q]) => [id, { type:'choice', choice:Object.keys(q.criteria)[0], confidence:1, probabilities:Object.fromEntries(Object.keys(q.criteria).map((k,n) => [k, n === 0 ? 1 : 0])) }])), usage:{input_tokens:10,output_tokens:2} }; }
const options = extra => ({ file:path.join(dir,'record.json'),env:{TYPESAFE_API:'synthetic-test-credential'}, ...extra });
beforeEach(() => { dir=fs.mkdtempSync(path.join(os.tmpdir(),'ts-client-')); });
afterEach(() => { fs.rmSync(dir,{recursive:true,force:true}); delete process.env.SPECFLOW_DUO_REVIEWER; });
test('J-TSAFE-CLIENT: complete batched request, pinned replay and changed identity rejection', async () => {
 const transport=jest.fn(async (_, opts) => { const payload=JSON.parse(opts.body); expect(Object.keys(payload.questions)).toHaveLength(2); expect(opts.redirect).toBe('error'); return Response.json(result()); });
 const r=await client.evaluate(input(),options({fetchImpl:transport})); expect(r.status).toBe('completed'); expect(r.networkCalls).toBe(1);
 expect((await client.evaluate(input(),options({fetchImpl:transport}))).origin).toBe('replay'); expect(transport).toHaveBeenCalledTimes(1);
 await expect(client.evaluate({...input(),snapshotHash:'new'},options())).rejects.toThrow(/identity/);
 expect(fs.readFileSync(options().file,'utf8')).not.toContain('synthetic-test-credential');
});
test.each([[401,'auth'],[403,'auth'],[429,'rate_limit'],[500,'provider_error'],[529,'provider_error']])('HTTP %i safely records %s once',async (status,reason)=>{
 const transport=jest.fn(async()=>new Response('secret-error-body',{status}));
 const r=await client.evaluate(input(),options({fetchImpl:transport}));expect(r.reason).toBe(reason);expect(r.response).toBeUndefined();expect(transport).toHaveBeenCalledTimes(1);expect(fs.readFileSync(options().file,'utf8')).not.toContain('secret-error-body');
});
test('absent credentials and oversize/sensitive input never call transport',async()=>{
 const transport=jest.fn();
 for(const [name,i,env,reason] of [['missing',input(),{},'missing_credentials'],['large',{...input(),state:'x'.repeat(70000)},options().env,'input_limit'],['secret',{...input(),state:'synthetic-test-credential'},options().env,'sensitive_input'],['invalid',{...input(),questions:{}},options().env,'invalid_input']]) {
 const r=await client.evaluate(i,options({file:path.join(dir,name+'.json'),env,fetchImpl:transport}));expect(r.reason).toBe(reason);
 }expect(transport).not.toHaveBeenCalled();
});
test('deadline includes hung transport and streamed response limit',async()=>{
 expect((await client.evaluate(input(),options({timeoutMs:10,fetchImpl:()=>new Promise(()=>{})}))).reason).toBe('timeout');
 expect((await client.evaluate(input(),options({file:path.join(dir,'large'),fetchImpl:async()=>new Response('x'.repeat(270000))}))).reason).toBe('response_limit');
});
test.each(['missing','extra','membership','probability','sum','model','tokens','type','malformed'])('invalid response %s cannot become success',async kind=>{
 const r=result();
 if(kind==='missing')delete r.answers.support;if(kind==='extra')r.answers.extra=r.answers.support;if(kind==='membership')r.answers.support.choice='invented';if(kind==='probability')r.answers.support.probabilities.supports=-1;if(kind==='sum')r.answers.support.probabilities.supports=.5;if(kind==='model')r.model='jev-9.0.0';if(kind==='tokens')r.usage.input_tokens=-1;if(kind==='type')r.answers.support.type='noul';
 const out=await client.evaluate(input(),options({fetchImpl:async()=>kind==='malformed'?new Response('broken'):Response.json(r)}));expect(out.reason).toBe('invalid_response');
});
test('interrupted pending becomes unavailable without another request',async()=>{
 const transport=jest.fn();let pending;
 await client.evaluate(input(),options({fetchImpl:async()=>{pending=JSON.parse(fs.readFileSync(options().file));return Response.json(result());}}));
 fs.writeFileSync(options().file,JSON.stringify(pending));expect((await client.evaluate(input(),options({fetchImpl:transport}))).reason).toBe('interrupted');expect(transport).not.toHaveBeenCalled();
});
test('alias replay is historical; key precedence and explicit env-file loading',async()=>{
 const f=path.join(dir,'.env.local');fs.writeFileSync(f,'TYPESAFE_API="from-file"\n');
 expect(client.credentials({TYPESAFE_API_KEY:'primary',TYPESAFE_API:'alias'},f)).toBe('primary');expect(client.credentials({},f)).toBe('from-file');expect(client.credentials({})).toBe('');
 const i={...input(),model:'jev-latest'};await client.evaluate(i,options({fetchImpl:async()=>Response.json({...result(),model:'jev-1.13.0'})}));
 const replay=await client.evaluate(i,options());expect(replay.historical).toBe(true);expect(replay.modelPinned).toBe(false);
});
test('Noul/Score validation preserves semantic shape and rejects invalid definitions',()=>{
 const i={...input(),questions:{yes:{type:'noul',instructions:'Is yes?'},score:{type:'score',instructions:'Rate',criteria:['low','high']}}};
 const r={model:i.model,usage:{input_tokens:1,output_tokens:1},answers:{yes:{type:'noul',noul:.7},score:{type:'score',score:.5,legend:{0:'low',1:'high'},probabilities:{0:.5,1:.5},confidence:0}}};
 expect(client.validateResponse(r,i).answers.yes.noul).toBe(.7);r.answers.yes.confidence=.7;expect(()=>client.validateResponse(r,i)).toThrow();
 expect(()=>client.validateInput({...input(),questions:{a:{type:'choice',instructions:'x',criteria:{only:'one'}}}})).toThrow();
});
test('reviewer recursion and symlink destinations are refused',async()=>{
 fs.symlinkSync('/tmp',path.join(dir,'link'));await expect(client.evaluate(input(),options({file:path.join(dir,'link/out.json')}))).rejects.toThrow(/Symlink/);
 process.env.SPECFLOW_DUO_REVIEWER='1';await expect(client.evaluate(input(),options())).rejects.toThrow(/Recursive/);
});
test('transport errors are safely classified and malformed identity metadata never succeeds',async()=>{
 const transport=jest.fn(async()=>{throw Error('credential-shaped private transport detail');});
 const r=await client.evaluate(input(),options({fetchImpl:transport}));expect(r.reason).toBe('transport');expect(transport).toHaveBeenCalledTimes(1);expect(fs.readFileSync(options().file,'utf8')).not.toContain('private transport detail');
 const never=jest.fn();const invalid=await client.evaluate({...input(),questionSetId:'invalid identifier with spaces'},options({file:path.join(dir,'metadata.json'),fetchImpl:never}));expect(invalid.reason).toBe('invalid_input');expect(never).not.toHaveBeenCalled();
});
