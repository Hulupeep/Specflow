#!/usr/bin/env node
'use strict';
// Native commands are an argv bridge, never a second runtime or gate authority.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const VALUES=new Set(['--slug','--goal','--input','--run-dir','--contract','--ledger','--stage-evidence','--adapter-routing','--configuration-id','--environment','--tier-record','--max-iterations']);
const FLAGS=new Set(['--until-terminal']);
const HELP='Native Specflow commands: /specflow:run <spec-build|feature-build|status> [runtime arguments], /specflow:trace --run-dir <path>, /specflow:verify --run-dir <path> [--configuration-id <id> --environment <id>].\nUse --help for usage. Existing /specflow:specflow-audit and /specflow:specflow-simulate remain skills.\nBridge: node native-plugin-commands.cjs --project <selected-project> --request <request.json>. Request: {"command":"run|trace|verify","args":["string", "argv"]}. Inherit approved host permissions; no PATH Specflow or init copy required.\nRun forwards declared runtime inputs, --contract/--ledger/--slug, --stage-evidence, --adapter-routing, --tier-record and --until-terminal/--max-iterations. Trace is diagnostic; verify executes the owning gate. Neither changes acceptance or grants release authority.\n';
function validate(request){
 if(!request||Array.isArray(request)||typeof request!=='object'||Object.keys(request).some(k=>!['command','args'].includes(k))||!['run','trace','verify'].includes(request.command)||!Array.isArray(request.args)||request.args.some(a=>typeof a!=='string'||a.includes('\0')||a.length>16384))throw Error('Expected command run|trace|verify and string args only');
 const args=request.args;if(!args.length||args.length===1&&['--help','-h'].includes(args[0]))return {help:true};
 if(request.command==='run'&&!['spec-build','feature-build','status'].includes(args[0]))throw Error('Unknown loop operation; use --help');
 const argv=request.command==='run'?[...args]:[request.command,...args],verb=argv[0];
 const seen=new Set();for(let i=1;i<argv.length;i++){const key=argv[i];if(seen.has(key))throw Error('Duplicate runtime argument: '+key);seen.add(key);if(FLAGS.has(key)){if(!['spec-build','feature-build'].includes(verb))throw Error('Loop flag is not valid for '+verb);continue;}if(!VALUES.has(key))throw Error('Unknown or conflicting runtime argument: '+key);if(typeof argv[++i]!=='string'||!argv[i]||argv[i].startsWith('--'))throw Error('Missing runtime argument value: '+key);}
 if(['trace','verify'].includes(verb)&&!seen.has('--run-dir'))throw Error('Explicit --run-dir is required for '+verb);
 if(verb==='status'&&!seen.has('--contract'))throw Error('Explicit --contract is required for status');
 if(['spec-build','feature-build'].includes(verb)&&!seen.has('--slug')&&!seen.has('--contract'))throw Error('Explicit --slug or --contract is required');
 return {argv};
}
function dispatch(request,project){const selected=validate(request);if(selected.help){process.stdout.write(HELP);return 0;}if(typeof project!=='string'||!path.isAbsolute(project)||!fs.statSync(project).isDirectory())throw Error('Selected project must be an absolute existing directory');const root=fs.realpathSync(project);const r=cp.spawnSync(process.execPath,[path.join(__dirname,'specflow-runner.cjs'),...selected.argv],{cwd:root,env:process.env,stdio:'inherit'});if(r.error)throw r.error;if(r.signal)throw Error('Canonical runtime terminated by '+r.signal);return r.status===null?2:r.status;}
function cli(args=process.argv.slice(2)){try{if(!args.length||args.length===1&&['--help','-h'].includes(args[0])){process.stdout.write(HELP);return 0;}if(args.length!==4||args[0]!=='--project'||args[2]!=='--request')throw Error('Use --project <absolute-project> --request <JSON-path>');const file=path.resolve(args[3]),s=fs.statSync(file);if(!s.isFile()||s.size>65536)throw Error('Request must be a JSON file of at most65536 bytes');return dispatch(JSON.parse(fs.readFileSync(file,'utf8')),args[1]);}catch(e){console.error('Native command refused: '+e.message);return 2;}}
module.exports={validate,dispatch,cli,HELP};
if(require.main===module)process.exitCode=cli();
