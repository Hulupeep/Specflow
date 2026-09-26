#!/usr/bin/env node

const { execFileSync, execSync } = require('child_process');
const { resolve, dirname, join } = require('path');
const { existsSync, readFileSync, writeFileSync, readdirSync } = require('fs');
const { cli: runSpecflowLoop, planAdapterSmoke, runAdapter, scaffoldRoutineManifest } = require('../scripts/specflow-runner.cjs');

// Specflow root is one level up from bin/
const SPECFLOW_ROOT = resolve(dirname(__filename), '..');

// Self-heal CRLF: bash (Linux/Mac) fails on Windows line endings. The published tarball
// can ship CRLF if it was packed from a Windows checkout, so normalize the shell scripts
// we're about to run — at runtime, via node, which always runs (unlike npm lifecycle scripts).
function stripCR(p) {
  try {
    const s = readFileSync(p, 'utf8');
    if (s.includes('\r')) writeFileSync(p, s.replace(/\r\n/g, '\n'));
  } catch (_) { /* ignore unreadable/missing */ }
}
function normalizeShellScripts(root) {
  for (const dir of ['.', 'hooks', 'scripts']) {
    const abs = join(root, dir);
    if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) if (f.endsWith('.sh')) stripCR(join(abs, f));
  }
  for (const hook of ['hooks/commit-msg', 'hooks/pre-push']) stripCR(join(root, hook));
}

