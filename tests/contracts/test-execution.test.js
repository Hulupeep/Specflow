const runner=require('../../scripts/specflow-runner.cjs');
const {fixture}=require('../helpers/native-execution');
let env;
afterEach(()=>env?.remove());
test('TE001: a real native required skip cannot pass the existing runtime gate despite exit zero',()=>{
 env=fixture({requiredSkip:true});env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node',makerClaim:'complete'});
 expect(result.gate).toBe('blocked');
 expect(JSON.stringify(result)).toContain('C-required-persist');
});

test('TE002/003: genuine owning CLI execution passes with current native case and durable artifacts',()=>{
 env=fixture();env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).toBe('pass');
 const receipt=result.findings[0].execution;
 expect(receipt).toMatchObject({executable:true,result:'pass',exit_code:0,verification_level:'process',summary:{collected:1,passed:1,skipped:0}});
 expect(receipt.cases[0].id).toBe('cli.test.js::C-CLI-transform');
 const fs=require('fs');expect(fs.existsSync(receipt.evidence_path)).toBe(true);expect(fs.existsSync(receipt.artifacts.report.path)).toBe(true);
 expect(result.findings[0].evidence_kind).toBe('native-jest');
});
test('TE005: accepted optional skip stays skipped while required CLI behaviour passes',()=>{
 env=fixture({optionalSkip:true});env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).toBe('pass');
 expect(result.findings[0].execution).toMatchObject({summary:{passed:1,skipped:1},cases:[{status:'passed'},{status:'skipped'}]});
});
test('TE001: actual failed CLI assertion fails rather than accepting native report presence',()=>{
 env=fixture({broken:true});env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).toBe('fail');expect(result.findings[0].execution.summary.failed).toBe(1);
});
test('TE004: submitted JSON and process-only success cannot qualify as owning execution',()=>{
 env=fixture();env.accept();
 const options={root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'};
 expect(runner.runVerifierStage({...options,runner:()=>({executable:true,result:'pass',cases:[{id:'cli.test.js::C-CLI-transform',status:'passed'}]})})).toMatchObject({gate:'blocked',reason:expect.stringContaining('owning native execution')});
 delete env.check.execution;env.accept();
 expect(runner.runVerifierStage(options)).toMatchObject({gate:'blocked',reason:expect.stringContaining('adapter')});
});
test('TE004: a reconstructed genuine receipt is historical JSON, not a fresh owning invocation',()=>{
 const executor=require('../../scripts/test-execution.cjs');env=fixture();const accepted=env.accept().contract;
 const options={root:env.root,runDir:env.runDir,configurationId:'local',environment:'isolated-node',verificationContract:accepted};
 const actual=executor.execute(env.check,options);
 expect(executor.owns(actual,env.check,accepted,options)).toBe(true);
 expect(executor.owns(JSON.parse(JSON.stringify(actual)),env.check,accepted,options)).toBe(false);
});
test('TE003: source/input mutation during a passing native attempt makes it stale',()=>{
 env=fixture({mutate:true});env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).toBe('blocked');expect(result.reason).toContain('stale');
});
test('TE001: actual exit-zero zero collection is blocked with its own reason',()=>{
 env=fixture();env.check.execution.args=['--testPathIgnorePatterns','cli.test.js','--passWithNoTests'];env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).toBe('blocked');expect(result.reason).toContain('zero_collected');
});
test('TE004: an ignored maker command cannot replace the native adapter invocation',()=>{
 env=fixture();env.check.command='node -e "console.log(JSON.stringify({pass:true}))"';env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).toBe('pass');expect(result.findings[0].execution.command[1]).toContain('jest');
});
test('TE001/005: native inventory rejects missing, duplicate, skipped, unmapped and unknown outcomes',()=>{
 const executor=require('../../scripts/test-execution.cjs'),root='/fixture',inventory={required_case_ids:['x.test.js::required'],optional_case_ids:['x.test.js::optional']};
 const report=(rows)=>({success:true,numTotalTests:rows.length,numPassedTests:rows.filter(c=>c.status==='passed').length,numFailedTests:rows.filter(c=>c.status==='failed').length,numPendingTests:rows.filter(c=>c.status==='pending').length,numTodoTests:0,testResults:[{name:root+'/x.test.js',assertionResults:rows}]});
 const run=rows=>executor.reconcile(executor.parse(report(rows),'jest',root),inventory);
 expect(run([{fullName:'required',status:'passed'},{fullName:'optional',status:'pending'}])).toMatchObject({result:'pass',summary:{passed:1,skipped:1}});
 for(const rows of [[],[{fullName:'required',status:'pending'}],[{fullName:'required',status:'future'}],[{fullName:'different',status:'passed'}],[{fullName:'required',status:'passed'},{fullName:'required',status:'passed'}]])expect(run(rows).result).toBe('blocked');
 expect(executor.parse({pass:true},'jest',root).errors.length).toBeGreaterThan(0);
});
test('TE002: native report labels cannot upgrade the accepted verification level',()=>{
 const executor=require('../../scripts/test-execution.cjs');env=fixture();const report={kind:'integration',success:true,numTotalTests:1,numPassedTests:1,numFailedTests:0,numPendingTests:0,numTodoTests:0,testResults:[{name:env.root+'/cli.test.js',assertionResults:[{fullName:'C-CLI-transform',status:'passed'}]}]};
 expect(executor.parse(report,'jest',env.root).cases[0]).not.toHaveProperty('kind');
 env.check.verification_level='unit';const accepted=env.accept().contract,receipt=executor.execute(env.check,{root:env.root,runDir:env.runDir,verificationContract:accepted,configurationId:'local',environment:'isolated-node'});
 expect(receipt.verification_level).toBe('unit');
});
test.each(['--listTests','--list','--watch','--reporter=json','--outputFile=old.json','--reporter-only-failures','--updateSnapshot'])('TE004: %s cannot bypass actual execution or owning output',arg=>{
 env=fixture();env.check.execution.args=[arg];expect(require('../../scripts/test-execution.cjs').validate(env.check).ok).toBe(false);
});

