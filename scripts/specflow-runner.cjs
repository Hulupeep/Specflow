#!/usr/bin/env node
/**
 * specflow-runner.cjs — local contracted loop runner helpers.
 *
 * The runner owns durable state, ledgers, adapter policy validation, and provider
 * command construction. It does not make model output a gate result; callers must
 * rerun the owning Specflow gate before advancing.
 */

const { spawnSync } = require('child_process');
const { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync, statSync } = require('fs');
const { basename, dirname, join, resolve } = require('path');
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

const UNKNOWN = 'unknown';

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

function defaultStatePaths(contractPath, options = {}) {
  const parts = resolve(contractPath || '.specflow/runs/run/run-contract.yaml').split(/[\\/]/);
  const specflowIndex = parts.lastIndexOf('.specflow');
  const base = specflowIndex !== -1 ? parts.slice(0, specflowIndex + 1).join('/') : dirname(contractPath || '.');
  return {
    statePath: options.statePath || join(base, 'STATE.md'),
    lessonDir: options.lessonDir || join(base, 'lessons'),
  };
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
        ...defaultStatePaths(contractPath),
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

function slugify(value) {
  return String(value || 'lesson').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'lesson';
}

function ensureStateFile(statePath) {
  if (existsSync(statePath)) return;
  ensureDir(statePath);
  writeFileSync(statePath, [
    '# Specflow State',
    '',
    '## Verified Facts',
    '',
    '## Failed Gates',
    '',
    '## Distilled Rules',
    '',
    '## Open Questions',
    '',
    '## Last Session',
    '',
  ].join('\n'), 'utf8');
}

function appendStateMemory({ statePath, lessonDir, update = {} }) {
  ensureStateFile(statePath);
  const lines = [];
  const at = update.recorded_at || new Date().toISOString();
  if (update.verified_fact) lines.push(`- ${at}: ${update.verified_fact}`);
  if (update.failed_gate) lines.push(`- ${at}: ${update.failed_gate}`);
  if (update.distilled_rule) lines.push(`- ${at}: ${update.distilled_rule}`);
  if (update.open_question) lines.push(`- ${at}: ${update.open_question}`);
  if (update.last_session) lines.push(`- ${at}: ${update.last_session}`);
  if (lines.length) appendFileSync(statePath, `\n## Update ${at}\n${lines.join('\n')}\n`, 'utf8');

  let lessonPath = null;
  if (update.lesson_summary) {
    mkdirSync(lessonDir, { recursive: true });
    lessonPath = join(lessonDir, `${slugify(update.lesson_summary)}.md`);
    writeFileSync(lessonPath, [
      `# ${update.lesson_summary}`,
      '',
      update.lesson_body || update.distilled_rule || update.verified_fact || update.last_session || '',
      '',
    ].join('\n'), 'utf8');
  }
  return { statePath, lessonPath };
}

function readStateDigest(statePath, lessonDir, limit = 2400) {
  const chunks = [];
  if (statePath && existsSync(statePath)) chunks.push(readFileSync(statePath, 'utf8').trim());
  if (lessonDir && existsSync(lessonDir)) {
    const lessons = readdirSync(lessonDir).filter((f) => f.endsWith('.md')).sort().slice(-5);
    for (const lesson of lessons) {
      const firstLine = readFileSync(join(lessonDir, lesson), 'utf8').split(/\r?\n/)[0];
      chunks.push(`lesson:${lesson}: ${firstLine}`);
    }
  }
  return chunks.join('\n\n').slice(-limit);
}

function recordRunState(contract, { contractPath, ledgerPath, status, stopReason }) {
  const paths = {
    ...defaultStatePaths(contractPath),
    ...(contract.storage || {}),
  };
  return appendStateMemory({
    statePath: paths.statePath,
    lessonDir: paths.lessonDir,
    update: {
      failed_gate: status === 'gate_failed' ? `${contract.current_stage_or_rail}: ${contract.next_gate}` : null,
      last_session: `${contract.loop}/${contract.current_stage_or_rail} stopped with ${status}${stopReason ? ` (${stopReason})` : ''}; ledger ${ledgerPath}`,
    },
  });
}

function gitOutput(args, cwd = '.') {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args.join(' ')} failed`);
  return (result.stdout || '').trim();
}

function prepareWorktree(options = {}) {
  const repoRoot = options.repoRoot || process.cwd();
  const baseRef = options.baseRef || 'HEAD';
  const branch = options.branch || `specflow/${options.slug || 'delegate'}`;
  const worktreePath = options.worktreePath || join(repoRoot, '.specflow', 'worktrees', slugify(branch));
  const create = options.create === true;
  let action = 'referenced';
  if (create && !existsSync(worktreePath)) {
    mkdirSync(dirname(worktreePath), { recursive: true });
    gitOutput(['worktree', 'add', '-B', branch, worktreePath, baseRef], repoRoot);
    action = 'created';
  }
  const baseCommit = gitOutput(['rev-parse', baseRef], repoRoot);
  return {
    action,
    worktree_path: worktreePath,
    branch,
    base_ref: baseRef,
    base_commit: baseCommit,
    read_only: options.readOnly === true,
    cleanup_required: create,
    auto_merge: false,
    auto_push: false,
  };
}

function scaffoldRoutineManifest(options = {}) {
  const slug = options.slug || 'specflow-routine';
  const kind = options.kind || 'cron';
  const interval = options.interval || 'daily';
  const loop = options.loop || 'spec-build';
  const command = options.command || `npx @colmbyrne/specflow run ${loop} --slug ${slug} --goal ${shellQuote(options.goal || `Run ${slug}`)} --input ${options.input || 'docs/idea.md'} --until-terminal`;
  const outPath = options.outPath || join('docs', 'routines', `${slug}.${kind}.yml`);
  const manifest = {
    routine: {
      slug,
      kind,
      trigger: options.trigger || interval,
      loop,
      loop_interval: options.loopInterval || interval,
      command,
      input: options.input || 'docs/idea.md',
      outputs: options.outputs || [`.specflow/runs/${slug}/run-contract.yaml`, `.specflow/runs/${slug}/ledger.jsonl`],
      budget: options.budget || { max_iterations: 8 },
      never_without_human: options.neverWithoutHuman || ['git push', 'open PR', 'merge', '--no-verify', 'override contract'],
      proposal_policy: 'project improvements must enter spec-build before implementation',
    },
  };
  ensureDir(outPath);
  writeFileSync(outPath, yaml.dump(manifest, { lineWidth: 120, noRefs: true }), 'utf8');
  return { outPath, manifest };
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function runCommand(command, options = {}) {
  const result = spawnSync(command, {
    shell: true,
    encoding: 'utf8',
    timeout: options.timeoutSeconds ? options.timeoutSeconds * 1000 : undefined,
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    command,
    exit_code: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    error: result.error ? result.error.message : null,
  };
}

function fileMtimeMs(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function isSimulationFresh({ simulationPath, inputPaths = [] }) {
  const simulationTime = fileMtimeMs(simulationPath);
  if (!simulationTime) return { ok: false, reason: 'simulation evidence missing' };
  const staleInput = inputPaths.find((p) => {
    const mtime = fileMtimeMs(p);
    return mtime && mtime > simulationTime;
  });
  if (staleInput) return { ok: false, reason: `simulation is older than ${staleInput}` };
  return { ok: true, reason: null };
}

function loadLoopDefinition(contractOrLoop, options = {}) {
  const loop = typeof contractOrLoop === 'string' ? contractOrLoop : contractOrLoop.loop;
  const definitionPath = (typeof contractOrLoop === 'object' && contractOrLoop.path) || LOOP_PATHS[loop];
  if (!definitionPath) return null;
  const root = options.root || process.cwd();
  const absolute = resolve(root, definitionPath);
  if (!existsSync(absolute)) return null;
  return loadDataFile(absolute);
}

function loopSequenceFromDefinition(definition) {
  if (!definition || typeof definition !== 'object') return [];
  const collection = Array.isArray(definition.stages) ? definition.stages : definition.rails;
  if (!Array.isArray(collection)) return [];
  return collection.map((item) => item && item.id).filter(Boolean);
}

function fallbackLoopSequence(contract) {
  if (contract.loop === 'feature-build') {
    return ['1_ticket', '2_contract', '3_e2e', '4_oracle', '5_impl', '6_provenance', '7_ci_handoff'];
  }
  if (contract.loop === 'spec-build') {
    return ['discover', 'draft', 'adversary', 'GATE_A', 'tickets', 'GATE_B', 'GATE_B5', 'handoff'];
  }
  return [];
}

function loopSequence(contract, options = {}) {
  const fromDefinition = loopSequenceFromDefinition(loadLoopDefinition(contract, options));
  return fromDefinition.length ? fromDefinition : fallbackLoopSequence(contract);
}

function nextStage(contract, options = {}) {
  const sequence = loopSequence(contract, options);
  const index = sequence.indexOf(contract.current_stage_or_rail);
  if (index === -1 || index === sequence.length - 1) return contract.current_stage_or_rail;
  return sequence[index + 1];
}

function defaultSpecDir(slug) {
  return join('docs', 'specs', slug);
}

// --- VERIFIER-CONTRACT-01 (epic #100): verification contract lifecycle -------
// Maker proposes a slice-local verification contract; an independent verifier
// accepts or rejects it BEFORE implementation. Acceptance is an explicit,
// complete contract artifact — never a provider exit code or maker summary.

const VERIFICATION_CONTRACT_FIELDS = [
  'journey_id',
  'maker_policy_id',
  'verifier_policy_id',
  'runtime_checks',
  'forbidden_evidence',
];

function verificationPaths(options = {}) {
  const base = options.runDir
    || (options.contract ? dirname(options.contract) : dirname(defaultRunPaths(options.slug || 'run', options).contractPath));
  return {
    baseDir: base,
    proposalPath: join(base, 'verification-proposal.md'),
    contractPath: join(base, 'verification-contract.json'),
    findingsPath: join(base, 'verifier-findings.jsonl'),
    runtimeEvidenceDir: join(base, 'runtime-evidence'),
    ledgerPath: options.ledger || join(base, 'ledger.jsonl'),
  };
}

function writeVerificationProposal(options = {}) {
  const paths = verificationPaths(options);
  const journeyId = options.journeyId || options.journey_id;
  if (!journeyId) throw new Error('writeVerificationProposal requires journeyId');
  const runtimeChecks = options.runtimeChecks || options.runtime_checks || [];
  const forbiddenEvidence = options.forbiddenEvidence || options.forbidden_evidence
    || ['maker self-review', 'provider exit code as gate pass'];
  const proposedAt = options.proposedAt || new Date().toISOString();
  const content = [
    `# Verification Proposal — ${journeyId}`,
    '',
    `- Proposed at: ${proposedAt}`,
    `- Maker policy: ${options.makerPolicyId || options.maker_policy_id || UNKNOWN}`,
    `- Verifier policy: ${options.verifierPolicyId || options.verifier_policy_id || UNKNOWN}`,
    '',
    '## Proposed runtime checks',
    runtimeChecks.length
      ? runtimeChecks.map((c) => `- [${c.type}] ${c.assertion || c.command || ''}${c.required ? ' (required)' : ''}`).join('\n')
      : '- (none proposed — verifier must reject if this slice needs runtime/value/negative-path evidence)',
    '',
    '## Forbidden evidence',
    forbiddenEvidence.map((f) => `- ${f}`).join('\n'),
    '',
    options.body ? `## Notes\n\n${options.body}\n` : '',
  ].join('\n');
  ensureDir(paths.proposalPath);
  writeFileSync(paths.proposalPath, content, 'utf8');
  appendLedger(paths.ledgerPath, {
    stage: 'verification',
    event: 'proposal_written',
    journey_id: journeyId,
    proposal_path: paths.proposalPath,
    verification_contract_path: null,
    verifier_decision: 'pending',
    mechanical_gate_state: 'not_run',
  });
  return { proposalPath: paths.proposalPath, ledgerPath: paths.ledgerPath };
}

