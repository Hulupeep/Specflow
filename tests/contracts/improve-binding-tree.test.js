const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const binding=require('../../scripts/improve-binding.cjs');
describe('Git byte identity without per-file process launches',()=>{
 let root;
 beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'binding-tree-'));});
 afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
 function git(args){return cp.execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();}
 function init(format){git(['init','-q','-b','main','--object-format='+format]);fs.writeFileSync(path.join(root,'initial'),'initial');git(['add','.']);git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','-qm','fixture']);}
 test.each(['sha1','sha256'])('matches Git tree for %s, binary bytes, executable and symlink',format=>{
  init(format);fs.writeFileSync(path.join(root,'binary'),Buffer.from([0,255,10,13,42]));fs.writeFileSync(path.join(root,'executable'),'hello',{mode:0o755});fs.symlinkSync('binary',path.join(root,'link'));
  const actual=binding.tree(root);expect(actual.tree).toBe(git(['write-tree']));expect(actual.parent).toBe(git(['rev-parse','HEAD']));expect(actual.branch).toBe('refs/heads/main');
 });
 test('rejects a Git clean conversion instead of accepting transformed bytes',()=>{
  init('sha1');fs.writeFileSync(path.join(root,'.gitattributes'),'converted text eol=lf\n');fs.writeFileSync(path.join(root,'converted'),'first\r\nsecond\r\n');
  expect(()=>binding.tree(root)).toThrow('Git content transformation differs');
 });
 test('uses a bounded number of Git launches as the file count grows',()=>{
  init('sha1');for(let i=0;i<40;i++)fs.writeFileSync(path.join(root,'file-'+i),'payload '+i);
  const original=cp.spawnSync,operations=[];
  jest.resetModules();jest.doMock('child_process',()=>({...cp,spawnSync:(cmd,args,opts)=>{if(cmd==='git')operations.push(args[0]);return original(cmd,args,opts);}}));
  try{require('../../scripts/improve-binding.cjs').tree(root);expect(operations.filter(x=>x==='hash-object')).toHaveLength(0);expect(operations.length).toBeLessThanOrEqual(8);}finally{jest.dontMock('child_process');jest.resetModules();}
 });
});
