#!/usr/bin/env node
'use strict';

// IMPROVE-CORE (#171): one verified product-improvement cycle.
//
// Thin trust boundary around existing Specflow primitives (#174, #176 first):
//   - run ledger / worktree isolation / adapter execution  -> specflow-runner.cjs
//   - verification contract + runtime findings (#100/#102)  -> specflow-runner.cjs
// This file adds only what they lack: a frozen ImprovementContract with
// evidence strength, side-effect classification, diff-scope enforcement,
// a hash-chained improvement ledger and a KEEP / REVERT / INCONCLUSIVE rule.
// A builder never decides its own outcome; `evaluate` is a pure function of
// the frozen contract and recorded evidence.

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const yaml = require('js-yaml');
const runner = require('./specflow-runner.cjs');

const DECISIONS = ['KEEP', 'REVERT', 'INCONCLUSIVE'];
const EVIDENCE_LEVELS = { 1: 'deterministic', 2: 'behavioural-journey', 3: 'heuristic', 4: 'judgment' };
const MECHANICAL_PRODUCER = 'verifier-mechanical';
// Same vocabulary as the #102 runtime rail (runner.validateRuntimeChecks).
const RUNTIME_CHECK_TYPES = ['playwright', 'api', 'db-reread', 'console', 'network', 'screenshot', 'custom-script'];
const CANDIDATE_KINDS = ['ux-refinement', 'workflow', 'defect', 'feature', 'cleanup', 'redesign'];
const MIN_CANDIDATES = 3;
const MAX_ACCEPTANCE = 8;
const MAX_CONTRACT_BYTES = 20000;
const CONTRACT_FIELDS = [
  'candidate_id', 'observation', 'user_problem', 'mission_relation', 'hypothesis', 'baseline',
  'acceptance', 'non_goals', 'evaluation_method', 'affected_journey', 'scope', 'safety',
];
// Novelty is not a user problem (#175 AC-03-2).
const NOVELTY = /\b(moderni[sz]e|modernis(?:ation|ing)|revamp|facelift|sleeker|fresh(?:er)? look|looks? (?:cleaner|nicer|better|more modern)|visual refresh|redesign)\b/i;
const RUBRIC = path.join(__dirname, '..', 'templates', 'improve', 'UX_REFINEMENT_PROFILE.md');
const DEFAULT_PROTECTED_PATHS = [
  '.env', '.env.*', '**/.env', '**/.env.*', '**/*.pem', 'vercel.json', 'supabase/migrations/**',
  '.github/workflows/**', '.specflow/**', '.claude/**', '.codex/**', '.agents/**',
];
const NEVER_WITHOUT_HUMAN = [
  'git push', 'open PR', 'merge', '--no-verify', 'override contract', 'production deploy',
];

// "Change the branch, not the world" (#176). Checked before any command runs.
const SIDE_EFFECTS = [
  ['vcs_protected', /\bgit\s+(push|merge|rebase|pull|reset\s+--hard|remote\s+(add|set-url)|branch\s+-[dD]|update-ref|worktree\s+remove)\b/i],
  ['vcs_protected', /\bgit\s+(checkout|switch)\s+(main|master|production|release)\b/i],
  ['vcs_protected', /\bgh\s+(pr|release|repo|secret|variable|workflow|api)\b/i],
  ['vcs_protected', /--no-verify\b/i],
  ['production_deploy', /\b(vercel|netlify|flyctl|fly|railway|heroku|wrangler)\b[^|;&]*\b(deploy|--prod|promote|alias|rollback|publish)\b/i],
  ['production_deploy', /\b(npm|pnpm|yarn)\s+publish\b/i],
  ['production_deploy', /\bkubectl\s+(apply|delete|rollout|scale)\b|\bhelm\s+(install|upgrade|uninstall)\b/i],
  ['production_data', /\bsupabase\s+(db\s+(push|reset)|migration\s+(up|repair)|functions\s+deploy|link)\b/i],
  ['production_data', /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i],
  ['production_data', /\bSUPABASE_SERVICE_ROLE_KEY\b/],
  ['outbound_communication', /\b(sendmail|mailx|mutt|swaks)\b/i],
  ['outbound_communication', /(api\.telegram\.org|hooks\.slack\.com|discord(?:app)?\.com\/api\/webhooks|api\.sendgrid\.com|api\.resend\.com|api\.postmarkapp\.com|api\.twilio\.com|api\.mailgun\.net)/i],
  ['outbound_communication', /\b(TELEGRAM_LIVE_DELIVERY=1)\b/],
  ['network_write', /\bcurl\b[^|;&]*(\s-X\s*(POST|PUT|PATCH|DELETE)\b|\s--data\b|\s-d\s|\s--form\b|\s-F\s)/i],
  ['network_write', /\bwget\b[^|;&]*--(post|method)/i],
  ['purchase_or_paid_infra', /\b(stripe|paddle)\s+\S+|\bbuy\b|\bpurchase\b/i],
  ['purchase_or_paid_infra', /\b(aws|gcloud|az|doctl|terraform)\b[^|;&]*\b(create|apply|run-instances|deploy)\b/i],
  ['secret_mutation', /\b(vercel|netlify)\s+env\b|\bsupabase\s+secrets\b|\bgh\s+secret\b/i],
  ['secret_mutation', /(>|>>|\btee\b|\bcp\b|\bmv\b)\s*\S*\.env(\.|\b)/i],
  ['destructive_infra', /\bterraform\s+destroy\b|\brm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME)(\s|$)/i],
];
const SECRET_ENV = /(SECRET|TOKEN|PASSWORD|PASSWD|SERVICE_ROLE|PRIVATE|API_KEY|ACCESS_KEY|CREDENTIAL|DATABASE_URL|SUPABASE|STRIPE|TELEGRAM|SENDGRID|RESEND|TWILIO|VERCEL|GITHUB|GH_)/i;
const PROVIDER_ENV = /^(ANTHROPIC_|CLAUDE_|CLAUDE_CODE_)/;

// ---------------------------------------------------------------------------
// small utilities

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fileSha = (file) => sha256(fs.readFileSync(file));
const nonempty = (v) => typeof v === 'string' && v.trim().length > 0;
const list = (v) => (Array.isArray(v) ? v : []);
const now = () => new Date().toISOString();

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, file);
  return fileSha(file);
}
function writeOnce(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { flag: 'wx' });
  return fileSha(file);
}

function globToRegex(glob) {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      re += glob[i + 2] === '/' ? '(?:.*/)?' : '.*';
      i += glob[i + 2] === '/' ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
const matchesAny = (file, globs) => list(globs).some((g) => globToRegex(g).test(file));

function git(args, cwd, options = {}) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0 && !options.allowFail) throw new Error(`git ${args.join(' ')} failed: ${(r.stderr || '').trim()}`);
  return options.allowFail ? r : r.stdout.trim();
}

// ---------------------------------------------------------------------------
// hash-chained ledger (AC-07-1). Other rails may append plain entries to the
// same file; every improve entry hashes the raw line before it, so truncating
// or editing any earlier line — ours or theirs — breaks the chain.

function runPaths(runDir) {
  const rail = runner.verificationPaths({ runDir });
  return {
    runDir,
    runPath: path.join(runDir, 'run.json'),
    ledgerPath: rail.ledgerPath,
    candidatesPath: path.join(runDir, 'candidates.json'),
    evidencePath: path.join(runDir, 'evidence.jsonl'),
    decisionPath: path.join(runDir, 'decision.json'),
    reportPath: path.join(runDir, 'report.md'),
    checksDir: path.join(runDir, 'checks'),
    phaseDir: (phase) => path.join(runDir, 'verification', phase),
    contractPath: (v) => path.join(runDir, `improvement-contract.v${v}.json`),
    rail,
  };
}

function rawLines(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
}

function append(runDir, event, data = {}) {
  const { ledgerPath } = runPaths(runDir);
  const lines = rawLines(ledgerPath);
  const entry = {
    stage: 'improve',
    event,
    seq: lines.length,
    prev_sha256: lines.length ? sha256(lines[lines.length - 1]) : null,
    ...data,
  };
  runner.appendLedger(ledgerPath, entry);
  return entry;
}

function verifyLedger(runDir) {
  const lines = rawLines(runPaths(runDir).ledgerPath);
  const errors = [];
  let improveEntries = 0;
  lines.forEach((line, i) => {
    let e;
    try { e = JSON.parse(line); } catch { errors.push(`line ${i + 1}: not JSON`); return; }
    if (e.stage !== 'improve') return;
    improveEntries += 1;
    if (e.seq !== i) errors.push(`line ${i + 1}: seq ${e.seq} != position ${i}`);
    const expected = i ? sha256(lines[i - 1]) : null;
    if (e.prev_sha256 !== expected) errors.push(`line ${i + 1}: prev_sha256 does not match line ${i}`);
  });
  return { ok: errors.length === 0, entries: lines.length, improve_entries: improveEntries, head_sha256: lines.length ? sha256(lines[lines.length - 1]) : null, errors };
}

function events(runDir) {
  return runner.readLedger(runPaths(runDir).ledgerPath).filter((e) => e.stage === 'improve');
}
const lastEvent = (evs, name) => evs.filter((e) => e.event === name).slice(-1)[0] || null;

