// Explicitly simulated native event protocol. No model is contacted.
'use strict';
const fs=require('fs'),path=require('path');
const args=process.argv.slice(2),host=path.basename(process.argv[1]);
if(args.includes('--version')){console.log('simulated-native-critic');process.exit(0);}
if(args[0]==='auth'){console.log(JSON.stringify({loggedIn:process.env.ADVISORY_TEST_CASE!=='auth_error'}));process.exit(0);}
if(args[0]==='login'){console.log(process.env.ADVISORY_TEST_CASE==='auth_error'?'Not authenticated':'Logged in using simulated-fixture');process.exit(0);}
if(host==='claude'&&JSON.parse(args[args.indexOf('--json-schema')+1]||'{}').$schema==='https://json-schema.org/draft/2020-12/schema'){console.error('Simulated Claude CLI: unsupported schema dialect annotation');process.exit(1);}
const prompt=fs.readFileSync(0,'utf8');fs.writeFileSync('received-prompt.txt',prompt);
const req=JSON.parse(fs.readFileSync('request.json')),mode=process.env.ADVISORY_TEST_CASE||'clean';
if(process.env.ADVISORY_TEST_COUNT)fs.appendFileSync(process.env.ADVISORY_TEST_COUNT,'called\n');
if(mode==='error'){console.error('simulated transport failure');process.exit(23);}
function finish(){
 if(mode==='empty')return;
 if(mode==='tamper')fs.appendFileSync('tree/app.js','unauthorised frozen edit');
 if(mode==='malformed'){console.log('not-json');return;}
 const events=[];
 if(mode!=='no_reads')for(const [i,file]of req.requiredReads.entries()){
  const text=fs.readFileSync(file,'utf8');
  if(mode==='first_line'&&text.length){const first=text.match(/[^\n]*\n|[^\n]+$/)[0];if(host==='claude')events.push({type:'assistant',message:{content:[{type:'tool_use',id:'r'+i,name:'Read',input:{file_path:path.resolve(file),limit:1}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'r'+i,content:'1→'+first.replace(/\n$/,'')}]}});else events.push({type:'item.completed',item:{id:'r'+i,type:'command_execution',command:"sed -n '1p' -- '"+file+"'",status:'completed',exit_code:0,aggregated_output:first}});continue;}
  if(host==='claude'){events.push({type:'assistant',message:{content:[{type:'tool_use',id:'r'+i,name:'Read',input:{file_path:path.resolve(file)}}]}},{type:'user',message:{content:[{type:'tool_result',tool_use_id:'r'+i,content:text||'<system-reminder>The file exists but has empty contents.</system-reminder>'}]}});}
  else events.push({type:'item.completed',item:{id:'r'+i,type:'command_execution',command:"cat -- '"+file+"'",status:'completed',exit_code:0,aggregated_output:text}});
 }
 const result={summary:'Simulated advisory protocol result',findings:JSON.parse(process.env.ADVISORY_TEST_FINDINGS||'[]')};
 if(mode==='publication_failure')fs.mkdirSync(process.env.ADVISORY_TEST_PUBLICATION_PATH,{recursive:true});
 if(host==='claude')events.push({type:'system',model:'simulated-claude-model'},{type:'result',structured_output:result});
 else {fs.writeFileSync(args[args.indexOf('-o')+1],JSON.stringify(result));events.push({type:'turn.completed'});}
 for(const e of events)console.log(JSON.stringify(e));
}
if(mode==='stubborn'){process.on('SIGTERM',()=>{});setInterval(()=>{},1000);}
else if(mode==='descendant_pipe'||mode==='descendant_immediate'){const child=require('child_process').spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000);"],{stdio:['ignore',1,2]});if(process.env.ADVISORY_TEST_DESCENDANT)fs.writeFileSync(process.env.ADVISORY_TEST_DESCENDANT,JSON.stringify(require('../../scripts/improve-process-identity.cjs').identity(child.pid)));if(mode==='descendant_immediate')process.exit(0);else setTimeout(()=>process.exit(0),300);}
else if(mode==='timeout'||mode==='hold')setTimeout(finish,mode==='timeout'?10000:1200);else finish();