function decideVerification(options = {}) {
  const paths = verificationPaths(options);
  const decision = options.decision;
  if (!['accept', 'reject'].includes(decision)) {
    throw new Error("decideVerification requires decision 'accept' or 'reject'");
  }
  if (!existsSync(paths.proposalPath)) {
    throw new Error('cannot decide verification before a proposal is written');
  }

  if (decision === 'reject') {
    const missingCheck = options.missingCheck || options.missing_check;
    if (!missingCheck) throw new Error('rejection must name the missing runtime/value/negative-path check');
    appendLedger(paths.ledgerPath, {
      stage: 'verification',
      event: 'verifier_decision',
      verifier_decision: 'rejected',
      proposal_path: paths.proposalPath,
      verification_contract_path: null,
      missing_check: missingCheck,
      blocks_implementation: true,
      mechanical_gate_state: 'blocked',
    });
    return { ok: true, decision: 'rejected', blocksImplementation: true, contractPath: null };
  }

  const vc = options.verificationContract || options.verification_contract || {};
  const missing = VERIFICATION_CONTRACT_FIELDS.filter((f) => {
    const v = vc[f];
    return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);
  });
  if (missing.length) {
    throw new Error(`accepted verification contract missing field(s): ${missing.join(', ')}`);
  }
  const acceptedAt = options.acceptedAt || vc.accepted_at || new Date().toISOString();
  const contract = { ...vc, accepted_at: acceptedAt };
  ensureDir(paths.contractPath);
  writeFileSync(paths.contractPath, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  appendLedger(paths.ledgerPath, {
    stage: 'verification',
    event: 'verifier_decision',
    verifier_decision: 'accepted',
    proposal_path: paths.proposalPath,
    verification_contract_path: paths.contractPath,
    journey_id: contract.journey_id,
    mechanical_gate_state: 'pending',
  });
  return { ok: true, decision: 'accepted', contractPath: paths.contractPath, contract };
}

