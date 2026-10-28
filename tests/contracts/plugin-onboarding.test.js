// CLI/payload qualification with isolated synthetic projects; not interactive host-session proof.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const {oracleFixture}=require('../helpers/oracle-execution');
const ROOT=process.env.SPECFLOW_TEST_PACKAGE_ROOT||path.resolve(__dirname,'../..'),CLI=path.join(ROOT,'bin/specflow.js');
function host(runtime){return path.join(ROOT,require('js-yaml').load(fs.readFileSync(ROOT+'/docs/contracts/feature_install_ux.yml','utf8')).capability_boundary.host_roots[runtime]);}
function isolated(){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'specflow onboarding ')),bin=base+'/bin';fs.mkdirSync(bin);
 fs.writeFileSync(bin+'/specflow',`#!/bin/sh\nexec '${process.execPath}' '${CLI}' "$@"\n`,{mode:0o700});
 const npm=cp.execFileSync('which',['npm'],{encoding:'utf8'}).trim();
 // Dependencies are pre-provisioned. Generated npm test still executes real Jest.
 fs.writeFileSync(bin+'/npm',`#!/bin/sh\nif [ "$1" = install ]; then exit 0; fi\nexec '${npm}' "$@"\n`,{mode:0o700});
 fs.writeFileSync(bin+'/gh','#!/bin/sh\nexit 1\n',{mode:0o700});
 for(const name of ['codex','claude'])fs.writeFileSync(bin+'/'+name,`#!/bin/sh\necho invoked > '${base}/provider-called'\nexit 99\n`,{mode:0o700});
 const env={...process.env,PATH:bin+path.delimiter+process.env.PATH,SPECFLOW_RUNTIME:'',CODEX_THREAD_ID:'',CLAUDECODE:''};
 function project(name){const p=base+'/'+name;fs.mkdirSync(p);fs.symlinkSync(path.join(ROOT,'node_modules'),p+'/node_modules','dir');return p;}
 const run=(script,args,cwd=base)=>cp.spawnSync(process.execPath,[script,...args],{cwd,env,encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024});
 return {base,bin,env,project,run,remove:()=>fs.rmSync(base,{recursive:true,force:true})};
}
function assertExit(r,expected){expect({status:r.status,error:r.error?.message,stderr:r.stderr,stdout:r.stdout?.slice(-1800)}).toMatchObject({status:expected});}
test.each(['codex','claude-code'])('J-PLUGIN-SETUP: %s verifies target B with spaces, retains install on incomplete readiness and matches direct init',runtime=>{
 const f=isolated();try{
  const a=f.project('ready A'),b=f.project('incomplete B'),direct=f.project('direct');
  f.env.CODEX_THREAD_ID=runtime==='codex'?'12345678-abcd-4321-89ef-123456789abc':'';f.env.CLAUDECODE=runtime==='claude-code'?'1':'';
  let r=f.run(CLI,['init',a,'--runtime','auto']);assertExit(r,0);
  // The explicit host action must also win over contradictory current hints.
  f.env.CODEX_THREAD_ID=runtime==='claude-code'?'12345678-abcd-4321-89ef-123456789abc':'';f.env.CLAUDECODE=runtime==='codex'?'1':'';
  let text=fs.readFileSync(a+'/CLAUDE.md','utf8').replaceAll('[org/repo-name]','Fixture/project').replaceAll('[GitHub Issues | Jira | Linear | Shortcut | Notion]','GitHub Issues').replaceAll('[gh | jira | linear | sc | MCP]','gh');
  // Use concrete project context; the setup implementation must not edit it for B.
  text=text.replace(/^\*\*Project Board:\*\*.*$/m,'**Project Board:** GitHub Issues').replace(/^\*\*Board CLI:\*\*.*$/m,'**Board CLI:** gh');fs.writeFileSync(a+'/CLAUDE.md',text);
  assertExit(f.run(CLI,['verify','--strict'],a),0);
  const projectName=JSON.parse(fs.readFileSync(a+'/package.json')).name;
  for(const area of ['runs','duo']){const frozen=a+'/.specflow/'+area+'/frozen-package';fs.mkdirSync(frozen,{recursive:true});fs.writeFileSync(frozen+'/package.json',JSON.stringify({name:projectName,version:'0.0.0'}));}
  const generated=f.run(path.join(ROOT,'node_modules/jest/bin/jest.js'),['--runInBand'],a);assertExit(generated,0);expect(generated.stderr).not.toContain('Haste module naming collision');
  r=f.run(host(runtime)+'/scripts/setup.cjs',[b,'--json'],a);assertExit(r,1);const result=JSON.parse(r.stdout);
  expect(result.installation).toMatchObject({target:fs.realpathSync(b),status:'installed',exitCode:0});expect(result.readiness).toMatchObject({target:fs.realpathSync(b),status:'incomplete',exitCode:1});expect(fs.existsSync(b+'/.specflow/install-state.yml')).toBe(true);
  assertExit(f.run(CLI,['init',direct,'--runtime',runtime]),0);
  for(const file of ['adapter-routing.yml','install-state.yml'])expect(fs.readFileSync(b+'/.specflow/'+file)).toEqual(fs.readFileSync(direct+'/.specflow/'+file));
  const routing=b+'/.specflow/adapter-routing.yml';fs.appendFileSync(routing,'\n# deliberate customization\n');const custom=fs.readFileSync(routing);assertExit(f.run(host(runtime)+'/scripts/setup.cjs',[b,'--json'],a),1);expect(fs.readFileSync(routing)).toEqual(custom);
  expect(fs.existsSync(f.base+'/provider-called')).toBe(false);
 }finally{f.remove();}
},180000);
test.each(['codex','claude-code'])('J-PLUGIN-FAILURE: %s preserves missing CLI detail and performs no repair',runtime=>{
 const f=isolated();try{fs.unlinkSync(f.bin+'/specflow');const isolatedBin=f.base+'/only-node';fs.mkdirSync(isolatedBin);const target=f.project('untouched');const before=fs.readdirSync(target);const r=cp.spawnSync(process.execPath,[host(runtime)+'/scripts/setup.cjs',target],{env:{...f.env,PATH:isolatedBin},encoding:'utf8'});expect(r.status).not.toBe(0);expect(r.stderr).toContain('ENOENT');expect(r.stderr).toContain('specflow setup');expect(fs.readdirSync(target)).toEqual(before);}finally{f.remove();}
});
test.each(['codex','claude-code'])('J-PLUGIN-GATE: %s installed payload accepts good and rejects red, required-skip and forged receipt',runtime=>{
 for(const mode of ['good','red','required-skip','forged']){
  const env=oracleFixture({skipRequired:mode==='required-skip'||mode==='forged'}),f=isolated();try{
   const installed=f.run(CLI,['update',env.root,'--runtime',runtime]);assertExit(installed,0);
   const report=env.root+'/.specflow/gate-d';fs.mkdirSync(report+'/evidence',{recursive:true});fs.writeFileSync(report+'/journey-map.md','- J: J-CLI — isolated value outcome\n');fs.writeFileSync(report+'/findings.md',`## J: J-CLI\nstatus: ${mode==='red'?'red\ndisposition: bug':'green'}\nevidence/result.json\n`);fs.writeFileSync(report+'/evidence/result.json',JSON.stringify({expected:900,actual:mode==='red'?2400:900}));env.accept();
   // A submitted passing receipt cannot cover a required case that actually skips.
   if(mode==='forged'){fs.mkdirSync(env.runDir+'/runtime-evidence',{recursive:true});fs.writeFileSync(env.runDir+'/runtime-evidence/forged.json',JSON.stringify({gate:'pass',executed:3,skipped:0}));fs.writeFileSync(env.runDir+'/verifier-findings.jsonl',JSON.stringify({check_id:'C-correctness',verifier_result:'pass',execution:{result:'pass',summary:{passed:3,skipped:0}}})+'\n');}
   const payload=f.base+'/payload.json';fs.writeFileSync(payload,JSON.stringify({target:env.root,runDir:env.runDir,reportDir:report}));const r=f.run(host(runtime)+'/scripts/gate.cjs',[payload]);assertExit(r,mode==='good'?0:1);const result=JSON.parse(r.stdout);expect(result.report_validity).toBe('valid');expect(result.outcome_acceptance==='passed').toBe(mode==='good');expect(fs.existsSync(f.base+'/provider-called')).toBe(false);
   if(mode==='red')expect(result.errors.join(' ')).toContain('required hop red');
   if(mode==='required-skip'||mode==='forged'){
    const reports=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name==='native-report.json')reports.push(JSON.parse(fs.readFileSync(p)));}}walk(env.runDir+'/runtime-evidence');
    expect(reports.length).toBeGreaterThan(0);expect(reports.some(r=>r.testResults.some(s=>s.assertionResults.some(c=>c.fullName==='C-values'&&c.status==='pending')))).toBe(true);expect(result.obligations).toContainEqual(expect.objectContaining({id:'O-values',status:'blocked'}));
   }
   expect(fs.readFileSync(env.root+'/scripts/teardown-gate.cjs')).toEqual(fs.readFileSync(ROOT+'/scripts/teardown-gate.cjs'));
  }finally{env.remove();f.remove();}
 }
},180000);
test('INSTALL001..003: manifest, contract and public-adapter boundaries remain executable',()=>{
 const yaml=require('js-yaml'),contract=yaml.load(fs.readFileSync(ROOT+'/docs/contracts/feature_install_ux.yml','utf8'));
 expect(contract.invariants.map(x=>x.id)).toEqual(['I-INSTALL-001','I-INSTALL-002','I-INSTALL-003']);expect(contract.capability_boundary.gate_payload).toEqual(['target','runDir','reportDir']);
 for(const runtime of ['codex','claude-code']){
  const root=host(runtime),manifest=JSON.parse(fs.readFileSync(root+(runtime==='codex'?'/plugin.json':'/.claude-plugin/plugin.json')));
  expect(manifest).toMatchObject({name:'specflow',version:require(ROOT+'/package.json').version});
  const setup=fs.readFileSync(root+'/scripts/setup.cjs','utf8');expect(setup).toContain("spawnSync('specflow'");expect(setup).toContain(`'--runtime','${runtime}'`);expect(setup).not.toMatch(/runtime-routing|duo-runtime|copyFile|writeFile|createHash/);
  for(const skill of ['setup','accept-gate-d'])expect(fs.readFileSync(root+'/skills/'+skill+'/SKILL.md','utf8')).toContain('name: '+skill);
 }
});
test.each(['codex','claude-code'])('J-PLUGIN-FAILURE: %s cannot override its literal host assignment',runtime=>{
 const f=isolated();try{const target=f.project('untouched');const r=f.run(host(runtime)+'/scripts/setup.cjs',[target,'--runtime',runtime==='codex'?'claude-code':'codex']);expect(r.status).toBe(1);expect(fs.existsSync(target+'/.specflow')).toBe(false);}finally{f.remove();}
});
test.each(['codex','claude-code'])('J-PLUGIN-FAILURE: %s propagates executed CLI failure detail without private repair',runtime=>{
 const f=isolated();try{fs.writeFileSync(f.bin+'/specflow','#!/bin/sh\necho core-specific-failure >&2\nexit 23\n',{mode:0o700});const target=f.project('untouched');const r=f.run(host(runtime)+'/scripts/setup.cjs',[target]);expect(r.status).toBe(23);expect(r.stderr).toContain('core-specific-failure');expect(fs.existsSync(target+'/.specflow')).toBe(false);}finally{f.remove();}
});
