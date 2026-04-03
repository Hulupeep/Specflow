#!/usr/bin/env node

const { execSync } = require('child_process');
const { resolve, dirname } = require('path');
const { existsSync } = require('fs');

// Specflow root is one level up from bin/
const SPECFLOW_ROOT = resolve(dirname(__filename), '..');

const COMMANDS = {
  init: {
    usage: 'specflow init [target-dir]',
    desc: 'Set up Specflow in a project (safe to re-run)',
    run: (args) => {
      const target = resolve(args[0] || '.');
      exec(`bash "${SPECFLOW_ROOT}/setup-project.sh" "${target}"`);
    },
  },
  verify: {
    usage: 'specflow verify',
    desc: 'Check Specflow installation (hooks, contracts, version)',
    run: () => {
      exec(`bash "${SPECFLOW_ROOT}/verify-setup.sh"`);
    },
  },
  update: {
    usage: 'specflow update [target-dir] [--ci]',
    desc: 'Update hooks and optionally install CI workflows',
    run: (args) => {
      const ciFlag = args.includes('--ci') ? '--ci' : '';
      const target = resolve(args.find(a => a !== '--ci') || '.');
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
  console.log(`\n  specflow help                          Show this help\n`);
  console.log('Examples:');
  console.log('  npx @colmbyrne/specflow init .');
  console.log('  npx @colmbyrne/specflow verify');
  console.log('  npx @colmbyrne/specflow update . --ci');
  console.log('  npx @colmbyrne/specflow audit 500');
  console.log('  npx @colmbyrne/specflow graph\n');
  process.exit(0);
}

if (!COMMANDS[command]) {
  console.error(`Unknown command: ${command}\n`);
  console.error('Run specflow help for available commands.');
  process.exit(1);
}

COMMANDS[command].run(args);
