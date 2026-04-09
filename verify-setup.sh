#!/bin/bash
#
# Specflow Infrastructure Verification Script
#
# This script verifies that Specflow contract infrastructure
# has been set up correctly in your project.
#
# Usage:
#   ./verify-setup.sh
#
# Run this from your project root after setting up Specflow.
#
# Exit codes:
#   0 - All checks passed (or only warnings)
#   1 - Critical checks failed

echo "🔍 Specflow Infrastructure Verification"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

PASS=0
FAIL=0
WARN=0

check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARN++))
}

check_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

echo "1. Directory Structure"
echo "----------------------"

# Check for contracts directory (flexible locations)
if [ -d "docs/contracts" ]; then
    check_pass "docs/contracts/ exists"
    CONTRACT_DIR="docs/contracts"
elif [ -d "contracts" ]; then
    check_pass "contracts/ exists"
    CONTRACT_DIR="contracts"
elif [ -d "docs" ] && (ls docs/*.yml 2>/dev/null || ls docs/*.yaml 2>/dev/null) >/dev/null; then
    check_pass "docs/ contains contract files"
    CONTRACT_DIR="docs"
else
    check_fail "No contracts directory found (expected: docs/contracts/, contracts/, or docs/)"
    CONTRACT_DIR=""
fi

# Check for specs directory (optional but recommended)
if [ -d "docs/specs" ]; then
    check_pass "docs/specs/ exists"
elif [ -d "specs" ]; then
    check_pass "specs/ exists (alternate location)"
else
    check_warn "No specs directory found (recommended: docs/specs/)"
fi

# Check for contract tests directory (flexible locations)
TEST_DIR=""
if [ -d "src/__tests__/contracts" ]; then
    check_pass "src/__tests__/contracts/ exists"
    TEST_DIR="src/__tests__/contracts"
elif [ -d "__tests__/contracts" ]; then
    check_pass "__tests__/contracts/ exists"
    TEST_DIR="__tests__/contracts"
elif [ -d "tests/contracts" ]; then
    check_pass "tests/contracts/ exists"
    TEST_DIR="tests/contracts"
elif [ -d "src/__tests__" ] && ls src/__tests__/*contract* >/dev/null 2>&1; then
    check_pass "src/__tests__/ contains contract tests"
    TEST_DIR="src/__tests__"
elif [ -d "__tests__" ] && ls __tests__/*contract* >/dev/null 2>&1; then
    check_pass "__tests__/ contains contract tests"
    TEST_DIR="__tests__"
else
    check_warn "No contract tests directory found"
fi

echo ""
echo "2. Contract Files"
echo "-----------------"

# Count contract files (CONTRACT_DIR set in section 1)
CONTRACT_COUNT=0

if [ -n "$CONTRACT_DIR" ]; then
    # Only count files matching contract naming conventions (feature_*, journey_*, *_defaults, CONTRACT_INDEX)
    CONTRACT_COUNT=$(find "$CONTRACT_DIR" -maxdepth 1 \( -name "feature_*.yml" -o -name "feature_*.yaml" -o -name "journey_*.yml" -o -name "journey_*.yaml" -o -name "*_defaults.yml" -o -name "*_defaults.yaml" -o -name "CONTRACT_INDEX.yml" -o -name "CONTRACT_INDEX.yaml" \) 2>/dev/null | wc -l)

    if [ "$CONTRACT_COUNT" -gt 0 ]; then
        check_pass "Found $CONTRACT_COUNT contract file(s) in $CONTRACT_DIR/"

        # List contracts
        echo ""
        check_info "Contracts found:"
        for contract in "$CONTRACT_DIR"/*.yml "$CONTRACT_DIR"/*.yaml; do
            if [ -f "$contract" ]; then
                echo "     - $(basename "$contract")"
            fi
        done
        echo ""
    else
        check_warn "No contract files found yet (create your first .yml contract)"
    fi
fi

# Check for CONTRACT_INDEX.yml
if [ -f "$CONTRACT_DIR/CONTRACT_INDEX.yml" ] || [ -f "$CONTRACT_DIR/CONTRACT_INDEX.yaml" ]; then
    check_pass "CONTRACT_INDEX.yml exists"
else
    check_warn "No CONTRACT_INDEX.yml (recommended for organizing contracts)"
fi

echo ""
echo "3. Contract YAML Validation"
echo "---------------------------"

if [ "$CONTRACT_COUNT" -gt 0 ]; then
    # Try to validate YAML syntax
    if command -v python3 &> /dev/null; then
        VALID=0
        INVALID=0

        for contract in "$CONTRACT_DIR"/*.yml "$CONTRACT_DIR"/*.yaml; do
            if [ -f "$contract" ]; then
                if python3 -c "import yaml; yaml.safe_load(open('$contract'))" 2>/dev/null; then
                    ((VALID++))
                else
                    check_fail "$(basename "$contract") has invalid YAML syntax"
                    ((INVALID++))
                fi
            fi
        done

        if [ "$INVALID" -eq 0 ]; then
            check_pass "All $VALID contract(s) have valid YAML syntax"
        fi
    elif command -v node &> /dev/null; then
        # Try with Node.js js-yaml if available
        if node -e "require('js-yaml')" 2>/dev/null; then
            check_info "Using Node.js js-yaml for validation"
        else
            check_warn "Install js-yaml for YAML validation: npm install js-yaml"
        fi
    else
        check_warn "No YAML validator available (install Python3 or js-yaml)"
    fi
else
    check_info "No contracts to validate yet"
fi

echo ""
echo "4. Test Infrastructure"
echo "----------------------"

# Check for package.json
if [ -f "package.json" ]; then
    check_pass "package.json exists"

    # Check for test script
    if grep -q '"test"' package.json; then
        check_pass "npm test script configured"
    else
        check_warn "No test script in package.json"
    fi

    # Check for test:contracts script
    if grep -q '"test:contracts"' package.json; then
        check_pass "npm run test:contracts script configured"
    else
        check_warn "No test:contracts script (recommended for running contract tests separately)"
    fi

    # Check for testing framework
    if grep -q '"jest"' package.json || grep -q '"vitest"' package.json; then
        check_pass "Test framework detected (Jest or Vitest)"
    elif grep -q '"@playwright/test"' package.json; then
        check_pass "Playwright test framework detected"
    else
        check_warn "No recognized test framework in dependencies"
    fi
else
    check_warn "No package.json found"
fi

echo ""
echo "5. CLAUDE.md Configuration"
echo "--------------------------"

if [ -f "CLAUDE.md" ]; then
    check_pass "CLAUDE.md exists"

    echo ""
    echo "  CRITICAL (system breaks without these):"

    # Project Context — agents use gh against this repo
    if grep -q '^\*\*Repository:\*\*' CLAUDE.md 2>/dev/null && ! grep -q '\[org/repo-name\]' CLAUDE.md 2>/dev/null; then
        DECLARED_REPO=$(grep '^\*\*Repository:\*\*' CLAUDE.md 2>/dev/null | sed 's/.*\*\*Repository:\*\*[[:space:]]*//' | tr -d '*' | xargs)
        GIT_REMOTE=$(git config --get remote.origin.url 2>/dev/null | sed 's|.*github.com[:/]||; s|\.git$||')
        if [ -n "$GIT_REMOTE" ] && [ -n "$DECLARED_REPO" ] && echo "$GIT_REMOTE" | grep -qi "$DECLARED_REPO"; then
            check_pass "Repository: $DECLARED_REPO (matches git remote)"
        elif [ -n "$GIT_REMOTE" ] && [ -n "$DECLARED_REPO" ]; then
            check_warn "Repository: $DECLARED_REPO — does not match git remote ($GIT_REMOTE)"
        else
            check_pass "Repository filled in: $DECLARED_REPO"
        fi
    elif grep -q '\[org/repo-name\]' CLAUDE.md 2>/dev/null; then
        check_fail "Repository is placeholder [org/repo-name] — agents can't find your issues"
    else
        check_fail "Repository missing — agents can't run gh commands against your repo"
    fi

    if grep -q '^\*\*Project Board:\*\*' CLAUDE.md 2>/dev/null && ! grep -q '\[GitHub Issues | Jira' CLAUDE.md 2>/dev/null; then
        check_pass "Project Board filled in"
    else
        check_fail "Project Board missing or placeholder — agents don't know where issues are tracked"
    fi

    if grep -q '^\*\*Board CLI:\*\*' CLAUDE.md 2>/dev/null && ! grep -q '\[gh | jira' CLAUDE.md 2>/dev/null; then
        # C1: Also check if the declared CLI is actually installed
        DECLARED_CLI=$(grep '^\*\*Board CLI:\*\*' CLAUDE.md 2>/dev/null | sed 's/.*\*\*Board CLI:\*\*[[:space:]]*//' | awk '{print $1}' | tr -d '*')
        if [ -n "$DECLARED_CLI" ] && command -v "$DECLARED_CLI" &> /dev/null; then
            check_pass "Board CLI: $DECLARED_CLI (installed)"
        elif [ -n "$DECLARED_CLI" ]; then
            check_fail "Board CLI: $DECLARED_CLI is declared but NOT INSTALLED — hooks will crash when fetching issues"
        else
            check_pass "Board CLI filled in"
        fi
    else
        check_fail "Board CLI missing or placeholder — all issue automation broken"
    fi

    # Rule 2: commits must reference issue — journey tests depend on this
    if grep -q "NEVER run.*git commit" CLAUDE.md 2>/dev/null || grep -q "Commits Must Reference" CLAUDE.md 2>/dev/null; then
        check_pass "Rule: commits must reference issue"
    else
        check_fail "Missing commit rule — Claude will commit without #issue, journey tests silently skip"
    fi

    # Rule 3: contracts non-negotiable — Claude must check docs/contracts/ before edits
    if grep -q "docs/contracts/" CLAUDE.md 2>/dev/null && grep -qi "non-negotiable\|must pass\|contract" CLAUDE.md 2>/dev/null; then
        check_pass "Rule: contracts are non-negotiable"
    else
        check_fail "Missing contract enforcement rule — Claude won't check docs/contracts/ before editing files"
    fi

    # Rule 5: YAML not markdown — prevents contracts written as .md
    if grep -qi "Contracts Are YAML\|NEVER write contract content" CLAUDE.md 2>/dev/null; then
        check_pass "Rule: contracts are YAML not markdown"
    else
        check_fail "Missing YAML rule — Claude may write contracts into .md files instead of docs/contracts/*.yml"
    fi

    echo ""
    echo "  HIGH (enforcement has gaps):"

    # Tech Stack
    if grep -q '^\*\*Tech Stack:\*\*' CLAUDE.md 2>/dev/null && ! grep -q '\[e.g.,' CLAUDE.md 2>/dev/null; then
        check_pass "Tech Stack filled in"
    else
        check_warn "Tech Stack missing or placeholder — Claude may generate wrong framework code"
    fi

    # Contract Locations table
    if grep -q "Contract Locations" CLAUDE.md 2>/dev/null; then
        check_pass "Contract Locations table present"
    else
        check_warn "Missing Contract Locations — Claude doesn't know where to find or create contracts"
    fi

    # Active Contracts table (not just the placeholder)
    if grep -q "Active Contracts" CLAUDE.md 2>/dev/null; then
        if grep -q "No contracts defined yet" CLAUDE.md 2>/dev/null; then
            check_warn "Active Contracts table is empty — Claude doesn't know what's enforced"
        else
            check_pass "Active Contracts table has entries"
        fi
    else
        check_warn "Missing Active Contracts table — contracts exist on disk but Claude may ignore them"
    fi

    # Specflow Rules section header
    if grep -q "Specflow Rules" CLAUDE.md 2>/dev/null; then
        check_pass "Specflow Rules section present"
    else
        check_fail "Missing Specflow Rules section — run: npx @colmbyrne/specflow init ."
    fi

    echo ""
    echo "  MEDIUM:"

    # Override Protocol
    if grep -q "override_contract:" CLAUDE.md 2>/dev/null; then
        check_pass "Override protocol documented"
    else
        check_warn "Missing override protocol — Claude may override contracts without explicit human approval"
    fi
else
    check_fail "No CLAUDE.md found — Claude has no Specflow context. Run: npx @colmbyrne/specflow init ."
fi

echo ""
echo "6. CI/CD Integration"
echo "--------------------"

CI_FOUND=false

# GitHub Actions
if [ -d ".github/workflows" ]; then
    WORKFLOW_COUNT=$(find .github/workflows -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)
    if [ "$WORKFLOW_COUNT" -gt 0 ]; then
        if grep -rq "npm test\|npm run test" .github/workflows/ 2>/dev/null; then
            check_pass "GitHub Actions runs tests ($WORKFLOW_COUNT workflow(s))"
            CI_FOUND=true
        else
            check_warn "GitHub Actions exists but may not run tests"
        fi
    fi
fi

# GitLab CI
if [ -f ".gitlab-ci.yml" ]; then
    if grep -q "npm test\|npm run test" .gitlab-ci.yml; then
        check_pass "GitLab CI runs tests"
        CI_FOUND=true
    else
        check_warn "GitLab CI exists but may not run tests"
    fi
fi

# Azure Pipelines
if [ -f "azure-pipelines.yml" ]; then
    if grep -q "npm test\|npm run test" azure-pipelines.yml; then
        check_pass "Azure Pipelines runs tests"
        CI_FOUND=true
    fi
fi

# CircleCI
if [ -f ".circleci/config.yml" ]; then
    if grep -q "npm test\|npm run test" .circleci/config.yml; then
        check_pass "CircleCI runs tests"
        CI_FOUND=true
    fi
fi

if [ "$CI_FOUND" = false ]; then
    check_warn "No CI configuration detected (recommended for enforcing contracts)"
fi

# Check specifically for Specflow CI workflows
if [ -d ".github/workflows" ]; then
    if [ -f ".github/workflows/specflow-compliance.yml" ]; then
        check_pass "specflow-compliance.yml workflow installed (PR gate)"
    else
        check_warn "specflow-compliance.yml not found (install with: npx @colmbyrne/specflow update . --ci)"
    fi
    if [ -f ".github/workflows/specflow-audit.yml" ]; then
        check_pass "specflow-audit.yml workflow installed (post-merge audit)"
    else
        check_warn "specflow-audit.yml not found (install with: npx @colmbyrne/specflow update . --ci)"
    fi
fi

echo ""
echo "7. E2E Test Setup (Optional)"
echo "----------------------------"

# Check for Playwright
if [ -f "playwright.config.ts" ] || [ -f "playwright.config.js" ]; then
    check_pass "Playwright configured"

    if [ -d "tests/e2e" ]; then
        E2E_COUNT=$(find tests/e2e -name "*.spec.ts" -o -name "*.spec.js" 2>/dev/null | wc -l)
        check_pass "Found $E2E_COUNT E2E test file(s)"
    elif [ -d "e2e" ]; then
        E2E_COUNT=$(find e2e -name "*.spec.ts" -o -name "*.spec.js" 2>/dev/null | wc -l)
        check_pass "Found $E2E_COUNT E2E test file(s)"
    else
        check_warn "No E2E tests directory found"
    fi
else
    check_info "No Playwright config (E2E testing is optional)"
fi

echo ""
echo "8. Hook Installation"
echo "---------------------"

# Check for .claude/hooks/ directory
if [ -d ".claude/hooks" ]; then
    check_pass ".claude/hooks/ directory exists"

    # Check for expected hook scripts (file presence + executable bit)
    HOOK_SCRIPTS=("post-build-check.sh" "run-journey-tests.sh" "post-push-ci.sh" "session-start.sh" "check-pipeline-compliance.sh")
    HOOKS_FOUND=0

    for hook in "${HOOK_SCRIPTS[@]}"; do
        if [ -x ".claude/hooks/$hook" ]; then
            check_pass "Hook script $hook installed and executable"
            ((HOOKS_FOUND++))
        elif [ -f ".claude/hooks/$hook" ]; then
            check_fail "Hook script $hook exists but is not executable (run: chmod +x .claude/hooks/$hook)"
        else
            check_warn "Hook script $hook not found"
        fi
    done

    if [ "$HOOKS_FOUND" -eq "${#HOOK_SCRIPTS[@]}" ]; then
        check_info "All ${#HOOK_SCRIPTS[@]} hook scripts installed"
    fi
else
    check_warn ".claude/hooks/ directory not found (run: npx @colmbyrne/specflow update .)"
fi

# Check for git commit-msg hook (enforces issue numbers)
if [ -d ".git/hooks" ]; then
    if [ -x ".git/hooks/commit-msg" ]; then
        if grep -qF '#[0-9]' .git/hooks/commit-msg 2>/dev/null; then
            check_pass ".git/hooks/commit-msg enforces issue numbers"
        else
            check_warn ".git/hooks/commit-msg exists but may not enforce issue numbers"
        fi
    else
        check_warn ".git/hooks/commit-msg not found (commits without issue numbers won't be blocked)"
    fi

    # Check for pre-push branch freshness hook
    if [ -x ".git/hooks/pre-push" ]; then
        if grep -qF 'origin/main' .git/hooks/pre-push 2>/dev/null; then
            check_pass ".git/hooks/pre-push blocks stale-base pushes"
        else
            check_warn ".git/hooks/pre-push exists but may not check branch freshness"
        fi
    else
        check_warn ".git/hooks/pre-push not found (stale branches can be pushed silently)"
    fi
fi

# Check for .claude/settings.json
if [ -f ".claude/settings.json" ]; then
    check_pass ".claude/settings.json exists"

    # Check that PostToolUse hooks are actually registered (not just the word "hook" present)
    if command -v jq &> /dev/null; then
        REGISTERED_HOOKS=$(jq -r '.hooks.PostToolUse[]?.hooks[]?.command // empty' .claude/settings.json 2>/dev/null)

        if [ -z "$REGISTERED_HOOKS" ]; then
            check_warn "settings.json has no PostToolUse hook commands registered"
        else
            # Check each required hook is actually wired up
            for required in "post-build-check.sh" "post-push-ci.sh"; do
                if echo "$REGISTERED_HOOKS" | grep -q "$required"; then
                    check_pass "settings.json wires up $required"
                else
                    check_fail "settings.json does NOT register $required in PostToolUse"
                fi
            done

            # run-journey-tests.sh is invoked by post-build-check.sh, not directly — inform rather than fail
            if echo "$REGISTERED_HOOKS" | grep -q "run-journey-tests.sh"; then
                check_pass "settings.json wires up run-journey-tests.sh directly"
            else
                check_info "run-journey-tests.sh is called by post-build-check.sh (not registered directly — this is normal)"
            fi
        fi
    else
        # Fallback without jq: check for PostToolUse key at minimum
        if grep -q "PostToolUse" .claude/settings.json 2>/dev/null; then
            check_pass "settings.json contains PostToolUse hook configuration"
            check_warn "Install jq for deeper settings.json verification: apt install jq / brew install jq"
        else
            check_warn "settings.json exists but PostToolUse hooks may not be configured"
        fi
    fi
else
    check_warn ".claude/settings.json not found (hooks may not be configured)"
fi

echo ""
echo "9. Agent Library"
echo "-----------------"

# Check for agents directory (scripts/agents/ in target projects, agents/ in Specflow repo)
AGENT_DIR=""
if [ -d "scripts/agents" ]; then
    AGENT_DIR="scripts/agents"
    check_pass "scripts/agents/ directory exists"
elif [ -d "agents" ]; then
    AGENT_DIR="agents"
    check_pass "agents/ directory exists (Specflow repo layout)"
else
    check_warn "No agent library found (expected: scripts/agents/)"
    check_info "Copy agents with: cp -r Specflow/agents/ scripts/agents/"
fi

if [ -n "$AGENT_DIR" ]; then
    # Count agent .md files
    AGENT_COUNT=$(find "$AGENT_DIR" -maxdepth 1 -name "*.md" 2>/dev/null | wc -l)

    if [ "$AGENT_COUNT" -gt 0 ]; then
        check_pass "Found $AGENT_COUNT agent file(s) in $AGENT_DIR/"
    else
        check_warn "No agent markdown files found in $AGENT_DIR/"
    fi

    # Check for waves-controller.md (the key orchestrator agent)
    if [ -f "$AGENT_DIR/waves-controller.md" ]; then
        check_pass "waves-controller.md found (master orchestrator)"
    else
        check_warn "waves-controller.md not found (key agent for wave execution)"
    fi
fi

# Check for SKILL.md as a quick-start alternative
if [ -f "SKILL.md" ]; then
    check_pass "SKILL.md exists (quick-start agent alternative)"
else
    check_info "No SKILL.md found (optional quick-start alternative to agent library)"
fi

echo ""
echo "10. Fix Pattern Store & Model Config"
echo "-------------------------------------"

# Check for .specflow/ directory
if [ -d ".specflow" ]; then
    check_pass ".specflow/ directory exists"
else
    check_info ".specflow/ directory not found (optional, created by post-mortem learning)"
fi

# Check for fix-patterns.json
if [ -f ".specflow/fix-patterns.json" ]; then
    check_pass ".specflow/fix-patterns.json exists (post-mortem learning active)"

    # Try to count patterns
    if command -v python3 &> /dev/null; then
        PATTERN_COUNT=$(python3 -c "import json; data=json.load(open('.specflow/fix-patterns.json')); print(len(data.get('patterns', data)) if isinstance(data, dict) else len(data))" 2>/dev/null)
        if [ -n "$PATTERN_COUNT" ]; then
            check_info "Fix pattern store contains $PATTERN_COUNT pattern(s)"
        fi
    fi
else
    check_info ".specflow/fix-patterns.json not found (optional, auto-created by CI feedback loop)"
fi

# Check for model routing config
if [ -f ".specflow/config.json" ]; then
    check_pass ".specflow/config.json exists"

    if grep -qi "model_routing" .specflow/config.json 2>/dev/null; then
        check_pass "config.json contains model_routing configuration"
    else
        check_info "config.json exists but no model_routing section found"
    fi
else
    check_info ".specflow/config.json not found (optional, for model routing)"
fi

# Check for default contract templates
DEFAULT_CONTRACTS=("security_defaults.yml" "accessibility_defaults.yml")
DEFAULTS_FOUND=0

if [ -n "$CONTRACT_DIR" ]; then
    for tmpl in "${DEFAULT_CONTRACTS[@]}"; do
        if [ -f "$CONTRACT_DIR/$tmpl" ]; then
            ((DEFAULTS_FOUND++))
        fi
    done

    if [ "$DEFAULTS_FOUND" -gt 0 ]; then
        check_pass "Found $DEFAULTS_FOUND default contract template(s) in $CONTRACT_DIR/"
    else
        check_info "No default contract templates found (optional: copy from templates/contracts/)"
    fi
else
    check_info "No contracts directory to check for default templates"
fi

echo ""
echo "11. Contract Metadata Integrity"
echo "--------------------------------"

if [ -n "$CONTRACT_DIR" ] && [ "$CONTRACT_COUNT" -gt 0 ]; then
    BROKEN_REFS=0
    CHECKED_REFS=0

    for contract in "$CONTRACT_DIR"/*.yml "$CONTRACT_DIR"/*.yaml; do
        [ -f "$contract" ] || continue
        # Extract e2e_test_file from test_hooks section
        TEST_REF=$(grep -A1 'test_hooks' "$contract" 2>/dev/null | grep 'e2e_test_file' | sed 's/.*e2e_test_file:[[:space:]]*//' | tr -d '"' | tr -d "'" | xargs)
        if [ -n "$TEST_REF" ]; then
            ((CHECKED_REFS++))
            if [ -f "$TEST_REF" ]; then
                check_pass "$(basename "$contract") → $TEST_REF exists"
            else
                check_fail "$(basename "$contract") → $TEST_REF NOT FOUND"
                ((BROKEN_REFS++))
            fi
        fi
    done

    if [ "$CHECKED_REFS" -eq 0 ]; then
        check_info "No contracts define test_hooks.e2e_test_file (optional)"
    elif [ "$BROKEN_REFS" -eq 0 ]; then
        check_pass "All $CHECKED_REFS contract test references resolve to real files"
    fi
else
    check_info "No contracts to validate metadata for"
fi

echo ""
echo "12. Graph Validator"
echo "--------------------"

# Check if verify-graph.cjs is available (either locally or in Specflow source)
GRAPH_SCRIPT=""
if [ -f "scripts/verify-graph.cjs" ]; then
    GRAPH_SCRIPT="scripts/verify-graph.cjs"
elif [ -f "node_modules/.bin/specflow-verify-graph" ]; then
    GRAPH_SCRIPT="node_modules/.bin/specflow-verify-graph"
fi

# Also check Specflow source location
SPECFLOW_GRAPH=""
SCRIPT_SELF_DIR="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"
if [ -f "$SCRIPT_SELF_DIR/scripts/verify-graph.cjs" ]; then
    SPECFLOW_GRAPH="$SCRIPT_SELF_DIR/scripts/verify-graph.cjs"
fi

if [ -n "$GRAPH_SCRIPT" ] && command -v node &> /dev/null && [ -n "$CONTRACT_DIR" ]; then
    check_pass "Graph validator found: $GRAPH_SCRIPT"
    GRAPH_OUTPUT=$(node "$GRAPH_SCRIPT" "$CONTRACT_DIR" 2>&1)
    GRAPH_EXIT=$?
    if [ "$GRAPH_EXIT" -eq 0 ]; then
        check_pass "Graph validation passed"
    else
        check_fail "Graph validation failed — run: node $GRAPH_SCRIPT $CONTRACT_DIR"
    fi
elif [ -n "$SPECFLOW_GRAPH" ] && command -v node &> /dev/null && [ -n "$CONTRACT_DIR" ]; then
    check_info "Graph validator available at $SPECFLOW_GRAPH"
    check_info "Copy to your project: cp $SPECFLOW_GRAPH scripts/"
else
    check_info "Graph validator not found (optional: copy scripts/verify-graph.cjs from Specflow)"
fi

echo ""
echo "13. Version Check (local vs Specflow source)"
echo "----------------------------------------------"

# Determine Specflow source directory (where this script lives)
SPECFLOW_SRC="$(cd "$(dirname "$0")" 2>/dev/null && pwd)"

if [ "$SPECFLOW_SRC" = "$(pwd)" ]; then
    check_info "Running inside the Specflow repo itself — version check not applicable"
else
    OUTDATED=0
    MISSING_LOCAL=0

    # Each entry: file|source_path|severity|impact
    VERSION_CHECKS=(
        "post-build-check.sh|$SPECFLOW_SRC/hooks/post-build-check.sh|CRITICAL|Journey tests never trigger after builds/commits — violations ship undetected"
        "run-journey-tests.sh|$SPECFLOW_SRC/hooks/run-journey-tests.sh|CRITICAL|Issue-to-test mapping broken — no targeted Playwright runs, old version uses broken heuristic naming"
        "check-pipeline-compliance.sh|$SPECFLOW_SRC/hooks/check-pipeline-compliance.sh|HIGH|Contract violations not caught on Write/Edit — Claude can break contracts without warning"
        "post-push-ci.sh|$SPECFLOW_SRC/templates/hooks/post-push-ci.sh|MEDIUM|No CI feedback after push — you check GitHub Actions manually"
        "session-start.sh|$SPECFLOW_SRC/hooks/session-start.sh|LOW|No session init — placeholder with no current function"
    )

    echo ""
    printf "  %-32s %-10s %-10s %s\n" "FILE" "STATUS" "SEVERITY" "IF MISSING/OUTDATED..."
    printf "  %-32s %-10s %-10s %s\n" "----" "------" "--------" "-----------------------"

    for entry in "${VERSION_CHECKS[@]}"; do
        IFS='|' read -r fname src_path severity impact <<< "$entry"

        if [ -f ".claude/hooks/$fname" ] && [ -f "$src_path" ]; then
            if diff -q ".claude/hooks/$fname" "$src_path" > /dev/null 2>&1; then
                printf "  ${GREEN}%-32s %-10s %-10s %s${NC}\n" "$fname" "✅ current" "$severity" ""
            else
                printf "  ${RED}%-32s %-10s %-10s %s${NC}\n" "$fname" "⚠ OUTDATED" "$severity" "$impact"
                ((OUTDATED++))
            fi
        elif [ -f "$src_path" ]; then
            printf "  ${RED}%-32s %-10s %-10s %s${NC}\n" "$fname" "❌ MISSING" "$severity" "$impact"
            ((MISSING_LOCAL++))
        fi
    done

    # Git hooks (different install path)
    GIT_HOOK_CHECKS=(
        "commit-msg|HIGH|Commits without #issue accepted — journey tests silently skip"
        "pre-push|HIGH|Stale-base pushes allowed — stale branches can re-introduce fixed bugs"
    )
    for entry in "${GIT_HOOK_CHECKS[@]}"; do
        IFS='|' read -r name severity impact <<< "$entry"
        src_path="$SPECFLOW_SRC/hooks/$name"
        local_path=".git/hooks/$name"
        if [ -f "$local_path" ] && [ -f "$src_path" ]; then
            if diff -q "$local_path" "$src_path" > /dev/null 2>&1; then
                printf "  ${GREEN}%-32s %-10s %-10s %s${NC}\n" "$name (.git/hooks)" "✅ current" "$severity" ""
            else
                printf "  ${RED}%-32s %-10s %-10s %s${NC}\n" "$name (.git/hooks)" "⚠ OUTDATED" "$severity" "$impact"
                ((OUTDATED++))
            fi
        elif [ -f "$src_path" ]; then
            printf "  ${RED}%-32s %-10s %-10s %s${NC}\n" "$name (.git/hooks)" "❌ MISSING" "$severity" "$impact"
            ((MISSING_LOCAL++))
        fi
    done

    # settings.json hook wiring — subset check (verify each required matcher is present)
    if [ -f ".claude/settings.json" ] && command -v jq &> /dev/null; then
        SETTINGS_MISSING=0
        REGISTERED=$(jq -r '.hooks.PostToolUse[]? | "\(.matcher)|\(.hooks[]?.command // empty)"' .claude/settings.json 2>/dev/null)

        # Each required entry: matcher|command_fragment|severity|impact
        REQUIRED_MATCHERS=(
            "Write|check-pipeline-compliance.sh|CRITICAL|Contract violations not caught when Claude creates files"
            "Edit|check-pipeline-compliance.sh|CRITICAL|Contract violations not caught when Claude edits files"
            "Bash|post-build-check.sh|CRITICAL|Journey tests never trigger after builds/commits"
            "Bash|post-push-ci.sh|MEDIUM|No CI feedback after push"
        )

        for entry in "${REQUIRED_MATCHERS[@]}"; do
            IFS='|' read -r matcher cmd_frag severity impact <<< "$entry"
            if echo "$REGISTERED" | grep -q "^${matcher}|.*${cmd_frag}"; then
                printf "  ${GREEN}%-32s %-10s %-10s %s${NC}\n" "settings.json ${matcher}→${cmd_frag}" "✅ wired" "$severity" ""
            else
                printf "  ${RED}%-32s %-10s %-10s %s${NC}\n" "settings.json ${matcher}→${cmd_frag}" "❌ MISSING" "$severity" "$impact"
                ((SETTINGS_MISSING++))
            fi
        done

        if [ "$SETTINGS_MISSING" -gt 0 ]; then
            check_fail "$SETTINGS_MISSING settings.json matcher(s) missing — run: npx @colmbyrne/specflow update ."
        fi
    elif [ ! -f ".claude/settings.json" ]; then
        printf "  ${RED}%-32s %-10s %-10s %s${NC}\n" "settings.json" "❌ MISSING" "CRITICAL" "No hooks wired to Claude — nothing fires on build, commit, write, or edit"
        ((MISSING_LOCAL++))
    else
        check_warn "jq not installed — cannot verify settings.json matchers"
    fi

    echo ""

    # Summary
    if [ "$OUTDATED" -eq 0 ] && [ "$MISSING_LOCAL" -eq 0 ]; then
        check_pass "All hook files match Specflow source"
    else
        TOTAL_ISSUES=$((OUTDATED + MISSING_LOCAL))
        check_fail "$TOTAL_ISSUES version issue(s): $OUTDATED outdated, $MISSING_LOCAL missing"
        echo "" >&2
        echo -e "  ${BLUE}Fix:${NC} npx @colmbyrne/specflow update . --ci" >&2
    fi
fi

echo ""
echo "========================================"
echo "Summary"
echo "========================================"
echo -e "${GREEN}Passed:   $PASS${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo -e "${RED}Failed:   $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    if [ $WARN -eq 0 ]; then
        echo -e "${GREEN}✅ Perfect! Specflow infrastructure is fully configured.${NC}"
    else
        echo -e "${YELLOW}⚠️  Specflow is set up with minor recommendations.${NC}"
        echo "   Review warnings above to improve your setup."
    fi
    echo ""
    echo "Quick commands:"
    echo "  npm run test:contracts  - Run contract tests"
    echo "  npm run test:e2e        - Run E2E journey tests"
    echo "  npm test                - Run all tests"
    echo ""
    echo "Sections verified:"
    echo "  1-7:  Core infrastructure (contracts, tests, CI, E2E)"
    echo "  8:    Hook installation (.claude/hooks/, .git/hooks/)"
    echo "  9:    Agent library (scripts/agents/)"
    echo "  10:   Fix patterns & model config (.specflow/)"
    echo "  11:   Contract metadata integrity (test file references)"
    echo "  12:   Graph validator (cross-reference integrity)"
    echo "  13:   Version check (local vs Specflow source)"
    exit 0
else
    echo -e "${RED}❌ Specflow setup has issues that need attention.${NC}"
    echo ""
    echo "Fix the failed checks above, then run this script again."
    echo ""
    echo "Need help? See:"
    echo "  - QUICKSTART.md for getting started"
    echo "  - MID-PROJECT-ADOPTION.md for existing projects"
    exit 1
fi
