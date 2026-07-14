#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const RUNTIMES = {
  codex: 'codex-gpt56-sol-routing.yml',
  'claude-code': 'claude-code-large-routing.yml',
};
const STATE_SCHEMA_VERSION = 1;

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(file, 'utf8'));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function semanticFingerprint(file) {
  return sha256(JSON.stringify(stableValue(readYaml(file))));
}

function atomicWrite(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, contents, 'utf8');
  fs.renameSync(temporary, file);
}

function packageVersion(sourceRoot) {
  return JSON.parse(fs.readFileSync(path.join(sourceRoot, 'package.json'), 'utf8')).version;
}

function runtimeError(value) {
  const detail = value ? `unknown runtime "${value}"` : 'runtime is required in non-interactive mode';
  return new Error(`${detail}; use --runtime codex|claude-code or set SPECFLOW_RUNTIME`);
}

function resolveRuntime(options = {}) {
  const explicit = options.runtime || options.envRuntime;
  if (explicit) {
    if (!RUNTIMES[explicit]) throw runtimeError(explicit);
    return explicit;
  }
  if (!options.interactive) throw runtimeError(null);

  process.stdout.write('Select runtime (codex or claude-code): ');
  const buffer = Buffer.alloc(128);
  const bytes = fs.readSync(0, buffer, 0, buffer.length, null);
  const answer = buffer.toString('utf8', 0, bytes).trim();
  if (!RUNTIMES[answer]) throw runtimeError(answer);
  return answer;
}

function loadInstallState(statePath) {
  if (!fs.existsSync(statePath)) return null;
  const state = readYaml(statePath);
  return state && typeof state === 'object' ? state : null;
}

function templatePaths(sourceRoot, targetRoot) {
  const sourceDir = path.join(sourceRoot, 'templates', 'adapter-policies');
  const installedDir = path.join(targetRoot, '.specflow', 'adapter-policies');
  return { sourceDir, installedDir };
}

function copyShippedTemplates(sourceRoot, targetRoot) {
  const { sourceDir, installedDir } = templatePaths(sourceRoot, targetRoot);
  fs.mkdirSync(installedDir, { recursive: true });
  for (const template of Object.values(RUNTIMES)) {
    const source = path.join(sourceDir, template);
    if (!fs.existsSync(source)) throw new Error(`routing template not found: ${source}`);
    fs.copyFileSync(source, path.join(installedDir, template));
  }
}

function isKnownShippedProfile(activePath, sourceRoot, targetRoot) {
  if (!fs.existsSync(activePath)) return false;
  const activeHash = sha256(fs.readFileSync(activePath));
  let activeSemantic;
  try {
    activeSemantic = semanticFingerprint(activePath);
  } catch (_) {
    return false;
  }
  const { sourceDir, installedDir } = templatePaths(sourceRoot, targetRoot);
  for (const template of Object.values(RUNTIMES)) {
    for (const directory of [sourceDir, installedDir]) {
      const candidate = path.join(directory, template);
      if (!fs.existsSync(candidate)) continue;
      if (sha256(fs.readFileSync(candidate)) === activeHash) return true;
      try {
        if (semanticFingerprint(candidate) === activeSemantic) return true;
      } catch (_) {
        // An invalid active file is custom and must be preserved.
      }
    }
  }
  return false;
}

function writeState(statePath, sourceRoot, runtime, template, templateHash, installedHash, managed) {
  const state = {
    schema_version: STATE_SCHEMA_VERSION,
    specflow_version: packageVersion(sourceRoot),
    routing: {
      runtime,
      template,
      template_sha256: templateHash,
      installed_sha256: installedHash,
      managed,
    },
  };
  atomicWrite(statePath, yaml.dump(state, { lineWidth: 120, noRefs: true }));
  return state;
}

