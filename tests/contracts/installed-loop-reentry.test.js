const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),crypto=require('crypto'),yaml=require('js-yaml');
const runner=require('../../scripts/specflow-runner.cjs');
let root;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'installed loop 243-'));});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
function installed(){fs.mkdirSync(path.join(root,'QA/loops'),{recursive:true});fs.copyFileSync(path.join(__dirname,'../../templates/QA/loops/spec-build.yaml'),path.join(root,'QA/loops/spec-build.yaml'));}
function contract(){return runner.createRunContract({loop:'spec-build',slug:'installed',goal:'Use installed loop',input:'issue243',contractPath:path.join(root,'run.yml'),ledgerPath:path.join(root,'ledger.jsonl'),repoRoot:root}).run_contract;}
function prompt(c){return runner.materializeStagePrompt(c,{root,promptPath:path.join(root,'prompt.md')}).content;}
function run(args){const r=cp.spawnSync(process.execPath,[path.join(__dirname,'../../bin/specflow.js'),'run','spec-build',...args],{cwd:root,encoding:'utf8',timeout:15000});return{...r,result:r.stdout?JSON.parse(r.stdout):null};}
function setupRouting(){
 const file=path.join(root,'routing.yml');fs.writeFileSync(file,yaml.dump({defaults:{confirm_models:true},policies:{fixture:{adapter_policy:{id:'fixture',provider:'fake',command:'fixture',role:'planner',timeout_seconds:5,max_iterations:1,transcript_path:path.join(root,'transcript.txt'),output_path:path.join(root,'output.txt'),never_without_human:[],fake_stdout:'labelled fake model output; checker plumbing only'}}},routes:{'spec-build.discover':{policy:'fixture'}}}));return file;
}
test('INSTALL-243 new contract resolves installed QA layout and complete YAML stage',()=>{installed();const c=contract();expect(c.path).toBe('QA/loops/spec-build.yaml');expect(fs.existsSync(path.resolve(root,c.path))).toBe(true);expect(prompt(c)).toContain('id: discover');expect(prompt(c)).not.toContain('No YAML stage body found');});
test('INSTALL-243 source-kit local template layout remains supported',()=>{fs.mkdirSync(path.join(root,'templates/QA/loops'),{recursive:true});fs.copyFileSync(path.join(__dirname,'../../templates/QA/loops/spec-build.yaml'),path.join(root,'templates/QA/loops/spec-build.yaml'));const c=contract();expect(c.path).toBe('templates/QA/loops/spec-build.yaml');expect(prompt(c)).toContain('id: discover');});
test('INSTALL-243 legacy missing default resolves installed stage on resume',()=>{installed();const c={...contract(),path:'templates/QA/loops/spec-build.yaml'};expect(runner.loadLoopDefinition(c,{root}).stages[0].id).toBe('discover');});
test('INSTALL-243 absent project copy resolves explicit packaged template',()=>{const c=contract();expect(path.isAbsolute(c.path)).toBe(true);expect(prompt(c)).toContain('id: discover');});
test('INSTALL-243 valid custom loop is preserved and missing custom loop is not silently replaced',()=>{installed();const custom=path.join(root,'custom.yml');fs.writeFileSync(custom,yaml.dump({stages:[{id:'discover',instruction:'CUSTOM ONLY'}]}));const c={...contract(),path:'custom.yml'};expect(prompt(c)).toContain('CUSTOM ONLY');expect(runner.loadLoopDefinition({...c,path:'missing-custom.yml'},{root})).toBeNull();});
test('INSTALL-243 CLI exposes owning re-entry; valid saved evidence advances without a second adapter call',()=>{
 installed();const route=setupRouting(),cpath=path.join(root,'run.yml'),ledger=path.join(root,'ledger.jsonl');
 const first=run(['--slug','installed','--contract',cpath,'--ledger',ledger,'--adapter-routing',route,'--confirm-models']);expect(first.status).toBe(0);expect(first.result.status).toBe('gate_rerun_required');
 expect(first.result.entry.owning_gate_command).toEqual(expect.any(String));expect(first.result.entry.owning_gate_command).toContain('--stage-evidence');
 expect(first.result.entry.owning_gate_argv).toEqual(expect.any(Array));const evidence=first.result.entry.stage_evidence_path;expect(path.isAbsolute(evidence)).toBe(true);
 const artifact=path.join(root,'discovery.md');fs.writeFileSync(artifact,'verified fixture output');const counter=path.join(root,'checks.txt');
 const checker=path.join(root,'checker.cjs');fs.writeFileSync(checker,`require('fs').appendFileSync(${JSON.stringify(counter)},'checked\\n')`);
 fs.writeFileSync(evidence,JSON.stringify({schema_version:1,stage:'discover',artifacts:[{path:artifact,sha256:crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex')}],checks:[{name:'actual checker',command:JSON.stringify(process.execPath)+' '+JSON.stringify(checker)}]}));
 const transcriptStat=fs.statSync(path.join(root,'transcript.txt')),prior=fs.readFileSync(ledger,'utf8');const argv=first.result.entry.owning_gate_argv;
 // A real failed hash gate remains in the same durable history before recovery.
 fs.appendFileSync(artifact,' tampered');const bad=cp.spawnSync(argv[0],argv.slice(1),{cwd:root,encoding:'utf8',timeout:15000});expect(bad.status).toBe(1);expect(JSON.parse(bad.stdout).status).toBe('invalid_stage_evidence');expect(fs.existsSync(counter)).toBe(false);expect(yaml.load(fs.readFileSync(cpath,'utf8')).run_contract.current_stage_or_rail).toBe('discover');fs.writeFileSync(artifact,'verified fixture output');
 const failedHistory=fs.readFileSync(ledger,'utf8');expect(failedHistory.startsWith(prior)).toBe(true);expect(failedHistory).toContain('invalid_stage_evidence');
 const next=cp.spawnSync(argv[0],argv.slice(1),{cwd:root,encoding:'utf8',timeout:15000});expect(next.status).toBe(0);expect(JSON.parse(next.stdout).status).toBe('gate_passed');
 expect(yaml.load(fs.readFileSync(cpath,'utf8')).run_contract).toMatchObject({path:'QA/loops/spec-build.yaml',current_stage_or_rail:'draft',simulation_required:false});
 expect(fs.readFileSync(counter,'utf8')).toBe('checked\n');expect(fs.statSync(path.join(root,'transcript.txt')).mtimeMs).toBe(transcriptStat.mtimeMs);expect(fs.readFileSync(ledger,'utf8').startsWith(prior)).toBe(true);
 expect(fs.readFileSync(ledger,'utf8').startsWith(failedHistory)).toBe(true);expect(runner.readLedger(ledger).filter(e=>e.provider&&e.event!=='model_confirmation')).toHaveLength(1);
});

test('INSTALL-243 explicit owning verifier command remains authoritative',()=>{installed();const route=setupRouting();const r=runner.runLoop({loop:'spec-build',slug:'custom-gate',repoRoot:root,root,contract:path.join(root,'custom-run.yml'),ledger:path.join(root,'custom-ledger.jsonl'),adapterRouting:route,confirmModels:true,owningGateCommand:'node existing-owner-gate.cjs'});expect(r.entry.owning_gate_command).toBe('node existing-owner-gate.cjs');expect(r.entry.owning_gate_argv).toBeUndefined();});
