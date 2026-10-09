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
