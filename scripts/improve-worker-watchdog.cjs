#!/usr/bin/env node
'use strict';
// Trusted host-only lease. No repository code, credentials or worker input.
const { spawnSync } = require('child_process'),
  fs = require('fs');
function start(args) {
  if (args.length === 2 && args[0] === '--intent') {
    return require('./improve-managed-worker.cjs').runIntent(args[1]).catch(() => { process.exitCode = 2; });
  }
  const [id, parent, deadline, config] = args;
  if (!/^[a-f0-9]{64}$/.test(id) || !/^\d+$/.test(parent) || !/^\d+$/.test(deadline) || !config.startsWith('/'))
    process.exit(2);
  const env = { PATH: '/usr/bin:/bin', HOME: '/nonexistent', DOCKER_CONFIG: config };
  const timer = setInterval(() => {
    let alive = true;
    try {
      process.kill(Number(parent), 0);
      const stat = fs.readFileSync('/proc/' + parent + '/stat', 'utf8');
      if (['Z', 'X'].includes(stat.slice(stat.lastIndexOf(')') + 2, stat.lastIndexOf(')') + 3))) alive = false;
    } catch {
      alive = false;
    }
    if (alive && Date.now() < Number(deadline)) return;
    clearInterval(timer);
    let attempts = 0;
    const remove = () => {
      const r = spawnSync('/usr/bin/docker', ['--host', 'unix:///var/run/docker.sock', 'rm', '-f', id], {
        env,
        encoding: 'utf8',
        timeout: 10000,
        maxBuffer: 65536
      });
      if (r.status === 0 || /No such (container|object)/i.test(r.stderr || '')) process.exit(0);
      if (++attempts >= 5) process.exit(2);
      setTimeout(remove, 1000);
    };
    remove();
  }, 200);
}
if (require.main === module) start(process.argv.slice(2));
module.exports = { start };
