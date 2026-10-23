#!/usr/bin/env node
'use strict';
// Trusted launch relay: permits short synchronous authority transactions while
// the independent subscription CLI runs outside the registry lock.
const fs = require('fs'),
  { spawnSync } = require('child_process');
function run(requestFile) {
  const req = JSON.parse(fs.readFileSync(requestFile));
  const result = spawnSync(req.claude, req.args, {
    cwd: req.cwd,
    env: process.env,
    input: req.input,
    encoding: 'utf8',
    timeout: 240000,
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
}
if (require.main === module) run(process.argv[2]);
module.exports = { run };