function loadRun(runDir) {
  const p = runPaths(runDir);
  if (!fs.existsSync(p.runPath)) throw new Error(`No improvement run at ${runDir}`);
  const run = readJson(p.runPath);
  if (sha256(canonical(run)) !== lastEvent(events(runDir), 'run_started')?.run_sha256) {
    throw new Error('run.json does not match the recorded run_started hash');
  }
  return run;
}

// ---------------------------------------------------------------------------
// side effects and environment (AC-04-2)

function classifySideEffect(command) {
  const text = Array.isArray(command) ? command.join(' ') : String(command || '');
  const declared = runner.forbiddenStageCheck(text, NEVER_WITHOUT_HUMAN);
  if (declared) return { category: 'human_only', matched: declared };
  for (const [category, pattern] of SIDE_EFFECTS) {
    const m = pattern.exec(text);
    if (m) return { category, matched: m[0] };
  }
  return null;
}

function scrubbedEnv(extra = {}, { keepProvider = false } = {}) {
  const env = {};
  const removed = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (keepProvider && PROVIDER_ENV.test(k)) { env[k] = v; continue; }
    if (SECRET_ENV.test(k)) { removed.push(k); continue; }
    env[k] = v;
  }
  return { env: { ...env, ...extra }, removed };
}

function guardedSpawn(runDir, role, argv, options = {}) {
  const blocked = classifySideEffect(argv);
  if (blocked) {
    append(runDir, 'side_effect_blocked', { role, argv, ...blocked, executed: false });
    return { status: 'blocked', blocked, exit_code: null, stdout: '', stderr: '' };
  }
  const { env, removed } = scrubbedEnv(options.env);
  const r = spawnSync(argv[0], argv.slice(1), {
    cwd: options.cwd,
    env,
    encoding: 'utf8',
    timeout: (options.timeoutSeconds || 300) * 1000,
    maxBuffer: 32 * 1024 * 1024,
  });
  const timedOut = r.error && /ETIMEDOUT/.test(r.error.code || r.error.message);
  append(runDir, 'command_run', { role, argv, cwd: options.cwd || null, exit_code: r.status, timed_out: Boolean(timedOut), env_removed: removed });
  return {
    status: r.error ? (timedOut ? 'timeout' : 'error') : 'ran',
    exit_code: r.status,
    stdout: r.stdout || '',
    stderr: `${r.stderr || ''}${r.error ? `\n${r.error.message}` : ''}`,
    env_removed: removed,
  };
}

// ---------------------------------------------------------------------------
// run start (#173 AC-01-1)

function startRun(options) {
  const target = path.resolve(options.target || '.');
  if (!fs.existsSync(path.join(target, '.git'))) throw new Error(`--target ${target} is not a git repository root`);
  if (!options.mission || !fs.existsSync(options.mission)) throw new Error('--mission <file> is required: an explicit product mission');
  const status = git(['status', '--porcelain', '--untracked-files=no'], target);
  if (status) throw new Error('Target has uncommitted tracked changes; start from a clean, identifiable state');
  const baseRef = options.base || git(['rev-parse', '--abbrev-ref', 'HEAD'], target);
  const baseCommit = git(['rev-parse', baseRef], target);
  const runId = options.runId || `improve-${now().replace(/[-:T]/g, '').slice(0, 12)}-${baseCommit.slice(0, 7)}`;
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/.test(runId)) throw new Error('run id must be a lowercase slug');
  const stateRoot = path.resolve(options.stateDir || path.join(target, '.specflow', 'runs'));
  const runDir = path.join(stateRoot, runId);
  if (fs.existsSync(runDir)) throw new Error(`Run ${runId} already exists; use status/resume instead of restarting`);
  const mission = fs.readFileSync(options.mission, 'utf8');
  const run = {
    schema: 'specflow.improve.run/v1',
    run_id: runId,
    mode: 'once',
    target_repo: target,
    base_ref: baseRef,
    base_commit: baseCommit,
    mission: { source: path.resolve(options.mission), sha256: sha256(mission), text: mission },
    worktree_root: path.resolve(options.worktreeRoot || path.join(path.dirname(target), '.specflow-improve-worktrees')),
    never_without_human: NEVER_WITHOUT_HUMAN,
    started_at: now(),
  };
  const p = runPaths(runDir);
  fs.mkdirSync(runDir, { recursive: true });
  writeOnce(p.runPath, `${JSON.stringify(run, null, 2)}\n`);
  append(runDir, 'run_started', {
    run_id: runId, run_sha256: sha256(canonical(run)), base_ref: baseRef, base_commit: baseCommit,
    mission_sha256: run.mission.sha256, target_repo: target,
  });
  return { runDir, run };
}

// ---------------------------------------------------------------------------
// candidate set and selection (#173, #175)

function validateCandidates(doc) {
  const errors = [];
  const cands = list(doc?.candidates);
  if (!list(doc?.sources).length) errors.push('sources: record the evidence sources used to understand the product');
  if (cands.length < MIN_CANDIDATES) errors.push(`candidates: at least ${MIN_CANDIDATES} are required before selecting one`);
  const ids = new Set();
  for (const c of cands) {
    const where = `candidate ${c?.id || '?'}`;
    if (!nonempty(c?.id) || ids.has(c.id)) errors.push(`${where}: missing or duplicate id`);
    ids.add(c?.id);
    for (const f of ['title', 'observation', 'user_impact', 'mission_relevance', 'hypothesis']) {
      if (!nonempty(c?.[f])) errors.push(`${where}: ${f} is required`);
    }
    if (nonempty(c?.observation) && c.observation.trim() === (c.hypothesis || '').trim()) errors.push(`${where}: observation must be distinguished from hypothesis`);
    if (!CANDIDATE_KINDS.includes(c?.kind)) errors.push(`${where}: kind must be one of ${CANDIDATE_KINDS.join(', ')}`);
    for (const f of ['expected_value', 'risk', 'reversibility']) {
      if (!['low', 'medium', 'high'].includes(c?.[f])) errors.push(`${where}: ${f} must be low|medium|high`);
    }
    if (!['S', 'M', 'L'].includes(c?.cost)) errors.push(`${where}: cost must be S|M|L`);
    const level = c?.evaluability?.best_level;
    if (!(level === null || [1, 2, 3, 4].includes(level)) || !nonempty(c?.evaluability?.method)) {
      errors.push(`${where}: evaluability.best_level (1-4 or null) and evaluability.method are required`);
    }
    if (!['selected', 'opportunity', 'rejected'].includes(c?.status)) errors.push(`${where}: status must be selected|opportunity|rejected`);
    if (c?.status !== 'selected' && !nonempty(c?.reason)) errors.push(`${where}: a non-selected candidate needs a reason`);
    if (c?.status === 'rejected' && c?.expected_value === 'high') errors.push(`${where}: a high-value candidate that cannot be selected stays an opportunity`);
  }
  const selected = cands.filter((c) => c?.status === 'selected');
  if (selected.length !== 1) errors.push('exactly one candidate must be selected');
  const sel = selected[0];
  if (sel && doc?.selection?.candidate_id !== sel.id) errors.push('selection.candidate_id must name the selected candidate');
  if (!nonempty(doc?.selection?.rationale)) errors.push('selection.rationale is required; model confidence alone is not authority');
  if (sel) {
    const outranked = new Set(list(doc.selection?.outranked).filter((o) => nonempty(o?.why)).map((o) => o.id));
    for (const c of cands) if (c !== sel && !outranked.has(c.id)) errors.push(`selection.outranked must explain why ${c.id} was not chosen`);
    if (!list(sel.evidence).length) errors.push(`selected ${sel.id}: evidence that the problem exists is required`);
    if (![1, 2].includes(sel.evaluability?.best_level)) errors.push(`selected ${sel.id}: must be evaluable with level 1 or 2 evidence; keep it as an opportunity instead`);
    if (sel.risk === 'high') errors.push(`selected ${sel.id}: high-risk candidates cannot be selected for an unattended cycle`);
    if (sel.reversibility === 'low') errors.push(`selected ${sel.id}: must be reversible`);
    if (sel.cost === 'L') errors.push(`selected ${sel.id}: too large for one cycle; split it or keep it as an opportunity`);
    if (sel.kind === 'redesign') errors.push(`selected ${sel.id}: redesign is not a refinement; record it as an opportunity`);
    for (const f of ['observation', 'user_impact', 'hypothesis']) {
      if (NOVELTY.test(sel[f] || '')) errors.push(`selected ${sel.id}: ${f} argues from visual novelty; state the user problem instead`);
    }
  }
  return { ok: errors.length === 0, errors, selected: sel || null };
}

function recordCandidates(runDir, file) {
  loadRun(runDir);
  const evs = events(runDir);
  if (lastEvent(evs, 'contract_frozen')) throw new Error('Candidates are fixed once a contract is frozen; start a new run to reselect');
  const doc = readJson(file);
  const result = validateCandidates(doc);
  if (!result.ok) {
    append(runDir, 'candidates_rejected', { errors: result.errors });
    return { status: 'rejected', errors: result.errors };
  }
  const p = runPaths(runDir);
  const digest = writeJson(p.candidatesPath, doc);
  append(runDir, 'candidates_recorded', {
    candidates_sha256: digest,
    candidate_ids: doc.candidates.map((c) => c.id),
    selected: result.selected.id,
    opportunities: doc.candidates.filter((c) => c.status === 'opportunity').map((c) => c.id),
    roles: doc.roles || null,
  });
  return { status: 'recorded', selected: result.selected.id };
}

