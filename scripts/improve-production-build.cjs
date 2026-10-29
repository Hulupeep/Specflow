'use strict';
// Closed production layout validation. Generic worker mount admission is unchanged.
const path = require('path');
const PROFILE = Object.freeze({
  id: 'production-build-v1', source: '/app', dependencies: '/app/node_modules', output: '/app/.next',
  cwd: '/app', outputBytes: 1073741824, tmpBytes: 134217728, aggregateTmpfsBytes: 1207959552,
  memoryBytes: 2147483648, memorySwapBytes: 2147483648, cpus: 1, pids: 128,
  phaseMilliseconds: 600000, watchdogGraceMilliseconds: 10000,
  captureLimits: Object.freeze({ maxBytes: 1073741824, maxFileBytes: 536870912, maxEntries: 100000, maxDepth: 128, maxSeconds: 300 })
});
function requireThat(ok, code) { if (!ok) throw new Error(code); }
function validateBuildTopology(destinations) {
  const code = 'build_mount_topology';
  requireThat(Array.isArray(destinations), code);
  const seen = [];
  for (const destination of destinations) {
    requireThat(typeof destination === 'string' && destination.startsWith('/') && destination !== '/' &&
      path.posix.normalize(destination) === destination && !destination.endsWith('/') &&
      !/[\\,\s\0]/.test(destination) && !seen.includes(destination), code);
    for (const other of seen) {
      const parent = destination.startsWith(other + '/') ? other : other.startsWith(destination + '/') ? destination : null;
      if (parent) {
        const child = parent === destination ? other : destination;
        requireThat(parent === '/app' && ['/app/node_modules', '/app/.next'].includes(child), code);
      }
    }
    seen.push(destination);
  }
  requireThat(['/app', '/app/node_modules', '/app/.next', '/tmp'].every(p => seen.includes(p)), code);
  return true;
}
function parseMountInfo(text) {
  const code = 'build_mountinfo_invalid';
  requireThat(typeof text === 'string' && text.length > 0 && text.length <= 4 * 1024 * 1024 && !/[\0\r]/.test(text), code);
  const ids = new Set();
  function decode(value) {
    requireThat(!/\\(?!040|011|012|134)/.test(value), code);
    return value.replace(/\\(040|011|012|134)/g, (_, n) => String.fromCharCode(parseInt(n, 8)));
  }
  function options(value) {
    const values = value.split(',');
    requireThat(values.every(v => v.length > 0) && new Set(values.map(v => v.split('=')[0])).size === values.length, code);
    return values;
  }
  const lines = text.endsWith('\n') ? text.slice(0, -1).split('\n') : text.split('\n');
  return lines.map(line => {
    const sides = line.split(' - ');
    requireThat(sides.length === 2, code);
    const left = sides[0].split(' '), right = sides[1].split(' ');
    requireThat(left.length >= 6 && right.length === 3 && [...left, ...right].every(v => v.length && !/\s/.test(v)), code);
    requireThat(/^[1-9]\d*$/.test(left[0]) && /^(0|[1-9]\d*)$/.test(left[1]) && /^\d+:\d+$/.test(left[2]), code);
    const id = Number(left[0]), parent = Number(left[1]);
    requireThat(Number.isSafeInteger(id) && Number.isSafeInteger(parent) && id !== parent && !ids.has(id), code);
    ids.add(id);
    const root = decode(left[3]), destination = decode(left[4]);
    requireThat(root.startsWith('/') && destination.startsWith('/'), code);
    return { id, parent, device: left[2], root, destination, options: options(left[5]),
      optional: left.slice(6), fs: right[0], source: decode(right[1]), superOptions: options(right[2]) };
  });
}
function validateKernelMounts(text, mode) {
  const code = 'build_mount_mismatch';
  requireThat(mode === 'build' || mode === 'consumer', code);
  const entries = parseMountInfo(text);
  const relevant = entries.filter(m => m.destination === '/app' || m.destination.startsWith('/app/') || m.destination === '/tmp');
  requireThat(relevant.length === 4, code);
  const at = destination => {
    const matches = relevant.filter(m => m.destination === destination);
    requireThat(matches.length === 1, code); return matches[0];
  };
  const source = at('/app'), dependencies = at('/app/node_modules'), output = at('/app/.next'), scratch = at('/tmp');
  requireThat(dependencies.parent === source.id && output.parent === source.id, code);
  function readOnly(m) { requireThat(m.options.includes('ro') && !m.options.includes('rw') && m.fs !== 'tmpfs', code); }
  function boundedTmp(m, bytes) {
    requireThat(m.fs === 'tmpfs' && ['rw', 'nosuid', 'nodev', 'noexec'].every(f => m.options.includes(f)) &&
      !m.options.includes('ro') && m.superOptions.includes('rw') && !m.superOptions.includes('ro'), code);
    const size = m.superOptions.find(o => o.startsWith('size='));
    const match = /^size=(\d+)([kmg])?$/i.exec(size || '');
    requireThat(match && Number(match[1]) * ({ k: 1024, m: 1048576, g: 1073741824 }[match[2]?.toLowerCase()] || 1) === bytes, code);
  }
  readOnly(source); readOnly(dependencies);
  requireThat(!dependencies.options.includes('noexec') && !dependencies.superOptions.includes('noexec'), code);
  boundedTmp(scratch, PROFILE.tmpBytes);
  if (mode === 'build') boundedTmp(output, PROFILE.outputBytes); else readOnly(output);
  const writable = mode === 'build' ? [output, scratch] : [scratch];
  for (const m of [source, dependencies, ...(mode === 'consumer' ? [output] : [])])
    requireThat(writable.every(w => w.device !== m.device), code);
  requireThat(mode !== 'build' || output.device !== scratch.device, code);
  return true;
}
module.exports = { PROFILE, validateBuildTopology, parseMountInfo, validateKernelMounts };

