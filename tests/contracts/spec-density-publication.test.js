const fs=require('fs'),os=require('os'),path=require('path');
const {publish}=require('../../scripts/specflow-publication.cjs');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'spec-privacy-'));fs.mkdirSync(path.join(root,'.specflow'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function fixture(canary=true){
 fs.writeFileSync(path.join(root,'private.json'),JSON.stringify({name:'owner-archive-private.pst',size:123456789,hash:'0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'}));
 fs.writeFileSync(path.join(root,'scan.cjs'),`const fs=require('fs'),p=require('path');const b=JSON.parse(fs.readFileSync(p.join(__dirname,'private.json')));const forms=[b.name,String(b.size),b.size.toLocaleString('en-US'),(b.size/1e6).toFixed(1)+' MB',b.hash,b.hash.slice(0,12)];const count=t=>forms.filter(s=>t.includes(s)).length;const canary=${canary}&&count('planted '+b.name)>0;const success=canary&&count(fs.readFileSync(process.argv[2],'utf8'))===0;console.log(JSON.stringify({success,actual:{canary_detected:canary,secret_forms_checked:forms.length}}));process.exitCode=success?0:1;`);
 fs.writeFileSync(path.join(root,'.specflow/publication-policy.json'),JSON.stringify({command:[process.execPath,'scan.cjs'],privateBaselineRequired:true}));
 fs.writeFileSync(path.join(root,'body.md'),'Sanitized observed result; no production acceptance.');fs.writeFileSync(path.join(root,'linked.md'),'Sanitized supporting summary.');
 return {repo:'owner/project',issue:3,bodyFile:'body.md',linkedFiles:['linked.md']};
}
test.each(['thin','contracted','build-ready'])('%s publication scans real baseline forms and a planted canary before remote effects',tier=>{
 const r={...fixture(),tier},run=jest.fn(()=>({status:0}));
 expect(publish(root,r,{run}).status).toBe('published');expect(run).toHaveBeenCalledTimes(1);
 for(const secret of ['owner-archive-private.pst','123456789','123,456,789','123.5 MB','0123456789ab']){fs.writeFileSync(path.join(root,'linked.md'),secret);expect(()=>publish(root,r,{run})).toThrow('privacy check');}
 expect(run).toHaveBeenCalledTimes(1);
});
test('missing scanner or failed real canary cannot be called a publication pass',()=>{
 const r=fixture(false),run=jest.fn();expect(()=>publish(root,r,{run})).toThrow('canary');
 fs.rmSync(path.join(root,'.specflow/publication-policy.json'));expect(()=>publish(root,r,{run})).toThrow();expect(run).not.toHaveBeenCalled();
});
test('new ticket creation scans its title and supporting files before publication',()=>{
 const r={...fixture(),action:'create',title:'Safe fixture title'},run=jest.fn(()=>({status:0}));delete r.issue;
 expect(publish(root,r,{run}).status).toBe('published');expect(run.mock.calls[0][1].slice(0,2)).toEqual(['issue','create']);
 r.title='owner-archive-private.pst';expect(()=>publish(root,r,{run})).toThrow('privacy check');expect(run).toHaveBeenCalledTimes(1);
});
test('privacy staging refuses symlink redirection before writing the payload',()=>{
 const request=fixture(),outside=fs.mkdtempSync(path.join(os.tmpdir(),'privacy-outside-'));
 try{fs.symlinkSync(outside,path.join(root,'.specflow/specification'));expect(()=>publish(root,request,{run:jest.fn()})).toThrow('symlinks');expect(fs.readdirSync(outside)).toEqual([]);}finally{fs.rmSync(outside,{recursive:true,force:true});}
});
test.each(['thin','contracted','build-ready'])('%s creation applies the same Unicode rubric before any remote write',tier=>{
 const r={...fixture(),action:'create',title:'Safe',tier},run=jest.fn(()=>({status:0}));delete r.issue;
 fs.writeFileSync(path.join(root,'body.md'),'😀'.repeat(12001));const blocked=publish(root,r,{run});expect(blocked.status).toBe('blocked');expect(blocked.volume.counts.bodyCharacters).toBe(12001);expect(run).not.toHaveBeenCalled();
 fs.writeFileSync(path.join(root,'body.md'),'😀'.repeat(12000));const out=publish(root,r,{run});expect(out.status).toBe('published');expect(out.volume.warnings.join()).toContain('target');expect(out.volume.counts.bodyCharacters).toBe(12000);
});
test('broken references, lost ACs and conflicting tiers block creation or update before writes',()=>{
 const r={...fixture(),action:'create',title:'Safe'},run=jest.fn(()=>({status:0}));delete r.issue;
 fs.writeFileSync(path.join(root,'body.md'),'[Execution](missing.md)');expect(publish(root,r,{run}).status).toBe('blocked');expect(run).not.toHaveBeenCalled();
 fs.writeFileSync(path.join(root,'body.md'),'Safe');r.labels=['spec:thin','spec:contracted'];expect(publish(root,r,{run}).status).toBe('blocked');expect(run).not.toHaveBeenCalled();
});
function updateFixture(body='AC-1: retain the observed behaviour'){
 const r={...fixture(),action:'update',expectedBodyFile:'expected.md'};fs.writeFileSync(path.join(root,'expected.md'),body);fs.writeFileSync(path.join(root,'body.md'),body);return r;
}
const current=body=>({status:0,stdout:JSON.stringify({body,labels:['spec:thin']})});
test('update requires expected body and rejects intervening edits without replacing remote content',()=>{
 const r=updateFixture(),run=jest.fn(()=>current('Edited by another actor'));expect(()=>publish(root,r,{run})).toThrow('intervening edits');expect(run).toHaveBeenCalledTimes(1);expect(run.mock.calls[0][1][1]).toBe('view');delete r.expectedBodyFile;expect(()=>publish(root,r,{run})).toThrow('expectedBodyFile');
});
test('update detects edits during privacy and never falls through to a blind PATCH',()=>{
 const r=updateFixture(),before=fs.readFileSync(path.join(root,'expected.md'),'utf8');let reads=0;const run=jest.fn(()=>current(++reads===1?before:'Concurrent change'));
 expect(()=>publish(root,r,{run})).toThrow('during validation');expect(run).toHaveBeenCalledTimes(2);expect(run.mock.calls.every(c=>c[1][1]==='view')).toBe(true);
});
test('no-op update succeeds without write; changed update is explicitly unavailable rather than falsely atomic',()=>{
 const r=updateFixture(),before=fs.readFileSync(path.join(root,'expected.md'),'utf8'),run=jest.fn(()=>current(before));expect(publish(root,r,{run}).status).toBe('unchanged');
 fs.writeFileSync(path.join(root,'body.md'),before+'\nClear context.');const out=publish(root,r,{run});expect(out.status).toBe('blocked');expect(out.next_action).toContain('Atomic');expect(run.mock.calls.every(c=>c[1][1]==='view')).toBe(true);
});
test('lost acceptance blocks while canonical relocation remains measured and proposal never replaces issue body',()=>{
 const r=updateFixture(),before=fs.readFileSync(path.join(root,'expected.md'),'utf8'),run=jest.fn((cmd,args)=>args[1]==='view'?current(before):{status:0});
 fs.writeFileSync(path.join(root,'body.md'),'Short');expect(publish(root,r,{run}).volume.errors.join()).toContain('Lost identifier');expect(run).toHaveBeenCalledTimes(1);
 fs.writeFileSync(path.join(root,'linked.md'),before);fs.writeFileSync(path.join(root,'body.md'),'[Acceptance](linked.md)');r.action='propose-update';const out=publish(root,r,{run});expect(out.status).toBe('proposed');expect(out.volume.counts.linkedMaintainedCharacters).toBe([...before].length);expect(run.mock.calls.at(-1)[1][1]).toBe('comment');expect(run.mock.calls.at(-1)[2].input).toContain('not applied');
});
test('update privacy still rejects sensitive proposals and expected bodies before any write',()=>{
 const r=updateFixture(),before=fs.readFileSync(path.join(root,'expected.md'),'utf8'),run=jest.fn(()=>current(before));r.action='propose-update';fs.appendFileSync(path.join(root,'body.md'),'\nowner-archive-private.pst');expect(()=>publish(root,r,{run})).toThrow('privacy check');expect(run).toHaveBeenCalledTimes(1);
});
test('auto-discovered execution links pass privacy and content-stability checks before creation',()=>{
 const r={...fixture(),action:'create',title:'Safe',linkedFiles:[]},run=jest.fn(()=>({status:0}));delete r.issue;fs.writeFileSync(path.join(root,'body.md'),'[Execution](linked.md)');fs.writeFileSync(path.join(root,'linked.md'),'owner-archive-private.pst');expect(()=>publish(root,r,{run})).toThrow('privacy check');expect(run).not.toHaveBeenCalled();
 fs.writeFileSync(path.join(root,'linked.md'),'Safe canonical specification');const execute=()=>{fs.writeFileSync(path.join(root,'linked.md'),'Changed while checking');return {status:0,stdout:JSON.stringify({success:true,actual:{canary_detected:true,secret_forms_checked:6}})};};expect(()=>publish(root,r,{run,execute})).toThrow('content changed');expect(run).not.toHaveBeenCalled();
});
test('blocked pre-scan size results never echo raw acceptance definitions',()=>{
 const r={...fixture(),action:'create',title:'Safe'},run=jest.fn();delete r.issue;fs.writeFileSync(path.join(root,'body.md'),'AC-1: owner-archive-private.pst\n'+'x'.repeat(12001));const out=publish(root,r,{run});expect(out.status).toBe('blocked');expect(JSON.stringify(out)).not.toContain('owner-archive-private.pst');expect(out.volume).not.toHaveProperty('identifiers');expect(run).not.toHaveBeenCalled();
});
