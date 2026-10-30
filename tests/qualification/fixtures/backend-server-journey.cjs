'use strict';
// Actual checked-in journey through the canonical frozen native adapter.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),assert=require('node:assert/strict');
const native=require('../../../scripts/test-execution.cjs'),runtime=require('../../../scripts/improve-backend-runtime.cjs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function runServerJourney({root,session,context,anonKey,serverKey,staticRoot}){
 const productRoot=path.join(root,'native-binding'),oracleRoot=path.join(root,'browser-oracle');
 fs.mkdirSync(productRoot,{mode:0o700});fs.mkdirSync(oracleRoot,{mode:0o700});
 // This Git fixture owns adapter metadata only. The server uses the separately
 // bound real product source, dependency, build and output receipts.
 const git=args=>cp.execFileSync('git',args,{cwd:productRoot,stdio:'pipe'});
 git(['init','-q','-b','main']);fs.writeFileSync(path.join(productRoot,'README.md'),'Native verifier metadata; not product source.');git(['add','.']);git(['-c','user.name=Qualification','-c','user.email=qualification@example.invalid','commit','-qm','Initialize verifier metadata']);
 const file='tests/e2e/journey_confined_backend.spec.cjs';
 const files={
  [file]:fs.readFileSync(path.resolve(__dirname,'../../e2e/journey_confined_backend.spec.cjs')),
  'playwright.config.cjs':Buffer.from("module.exports={testDir:__dirname,testMatch:'**/journey_confined_backend.spec.cjs',workers:1,retries:0,timeout:45000,use:{launchOptions:{executablePath:process.env.SPECFLOW_BROWSER_EXECUTABLE,args:['--no-sandbox']}}};"),
  'inputs/public.json':Buffer.from(JSON.stringify({url:'http://127.0.0.1:54321',anonKey}))
 };
 for(const [name,bytes]of Object.entries(files)){const target=path.join(oracleRoot,name);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,bytes,{mode:0o600});}
 const frozenFiles=Object.fromEntries(Object.entries(files).map(([name,bytes])=>[name,hash(bytes)]));
 const check={id:'J-CONFINED-HEYSTAX-BACKEND',required:true,verification_level:'journey',boundaries:['process','network','database','browser'],configuration_ids:['confined'],timeout_seconds:100,
  checker_paths:[file,'playwright.config.cjs'],input_paths:['inputs/public.json'],rule_paths:[],execution:{adapter:'playwright',test_files:[file],required_case_ids:[1280,360].map(width=>'default::'+file+'::J-BACKEND-PRODUCT-'+width+': real login save reload and wrong-user RLS rejection'),optional_case_ids:[],args:['--config','playwright.config.cjs']}};
 runtime.prepareBackendChecks(session,context,{oracleRoot,frozenFiles,checks:[check]});
 const options={root:productRoot,oracleRoot,runDir:path.join(root,'browser-evidence'),verificationContract:{check},configurationId:'confined',environment:'confined-backend',env:{BASE_URL:'http://127.0.0.1:3000'},frozenFiles,backendSession:session,backendContext:context};
 const receipt=native.executeFrozen(check,options);fs.writeFileSync(path.join(root,'browser-result.json'),JSON.stringify(receipt),{mode:0o600});
 // Print only native accounting and safe enumerated state; retain raw diagnostics privately.
 console.log(JSON.stringify({scope:'Actual checked-in desktop/mobile journey through admitted backend and canonical native adapter',result:receipt.result,summary:receipt.summary,reason:receipt.reason||null}));
 assert(native.ownsFrozen(receipt,check,options.verificationContract,options),'native_receipt_not_owned');
 assert.equal(receipt.result,'pass','actual_product_journey_failed');assert.equal(receipt.summary.passed,2);assert.equal(receipt.summary.skipped,0);
 const scanner=require('../../../scripts/improve-backend-server.cjs');
 const artifacts=scanner.scanArtifacts(path.join(root,'browser-evidence'),serverKey),browserAssets=scanner.scanArtifacts(staticRoot,serverKey);
 assert(artifacts.files>0&&browserAssets.files>0);console.log(JSON.stringify({scope:'Raw server key, base64 and unique JWT payload/signature canary scan',artifacts,browserAssets}));
 await runtime.backendContinuity(session,context);
 return receipt.summary;
}
module.exports={runServerJourney};
