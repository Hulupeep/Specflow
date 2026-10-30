'use strict';
// Private-session harness only, not live qualification. The loaded source is
// unchanged; the test copy exposes registration and replaces input admission.
// Production exports never acquire a session-registration or guard bypass API.
const fs=require('fs'),os=require('os'),path=require('path'),crypto=require('crypto'),Module=require('module');
const worker=require('../../scripts/improve-worker.cjs');
const {canonical}=require('../../scripts/improve-production-build.cjs');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
let root,runtime,cap,context,state,inspections;
beforeEach(()=>{
 root=fs.mkdtempSync(path.join(os.tmpdir(),'backend-inspection-'));
 const filename=require.resolve('../../scripts/improve-backend-runtime.cjs'),copy=new Module(filename,module);
 copy.filename=filename;copy.paths=Module._nodeModulePaths(path.dirname(filename));
 copy.require=id=>require(Module._resolveFilename(id,copy));
 copy._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.registerTestSession=s=>{const cap=Object.freeze({});sessionData.set(cap,s);return cap;};readInputs=()=>{};',filename);
 runtime=copy.exports;context={runId:'fixture'};inspections=0;
 const software=path.join(root,'software');fs.mkdirSync(software);
 fs.writeFileSync(path.join(software,'package.json'),JSON.stringify({name:'@playwright/test',version:'fixture',bin:{playwright:'cli.js'}}));
 fs.writeFileSync(path.join(software,'cli.js'),'// fixture executable');
 const layer={files:[],directories:[{source:software,destination:'/deps/node_modules/@playwright/test',roles:['checker'],sha256:worker.manifestTree(software).sha256}]};
 fs.writeFileSync(path.join(root,'journal.json'),JSON.stringify({phase:'execution',phaseDeadlineEpochMs:Date.now()+120000}));
 const measurement={state:'fixture'};fs.writeFileSync(path.join(root,'entry-manifest.json'),canonical(measurement));
 state={coreBinding:context,journalRoot:root,root,request:{},admitted:{manifest:{}},measurement,anchorId:'fixture-anchor',worker:{layer,inspectProduction:()=>{inspections++;}},serverKey:'fixture.header.signature'};
 cap=runtime.registerTestSession(state);
});
afterEach(()=>fs.rmSync(root,{recursive:true,force:true}));
test('framework metadata verifies current software without inspecting unrelated product capsules',()=>{
 expect(runtime.backendNativeFramework(cap,context)).toMatchObject({name:'@playwright/test',version:'fixture'});
 expect(inspections).toBe(0);
 fs.appendFileSync(path.join(root,'software/cli.js'),'changed');
 expect(()=>runtime.backendNativeFramework(cap,context)).toThrow('runtime_input_changed');
});
test.each(['expired','cause','wrong-context','forged-capability'])('framework metadata retains session authority: %s',kind=>{
 if(kind==='expired')fs.writeFileSync(path.join(root,'journal.json'),JSON.stringify({phase:'execution',phaseDeadlineEpochMs:Date.now()-1}));
 if(kind==='cause')fs.writeFileSync(path.join(root,'journal.json'),JSON.stringify({phase:'execution',phaseDeadlineEpochMs:Date.now()+120000,cause:'backend_service_died'}));
 expect(()=>runtime.backendNativeFramework(kind==='forged-capability'?{}:cap,kind==='wrong-context'?{runId:'other'}:context)).toThrow(/backend_/);
});
test('native execution cannot dispatch when the full product guard rejects',()=>{
 state.worker.inspectProduction=()=>{inspections++;throw Error('product_changed');};
 expect(()=>runtime.backendNativeLaunch(cap,context,{})).toThrow('product_changed');
 expect(inspections).toBe(1);
});
test('native execution cannot return success when the post-execution full product guard rejects',()=>{
 const check={checker_paths:[],input_paths:[],rule_paths:[]},options={oracleRoot:root,frozenFiles:{}},dir=path.join(root,'attempt-fixture');fs.mkdirSync(dir);
 state.checker='checker';state.oracle={root,stage:root,frozenFiles:{},checks:[hash(canonical(check))]};
 let executions=0;
 Object.assign(state.worker,{containers:new Set(),exec:()=>{executions++;return {status:0,stdout:'',stderr:''};},pause:()=>{},capture:()=>{},inspectProduction:()=>{inspections++;if(inspections===2)throw Error('product_changed');}});
 expect(()=>runtime.backendNativeLaunch(cap,context,{check,options,dir,args:[],env:{}})).toThrow('product_changed');
 expect(executions).toBe(2);expect(inspections).toBe(2);
});
test('final continuity retains full product inspection before supervisor exchange',async()=>{
 state.worker.inspectProduction=()=>{inspections++;throw Error('product_changed');};
 await expect(runtime.backendContinuity(cap,context)).rejects.toThrow('product_changed');
 expect(inspections).toBe(1);
});
test('server startup still rejects changed product through continuity before credential delivery',async()=>{
 state.worker.inspectProduction=()=>{inspections++;throw Error('product_changed');};
 await expect(runtime.startBackendServer(cap,context)).rejects.toThrow('product_changed');
 expect(inspections).toBe(1);expect(state.server).toBeUndefined();
});
