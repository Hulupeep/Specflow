// Real native subprocesses on synthetic CLI data; not customer/backend qualification.
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto');
const native=require('../../scripts/test-execution.cjs'),{fixture}=require('../helpers/native-execution');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
let product,oracle;
afterEach(()=>{product?.remove();if(oracle)fs.rmSync(oracle,{recursive:true,force:true});});
function setup(kind='pass',adapter='jest') {
 product=fixture();oracle=fs.mkdtempSync(path.join(os.tmpdir(),'private oracle-'));
 fs.mkdirSync(path.join(oracle,'holdout'));fs.symlinkSync(path.resolve(__dirname,'../../node_modules'),path.join(oracle,'node_modules'),'dir');
 const file=adapter==='jest'?'holdout/native.test.js':'holdout/native.spec.js',config=adapter==='jest'?'holdout/jest.config.cjs':'holdout/playwright.config.cjs';
 fs.writeFileSync(path.join(oracle,config),adapter==='jest'?"module.exports={rootDir:require('path').resolve(__dirname,'..'),testMatch:['**/native.test.js'],testEnvironment:'node'};":"module.exports={testDir:require('path').resolve(__dirname,'..'),testMatch:'**/native.spec.js',workers:1};");
 const prefix=adapter==='playwright'?"const{test,expect}=require('@playwright/test');":'';
 let body="const fs=require('fs');test('required',()=>{expect(fs.readFileSync(process.env.IMPROVE_WORKSPACE+'/expected.txt','utf8')).toBe('HELLO\\n');expect(process.env.NATIVE_SECRET_TOKEN).toBeUndefined();"+(kind==='mutate'?"fs.appendFileSync(__filename,'// changed');":'')+(kind==='failed'?"expect(false).toBe(true);":'')+"});";
 if(kind==='missing-report')body="process.exit(0);";
 if(kind==='skipped')body="test.skip('required',()=>{});";
 if(kind==='missing')body="test('different',()=>{});";
 if(kind==='duplicate')body="test('required',()=>{});test('required',()=>{});";
 if(kind==='zero')body="test('filtered',()=>{});";
 if(kind==='optional')body+="test.skip('optional',()=>{});";
 fs.writeFileSync(path.join(oracle,file),prefix+body);
 const id=(name)=>(adapter==='playwright'?'default::':'')+file+'::'+name;
 const check={id:'NATIVE',required:true,verification_level:'process',boundaries:['process','filesystem'],configuration_ids:['local'],checker_paths:[file,config],input_paths:[],rule_paths:[],execution:{adapter,test_files:[file],required_case_ids:[id('required')],optional_case_ids:kind==='optional'?[id('optional')]:[],args:['--config',config,...(kind==='zero'?['--testNamePattern','absent']:[])]}};
 const contract={frozen:'fixture',check},options={root:product.root,oracleRoot:oracle,runDir:path.join(oracle,'evidence'),verificationContract:contract,configurationId:'local',environment:'isolated-native',env:{PATH:process.env.PATH,IMPROVE_WORKSPACE:product.root},frozenFiles:Object.fromEntries(check.checker_paths.map(f=>[f,hash(path.join(oracle,f))]))};
 return{check,contract,options};
}
test.each(['jest','playwright'])('NATIVE178: actual %s external frozen oracle issues an owned receipt',adapter=>{
 const {check,contract,options}=setup('pass',adapter),old=process.env.NATIVE_SECRET_TOKEN;process.env.NATIVE_SECRET_TOKEN='private-test-canary';
 try{const receipt=native.executeFrozen(check,options);expect(receipt).toMatchObject({result:'pass',exit_code:0,summary:{collected:1,passed:1,failed:0,skipped:0}});expect(receipt.root).toBe(product.root);expect(receipt.oracle_root).toBe(oracle);expect(native.ownsFrozen(receipt,check,contract,options)).toBe(true);expect(native.owns(receipt,check,contract,options)).toBe(false);expect(native.ownsFrozen(JSON.parse(JSON.stringify(receipt)),check,contract,options)).toBe(false);expect(fs.existsSync(path.join(product.root,'holdout'))).toBe(false);}finally{if(old===undefined)delete process.env.NATIVE_SECRET_TOKEN;else process.env.NATIVE_SECRET_TOKEN=old;}
});
test.each([['failed','fail'],['skipped','blocked'],['missing','blocked'],['duplicate','blocked'],['zero','blocked'],['mutate','blocked']])('NATIVE178: real %s outcome cannot become a pass', (kind,result)=>{
 const {check,options}=setup(kind);const r=native.executeFrozen(check,options);expect(r.result).toBe(result);expect(r.result).not.toBe('pass');expect(fs.existsSync(r.artifacts.report.path)).toBe(true);
});
test('NATIVE178: optional skip remains visible and raw report tampering invalidates ownership',()=>{
 const{check,contract,options}=setup('optional'),r=native.executeFrozen(check,options);expect(r).toMatchObject({result:'pass',summary:{passed:1,skipped:1}});expect(native.ownsFrozen(r,check,contract,options)).toBe(true);fs.appendFileSync(r.artifacts.report.path,' ');expect(native.ownsFrozen(r,check,contract,options)).toBe(false);
});
test.each(['inside','symlink','unfrozen','correctness','competing-command'])('NATIVE178: %s oracle configuration fails closed',kind=>{
 const{check,options}=setup();if(kind==='inside')options.oracleRoot=product.root;if(kind==='symlink'){const f=path.join(oracle,check.execution.test_files[0]);fs.renameSync(f,f+'.real');fs.symlinkSync(f+'.real',f);}if(kind==='unfrozen')options.frozenFiles={};if(kind==='correctness')check.execution.claim_kind='correctness';if(kind==='competing-command')check.command=['node','-e','process.exit(0)'];expect(native.executeFrozen(check,options)).toMatchObject({executable:false,result:'blocked'});
});

test('NATIVE178: actual exit-zero process without native report is unavailable',()=>{const{check,options}=setup('missing-report'),r=native.executeFrozen(check,options);expect(r).toMatchObject({result:'blocked',exit_code:0,summary:{collected:0}});expect(r.reason).toContain('native_report_missing_or_corrupt');});

// Backend declarations never fall back to the host native subprocess.
test('BACKEND293: a forged backend session cannot execute the native oracle on the host',()=>{
 const {check,options}=setup('pass','playwright');const marker=path.join(oracle,'host-executed');
 fs.writeFileSync(path.join(oracle,check.execution.test_files[0]),"require('fs').writeFileSync("+JSON.stringify(marker)+",'bad');");
 options.frozenFiles[check.execution.test_files[0]]=hash(path.join(oracle,check.execution.test_files[0]));
 options.backendSession={ready:true,coreBinding:{}};options.backendContext={runId:'forged'};
 const receipt=native.executeFrozen(check,options);expect(receipt.result).toBe('blocked');expect(receipt.reason).toContain('backend_input_invalid');expect(fs.existsSync(marker)).toBe(false);
});
