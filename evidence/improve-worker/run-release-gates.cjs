'use strict';
// Separate actual canonical and live gates, followed by historical core archive
// verification. This never replays a consumed holdout or supplies model events.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { execFile } = require('child_process');
const [ownerFile, coreRoot, outputArg] = process.argv.slice(2), output = path.resolve(outputArg);
if (!output.startsWith(path.join(process.cwd(), '.specflow/duo/'))) throw Error('excluded_review_output_required');
fs.mkdirSync(output, { recursive:true, mode:0o700 });
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function run(id, args) {
  return new Promise(resolve => execFile(process.execPath,args,{cwd:process.cwd(),encoding:'utf8',timeout:360000,maxBuffer:32*1024*1024},(error,stdout,stderr)=>{
    const out=path.join(output,id+'.stdout'), err=path.join(output,id+'.stderr');
    fs.writeFileSync(out,stdout||'',{mode:0o600});fs.writeFileSync(err,stderr||'',{mode:0o600});
    resolve({id,command:[process.execPath,...args],exitCode:error?(Number.isInteger(error.code)?error.code:1):0,error:error?.code||null,stdout:out,stderr:err,stdout_sha256:sha(out),stderr_sha256:sha(err)});
  }));
}
(async()=>{
  const fullFile=path.join(output,'jest.json'), liveDir=path.join(output,'live'), archiveDir=path.join(output,'core');
  const [full,live]=await Promise.all([
    run('canonical',['node_modules/jest/bin/jest.js','--runInBand','--roots','tests','--json','--outputFile',fullFile]),
    run('live',['evidence/improve-worker/run-live-transport.cjs',ownerFile,liveDir])
  ]);
  // Read actual child reports; missing or malformed output fails this command.
  const jest=JSON.parse(fs.readFileSync(fullFile)), transport=JSON.parse(fs.readFileSync(path.join(liveDir,'transport.json')));
  const archive=await run('archive',['evidence/improve-worker/export-core-proof.cjs',coreRoot,archiveDir]);
  const exported=JSON.parse(fs.readFileSync(path.join(archiveDir,'summary.json')));
  const gates={
    canonical:{executed:jest.numTotalTests-jest.numPendingTests-(jest.numTodoTests||0),failed:jest.numFailedTests+jest.numFailedTestSuites,skipped:jest.numPendingTests+(jest.numTodoTests||0),exitCode:full.exitCode,suites:jest.numTotalTestSuites,report:path.relative(process.cwd(),fullFile),sha256:sha(fullFile)},
    live:{executed:transport.browser.passed+transport.browser.failed,failed:transport.browser.failed,skipped:transport.browser.skipped,exitCode:live.exitCode,report:path.relative(process.cwd(),path.join(liveDir,'transport.json')),sha256:sha(path.join(liveDir,'transport.json'))},
    archive:{exitCode:archive.exitCode,decision:exported.decision,holdoutConsumed:exported.events.holdout_consumed,manifest:exported.manifest_sha256,artifacts:exported.artifactCount,images:exported.roles.filter(r=>r.role==='judge').at(-1).image_count,historicalOnly:true,noWorkerOrProviderOrHoldoutReplay:true}
  };
  const failed=gates.canonical.failed+gates.live.failed+[full,live,archive].filter(r=>r.exitCode!==0).length+(jest.success===false?1:0);
  const skipped=gates.canonical.skipped+gates.live.skipped;
  const receipt={kind:'worker-qualification-execution',version:1,exitCode:failed||skipped?1:0,executed:gates.canonical.executed+gates.live.executed,failed,skipped,gates,commands:[full,live,archive],usageMode:'subscription_cli',actualCharges:'unmeasured'};
  const file=path.join(output,'capability-execution.json');fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log(JSON.stringify({status:receipt.exitCode===0?'passed':'failed',exitCode:receipt.exitCode,executed:receipt.executed,failed,skipped,gates,receipt:path.relative(process.cwd(),file),receipt_sha256:sha(file)}));
  process.exitCode=receipt.exitCode;
})().catch(e=>{console.error(JSON.stringify({status:'failed',code:e.code||e.message}));process.exitCode=1});
