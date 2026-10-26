'use strict';
// Scoped launch adapter over #217's unchanged pinned worker/core. No evaluation,
// candidate selection, recovery, timer or caller-supplied executable lives here.
const fs = require('fs'),
  path = require('path'),
  { spawn } = require('child_process');
const worker = require('./improve-worker.cjs'),
  watch = require('./improve-controller-watchdog.cjs'),
  { ControllerError } = require('./improve-controller.cjs');
const awaitQualifiedStage = worker.awaitStage;
function createControllerWorker({ service, binding, configFile, evidenceDir }) {
  const cfg = require('./improve-controller-cli.cjs').readPrivate(configFile);
  const bound = service.status({ repo_id: binding.repo_id, run_id: binding.run_id }).runs[0];
  if (
    cfg.authority?.principal !== (bound.policy_version===2?bound.recovery.authorised.principal:bound.principal) ||
    cfg.authority?.revision !== bound.profile_revision ||
    cfg.controller_binding?.run_id !== binding.run_id ||
    cfg.controller_binding?.cycle_id !== binding.cycle_id ||
    cfg.launcher !== path.join(cfg.bin, 'worker-command') ||
    path.resolve(cfg.bin).startsWith(bound.canonical_repo + path.sep)
  )
    throw new ControllerError('worker_binding_mismatch');
  if (cfg.authority?.uid !== process.getuid() || cfg.authority.repo_id !== binding.repo_id)
    throw new ControllerError('host_identity_mismatch');
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  function start(stage, args) {
    const permitted = [
      'startRun',
      'recordCandidates',
      'critique',
      'oracle',
      'freezeContract',
      'prepareWorkspace',
      'verifyPhase',
      'build',
      'judge',
      'evaluate',
      'finalize'
    ];
    if (!permitted.includes(stage) || !Array.isArray(args)) throw new ControllerError('invalid_stage');
    if (bound.memory_required) {
      const memory = require('./improve-memory.cjs');
      const run = stage === 'startRun' ? args[0] :
        JSON.parse(fs.readFileSync(path.join(args[0], 'run.json'), 'utf8'));
      const baseCommit = stage === 'startRun' ?
        bound.cycles.find(c => c.id === binding.cycle_id)?.memory_selection?.base_commit : run.base_commit;
      const candidates = stage === 'startRun' ? null : JSON.parse(fs.readFileSync(
        stage === 'recordCandidates' ? args[1] : path.join(args[0], 'candidates.json'), 'utf8'));
      const criteria = stage === 'freezeContract' ? JSON.parse(fs.readFileSync(args[1], 'utf8')).acceptance
        .map(c => ({id:c.id,statement:c.statement})) : null;
      const checked = service.validateMemoryStage({ repo_id: binding.repo_id, run_id: binding.run_id,
        cycle_id: binding.cycle_id, stage }, {core_run_id: run.runId || run.run_id,
        base_commit: baseCommit, candidate_digest: candidates ? memory.digest(candidates) : null,
        criteria_revision: criteria ? memory.digest(criteria) : null});
      if (stage === 'startRun' && (run.target !== bound.canonical_repo || run.base !== checked.selection.base_ref))
        throw new ControllerError('memory_core_binding_mismatch');
      if (stage === 'critique') {
        const include = path.join(evidenceDir, 'memory-' + checked.selection.receipt_id + '.json');
        const safe = require('./improve-untrusted.cjs').fenceUntrusted(JSON.stringify(checked.pack), { source: 'repo-decision-memory' });
        if (!fs.existsSync(include)) fs.writeFileSync(include, safe, { mode: 0o600, flag: 'wx' });
        args = [args[0], { ...(args[1] || {}), include: [...(args[1]?.include || []), include] }];
      }
    }
    const req = { repo_id: binding.repo_id, run_id: binding.run_id, cycle_id: binding.cycle_id, stage };
    if(bound.policy_version===2) req.input_sha256=require('./improve-memory.cjs').digest({stage,args});
    const admitted = service.startStage(req, (entry) => {
      const options={
        cwd: cfg.emptyCwd,
        env: { ...worker.controlledEnvironment(), PATH: cfg.bin + ':' + worker.controlledEnvironment().PATH },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      };
      let child;
      if(entry.operation.generation){
        const receipt={root:cfg.recovery.receiptRoot||path.join(cfg.controller_store||cfg.store||cfg.recovery.store,'operation-receipts'),registry:cfg.recovery.registry||cfg.authority.registry,lockTool:cfg.recovery.lockTool};
        new (require('./improve-operation-receipts.cjs').OperationReceipts)({...receipt,create:true});
        child=require('./improve-paused-operation.cjs').spawnOperation({executable:cfg.launcher,args:['stage',stage,JSON.stringify(args)],options,receipt,binding:require('./improve-operation-receipts.cjs').forOperation(bound,entry.operation),kind:'stage'});
      }else child=spawn(cfg.launcher,['stage',stage,JSON.stringify(args)],options);
      const identity = watch.birth(child.pid);
      if (!identity) throw new ControllerError('stage_launch_unconfirmed');
      child.controllerIdentity = require('./improve-process-identity.cjs').identity(child.pid);
      const guardian = spawn(
        process.execPath,
        [
          path.join(__dirname, 'improve-controller-watchdog.cjs'),
          JSON.stringify({
            parent: child.pid,
            group: child.pid,
            started: identity.start,
            boot_id: require('./improve-process-identity.cjs').boot(),
            group_started: identity.start,
            deadline: entry.deadline_ms + 1000
          })
        ],
        { stdio: 'ignore', detached: true, env: { PATH: '/usr/bin:/bin' } }
      );
      guardian.unref();
      child.controllerGuardian = guardian;
      return child;
    });
    if (!admitted.result.allowed)
      throw new ControllerError(admitted.result.run.reason_code, admitted.result.run.next_action);
    const child = admitted.started;
    child.controllerOperation = admitted.result.operation.id;
    return child;
  }
  async function wait(child) {
    let interruption = null;
    const timer = setInterval(() => {
      try {
        const r = service.status({ repo_id: binding.repo_id, run_id: binding.run_id }).runs[0];
        if (r.cancel_requested) interruption = 'operator_cancelled';
        else if (r.remaining.wall_ms === 0) interruption = 'deadline';
        if (interruption) watch.signalGroup(child.controllerIdentity);
      } catch (e) {
        if (e.code !== 'ESRCH') {
          interruption = 'authority_unavailable';
          try {
            watch.signalGroup(child.controllerIdentity);
          } catch {}
        }
      }
    }, 100);
    try {
      const result = await awaitQualifiedStage(child),
        prefix = path.join(evidenceDir, child.controllerOperation);
      fs.writeFileSync(prefix + '.stdout', result.stdout || '', { mode: 0o600, flag: 'wx' });
      fs.writeFileSync(prefix + '.stderr', result.stderr || '', { mode: 0o600, flag: 'wx' });
      service.recordStage(
        { repo_id: binding.repo_id, run_id: binding.run_id, operation_id: child.controllerOperation },
        {
          exit_code: result.status ?? 2,
          reason_code: interruption || (result.status === 0 ? null : 'stage_failure'),
          evidence: [prefix + '.stdout', prefix + '.stderr']
        }
      );
      return result;
    } finally {
      clearInterval(timer);
      try {
        child.controllerGuardian?.kill('SIGTERM');
      } catch {}
    }
  }
  return { start, wait };
}
module.exports = { createControllerWorker };