function requireAcceptedVerificationContract(options = {}) {
  const paths = verificationPaths(options);
  if (!existsSync(paths.contractPath)) {
    return { accepted: false, contractPath: paths.contractPath, reason: 'no accepted verification contract; maker implementation is blocked' };
  }
  let data;
  try {
    data = JSON.parse(readFileSync(paths.contractPath, 'utf8'));
  } catch {
    return { accepted: false, contractPath: paths.contractPath, reason: 'verification contract is not valid JSON' };
  }
  if (!data.accepted_at) {
    return { accepted: false, contractPath: paths.contractPath, reason: 'verification contract missing accepted_at' };
  }
  const missing = VERIFICATION_CONTRACT_FIELDS.filter((f) => data[f] === undefined || data[f] === null);
  if (missing.length) {
    return { accepted: false, contractPath: paths.contractPath, reason: `verification contract missing: ${missing.join(', ')}` };
  }
  return { accepted: true, contractPath: paths.contractPath, contract: data, reason: null };
}

// --- VERIFIER-POLICY-01 (epic #100): verifier policy isolation ---------------
// The verifier policy is distinct from the maker policy (separate id and
// output/transcript paths) and is fed artifact + spec + accepted verification
// contract + rubric. The maker reasoning transcript is excluded by default;
// including it requires a human-recorded ledger exception.

