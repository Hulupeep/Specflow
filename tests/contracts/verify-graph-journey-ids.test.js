const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'graph-127-'));fs.mkdirSync(path.join(root,'docs/contracts'),{recursive:true});});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function fixture(suffix,duplicate=false){
 const dir=path.join(root,'docs/contracts');
 fs.writeFileSync(path.join(dir,'CONTRACT_INDEX.'+suffix),'journeys:\n  - id: J-INDEXED-JOURNEY\n    file: journey_first.yml\n'+(duplicate?'  - id: J-INDEXED-JOURNEY\n    file: journey_second.yml\n':''));
 fs.writeFileSync(path.join(dir,'journey_first.yml'),'journey_meta:\n  id: J-INDEXED-JOURNEY\n');
 if(duplicate)fs.writeFileSync(path.join(dir,'journey_second.yml'),'journey_meta:\n  id: J-INDEXED-JOURNEY\n');
 return cp.spawnSync(process.execPath,[path.join(__dirname,'../../scripts/verify-graph.cjs'),'docs/contracts'],{cwd:root,encoding:'utf8',timeout:10000});
}
test.each(['yml','yaml'])('GRAPH-127 index reference in .%s is not a second journey definition',suffix=>{
 const r=fixture(suffix);expect(r.status).toBe(0);expect(r.stderr).not.toContain('Duplicate journey ID');expect(r.stderr).toContain('journey ID(s) are unique');
 if(suffix==='yml')expect(r.stderr).toContain('CONTRACT_INDEX.yml exists');
});
test.each(['yml','yaml'])('GRAPH-127 .%s index never hides two actual journey definitions',suffix=>{
 const r=fixture(suffix,true);expect(r.status).toBe(1);expect(r.stderr).toContain('Duplicate journey ID J-INDEXED-JOURNEY');expect(r.stderr).toContain('journey_first.yml');expect(r.stderr).toContain('journey_second.yml');
});