const fs = require('fs'), crypto = require('crypto');
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
function canonical(value) {
  const code = 'build_input_invalid';
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { requireThat(Number.isSafeInteger(value), code); return String(value); }
  if (typeof value === 'string') {
    requireThat(!value.includes('\0') && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value), code);
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  requireThat(value && Object.getPrototypeOf(value) === Object.prototype, code);
  requireThat(Object.keys(value).every(k => /^[\x20-\x7e]*$/.test(k)), code);
  return '{' + Object.keys(value).sort().map(k => canonical(k) + ':' + canonical(value[k])).join(',') + '}';
}
const exact = (value, keys) => requireThat(value && Object.getPrototypeOf(value) === Object.prototype &&
  Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k)), 'build_input_invalid');
const validDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const COMMAND = Object.freeze(['/node/bin/node', '/app/node_modules/next/dist/bin/next', 'build']);
const FIXED_ENV = Object.freeze({ CI: 'true', NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1',
  NODE_OPTIONS: '--max-old-space-size=1536', NEXT_PUBLIC_AUTH_BYPASS: 'false' });
function validateInput(input) {
  if (typeof input === 'string') input = require('./improve-worker.cjs').strictJSON(input);
  canonical(input); // Reject unsupported values before any filesystem or process operation.
  exact(input, ['schema', 'jobId', 'source', 'dependencies', 'dependencySource', 'runtimeSha256', 'command', 'environment', 'resourceProfile']);
  const code = 'build_input_invalid';
  requireThat(input.schema === 'specflow.production-build-input/v1' && input.resourceProfile === PROFILE.id &&
    typeof input.jobId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(input.jobId) && validDigest(input.runtimeSha256) &&
    canonical(input.command) === canonical(COMMAND), code);
  for (const key of ['source', 'dependencies']) {
    const item = input[key]; exact(item, ['target', 'receipt']); exact(item.receipt, ['identity', 'manifestSha256']);
    const identity = item.receipt.identity; exact(identity, ['jobId', 'sourceContainerId', 'recipeSha256', 'sourceInputSha256']);
    requireThat(typeof item.target === 'string' && item.target.length > 0 && item.target.length <= 4096 &&
      identity.jobId === input.jobId && ['sourceContainerId', 'recipeSha256', 'sourceInputSha256'].every(k => validDigest(identity[k])) &&
      validDigest(item.receipt.manifestSha256), code);
  }
  exact(input.dependencySource, ['packageSha256', 'lockSha256', 'manifestSha256']);
  requireThat(Object.values(input.dependencySource).every(validDigest) &&
    digest(canonical(input.dependencySource)) === input.dependencies.receipt.identity.sourceInputSha256, code);
  exact(input.environment, [...Object.keys(FIXED_ENV), 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']);
  requireThat(Object.entries(FIXED_ENV).every(([k, v]) => input.environment[k] === v), code);
  const url = input.environment.NEXT_PUBLIC_SUPABASE_URL, key = input.environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  requireThat(typeof url === 'string' && url.length <= 2048 && !/\s/.test(url), code);
  const matched = /^http:\/\/(127\.0\.0\.1|\[::1\]):([0-9]{1,5})(\/[^?#]*)?$/.exec(url);
  requireThat(matched && Number(matched[2]) >= 1 && Number(matched[2]) <= 65535 &&
    typeof key === 'string' && key.length > 0 && key.length <= 4096, code);
  return JSON.parse(canonical(input));
}
function helperIdentity() {
  const names = ['improve-production-build.cjs', 'improve-worker.cjs', 'improve-worker-capsule.py',
    'improve-worker-store.py', 'improve-worker-watchdog.cjs', 'improve-offline-cache.cjs', 'improve-process-identity.cjs'];
  const read = require('./improve-offline-cache.cjs').readRegular;
  return digest(canonical(Object.fromEntries(names.map(name => [name, digest(read(path.join(__dirname, name)))]))));
}
function runtimeIdentity(worker) {
  requireThat(typeof worker.image === 'string' && /^sha256:[a-f0-9]{64}$/.test(worker.image), 'build_input_changed');
  const layer = worker.layer;
  requireThat(layer && Array.isArray(layer.files) && Array.isArray(layer.directories), 'build_input_changed');
  const softwareLayerSha256 = digest(JSON.stringify({ files: layer.files, directories: layer.directories }));
  requireThat(softwareLayerSha256 === layer.sha256, 'build_input_changed');
  return digest(canonical({ image: worker.image, softwareLayerSha256 }));
}
function inputIdentity(worker, input) {
  input = validateInput(input);
  const { verifySoftwareLayer, strictJSON } = require('./improve-worker.cjs');
  requireThat(input.jobId === worker.jobId && input.runtimeSha256 === runtimeIdentity(worker), 'build_input_changed');
  verifySoftwareLayer(worker.layer);
  for (const [key, destination] of [['source', '/app'], ['dependencies', '/app/node_modules']])
    worker.capsuleMount(input[key].target, input[key].receipt, destination);
  const read = require('./improve-offline-cache.cjs').readRegular;
  const manifest = strictJSON(read(path.join(input.source.target, 'manifest.json')).toString('utf8'));
  requireThat(digest(read(path.join(input.source.target, 'manifest.json'))) === input.source.receipt.manifestSha256, 'build_input_changed');
  for (const [file, key] of [['package.json', 'packageSha256'], ['pnpm-lock.yaml', 'lockSha256']]) {
    const entry = manifest.entries.find(e => e.path === file);
    requireThat(entry?.kind === 'file' && entry.sha256 === input.dependencySource[key], 'build_dependency_source');
  }
  const logical = { ...input, source: { ...input.source, target: '/app' }, dependencies: { ...input.dependencies, target: '/app/node_modules' },
    cwd: PROFILE.cwd, profile: PROFILE, helperAbiSha256: helperIdentity() };
  return { input, logical, inputSha256: digest(canonical(logical)) };
}
Object.assign(module.exports, { canonical, validateInput, inputIdentity, runtimeIdentity, helperIdentity, COMMAND, FIXED_ENV });

function outputRecipe(helperAbiSha256, producerIdentitySha256) {
  return digest(canonical({ schema: 'specflow.production-output/v1', helperAbiSha256, producerIdentitySha256 }));
}
function buildId(worker, target, output) {
  worker.capsuleMount(target, output, PROFILE.output);
  const read = require('./improve-offline-cache.cjs').readRegular;
  const manifestBytes = read(path.join(target, 'manifest.json'));
  requireThat(digest(manifestBytes) === output.manifestSha256, 'build_output_changed');
  const manifest = require('./improve-worker.cjs').strictJSON(manifestBytes.toString('utf8'));
  const entry = manifest.entries.find(e => e.path === 'BUILD_ID');
  requireThat(entry?.kind === 'file' && entry.size > 0, 'build_output_invalid');
  const bytes = read(path.join(target, 'tree/BUILD_ID'), PROFILE.captureLimits.maxFileBytes);
  requireThat(bytes.length === entry.size && digest(bytes) === entry.sha256, 'build_output_changed');
  return digest(bytes);
}
function verifyProductionOutput(worker, input, receipt, target) {
  const bound = inputIdentity(worker, input);
  canonical(receipt);
  exact(receipt, ['schema', 'jobId', 'inputSha256', 'producerIdentitySha256', 'output', 'buildIdSha256']);
  exact(receipt.output, ['identity', 'manifestSha256']);
  exact(receipt.output.identity, ['jobId', 'sourceContainerId', 'recipeSha256', 'sourceInputSha256']);
  requireThat(receipt.schema === 'specflow.production-build-receipt/v1' && receipt.jobId === worker.jobId &&
    receipt.inputSha256 === bound.inputSha256 && receipt.output.identity.jobId === worker.jobId &&
    [receipt.producerIdentitySha256, receipt.buildIdSha256, receipt.output.manifestSha256,
      receipt.output.identity.sourceContainerId, receipt.output.identity.recipeSha256, receipt.output.identity.sourceInputSha256].every(validDigest) &&
    receipt.output.identity.sourceInputSha256 === bound.inputSha256 &&
    receipt.output.identity.recipeSha256 === outputRecipe(bound.logical.helperAbiSha256, receipt.producerIdentitySha256), 'build_receipt_changed');
  requireThat(buildId(worker, target, receipt.output) === receipt.buildIdSha256, 'build_output_changed');
  return bound;
}
function runProductionBuild(worker, input, destination) {
  const { WorkerError } = require('./improve-worker.cjs');
  destination = worker.capsuleLocation(destination);
  requireThat(!fs.existsSync(destination), 'build_output_exists');
  const area = fs.mkdtempSync(path.join(worker.stateRoot, 'production-evidence-')); fs.chmodSync(area, 0o700);
  const originalCall = worker.call, originalDiagnostic = worker.capsuleDiagnostic;
  const beforeOwned = new Set(worker.containers); let sequence = 0, candidate;
  function record(phase, r) {
    const prefix = path.join(area, String(++sequence).padStart(4, '0'));
    fs.writeFileSync(prefix + '.stdout', r.stdout || '', { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(prefix + '.stderr', r.stderr || '', { mode: 0o600, flag: 'wx' });
    fs.writeFileSync(prefix + '.json', JSON.stringify({ phase, status: r.status, signal: r.signal || null, error: r.error?.code || null }), { mode: 0o600, flag: 'wx' });
  }
  worker.call = function(args, options = {}) {
    const r = originalCall.call(this, args, { ...options, allowFailure: true }); record('docker-' + args[0], r);
    if (!options.allowFailure && r.status !== 0) throw new WorkerError(r.error?.code === 'ETIMEDOUT' ? 'worker_deadline' : 'docker_operation_failed', 'production-build');
    return r;
  };
  worker.capsuleDiagnostic = (action, r) => { record('capsule-' + action, r); originalDiagnostic?.(action, r); };
  try {
    const bound = inputIdentity(worker, input);
    fs.writeFileSync(path.join(area, 'input-identity.json'), canonical(bound.logical), { mode: 0o600, flag: 'wx' });
    const id = worker.createProduction({ source: bound.input.source, dependencies: bound.input.dependencies });
    requireThat(inputIdentity(worker, input).inputSha256 === bound.inputSha256, 'build_input_changed');
    const built = worker.exec(id, COMMAND, { cwd: PROFILE.cwd, env: bound.input.environment, allowFailure: true });
    if (built.status !== 0) {
      let code = /\bENOSPC\b/.test(String(built.stdout) + String(built.stderr)) ? 'build_resource_exhausted' : 'build_command_failed';
      const observed = worker.call(['inspect', id], { allowFailure: true });
      if (observed.status === 0) {
        const state = JSON.parse(observed.stdout)[0]?.State;
        if (state?.OOMKilled === true) code = 'build_memory_exhausted';
        else if (state?.Running === false) code = 'build_process_lost';
      } else if (/No such (container|object)/i.test(observed.stderr || '')) code = 'build_process_lost';
      throw new WorkerError(code, 'production-build');
    }
    requireThat(inputIdentity(worker, input).inputSha256 === bound.inputSha256, 'build_input_changed');
    const processIdentity = worker.inspectProduction(id);
    const producerIdentity = { containerId: id, image: worker.image, runtimeSha256: bound.input.runtimeSha256, process: processIdentity };
    const producerIdentitySha256 = digest(canonical(producerIdentity));
    fs.writeFileSync(path.join(area, 'producer-identity.json'), canonical(producerIdentity), { mode: 0o600, flag: 'wx' });
    worker.pause(id);
    requireThat(canonical(worker.capsuleState(id).processIdentity) === canonical(processIdentity), 'build_process_changed');
    const captured = worker.captureCapsule(id, PROFILE.output, destination, {
      recipeSha256: outputRecipe(bound.logical.helperAbiSha256, producerIdentitySha256),
      sourceInputSha256: bound.inputSha256, limits: PROFILE.captureLimits });
    const output = { identity: captured.identity, manifestSha256: captured.manifestSha256 };
    candidate = { schema: 'specflow.production-build-receipt/v1', jobId: worker.jobId,
      inputSha256: bound.inputSha256, producerIdentitySha256, output, buildIdSha256: buildId(worker, destination, output) };
    verifyProductionOutput(worker, input, candidate, destination);
  } catch (error) {
    fs.writeFileSync(path.join(area, 'failure.json'), JSON.stringify({ code: error.code || error.message, receiptEmitted: false }), { mode: 0o600, flag: 'wx' });
    error.evidenceDirectory = area;
    throw error;
  } finally {
    try { for (const id of [...worker.containers]) if (!beforeOwned.has(id)) worker.destroy(id); }
    catch (error) {
      fs.writeFileSync(path.join(area, 'teardown-failure.json'), JSON.stringify({ code: error.code || error.message, receiptEmitted: false }), { mode: 0o600, flag: 'wx' });
      error.evidenceDirectory = area; throw error;
    }
    finally { worker.call = originalCall; worker.capsuleDiagnostic = originalDiagnostic; }
  }
  // This point is unreachable if teardown failed; no success receipt is persisted earlier.
  const receiptFile = path.join(area, 'receipt.json'), fd = fs.openSync(receiptFile, 'wx', 0o600);
  try { fs.writeFileSync(fd, canonical(candidate)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
  const parent = fs.openSync(area, fs.constants.O_RDONLY | fs.constants.O_DIRECTORY);
  try { fs.fsyncSync(parent); } finally { fs.closeSync(parent); }
  return { receipt: candidate, target: destination, evidenceDirectory: area };
}
function createProductionConsumer(worker, input, receipt, target) {
  const bound = verifyProductionOutput(worker, input, receipt, target), expectedReceipt = canonical(receipt);
  const id = worker.createProduction({ source: bound.input.source, dependencies: bound.input.dependencies, output: { target, receipt: receipt.output } });
  const guard = () => {
    requireThat(canonical(receipt) === expectedReceipt, 'build_receipt_changed');
    verifyProductionOutput(worker, input, receipt, target);
  };
  function invoke(method, argv) {
    try {
      guard();
      requireThat(Array.isArray(argv) && argv.length > 0 && argv.every(v => typeof v === 'string' && !v.includes('\0')), 'build_consumer_command');
      return worker[method](id, argv, { cwd: PROFILE.cwd, env: bound.input.environment });
    } catch (error) { worker.destroy(id); throw error; }
  }
  return Object.freeze({ id, exec: argv => invoke('exec', argv), start: argv => invoke('start', argv), close: () => worker.destroy(id) });
}
Object.assign(module.exports, { runProductionBuild, verifyProductionOutput, createProductionConsumer });
