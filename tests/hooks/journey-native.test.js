// Real hook/framework/CLI integration. GitHub discovery is a declared fixture;
// this does not claim live GitHub, real product journeys or released installs.
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),yaml=require('js-yaml');
const {fixture}=require('../helpers/native-execution');
const source=path.resolve(__dirname,'../..'),hook=path.join(source,'hooks/run-journey-tests.sh');
let env,bin;
beforeEach(()=>{
 env=fixture();bin=fs.mkdtempSync(path.join(os.tmpdir(),'journey-gh-'));
 fs.writeFileSync(path.join(bin,'gh'),`#!/usr/bin/env node
const a=process.argv.slice(2);if(a[0]==='auth')process.exit(0);if(a[0]==='issue'&&a[1]==='view'){
 if(process.env.FIXTURE_GH_FAIL==='yes')process.exit(1);
 if(a.includes('-q')){console.log(a.includes('.body')?'J-CLI':'');process.exit(0)}
 console.log(JSON.stringify({number:44,title:'Fixture CLI',body:'J-CLI',comments:[]}));process.exit(0)
}process.exit(1);\n`,{mode:0o755});
 fs.mkdirSync(path.join(env.root,'docs/contracts'),{recursive:true});
 fs.writeFileSync(path.join(env.root,'docs/contracts/journey_cli.yml'),yaml.dump({journey_meta:{id:'J-CLI',owner:'fixture',verification_level:'process',boundaries:['process','filesystem']},test_hooks:{e2e_test_file:'cli.test.js',execution:{adapter:'jest',required_case_ids:['cli.test.js::C-CLI-transform'],optional_case_ids:[],args:[]}}}));
 cp.execFileSync('git',['add','.'],{cwd:env.root});cp.execFileSync('git',['-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','test: native journey (#44)'],{cwd:env.root});
});
afterEach(()=>{env?.remove();fs.rmSync(bin,{recursive:true,force:true});});
function run(script=hook,extra={}){return cp.spawnSync('bash',[script],{cwd:env.root,encoding:'utf8',timeout:30000,env:{...process.env,...extra,CLAUDE_PROJECT_DIR:env.root,PATH:bin+path.delimiter+process.env.PATH}});}
function document(){return yaml.load(fs.readFileSync(path.join(env.root,'docs/contracts/journey_cli.yml'),'utf8'));}
function save(doc){fs.writeFileSync(path.join(env.root,'docs/contracts/journey_cli.yml'),yaml.dump(doc));}
test('TE002/006: real CLI journey runs through source hook without browser syntax',()=>{
 const result=run();expect({status:result.status,stderr:result.stderr,stdout:result.stdout.slice(0,1200)}).toMatchObject({status:0});
 const report=JSON.parse(result.stdout);expect(report).toMatchObject({status:'passed',executed:1,attempts:[{summary:{passed:1,skipped:0}}]});
});
test.each(['discovery','missing-test','missing-inventory','deferred'])('TE001/004: %s cannot disappear into a successful hook exit',kind=>{
 if(kind==='missing-test'){const doc=document();doc.test_hooks.e2e_test_file='missing.test.js';save(doc);}
 if(kind==='missing-inventory'){const doc=document();delete doc.test_hooks.execution;save(doc);}
 if(kind==='deferred'){fs.mkdirSync(env.root+'/.claude',{recursive:true});fs.writeFileSync(env.root+'/.claude/.defer-journal','J-CLI #999 fixture deferral\n');}
 const result=run(hook,kind==='discovery'?{FIXTURE_GH_FAIL:'yes'}:{});expect(result.status).toBe(2);expect(JSON.parse(result.stdout).status).toBe('blocked');
});
test('TE004: legacy global deferral only permits continuation and explicitly records non-execution',()=>{
 fs.mkdirSync(env.root+'/.claude',{recursive:true});fs.writeFileSync(env.root+'/.claude/.defer-tests','');
 const result=run();expect(result.status).toBe(0);expect(JSON.parse(result.stdout)).toMatchObject({status:'deferred',verification:'not_run'});expect(result.stdout).not.toContain('passed');
});
test('TE001/005: actual hook accounts for required skip and allows an explicitly optional skip',()=>{
 fs.appendFileSync(env.root+'/cli.test.js',"\ntest.skip('C-optional',()=>{});\n");
 const doc=document();doc.test_hooks.execution.required_case_ids.push('cli.test.js::C-optional');save(doc);
 const blocked=run();expect(blocked.status).toBe(2);expect(blocked.stdout).toContain('required_case_skipped');
 doc.test_hooks.execution.required_case_ids.pop();doc.test_hooks.execution.optional_case_ids.push('cli.test.js::C-optional');save(doc);
 const allowed=run();expect(allowed.status).toBe(0);expect(JSON.parse(allowed.stdout).attempts[0]).toMatchObject({summary:{passed:1,skipped:1}});
});
test('TE003/004: actual installer supplies the helper and installed hook fails actionably when it is missing',()=>{
 const install=cp.spawnSync('bash',[path.join(source,'install-hooks.sh'),env.root,'--runtime','codex'],{cwd:source,encoding:'utf8',timeout:60000,env:{...process.env,PATH:bin+path.delimiter+process.env.PATH}});
 expect({exit:install.status,stderr:install.stderr.slice(-1000),stdout:install.stdout.slice(-1200)}).toMatchObject({exit:0});
 const installed=path.join(env.root,'.claude/hooks/run-journey-tests.sh');expect(fs.existsSync(env.root+'/scripts/test-execution.cjs')).toBe(true);
 const good=run(installed);expect({exit:good.status,stderr:good.stderr,stdout:good.stdout.slice(0,800)}).toMatchObject({exit:0});expect(JSON.parse(good.stdout).status).toBe('passed');
 fs.unlinkSync(env.root+'/scripts/test-execution.cjs');const unavailable=run(installed);expect(unavailable.status).toBe(2);expect(unavailable.stderr).toContain('Native journey helper missing');
});
