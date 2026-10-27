'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync}=require('child_process');
const yaml=require('js-yaml'),runner=require('../../scripts/specflow-runner.cjs'),improve=require('../../scripts/specflow-improve.cjs');
const policy=extra=>({id:'test',provider:'claude-print',command:'claude',args:[],timeout_seconds:10,max_iterations:1,transcript_path:'x',output_path:'y',never_without_human:[],...extra});
function spend(){return require('../../scripts/adapter-spend.cjs');}
test('EFFORT-1 every shipped adapter template has no invented dollar ceiling',()=>{
 const policies=[],seen=new WeakSet();
 function visit(value,file){if(!value||typeof value!=='object'||seen.has(value))return;seen.add(value);if(value.adapter_policy)policies.push({file,policy:value.adapter_policy});for(const child of Object.values(value))visit(child,file);}
 function walk(dir){for(const item of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())walk(file);else if(/\.ya?ml$/.test(file))yaml.loadAll(fs.readFileSync(file,'utf8')).forEach(doc=>visit(doc,file));}}
 walk(path.join(__dirname,'../../templates'));expect(policies.length).toBeGreaterThan(0);expect(policies.some(p=>p.file.includes(path.join('templates','improve')))).toBe(true);
 for(const {file,policy} of policies)if(policy.max_budget_usd!==undefined)throw Error(`Shipped default cap in ${path.relative(process.cwd(),file)} (${policy.id}): ${policy.max_budget_usd}`);
});
test.each(['subscription_cli','api','unknown'])('EFFORT-1 ordinary/cheap %s never receives an invented cap',billing=>{
 for(const cost of ['ordinary','low_cost','unknown']){
  const p=policy({billing,cost});
  expect(runner.buildAdapterCommand(p).args).not.toContain('--max-budget-usd');
  expect(spend().resolve(p)).toMatchObject({billing,cost,max_budget_usd:null,enforcement:'none'});
 }
});
test('EFFORT-2 explicit owner ceiling applies to subscription and expensive API routes',()=>{
 for(const billing of ['subscription_cli','api']){
  const p=policy({billing,cost:'expensive',max_budget_usd:0.5});
  const args=runner.buildAdapterCommand(p).args;
  expect(args[args.indexOf('--max-budget-usd')+1]).toBe('0.5');
  expect(spend().resolve(p)).toMatchObject({billing,max_budget_usd:0.5,enforcement:'cli'});
 }
});
test('EFFORT-3 expensive API needs a supported guard; model brand never establishes billing',()=>{
 expect(()=>runner.buildAdapterCommand(policy({billing:'api',cost:'expensive'}))).toThrow(/expensive_api_cap_required/);
 expect(()=>runner.buildAdapterCommand(policy({provider:'codex-exec',billing:'api',cost:'expensive',max_budget_usd:1}))).toThrow(/monetary_guard_unsupported/);
 expect(spend().resolve(policy({model:'opus'}))).toMatchObject({billing:'unknown',cost:'unknown',max_budget_usd:null});
 expect(()=>runner.buildAdapterCommand(policy({billing:'unknown',cost:'expensive'}))).toThrow(/expensive_billing_unknown/);
});
test.each([0,-1,NaN,Infinity,'1',null])('EFFORT-3 invalid explicit monetary limit %s fails before execution',max_budget_usd=>{
 expect(()=>runner.buildAdapterCommand(policy({max_budget_usd}))).toThrow(/invalid_monetary_cap/);
});
test('EFFORT-3 caller flags cannot silently replace a required or explicit policy ceiling',()=>{
 expect(()=>runner.buildAdapterCommand(policy({billing:'api',cost:'expensive',max_budget_usd:1,args:['--max-budget-usd','2']}))).toThrow(/conflicting_monetary_cap/);
 expect(()=>runner.buildAdapterCommand(policy({args:['--max-budget-usd=0']}))).toThrow(/invalid_monetary_cap/);
 expect(()=>runner.buildAdapterCommand(policy({args:['--max-budget-usd','1','--max-budget-usd','1']}))).toThrow(/conflicting_monetary_cap/);
});
test('EFFORT-2 hardened peer receives the same monetary decision without expanded tools',()=>{
 const args=improve.peerArgs({type:'object'},'opus',{billing:'api',cost:'expensive',max_budget_usd:0.5});
 expect(args[args.indexOf('--max-budget-usd')+1]).toBe('0.5');
 expect(args[args.indexOf('--tools')+1]).toBe('Read,Glob,Grep');
 expect(()=>improve.peerArgs({},'opus',{billing:'api',cost:'expensive'})).toThrow(/expensive_api_cap_required/);
});
test('EFFORT-2 actual process observes the planned guard argument and no invented subscription guard',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'spend-argv-'));
 try{
  const file=path.join(dir,'argv.cjs');fs.writeFileSync(file,'console.log(JSON.stringify(process.argv.slice(2)))');
  for(const cap of [undefined,0.25]){
   const planned=runner.buildAdapterCommand(policy({billing:'subscription_cli',cost:'ordinary',...(cap===undefined?{}:{max_budget_usd:cap})}));
   const r=spawnSync(process.execPath,[file,...planned.args],{encoding:'utf8'});
   expect(r.status).toBe(0);const observed=JSON.parse(r.stdout);
   expect(observed.includes('--max-budget-usd')).toBe(cap!==undefined);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});


test('EFFORT-LEGACY-CAP historical policy bytes and explicit owner cap survive new command planning',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'legacy-spend-'));
 try{
  const file=path.join(dir,'old-policy.json'),journal=path.join(dir,'journal.jsonl');
  // Labelled synthetic replay of the pre-classification policy shape, not a native-run claim.
  const bytes=JSON.stringify(policy({max_budget_usd:0.25}));
  const history='{"event":"model_confirmation","max_budget_usd":0.25,"scope":"run"}\n';
  fs.writeFileSync(file,bytes);fs.writeFileSync(journal,history);
  const legacy=runner.normalizeAdapterPolicy(JSON.parse(fs.readFileSync(file)));
  const planned=runner.buildAdapterCommand(legacy);
  expect(planned.args[planned.args.indexOf('--max-budget-usd')+1]).toBe('0.25');
  expect(fs.readFileSync(file,'utf8')).toBe(bytes);expect(fs.readFileSync(journal,'utf8')).toBe(history);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('EFFORT-1 repeated ordinary subscription plans contain no invented monetary/review-count checkpoint',()=>{
 for(let round=0;round<10;round++){
  const args=improve.peerArgs({},'opus',{billing:'subscription_cli',cost:'ordinary'});
  expect(args).not.toContain('--max-budget-usd');expect(args).not.toContain('--max-turns');
  expect(spend().resolve(policy({billing:'subscription_cli',cost:'ordinary'}))).toMatchObject({max_budget_usd:null});
 }
});


test('EFFORT-3 monetary flag cannot be placed after an operator option terminator',()=>{
 expect(()=>runner.buildAdapterCommand(policy({max_budget_usd:1,args:['--']}))).toThrow(/adapter_args_option_terminator/);
});