test('TE002/003: actual Playwright native reporter can verify a CLI process without browser syntax or a browser binary',()=>{
 const fs=require('fs');env=fixture();
 fs.writeFileSync(env.root+'/playwright.config.cjs',"module.exports={testDir:__dirname,testMatch:'cli.pw.spec.js',workers:1};");
 fs.writeFileSync(env.root+'/cli.pw.spec.js',"const{test,expect}=require('@playwright/test');const cp=require('child_process');test('C-CLI-transform',()=>{const r=cp.spawnSync(process.execPath,[__dirname+'/transform.cjs',__dirname+'/input.txt'],{encoding:'utf8'});expect(r.status).toBe(0);expect(r.stdout).toBe('HELLO\\n')});");
 env.check.execution={adapter:'playwright',test_files:['cli.pw.spec.js'],required_case_ids:['default::cli.pw.spec.js::C-CLI-transform'],optional_case_ids:[],args:[]};
 env.check.checker_paths=['cli.pw.spec.js','playwright.config.cjs'];env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 if(result.gate!=='pass'){const receipt=result.findings[0].execution;const detail={gate:result.gate,reason:result.reason,receipt:receipt||null,native_errors:receipt?JSON.parse(fs.readFileSync(receipt.artifacts.report.path,'utf8')).errors:null};fs.writeFileSync(require('path').resolve(__dirname,'../../.specflow/specification/execution/playwright-test-failure.json'),JSON.stringify(detail,null,2));throw Error(JSON.stringify({gate:result.gate,reason:result.reason,native_errors:detail.native_errors}));}
expect(result.findings[0].execution).toMatchObject({framework:{name:'@playwright/test'},verification_level:'process',summary:{passed:1,skipped:0}});
});
test.each(['missing','corrupt','symlink'])('TE004: %s native report fails closed even when the OS boundary returns zero',kind=>{
 // Negative OS-boundary injection only; native positives above run real frameworks.
 const fs=require('fs'),cp=require('child_process'),original=cp.spawnSync;env=fixture();env.accept();
 const spy=jest.spyOn(cp,'spawnSync').mockImplementation((exe,args,options)=>{
  if(exe===process.execPath){const p=options.env.PLAYWRIGHT_JSON_OUTPUT_FILE;
   if(kind==='corrupt')fs.writeFileSync(p,'{bad JSON');
   if(kind==='symlink')fs.symlinkSync(env.root+'/expected.txt',p);
   return{status:0,stdout:'maker claims pass',stderr:''};
  }
  return original(exe,args,options);
 });
 try{const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});expect(result.gate).toBe('blocked');expect(result.reason).toContain('native_report_missing_or_corrupt');}finally{spy.mockRestore();}
});

