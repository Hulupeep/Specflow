'use strict';
// Accelerated observation-clock regression; no provider, product or completion proof.
const fs = require('fs'), os = require('os'), path = require('path');
const { EventEmitter } = require('events');
const { PassThrough } = require('stream');
const { createControllerWorker } = require('../../scripts/improve-controller-worker.cjs');
let root;
afterEach(() => { jest.useRealTimers(); fs.rmSync(root, {recursive:true,force:true}); });
function observation({ elapsed = 0, version = 1 } = {}) {
  jest.useFakeTimers();
  const now = Date.now();
  root = fs.mkdtempSync(path.join(os.tmpdir(),'stage-deadline-'));
  const bin = path.join(root,'bin'); fs.mkdirSync(bin);
  const binding = {repo_id:'fixture',run_id:'run',cycle_id:'cycle'};
  const run = {principal:'owner',profile_revision:'revision',canonical_repo:path.join(root,'repo'),
    policy_version:version,recovery:{authorised:{principal:'owner'}},deadline_ms:now+1200000,
    remaining:{wall_ms:1200000},cancel_requested:false};
  const configFile=path.join(bin,'job.json');
  fs.writeFileSync(configFile,JSON.stringify({authority:{uid:process.getuid(),principal:'owner',repo_id:'fixture',revision:'revision'},controller_binding:binding,bin,launcher:path.join(bin,'worker-command')}),{mode:0o600});
  const service={status:()=>({runs:[run]}),recordStage:jest.fn()};
  const adapter=createControllerWorker({service,binding,configFile,evidenceDir:path.join(root,'evidence')});
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  // Impossible PID: never signal a real process in this clock-only test.
  child.controllerIdentity={pid:2147483647,boot_id:'fixture',start:'0',group:2147483647};
  child.controllerOperation='operation';
  jest.setSystemTime(now+elapsed);
  const waiting=adapter.wait(child).then(value=>({value}),error=>({error:error.code}));
  return {child,waiting,service};
}
test.each([1,2])('CTRL-STAGE-DEADLINE v%s observation survives ten minutes inside authorized window',async version=>{
  const {child,waiting}=observation({version});let settled=false;waiting.then(()=>{settled=true;});
  await jest.advanceTimersByTimeAsync(600001);
  expect(settled).toBe(false);
  // End the simulated observer without pretending to have a v2 signed receipt.
  child.emit('error',new Error('end of clock probe'));
  expect(await waiting).toEqual({error:'worker_start_failed'});
});
test('CTRL-STAGE-DEADLINE late observation expires relative to original deadline with bounded receipt cleanup',async()=>{
  const {waiting}=observation({elapsed:1199000});
  await jest.advanceTimersByTimeAsync(31001);
  expect(await waiting).toEqual({error:'worker_deadline'});
});
