#!/usr/bin/env node
'use strict';
// Explicit owner-invoked bounded qualification. No service, scheduler, API billing,
// arbitrary repository recipes, downloads, publication or production credentials.
const fs = require('fs'),
  path = require('path'),
  crypto = require('crypto'),
  { spawnSync } = require('child_process');
const w = require('./improve-worker.cjs'),
  p = require('./improve-profiles.cjs'),
  core = require('./specflow-improve.cjs');
const sha = (b) => crypto.createHash('sha256').update(b).digest('hex');
function dir(p) {
  fs.mkdirSync(p, { recursive: true, mode: 0o700 });
  fs.chmodSync(p, 0o700);
  return p;
}
function json(file, v) {
  fs.writeFileSync(file, JSON.stringify(v, null, 2) + '\n', { mode: 0o600 });
}
function must(ok, msg) {
  if (!ok) throw new w.WorkerError(msg, 'qualification');
}
function version(exe) {
  const r = spawnSync(exe, ['--version'], {
    encoding: 'utf8',
    env: w.controlledEnvironment(),
    cwd: '/tmp',
    timeout: 10000
  });
  must(r.status === 0, 'tool_version_unavailable');
  return r.stdout.trim();
}
const repoRoot = path.resolve(__dirname, '..');
async function transport(o, root) {
  const layer = w.createSoftwareLayer({
    node: process.execPath,
    pnpmRoot: o.pnpm_root,
    playwrightRoot: o.playwright_root,
    browserDirectory: o.browser_directory
  });
  const workerConfig = {
    image: w.DockerWorker.ensureImage(dir(path.join(root, 'engine'))),
    layer,
    stateRoot: path.join(root, 'engine'),
    gitArea: dir(path.join(root, 'git'))
  };
  const worker = new w.DockerWorker(workerConfig);
  const app = dir(path.join(root, 'transport-app')),
    fixture = dir(path.join(root, 'fixture')),
    oracle = dir(path.join(root, 'transport-oracle')),
    output = dir(path.join(root, 'transport-output'));
  fs.writeFileSync(path.join(fixture, 'token'), crypto.randomBytes(24).toString('hex'), { mode: 0o600 });
  fs.writeFileSync(
    path.join(app, 'server.cjs'),
    fs
      .readFileSync(path.join(repoRoot, 'tests/fixtures/improve-worker/server.cjs'), 'utf8')
      .replace('status.textContent=r.status', "document.querySelector('#status').textContent=r.status")
  );
  fs.copyFileSync(
    path.join(repoRoot, 'tests/e2e/journey_worker_qualification.spec.cjs'),
    path.join(oracle, 'journey_worker_qualification.spec.cjs')
  );
  const canaries = ['host-credential-canary', 'publisher-canary', 'other-job-canary'].map((name) => {
    const f = path.join(root, name);
    fs.writeFileSync(f, crypto.randomBytes(24).toString('hex'), { mode: 0o600 });
    return f;
  });
  const boundaryQualification = require('./improve-worker-boundary.cjs').qualifyBoundaries(worker, { root, canaries });
  let browser;
  try {
    browser = w.runBrowserCheck(worker, { source: app, oracle, fixture, output, canaries });
    must(browser.status === 0 && browser.boundaryStatus === 0, 'browser_transport_failed');
  } finally {
    worker.close();
  }
  const pw = JSON.parse(fs.readFileSync(path.join(output, 'playwright.json')));
  must(pw.stats.expected === 2 && pw.stats.unexpected === 0 && pw.stats.skipped === 0, 'browser_journey_incomplete');
  const git = path.join(workerConfig.gitArea, 'repo');
  dir(git);
  let r = w.isolatedGit(worker, workerConfig.gitArea, ['init', '-b', 'main', git]);
  must(r.status === 0, 'git_transport_failed');
  fs.copyFileSync(path.join(repoRoot, 'tests/fixtures/improve-worker/server.cjs'), path.join(git, 'server.cjs'));
  fs.copyFileSync(
    path.join(repoRoot, 'tests/e2e/journey_worker_qualification.spec.cjs'),
    path.join(git, 'journey_worker_qualification.spec.cjs')
  );
  fs.writeFileSync(
    path.join(git, 'package.json'),
    JSON.stringify({ name: 'specflow-worker-qualification', version: '1.0.0', private: true })
  );
  for (const args of [
    ['add', '.'],
    ['commit', '-m', 'qualification fixture'],
    ['remote', 'add', 'origin', 'https://github.com/example/specflow-worker-qualification.git']
  ]) {
    r = w.isolatedGit(worker, workerConfig.gitArea, args, { cwd: git });
    must(r.status === 0, 'git_transport_failed');
  }
  const marker = path.join(root, 'HOST-MUST-NOT-EXIST');
  dir(path.join(git, '.git', 'hooks'));
  fs.writeFileSync(path.join(git, '.git', 'hooks', 'pre-commit'), '#!/bin/sh\necho escaped > ' + marker + '\n', {
    mode: 0o700
  });
  // Exercise both a hostile config and hook through actual confined Git.
  fs.appendFileSync(path.join(git, '.git', 'config'), '\n[core]\n fsmonitor = "echo escaped > ' + marker + '"\n');
  r = w.isolatedGit(worker, workerConfig.gitArea, ['status', '--porcelain'], { cwd: git });
  must(r.status === 0 && !fs.existsSync(marker), 'git_host_escape');
  const packageResult = w.runOfflinePackage(worker, git);
  const events = dir(path.join(root, 'roles')),
    empty = dir(path.join(root, 'empty'));
  const roles = [];
  for (const [role, model, effectiveModel] of [
    ['builder', 'sonnet', 'claude-sonnet-5-5'],
    ['oracle', 'opus', 'claude-opus-5-5']
  ]) {
    const result = w.roleCall({
      deadlineAtMs: Date.now() + 600000,
      role,
      model,
      effectiveModel,
      prompt: 'Transport qualification only. Return observed="transport-ready". No repository actions.',
      schema: {
        type: 'object',
        properties: { observed: { type: 'string', const: 'transport-ready' } },
        required: ['observed'],
        additionalProperties: false
      },
      cwd: empty,
      evidence: events,
      claude: fs.realpathSync(o.claude)
    });
    must(result.output.observed === 'transport-ready', 'role_transport_failed');
    roles.push(result.provenance);
  }
  const result = {
    version: 1,
    grade: 'isolated-transport-observed; full core cycle not yet qualified',
    observed_at: new Date().toISOString(),
    docker: w.DockerWorker.probe(),
    boundaryQualification,
    software_sha256: layer.sha256,
    image: workerConfig.image,
    node: process.version,
    pnpm: packageResult.version,
    offlinePackage: packageResult,
    browser: {
      passed: pw.stats.expected,
      failed: pw.stats.unexpected,
      skipped: pw.stats.skipped,
      boundary: browser.boundary,
      directReadback: browser.state
    },
    git: { confined: true, hostMarkerAbsent: !fs.existsSync(marker) },
    roles,
    usage_mode: 'subscription_cli',
    actual_charges: 'unmeasured',
    supabase_next_recipe: 'unqualified',
    managed_openai_runtime: 'unavailable: no approved API-billed account route or qualified host',
    code_sha256: sha(fs.readFileSync(path.join(__dirname, 'improve-worker.cjs')))
  };
  json(path.join(root, 'transport.json'), result);
  json(path.join(root, 'worker.json'), workerConfig);
  return { workerConfig, git, fixture, roles, empty };
}
function fileSchema() {
  return {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          properties: { path: { type: 'string' }, content: { type: 'string' } },
          required: ['path', 'content'],
          additionalProperties: false
        }
      },
      claim: { type: 'string' }
    },
    required: ['files', 'claim'],
    additionalProperties: false
  };
}
function configure(o, root) {
  const workerConfig = JSON.parse(fs.readFileSync(path.join(root, 'worker.json'))),
    git = path.join(workerConfig.gitArea, 'repo');
  const head = w
    .isolatedGit(new w.DockerWorker(workerConfig), workerConfig.gitArea, ['rev-parse', 'HEAD'], { cwd: git })
    .stdout.trim();
  const routing = path.join(root, 'routing.json');
  json(routing, {
    mode: 'subscription_cli',
    builder: 'claude-sonnet-5-5',
    oracle: 'claude-opus-5-5',
    peer: 'claude-opus-5-5',
    judge: 'claude-opus-5-5'
  });
  const revision = sha(
    JSON.stringify(
      fs
        .readdirSync(__dirname)
        .filter((f) => f.endsWith('.cjs') || f === 'improve-worker-store.py')
        .sort()
        .map((f) => [f, sha(fs.readFileSync(path.join(__dirname, f)))])
    ) + JSON.stringify(workerConfig.layer)
  );
  const evidence = {
    path: path.join(root, 'transport.json'),
    sha256: sha(fs.readFileSync(path.join(root, 'transport.json')))
  };
  const backendRecipe = ['node', 'server.cjs'];
  const host = {
    revision,
    operations: ['read', 'preflight', 'execute'],
    adapters: [
      {
        id: 'local-docker-fixture',
        revision,
        qualified: true,
        usage_modes: ['subscription_cli'],
        noninteractive_roles: true,
        evidence
      }
    ],
    backends: [
      {
        recipe: sha(JSON.stringify({ repo_id: 'worker-fixture', commit: head, argv: backendRecipe })),
        ready: true,
        evidence
      }
    ]
  };
  const principal = 'local-owner-' + process.getuid(),
    registry = dir(path.join(root, 'registry')),
    claude = fs.realpathSync(o.claude);
  const toolchain = [
    ['node', fs.realpathSync(process.execPath)],
    ['git', '/usr/bin/git'],
    ['claude', claude]
  ].map(([id, path]) => ({ id, path, sha256: sha(fs.readFileSync(path)), version: version(path) }));
  const profile = {
    version: 1,
    repo_id: 'worker-fixture',
    repository: {
      path: git,
      remote: 'https://github.com/example/specflow-worker-qualification.git',
      refs: [{ name: 'main', commit: head }]
    },
    mission: 'Show reliable save feedback while preserving persistence and denied-write security.',
    scope: { allowed: ['server.cjs'], protected: ['.git/**', '.env*', 'journey*'] },
    recipes: {
      setup: ['node', '--version'],
      test: ['node', 'journey_worker_qualification.spec.cjs'],
      backend: backendRecipe
    },
    verifier: {
      path: 'journey_worker_qualification.spec.cjs',
      sha256: sha(fs.readFileSync(path.join(git, 'journey_worker_qualification.spec.cjs')))
    },
    toolchain,
    routing: {
      path: routing,
      sha256: sha(fs.readFileSync(routing)),
      usage_mode: 'subscription_cli',
      providers: [{ id: 'claude', kind: 'claude-cli', tool: 'claude' }]
    },
    runtime: { adapter: 'local-docker-fixture', revision },
    secret_references: [{ id: 'fixture', kind: 'file', path: path.join(root, 'fixture/token'), purpose: 'fixture' }],
    evidence: { path: dir(path.join(root, 'core')) },
    publication: { allowed: false, branch_prefix: 'improve/', automatic_merge: false },
    grants: { [principal]: ['read', 'preflight', 'execute'] }
  };
  const registered = p.registerProfile(registry, profile);
  const bin = dir(path.join(root, 'bin'));
  const cfg = {
    worker: workerConfig,
    gitArea: workerConfig.gitArea,
    fixture: path.join(root, 'fixture'),
    checkOutputs: dir(path.join(root, 'checks')),
    canaries: ['host-credential-canary', 'publisher-canary', 'other-job-canary'].map((n) => path.join(root, n)),
    roles: path.join(root, 'roles'),
    emptyCwd: path.join(root, 'empty'),
    claude,
    backend_sha256: w.backendFingerprint(fs.readFileSync(path.join(git, 'server.cjs'), 'utf8')),
    allowed: profile.scope.allowed,
    protected: profile.scope.protected,
    models: {
      builder: 'claude-sonnet-5-5',
      oracle: 'claude-opus-5-5',
      peer: 'claude-opus-5-5',
      judge: 'claude-opus-5-5'
    },
    schemas: {
      builder: fileSchema(),
      oracle: fileSchema(),
      judge: {
        type: 'object',
        properties: {
          judgments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                criterion: { type: 'string', enum: ['UX-RESTRAINT'] },
                level: { type: 'integer', enum: [4] },
                result: { type: 'string', enum: ['pass', 'fail', 'unavailable'] },
                rationale: { type: 'string' }
              },
              required: ['criterion', 'level', 'result', 'rationale'],
              additionalProperties: false
            }
          },
          risks: { type: 'array', items: { type: 'string' } }
        },
        required: ['judgments', 'risks'],
        additionalProperties: false
      }
    },
    authority: {
      uid: process.getuid(),
      principal,
      registry,
      repo_id: profile.repo_id,
      revision: registered.revision,
      host
    },
    bin,
    launcher: path.join(bin, 'worker-command')
  };
  w.pinnedLauncher({ directory: bin, config: cfg, mode: 'git' });
  w.pinnedLauncher({ directory: bin, config: cfg, mode: 'worker' });
  const pre = w.currentAuthority(cfg);
  json(path.join(root, 'preflight.json'), { ...pre.report, lease: undefined });
  json(path.join(root, 'configuration.json'), {
    configFile: path.join(bin, 'job.json'),
    profile_revision: registered.revision,
    head,
    repo: git
  });
  return cfg;
}
async function stage(root, name, args) {
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'configuration.json')));
  const result = await w.awaitStage(w.startAuthorizedStage(conf.configFile, name, args));
  const history = dir(path.join(root, 'stage-history'));
  const file = path.join(history, Date.now() + '-' + name);
  fs.writeFileSync(file + '.stdout', result.stdout, { mode: 0o600 });
  fs.writeFileSync(file + '.stderr', result.stderr, { mode: 0o600 });
  must(result.status === 0, 'core_' + name + '_failed');
  const lines = result.stdout.trim().split('\n');
  const value = JSON.parse(lines.at(-1));
  json(file + '.result.json', value);
  return value;
}
module.exports = { transport, configure, stage };
async function main() {
  const [ownerFile, action = 'transport', existing] = process.argv.slice(2);
  must(ownerFile, 'owner_config_required');
  const st = fs.lstatSync(ownerFile);
  must(
    st.isFile() && !st.isSymbolicLink() && st.uid === process.getuid() && !(st.mode & 0o077),
    'private_owner_config_required'
  );
  const o = JSON.parse(fs.readFileSync(ownerFile));
  const root = existing || fs.mkdtempSync(path.join(dir(o.state_root), 'qualification-'));
  fs.chmodSync(root, 0o700);
  if (action === 'all') await all(o, root);
  else if (action === 'recover') recover(root);
  else if (action === 'transport') await transport(o, root);
  else if (action === 'configure') configure(o, root);
  else if (action === 'begin') await beginCore(root);
  else if (action === 'persist') await persist(root);
  else await phase(root, action);
  console.log(JSON.stringify({ root, action, status: 'passed' }));
}
if (require.main === module)
  main().catch((e) => {
    console.error(
      JSON.stringify({
        code: e.code || 'qualification_failed',
        stage: e.stage || 'qualification',
        next_action: e.next_action || 'Inspect private history; do not rerun a consumed holdout.'
      })
    );
    process.exitCode = 1;
  });
