#!/bin/bash
# Specflow Full Project Setup
# Creates a specflow-compliant project from scratch.
#
# Usage: bash Specflow/setup-project.sh /path/to/your/project
#
# What it does:
#   1. Creates directory structure
#   2. Copies agents, contracts, scripts, examples, hooks
#   3. Creates package.json, jest.config.js, test helpers
#   4. Creates contract schema tests
#   5. Initializes git (if needed) with commit-msg hook
#   6. Creates .specflow baseline and .defer-journal
#   7. Installs npm dependencies
#   8. Runs tests to verify
#   9. Runs verify-setup.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

TARGET_DIR="$1"

if [ -z "$TARGET_DIR" ]; then
  echo "Usage: bash setup-project.sh /path/to/your/project"
  exit 1
fi

mkdir -p "$TARGET_DIR"
TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Specflow Full Project Setup                    ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Source:${NC} $SCRIPT_DIR"
echo -e "${GREEN}Target:${NC} $TARGET_DIR"
echo ""

# ============================================================================
# 1. Directory structure
# ============================================================================

echo -e "${BLUE}[1/10]${NC} Creating directory structure..."

mkdir -p "$TARGET_DIR/docs/contracts"
mkdir -p "$TARGET_DIR/scripts/agents"
mkdir -p "$TARGET_DIR/tests/contracts"
mkdir -p "$TARGET_DIR/tests/helpers"
mkdir -p "$TARGET_DIR/tests/e2e"
mkdir -p "$TARGET_DIR/hooks"
mkdir -p "$TARGET_DIR/examples"
mkdir -p "$TARGET_DIR/.specflow"
mkdir -p "$TARGET_DIR/.claude"

echo -e "${GREEN}✓${NC} Created: docs/contracts, scripts/agents, tests/contracts,"
echo -e "  tests/helpers, tests/e2e, hooks, examples, .specflow, .claude"
echo ""

# ============================================================================
# 2. Copy agents
# ============================================================================

echo -e "${BLUE}[2/10]${NC} Copying agent library..."

AGENT_COUNT=0
for agent in "$SCRIPT_DIR/agents/"*.md; do
  if [ -f "$agent" ]; then
    cp "$agent" "$TARGET_DIR/scripts/agents/"
    AGENT_COUNT=$((AGENT_COUNT + 1))
  fi
done

echo -e "${GREEN}✓${NC} Copied $AGENT_COUNT agent files to scripts/agents/"
echo ""

# ============================================================================
# 3. Copy default contracts
# ============================================================================

echo -e "${BLUE}[3/10]${NC} Copying default contracts..."

CONTRACT_COUNT=0
for contract in "$SCRIPT_DIR/templates/contracts/"*.yml; do
  if [ -f "$contract" ]; then
    cp "$contract" "$TARGET_DIR/docs/contracts/"
    CONTRACT_COUNT=$((CONTRACT_COUNT + 1))
  fi
done

echo -e "${GREEN}✓${NC} Copied $CONTRACT_COUNT contract templates to docs/contracts/"
echo ""

# ============================================================================
# 4. Copy scripts and examples
# ============================================================================

echo -e "${BLUE}[4/10]${NC} Copying scripts and examples..."

# Scripts
for script in specflow-compile.cjs verify-graph.cjs; do
  if [ -f "$SCRIPT_DIR/scripts/$script" ]; then
    cp "$SCRIPT_DIR/scripts/$script" "$TARGET_DIR/scripts/"
    echo -e "${GREEN}✓${NC} scripts/$script"
  fi
done

# Examples
for example in "$SCRIPT_DIR/examples/"*; do
  if [ -f "$example" ]; then
    cp "$example" "$TARGET_DIR/examples/"
  fi
done
if [ -f "$SCRIPT_DIR/templates/journeys-template.csv" ]; then
  cp "$SCRIPT_DIR/templates/journeys-template.csv" "$TARGET_DIR/examples/"
fi

# Hook sources (for reference — .claude/hooks/ is installed separately)
for hook in "$SCRIPT_DIR/hooks/"*; do
  if [ -f "$hook" ]; then
    cp "$hook" "$TARGET_DIR/hooks/"
    chmod +x "$TARGET_DIR/hooks/"*.sh 2>/dev/null || true
  fi
done

echo -e "${GREEN}✓${NC} Copied scripts, examples, hook sources"
echo ""

# ============================================================================
# 5. Create package.json, jest.config.js
# ============================================================================

echo -e "${BLUE}[5/10]${NC} Creating package.json and jest config..."

PROJECT_NAME="$(basename "$TARGET_DIR")"

