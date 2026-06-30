#!/usr/bin/env node
/**
 * specflow-runner.cjs — local contracted loop runner helpers.
 *
 * The runner owns durable state, ledgers, adapter policy validation, and provider
 * command construction. It does not make model output a gate result; callers must
 * rerun the owning Specflow gate before advancing.
 */

const { spawnSync } = require('child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } = require('fs');
const { dirname, join, resolve } = require('path');
const yaml = require('js-yaml');

const LOOP_PATHS = {
  'spec-build': 'templates/QA/loops/spec-build.yaml',
  'feature-build': 'templates/QA/loops/feature-build.yaml',
  'gate-d': 'templates/QA/loops/feature-build.yaml',
  'daily-use-teardown': 'templates/QA/loops/daily-use-teardown.yaml',
};

const REQUIRED_CONTRACT_FIELDS = [
  'loop',
  'goal',
  'input_artifact',
  'path',
  'current_stage_or_rail',
  'next_gate',
  'durable_evidence',
  'stop_condition',
  'never_without_human',
];

const REQUIRED_POLICY_FIELDS = [
  'id',
  'provider',
  'command',
  'timeout_seconds',
  'max_iterations',
  'transcript_path',
  'output_path',
  'never_without_human',
];

function ensureDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function parseKeyValueArgs(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const key = a.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function defaultRunPaths(slug, options = {}) {
  const base = join('.specflow', 'runs', slug);
  const contractPath = options.contract || join(base, 'run-contract.yaml');
  const ledgerPath = options.ledger || join(dirname(contractPath), 'ledger.jsonl');
  return { contractPath, ledgerPath };
}

function createRunContract({ loop, slug, goal, input, contractPath, ledgerPath }) {
  if (!LOOP_PATHS[loop]) throw new Error(`unknown loop "${loop}"`);
  return {
    run_contract: {
      loop,
      goal,
      input_artifact: input,
      path: LOOP_PATHS[loop],
      current_stage_or_rail: loop === 'feature-build' ? '1_ticket' : 'discover',
      next_gate: loop === 'feature-build'
        ? 'ticket + ACs + journey id confirmed'
        : 'grounding written with problem + oracle',
      durable_evidence: [contractPath, ledgerPath],
      simulation_required: loop === 'spec-build',
      stop_condition: 'continue until handoff, human gate, missing evidence, or failure',
      never_without_human: ['git push', 'open PR', 'merge', '--no-verify', 'override contract'],
      budgets: {},
      terminal_status: 'in_progress',
      storage: {
        contract_path: contractPath,
        ledger_path: ledgerPath,
      },
    },
  };
}

function loadDataFile(path) {
  const text = readFileSync(path, 'utf8');
  if (/\.json$/i.test(path)) return JSON.parse(text);
  return yaml.load(text);
}

function writeYaml(path, value) {
  ensureDir(path);
  writeFileSync(path, yaml.dump(value, { lineWidth: 120, noRefs: true }), 'utf8');
}

function loadRunContract(path) {
  const data = loadDataFile(path);
  return data && data.run_contract ? data.run_contract : data;
}

function validateRunContract(contract) {
  const missing = REQUIRED_CONTRACT_FIELDS.filter((field) => {
    const value = contract && contract[field];
    return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);
  });
  if (missing.length) return { ok: false, errors: missing.map((field) => `run_contract.${field} is required`) };
  if (!LOOP_PATHS[contract.loop]) return { ok: false, errors: [`run_contract.loop is unsupported: ${contract.loop}`] };
  return { ok: true, errors: [] };
}

function appendLedger(ledgerPath, entry) {
  ensureDir(ledgerPath);
  appendFileSync(ledgerPath, `${JSON.stringify({ recorded_at: new Date().toISOString(), ...entry })}\n`, 'utf8');
}

function resolveTemplate(value, context) {
  return String(value).replace(/<slug>/g, context.slug || 'run').replace(/\$\{slug\}/g, context.slug || 'run');
}

function normalizeAdapterPolicy(raw, context = {}) {
  const policy = raw && raw.adapter_policy ? raw.adapter_policy : raw;
  if (!policy || typeof policy !== 'object') throw new Error('adapter_policy object is required');
  const missing = REQUIRED_POLICY_FIELDS.filter((field) => policy[field] === undefined || policy[field] === null || policy[field] === '');
  if (missing.length) throw new Error(`adapter_policy missing required field(s): ${missing.join(', ')}`);
  if (!['claude-print', 'codex-exec', 'fake'].includes(policy.provider)) {
    throw new Error(`adapter_policy.provider is unsupported: ${policy.provider}`);
  }
  return {
    ...policy,
    args: policy.args || [],
    allowed_tools: policy.allowed_tools || [],
    denied_tools: policy.denied_tools || [],
    dry_run: Boolean(policy.dry_run),
    transcript_path: resolveTemplate(policy.transcript_path, context),
    output_path: resolveTemplate(policy.output_path, context),
  };
}

function buildAdapterCommand(policy, promptPath) {
  const allowedTools = policy.allowed_tools || [];
  const deniedTools = policy.denied_tools || [];
  if (policy.provider === 'claude-print') {
    const args = policy.args.length ? [...policy.args] : ['-p', '--output-format', 'stream-json'];
    if (!args.includes('-p') && !args.includes('--print')) args.unshift('-p');
    if (policy.model && !args.includes('--model')) args.push('--model', String(policy.model));
    if (policy.max_budget_usd !== undefined && !args.includes('--max-budget-usd')) {
      args.push('--max-budget-usd', String(policy.max_budget_usd));
    }
    if (allowedTools.length && !args.includes('--allowedTools') && !args.includes('--allowed-tools')) {
      args.push('--allowedTools', allowedTools.join(','));
    }
    if (deniedTools.length && !args.includes('--disallowedTools') && !args.includes('--disallowed-tools')) {
      args.push('--disallowedTools', deniedTools.join(','));
    }
    if (promptPath) args.push(readFileSync(promptPath, 'utf8'));
    return { command: policy.command || 'claude', args };
  }

  if (policy.provider === 'codex-exec') {
    const args = ['exec', ...(policy.args || [])];
    if (!args.includes('--json')) args.push('--json');
    if (policy.model && !args.includes('--model')) args.push('--model', String(policy.model));
    if (policy.profile && !args.includes('--profile')) args.push('--profile', String(policy.profile));
    if (policy.output_schema && !args.includes('--output-schema')) args.push('--output-schema', String(policy.output_schema));
    if (promptPath) args.push(readFileSync(promptPath, 'utf8'));
    return { command: policy.command || 'codex', args };
  }

  return { command: policy.command, args: policy.args || [] };
}

function commandExists(command) {
  if (process.platform === 'win32') {
    return spawnSync('where', [command], { stdio: 'ignore' }).status === 0;
  }
  const escaped = String(command).replace(/'/g, "'\\''");
  return spawnSync(`command -v '${escaped}'`, { shell: true, stdio: 'ignore' }).status === 0;
}

function containsForbiddenAction(text, neverWithoutHuman = []) {
  const lower = String(text || '').toLowerCase();
  return neverWithoutHuman.find((action) => lower.includes(String(action).toLowerCase())) || null;
}

function runAdapter(policy, options = {}) {
  const planned = buildAdapterCommand(policy, options.promptPath);
  const baseEntry = {
    stage: options.stage || 'agent_action_required',
    provider: policy.provider,
    argv: [planned.command, ...planned.args],
    transcript_path: policy.transcript_path,
    output_path: policy.output_path,
  };

  if (policy.dry_run || options.dryRun) {
    return { status: 'dry_run', entry: { ...baseEntry, stop_reason: 'dry_run' }, planned };
  }

  if (policy.provider !== 'fake' && !commandExists(planned.command)) {
    return {
      status: 'adapter_unavailable',
      entry: {
        ...baseEntry,
        exit_code: null,
        stop_reason: 'adapter_unavailable',
        remediation: `Install or authenticate ${planned.command} before running provider ${policy.provider}`,
      },
    };
  }

  ensureDir(policy.transcript_path);
  ensureDir(policy.output_path);

  let result;
  if (policy.provider === 'fake') {
    result = {
      status: policy.fake_exit_code || 0,
      stdout: policy.fake_stdout || '',
      stderr: policy.fake_stderr || '',
      signal: null,
      error: null,
    };
  } else {
    result = spawnSync(planned.command, planned.args, {
      encoding: 'utf8',
      timeout: Number(policy.timeout_seconds) * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
  }

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  writeFileSync(policy.transcript_path, stdout + (stderr ? `\n${stderr}` : ''), 'utf8');

  const forbidden = containsForbiddenAction(`${stdout}\n${stderr}`, policy.never_without_human);
  if (forbidden) {
    return {
      status: 'blocked_human_required',
      entry: { ...baseEntry, exit_code: result.status, stop_reason: 'blocked_human_required', forbidden_action_detected: forbidden },
    };
  }

  if (result.error || result.signal === 'SIGTERM' || result.status !== 0) {
    return {
      status: 'adapter_failed',
      entry: { ...baseEntry, exit_code: result.status, stop_reason: 'adapter_failed', failure: result.error?.message || result.signal || stderr },
    };
  }

  writeFileSync(policy.output_path, stdout, 'utf8');
  return {
    status: 'gate_rerun_required',
    entry: {
      ...baseEntry,
      exit_code: 0,
      stop_reason: 'gate_rerun_required',
      forbidden_action_detected: false,
      owning_gate_command: options.owningGateCommand || null,
    },
  };
}

function runLoop(options) {
  const slug = options.slug || 'specflow-run';
  const { contractPath, ledgerPath } = defaultRunPaths(slug, options);
  let wrapper;

  if (existsSync(contractPath)) {
    wrapper = { run_contract: loadRunContract(contractPath) };
  } else {
    wrapper = createRunContract({
      loop: options.loop,
      slug,
      goal: options.goal || `Run ${options.loop}`,
      input: options.input || 'unspecified',
      contractPath,
      ledgerPath,
    });
    writeYaml(contractPath, wrapper);
  }

  const contract = wrapper.run_contract;
  const validation = validateRunContract(contract);
  if (!validation.ok) {
    appendLedger(ledgerPath, { stage: contract.current_stage_or_rail || null, result: 'fail', stop_reason: 'invalid_contract', errors: validation.errors });
    return { status: 'invalid_contract', errors: validation.errors, contractPath, ledgerPath };
  }

  if (options.adapterPolicy) {
    const policy = normalizeAdapterPolicy(loadDataFile(options.adapterPolicy), { slug });
    const adapterResult = runAdapter(policy, {
      dryRun: options.adapterDryRun,
      promptPath: options.prompt,
      stage: contract.current_stage_or_rail,
      owningGateCommand: options.owningGateCommand,
    });
    appendLedger(ledgerPath, adapterResult.entry);
    contract.terminal_status = adapterResult.status === 'gate_rerun_required' ? 'in_progress' : 'blocked';
    contract.current_stage_or_rail = adapterResult.status === 'gate_rerun_required' ? contract.current_stage_or_rail : contract.current_stage_or_rail;
    writeYaml(contractPath, { run_contract: contract });
    return { ...adapterResult, contractPath, ledgerPath };
  }

  appendLedger(ledgerPath, {
    stage: contract.current_stage_or_rail,
    result: 'skipped',
    stop_reason: 'agent_action_required',
    next_action: contract.next_gate,
  });
  contract.terminal_status = 'blocked';
  writeYaml(contractPath, { run_contract: contract });
  return { status: 'agent_action_required', contractPath, ledgerPath };
}

function cli(argv = process.argv.slice(2)) {
  const opts = parseKeyValueArgs(argv);
  const loop = opts._[0];
  if (!loop) {
    console.error('Usage: specflow run <loop> --slug <slug> --goal <goal> --input <path> [--contract path] [--ledger path] [--adapter-policy path] [--adapter-dry-run]');
    return 2;
  }
  try {
    const result = runLoop({ ...opts, loop });
    if (result.status === 'invalid_contract') {
      console.error(`specflow run failed: ${result.errors.join('; ')}`);
      return 1;
    }
    console.log(JSON.stringify(result, null, 2));
    return 0;
  } catch (e) {
    console.error(`specflow run failed: ${e.message}`);
    return 1;
  }
}

module.exports = {
  LOOP_PATHS,
  parseKeyValueArgs,
  defaultRunPaths,
  createRunContract,
  loadRunContract,
  validateRunContract,
  appendLedger,
  normalizeAdapterPolicy,
  buildAdapterCommand,
  commandExists,
  containsForbiddenAction,
  runAdapter,
  runLoop,
  cli,
};

if (require.main === module) process.exit(cli());