test('TE004/005: even a genuine older in-process receipt cannot satisfy a new owning invocation',()=>{
 const executor=require('../../scripts/test-execution.cjs');env=fixture();const accepted=env.accept().contract;
 const options={root:env.root,runDir:env.runDir,verificationContract:accepted,configurationId:'local',environment:'isolated-node'};
 const previous=executor.execute(env.check,options);expect(previous.result).toBe('pass');
 const result=runner.runVerifierStage({...options,sliceTags:['integration'],runner:()=>previous});
 expect(result.gate).toBe('blocked');expect(result.reason).toContain('owning native execution');
});

test('TE003/004: durable native report/log edits invalidate the owning receipt',()=>{
 const fs=require('fs'),executor=require('../../scripts/test-execution.cjs');env=fixture();const accepted=env.accept().contract;
 const options={root:env.root,runDir:env.runDir,verificationContract:accepted,configurationId:'local',environment:'isolated-node'};
 const receipt=executor.execute(env.check,options);expect(executor.owns(receipt,env.check,accepted,options)).toBe(true);
 fs.appendFileSync(receipt.artifacts.stdout.path,'edited after execution');expect(executor.owns(receipt,env.check,accepted,options)).toBe(false);
});

test('TE003/006: current owning execution satisfies parent check metadata without granting final parent acceptance',()=>{
 const fs=require('fs'),crypto=require('crypto');env=fixture();
 env.contract.outcome_contract={version:1,goal:'Transform exact fixture',configurations:[{id:'local',environment:'isolated-node'}],assumptions:[],unknowns:[],non_goals:[],obligations:[{id:'O-CLI',required:true,oracle:{path:'expected.txt',sha256:crypto.createHash('sha256').update(fs.readFileSync(env.root+'/expected.txt')).digest('hex')},check_ids:['C-workflow'],level:'process',configuration_ids:['local']}]};env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['cli'],requiredMode:'never',configurationId:'local',environment:'isolated-node'});
 expect(result).toMatchObject({gate:'pass',parent_outcome:{status:'unverified',obligations:[{id:'O-CLI',status:'passed'}]}});
 expect(runner.verifierTrace({runDir:env.runDir,root:env.root}).parent_outcome).toMatchObject({status:'unverified',binding_status:'current',obligations:[{status:'passed'}]});
 fs.appendFileSync(env.root+'/input.txt',' changed');
 expect(runner.verifierTrace({runDir:env.runDir,root:env.root}).parent_outcome).toMatchObject({binding_status:'stale',obligations:[{status:'stale'}]});
});
test('TE003/004: a later check cannot silently invalidate an earlier ignored input and leave a green combined attempt',()=>{
 const fs=require('fs');env=fixture();fs.appendFileSync(env.root+'/.gitignore','ignored-input.txt\n');fs.writeFileSync(env.root+'/ignored-input.txt','A');env.check.input_paths.push('ignored-input.txt');
 const other={...JSON.parse(JSON.stringify(env.check)),id:'C-second',input_paths:['input.txt']};env.contract.runtime_checks.push(other);env.accept();
 const executor=require('../../scripts/test-execution.cjs');
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node',runner:(check,options)=>{
  const receipt=executor.execute(check,options);if(check.id==='C-second')fs.writeFileSync(env.root+'/ignored-input.txt','B');return receipt;
 }});
 expect(result.gate).toBe('blocked');expect(result.findings[0]).toMatchObject({verifier_result:'blocked',reason:expect.stringContaining('stale owning receipt')});
});
test('TE004: latest verifier rejection during execution prevents acceptance despite a real passing native case',()=>{
 env=fixture();env.accept();const executor=require('../../scripts/test-execution.cjs');
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node',runner:(check,options)=>{
  const receipt=executor.execute(check,options);runner.decideVerification({runDir:env.runDir,decision:'reject',missingCheck:'additional required parent case'});return receipt;
 }});
 expect(result.gate).toBe('blocked');expect(result.reason).toContain('rejected during execution');
});

