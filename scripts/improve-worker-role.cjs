#!/usr/bin/env node
'use strict';
// Trusted launch relay: permits short synchronous authority transactions while
// the independent subscription CLI runs outside the registry lock.
const fs = require('fs'),
  { spawnSync } = require('child_process');
function run(requestFile) {
  const req = JSON.parse(fs.readFileSync(requestFile));
  const deadline = req.deadlineAtMs;
  if (!Number.isSafeInteger(deadline) || deadline <= 0 || deadline - Date.now() > 2147483647)
    throw new Error('role_deadline_invalid');
  const identity = require('./improve-process-identity.cjs').identity();
  if (!identity || identity.group !== process.pid) throw new Error('role_relay_group_required');
  const remaining = deadline - Date.now();
  // Managed provider gateways own the task deadline and cancellation. No local
  // quota may kill their observer while a separately supervised call is live.
  const result = remaining <= 0
    ? {status:null,error:{code:'not_started_deadline'},stdout:'',stderr:''}
    : spawnSync(req.claude, req.args, {
    cwd: req.cwd,
    env: process.env,
    input: req.input,
    encoding: 'utf8',
    timeout: remaining,
    killSignal: 'SIGKILL',
    maxBuffer: 8 * 1024 * 1024
  });
  fs.writeFileSync(req.raw, result.stdout || '', { mode: 0o600, flag: 'wx' });
  fs.writeFileSync(req.stderr, result.stderr || '', { mode: 0o600, flag: 'wx' });
  const temp = req.done + '.tmp';
  fs.writeFileSync(temp, JSON.stringify({ status: result.status, error: result.error?.code || null }), {
    mode: 0o600,
    flag: 'wx'
  });
  fs.renameSync(temp, req.done);
  // Retain the interruption record first, then remove local process-group members.
  // The independently supervised controller operation retains its own deadline.
  if (result.error?.code === 'ETIMEDOUT')
    require('./improve-controller-watchdog.cjs').signalGroup(identity);
}
if (require.main === module) run(process.argv[2]);
module.exports = { run };
