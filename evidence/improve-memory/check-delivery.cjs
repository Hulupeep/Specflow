'use strict';
// Mechanical source/privacy checks. Full test execution is a separate raw capture.
const fs=require('fs'),cp=require('child_process'),yaml=require('js-yaml');
const root=process.cwd();let executed=0;
const check=(ok,what)=>{if(!ok)throw Error(what);executed++;};
cp.execFileSync('git',['diff','--check'],{cwd:root});executed++;
const files=cp.execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&f!=='node_modules');
for(const file of files){const s=fs.lstatSync(file);check(s.isFile()&&!s.isSymbolicLink(),'Unexpected delivery file '+file);}
const content=files.map(f=>fs.readFileSync(f,'utf8')).join('\n');
const privacy=require('../../scripts/specflow-publication.cjs').privacy(root,null,content);check(privacy.status==='passed','privacy gate');
const ids=new Set();
for(const name of fs.readdirSync('docs/contracts').filter(n=>n.endsWith('.yml'))){
 const d=yaml.load(fs.readFileSync('docs/contracts/'+name,'utf8'));
 for(const i of d.invariants||[]){check(!ids.has(i.id),'Duplicate invariant '+i.id);ids.add(i.id);}
}
for(const c of ['feature_improve_core','feature_improve_profiles','feature_improve_worker','feature_improve_controller']){
 const file='docs/contracts/'+c+'.yml';check(cp.execFileSync('git',['show','a7c23f2046c0c05438e695857b0e93ffeef4afda:'+file],{encoding:'utf8'})===fs.readFileSync(file,'utf8'),'Existing contract changed');
}
console.log(JSON.stringify({executed,failed:0,skipped:0,privacy,files,scope:'Source hygiene, unique invariant IDs, unchanged upstream contracts and configured mechanical publication privacy scanner; tests separately executed'}));
