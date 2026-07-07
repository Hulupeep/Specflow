#!/usr/bin/env node

const { execSync } = require('child_process');
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
  init: {
    usage: 'specflow init [target-dir]',
    desc: 'Set up Specflow in a project (safe to re-run)',
    run: (args) => {
      const target = resolve(args[0] || '.');
      normalizeShellScripts(SPECFLOW_ROOT);
      exec(`bash "${SPECFLOW_ROOT}/setup-project.sh" "${target}"`);
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
    usage: 'specflow update [target-dir] [--ci]',
    desc: 'Update hooks and optionally install CI workflows',
    run: (args) => {
      const ciFlag = args.includes('--ci') ? '--ci' : '';
      const target = resolve(args.find(a => a !== '--ci') || '.');
      normalizeShellScripts(SPECFLOW_ROOT);
      exec(`bash "${SPECFLOW_ROOT}/install-hooks.sh" "${target}" ${ciFlag}`);
    },
  },
  audit: {
    usage: 'specflow audit <issue-number>',
    desc: 'Audit a GitHub issue for specflow compliance',
    run: (args) => {
      const issue = args[0];
      if (!issue || !/^\d+$/.test(issue)) {
        console.error('Usage: specflow audit <issue-number>');
        process.exit(1);
      }
      // Fetch and check compliance markers
      const body = execSilent(`gh issue view ${issue} --json title,body,comments`);
      if (!body) {
        const repo = execSilent('git config --get remote.origin.url')?.trim() || 'unknown';
        console.error(`Could not fetch issue #${issue}.`);
        console.error(`  Repo: ${repo}`);
        console.error(`  Check: gh auth status`);
        console.error(`  Check: gh issue view ${issue}`);
        process.exit(1);
      }
      const parsed = JSON.parse(body);
      const title = parsed.title || '';
      const fullText = [parsed.body || '', ...(parsed.comments || []).map(c => c.body || '')].join('\n');

      console.log(`\nAUDIT: #${issue} — ${title}\n`);

      const checks = [
        { name: 'Gherkin', pattern: /Scenario:/i, },
        { name: 'Acceptance', pattern: /- \[[ x]\]/,  },
        { name: 'Journey ID', pattern: /J-[A-Z0-9]+(-[A-Z0-9]+)*/,  },
        { name: 'data-testid', pattern: /data-testid/i,  },
        { name: 'SQL', pattern: /CREATE\s+(TABLE|FUNCTION|OR REPLACE FUNCTION)/i,  },
        { name: 'RLS', pattern: /CREATE\s+POLICY|ENABLE\s+ROW\s+LEVEL\s+SECURITY|ROW\s+LEVEL\s+SECURITY/i,  },
        { name: 'Invariants', pattern: /I-[A-Z]{2,}-\d+/,  },
        { name: 'TypeScript', pattern: /(?:interface|type)\s+\w+/,  },
        { name: 'Scope', pattern: /In Scope|Not In Scope/i,  },
        { name: 'DoD', pattern: /Definition of Done|DoD/i,  },
        { name: 'Pre-flight', pattern: /simulation_status:\s*\w+/,  },
      ];

      let passCount = 0;
      const maxName = Math.max(...checks.map(c => c.name.length));

      for (const check of checks) {
        const match = fullText.match(check.pattern);
        const status = match ? '\x1b[32m✅\x1b[0m' : '\x1b[31m❌\x1b[0m';
        const evidence = match ? match[0].substring(0, 60) : 'MISSING';
        console.log(`  ${status} ${check.name.padEnd(maxName + 2)} ${evidence}`);
        if (match) passCount++;
      }

      console.log(`\n  ${passCount}/${checks.length} checks passed\n`);

      const missing = checks.filter(c => !c.pattern.test(fullText)).map(c => c.name);

      if (missing.length === 0) {
        console.log('  VERDICT: Compliant\n');
      } else {
        console.log(`  VERDICT: ${missing.length > 7 ? 'Non-compliant' : 'Needs uplift'}\n`);
        console.log('  FIX: Tell Claude Code in your project:\n');
        console.log(`  "Read scripts/agents/specflow-writer.md and uplift issue #${issue}.`);
        console.log(`   It's missing: ${missing.join(', ')}.`);
        console.log('   Add the missing sections to the issue body."\n');
        console.log('  MISSING:');
        for (const name of missing) {
          console.log(`  - ${name}`);
        }
        console.log('');
      }
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
    usage: 'specflow run <loop> [--slug <slug>] [--goal <goal>] [--input <path>] [--adapter-routing <path>]',
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
  console.log('  npx @colmbyrne/specflow init .            # Mac/Linux any terminal; Windows = Git Bash');
  console.log('  npx @colmbyrne/specflow update . --ci');
  console.log('  npx @colmbyrne/specflow verify');
  console.log('  npx @colmbyrne/specflow audit 500');
  console.log('  npx @colmbyrne/specflow run spec-build --slug my-feature --goal "ready tickets" --input docs/idea.md');
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