// ---------------------------------------------------------------------------
// ImprovementContract (#174)

function validateContract(runDir, contract, selected) {
  const errors = [];
  for (const f of CONTRACT_FIELDS) {
    const v = contract?.[f];
    if (v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) errors.push(`${f} is required`);
  }
  if (selected && contract?.candidate_id !== selected.id) errors.push(`candidate_id must be the selected candidate ${selected.id}`);
  if (Buffer.byteLength(JSON.stringify(contract || {})) > MAX_CONTRACT_BYTES) errors.push('contract is too large; keep it scoped to the selected candidate');
  const acceptance = list(contract?.acceptance);
  if (acceptance.length > MAX_ACCEPTANCE) errors.push(`acceptance: at most ${MAX_ACCEPTANCE} criteria for one cycle`);
  const ids = new Set();
  for (const a of acceptance) {
    const where = `acceptance ${a?.id || '?'}`;
    if (!nonempty(a?.id) || ids.has(a.id) || String(a.id).startsWith('gate:')) errors.push(`${where}: missing, duplicate or reserved id`);
    ids.add(a?.id);
    if (!nonempty(a?.statement)) errors.push(`${where}: statement is required`);
    if (![1, 2, 3, 4].includes(a?.required_level)) errors.push(`${where}: required_level must be 1-4`);
    if (typeof a?.mandatory !== 'boolean') errors.push(`${where}: mandatory must be true or false`);
    if (!['fail', 'pass', 'n/a'].includes(a?.baseline_expectation)) errors.push(`${where}: baseline_expectation must be fail|pass|n/a`);
    if (a?.required_level <= 2) {
      if (!a.check) errors.push(`${where}: level ${a.required_level} needs an executable check frozen with the contract`);
      else {
        if (!Array.isArray(a.check.command) || !a.check.command.length) errors.push(`${where}: check.command argv is required`);
        if (a.check.type && !RUNTIME_CHECK_TYPES.includes(a.check.type)) errors.push(`${where}: check.type must be one of ${RUNTIME_CHECK_TYPES.join(', ')}`);
        if (![1, 2].includes(a.check.level) || a.check.level > a.required_level) errors.push(`${where}: check.level must be 1 or 2 and no weaker than required_level`);
        if (a.check.artifact && !fs.existsSync(path.join(runDir, a.check.artifact))) errors.push(`${where}: check artifact ${a.check.artifact} does not exist in the run directory`);
      }
    }
  }
  if (!acceptance.some((a) => a.mandatory && a.required_level <= 2)) {
    errors.push('at least one mandatory criterion must require level 1 or 2 evidence; otherwise the change is unevaluable');
  }
  if (!list(contract?.scope?.allowed_paths).length) errors.push('scope.allowed_paths must bound the change');
  if (selected && ['ux-refinement', 'workflow'].includes(selected.kind) && !list(contract?.ux_profile?.preserve).length) {
    errors.push('ux_profile.preserve must name the navigation/visual language/behaviour this refinement keeps');
  }
  for (const f of ['user_problem', 'hypothesis']) {
    if (NOVELTY.test(contract?.[f] || '')) errors.push(`${f} argues from visual novelty; state the observable user consequence`);
  }
  for (const g of list(contract?.gates)) {
    if (!nonempty(g?.id) || !Array.isArray(g?.command) || !g.command.length) errors.push('gates need {id, command argv}');
  }
  if (contract?.runtime?.serve && (!Array.isArray(contract.runtime.serve.command) || !contract.runtime.serve.port)) {
    errors.push('runtime.serve needs command argv and port');
  }
  for (const argv of [...list(contract?.runtime?.setup), contract?.runtime?.serve?.command, ...list(contract?.gates).map((g) => g.command), ...acceptance.map((a) => a.check?.command)].filter(Boolean)) {
    const blocked = classifySideEffect(argv);
    if (blocked) errors.push(`declared command is a prohibited side effect (${blocked.category}): ${argv.join(' ')}`);
  }
  return { ok: errors.length === 0, errors };
}

function freezeContract(runDir, file, options = {}) {
  const run = loadRun(runDir);
  const p = runPaths(runDir);
  const evs = events(runDir);
  if (!lastEvent(evs, 'candidates_recorded')) throw new Error('Record the candidate set and selection before writing a contract');
  const candidates = readJson(p.candidatesPath);
  const selected = candidates.candidates.find((c) => c.status === 'selected');
  const previous = evs.filter((e) => e.event === 'contract_frozen');
  if (previous.length && !nonempty(options.supersede)) throw new Error('A frozen contract exists; a change needs --supersede "<reason>" and creates a new version');
  const contract = readJson(file);
  const validation = validateContract(runDir, contract, selected);
  if (!validation.ok) {
    append(runDir, 'contract_rejected', { errors: validation.errors });
    return { status: 'rejected', errors: validation.errors };
  }
  const version = previous.length + 1;
  const artifacts = {};
  for (const a of contract.acceptance) {
    if (a.check?.artifact) artifacts[a.check.artifact] = fileSha(path.join(runDir, a.check.artifact));
  }
  const implementationStarted = Boolean(lastEvent(evs, 'implementation_started'));
  const frozen = {
    schema: 'specflow.improvement-contract/v1',
    run_id: run.run_id,
    version,
    supersedes: previous.length ? previous[previous.length - 1].contract_sha256 : null,
    supersede_reason: options.supersede || null,
    created_after_implementation: implementationStarted,
    frozen_at: now(),
    mission_sha256: run.mission.sha256,
    candidate: { id: selected.id, title: selected.title, kind: selected.kind },
    artifact_sha256: artifacts,
    contract,
  };
  const digest = writeOnce(p.contractPath(version), `${JSON.stringify(frozen, null, 2)}\n`);

  // Reuse the #100 verifier rail: the frozen contract is the accepted
  // verification contract, so verifierTrace() and the rail's findings
  // format work unchanged on this run directory.
  if (version === 1) {
    const runtimeChecks = contract.acceptance.filter((a) => a.check).map((a) => ({
      id: a.id, type: a.check.type || 'custom-script', assertion: a.statement, required: a.mandatory, level: a.check.level,
    }));
    runner.writeVerificationProposal({
      runDir, journeyId: contract.affected_journey, makerPolicyId: 'improve.builder', verifierPolicyId: 'improve.evaluator',
      runtimeChecks, body: `ImprovementContract v${version} sha256 ${digest}`,
    });
    runner.decideVerification({
      runDir,
      decision: 'accept',
      verificationContract: {
        journey_id: contract.affected_journey,
        maker_policy_id: 'improve.builder',
        verifier_policy_id: 'improve.evaluator',
        runtime_checks: runtimeChecks,
        forbidden_evidence: [
          'builder self-assessment', 'provider exit code as gate pass',
          'screenshot or model judgment in place of a level 1-2 criterion', 'acceptance edited after implementation',
        ],
        improvement_contract_sha256: digest,
      },
    });
  }
  append(runDir, 'contract_frozen', {
    version, contract_sha256: digest, path: p.contractPath(version), artifact_sha256: artifacts,
    created_after_implementation: implementationStarted, supersede_reason: options.supersede || null,
  });
  return { status: 'frozen', version, sha256: digest, created_after_implementation: implementationStarted };
}

// The contract that governs a decision is the last version frozen before
// implementation started (AC-02-2 / AC-06-5). Later versions are recorded
// but cannot retroactively redefine success for this implementation.
function governingContract(runDir) {
  const evs = events(runDir);
  const started = evs.findIndex((e) => e.event === 'implementation_started');
  const frozen = evs.filter((e, i) => e.event === 'contract_frozen' && (started < 0 || i < started));
  const entry = frozen[frozen.length - 1];
  if (!entry) return null;
  const doc = readJson(entry.path);
  const tampered = fileSha(entry.path) !== entry.contract_sha256;
  const artifactErrors = Object.entries(entry.artifact_sha256 || {})
    .filter(([rel, digest]) => !fs.existsSync(path.join(runDir, rel)) || fileSha(path.join(runDir, rel)) !== digest)
    .map(([rel]) => rel);
  const later = evs.filter((e, i) => e.event === 'contract_frozen' && started >= 0 && i > started).map((e) => e.version);
  return { entry, doc, contract: doc.contract, tampered, artifactErrors, ignoredLaterVersions: later };
}

// ---------------------------------------------------------------------------
// workspaces (#176) — reuse runner.prepareWorktree / releaseWorktree

function workspaceFor(run, kind) {
  const suffix = kind === 'baseline' ? '-baseline' : '';
  return {
    branch: `specflow/${run.run_id}${suffix}`,
    worktreePath: path.join(run.worktree_root, `${run.run_id}${suffix}`),
  };
}

function prepareWorkspace(runDir, kind) {
  const run = loadRun(runDir);
  const { branch, worktreePath } = workspaceFor(run, kind);
  if (branch === `specflow/${run.base_ref}` || branch === run.base_ref) throw new Error('workspace branch collides with base');
  const record = runner.prepareWorktree({
    repoRoot: run.target_repo, baseRef: run.base_commit, branch, worktreePath, create: true, readOnly: kind === 'baseline',
  });
  if (record.base_commit !== run.base_commit) throw new Error('workspace base differs from the recorded starting commit');
  append(runDir, 'workspace_prepared', { kind, ...record });
  return record;
}