function resolveVerifierPolicy(rawMaker, context = {}) {
  const maker = normalizeAdapterPolicy(rawMaker, context);
  if (!maker.verifier_policy) {
    throw new Error('maker adapter_policy does not declare a verifier_policy');
  }
  const verifier = normalizeAdapterPolicy(maker.verifier_policy, context);
  const errors = [];
  if (verifier.id === maker.id) errors.push('verifier_policy.id must differ from maker policy id');
  if (verifier.transcript_path === maker.transcript_path) errors.push('verifier transcript_path must differ from maker transcript_path');
  if (verifier.output_path === maker.output_path) errors.push('verifier output_path must differ from maker output_path');
  if (errors.length) throw new Error(`verifier policy not isolated: ${errors.join('; ')}`);
  return { maker, verifier: { ...verifier, role: verifier.role || 'verifier' } };
}

function assembleVerifierInput(options = {}) {
  const required = ['artifactPath', 'specPath', 'verificationContractPath', 'rubric'];
  const missing = required.filter((k) => !options[k]);
  if (missing.length) {
    throw new Error(`verifier input missing required field(s): ${missing.join(', ')}`);
  }
  const input = {
    artifact_path: options.artifactPath,
    spec_path: options.specPath,
    verification_contract_path: options.verificationContractPath,
    rubric: options.rubric,
    includes_maker_trace: false,
    maker_transcript_path: null,
  };
  if (options.allowMakerTrace) {
    const exception = options.humanException || options.human_exception || {};
    const approvedBy = exception.approved_by || exception.approvedBy;
    const reason = exception.reason;
    if (!approvedBy || !reason) {
      throw new Error('including the maker transcript requires a human exception with approved_by and reason');
    }
    input.includes_maker_trace = true;
    input.maker_transcript_path = options.makerTranscriptPath || null;
    input.maker_trace_exception = { approved_by: approvedBy, reason };
    if (options.ledger) {
      appendLedger(options.ledger, {
        stage: 'verification',
        event: 'verifier_maker_trace_exception',
        approved_by: approvedBy,
        reason,
        maker_transcript_path: input.maker_transcript_path,
      });
    }
  }
  return input;
}

function verifierCommandsForStage(contract, options = {}) {
  const slug = options.slug || options.specSlug || contract.slug || 'specflow-run';
  const specDir = options.specDir || defaultSpecDir(slug);
  const stage = contract.current_stage_or_rail;
  if (contract.loop === 'spec-build' && stage === 'GATE_A') {
    return [{
      name: 'verify-falsification',
      command: `node scripts/verify-falsification.cjs ${shellQuote(join(specDir, 'falsification.md'))} --require-pass --binds-prd ${shellQuote(join(specDir, 'prd.md'))}`,
    }];
  }
  if (contract.loop === 'spec-build' && stage === 'GATE_B') {
    return [
      { name: 'verify-seams', command: `node scripts/verify-seams.cjs ${shellQuote(join(specDir, 'tickets.json'))} --repo-root .` },
      { name: 'verify-adr', command: `node scripts/verify-adr.cjs ${shellQuote(join(specDir, 'tickets.json'))} --repo-root .` },
      { name: 'verify-ticket-journey', command: `node scripts/verify-ticket-journey.cjs ${shellQuote(specDir)} --issues ${shellQuote(join(specDir, 'issues.json'))}` },
    ];
  }
  if (contract.loop === 'feature-build' && stage === '1_ticket') {
    const simulationPath = options.simulationPath;
    const inputPaths = (options.inputPaths || []).filter(Boolean);
    return [{
      name: 'simulation-freshness',
      check: () => {
        if (!simulationPath) return { ok: true, stdout: 'simulation freshness not configured for this run\n', stderr: '' };
        const result = isSimulationFresh({ simulationPath, inputPaths });
        return { ok: result.ok, stdout: result.ok ? 'simulation fresh\n' : '', stderr: result.ok ? '' : `${result.reason}\n` };
      },
    }];
  }
  if (contract.loop === 'feature-build' && stage === '6_provenance') {
    const provenancePath = options.provenance || `evidence/provenance-${options.issue || slug}.json`;
    return [{ name: 'provenance', command: `node scripts/provenance-gate.cjs ${shellQuote(provenancePath)}` }];
  }
  return [];
}

function executeVerifierRegistry(contract, options = {}) {
  const commands = verifierCommandsForStage(contract, options);
  if (!commands.length) {
    return {
      status: 'agent_action_required',
      entries: [{
        stage: contract.current_stage_or_rail,
        result: 'skipped',
        stop_reason: 'agent_action_required',
        next_action: contract.next_gate,
      }],
      advance: false,
    };
  }

  const entries = [];
  for (const item of commands) {
    const result = item.check ? item.check() : runCommand(item.command, options);
    const pass = item.check ? result.ok : result.exit_code === 0;
    entries.push({
      stage: contract.current_stage_or_rail,
      verifier: item.name,
      command: item.command || item.name,
      result: pass ? 'pass' : 'fail',
      exit_code: item.check ? (pass ? 0 : 1) : result.exit_code,
      stdout: result.stdout,
      stderr: result.stderr,
      stop_reason: pass ? null : 'gate_failed',
    });
    if (!pass) return { status: 'gate_failed', entries, advance: false };
  }
  return { status: 'gate_passed', entries, advance: true };
}

