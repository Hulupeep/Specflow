'use strict';
const fs = require('fs'),
  path = require('path'),
  c = require('./improve-controller.cjs');
function readPrivate(file) {
  // All host configuration comes from owner-private files, never repo text.
  if (typeof file !== 'string' || !path.isAbsolute(file))
    throw new c.ControllerError('owner_private_host_required');
  for (let p = file; p !== path.dirname(p); p = path.dirname(p))
    if (fs.existsSync(p) && fs.lstatSync(p).isSymbolicLink()) throw new c.ControllerError('unsafe_host_path');
  const s = fs.statSync(file);
  if (!s.isFile() || s.uid !== process.getuid() || s.mode & 0o077 || s.size > 1024 * 1024)
    throw new c.ControllerError('owner_private_host_required');
  return JSON.parse(fs.readFileSync(file));
}
function cli(args = process.argv.slice(2)) {
  try {
    const [action, ...rest] = args,
      opts = {};
    for (let i = 0; i < rest.length; i += 2) {
      if (
        !['--host', '--file', '--repo', '--request', '--run', '--state'].includes(rest[i]) ||
        !rest[i + 1] ||
        Object.hasOwn(opts, rest[i])
      )
        throw new c.ControllerError('invalid_request');
      opts[rest[i]] = rest[i + 1];
    }
    const host = readPrivate(opts['--host']);
    if (host.version !== 1 || host.uid !== process.getuid())
      throw new c.ControllerError('host_identity_mismatch');
    const svc = c.createControllerService({
      root: host.store,
      registry: host.registry,
      resolvePrincipal: () => host.principal,
      ownerPrincipal: host.ownerPrincipal,
      hostCapabilities: () => host.host
    });
    let result;
    if (action === 'register') result = svc.registerPolicy(readPrivate(opts['--file']));
    else if (action === 'admit')
      result = svc.admit({ repo_id: opts['--repo'], request_id: opts['--request'] });
    else if (action === 'status')
      result = svc.status({ repo_id: opts['--repo'], ...(opts['--run'] ? { run_id: opts['--run'] } : {}) });
    else if (action === 'report') result = svc.report({ repo_id: opts['--repo'], run_id: opts['--run'] });
    else if (action === 'cancel') result = svc.cancel({ repo_id: opts['--repo'], run_id: opts['--run'] });
    else if (action === 'schedule')
      result = svc.controlSchedule({ repo_id: opts['--repo'], state: opts['--state'] });
    else
      throw new c.ControllerError(
        'invalid_command',
        'Use register, admit, status, report, cancel or schedule; execution uses the qualified owner-host worker seam. Live timers/resume require #183.'
      );
    console.log(JSON.stringify(result));
    return result.allowed === false ? 2 : 0;
  } catch (e) {
    console.error(
      JSON.stringify({
        reason_code: e.code || 'controller_unavailable',
        next_action:
          e.next_action ||
          'Check the owner-private host/profile configuration and retained evidence. No work was authorised by this error.'
      })
    );
    return 2;
  }
}
module.exports = { cli, readPrivate };
if (require.main === module) process.exitCode = cli();