if [ ! -f "$TARGET_DIR/package.json" ]; then
  cat > "$TARGET_DIR/package.json" <<PKGJSON
{
  "name": "$PROJECT_NAME",
  "version": "1.0.0",
  "private": true,
  "description": "Specflow-compliant project",
  "scripts": {
    "test": "jest --no-coverage",
    "test:contracts": "jest tests/contracts/ --no-coverage",
    "test:e2e": "echo 'No E2E tests configured yet — add Playwright tests to tests/e2e/'",
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
PKGJSON
  echo -e "${GREEN}✓${NC} Created package.json"
else
  echo -e "${YELLOW}⚠️${NC}  package.json already exists — skipping (add scripts manually)"
fi

if [ ! -f "$TARGET_DIR/jest.config.js" ]; then
  cat > "$TARGET_DIR/jest.config.js" <<'JESTCFG'
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/', '/demo/'],
};
JESTCFG
  echo -e "${GREEN}✓${NC} Created jest.config.js"
else
  echo -e "${YELLOW}⚠️${NC}  jest.config.js already exists — skipping"
fi

echo ""

# ============================================================================
# 6. Create test helpers and contract schema test
# ============================================================================

echo -e "${BLUE}[6/10]${NC} Creating test infrastructure..."

# Contract loader — reads from docs/contracts/ (not templates/contracts/)
cat > "$TARGET_DIR/tests/helpers/contract-loader.js" <<'LOADER'
/**
 * Shared helper: parse YAML contracts → extract patterns → compile regex.
 */

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
      id: rule.id,
      title: rule.title,
      scope: rule.scope || [],
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
  yamlPatternToRegex,
  loadContract,
  extractRules,
  loadContractRules,
  listContractFiles,
  CONTRACTS_DIR,
};
LOADER

echo -e "${GREEN}✓${NC} Created tests/helpers/contract-loader.js (reads from docs/contracts/)"

# Contract schema test
cat > "$TARGET_DIR/tests/contracts/contract-schema.test.js" <<'SCHEMATEST'
/**
 * Schema validation tests for all contracts in docs/contracts/.
 * Verifies: valid YAML, required fields, regex compilability, structural integrity.
 */

const { loadContract, listContractFiles, yamlPatternToRegex } = require('../helpers/contract-loader');

const CONTRACT_FILES = listContractFiles();