function baseUnchanged(run) {
  const r = git(['rev-parse', run.base_ref], run.target_repo, { allowFail: true });
  const current = r.status === 0 ? r.stdout.trim() : null;
  return { base_ref: run.base_ref, recorded: run.base_commit, current, unchanged: current === run.base_commit };
}

function workspaceDiff(run) {
  const { worktreePath } = workspaceFor(run, 'improve');
  if (!fs.existsSync(worktreePath)) return null;
  // Stage everything (respecting .gitignore) so new files are part of the change set.
  git(['add', '-A'], worktreePath);
  const files = git(['diff', '--cached', '--name-only', run.base_commit], worktreePath).split('\n').filter(Boolean);
  const patch = spawnSync('git', ['diff', '--cached', '--binary', run.base_commit], { cwd: worktreePath, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).stdout || '';
  return { files, patch, sha256: sha256(patch) };
}

function scopeCheck(contract, files) {
  const allowed = list(contract.scope?.allowed_paths);
  const protectedPaths = [...DEFAULT_PROTECTED_PATHS, ...list(contract.scope?.protected_paths)];
  return {
    outside_scope: files.filter((f) => !matchesAny(f, allowed)),
    protected_touched: files.filter((f) => matchesAny(f, protectedPaths)),
    max_files: contract.scope?.max_files || null,
    too_many_files: Boolean(contract.scope?.max_files && files.length > contract.scope.max_files),
  };
}

// ---------------------------------------------------------------------------
// verification phases: the frozen checks run against base and against the
// workspace. The builder never supplies level 1-2 evidence.

function httpReady(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => { res.resume(); resolve(res.statusCode < 500); });
    req.on('error', () => resolve(false));
    req.setTimeout(5000, () => { req.destroy(); resolve(false); });
  });
}

async function startServer(runDir, cwd, serve, logFile) {
  const blocked = classifySideEffect(serve.command);
  if (blocked) {
    append(runDir, 'side_effect_blocked', { role: 'verifier', argv: serve.command, ...blocked, executed: false });
    return { ok: false, reason: `serve command blocked (${blocked.category})` };
  }
  const { env } = scrubbedEnv({ ...(serve.env || {}), PORT: String(serve.port) });
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const out = fs.openSync(logFile, 'a');
  const child = spawn(serve.command[0], serve.command.slice(1), { cwd, env, detached: true, stdio: ['ignore', out, out] });
  const url = `http://127.0.0.1:${serve.port}${serve.ready_path || '/'}`;
  const deadline = Date.now() + (serve.ready_timeout_seconds || 180) * 1000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) return { ok: false, reason: `server exited with ${child.exitCode}` };
    if (await httpReady(url)) return { ok: true, child, base_url: `http://127.0.0.1:${serve.port}` };
    await new Promise((r) => setTimeout(r, 1500));
  }
  stopServer(child);
  return { ok: false, reason: `server not ready at ${url}` };
}

function stopServer(child) {
  if (!child) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
}

function lastJsonLine(text) {
  const lines = String(text || '').trim().split('\n').reverse();
  for (const line of lines) {
    try { const v = JSON.parse(line); if (v && typeof v === 'object') return v; } catch { /* keep looking */ }
  }
  return null;
}

async function verifyPhase(runDir, phase) {
  if (!['baseline', 'after'].includes(phase)) throw new Error('phase must be baseline or after');
  const run = loadRun(runDir);
  const gov = governingContract(runDir);
  if (!gov) throw new Error('No frozen ImprovementContract; nothing can be verified');
  if (gov.tampered || gov.artifactErrors.length) {
    append(runDir, 'contract_integrity_failed', { phase, tampered: gov.tampered, artifacts: gov.artifactErrors });
    return { status: 'blocked', reason: 'frozen contract or check artifacts changed after freezing' };
  }
  const evs = events(runDir);
  if (phase === 'after' && !lastEvent(evs, 'implementation_finished')) throw new Error('No recorded implementation to verify');
  if (phase === 'baseline' && lastEvent(evs, 'implementation_started')) throw new Error('Baseline must be captured before implementation starts');
  const kind = phase === 'baseline' ? 'baseline' : 'improve';
  const ws = workspaceFor(run, kind);
  if (!fs.existsSync(ws.worktreePath)) prepareWorkspace(runDir, kind);
  const contract = gov.contract;
  const p = runPaths(runDir);
  const dir = p.phaseDir(phase);
  fs.mkdirSync(dir, { recursive: true });
  const contractVersion = gov.entry.version;
  const vars = (s) => String(s)
    .replace(/\{workspace\}/g, ws.worktreePath)
    .replace(/\{run_dir\}/g, runDir)
    .replace(/\{evidence_dir\}/g, dir)
    .replace(/\{phase\}/g, phase);

  append(runDir, 'verification_started', { phase, contract_version: contractVersion, workspace: ws.worktreePath });
  for (const argv of list(contract.runtime?.setup)) {
    const r = guardedSpawn(runDir, 'verifier', argv.map(vars), { cwd: ws.worktreePath, timeoutSeconds: 900 });
    if (r.status !== 'ran' || r.exit_code !== 0) {
      append(runDir, 'verification_blocked', { phase, reason: `setup failed: ${argv.join(' ')}`, stderr: r.stderr.slice(-2000) });
      return { status: 'blocked', reason: `setup failed: ${argv.join(' ')}` };
    }
  }
  let server = null;
  let baseUrl = null;
  if (contract.runtime?.serve) {
    server = await startServer(runDir, ws.worktreePath, contract.runtime.serve, path.join(dir, 'server.log'));
    if (!server.ok) {
      append(runDir, 'verification_blocked', { phase, reason: server.reason });
      return { status: 'blocked', reason: server.reason };
    }
    baseUrl = server.base_url;
  }

  const items = [];
  try {
    const checks = contract.acceptance.filter((a) => a.check);
    const outcomes = {};
    for (const a of checks) {
      const argv = a.check.command.map(vars).map((s) => s.replace(/\{artifact\}/g, a.check.artifact ? path.join(runDir, a.check.artifact) : ''));
      const outPath = path.join(dir, `${a.id}.out.txt`);
      const r = guardedSpawn(runDir, 'verifier', argv, {
        cwd: ws.worktreePath,
        timeoutSeconds: a.check.timeout_seconds || 300,
        env: { BASE_URL: baseUrl || '', IMPROVE_EVIDENCE_DIR: dir, IMPROVE_PHASE: phase, IMPROVE_CRITERION: a.id, IMPROVE_WORKSPACE: ws.worktreePath },
      });
      fs.writeFileSync(outPath, `${r.stdout}\n--- stderr ---\n${r.stderr}`);
      const result = r.status !== 'ran' ? 'unavailable' : r.exit_code === 0 ? 'pass' : r.exit_code === 1 ? 'fail' : 'unavailable';
      outcomes[a.id] = { result, measurements: lastJsonLine(r.stdout), outPath, exit_code: r.exit_code };
    }
    // Findings go through the #102 runtime rail, one findings file per phase.
    runner.runRuntimeChecks({
      runDir: dir,
      makerClaim: phase === 'after' ? (lastEvent(evs, 'maker_claim')?.claim || 'unknown') : 'baseline',
      checks: checks.map((a) => ({ id: a.id, type: a.check.type || 'custom-script', assertion: a.statement, required: a.mandatory, evidence_path: outcomes[a.id].outPath })),
      runner: (c) => (outcomes[c.id].result === 'unavailable'
        ? { executable: false, reason: `check did not produce a pass/fail result (exit ${outcomes[c.id].exit_code})` }
        : { executable: true, result: outcomes[c.id].result, evidence_path: outcomes[c.id].outPath }),
    });
    for (const a of checks) {
      const o = outcomes[a.id];
      items.push({
        criterion: a.id, level: a.check.level, kind: 'executable-check', result: o.result, measurements: o.measurements,
        source: { artifact: a.check.artifact || null, artifact_sha256: gov.entry.artifact_sha256?.[a.check.artifact] || null, command: a.check.command },
        evidence_path: o.outPath, evidence_sha256: fileSha(o.outPath),
      });
    }
    for (const g of list(contract.gates)) {
      const outPath = path.join(dir, `gate-${g.id}.out.txt`);
      const r = guardedSpawn(runDir, 'verifier', g.command.map(vars), { cwd: ws.worktreePath, timeoutSeconds: g.timeout_seconds || 600, env: { IMPROVE_PHASE: phase } });
      fs.writeFileSync(outPath, `${r.stdout}\n--- stderr ---\n${r.stderr}`);
      items.push({
        criterion: `gate:${g.id}`, level: 1, kind: 'gate', result: r.status !== 'ran' ? 'unavailable' : r.exit_code === 0 ? 'pass' : 'fail',
        source: { command: g.command }, evidence_path: outPath, evidence_sha256: fileSha(outPath),
      });
    }
  } finally {
    stopServer(server?.child);
  }
  for (const item of items) addEvidenceItem(runDir, { ...item, phase, producer_role: MECHANICAL_PRODUCER, executor: 'specflow-improve', contract_version: contractVersion });

  const summary = Object.fromEntries(items.map((i) => [i.criterion, i.result]));
  if (phase === 'baseline') {
    const mismatches = contract.acceptance
      .filter((a) => a.check && a.baseline_expectation !== 'n/a' && summary[a.id] !== a.baseline_expectation)
      .map((a) => ({ criterion: a.id, expected: a.baseline_expectation, observed: summary[a.id] }));
    append(runDir, mismatches.length ? 'baseline_blocked' : 'baseline_recorded', { contract_version: contractVersion, summary, mismatches });
    return { status: mismatches.length ? 'baseline_blocked' : 'baseline_recorded', summary, mismatches };
  }
  append(runDir, 'verification_completed', { phase, contract_version: contractVersion, summary });
  return { status: 'verified', summary };
}

