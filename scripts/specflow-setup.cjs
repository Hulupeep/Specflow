'use strict';
// Public CLI composition; the existing init and strict verifier retain ownership.
const fs=require('fs'),path=require('path'),cp=require('child_process');
function setup({target='.',runtime,sourceRoot=path.resolve(__dirname,'..'),replaceRouting=false}={}) {
 const cli=path.join(sourceRoot,'bin/specflow.js'),requested=path.resolve(target);
 const init=cp.spawnSync(process.execPath,[cli,'init',requested,'--runtime',runtime,...(replaceRouting?['--replace-routing']:[])],{encoding:'utf8',maxBuffer:8*1024*1024});
 const canonical=fs.existsSync(requested)?fs.realpathSync(requested):requested;
 const installation={target:canonical,status:init.status===0?'installed':'failed',exitCode:init.status,detail:(init.stdout||'')+(init.stderr||'')+(init.error?.message||'')};
 if(init.status!==0)return {runtime,installation,readiness:{target:canonical,status:'not_run',exitCode:null},exitCode:init.status||1};
 const diagnostic=require('./specflow-doctor.cjs').inspect({targetRoot:canonical,sourceRoot});
 if(diagnostic.stagedInstallation)installation.status='staged';
 const verify=cp.spawnSync(process.execPath,[cli,'verify','--strict'],{cwd:canonical,encoding:'utf8',maxBuffer:8*1024*1024});
 const verified=verify.status===0&&!verify.error&&!verify.signal;
 return {runtime,installation,readiness:{target:canonical,status:verified?'ready':'incomplete',exitCode:verify.status,detail:(verify.stdout||'')+(verify.stderr||'')+(verify.error?.message||'')+(verify.signal?'\nVerifier terminated by '+verify.signal:'')},doctor:diagnostic,exitCode:verified?(installation.status==='staged'?1:0):(Number.isInteger(verify.status)&&verify.status!==0?verify.status:1)};
}
function cli(args,sourceRoot){try{
 const at=args.indexOf('--runtime'),runtime=require('./runtime-routing.cjs').resolveRuntime({runtime:at<0?'auto':args[at+1],interactive:!!(process.stdin.isTTY&&process.stdout.isTTY)});
 const target=args.find((a,i)=>!a.startsWith('--')&&(at<0||i!==at+1))||'.',r=setup({target,runtime,sourceRoot,replaceRouting:args.includes('--replace-routing')});
 if(args.includes('--json'))console.log(JSON.stringify(r,null,2));else console.log(`Runtime: ${runtime}\nInstall ${r.installation.target}: ${r.installation.status}\n${r.installation.detail}\nStrict verify ${r.readiness.target}: ${r.readiness.status}\n${r.readiness.detail||''}\nActive: ${r.doctor?.activeInstallation.identity||'unverifiable'}; staged: ${r.doctor?.stagedInstallation?.identity||'none'}\nInstall state: ${path.join(r.installation.target,'.specflow/install-state.yml')}\nRerun preserves custom routing/gates; review any reported divergence.`);
 return r.exitCode;
}catch(e){console.error('specflow setup: '+e.message);return 1;}}
module.exports={setup,cli};