function materializeStagePrompt(contract, options = {}) {
  const stage = contract.current_stage_or_rail || 'stage';
  const safeStage = String(stage).replace(/[^a-z0-9._-]+/gi, '-');
  const baseDir = options.promptDir
    || join(dirname(options.contractPath || contract.storage?.contract_path || defaultRunPaths(options.slug || 'specflow-run').contractPath), 'prompts');
  const promptPath = options.promptPath || join(baseDir, `${safeStage}.md`);
  const definition = loadLoopDefinition(contract, options);
  const sequence = loopSequence(contract, options);
  const next = nextStage(contract, options);
  const stageSpec = [
    ...(Array.isArray(definition?.stages) ? definition.stages : []),
    ...(Array.isArray(definition?.rails) ? definition.rails : []),
  ].find((item) => item && item.id === stage);
  const statePaths = {
    ...defaultStatePaths(options.contractPath || contract.storage?.contract_path || defaultRunPaths(options.slug || 'specflow-run').contractPath, options),
    ...(contract.storage || {}),
  };
  const stateDigest = readStateDigest(statePaths.statePath, statePaths.lessonDir);
  const content = [
    `# Specflow ${contract.loop} Stage Prompt`,
    '',
    `Goal: ${contract.goal}`,
    `Input artifact: ${contract.input_artifact}`,
    `Current stage: ${stage}`,
    `Next stage: ${next}`,
    `Next gate: ${contract.next_gate}`,
    '',
    '## Contract Rules',
    `- Loop path: ${contract.path}`,
    `- Stop condition: ${contract.stop_condition}`,
    `- Never without human: ${(contract.never_without_human || []).join(', ') || 'none declared'}`,
    `- Durable evidence: ${(contract.durable_evidence || []).join(', ') || 'none declared'}`,
    '',
    '## Stage Definition',
    stageSpec ? yaml.dump(stageSpec, { lineWidth: 120, noRefs: true }).trim() : 'No YAML stage body found; use the run contract and next gate.',
    '',
    '## State Memory',
    stateDigest || 'No Specflow state memory found for this run.',
    '',
    '## Required Behavior',
    '- Execute only this stage or rail.',
    '- Persist durable evidence before claiming progress.',
    '- Do not mark the gate passed yourself; rerun the owning Specflow verifier after work.',
    '- Stop immediately if a never_without_human action would be required.',
    '',
    `Sequence: ${sequence.join(' -> ')}`,
    '',
  ].join('\n');
  ensureDir(promptPath);
  writeFileSync(promptPath, content, 'utf8');
  return { promptPath, content };
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
  if (policy.role && !['orchestrator', 'planner', 'worker', 'implementer', 'verifier', 'fallback'].includes(policy.role)) {
    throw new Error(`adapter_policy.role is unsupported: ${policy.role}`);
  }
  if (policy.effort && !['low', 'medium', 'high', 'xhigh', 'ultracode'].includes(policy.effort)) {
    throw new Error(`adapter_policy.effort is unsupported: ${policy.effort}`);
  }
  const requestedModel = policy.requested_model || policy.model || null;
  return {
    ...policy,
    requested_model: requestedModel,
    effective_model: policy.effective_model || UNKNOWN,
    role: policy.role || null,
    effort: policy.effort || null,
    fallback_model: policy.fallback_model || null,
    fallback_refusal_reason: policy.fallback_refusal_reason || null,
    args: policy.args || [],
    allowed_tools: policy.allowed_tools || [],
    denied_tools: policy.denied_tools || [],
    prompt: policy.prompt || null,
    session_id: policy.session_id || null,
    verifier_policy: policy.verifier_policy || null,
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
    const requestedModel = policy.requested_model || policy.model;
    if (requestedModel && !args.includes('--model')) args.push('--model', String(requestedModel));
    if (policy.fallback_model && !args.includes('--fallback-model')) args.push('--fallback-model', String(policy.fallback_model));
    if (policy.max_budget_usd !== undefined && !args.includes('--max-budget-usd')) {
      args.push('--max-budget-usd', String(policy.max_budget_usd));
    }
    if (allowedTools.length && !args.includes('--allowedTools') && !args.includes('--allowed-tools')) {
      args.push('--allowedTools', allowedTools.join(','));
    }
    if (deniedTools.length && !args.includes('--disallowedTools') && !args.includes('--disallowed-tools')) {
      args.push('--disallowedTools', deniedTools.join(','));
    }
    if (policy.session_id && !args.includes('--resume') && !args.includes('--session-id')) {
      args.push('--resume', String(policy.session_id));
    }
    if (promptPath) args.push(readFileSync(promptPath, 'utf8'));
    else if (policy.prompt) args.push(String(policy.prompt));
    return { command: policy.command || 'claude', args };
  }

  if (policy.provider === 'codex-exec') {
    const args = policy.session_id
      ? ['exec', 'resume', String(policy.session_id), ...(policy.args || [])]
      : ['exec', ...(policy.args || [])];
    if (!args.includes('--json')) args.push('--json');
    const requestedModel = policy.requested_model || policy.model;
    if (requestedModel && !args.includes('--model')) args.push('--model', String(requestedModel));
    if (policy.profile && !args.includes('--profile')) args.push('--profile', String(policy.profile));
    if (policy.output_schema && !args.includes('--output-schema')) args.push('--output-schema', String(policy.output_schema));
    if (promptPath) args.push(readFileSync(promptPath, 'utf8'));
    else if (policy.prompt) args.push(String(policy.prompt));
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

function pickFirstString(...values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function pickFirstNumber(...values) {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function mergeUsage(current, event) {
  const usage = event.usage || event.message?.usage || event.response?.usage || {};
  const inputTokens = pickFirstNumber(usage.input_tokens, usage.prompt_tokens, event.input_tokens, event.prompt_tokens);
  const outputTokens = pickFirstNumber(usage.output_tokens, usage.completion_tokens, event.output_tokens, event.completion_tokens);
  const totalTokens = pickFirstNumber(
    usage.total_tokens,
    event.total_tokens,
    inputTokens !== null || outputTokens !== null ? Number(inputTokens || 0) + Number(outputTokens || 0) : null,
  );
  const costUsd = pickFirstNumber(usage.cost_usd, usage.estimated_cost_usd, event.cost_usd, event.estimated_cost_usd);
  return {
    input_tokens: current.input_tokens ?? inputTokens,
    output_tokens: current.output_tokens ?? outputTokens,
    total_tokens: current.total_tokens ?? totalTokens,
    estimated_cost_usd: current.estimated_cost_usd ?? costUsd,
  };
}

function parseProviderEvents(provider, text) {
  const events = [];
  const errors = [];
  const toolEvents = [];
  let finalText = '';
  let sessionId = null;
  let effectiveModel = null;
  let fallbackRefusalReason = null;
  let usage = {};

  for (const line of String(text || '').split(/\r?\n/).filter(Boolean)) {
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      finalText += `${line}\n`;
      continue;
    }
    events.push(event);
    sessionId = sessionId || event.session_id || event.sessionId || event.conversation_id || event.conversationId || null;
    effectiveModel = effectiveModel || pickFirstString(
      event.effective_model,
      event.actual_model,
      event.model,
      event.model_id,
      event.modelId,
      event.response?.model,
      event.message?.model,
    );
    fallbackRefusalReason = fallbackRefusalReason || pickFirstString(
      event.fallback_refusal_reason,
      event.fallback_reason,
      event.refusal_reason,
      event.stop_reason,
      event.error?.reason,
      event.error?.message,
    );
    usage = mergeUsage(usage, event);
    const type = String(event.type || event.event || event.kind || '');
    if (/error/i.test(type) || event.error) errors.push(event.error || event);
    if (event.tool || event.tool_call || event.toolCall || /tool|command|exec/i.test(type)) toolEvents.push(event);
    const textValue = event.text || event.content || event.message?.content || event.delta?.text || event.result;
    if (typeof textValue === 'string') finalText += textValue;
  }

  const normalizedUsage = Object.fromEntries(Object.entries(usage).filter(([, value]) => value !== null && value !== undefined));
  return {
    provider,
    session_id: sessionId,
    effective_model: effectiveModel || UNKNOWN,
    fallback_refusal_reason: fallbackRefusalReason || null,
    usage: normalizedUsage,
    final_text: finalText.trim(),
    errors,
    tool_events: toolEvents,
    events,
  };
}

function eventText(event) {
  return JSON.stringify(event);
}

function forbiddenFromProviderEvents(parsed, neverWithoutHuman = [], deniedTools = []) {
  const patterns = [...neverWithoutHuman, ...deniedTools].filter(Boolean);
  for (const event of parsed.tool_events || []) {
    const found = containsForbiddenAction(eventText(event), patterns);
    if (found) return found;
  }
  return containsForbiddenAction(parsed.final_text, neverWithoutHuman);
}

function runAdapter(policy, options = {}) {
  const planned = buildAdapterCommand(policy, options.promptPath);
  const baseEntry = {
    stage: options.stage || 'agent_action_required',
    provider: policy.provider,
    policy_id: policy.id || null,
    role: policy.role || null,
    effort: policy.effort || null,
    requested_model: policy.requested_model || null,
    effective_model: policy.effective_model || UNKNOWN,
    fallback_model: policy.fallback_model || null,
    fallback_refusal_reason: policy.fallback_refusal_reason || null,
    max_budget_usd: policy.max_budget_usd ?? null,
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

  const parsed = parseProviderEvents(policy.provider, `${stdout}\n${stderr}`);
  const providerMetadata = {
    session_id: parsed.session_id,
    effective_model: parsed.effective_model || UNKNOWN,
    fallback_refusal_reason: parsed.fallback_refusal_reason || null,
    usage: Object.keys(parsed.usage || {}).length ? parsed.usage : null,
    input_tokens: parsed.usage?.input_tokens ?? null,
    output_tokens: parsed.usage?.output_tokens ?? null,
    total_tokens: parsed.usage?.total_tokens ?? null,
    estimated_cost_usd: parsed.usage?.estimated_cost_usd ?? null,
  };
  const forbidden = forbiddenFromProviderEvents(parsed, policy.never_without_human, policy.denied_tools);
  if (forbidden) {
    return {
      status: 'blocked_human_required',
      entry: {
        ...baseEntry,
        ...providerMetadata,
        exit_code: result.status,
        stop_reason: 'blocked_human_required',
        forbidden_action_detected: forbidden,
      },
    };
  }

  if (result.error || result.signal === 'SIGTERM' || result.status !== 0) {
    return {
      status: 'adapter_failed',
      entry: {
        ...baseEntry,
        ...providerMetadata,
        exit_code: result.status,
        stop_reason: 'adapter_failed',
        failure: result.error?.message || result.signal || stderr,
      },
    };
  }

  writeFileSync(policy.output_path, parsed.final_text || stdout, 'utf8');
  return {
    status: 'gate_rerun_required',
    entry: {
      ...baseEntry,
      ...providerMetadata,
      exit_code: 0,
      final_response_chars: (parsed.final_text || stdout).length,
      tool_event_count: parsed.tool_events.length,
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
    const prompt = options.prompt ? { promptPath: options.prompt } : materializeStagePrompt(contract, { ...options, contractPath, slug });
    const adapterResult = runAdapter(policy, {
      dryRun: options.adapterDryRun,
      promptPath: prompt.promptPath,
      stage: contract.current_stage_or_rail,
      owningGateCommand: options.owningGateCommand,
    });
    appendLedger(ledgerPath, { ...adapterResult.entry, prompt_path: prompt.promptPath });
    contract.terminal_status = adapterResult.status === 'gate_rerun_required' ? 'in_progress' : 'blocked';
    contract.current_stage_or_rail = adapterResult.status === 'gate_rerun_required' ? contract.current_stage_or_rail : contract.current_stage_or_rail;
    if (adapterResult.entry && adapterResult.entry.session_id) contract.provider_session_id = adapterResult.entry.session_id;
    recordRunState(contract, {
      contractPath,
      ledgerPath,
      status: adapterResult.status,
      stopReason: adapterResult.entry?.stop_reason,
    });
    writeYaml(contractPath, { run_contract: contract });
    return { ...adapterResult, contractPath, ledgerPath };
  }

  const registryResult = executeVerifierRegistry(contract, options);
  let promptPath = null;
  if (registryResult.status === 'agent_action_required') {
    promptPath = materializeStagePrompt(contract, { ...options, contractPath, slug }).promptPath;
  }
  for (const entry of registryResult.entries) appendLedger(ledgerPath, promptPath ? { ...entry, prompt_path: promptPath } : entry);
  if (registryResult.advance) {
    contract.current_stage_or_rail = nextStage(contract, options);
    contract.next_gate = `advance to ${contract.current_stage_or_rail}`;
    contract.terminal_status = contract.current_stage_or_rail === 'handoff' ? 'handoff' : 'in_progress';
  } else {
    contract.terminal_status = registryResult.status === 'gate_failed' ? 'failed' : 'blocked';
  }
  if (['agent_action_required', 'gate_failed'].includes(registryResult.status)) {
    recordRunState(contract, {
      contractPath,
      ledgerPath,
      status: registryResult.status,
      stopReason: registryResult.entries[registryResult.entries.length - 1]?.stop_reason,
    });
  }
  writeYaml(contractPath, { run_contract: contract });
  return { status: registryResult.status, contractPath, ledgerPath };
}

function readLedgerTail(ledgerPath, limit = 10) {
  if (!existsSync(ledgerPath)) return [];
  const lines = readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).filter(Boolean);
  return lines.slice(Math.max(0, lines.length - limit)).map((line) => JSON.parse(line));
}

function readLedger(ledgerPath) {
  if (!existsSync(ledgerPath)) return [];
  return readFileSync(ledgerPath, 'utf8').trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function summarizeLedger(entries) {
  const summary = {
    entries: entries.length,
    gate_attempts: 0,
    gate_passes: 0,
    gate_failures: 0,
    adapter_attempts: 0,
    adapter_successes_requiring_gate_rerun: 0,
    adapter_failures: 0,
    human_blocks: 0,
    unknown_usage_entries: 0,
    known_estimated_cost_usd: 0,
    cost_per_gate_pass_usd: null,
    requested_models: {},
    effective_models: {},
  };
  for (const entry of entries) {
    if (entry.verifier) {
      summary.gate_attempts += 1;
      if (entry.result === 'pass') summary.gate_passes += 1;
      if (entry.result === 'fail') summary.gate_failures += 1;
    }
    if (entry.provider) {
      summary.adapter_attempts += 1;
      if (entry.stop_reason === 'gate_rerun_required') summary.adapter_successes_requiring_gate_rerun += 1;
      if (entry.stop_reason === 'adapter_failed') summary.adapter_failures += 1;
      if (entry.stop_reason === 'blocked_human_required') summary.human_blocks += 1;
      if (entry.estimated_cost_usd === null || entry.estimated_cost_usd === undefined) summary.unknown_usage_entries += 1;
      else summary.known_estimated_cost_usd += Number(entry.estimated_cost_usd);
    }
    if (entry.requested_model) {
      summary.requested_models[entry.requested_model] = (summary.requested_models[entry.requested_model] || 0) + 1;
    }
    const effective = entry.effective_model || (entry.provider ? UNKNOWN : null);
    if (effective) {
      summary.effective_models[effective] = (summary.effective_models[effective] || 0) + 1;
    }
  }
  if (summary.gate_passes > 0 && summary.known_estimated_cost_usd > 0) {
    summary.cost_per_gate_pass_usd = summary.known_estimated_cost_usd / summary.gate_passes;
  }
  return summary;
}

function runStatus(options = {}) {
  const contractPath = options.contract;
  if (!contractPath || !existsSync(contractPath)) {
    return { status: 'missing_contract', error: 'specflow run status requires --contract <path>' };
  }
  const contract = loadRunContract(contractPath);
  const ledgerPath = options.ledger || contract.storage?.ledger_path || join(dirname(contractPath), 'ledger.jsonl');
  return {
    status: 'ok',
    contract_path: contractPath,
    ledger_path: ledgerPath,
    loop: contract.loop,
    current_stage_or_rail: contract.current_stage_or_rail,
    next_gate: contract.next_gate,
    terminal_status: contract.terminal_status || 'unknown',
    sequence: loopSequence(contract, options),
    ledger_summary: summarizeLedger(readLedger(ledgerPath)),
    ledger_tail: readLedgerTail(ledgerPath, Number(options.limit || 10)),
  };
}

function isTerminalStatus(status) {
  return [
    'agent_action_required',
    'gate_failed',
    'invalid_contract',
    'adapter_unavailable',
    'adapter_failed',
    'blocked_human_required',
    'dry_run',
  ].includes(status);
}

function runUntilTerminal(options = {}) {
  const maxIterations = Number(options.maxIterations || 8);
  const iterations = [];
  for (let i = 0; i < maxIterations; i += 1) {
    const result = runLoop({ ...options, untilTerminal: false });
    iterations.push(result);
    if (isTerminalStatus(result.status)) {
      return { status: result.status, iterations: i + 1, results: iterations, contractPath: result.contractPath, ledgerPath: result.ledgerPath };
    }
    const contract = loadRunContract(result.contractPath);
    if (contract.terminal_status === 'handoff') {
      return { status: 'handoff', iterations: i + 1, results: iterations, contractPath: result.contractPath, ledgerPath: result.ledgerPath };
    }
  }
  const last = iterations[iterations.length - 1] || {};
  return {
    status: 'iteration_budget_exhausted',
    iterations: maxIterations,
    results: iterations,
    contractPath: last.contractPath,
    ledgerPath: last.ledgerPath,
  };
}

function planAdapterSmoke(provider, options = {}) {
  const policy = normalizeAdapterPolicy({
    id: `${provider}-smoke`,
    provider,
    command: provider === 'claude-print' ? 'claude' : 'codex',
    args: provider === 'claude-print'
      ? ['-p', '--output-format', 'json']
      : ['--sandbox', 'read-only', '--ask-for-approval', 'never'],
    timeout_seconds: 120,
    max_iterations: 1,
    transcript_path: `.specflow/runs/adapter-smoke/${provider}.jsonl`,
    output_path: `.specflow/runs/adapter-smoke/${provider}-final.md`,
    never_without_human: ['git push', 'open PR', 'merge', '--no-verify', 'override contract'],
    prompt: 'Reply with SPECFLOW_ADAPTER_SMOKE_OK only. Do not edit files or run commands.',
    dry_run: !options.live,
  });
  const planned = buildAdapterCommand(policy);
  return { policy, planned, live: Boolean(options.live) };
}

function cli(argv = process.argv.slice(2)) {
  const opts = parseKeyValueArgs(argv);
  const loop = opts._[0];
  if (!loop) {
    console.error('Usage: specflow run <loop|status> --slug <slug> --goal <goal> --input <path> [--contract path] [--until-terminal] [--max-iterations n]');
    return 2;
  }
  try {
    const result = loop === 'status'
      ? runStatus(opts)
      : (opts.untilTerminal ? runUntilTerminal({ ...opts, loop }) : runLoop({ ...opts, loop }));
    if (result.status === 'invalid_contract') {
      console.error(`specflow run failed: ${result.errors.join('; ')}`);
      return 1;
    }
    if (result.status === 'missing_contract') {
      console.error(result.error);
      return 2;
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
  appendStateMemory,
  readStateDigest,
  recordRunState,
  prepareWorktree,
  scaffoldRoutineManifest,
  normalizeAdapterPolicy,
  buildAdapterCommand,
  commandExists,
  containsForbiddenAction,
  parseProviderEvents,
  forbiddenFromProviderEvents,
  isSimulationFresh,
  loadLoopDefinition,
  loopSequence,
  loopSequenceFromDefinition,
  nextStage,
  verifierCommandsForStage,
  executeVerifierRegistry,
  materializeStagePrompt,
  planAdapterSmoke,
  verificationPaths,
  writeVerificationProposal,
  decideVerification,
  requireAcceptedVerificationContract,
  resolveVerifierPolicy,
  assembleVerifierInput,
  readLedger,
  readLedgerTail,
  summarizeLedger,
  runAdapter,
  runLoop,
  runStatus,
  runUntilTerminal,
  cli,
};

if (require.main === module) process.exit(cli());