// ---------------------------------------------------------------------------
// evidence (AC-02-3 / AC-02-4)

function addEvidenceItem(runDir, item) {
  const p = runPaths(runDir);
  const record = { id: `ev-${rawLines(p.evidencePath).length + 1}`, recorded_at: now(), ...item };
  fs.appendFileSync(p.evidencePath, `${JSON.stringify(record)}\n`);
  append(runDir, 'evidence_added', {
    evidence_id: record.id, criterion: record.criterion, level: record.level, result: record.result, phase: record.phase || null,
    producer_role: record.producer_role, executor: record.executor, evidence_sha256: record.evidence_sha256 || null,
  });
  return record;
}

// Judgments from independent roles (levels 3-4). Level 1-2 evidence only
// comes from the frozen checks; a submitted "tests passed" is not evidence.
function submitJudgment(runDir, item) {
  loadRun(runDir);
  const errors = [];
  if (![3, 4].includes(item?.level)) errors.push('submitted evidence is limited to level 3 (heuristic) or 4 (judgment)');
  if (!['pass', 'fail', 'unavailable'].includes(item?.result)) errors.push('result must be pass|fail|unavailable');
  if (!nonempty(item?.criterion) || !nonempty(item?.producer_role) || !nonempty(item?.executor) || !nonempty(item?.rationale)) {
    errors.push('criterion, producer_role, executor and rationale are required');
  }
  const builder = lastEvent(events(runDir), 'implementation_started');
  const selfReview = item?.producer_role === 'builder' || (builder && item?.executor === builder.executor);
  if (errors.length) return { status: 'rejected', errors };
  const gov = governingContract(runDir);
  return {
    status: selfReview ? 'recorded_not_counted' : 'recorded',
    item: addEvidenceItem(runDir, { ...item, phase: item.phase || 'after', kind: 'judgment', self_review: Boolean(selfReview), contract_version: gov?.entry.version || null }),
  };
}

function readEvidence(runDir) {
  return rawLines(runPaths(runDir).evidencePath).map((l) => JSON.parse(l));
}

// ---------------------------------------------------------------------------
// builder and judge adapters (#177: reuse runner.runAdapter + routing policy)

function loadPolicy(file) {
  const raw = /\.json$/.test(file) ? readJson(file) : yaml.load(fs.readFileSync(file, 'utf8'));
  return raw.adapter_policy || raw;
}

function rolePolicy(runDir, raw, role) {
  const dir = path.join(runDir, 'adapters');
  const denied = ['Bash(git push*)', 'Bash(git merge*)', 'Bash(git rebase*)', 'Bash(git checkout main*)', 'Bash(gh *)',
    'Bash(* deploy*)', 'Bash(vercel*)', 'Bash(supabase*)', 'Bash(curl*)', 'Bash(wget*)', 'Bash(* --no-verify*)', 'WebFetch', 'WebSearch'];
  return runner.normalizeAdapterPolicy({
    ...raw,
    denied_tools: [...new Set([...list(raw.denied_tools), ...denied])],
    never_without_human: [...new Set([...list(raw.never_without_human), ...NEVER_WITHOUT_HUMAN])],
    transcript_path: path.join(dir, `${role}.transcript.jsonl`),
    output_path: path.join(dir, `${role}.final.md`),
  }, { slug: path.basename(runDir) });
}

function roleProvenance(policy, result) {
  const e = result.entry || {};
  return {
    policy_id: policy.id, provider: policy.provider, requested_model: policy.requested_model || null,
    observed_model: e.effective_model || 'unknown', fallback_model: policy.fallback_model || null,
    cost_usd: typeof e.estimated_cost_usd === 'number' ? e.estimated_cost_usd : null,
    cost_status: typeof e.estimated_cost_usd === 'number' ? 'measured' : 'unknown',
    input_tokens: e.input_tokens ?? null, output_tokens: e.output_tokens ?? null, stop_reason: e.stop_reason || result.status,
  };
}

function toolCommands(transcriptPath) {
  if (!fs.existsSync(transcriptPath)) return [];
  const out = [];
  for (const line of rawLines(transcriptPath)) {
    let e; try { e = JSON.parse(line); } catch { continue; }
    for (const block of list(e.message?.content)) {
      if (block?.type === 'tool_use') out.push({ tool: block.name, input: block.input });
    }
  }
  return out;
}

function builderPrompt(runDir, gov) {
  const c = gov.contract;
  return [
    `You are the BUILDER for Specflow improvement run ${path.basename(runDir)}.`,
    'Implement the smallest change that satisfies the frozen ImprovementContract below. You do not decide whether it worked; an independent evaluator and frozen checks do.',
    'Rules: edit only files matching scope.allowed_paths. Do not commit, push, merge, deploy, contact anyone, touch env files, secrets, migrations or CI. Do not modify tests to make them pass. Prefer removing or reordering UI over adding UI. Preserve the listed visual language and navigation.',
    'When done, reply with a short summary of the diff and one line: CLAIM: complete | CLAIM: partial | CLAIM: unable.',
    '',
    '```json',
    JSON.stringify({
      observation: c.observation, user_problem: c.user_problem, hypothesis: c.hypothesis, affected_journey: c.affected_journey,
      acceptance: c.acceptance.map((a) => ({ id: a.id, statement: a.statement })), non_goals: c.non_goals, scope: c.scope,
      ux_profile: c.ux_profile || null, implementation_notes: c.implementation_notes || null,
    }, null, 2),
    '```',
  ].join('\n');
}

function build(runDir, options = {}) {
  const run = loadRun(runDir);
  const evs = events(runDir);
  const gov = governingContract(runDir);
  if (!gov) throw new Error('Implementation cannot start without a frozen ImprovementContract');
  if (gov.tampered || gov.artifactErrors.length) throw new Error('Frozen contract integrity failed; implementation blocked');
  const baseline = lastEvent(evs, 'baseline_recorded');
  const baselineBlocked = lastEvent(evs, 'baseline_blocked');
  if (!baseline && !(baselineBlocked && nonempty(options.acceptBaselineBlocker))) {
    throw new Error(baselineBlocked
      ? 'Baseline did not reproduce the contract expectations; supersede the contract or pass --accept-baseline-blocker "<why>" (caps the decision at INCONCLUSIVE)'
      : 'Capture the baseline before implementation (improve baseline)');
  }
  if (lastEvent(evs, 'implementation_started')) throw new Error('This run already has an implementation attempt; --once allows one');
  const raw = loadPolicy(options.policy);
  const policy = rolePolicy(runDir, { ...raw, role: raw.role || 'implementer' }, 'builder');
  const ws = workspaceFor(run, 'improve');
  if (!fs.existsSync(ws.worktreePath)) prepareWorkspace(runDir, 'improve');
  const promptPath = path.join(runDir, 'adapters', 'builder.prompt.md');
  fs.mkdirSync(path.dirname(promptPath), { recursive: true });
  fs.writeFileSync(promptPath, options.prompt ? `${builderPrompt(runDir, gov)}\n\n${fs.readFileSync(options.prompt, 'utf8')}` : builderPrompt(runDir, gov));
  append(runDir, 'implementation_started', {
    role: 'builder', executor: policy.id, contract_version: gov.entry.version, contract_sha256: gov.entry.contract_sha256,
    workspace: ws.worktreePath, branch: ws.branch, baseline_blocker_accepted: baseline ? null : options.acceptBaselineBlocker,
  });
  const { env } = scrubbedEnv({}, { keepProvider: true });
  const result = runner.runAdapter(policy, { promptPath, stage: 'improve.builder', dryRun: options.dryRun, cwd: ws.worktreePath, env });
  const attempted = toolCommands(policy.transcript_path)
    .filter((t) => t.tool === 'Bash')
    .map((t) => ({ command: t.input?.command, violation: classifySideEffect(t.input?.command) }))
    .filter((t) => t.violation);
  for (const a of attempted) append(runDir, 'side_effect_attempted', { role: 'builder', command: a.command, ...a.violation });
  const finalText = fs.existsSync(policy.output_path) ? fs.readFileSync(policy.output_path, 'utf8') : '';
  const claim = (/CLAIM:\s*(complete|partial|unable)/i.exec(finalText)?.[1] || 'unknown').toLowerCase();
  // verifierTrace() compatibility: a maker_claim entry on the rail ledger.
  runner.appendLedger(runPaths(runDir).ledgerPath, { stage: 'verifier_stage', event: 'maker_claim', claim, output_path: policy.output_path, transcript_path: policy.transcript_path });
  append(runDir, 'implementation_finished', {
    role: 'builder', adapter_status: result.status, claim, side_effects_attempted: attempted.length,
    forbidden_action_detected: result.entry?.forbidden_action_detected || null, provenance: roleProvenance(policy, result),
  });
  return { status: result.status, claim, provenance: roleProvenance(policy, result), side_effects_attempted: attempted.length };
}

