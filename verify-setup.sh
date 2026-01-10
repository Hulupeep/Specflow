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
    CONTRACT_COUNT=$(find "$CONTRACT_DIR" -maxdepth 1 -name "*.yml" -o -name "*.yaml" 2>/dev/null | wc -l)

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

    # Check for contract-related content
    if grep -qi "contract" CLAUDE.md; then
        check_pass "CLAUDE.md mentions contracts"
    else
        check_warn "CLAUDE.md should include contract enforcement instructions"
    fi

    # Check for architecture section
    if grep -qi "architecture\|arch-" CLAUDE.md; then
        check_pass "CLAUDE.md has architecture guidance"
    else
        check_warn "CLAUDE.md should document architectural constraints"
    fi
else
    check_warn "No CLAUDE.md found (recommended for LLM guidance)"
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