function candidates() {
  const selected = {
    id: 'save-feedback',
    title: 'Restore visible save feedback',
    kind: 'defect',
    status: 'selected',
    observation:
      'The seeded browser writes persist but its status element remains empty because window.status is selected implicitly.',
    user_impact: 'Owners cannot tell whether Save succeeded.',
    mission_relevance: 'Reliable feedback for a persisted owner action.',
    hypothesis: 'Explicitly select the status element to display Saved and Forbidden without changing persistence.',
    evidence: [{ kind: 'actual-browser', ref: 'transport failed-attempt and corrected fixture captures' }],
    expected_value: 'medium',
    risk: 'low',
    reversibility: 'high',
    cost: 'S',
    evaluability: { best_level: 2, method: 'Real browser status, reload, direct backend readback and denied mutation.' }
  };
  const other = (id, title, kind, reason) => ({
    ...selected,
    id,
    title,
    kind,
    status: 'rejected',
    reason,
    expected_value: 'low',
    observation: 'Qualification fixture already has readable controls.',
    hypothesis: 'Changing ' + title + ' might help but no observed need exists.',
    evidence: []
  });
  return {
    sources: [{ kind: 'runtime', ref: 'real Node HTTP fixture and browser preparation history' }],
    candidates: [
      selected,
      other('layout', 'Change the layout', 'ux-refinement', 'No observed layout problem.'),
      other('names', 'Rename internals', 'cleanup', 'No user-visible gain.')
    ],
    selection: {
      candidate_id: selected.id,
      rationale: 'A reproduced bounded feedback defect with executable preservation checks.',
      outranked: [
        { id: 'layout', why: 'No observed need.' },
        { id: 'names', why: 'No user-visible gain.' }
      ]
    }
  };
}
async function beginCore(root) {
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'configuration.json'))),
    cfg = JSON.parse(fs.readFileSync(conf.configFile));
  const mission = path.join(root, 'mission.md');
  fs.writeFileSync(
    mission,
    'Show reliable save feedback while preserving owner persistence and denied-write security.'
  );
  const result = await stage(root, 'startRun', [
    {
      target: conf.repo,
      mission,
      base: 'main',
      runId: 'worker-core-once',
      stateDir: path.join(root, 'core'),
      worktreeRoot: path.join(cfg.gitArea, 'worktrees')
    }
  ]);
  const run = result.runDir;
  json(path.join(root, 'active-core.json'), { runDir: run });
  json(path.join(root, 'candidates.json'), candidates());
  await stage(root, 'recordCandidates', [run, path.join(root, 'candidates.json')]);
  return run;
}
function active(root) {
  return JSON.parse(fs.readFileSync(path.join(root, 'active-core.json'))).runDir;
}
function policy(root, role) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'bin/job.json')));
  const file = path.join(root, role + '-policy.json');
  json(file, {
    adapter_policy: {
      id: 'worker-' + role,
      provider: 'claude-print',
      command: cfg.launcher,
      role: role === 'builder' ? 'implementer' : 'verifier',
      args: ['role', role, '-p'],
      model: role === 'builder' ? 'sonnet' : 'opus',
      requested_model: role === 'builder' ? 'sonnet' : 'opus',
      timeout_seconds: 300,
      max_iterations: 1,
      allowed_tools: [],
      denied_tools: ['Read', 'Write', 'Edit', 'Bash'],
      transcript_path: '.specflow/runs/<slug>/adapters/' + role + '.jsonl',
      output_path: '.specflow/runs/<slug>/adapters/' + role + '.final.txt',
      never_without_human: ['git push', 'open PR', 'merge', '--no-verify', 'override contract', 'production deploy']
    }
  });
  return file;
}
function contract(root) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'bin/job.json')));
  return {
    candidate_id: 'save-feedback',
    observation: 'Owner writes persist, but status feedback is empty.',
    user_problem: 'Owners cannot tell if Save succeeded.',
    mission_relation: 'Reliable save feedback and persisted owner data.',
    hypothesis: 'Explicit status selection restores feedback without affecting saved values or access denial.',
    baseline:
      'Unmodified seed has implicit window.status collision. Independent baseline artifacts live in verification/baseline; earlier actual browser-83c0ako7 diagnosis showed empty status while the value persisted.',
    implementation_notes: [
      'Change only the inline served client HTML/script in the existing template literal. Outside that literal all server.cjs bytes must remain identical; adapter enforces a pinned backend fingerprint.',
      'Select #status explicitly; preserve existing IDs, labels, controls, auth, routes and persisted state. Only success/403 feedback is claimed; network/5xx recovery is out of scope.',
      'Every check invocation receives a fresh app/container/tmpfs backend seeded with value seed. No consumed runtime data is ignored as a mutable output.'
    ],
    acceptance: [
      {
        id: 'SAVE-JOURNEY',
        statement:
          'At 1280px and 360px the owner sees Saved, reloads and reads back the persisted value, then sees Forbidden after a 403 with unchanged data and Saved after the next authorised attempt.',
        required_level: 2,
        mandatory: true,
        intent: 'gain',
        baseline_expectation: 'fail',
        dev_baseline_expectation: 'fail',
        check: {
          type: 'playwright',
          level: 2,
          artifact: 'holdout/independent.spec.cjs',
          command: [cfg.launcher, 'check', '{artifact}'],
          timeout_seconds: 120
        },
        dev_check: {
          type: 'playwright',
          level: 2,
          artifact: 'dev/journey_worker_qualification.spec.cjs',
          command: [cfg.launcher, 'check', '{artifact}'],
          timeout_seconds: 120
        }
      },
      {
        id: 'UX-RESTRAINT',
        statement:
          'At 1280px and 360px preserve all labels and controls, no overflow or truncation; Saved and Forbidden are visible without scrolling. Judge actual success/denial screenshots, not a builder claim.',
        required_level: 4,
        mandatory: true,
        baseline_expectation: 'n/a'
      }
    ],
    non_goals: ['No layout redesign, dependencies, auth change or backend change.'],
    evaluation_method:
      'Frozen independent prebuild Playwright oracle and separate practice journey; fresh Opus UX judgment sees images and diff, never builder trace.',
    affected_journey: 'J-WORKER-QUALIFICATION',
    scope: { allowed_paths: ['server.cjs'], max_files: 1 },
    ux_profile: {
      preserve: ['labels', 'Save button', 'simple readable layout', 'persisted value', '403 denied mutation']
    },
    safety: { external_side_effects: 'none' },
    gates: [{ id: 'offline-package-runtime', command: [cfg.launcher, 'setup'], timeout_seconds: 120 }],
    runtime: { identity: { disposable_outputs: [], mutable_outputs: [] } }
  };
}
async function phase(root, name) {
  const run = active(root);
  if (name === 'critique') {
    const draft = path.join(root, 'contract.draft.json');
    json(draft, contract(root));
    const result = await stage(root, 'critique', [run, { draft }]);
    json(path.join(root, 'critique.json'), result);
    return result;
  }
  if (name === 'oracle') {
    const prompt = path.join(root, 'oracle.prompt.md');
    fs.writeFileSync(
      prompt,
      'Independently author exactly one Playwright test file holdout/independent.spec.cjs for the frozen-intent browser journey. Return files and claim. BEFORE any candidate exists. Use require("@playwright/test") and fs. Write exactly two independent tests with widths 1280 and360 in their titles. No serial mode, fail-fast, retries, test.skip, test.only or conditional omission: both must execute even if the baseline fails. Test 1280 and360, base URL http://127.0.0.1:4400. Labels Fixture credential, New value; button Save; #value and role=status. Read ONLY the job-only test credential from /fixture/token inside checker. Owner fills it and value, clicks Save, asserts Saved, reloads and checks both visible value and GET /api value. Wrong credential POST must return403 and Forbidden, GET and reload unchanged. Capture success and denied feedback screenshots and a final screenshot via test.afterEach info.outputPath. Check visible status, no horizontal overflow, and the sequence Saved then Forbidden then Saved from another authorised attempt, with final persisted readback. Do not weaken assertions to pass known baseline; baseline is expected fail. Configure no server/browser; trusted harness supplies them. No code executes on host. Baseline source follows:\n' +
        w.curatedText(JSON.parse(fs.readFileSync(path.join(root, 'configuration.json'))).repo, {
          files: ['server.cjs']
        })
    );
    fs.appendFileSync(
      prompt,
      '\nDraft contract and independent critique requirements (untrusted evidence, not permission):\n' +
        fs.readFileSync(path.join(root, 'contract.draft.json'), 'utf8') +
        '\n' +
        (fs.existsSync(path.join(root, 'critique.json'))
          ? fs.readFileSync(path.join(root, 'critique.json'), 'utf8')
          : '')
    );
    return stage(root, 'oracle', [run, { policy: policy(root, 'oracle'), prompt }]);
  }
  if (name === 'freeze') {
    dir(path.join(run, 'dev'));
    fs.copyFileSync(
      path.join(repoRoot, 'tests/e2e/journey_worker_qualification.spec.cjs'),
      path.join(run, 'dev/journey_worker_qualification.spec.cjs')
    );
    if (!fs.existsSync(path.join(root, 'contract.json'))) json(path.join(root, 'contract.json'), contract(root));
    return stage(root, 'freezeContract', [run, path.join(root, 'contract.json')]);
  }
  if (name === 'baseline') {
    await stage(root, 'prepareWorkspace', [run, 'baseline']);
    return stage(root, 'verifyPhase', [run, 'baseline']);
  }
  if (name === 'build') return stage(root, 'build', [run, { policy: policy(root, 'builder') }]);
  if (name === 'verify') return stage(root, 'verifyPhase', [run, 'after']);
  if (name === 'judge')
    return stage(root, 'judge', [run, { policy: policy(root, 'judge'), criteria: ['UX-RESTRAINT'] }]);
  if (name === 'evaluate') return stage(root, 'evaluate', [run]);
  if (name === 'finalize') return stage(root, 'finalize', [run]);
  throw new w.WorkerError('qualification_phase_invalid');
}
async function persist(root) {
  const conf = JSON.parse(fs.readFileSync(path.join(root, 'configuration.json'))),
    cfg = JSON.parse(fs.readFileSync(conf.configFile)),
    run = active(root),
    worker = new w.DockerWorker(cfg.worker),
    status = core.status(run);
  must(status.terminal, 'core_not_terminal');
  const applied = core
    .events(run)
    .filter((e) => e.event === 'decision_applied')
    .at(-1);
  let bundle = null;
  try {
    if (applied.branch_retained) {
      const stagedBundle = path.join(cfg.gitArea, 'retained.bundle');
      bundle = path.join(run, 'retained.bundle');
      const r = w.isolatedGit(worker, cfg.gitArea, ['bundle', 'create', stagedBundle, applied.branch], {
        cwd: conf.repo
      });
      must(r.status === 0, 'retained_bundle_failed');
      fs.copyFileSync(stagedBundle, bundle);
    }
    worker.close();
    const meta = {
      job_id: 'qualification-' + sha(root).slice(0, 24),
      operation_id: 'worker-core-once',
      principal: cfg.authority.principal,
      repo_id: cfg.authority.repo_id,
      profile_revision: conf.profile_revision,
      core_run_id: 'worker-core-once'
    };
    const store = new w.DurableStore({ root: dir(path.join(root, 'durable')), sourceRoot: run });
    const receipt = w.durableCoreResult({ store, meta, runDir: run, workers: worker, retainedBundle: bundle });
    json(path.join(root, 'terminal-ack.json'), receipt);
    fs.rmSync(cfg.gitArea, { recursive: true, force: true });
    fs.rmSync(run, { recursive: true, force: true });
    const recovered = store.recover(meta.job_id, meta);
    must(recovered.manifest_sha256 === receipt.manifest_sha256, 'recovery_mismatch');
    must(store.commit(meta, run).manifest_sha256 === receipt.manifest_sha256, 'lost_ack_mismatch');
    json(path.join(root, 'recovered.json'), {
      ...recovered,
      workerAndGitDeleted: true,
      coreSourceDeleted: true,
      noNewCycle: true,
      noNewKeepAuthority: true
    });
    return recovered;
  } finally {
    worker.close();
  }
}
Object.assign(module.exports, { beginCore, phase, persist, contract, candidateDocument:candidates });
async function all(o, root) {
  await transport(o, root);
  configure(o, root);
  await beginCore(root);
  for (const name of ['critique', 'oracle', 'freeze', 'baseline', 'build', 'verify', 'judge', 'evaluate', 'finalize']) {
    const value = await phase(root, name);
    if (name === 'critique' && value.contract_requirements?.length)
      throw new w.WorkerError(
        'contract_amendment_required',
        'contract',
        'The independent critique requires explicit contract amendments before oracle/freeze.',
        true,
        'Amend the private draft/contract, retain the critique and continue the same unconsumed cycle; never silently ignore its requirements.'
      );
    if (['critique', 'oracle', 'freeze', 'baseline'].includes(name))
      must(!['blocked', 'rejected'].includes(value.status), 'qualification_' + name + '_blocked');
  }
  return persist(root);
}
function recover(root) {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'bin/job.json'))),
    conf = JSON.parse(fs.readFileSync(path.join(root, 'configuration.json')));
  const inspected = w.profileService(config).inspect({ repo_id: config.authority.repo_id });
  must(inspected.available, 'historical_read_unavailable');
  const meta = {
    job_id: 'qualification-' + sha(root).slice(0, 24),
    operation_id: 'worker-core-once',
    principal: config.authority.principal,
    repo_id: config.authority.repo_id,
    profile_revision: conf.profile_revision,
    core_run_id: 'worker-core-once'
  };
  const store = new w.DurableStore({
    root: path.join(root, 'durable'),
    sourceRoot: path.join(root, 'core/worker-core-once')
  });
  return store.recover(meta.job_id, meta);
}
Object.assign(module.exports, { all, recover });