function judgePrompt(runDir, role, criteria, gov) {
  return [
    `You are the independent ${role.toUpperCase()} for Specflow improvement run ${path.basename(runDir)}.`,
    'You did not build this change. Judge it only against the frozen contract, the diff and the recorded runtime evidence in this directory (verification/baseline and verification/after, including screenshots). You cannot see the builder\'s reasoning and must not assume it succeeded.',
    'Posture: refinement over redesign; removal over addition; workflow over decoration; clarity over novelty; less cognitive work over more UI. "Looks cleaner" is not evidence.',
    `Judge these criteria: ${criteria.join(', ')}. Also inspect for regressions in hierarchy, consistency, accessibility, responsiveness and unnecessary UI.`,
    'Return ONLY a JSON object on the last line: {"judgments":[{"criterion":"<id>","level":3|4,"result":"pass"|"fail"|"unavailable","rationale":"<specific, cites files/screenshots>"}],"risks":["..."]}',
    '',
    `Contract: improvement-contract.v${gov.entry.version}.json  Diff: workspace.patch`,
  ].join('\n');
}

function judge(runDir, options = {}) {
  const run = loadRun(runDir);
  const evs = events(runDir);
  const builderEntry = lastEvent(evs, 'implementation_started');
  if (!lastEvent(evs, 'verification_completed')) throw new Error('Run the after-phase verification before independent judgment');
  const gov = governingContract(runDir);
  const role = options.role || 'ux-evaluator';
  const raw = loadPolicy(options.policy);
  const policy = rolePolicy(runDir, { ...raw, role: 'verifier' }, role);
  // Reuse the #100 isolation rule: the evaluator policy must differ from the builder's.
  runner.resolveVerifierPolicy({ ...policy, id: builderEntry.executor, transcript_path: path.join(runDir, 'adapters', 'builder.transcript.jsonl'), output_path: path.join(runDir, 'adapters', 'builder.final.md'), verifier_policy: policy });
  const diff = workspaceDiff(run);
  fs.writeFileSync(path.join(runDir, 'workspace.patch'), diff?.patch || '');
  const input = runner.assembleVerifierInput({
    artifactPath: path.join(runDir, 'workspace.patch'), specPath: gov.entry.path,
    verificationContractPath: runPaths(runDir).rail.contractPath, rubric: RUBRIC,
  });
  const criteria = options.criteria || gov.contract.acceptance.filter((a) => a.required_level >= 3).map((a) => a.id);
  // The judge works in a directory holding only artifact, contract, rubric and
  // runtime evidence — never the builder transcript (#100 assembleVerifierInput).
  const inputDir = path.join(runDir, `judge-input-${role}`);
  fs.rmSync(inputDir, { recursive: true, force: true });
  fs.mkdirSync(inputDir, { recursive: true });
  fs.copyFileSync(gov.entry.path, path.join(inputDir, path.basename(gov.entry.path)));
  fs.copyFileSync(path.join(runDir, 'workspace.patch'), path.join(inputDir, 'workspace.patch'));
  fs.copyFileSync(RUBRIC, path.join(inputDir, 'UX_REFINEMENT_PROFILE.md'));
  for (const phase of ['baseline', 'after']) {
    const src = runPaths(runDir).phaseDir(phase);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(inputDir, 'verification', phase), { recursive: true, filter: (f) => !/server\.log$/.test(f) });
  }
  const promptPath = path.join(runDir, 'adapters', `${role}.prompt.md`);
  fs.writeFileSync(promptPath, judgePrompt(runDir, role, criteria, gov));
  const judgePolicy = { ...policy, denied_tools: [...policy.denied_tools, `Read(/${path.join(runDir, 'adapters')}/**)`, 'Edit', 'Write', 'Bash'] };
  const { env } = scrubbedEnv({}, { keepProvider: true });
  const result = runner.runAdapter(judgePolicy, { promptPath, stage: `improve.${role}`, dryRun: options.dryRun, cwd: inputDir, env });
  const provenance = roleProvenance(judgePolicy, result);
  const peeked = toolCommands(judgePolicy.transcript_path).some((t) => /adapters\/builder\./.test(JSON.stringify(t.input || {})));
  append(runDir, 'judgment_run', { role, executor: policy.id, verifier_input: input, input_dir: inputDir, provenance, adapter_status: result.status, maker_trace_accessed: peeked });
  if (peeked) return { status: 'blocked', reason: 'judge accessed the builder transcript; judgments not recorded', provenance };
  const parsed = lastJsonLine(fs.existsSync(policy.output_path) ? fs.readFileSync(policy.output_path, 'utf8') : '');
  const recorded = [];
  for (const j of list(parsed?.judgments)) {
    recorded.push(submitJudgment(runDir, { ...j, producer_role: role, executor: policy.id, observed_model: provenance.observed_model, source: { transcript: policy.transcript_path } }));
  }
  if (list(parsed?.risks).length) append(runDir, 'risks_reported', { role, risks: parsed.risks });
  return { status: result.status, recorded: recorded.length, provenance };
}

// ---------------------------------------------------------------------------
// decision (#178). Pure function of recorded state; no model call.

function evaluateCriteria(contract, evidence, contractVersion) {
  return contract.acceptance.map((a) => {
    const relevant = evidence.filter((e) => e.criterion === a.id && (e.phase === 'after' || e.kind === 'judgment') && e.contract_version === contractVersion);
    const qualifying = relevant.filter((e) => e.level <= a.required_level && !e.self_review && e.producer_role !== 'builder');
    const insufficient = relevant.filter((e) => !qualifying.includes(e));
    let status = 'missing';
    if (qualifying.some((e) => e.result === 'fail')) status = 'failed';
    else if (qualifying.some((e) => e.result === 'pass')) status = 'satisfied';
    return {
      id: a.id, statement: a.statement, mandatory: a.mandatory, required_level: a.required_level, status,
      qualifying: qualifying.map((e) => ({ id: e.id, level: e.level, result: e.result, producer: e.producer_role })),
      not_counted: insufficient.map((e) => ({ id: e.id, level: e.level, result: e.result, producer: e.producer_role, why: e.self_review || e.producer_role === 'builder' ? 'self-review' : `level ${e.level} cannot satisfy level ${a.required_level}` })),
    };
  });
}

function decide(state) {
  const reasons = [];
  if (state.integrity_failed) return { decision: 'INCONCLUSIVE', reasons: ['frozen contract or evidence integrity failed'] };
  if (state.side_effects_attempted > 0) reasons.push(`builder attempted ${state.side_effects_attempted} prohibited side effect(s)`);
  if (state.scope.outside_scope.length) reasons.push(`changed files outside scope: ${state.scope.outside_scope.join(', ')}`);
  if (state.scope.protected_touched.length) reasons.push(`protected paths changed: ${state.scope.protected_touched.join(', ')}`);
  if (state.scope.too_many_files) reasons.push('change exceeds scope.max_files');
  if (!state.base.unchanged) reasons.push('protected base ref moved during the run');
  if (state.empty_diff) reasons.push('builder produced no product change');
  const failed = state.criteria.filter((c) => c.mandatory && c.status === 'failed');
  if (failed.length) reasons.push(`mandatory criteria failed: ${failed.map((c) => c.id).join(', ')}`);
  if (state.regressions.length) reasons.push(`gates regressed from baseline: ${state.regressions.join(', ')}`);
  if (reasons.length) return { decision: 'REVERT', reasons };
  const missing = state.criteria.filter((c) => c.mandatory && c.status !== 'satisfied');
  const inconclusive = [];
  if (missing.length) inconclusive.push(`mandatory criteria without qualifying evidence: ${missing.map((c) => c.id).join(', ')}`);
  if (state.gates_missing.length) inconclusive.push(`gates without a result: ${state.gates_missing.join(', ')}`);
  if (state.baseline_blocker) inconclusive.push(`baseline blocker accepted: ${state.baseline_blocker}`);
  if (state.rail_gate !== 'pass') inconclusive.push(`verifier rail gate is ${state.rail_gate}`);
  if (inconclusive.length) return { decision: 'INCONCLUSIVE', reasons: inconclusive };
  return { decision: 'KEEP', reasons: ['all mandatory criteria satisfied by qualifying evidence; no gate regressed; scope and safety held'] };
}

