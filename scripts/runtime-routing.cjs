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

function runtimeFromActiveRouting(activePath) {
  if (!fs.existsSync(activePath)) return null;
  try {
    const active = readYaml(activePath);
    const runtime = active?.routing_profile?.runtime;
    return RUNTIMES[runtime] ? runtime : null;
  } catch (_) {
    return null;
  }
}

function runtimeRecoveryCommand(runtime, options = {}) {
  const selected = RUNTIMES[runtime] ? runtime : '<codex|claude-code>';
  const replace = options.replaceRouting ? ' --replace-routing' : '';
  return `npx @colmbyrne/specflow update . --runtime ${selected}${replace}`;
}

function routingRequired(status, runtime, detail, options = {}) {
  const recovery_command = runtimeRecoveryCommand(runtime, options);
  return {
    ok: false,
    status,
    code: 'routing_required',
    runtime: RUNTIMES[runtime] ? runtime : null,
    recovery_command,
    provider_invoked: false,
    error: `${detail}; repair: ${recovery_command}`,
  };
}

function verifyInstalledSelectorSkills(sourceRoot, targetRoot, runtime) {
  const shipped = path.join(sourceRoot, 'skills', 'specflow-loop-selector', 'SKILL.md');
  if (!fs.existsSync(shipped)) {
    return routingRequired('missing_shipped_selector', runtime, 'shipped specflow-loop-selector skill is missing');
  }
  const shippedHash = sha256(fs.readFileSync(shipped));
  for (const root of ['.claude/skills', '.codex/skills', '.agents/skills']) {
    const installed = path.join(targetRoot, root, 'specflow-loop-selector', 'SKILL.md');
    if (!fs.existsSync(installed)) {
      return routingRequired('missing_selector_skill', runtime, `${path.relative(targetRoot, installed)} is missing`);
    }
    if (sha256(fs.readFileSync(installed)) !== shippedHash) {
      return routingRequired('outdated_selector_skill', runtime, `${path.relative(targetRoot, installed)} differs from the shipped selector skill`);
    }
  }
  return { ok: true, status: 'ok', selector_sha256: shippedHash };
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
  const sourceRoot = path.resolve(options.sourceRoot || path.join(__dirname, '..'));
  const targetRoot = path.resolve(options.targetRoot || '.');
  const statePath = path.join(targetRoot, '.specflow', 'install-state.yml');
  const activePath = path.join(targetRoot, '.specflow', 'adapter-routing.yml');
  const state = loadInstallState(statePath);
  if (!state || state.schema_version !== STATE_SCHEMA_VERSION || !state.routing) {
    const inferredRuntime = options.runtime || runtimeFromActiveRouting(activePath);
    return routingRequired('missing_install_state', inferredRuntime, 'routing install state is missing or invalid');
  }
  const routing = state.routing;
  if (!RUNTIMES[routing.runtime] || routing.template !== RUNTIMES[routing.runtime]) {
    return routingRequired('runtime_mismatch', routing.runtime, 'routing runtime/template mismatch');
  }
  if (!fs.existsSync(activePath)) {
    return routingRequired('missing_routing', routing.runtime, 'managed adapter routing is missing');
  }
  const actualHash = sha256(fs.readFileSync(activePath));
  if (routing.managed && actualHash !== routing.installed_sha256) {
    return routingRequired('stale_routing', routing.runtime, 'managed adapter routing differs from install state', { replaceRouting: true });
  }
  if (routing.managed) {
    try {
      const active = readYaml(activePath);
      if (!active.routing_profile || active.routing_profile.runtime !== routing.runtime) {
        return routingRequired('runtime_mismatch', routing.runtime, 'active routing runtime differs from install state');
      }
    } catch (_) {
      return routingRequired('stale_routing', routing.runtime, 'managed adapter routing is invalid YAML', { replaceRouting: true });
    }
  }
  const installedTemplate = path.join(targetRoot, '.specflow', 'adapter-policies', routing.template);
  if (!fs.existsSync(installedTemplate) || sha256(fs.readFileSync(installedTemplate)) !== routing.template_sha256) {
    return routingRequired('stale_template', routing.runtime, 'installed routing template differs from install state');
  }
  const shippedTemplate = path.join(sourceRoot, 'templates', 'adapter-policies', routing.template);
  if (!fs.existsSync(shippedTemplate)
    || sha256(fs.readFileSync(shippedTemplate)) !== routing.template_sha256
    || state.specflow_version !== packageVersion(sourceRoot)) {
    return routingRequired('outdated_install', routing.runtime, 'routing template or install state differs from the shipped Specflow version');
  }
  let selector = null;
  if (options.verifySkills) {
    selector = verifyInstalledSelectorSkills(sourceRoot, targetRoot, routing.runtime);
    if (!selector.ok) return selector;
  }
  return {
    ok: true,
    status: routing.managed ? 'ok' : 'custom_routing_preserved',
    runtime: routing.runtime,
    selector_sha256: selector?.selector_sha256 || null,
    provider_invoked: false,
  };
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
    const result = command === 'verify' ? verifyRuntimeRouting({ ...options, verifySkills: true }) : installRuntimeRouting(options);
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
  verifyInstalledSelectorSkills,
  runtimeRecoveryCommand,
  routingRequired,
  cli,
};

if (require.main === module) process.exit(cli());