function installRuntimeRouting(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot || path.join(__dirname, '..'));
  const targetRoot = path.resolve(options.targetRoot || '.');
  const activePath = path.join(targetRoot, '.specflow', 'adapter-routing.yml');
  const statePath = path.join(targetRoot, '.specflow', 'install-state.yml');
  const priorState = loadInstallState(statePath);
  const priorRouting = priorState && priorState.routing;
  const runtime = resolveRuntime({
    runtime: options.runtime,
    envRuntime: options.envRuntime === undefined ? process.env.SPECFLOW_RUNTIME : options.envRuntime,
    interactive: options.interactive === undefined ? Boolean(process.stdin.isTTY && process.stdout.isTTY) : options.interactive,
  });

  // Runtime validation precedes every routing mutation, including template refresh.
  copyShippedTemplates(sourceRoot, targetRoot);
  const template = RUNTIMES[runtime];
  const templatePath = path.join(targetRoot, '.specflow', 'adapter-policies', template);
  const templateBytes = fs.readFileSync(templatePath);
  const templateHash = sha256(templateBytes);
  const activeExists = fs.existsSync(activePath);
  const activeHash = activeExists ? sha256(fs.readFileSync(activePath)) : null;
  const replace = options.replaceRouting === true;

  let custom = false;
  let legacy = false;
  if (activeExists && !replace) {
    if (priorRouting) {
      custom = priorRouting.managed === false || activeHash !== priorRouting.installed_sha256;
    } else {
      legacy = isKnownShippedProfile(activePath, sourceRoot, targetRoot);
      custom = !legacy;
    }
  }

  if (custom) {
    const state = writeState(statePath, sourceRoot, runtime, template, templateHash, activeHash, false);
    return { status: 'custom_routing_preserved', runtime, routing_path: activePath, state_path: statePath, state };
  }

  let status = 'installed';
  if (legacy) status = 'legacy_migrated';
  else if (priorRouting && priorRouting.runtime !== runtime) status = 'switched';
  else if (activeExists && replace) status = 'refreshed';
  else if (activeExists && !replace) status = 'refreshed';

  atomicWrite(activePath, templateBytes);
  const installedHash = sha256(fs.readFileSync(activePath));
  const state = writeState(statePath, sourceRoot, runtime, template, templateHash, installedHash, true);
  return { status, runtime, routing_path: activePath, template_path: templatePath, state_path: statePath, state };
}

function verifyRuntimeRouting(options = {}) {
  const targetRoot = path.resolve(options.targetRoot || '.');
  const statePath = path.join(targetRoot, '.specflow', 'install-state.yml');
  const activePath = path.join(targetRoot, '.specflow', 'adapter-routing.yml');
  const repair = 'npx @colmbyrne/specflow update . --runtime <codex|claude-code> --replace-routing';
  const state = loadInstallState(statePath);
  if (!state || state.schema_version !== STATE_SCHEMA_VERSION || !state.routing) {
    return { ok: false, status: 'missing_install_state', error: `routing install state is missing or invalid; repair: ${repair}` };
  }
  const routing = state.routing;
  if (!RUNTIMES[routing.runtime] || routing.template !== RUNTIMES[routing.runtime]) {
    return { ok: false, status: 'runtime_mismatch', error: `routing runtime/template mismatch; repair: ${repair}` };
  }
  if (!fs.existsSync(activePath)) {
    return { ok: false, status: 'missing_routing', error: `managed adapter routing is missing; repair: ${repair}` };
  }
  const actualHash = sha256(fs.readFileSync(activePath));
  if (routing.managed && actualHash !== routing.installed_sha256) {
    return { ok: false, status: 'stale_routing', error: `managed adapter routing differs from install state; repair: ${repair}` };
  }
  if (routing.managed) {
    try {
      const active = readYaml(activePath);
      if (!active.routing_profile || active.routing_profile.runtime !== routing.runtime) {
        return { ok: false, status: 'runtime_mismatch', error: `active routing runtime differs from install state; repair: ${repair}` };
      }
    } catch (_) {
      return { ok: false, status: 'stale_routing', error: `managed adapter routing is invalid YAML; repair: ${repair}` };
    }
  }
  const installedTemplate = path.join(targetRoot, '.specflow', 'adapter-policies', routing.template);
  if (!fs.existsSync(installedTemplate) || sha256(fs.readFileSync(installedTemplate)) !== routing.template_sha256) {
    return { ok: false, status: 'stale_template', error: `installed routing template differs from install state; repair: ${repair}` };
  }
  return { ok: true, status: routing.managed ? 'ok' : 'custom_routing_preserved', runtime: routing.runtime };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--replace-routing') options.replaceRouting = true;
    else if (argument === '--runtime') options.runtime = argv[++index];
    else if (argument === '--target') options.targetRoot = argv[++index];
    else if (argument === '--source') options.sourceRoot = argv[++index];
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function cli(argv = process.argv.slice(2)) {
  const command = argv.shift();
  try {
    const options = parseArgs(argv);
    const result = command === 'verify' ? verifyRuntimeRouting(options) : installRuntimeRouting(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok === false ? 1 : 0;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    return 1;
  }
}

module.exports = {
  RUNTIMES,
  sha256,
  semanticFingerprint,
  resolveRuntime,
  installRuntimeRouting,
  verifyRuntimeRouting,
  cli,
};

if (require.main === module) process.exit(cli());