function evaluate(runDir) {
  const run = loadRun(runDir);
  const evs = events(runDir);
  if (lastEvent(evs, 'decision_made')) throw new Error('This run already has a decision; decisions are not re-rolled');
  const started = lastEvent(evs, 'implementation_started');
  if (!started) throw new Error('Nothing to evaluate: no implementation attempt was recorded');
  const gov = governingContract(runDir);
  const evidence = readEvidence(runDir);
  const evidenceTampered = evs.filter((e) => e.event === 'evidence_added' && e.evidence_sha256).some((e) => {
    const item = evidence.find((x) => x.id === e.evidence_id);
    return !item || !fs.existsSync(item.evidence_path) || fileSha(item.evidence_path) !== e.evidence_sha256;
  });
  const diff = workspaceDiff(run) || { files: [], patch: '', sha256: sha256('') };
  fs.writeFileSync(path.join(runDir, 'workspace.patch'), diff.patch);
  const gates = list(gov.contract.gates).map((g) => {
    const pick = (phase) => evidence.filter((e) => e.criterion === `gate:${g.id}` && e.phase === phase).slice(-1)[0]?.result || 'missing';
    return { id: g.id, baseline: pick('baseline'), after: pick('after') };
  });
  const findingsPath = runner.verificationPaths({ runDir: runPaths(runDir).phaseDir('after') }).findingsPath;
  const findings = fs.existsSync(findingsPath) ? runner.readLedger(findingsPath) : [];
  const finished = lastEvent(evs, 'implementation_finished');
  const state = {
    integrity_failed: gov.tampered || gov.artifactErrors.length > 0 || evidenceTampered || !verifyLedger(runDir).ok,
    side_effects_attempted: evs.filter((e) => e.event === 'side_effect_attempted').length + (finished?.forbidden_action_detected ? 1 : 0),
    scope: scopeCheck(gov.contract, diff.files),
    base: baseUnchanged(run),
    empty_diff: diff.files.length === 0,
    criteria: evaluateCriteria(gov.contract, evidence, gov.entry.version),
    regressions: gates.filter((g) => g.baseline === 'pass' && g.after === 'fail').map((g) => g.id),
    gates_missing: gates.filter((g) => g.after === 'missing' || g.after === 'unavailable').map((g) => g.id),
    preexisting_gate_failures: gates.filter((g) => g.baseline === 'fail' && g.after === 'fail').map((g) => g.id),
    baseline_blocker: started.baseline_blocker_accepted || null,
    rail_gate: runner.verifierGateDecision(findings),
  };
  const { decision, reasons } = decide(state);
  const record = {
    schema: 'specflow.improve.decision/v1',
    run_id: run.run_id,
    decision,
    reasons,
    decided_at: now(),
    contract: { version: gov.entry.version, sha256: gov.entry.contract_sha256, ignored_later_versions: gov.ignoredLaterVersions },
    builder_claim: finished?.claim || 'unknown',
    divergence: finished?.claim === 'complete' && decision !== 'KEEP' ? 'builder_claimed_complete_but_decision_differs' : null,
    gates,
    workspace: { branch: workspaceFor(run, 'improve').branch, files: diff.files, patch_sha256: diff.sha256 },
    ...state,
  };
  const digest = writeJson(runPaths(runDir).decisionPath, record);
  append(runDir, 'decision_made', { decision, reasons, decision_sha256: digest, workspace_patch_sha256: diff.sha256, builder_claim: record.builder_claim, divergence: record.divergence });
  return record;
}

// ---------------------------------------------------------------------------
// finalize: apply the decision without touching base (AC-04-3)

function finalize(runDir) {
  const run = loadRun(runDir);
  const evs = events(runDir);
  const made = lastEvent(evs, 'decision_made');
  if (!made) throw new Error('No decision to apply');
  if (lastEvent(evs, 'decision_applied')) throw new Error('Decision already applied');
  const decision = readJson(runPaths(runDir).decisionPath);
  if (fileSha(runPaths(runDir).decisionPath) !== made.decision_sha256) throw new Error('decision.json changed after it was recorded');
  const ws = workspaceFor(run, 'improve');
  const diff = workspaceDiff(run);
  if (diff && diff.sha256 !== made.workspace_patch_sha256) {
    append(runDir, 'unrecorded_mutation', { expected: made.workspace_patch_sha256, observed: diff.sha256 });
    throw new Error('Workspace changed after evaluation; re-run verification before applying a decision');
  }
  const patchPath = path.join(runDir, 'workspace.patch');
  const applied = { decision: decision.decision, patch_path: patchPath, patch_sha256: made.workspace_patch_sha256, branch: ws.branch, commit: null, branch_retained: false };
  if (decision.decision === 'KEEP' && diff && diff.files.length) {
    const title = readJson(governingContract(runDir).entry.path).candidate.title;
    const msg = `improve(${run.run_id}): ${title}\n\nSpecflow improve --once decision KEEP. Contract v${decision.contract.version} sha256 ${decision.contract.sha256}.`;
    git(['-c', 'user.name=specflow-improve', '-c', 'user.email=specflow-improve@localhost', 'commit', '-m', msg], ws.worktreePath);
    applied.commit = git(['rev-parse', 'HEAD'], ws.worktreePath);
    applied.branch_retained = true;
  }
  // REVERT and INCONCLUSIVE retain no product change: the attempt survives
  // only as workspace.patch plus its evidence. Base is never touched.
  for (const kind of ['improve', 'baseline']) {
    const w = workspaceFor(run, kind);
    if (fs.existsSync(w.worktreePath)) runner.releaseWorktree({ repoRoot: run.target_repo, worktreePath: w.worktreePath, branch: w.branch, remove: true });
    if (!(kind === 'improve' && applied.branch_retained)) git(['branch', '-D', w.branch], run.target_repo, { allowFail: true });
  }
  applied.base = baseUnchanged(run);
  append(runDir, 'decision_applied', applied);
  const report = writeReport(runDir);
  return { ...applied, report };
}

// ---------------------------------------------------------------------------
// status and report (#179)

function status(runDir) {
  const evs = events(runDir);
  const has = (n) => Boolean(lastEvent(evs, n));
  let next = 'record candidates (improve candidates RUN FILE)';
  if (has('decision_applied')) next = 'terminal: human reviews report.md';
  else if (has('decision_made')) next = 'apply the decision (improve finalize RUN)';
  else if (has('verification_completed')) next = 'optional independent judgment (improve judge), then improve evaluate RUN';
  else if (has('implementation_finished')) next = 'run frozen checks on the workspace (improve verify RUN)';
  else if (has('implementation_started')) next = 'interrupted during implementation: the workspace is recorded; evaluate as-is or finalize will not claim success';
  else if (has('baseline_recorded')) next = 'implement (improve build RUN --policy P)';
  else if (has('baseline_blocked')) next = 'baseline did not reproduce the problem: supersede the contract before implementation';
  else if (has('contract_frozen')) next = 'capture the baseline (improve baseline RUN)';
  else if (has('candidates_recorded')) next = 'freeze the ImprovementContract (improve contract RUN FILE)';
  return {
    run_dir: runDir,
    terminal: has('decision_applied'),
    decision: lastEvent(evs, 'decision_made')?.decision || null,
    last_event: evs.length ? evs[evs.length - 1].event : null,
    next_action: next,
    ledger: verifyLedger(runDir),
  };
}

function money(v) { return typeof v === 'number' ? `$${v.toFixed(4)}` : 'unknown'; }