const COMMANDS = {
  specification: {
    usage: 'specflow specification <import|status|frontier|gate|promote|experiment|begin|collect|reconcile|publish|volume|exception> [arguments]',
    desc: 'Prepare only the selected slice, execute bounded learning and reconcile discoveries',
    run: args => { process.exitCode = require('../scripts/specflow-specification.cjs').cli(args); },
  },
  tier: {
    usage: 'specflow tier inspect <record.json> [route] [operation] | install-labels',
    desc: 'Inspect applicable specification depth and evidence-based build eligibility',
    run: args => { process.exitCode = require('../scripts/specflow-tier.cjs').cli(args); },
  },
  'routing-shadow': {
    usage: 'specflow routing-shadow <init|enable|observe|trial|label|report|ack> [arguments]',
    desc: 'Opt-in private routing study; never changes production model choices',
    run: args => require('../scripts/typesafe-routing.cjs').cli(args).catch(e => { console.error(e.message); process.exitCode = 2; }),
  },
  improve: {
    usage: 'specflow improve --once --target <dir> --mission <file> | <stage> <run-dir>',
    desc: 'One verified product-improvement cycle: frozen contract, isolated workspace, KEEP/REVERT/INCONCLUSIVE',
    run: args => require('../scripts/specflow-improve.cjs').cli(args).then(code => { process.exitCode = code; }),
  },
  'duo-build': {
    usage: 'specflow duo-build <check|start|resume|status|eligibility|capture|review|finish> [options]',
    desc: 'Durable helper for the native /duo-build or $duo-build workflow',
    run: (args) => { process.exitCode = require('../scripts/duo-build.cjs').cli(args); },
  },
  init: {
    usage: 'specflow init [target-dir] --runtime codex|claude-code [--replace-routing]',
    desc: 'Set up Specflow in a project (safe to re-run)',
    run: (args) => {
      const runtimeIndex = args.indexOf('--runtime');
      const runtime = runtimeIndex >= 0 ? args[runtimeIndex + 1] : null;
      if (runtimeIndex >= 0 && (!runtime || runtime.startsWith('--'))) {
        console.error('specflow init: --runtime requires codex or claude-code');
        process.exit(1);
      }
      const replaceRouting = args.includes('--replace-routing');
      const targetArg = args.find((arg, index) => !arg.startsWith('--') && index !== runtimeIndex + 1);
      const target = resolve(targetArg || '.');
      normalizeShellScripts(SPECFLOW_ROOT);
      execFile('bash', [join(SPECFLOW_ROOT, 'setup-project.sh'), target, ...(runtime ? ['--runtime', runtime] : []), ...(replaceRouting ? ['--replace-routing'] : [])]);
    },
  },
  verify: {
    usage: 'specflow verify [--strict]',
    desc: 'Check Specflow installation; --strict also fails on project-readiness blockers',
    run: (args) => {
      const strictFlag = args.includes('--strict') ? '--strict' : '';
      normalizeShellScripts(SPECFLOW_ROOT);
      exec(`bash "${SPECFLOW_ROOT}/verify-setup.sh" ${strictFlag}`);
    },
  },
  update: {
    usage: 'specflow update [target-dir] [--ci] --runtime codex|claude-code [--replace-routing]',
    desc: 'Update hooks and optionally install CI workflows',
    run: (args) => {
      const ciFlag = args.includes('--ci') ? '--ci' : '';
      const runtimeIndex = args.indexOf('--runtime');
      const runtime = runtimeIndex >= 0 ? args[runtimeIndex + 1] : null;
      if (runtimeIndex >= 0 && (!runtime || runtime.startsWith('--'))) {
        console.error('specflow update: --runtime requires codex or claude-code');
        process.exit(1);
      }
      const replaceRouting = args.includes('--replace-routing');
      const targetArg = args.find((arg, index) => !arg.startsWith('--') && index !== runtimeIndex + 1);
      const target = resolve(targetArg || '.');
      normalizeShellScripts(SPECFLOW_ROOT);
      execFile('bash', [join(SPECFLOW_ROOT, 'install-hooks.sh'), target, ...(ciFlag ? [ciFlag] : []), ...(runtime ? ['--runtime', runtime] : []), ...(replaceRouting ? ['--replace-routing'] : [])]);
    },
  },
  audit: {
    usage: 'specflow audit <issue-number> [--tier-record record.json]',
    desc: 'Audit a GitHub issue for specflow compliance',
    run: (args) => {
      const issue = args[0];
      if (!issue || !/^\d+$/.test(issue)) {
        console.error('Usage: specflow audit <issue-number>');
        process.exit(1);
      }
      // Fetch and check compliance markers
      const body = execSilent(`gh issue view ${issue} --json number,title,body,comments,labels`);
      if (!body) {
        const repo = execSilent('git config --get remote.origin.url')?.trim() || 'unknown';
        console.error(`Could not fetch issue #${issue}.`);
        console.error(`  Repo: ${repo}`);
        console.error(`  Check: gh auth status`);
        console.error(`  Check: gh issue view ${issue}`);
        process.exit(1);
      }
      const parsed = JSON.parse(body);
      const recordIndex = args.indexOf('--tier-record');
      const record = recordIndex >= 0
        ? JSON.parse(readFileSync(args[recordIndex + 1], 'utf8'))
        : { issue: parsed };
      // The fetched issue is authoritative: a local record cannot retain an old
      // body or replace current labels just to make an audit green.
      record.issue = parsed;
      const tier = require('../scripts/specflow-tier.cjs');
      const decision = tier.evaluate(record, {
        root: process.cwd(), route: 'specflow-audit',
        operation: tier.tierOf(parsed).tier === 'build-ready' ? 'build' : 'inspect',
      });
      console.log(JSON.stringify(decision, null, 2));
      process.exitCode = decision.status === 'blocked' ? 2 : 0;
    },
  },
  graph: {
    usage: 'specflow graph [contracts-dir]',
    desc: 'Validate contract graph integrity',
    run: (args) => {
      const dir = args[0] || 'docs/contracts';
      const script = resolve(SPECFLOW_ROOT, 'scripts', 'verify-graph.cjs');
      exec(`node "${script}" "${dir}"`);
    },
  },
  run: {
    usage: 'specflow run <loop> [--slug <slug>] [--goal <goal>] [--input <path>] [--stage-evidence <path>] [--adapter-routing <path>] | specflow run --setup-routing --runtime codex|claude-code | specflow run --check-routing-models | specflow run --update-routing-models',
    desc: 'Run or resume a local contracted Specflow loop',
    run: (args) => {
      const code = runSpecflowLoop(args);
      if (code) process.exit(code);
    },
  },
  provenance: {
    usage: 'specflow provenance <provenance.json> [--diff file|--git-diff|--staged-diff]',
    desc: 'Verify source provenance evidence for a feature-build slice',
    run: (args) => {
      const file = args[0];
      if (!file) {
        console.error('Usage: specflow provenance <provenance.json> [--diff file|--git-diff|--staged-diff]');
        process.exit(2);
      }
      const script = resolve(SPECFLOW_ROOT, 'scripts', 'provenance-gate.cjs');
      const rest = args.slice(1).map((arg) => arg.startsWith('--') ? arg : `"${resolve(arg)}"`).join(' ');
      exec(`node "${script}" "${resolve(file)}" ${rest}`);
    },
  },
  'ci-status': {
    usage: 'specflow ci-status <pr-number>',
    desc: 'Read GitHub PR check status for Gate C triage',
    run: (args) => {
      const pr = args[0];
      if (!pr || !/^\d+$/.test(pr)) {
        console.error('Usage: specflow ci-status <pr-number>');
        process.exit(2);
      }
      const raw = execSilent(`gh pr view ${pr} --json statusCheckRollup`);
      if (!raw) {
        console.error(`Could not read PR #${pr} checks. Verify gh auth and repo context.`);
        process.exit(1);
      }
      const checks = JSON.parse(raw).statusCheckRollup || [];
      const statusOf = (check) => String(check.conclusion || check.status || check.state || check.bucket || '').toUpperCase();
      const failing = checks.filter((check) => ['FAILURE', 'FAIL', 'FAILING', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(statusOf(check)));
      const pending = checks.filter((check) => ['PENDING', 'QUEUED', 'IN_PROGRESS', 'WAITING', 'REQUESTED'].includes(statusOf(check)));
      console.log(JSON.stringify({
        pr: Number(pr),
        total: checks.length,
        failing: failing.map((check) => ({ name: check.name, status: statusOf(check), link: check.link || check.detailsUrl })),
        pending: pending.map((check) => ({ name: check.name, status: statusOf(check), link: check.link || check.detailsUrl })),
        gate_c: failing.length ? 'red' : (pending.length ? 'pending' : 'green'),
      }, null, 2));
      if (failing.length) process.exit(1);
    },
  },
  'adapter-smoke': {
    usage: 'specflow adapter-smoke <claude-print|codex-exec> [--live]',
    desc: 'Plan or run an opt-in local adapter smoke check',
    run: (args) => {
      const provider = args[0];
      if (!['claude-print', 'codex-exec'].includes(provider)) {
        console.error('Usage: specflow adapter-smoke <claude-print|codex-exec> [--live]');
        process.exit(2);
      }
      const smoke = planAdapterSmoke(provider, { live: args.includes('--live') });
      console.log(JSON.stringify(smoke, null, 2));
      if (!args.includes('--live')) return;
      const result = runAdapter(smoke.policy, { owningGateCommand: 'adapter smoke only' });
      console.log(JSON.stringify(result, null, 2));
      if (!['gate_rerun_required', 'dry_run'].includes(result.status)) process.exit(1);
    },
  },
  routine: {
    usage: 'specflow routine <slug> [--kind cron|github-actions|hosted] [--loop spec-build|feature-build] [--input path]',
    desc: 'Scaffold a scheduled Specflow routine manifest that calls specflow run',
    run: (args) => {
      const slug = args[0];
      if (!slug || slug.startsWith('--')) {
        console.error('Usage: specflow routine <slug> [--kind cron|github-actions|hosted] [--loop spec-build|feature-build] [--input path]');
        process.exit(2);
      }
      const opt = (name, fallback) => {
        const idx = args.indexOf(`--${name}`);
        return idx === -1 ? fallback : args[idx + 1];
      };
      const result = scaffoldRoutineManifest({
        slug,
        kind: opt('kind', 'cron'),
        loop: opt('loop', 'spec-build'),
        input: opt('input', 'docs/idea.md'),
        goal: opt('goal', `Run ${slug}`),
      });
      console.log(JSON.stringify(result, null, 2));
    },
  },
};

function exec(cmd) {
  try {
    execSync(cmd, { stdio: 'inherit' });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

function execFile(command, args) {
  try {
    execFileSync(command, args, { stdio: 'inherit' });
  } catch (e) {
    process.exit(e.status || 1);
  }
}

function execSilent(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    return null;
  }
}

// --- CLI entry point ---

const [command, ...args] = process.argv.slice(2);

if (!command || command === 'help' || command === '--help' || command === '-h') {
  console.log('\nSpecflow — Specs that enforce themselves.\n');
  console.log('Usage: specflow <command> [options]\n');
  console.log('Commands:');
  for (const [name, cmd] of Object.entries(COMMANDS)) {
    console.log(`  ${cmd.usage.padEnd(40)} ${cmd.desc}`);
  }
  console.log(`\n  specflow help                            Show this help\n`);
  console.log('`init` scaffolds, in one command:');
  console.log('  • contracts, hooks, agents, tests (the enforcement layer)');
  console.log('  • the loop kit QA/loops/ — 3 loops: spec-build · feature-build · daily-use-teardown');
  console.log('  • gate scripts: verify-graph, verify-seed, adversary-spawn, verify-ticket-journey,');
  console.log('    verify-falsification, verify-seams, teardown-gate');
  console.log('  • the adversary critic skill (Gate A) into ~/.claude|.codex/skills  (--no-adversary to skip)');
  console.log('  • process docs: PROCESS.md / -GUIDE / -CLAUDE / -CODEX');
  console.log('  → then read QA/loops/README.md to run the pipeline.\n');
  console.log('Examples:');
  console.log('  npx @colmbyrne/specflow init . --runtime codex  # Mac/Linux any terminal; Windows = Git Bash');
  console.log('  npx @colmbyrne/specflow update . --ci --runtime claude-code');
  console.log('  npx @colmbyrne/specflow verify');
  console.log('  npx @colmbyrne/specflow audit 500');
  console.log('  npx @colmbyrne/specflow run spec-build --slug my-feature --goal "ready tickets" --input docs/idea.md');
  console.log('  npx @colmbyrne/specflow run --setup-routing --runtime codex');
  console.log('  npx @colmbyrne/specflow run --check-routing-models');
  console.log('  npx @colmbyrne/specflow run --update-routing-models');
  console.log('  npx @colmbyrne/specflow run spec-build --slug my-feature --adapter-routing .specflow/adapter-routing.yml --confirm-models');
  console.log('  npx @colmbyrne/specflow provenance evidence/provenance-77-78-80.json --git-diff');
  console.log('  npx @colmbyrne/specflow adapter-smoke claude-print --dry-run');
  console.log('  npx @colmbyrne/specflow ci-status 76');
  console.log('  npx @colmbyrne/specflow graph\n');
  process.exit(0);
}

if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}\n`);
  console.error('Run specflow help for available commands.');
  process.exit(1);
}

COMMANDS[command].run(args);
