const fs=require('fs'),path=require('path'),os=require('os'),{execFileSync}=require('child_process');
const {fixture}=require('../helpers/duo-action-fixture.cjs');const duo=require('../../scripts/duo-build.cjs'),runtime=require('../../scripts/duo-runtime.cjs');
let f,source;beforeEach(()=>{f=fixture();source=fs.mkdtempSync(path.join(os.tmpdir(),'duo-kit-'));fs.mkdirSync(path.join(source,'scripts'));fs.writeFileSync(path.join(source,'scripts/duo-build.cjs'),'new version');});afterEach(()=>{f.close();fs.rmSync(source,{recursive:true,force:true});});
test('J-DUO-RUNTIME-STABLE: stage while unfinished; pinned CLI status survives a modified installed helper',()=>{
 const before=duo.fingerprint(f.root,[]),saved=JSON.stringify(f.state());const updated=runtime.install(source,f.root);expect(updated.state).toBe('staged');expect(duo.fingerprint(f.root,[])).toBe(before);expect(JSON.stringify(f.state())).toBe(saved);
 const pinned=path.join(f.root,'.specflow/duo',f.run.id,'runtime/scripts/duo-build.cjs');const out=execFileSync(process.execPath,[pinned,'status',f.run.id],{cwd:f.root,encoding:'utf8'});expect(out).toContain(f.run.id);expect(out).toContain(`staged ${updated.stagedVersion}`);
 expect(runtime.dispatch(f.root,f.run.id,path.join(f.root,'scripts'))).toBe(path.dirname(pinned));
 f.put('display.cjs','console.log(0)');expect(duo.fingerprint(f.root,[])).not.toBe(before);
});
test('an eligible new run pins the staged installation and reports its exact active version',()=>{
 const kit=path.resolve(__dirname,'../..');
 for(const name of runtime.helpers)fs.copyFileSync(path.join(kit,'scripts',name),path.join(source,'scripts',name));
 fs.appendFileSync(path.join(source,'scripts/duo-build.cjs'),'\n// Distinct next-version fixture bytes.\n');
 fs.mkdirSync(path.join(source,'skills/duo-build'),{recursive:true});
 fs.copyFileSync(path.join(kit,'skills/duo-build/SKILL.md'),path.join(source,'skills/duo-build/SKILL.md'));
 const original=f.state(),staged=runtime.install(source,f.root);
 expect(staged.state).toBe('staged');
 expect(runtime.describe(f.root,original)).toMatchObject({active:original.runtime.identity,staged:staged.stagedVersion});
 expect(duo.status(original)).toContain(`staged ${staged.stagedVersion}`);
 duo.cease(f.root,original.id,original.owner.session,'Fixture owner explicitly ended this run before a new installation');
 const active=runtime.install(source,f.root);
 expect(active).toMatchObject({state:'active',activeVersion:staged.stagedVersion});
 // Load the installed entry point so pin() reads the new installation's bytes.
 const installed=require(path.join(f.root,'scripts/duo-build.cjs'));
 const next=installed.start(f.root,'#153 explicitly requested new fixture run','codex',f.context);
 const manifest=JSON.parse(fs.readFileSync(path.join(f.root,'.specflow/duo',next.id,'runtime/manifest.json')));
 const digest=bytes=>require('crypto').createHash('sha256').update(bytes).digest('hex');
 const expected=Object.fromEntries(runtime.helpers.map(name=>['scripts/'+name,digest(fs.readFileSync(path.join(f.root,'scripts',name)))]));
 expect(manifest.protocolVersion).toBe('duo-actions-1');
 expect(manifest.helperHashes).toEqual(expected);
 expect(manifest.identity).toBe(next.runtime.identity);
 expect(manifest.identity).not.toBe(original.runtime.identity);
 expect(runtime.describe(f.root,next)).toMatchObject({active:manifest.identity,installed:active.activeVersion,staged:null});
 expect(installed.status(next)).toContain(`Runtime: ${manifest.identity}; installed ${active.activeVersion}; staged none`);
 const oldManifest=JSON.parse(fs.readFileSync(path.join(f.root,'.specflow/duo',original.id,'runtime/manifest.json')));
 expect(oldManifest.identity).toBe(original.runtime.identity);
});
test('new eligible install applies managed bytes, preserves custom files and rolls back failed writes',()=>{
 const target=fs.mkdtempSync(path.join(os.tmpdir(),'duo-install-'));
 try{
  fs.mkdirSync(path.join(source,'hooks'));fs.writeFileSync(path.join(source,'hooks/duo-review-check.sh'),'#!/bin/bash\nexit 0');
  expect(runtime.install(source,target).state).toBe('active');expect(fs.statSync(path.join(target,'.claude/hooks/duo-review-check.sh')).mode & 0o111).toBe(0o111);expect(fs.readFileSync(path.join(target,'scripts/duo-build.cjs'),'utf8')).toBe('new version');
  fs.writeFileSync(path.join(source,'scripts/duo-build.cjs'),'newer version');fs.writeFileSync(path.join(source,'scripts/duo-actions.cjs'),'actions');
  expect(()=>runtime.install(source,target,{beforeWrite:rel=>{if(rel.endsWith('duo-actions.cjs'))throw Error('disk fault');}})).toThrow('disk fault');expect(fs.readFileSync(path.join(target,'scripts/duo-build.cjs'),'utf8')).toBe('new version');
  fs.writeFileSync(path.join(target,'scripts/duo-build.cjs'),'custom');expect(()=>runtime.install(source,target)).toThrow('Custom');expect(fs.readFileSync(path.join(target,'scripts/duo-build.cjs'),'utf8')).toBe('custom');
 }finally{fs.rmSync(target,{recursive:true,force:true});}
});
test('installation/start contention refuses mutation; corrupt pinned bytes block resume',()=>{
 runtime.lock(f.root,()=>{expect(()=>duo.start(f.root,'#149','codex',f.context)).toThrow('lock active');expect(()=>runtime.install(source,f.root)).toThrow('lock active');});
 f.put(`.specflow/duo/${f.run.id}/runtime/scripts/duo-actions.cjs`,'modified');expect(()=>duo.resume(f.root,f.run.id,'claude-code',{session:f.run.owner.session})).toThrow('Pinned duo runtime modified');
});
test('stale goal guide diagnoses predecessor without editing it',()=>{
 const guide='Navigation: .specflow/duo/100-abcdef01/audit.md';f.put('goal.md',guide);const result=runtime.describe(f.root,f.state());expect(result.staleGuide).toContain(f.run.id);expect(fs.readFileSync(path.join(f.root,'goal.md'),'utf8')).toBe(guide);
});
test('runtime update refuses a symlinked staging directory without writing outside the project',()=>{
 const outside=fs.mkdtempSync(path.join(os.tmpdir(),'duo-outside-'));
 try{fs.symlinkSync(outside,path.join(f.root,'.specflow/duo/runtime-update'));expect(()=>runtime.install(source,f.root)).toThrow('symlink');expect(fs.readdirSync(outside)).toEqual([]);}finally{fs.rmSync(outside,{recursive:true,force:true});}
});
test('explicit owner cease retains incomplete goal and counters, releases staging, and cannot resume as a budget reset',()=>{
 const before=f.state();expect(()=>duo.cease(f.root,f.run.id,'wrong','Owner request')).toThrow(/own/);expect(()=>duo.cease(f.root,f.run.id,f.run.owner.session,'')).toThrow(/reason/);
 const ceased=duo.cease(f.root,f.run.id,f.run.owner.session,'Owner explicitly ended this fixture run');expect(ceased.goalStatus).toBe('incomplete');expect(ceased.batchAttempts).toEqual(before.batchAttempts);expect(ceased.criteria).toEqual(before.criteria);expect(ceased.owner).toBeNull();expect(runtime.unfinished(f.root)).toEqual([]);expect(()=>f.transfer()).toThrow('explicitly ceased');
 expect(runtime.install(source,f.root).state).toBe('active');
});
test('current dispatcher refuses to resume an explicitly ceased run through a legacy pinned helper',()=>{
 const state=f.state();state.outcome='accepted';f.put(`.specflow/duo/${state.id}/run.json`,state);
 const ceased=duo.cease(f.root,state.id,state.owner.session,'Explicit fixture owner decision');expect(duo.status(ceased)).toContain('Next action: Retain this read-only history');
 const log=jest.spyOn(console,'error').mockImplementation(()=>{});const dispatch=jest.spyOn(runtime,'dispatch');
 try{expect(duo.cli(['resume',state.id,'--builder','codex','--takeover','--reason','Cannot restart'],f.root)).toBe(2);expect(dispatch).not.toHaveBeenCalled();expect(f.state().owner).toBeNull();}finally{log.mockRestore();dispatch.mockRestore();}
});
test('hooks-only bootstrap refuses existing duo history before downloading or changing managed hooks',()=>{
 const script=path.join(source,'install-hooks.sh');fs.copyFileSync(path.resolve(__dirname,'../../install-hooks.sh'),script);const before=duo.fingerprint(f.root,[]),state=JSON.stringify(f.state());
 try{execFileSync('bash',[script,f.root],{encoding:'utf8',stdio:'pipe'});throw Error('Hooks-only installer unexpectedly succeeded');}catch(e){expect(e.status).toBe(2);expect(e.stderr.toString()).toContain('Full Specflow kit required');}
 expect(duo.fingerprint(f.root,[])).toBe(before);expect(JSON.stringify(f.state())).toBe(state);
});