function writeReport(runDir) {
  const run = loadRun(runDir);
  const evs = events(runDir);
  const p = runPaths(runDir);
  const decision = fs.existsSync(p.decisionPath) ? readJson(p.decisionPath) : null;
  const gov = governingContract(runDir);
  const cands = fs.existsSync(p.candidatesPath) ? readJson(p.candidatesPath) : { candidates: [] };
  const sel = cands.candidates.find((c) => c.status === 'selected');
  const applied = lastEvent(evs, 'decision_applied');
  const ledger = verifyLedger(runDir);
  const evidence = readEvidence(runDir);
  const roles = [
    ...evs.filter((e) => e.event === 'role_recorded').map((e) => ({ role: e.role, executor: e.executor, requested: e.requested_model || '-', observed: e.observed_model || 'unknown', cost: e.cost_usd ?? null })),
    ...evs.filter((e) => e.event === 'implementation_finished' || e.event === 'judgment_run').map((e) => ({
      role: e.role, executor: e.provenance.policy_id, requested: e.provenance.requested_model || '-', observed: e.provenance.observed_model, cost: e.provenance.cost_usd,
    })),
  ];
  const measured = roles.filter((r) => typeof r.cost === 'number').reduce((s, r) => s + r.cost, 0);
  const unknown = roles.filter((r) => typeof r.cost !== 'number').length;
  const pick = (criterion, phase) => evidence.filter((e) => e.criterion === criterion && e.phase === phase && e.kind !== 'judgment').slice(-1)[0];
  const headline = !decision ? 'No decision yet.'
    : decision.decision === 'KEEP' ? `Improvement established: ${gov.contract.hypothesis}`
      : decision.decision === 'REVERT' ? 'Change reverted: it failed, regressed or broke the run boundary. Product unchanged.'
        : 'Improvement not established: the evidence cannot show the change is better. Product unchanged.';
  const lines = [
    `# Improvement run ${run.run_id} — ${decision ? decision.decision : 'IN PROGRESS'}`,
    '',
    `**Product result:** ${headline}`,
    '',
    decision ? `**Why:** ${decision.reasons.join('; ')}` : '',
    '',
    '## Human next decision',
    '',
    !decision ? `- ${status(runDir).next_action}`
      : decision.decision === 'KEEP' ? `- Review branch \`${applied?.branch}\` (commit \`${applied?.commit}\`) and decide whether to push/open a PR. Specflow never pushes or merges.`
        : decision.decision === 'REVERT' ? '- Nothing to merge. Decide whether the opportunity deserves a differently scoped contract.'
          : `- Decide whether to gather the missing evidence or discard. The attempted patch is preserved at \`workspace.patch\` (sha256 ${applied?.patch_sha256 || decision.workspace.patch_sha256}).`,
    '',
    '## Selected opportunity',
    '',
    sel ? `**${sel.title}** (${sel.kind}; value ${sel.expected_value}, risk ${sel.risk}, cost ${sel.cost})` : '-',
    '',
    sel ? `- Observation: ${sel.observation}\n- User impact: ${sel.user_impact}\n- Mission: ${sel.mission_relevance}\n- Why this one: ${cands.selection?.rationale}` : '',
    '',
    `Alternatives kept visible: ${cands.candidates.filter((c) => c !== sel).map((c) => `${c.id} (${c.status}: ${c.reason})`).join('; ') || 'none'}`,
    '',
    '## Frozen contract',
    '',
    gov ? `v${gov.entry.version}, sha256 \`${gov.entry.contract_sha256.slice(0, 16)}…\`, frozen before implementation. Hypothesis: ${gov.contract.hypothesis}` : 'none',
    gov ? `\nNon-goals: ${gov.contract.non_goals.join('; ')}` : '',
    '',
    '| Criterion | Required level | Baseline | After | Decision status | Not counted |',
    '|---|---|---|---|---|---|',
    ...(decision ? decision.criteria.map((c) => `| ${c.id}${c.mandatory ? '' : ' (optional)'} — ${c.statement} | ${c.required_level} (${EVIDENCE_LEVELS[c.required_level]}) | ${pick(c.id, 'baseline')?.result || '-'} | ${pick(c.id, 'after')?.result || '-'} | **${c.status}** | ${c.not_counted.map((n) => `${n.id}: ${n.why}`).join('; ') || '-'} |`) : []),
    '',
    decision && decision.gates.length ? `Gates: ${decision.gates.map((g) => `${g.id} ${g.baseline}→${g.after}`).join(', ')}${decision.preexisting_gate_failures.length ? ` (pre-existing failures: ${decision.preexisting_gate_failures.join(', ')})` : ''}` : '',
    '',
    '## Independent judgment (supports, never replaces, executable evidence)',
    '',
    ...evidence.filter((e) => e.kind === 'judgment').map((e) => `- ${e.criterion} — level ${e.level} ${e.result} by ${e.producer_role} (${e.executor}${e.observed_model ? `, ${e.observed_model}` : ''})${e.self_review ? ' **[self-review, not counted]**' : ''}: ${e.rationale}`),
    ...evs.filter((e) => e.event === 'risks_reported').flatMap((e) => e.risks.map((r) => `- Risk (${e.role}): ${r}`)),
    '',
    '## Safety and change',
    '',
    `- Base \`${run.base_ref}\` recorded ${run.base_commit.slice(0, 12)}; now ${(applied?.base || baseUnchanged(run)).current?.slice(0, 12)} — ${(applied?.base || baseUnchanged(run)).unchanged ? 'unchanged' : '**MOVED**'}`,
    `- Prohibited side effects blocked before execution: ${evs.filter((e) => e.event === 'side_effect_blocked').length}; attempted by builder: ${evs.filter((e) => e.event === 'side_effect_attempted').length}`,
    decision ? `- Files changed: ${decision.workspace.files.join(', ') || 'none'}; outside scope: ${decision.scope.outside_scope.join(', ') || 'none'}; protected: ${decision.scope.protected_touched.join(', ') || 'none'}` : '',
    applied ? `- Applied: ${applied.branch_retained ? `retained on \`${applied.branch}\` @ \`${applied.commit}\`` : 'no product change retained'}; patch preserved (${applied.patch_sha256.slice(0, 16)}…)` : '',
    decision?.divergence ? `- Divergence: ${decision.divergence} (builder claimed \`${decision.builder_claim}\`)` : '',
    '',
    '## Models and cost',
    '',
    '| Role | Executor | Requested | Observed | Cost |',
    '|---|---|---|---|---|',
    ...roles.map((r) => `| ${r.role} | ${r.executor} | ${r.requested} | ${r.observed} | ${money(r.cost)} |`),
    '',
    `Measured spend ${money(measured)}; ${unknown} role(s) with unknown cost (not counted as zero).`,
    '',
    '## Trace',
    '',
    `Ledger ${ledger.entries} entries, chain ${ledger.ok ? 'verified' : `**BROKEN** (${ledger.errors.join('; ')})`}, head \`${ledger.head_sha256?.slice(0, 16)}…\`. Mission sha256 \`${run.mission.sha256.slice(0, 16)}…\`.`,
    '',
  ];
  fs.writeFileSync(p.reportPath, lines.filter((l) => l !== null).join('\n'));
  return p.reportPath;
}

// Host-session roles (scout, UX critic, contract writer) are recorded with
// honest provenance; unknown cost stays unknown.
function recordRole(runDir, role) {
  loadRun(runDir);
  for (const f of ['role', 'executor']) if (!nonempty(role?.[f])) throw new Error(`role.${f} is required`);
  return append(runDir, 'role_recorded', {
    role: role.role, executor: role.executor, requested_model: role.requested_model || null,
    observed_model: role.observed_model || 'unknown', cost_usd: typeof role.cost_usd === 'number' ? role.cost_usd : null,
    cost_status: typeof role.cost_usd === 'number' ? 'measured' : 'unknown', note: role.note || null,
  });
}

// ---------------------------------------------------------------------------
// CLI

const USAGE = `Usage:
  specflow improve --once --target DIR --mission FILE [--base REF] [--run-id ID] [--state-dir DIR] [--worktree-root DIR]
  specflow improve status RUN_DIR
  specflow improve candidates RUN_DIR CANDIDATES.json
  specflow improve contract RUN_DIR CONTRACT.json [--supersede "reason"]
  specflow improve baseline RUN_DIR
  specflow improve build RUN_DIR --policy POLICY.yml [--prompt EXTRA.md] [--dry-run] [--accept-baseline-blocker "why"]
  specflow improve exec RUN_DIR --role ROLE -- COMMAND...
  specflow improve verify RUN_DIR
  specflow improve judge RUN_DIR --policy POLICY.yml [--role ux-evaluator] [--criteria A,B] [--dry-run]
  specflow improve evidence RUN_DIR JUDGMENT.json
  specflow improve role RUN_DIR ROLE.json
  specflow improve evaluate RUN_DIR
  specflow improve finalize RUN_DIR
  specflow improve report RUN_DIR
  specflow improve verify-ledger RUN_DIR`;

async function cli(argv = process.argv.slice(2)) {
  const dash = argv.indexOf('--');
  const tail = dash >= 0 ? argv.slice(dash + 1) : [];
  const args = runner.parseKeyValueArgs(dash >= 0 ? argv.slice(0, dash) : argv);
  const [command, runDirArg, fileArg] = args._;
  const runDir = runDirArg ? path.resolve(runDirArg) : null;
  const print = (v) => console.log(JSON.stringify(v, null, 2));
  try {
    if (args.once && !command) {
      const { runDir: dir, run } = startRun(args);
      print({ status: 'started', run_dir: dir, base_commit: run.base_commit, next_action: status(dir).next_action });
      return 0;
    }
    if (!command || !runDir) { console.error(USAGE); return 2; }
    let result;
    switch (command) {
      case 'status': result = status(runDir); break;
      case 'candidates': result = recordCandidates(runDir, fileArg); break;
      case 'contract': result = freezeContract(runDir, fileArg, { supersede: args.supersede }); break;
      case 'baseline': result = await verifyPhase(runDir, 'baseline'); break;
      case 'build': result = build(runDir, { policy: args.policy, prompt: args.prompt, dryRun: Boolean(args.dryRun), acceptBaselineBlocker: args.acceptBaselineBlocker }); break;
      case 'exec': {
        const run = loadRun(runDir);
        const r = guardedSpawn(runDir, args.role || 'builder', tail, { cwd: workspaceFor(run, 'improve').worktreePath });
        process.stdout.write(r.stdout); process.stderr.write(r.stderr);
        if (r.status === 'blocked') { console.error(`blocked: ${r.blocked.category} (${r.blocked.matched})`); return 3; }
        return r.exit_code ?? 1;
      }
      case 'verify': result = await verifyPhase(runDir, 'after'); break;
      case 'judge': result = judge(runDir, { policy: args.policy, role: args.role, criteria: args.criteria ? String(args.criteria).split(',') : null, dryRun: Boolean(args.dryRun) }); break;
      case 'evidence': result = submitJudgment(runDir, readJson(fileArg)); break;
      case 'role': result = recordRole(runDir, readJson(fileArg)); break;
      case 'evaluate': result = evaluate(runDir); break;
      case 'finalize': result = finalize(runDir); break;
      case 'report': result = { report: writeReport(runDir) }; break;
      case 'verify-ledger': result = verifyLedger(runDir); break;
      default: console.error(USAGE); return 2;
    }
    print(result);
    if (['rejected', 'blocked', 'baseline_blocked'].includes(result?.status) || result?.ok === false) return 1;
    return 0;
  } catch (e) {
    console.error(`specflow improve: ${e.message}`);
    return 2;
  }
}

module.exports = {
  DECISIONS,
  EVIDENCE_LEVELS,
  classifySideEffect,
  scrubbedEnv,
  globToRegex,
  scopeCheck,
  startRun,
  validateCandidates,
  recordCandidates,
  validateContract,
  freezeContract,
  governingContract,
  prepareWorkspace,
  verifyPhase,
  submitJudgment,
  recordRole,
  build,
  judge,
  evaluateCriteria,
  decide,
  evaluate,
  finalize,
  status,
  writeReport,
  verifyLedger,
  append,
  events,
  cli,
};

if (require.main === module) cli().then((code) => { process.exitCode = code; });