test('TE006: existing CLI owns a fresh verification run and gives a safe rerun command',()=>{
 const cp=require('child_process'),path=require('path');env=fixture();env.accept();
 const result=cp.spawnSync(process.execPath,[path.resolve(__dirname,'../../bin/specflow.js'),'run','verify','--run-dir',env.runDir,'--configuration-id','local','--environment','isolated-node'],{cwd:env.root,encoding:'utf8',timeout:30000});
 expect({exit:result.status,stderr:result.stderr,stdout:result.stdout.slice(0,1200)}).toMatchObject({exit:0});
 const report=JSON.parse(result.stdout);expect(report.gate).toBe('pass');expect(report.next_command).toContain("'verify'");expect(report.next_command).not.toContain('native-report.json');
});

test('TE001/005: accepted native retries remain visible and expected-failure annotations cannot create a passing case',()=>{
 const executor=require('../../scripts/test-execution.cjs'),root='/fixture',id='default::x.spec.js::case';
 const report={config:{rootDir:root},errors:[],stats:{expected:0,unexpected:0,flaky:1,skipped:0},suites:[{file:'x.spec.js',title:'x.spec.js',specs:[{file:'x.spec.js',title:'case',tests:[{projectName:'',expectedStatus:'passed',status:'flaky',results:[{status:'failed'},{status:'passed'}]}]}]}]};
 const result=executor.reconcile(executor.parse(report,'playwright',root),{required_case_ids:[id],optional_case_ids:[]});
 expect(result).toMatchObject({result:'pass',summary:{passed:1,flaky:1},cases:[{native_status:'flaky',attempt_statuses:['failed','passed']}]});
 const native=report.suites[0].specs[0].tests[0];native.expectedStatus='failed';native.status='expected';native.results=[{status:'failed'}];report.stats={expected:1,unexpected:0,flaky:0,skipped:0};
 expect(executor.reconcile(executor.parse(report,'playwright',root),{required_case_ids:[id],optional_case_ids:[]}).result).toBe('fail');
});
test('TE004: CI wiring allocates a fresh report and invokes the native framework directly',()=>{
 const fs=require('fs'),path=require('path'),yaml=require('js-yaml');const workflow=yaml.load(fs.readFileSync(path.resolve(__dirname,'../../.github/workflows/canonical-tests.yml'),'utf8'));
 const steps=workflow.jobs['canonical-tests'].steps;
 expect(steps.find(s=>s.name==='Allocate fresh native report').run).toContain('mktemp -d');
 expect(steps.find(s=>s.name==='Execute canonical suites').run).toContain('node node_modules/jest/bin/jest.js');
 expect(steps.find(s=>s.name==='Execute canonical suites').run).toContain('$SPECFLOW_CANONICAL_REPORT');
 expect(steps.find(s=>s.name==='Reconcile native case results').run).toContain('test-execution.cjs validate-report');
});
test('TE005 (#263): fresh required skip is current/blocked; a later input change is stale',()=>{
 env=fixture({requiredSkip:true});env.accept();const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(runner.revalidateVerifierStage(result)).toMatchObject({status:'current',gate:'blocked',reason:expect.stringContaining('required_case_skipped')});
 require('fs').appendFileSync(env.root+'/input.txt','changed after current blocked result');expect(runner.revalidateVerifierStage(result)).toMatchObject({status:'stale',gate:'blocked'});
});

test('TE recovery: native signal termination is structured process evidence',()=>{
 const fs=require('fs'),path=require('path');env=fixture();
 fs.writeFileSync(path.join(env.root,'cli.test.js'),"test('C-CLI-transform',()=>{process.kill(process.pid,'SIGTERM')});");env.accept();
 const result=runner.runVerifierStage({root:env.root,runDir:env.runDir,sliceTags:['integration'],configurationId:'local',environment:'isolated-node'});
 expect(result.gate).not.toBe('pass');
 expect(result.findings[0].execution).toMatchObject({terminated:true,process_signal:'SIGTERM',process_error:null});
});
