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
    cfg.authority?.principal !== bound.principal ||
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
    const req = { repo_id: binding.repo_id, run_id: binding.run_id, cycle_id: binding.cycle_id, stage };
    const admitted = service.startStage(req, (entry) => {
      const child = spawn(cfg.launcher, ['stage', stage, JSON.stringify(args)], {
        cwd: cfg.emptyCwd,
        env: { ...worker.controlledEnvironment(), PATH: cfg.bin + ':' + worker.controlledEnvironment().PATH },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });
      const identity = watch.birth(child.pid);
      if (!identity) throw new ControllerError('stage_launch_unconfirmed');
      const guardian = spawn(
        process.execPath,
        [
          path.join(__dirname, 'improve-controller-watchdog.cjs'),
          JSON.stringify({
            parent: child.pid,
            group: child.pid,
            started: identity.start,
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
        if (interruption) process.kill(-child.pid, 'SIGKILL');
      } catch (e) {
        if (e.code !== 'ESRCH') {
          interruption = 'authority_unavailable';
          try {
            process.kill(-child.pid, 'SIGKILL');
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
