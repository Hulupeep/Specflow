# Getting Started with Specflow

Four paths depending on how you work. Pick one — they all lead to the same place.

[← Back to README](../README.md)

---

## Which Path Is Right for You?

| I want to... | Use |
|---|---|
| Run one script and be done | [Path A: Automated Setup](#path-a-automated-setup-recommended) |
| Follow step-by-step manually | [Path B: Explicit Manual Setup](#path-b-explicit-manual-setup) |
| Drop in a single file for instant enforcement | [Path C: SKILL.md (Single File)](#path-c-skillmd-single-file) |
| Let Claude Code handle everything | [Path D: One Prompt Setup](#path-d-one-prompt-setup) |

---

## Path A: Automated Setup (Recommended)

**Best for:** Anyone starting a new project or adding Specflow to an existing one.

One command. Everything installed. Tests pass at the end.

```bash
npx @colmbyrne/specflow init .
```

Or if you have Specflow cloned locally:

```bash
bash /path/to/Specflow/setup-project.sh .
```

**What it does (in order):**

| Step | What | Result |
|------|------|--------|
| 1 | Creates directory structure | `docs/contracts/`, `scripts/agents/`, `tests/`, etc. |
| 2 | Copies 30+ agent files | `scripts/agents/*.md` |
| 3 | Copies 5 default contracts | `docs/contracts/*_defaults.yml` |
| 4 | Copies scripts and examples | `scripts/`, `examples/` |
| 5 | Creates `package.json` and `jest.config.js` | npm test scripts configured |
| 6 | Creates test infrastructure | `tests/helpers/contract-loader.js`, `tests/contracts/contract-schema.test.js` |
| 7 | Creates `.specflow/baseline.json` and `.defer-journal` | State tracking files |
| 8 | Initializes git + commit-msg hook | Enforces issue numbers in commits |
| 9 | Installs Claude Code hooks | `.claude/hooks/`, `.claude/settings.json` |
| 10 | Runs `npm install`, `npm test`, `verify-setup.sh` | Verifies everything works |

**After the script finishes:**

1. Update `CLAUDE.md` with your project context (repo, board, tech stack)
2. Tell Claude: "Create a specflow contract for [your feature]"
3. Tell Claude: "Execute waves"

---

## Path B: Explicit Manual Setup

**Best for:** Full control, understanding each piece, or non-standard project layouts.

Every step below is exactly what `setup-project.sh` does. Nothing hidden.

### Step 1: Create directory structure

```bash
cd your-project

mkdir -p docs/contracts
mkdir -p scripts/agents
mkdir -p tests/contracts
mkdir -p tests/helpers
mkdir -p tests/e2e
mkdir -p hooks
mkdir -p examples
mkdir -p .specflow
mkdir -p .claude
```

### Step 2: Copy agents

```bash
cp /path/to/Specflow/agents/*.md scripts/agents/
```

This gives you 30+ agent prompts including `waves-controller.md` (the master orchestrator), `specflow-writer.md`, `contract-validator.md`, etc.

### Step 3: Copy default contracts

```bash
cp /path/to/Specflow/templates/contracts/*.yml docs/contracts/
```

This installs 5 default contracts:

| Contract | Rules | What it catches |
|----------|-------|----------------|
| `security_defaults.yml` | SEC-001..005 | Hardcoded secrets, SQL injection, XSS, eval, path traversal |
| `accessibility_defaults.yml` | A11Y-001..004 | Missing alt text, aria-labels, form labels |
| `test_integrity_defaults.yml` | TEST-001..005 | Mocking in E2E tests, placeholder tests |
| `production_readiness_defaults.yml` | PROD-001..003 | Demo data in production, placeholder domains |
| `component_library_defaults.yml` | COMP-001..003 | Component patterns |

### Step 4: Copy scripts and examples

```bash
# Utility scripts
cp /path/to/Specflow/scripts/specflow-compile.cjs scripts/
cp /path/to/Specflow/scripts/verify-graph.cjs scripts/

# Examples and templates
cp /path/to/Specflow/examples/* examples/
cp /path/to/Specflow/templates/journeys-template.csv examples/

# Hook source files (for reference)
cp /path/to/Specflow/hooks/* hooks/
chmod +x hooks/*.sh
```

### Step 5: Create package.json

```bash
cat > package.json << 'EOF'
{
  "name": "your-project",
  "version": "1.0.0",
  "private": true,
  "description": "Specflow-compliant project",
  "scripts": {
    "test": "jest --no-coverage",
    "test:contracts": "jest tests/contracts/ --no-coverage",
    "test:e2e": "echo 'No E2E tests configured yet'",
    "test:verbose": "jest --verbose --no-coverage",
    "compile:journeys": "node scripts/specflow-compile.cjs",
    "verify:graph": "node scripts/verify-graph.cjs",
    "verify:contracts": "npm run test:contracts"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "js-yaml": "^4.1.0"
  }
}
EOF
```

If you already have a `package.json`, add the scripts and devDependencies manually.

### Step 6: Create jest.config.js

```bash
cat > jest.config.js << 'EOF'
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/demo/'],
};
EOF
```

### Step 7: Create the contract loader

This is the bridge between your YAML contracts and Jest. It reads from `docs/contracts/`, not `templates/contracts/`.

```bash
cat > tests/helpers/contract-loader.js << 'LOADER'
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONTRACTS_DIR = path.join(__dirname, '..', '..', 'docs', 'contracts');

function yamlPatternToRegex(patternStr) {
  const trimmed = patternStr.trim();
  const match = trimmed.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (!match) {
    throw new Error(`Invalid regex pattern format: ${trimmed}`);
  }
  return new RegExp(match[1], match[2]);
}

function loadContract(filename) {
  const filepath = path.join(CONTRACTS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return yaml.load(content);
}

function extractRules(contract) {
  const rules = contract.rules?.non_negotiable || [];
  return rules.map((rule) => {
    const patterns = (rule.behavior?.forbidden_patterns || []).map((fp) => ({
      regex: yamlPatternToRegex(fp.pattern),
      message: fp.message,
      raw: fp.pattern,
    }));
    return {
      id: rule.id, title: rule.title, scope: rule.scope || [],
      patterns,
      example_violation: rule.behavior?.example_violation || '',
      example_compliant: rule.behavior?.example_compliant || '',
    };
  });
}

function loadContractRules(filename) {
  const contract = loadContract(filename);
  return {
    meta: contract.contract_meta,
    llm_policy: contract.llm_policy,
    rules: extractRules(contract),
    raw: contract,
  };
}

function listContractFiles() {
  return fs.readdirSync(CONTRACTS_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}

module.exports = {
  yamlPatternToRegex, loadContract, extractRules,
  loadContractRules, listContractFiles, CONTRACTS_DIR,
};
LOADER
```

**Important:** The Specflow repo's `contract-loader.js` points to `templates/contracts/`. Your project copy must point to `docs/contracts/`. The script above already has the correct path.

### Step 8: Create the contract schema test

```bash
cat > tests/contracts/contract-schema.test.js << 'TEST'
const { loadContract, listContractFiles, yamlPatternToRegex } = require('../helpers/contract-loader');
const CONTRACT_FILES = listContractFiles();

describe('Contract Schema Validation', () => {
  test('at least one contract exists', () => {
    expect(CONTRACT_FILES.length).toBeGreaterThan(0);
  });

  describe.each(CONTRACT_FILES)('%s', (filename) => {
    let contract;
    beforeAll(() => { contract = loadContract(filename); });

    test('parses as valid YAML', () => {
      expect(contract).toBeDefined();
    });

    test('has contract_meta.id', () => {
      expect(typeof contract.contract_meta.id).toBe('string');
    });

    test('has llm_policy.enforce', () => {
      expect(typeof contract.llm_policy.enforce).toBe('boolean');
    });

    test('has rules.non_negotiable', () => {
      expect(Array.isArray(contract.rules.non_negotiable)).toBe(true);
      expect(contract.rules.non_negotiable.length).toBeGreaterThan(0);
    });

    test('every forbidden_pattern compiles to valid RegExp', () => {
      for (const rule of contract.rules.non_negotiable) {
        for (const fp of rule.behavior.forbidden_patterns) {
          expect(() => yamlPatternToRegex(fp.pattern)).not.toThrow();
        }
      }
    });
  });
});
TEST
```

### Step 9: Create state files

```bash
# Regression baseline
echo '{"version":1,"last_updated":null,"last_wave":null,"last_commit":null,"tests":{}}' \
  > .specflow/baseline.json

# Scoped journey deferrals
cat > .claude/.defer-journal << 'EOF'
# Scoped journey deferrals -- each requires a tracking issue
# Format: J-ID: reason (#tracking-issue)
#
# Rules:
# - Only listed J-IDs are skipped by journey-gate
# - Every deferral MUST reference a tracking issue
# - Review and prune monthly
EOF

# .gitignore
cat > .gitignore << 'EOF'
node_modules/
.env
.env.local
.claude/.defer-tests
EOF
```

### Step 10: Initialize git

```bash
git init
cp /path/to/Specflow/hooks/commit-msg .git/hooks/commit-msg
chmod +x .git/hooks/commit-msg
```

The `commit-msg` hook rejects commits without issue numbers (`#123`).

### Step 11: Install Claude Code hooks

```bash
bash /path/to/Specflow/install-hooks.sh .
```

This installs:
- `.claude/settings.json` — wires PostToolUse hooks
- `.claude/hooks/post-build-check.sh` — triggers after build/commit
- `.claude/hooks/run-journey-tests.sh` — finds issues, maps to tests, runs them
- `.claude/hooks/post-push-ci.sh` — polls GitHub Actions after push
- `.claude/hooks/session-start.sh` — placeholder for session init

### Step 12: Create CLAUDE.md

Use the template:

```bash
cp /path/to/Specflow/CLAUDE-MD-TEMPLATE.md ./CLAUDE-MD-TEMPLATE-REF.md
```

Then tell Claude Code:

```
Use CLAUDE-MD-TEMPLATE-REF.md to create my CLAUDE.md.
My project is [name], repo is [org/repo], tech stack is [stack].
```

Or create it manually — the template has clear placeholders to fill in.

### Step 13: Install dependencies and verify

```bash
npm install

# Run contract tests
npm test

# Verify full setup (run from your project root)
bash /path/to/Specflow/verify-setup.sh
```

**Expected:** All tests pass. verify-setup shows 20+ passed, 0 failed.

---

## Path C: SKILL.md (Single File)

**Best for:** Quick adoption without the full agent library.

```bash
cp Specflow/SKILL.md your-project/
```

Then in Claude Code: `/specflow`

SKILL.md packages the core Specflow loop into a single portable file. No other Specflow files required.

For the full 30+ agent experience, use Path A or see [agents/README.md](../agents/README.md).

---

## Path D: One Prompt Setup

**Best for:** Teams using Claude Code who want Claude to figure out the details.

### Step 1: Add Specflow to your project

```bash
cp -r /path/to/Specflow/ your-project/Specflow/
# or
git clone https://github.com/Hulupeep/Specflow.git your-project/Specflow
```

### Step 2: Run the setup script

```bash
cd your-project
bash Specflow/setup-project.sh .
```

### Step 3: Tell Claude Code to handle the rest

```
Read docs/getting-started.md and set up my CLAUDE.md using the template
CLAUDE-MD-TEMPLATE.md in Specflow. Then make my issues compliant and
execute my backlog in waves.
```

**Note:** Claude may miss steps. If tests don't pass or verify-setup shows failures, re-run:

```bash
bash Specflow/setup-project.sh .
```

This fills in anything Claude missed.

---

## What Each Piece Does

| File/Directory | Purpose | Created by |
|---|---|---|
| `docs/contracts/*.yml` | YAML contracts with forbidden patterns | setup script / LLM |
| `tests/contracts/*.test.js` | Jest tests that validate contracts | setup script / LLM |
| `tests/helpers/contract-loader.js` | Reads YAML contracts, compiles regex | setup script |
| `scripts/agents/*.md` | Agent prompts for waves-controller | setup script |
| `scripts/specflow-compile.cjs` | Compiles CSV journeys to YAML + Playwright | setup script |
| `scripts/verify-graph.cjs` | Validates contract cross-references | setup script |
| `.claude/hooks/*.sh` | Auto-run tests after build/commit/push | install-hooks.sh |
| `.claude/settings.json` | Wires hooks to Claude Code events | install-hooks.sh |
| `.git/hooks/commit-msg` | Rejects commits without issue numbers | setup script |
| `.specflow/baseline.json` | Regression test baseline | setup script |
| `.claude/.defer-journal` | Scoped journey test deferrals | setup script |
| `package.json` | npm scripts for test/verify/compile | setup script |
| `jest.config.js` | Jest configuration | setup script |
| `CLAUDE.md` | Project rules, contract refs, agent config | manual / LLM |

---

## Verify Setup

After any path, run from your project root:

```bash
bash /path/to/Specflow/verify-setup.sh
```

**Passing setup shows:**
- 20+ checks passed
- 0 failed
- Warnings are optional recommendations (CI, specs directory, etc.)

**The litmus test:** If Claude modifies a file in `src/` without mentioning contracts, the `CLAUDE.md` is not being read.

---

## You're Done When

- Contract tests pass: `npm test`
- verify-setup.sh: 0 failures
- CLAUDE.md has project context and contract references
- Commits require issue numbers (try `git commit -m "test"` — should be rejected)
- Hooks run after builds (try `npm run build` — should trigger journey check)

---

## Updating an Existing Setup

Already have Specflow installed? Use the CLI or paste a prompt into Claude Code.

### Via npx (recommended)

```bash
npx @colmbyrne/specflow update . --ci   # Update hooks + CI workflows
npx @colmbyrne/specflow verify          # Check everything
```

### Via Claude Code prompt

**Update everything and verify:**

```
Run npx @colmbyrne/specflow update . --ci to update hooks and CI workflows.
Then run npx @colmbyrne/specflow verify and fix every failure.
I want 0 failures before we start any tickets.
```

**Check without changing anything:**

```
Run npx @colmbyrne/specflow verify and show me the full output.
Don't fix anything yet — I want to see what's missing first.
```

### Other CLI commands

```bash
npx @colmbyrne/specflow init .          # Full setup (safe to re-run)
npx @colmbyrne/specflow update . --ci   # Update hooks + CI workflows
npx @colmbyrne/specflow verify          # 13-section installation check
npx @colmbyrne/specflow audit 500       # Audit issue #500 for compliance
npx @colmbyrne/specflow graph           # Validate contract cross-references
```

**Notes:**
- `init` is safe to re-run — skips existing files, backs up settings before merging
- `--ci` installs GitHub Actions workflows (specflow-compliance.yml + specflow-audit.yml)
- All commands work with npx (no install needed) or after `npm install -g @colmbyrne/specflow`

---

> **Understand how it works deeper?** See [How It Works](how-it-works.md)
> **Using with a team?** See [Team Workflows](team-workflows.md)
> **Setting up CI?** See [CI Integration](../CI-INTEGRATION.md)