describe('Contract Schema Validation', () => {
  test('at least one contract exists', () => {
    expect(CONTRACT_FILES.length).toBeGreaterThan(0);
  });

  describe.each(CONTRACT_FILES)('%s', (filename) => {
    let contract;

    beforeAll(() => {
      contract = loadContract(filename);
    });

    test('parses as valid YAML', () => {
      expect(contract).toBeDefined();
      expect(typeof contract).toBe('object');
    });

    test('has contract_meta.id', () => {
      expect(contract.contract_meta).toBeDefined();
      expect(typeof contract.contract_meta.id).toBe('string');
      expect(contract.contract_meta.id.length).toBeGreaterThan(0);
    });

    test('has contract_meta.version', () => {
      expect(contract.contract_meta.version).toBeDefined();
    });

    test('has contract_meta.covers_reqs as non-empty array', () => {
      expect(Array.isArray(contract.contract_meta.covers_reqs)).toBe(true);
      expect(contract.contract_meta.covers_reqs.length).toBeGreaterThan(0);
    });

    test('has contract_meta.owner', () => {
      expect(typeof contract.contract_meta.owner).toBe('string');
    });

    test('has llm_policy.enforce', () => {
      expect(contract.llm_policy).toBeDefined();
      expect(typeof contract.llm_policy.enforce).toBe('boolean');
    });

    test('has llm_policy.override_phrase', () => {
      expect(typeof contract.llm_policy.override_phrase).toBe('string');
      expect(contract.llm_policy.override_phrase).toContain('override_contract:');
    });

    test('has rules.non_negotiable as non-empty array', () => {
      expect(contract.rules).toBeDefined();
      expect(Array.isArray(contract.rules.non_negotiable)).toBe(true);
      expect(contract.rules.non_negotiable.length).toBeGreaterThan(0);
    });

    test('every rule has id and title', () => {
      for (const rule of contract.rules.non_negotiable) {
        expect(typeof rule.id).toBe('string');
        expect(typeof rule.title).toBe('string');
      }
    });

    test('every forbidden_pattern compiles to valid RegExp', () => {
      for (const rule of contract.rules.non_negotiable) {
        for (const fp of rule.behavior.forbidden_patterns) {
          expect(() => yamlPatternToRegex(fp.pattern)).not.toThrow();
        }
      }
    });

    test('every forbidden_pattern has a non-empty message', () => {
      for (const rule of contract.rules.non_negotiable) {
        for (const fp of rule.behavior.forbidden_patterns) {
          expect(typeof fp.message).toBe('string');
          expect(fp.message.length).toBeGreaterThan(0);
        }
      }
    });

    test('every rule has example_violation and example_compliant', () => {
      for (const rule of contract.rules.non_negotiable) {
        expect(rule.behavior.example_violation.trim().length).toBeGreaterThan(0);
        expect(rule.behavior.example_compliant.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
SCHEMATEST

echo -e "${GREEN}✓${NC} Created tests/contracts/contract-schema.test.js"
echo ""

# ============================================================================
# 7. Create .specflow baseline and .defer-journal
# ============================================================================

echo -e "${BLUE}[7/10]${NC} Creating specflow state files..."

if [ ! -f "$TARGET_DIR/.specflow/baseline.json" ]; then
  echo '{"version":1,"last_updated":null,"last_wave":null,"last_commit":null,"tests":{}}' \
    > "$TARGET_DIR/.specflow/baseline.json"
  echo -e "${GREEN}✓${NC} Created .specflow/baseline.json"
fi

if [ ! -f "$TARGET_DIR/.claude/.defer-journal" ]; then
  cat > "$TARGET_DIR/.claude/.defer-journal" <<'DEFER'
# Scoped journey deferrals -- each requires a tracking issue
# Format: J-ID: reason (#tracking-issue)
#
# Rules:
# - Only listed J-IDs are skipped by journey-gate
# - Every deferral MUST reference a tracking issue
# - Review and prune monthly
# - .defer-tests is IGNORED (deprecated)
DEFER
  echo -e "${GREEN}✓${NC} Created .claude/.defer-journal"
fi

# Create .gitignore if missing
if [ ! -f "$TARGET_DIR/.gitignore" ]; then
  cat > "$TARGET_DIR/.gitignore" <<'GITIGNORE'
node_modules/
.env
.env.local
.claude/.defer-tests
GITIGNORE
  echo -e "${GREEN}✓${NC} Created .gitignore"
fi

echo ""

# ============================================================================
# 8. Initialize git and install commit-msg hook
# ============================================================================

echo -e "${BLUE}[8/10]${NC} Setting up git..."

if [ ! -d "$TARGET_DIR/.git" ]; then
  (cd "$TARGET_DIR" && git init)
  echo -e "${GREEN}✓${NC} Initialized git repository"
fi

if [ -f "$SCRIPT_DIR/hooks/commit-msg" ]; then
  mkdir -p "$TARGET_DIR/.git/hooks"
  cp "$SCRIPT_DIR/hooks/commit-msg" "$TARGET_DIR/.git/hooks/commit-msg"
  chmod +x "$TARGET_DIR/.git/hooks/commit-msg"
  echo -e "${GREEN}✓${NC} Installed .git/hooks/commit-msg"
fi

echo ""

# ============================================================================
# 9. Install Claude Code hooks
# ============================================================================

echo -e "${BLUE}[9/10]${NC} Installing Claude Code hooks..."

bash "$SCRIPT_DIR/install-hooks.sh" "$TARGET_DIR" 2>&1 | grep -E '(✓|⚠️|✗|Installed|Created)' || true

echo ""

# ============================================================================
# 10. Install dependencies, run tests, verify setup
# ============================================================================

echo -e "${BLUE}[10/10]${NC} Installing dependencies and verifying..."

(cd "$TARGET_DIR" && npm install --quiet) || { echo -e "${RED}npm install failed${NC}"; exit 1; }
echo ""

echo -e "${BLUE}Running contract tests...${NC}"
(cd "$TARGET_DIR" && npm test 2>&1) || {
  echo -e "${RED}✗ Tests failed. Check output above.${NC}"
  exit 1
}

echo ""
echo -e "${BLUE}Running verify-setup...${NC}"
(cd "$TARGET_DIR" && bash "$SCRIPT_DIR/verify-setup.sh")
VERIFY_EXIT=$?
if [ "$VERIFY_EXIT" -ne 0 ]; then
  echo -e "${RED}verify-setup reported failures${NC}"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║              Setup Complete                              ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Project:${NC} $TARGET_DIR"
echo ""
echo "  docs/contracts/          $CONTRACT_COUNT default contracts"
echo "  scripts/agents/          $AGENT_COUNT agents"
echo "  tests/contracts/         Contract schema tests"
echo "  tests/helpers/           Contract loader (reads docs/contracts/)"
echo "  .claude/hooks/           Journey verification hooks"
echo "  .git/hooks/commit-msg    Issue number enforcement"
echo "  .specflow/baseline.json  Regression baseline"
echo ""
echo -e "${YELLOW}Remaining manual steps:${NC}"
echo ""
echo "  1. Update CLAUDE.md with your project context:"
echo "     - Repository, board, tech stack, project description"
echo ""
echo "  2. Create your first contract:"
echo "     Tell Claude: \"Create a specflow contract for [your feature]\""
echo ""
echo "  3. Create specflow-compliant issues:"
echo "     Tell Claude: \"Create specflow-compliant issues for [feature]\""
echo ""
echo "  4. Execute your backlog:"
echo "     Tell Claude: \"Execute waves\""
echo ""
