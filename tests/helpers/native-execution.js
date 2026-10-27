// Real native framework fixtures; synthetic CLI data, never product/backend proof.
const fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process');
const runner=require('../../scripts/specflow-runner.cjs');
const quote=value=>"'"+value.replace(/'/g,"'\\''")+"'";
function fixture(options={}) {
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'specflow native-'));
 fs.writeFileSync(path.join(root,'.gitignore'),'node_modules/\n.specflow/\n');
 fs.symlinkSync(path.resolve(__dirname,'../../node_modules'),path.join(root,'node_modules'),'dir');
 fs.writeFileSync(path.join(root,'input.txt'),'hello\n');fs.writeFileSync(path.join(root,'expected.txt'),'HELLO\n');
 fs.writeFileSync(path.join(root,'transform.cjs'),`process.stdout.write(require('fs').readFileSync(process.argv[2],'utf8').${options.broken?'toLowerCase':'toUpperCase'}());`);
 fs.writeFileSync(path.join(root,'jest.config.cjs'),"module.exports={rootDir:__dirname,testEnvironment:'node',testMatch:['**/cli.test.js']};");
 const skipped=options.requiredSkip?"test.skip('C-required-persist',()=>{throw Error('required case not exercised')});":'';
 const optional=options.optionalSkip?"test.skip('C-optional',()=>{});":'';
 fs.writeFileSync(path.join(root,'cli.test.js'),`const cp=require('child_process'),fs=require('fs');test('C-CLI-transform',()=>{const r=cp.spawnSync(process.execPath,[__dirname+'/transform.cjs',__dirname+'/input.txt'],{encoding:'utf8'});expect(r.status).toBe(0);expect(r.stdout).toBe('HELLO\\n');${options.mutate?"fs.appendFileSync(__dirname+'/input.txt','changed during test');":''}});${skipped}${optional}`);
 const git=(...args)=>cp.execFileSync('git',args,{cwd:root,stdio:'pipe'});
 git('init','-q');git('add','.');git('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','native fixture');
 const runDir=path.join(root,'.specflow/runs/native');fs.mkdirSync(runDir,{recursive:true});
 const command=[process.execPath,path.resolve(__dirname,'../../node_modules/jest/bin/jest.js'),'--config',path.join(root,'jest.config.cjs'),'--runInBand','--json','--outputFile',path.join(runDir,'legacy-report.json')].map(quote).join(' ');
 const check={id:'C-workflow',type:'custom-script',required:true,command,verification_level:'process',boundaries:['process','filesystem'],configuration_ids:['local'],checker_paths:['cli.test.js'],input_paths:['input.txt'],rule_paths:[],execution:{adapter:'jest',test_files:['cli.test.js'],required_case_ids:['cli.test.js::C-CLI-transform',...(options.requiredSkip?['cli.test.js::C-required-persist']:[])],optional_case_ids:options.optionalSkip?['cli.test.js::C-optional']:[],args:[]}};
 const contract={journey_id:'J-CLI',maker_policy_id:'maker',verifier_policy_id:'independent-verifier',runtime_checks:[check],forbidden_evidence:['exit0 as behavioural proof']};
 function accept() {runner.writeVerificationProposal({runDir,journeyId:'J-CLI',runtimeChecks:contract.runtime_checks});return runner.decideVerification({runDir,root,decision:'accept',verificationContract:contract});}
 return {root,runDir,check,contract,accept,remove:()=>fs.rmSync(root,{recursive:true,force:true})};
}
module.exports={fixture};
