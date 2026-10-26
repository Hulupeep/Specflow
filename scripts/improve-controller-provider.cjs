'use strict';
// #217's native CLI seam. Context is owner-generated and enters pinnedLauncher inputs.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  { spawn } = require('child_process');
const c = require('./improve-controller.cjs'),
  p = require('./improve-profiles.cjs'),
  w = require('./improve-worker.cjs'),
  watch = require('./improve-controller-watchdog.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function check(v, code) {
  if (!v) throw new c.ControllerError(code);
}
function service(ctx) {
  check(process.getuid() === ctx.uid, 'host_identity_mismatch');
  return c.createControllerService({
    root: ctx.store,
    registry: ctx.registry,
    resolvePrincipal: () => ctx.principal,
    ownerPrincipal: ctx.ownerPrincipal,
    hostCapabilities: () => ctx.host,
    recovery: require('./improve-recovery-host.cjs').fromConfig(ctx.recovery,{principal:ctx.principal,store:ctx.store,registry:ctx.registry,routing:ctx.routing,requested_models:ctx.requested_models})
  });
}
function invocation(args, ctx) {
  const keys = {
      '--safe-mode': 0,
      '--restricted': 0,
      '--tools': 1,
      '--strict-mcp-config': 0,
      '--mcp-config': 1,
      '--permission-mode': 1,
      '--permission-prompts': 1,
      '--disable-slash-commands': 0,
      '--no-chrome': 0,
      '--no-session-persistence': 0,
      '--session-id': 1,
      '--model': 1,
      '--print': 0,
      '--output-format': 1,
      '--verbose': 0,
      '--json-schema': 1,
      '--input-format': 1
    },
    parsed = {};
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    check(Object.hasOwn(keys, k) && !Object.hasOwn(parsed, k), 'unapproved_provider_arguments');
    parsed[k] = keys[k] ? args[++i] : true;
  }
  check(
    Object.keys(parsed).length === Object.keys(keys).length &&
      parsed['--tools'] === '' &&
      parsed['--mcp-config'] === '{"mcpServers":{}}' &&
      parsed['--permission-mode'] === 'dontAsk' &&
      parsed['--permission-prompts'] === 'none' &&
      parsed['--output-format'] === 'stream-json' &&
      parsed['--input-format'] === 'stream-json',
    'provider_io_denied'
  );
  const schema = JSON.parse(parsed['--json-schema']),
    rawRole = schema.properties?._binding?.properties?.role?.const,
    role = rawRole === 'critique' ? 'peer' : rawRole;
  check(
    ['builder', 'oracle', 'peer', 'judge'].includes(role) &&
      parsed['--model'] === (ctx.requested_models?.[role] || ctx.routing[role]),
    'provider_role_mismatch'
  );
  return { role, schema, session: parsed['--session-id'] };
}
function classify(output, error, status) {
  if (error === 'output_limit') return 'protocol_failure';
  if (error === 'deadline') return 'deadline';
  if (error === 'cancelled' || error === 'operator_cancelled') return 'operator_cancelled';
  if (error === 'authority_unavailable') return 'authority_unavailable';
  // Only explicit native error records are classified; prompt/evidence text is not diagnosis.
  const records = String(output)
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        const e = JSON.parse(l);
        return e.type === 'result' && (e.is_error || e.subtype !== 'success') ? [e] : [];
      } catch {
        return [];
      }
    });
  const text = JSON.stringify(records);
  if (/rate_limit|quota|usage limit|capacity/i.test(text)) return 'provider_quota';
  if (/authentication|unauthorized|not logged in|invalid.*credential/i.test(text)) return 'provider_auth';
  if (status !== 0) return 'provider_failure';
  return null;
}
async function run(ctx, args = process.argv.slice(2)) {
  const svc = service(ctx);
  const current = p
    .createProfileService({
      registry: ctx.registry,
      resolvePrincipal: () => ctx.principal,
      hostCapabilities: () => ctx.host,
      lockTool:ctx.recovery?.lockTool
    })
    .inspect({ repo_id: ctx.repo_id });
  check(current.available && current.operations?.includes('execute'), 'authority_revoked');
  check(current.revision === ctx.profile_revision, 'stale_profile');
  const record = p.readProfile(ctx.registry, ctx.repo_id),
    provider = record.profile.routing.providers.find((v) => v.kind === 'claude-cli'),
    tool = record.profile.toolchain.find((t) => t.id === provider?.tool);
  check(
    record.revision === ctx.profile_revision &&
      tool &&
      tool.path === ctx.cli &&
      tool.sha256 === sha(fs.readFileSync(ctx.cli)),
    'provider_tool_changed'
  );
  if (
    (args.length === 1 && args[0] === '--version') ||
    (args.length === 2 && args[0] === 'auth' && args[1] === 'status')
  ) {
    const r = require('child_process').spawnSync(ctx.cli, args, {
      encoding: 'utf8',
      timeout: 15000,
      maxBuffer: 65536
    });
    process.stdout.write(r.stdout || '');
    process.stderr.write(r.stderr || '');
    process.exitCode = r.status ?? 2;
    return;
  }
  if (ctx.require_stage !== false)
    check(svc.status({ repo_id: ctx.repo_id, run_id: ctx.run_id }).runs[0]?.active_stage, 'stage_required');
  const parsed = invocation(args, ctx),
    req = { repo_id: ctx.repo_id, run_id: ctx.run_id, cycle_id: ctx.cycle_id, role: parsed.role };
  const bound=svc.status({repo_id:ctx.repo_id,run_id:ctx.run_id}).runs[0];
  if(bound.policy_version===2)req.input_sha256=parsed.schema.properties._binding.properties.input_sha256.const;
  const self = watch.birth(process.pid);
  check(self && (bound.policy_version===2 && bound.active_stage ? (()=>{const op=bound.operations.find(o=>o.id===bound.active_stage);return op&&c.descendsFrom(process.pid,op.pid,op.birth);})() : self.group === process.pid || self.group === process.ppid), 'owned_provider_group_required');
  let child, guardian;
  const admitted = svc.startAttempt(req, (entry) => {
    guardian = entry.operation.generation ? null : spawn(
      process.execPath,
      [
        path.join(__dirname, 'improve-controller-watchdog.cjs'),
        JSON.stringify({
          parent: process.pid,
          group: self.group,
          started: self.start,
          boot_id: require('./improve-process-identity.cjs').boot(),
          group_started: watch.birth(self.group)?.start || null,
          deadline: entry.deadline_ms + 1000
        })
      ],
      { detached: true, stdio: 'ignore', env: { PATH: '/usr/bin:/bin' } }
    );
    guardian?.unref();
    if(entry.operation.generation){
      const receipt={root:ctx.recovery.receiptRoot||path.join(ctx.store,'operation-receipts'),registry:ctx.registry,lockTool:ctx.recovery.lockTool};
      new (require('./improve-operation-receipts.cjs').OperationReceipts)({...receipt,create:true});
      const b=parsed.schema.properties._binding.properties;
      child=require('./improve-paused-operation.cjs').spawnOperation({executable:ctx.cli,args,options:{env:process.env},receipt,binding:require('./improve-operation-receipts.cjs').forOperation(bound,entry.operation),kind:'provider',expected:{session:parsed.session,model:ctx.routing[parsed.role],role:b.role.const,nonce:b.nonce.const,input_sha256:b.input_sha256.const},control:{store:ctx.store,deadline_ms:entry.deadline_ms}});
    }else child = spawn(ctx.cli, args, { stdio: ['pipe', 'pipe', 'pipe'], env: process.env });
    return child;
  });
  if (!admitted.result.allowed)
    throw new c.ControllerError(admitted.result.run.reason_code, admitted.result.run.next_action);
  const op = admitted.result.operation;
  let output = '',
    stderr = '',
    failure = null;
  const outcome = await new Promise((resolve) => {
    const kill = (why) => {
      failure ||= why;
      try {
        if(bound.policy_version!==2)child.kill('SIGKILL');
      } catch {}
    };
    const poll = setInterval(() => {
      try {
        const r = svc.status({ repo_id: ctx.repo_id, run_id: ctx.run_id }).runs[0];
        if (r.cancel_requested) kill('cancelled');
        else if (Date.now() >= r.deadline_ms) kill('deadline');
      } catch {
        kill('authority_unavailable');
      }
    }, 100);
    let size = 0;
    child.stdout.on('data', (b) => {
      size += b.length;
      if (size > 8 * 1024 * 1024) return kill('output_limit');
      output += b.toString();
    });
    child.stderr.on('data', (b) => {
      size += b.length;
      if (size > 8 * 1024 * 1024) return kill('output_limit');
      stderr += b.toString();
    });
    child.on('error', () => {
      failure ||= 'launch_failure';
    });
    child.on('close', (code) => {
      clearInterval(poll);
      resolve(code ?? 2);
    });
    process.stdin.pipe(child.stdin);
    child.stdin.on('error', () => {});
  });
  // Child has quiesced; stop the independent guardian before persisting the observation.
  try {
    guardian?.kill('SIGTERM');
  } catch {}
  let reason = classify(output, failure, outcome),
    estimate = null;
  if (outcome === 0 && !reason) {
    try {
      const binding = parsed.schema.properties._binding.properties;
      const checked = w.validateRoleResponse(output, {
        session: parsed.session,
        model: ctx.routing[parsed.role],
        role: binding.role.const,
        nonce: binding.nonce.const,
        input_sha256: binding.input_sha256.const
      });
      estimate = checked.provenance.cli_estimate_usd;
    } catch {
      reason = 'protocol_failure';
    }
  }
  if (failure && !reason) reason = 'provider_failure';
  const evidenceDir = path.join(ctx.store, 'provider-evidence');
  fs.mkdirSync(evidenceDir, { recursive: true, mode: 0o700 });
  const outputPath = path.join(evidenceDir, op.id + '.jsonl'),
    errorPath = path.join(evidenceDir, op.id + '.stderr');
  fs.writeFileSync(outputPath, output, { mode: 0o600, flag: 'wx' });
  if (failure) stderr += '\n' + JSON.stringify({ controller_error: failure, reason_code: reason }) + '\n';
  fs.writeFileSync(errorPath, stderr, { mode: 0o600, flag: 'wx' });
  if(bound.policy_version===2){const sealed=new (require('./improve-operation-receipts.cjs').OperationReceipts)({root:ctx.recovery.receiptRoot||path.join(ctx.store,'operation-receipts'),registry:ctx.registry,lockTool:ctx.recovery.lockTool}).get(op.id);reason=sealed.result.reason_code;estimate=sealed.result.estimate_usd;}
  svc.recordAttempt(
    { repo_id: ctx.repo_id, run_id: ctx.run_id, operation_id: op.id },
    { exit_code: outcome, reason_code: reason, evidence: [outputPath, errorPath], estimate_usd: estimate }
  );
  process.stdout.write(output);
  process.stderr.write(stderr);
  process.exitCode = reason ? 2 : outcome;
}
function writeGateway(directory, ctx) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const context = path.join(directory, 'controller-context.json'),
    gateway = path.join(directory, 'controller-provider');
  fs.writeFileSync(context, JSON.stringify(ctx), { mode: 0o600, flag: 'wx' });
  // require both generated inputs before #217 pins its complete loaded dependency closure.
  const code =
    '#!' +
    process.execPath +
    '\nconst ctx=require(' +
    JSON.stringify(context) +
    ');module.exports=ctx;if(require.main===module)require(' +
    JSON.stringify(__filename) +
    ').run(ctx).catch(e=>{process.stderr.write(JSON.stringify({code:e.code||"provider_failure",next_action:e.next_action||"Inspect retained controller evidence."})+"\\n");process.exitCode=2;});\n';
  fs.writeFileSync(gateway, code, { mode: 0o700, flag: 'wx' });
  require(gateway);
  return gateway;
}
module.exports = { run, writeGateway, invocation, classify };
