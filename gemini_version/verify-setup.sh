#!/bin/bash
#
# Contract Infrastructure Verification Script
#
# This script verifies that contract-based development infrastructure
# has been set up correctly. Run after following META-INSTRUCTION.md.
#
# Usage:
#   ./docs/contracts/templates/verify-setup.sh
#
# Exit codes:
#   0 - All checks passed
#   1 - Some checks failed

set -e

echo "🔍 Verifying Contract Infrastructure Setup"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
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

echo "1. Directory Structure"
echo "----------------------"

if [ -d "docs/contracts" ]; then
    check_pass "docs/contracts/ exists"
else
    check_fail "docs/contracts/ missing"
fi

if [ -d "docs/contracts/templates" ]; then
    check_pass "docs/contracts/templates/ exists"
else
    check_fail "docs/contracts/templates/ missing"
fi

if [ -d "src/__tests__/contracts" ]; then
    check_pass "src/__tests__/contracts/ exists"
else
    check_fail "src/__tests__/contracts/ missing"
fi

if [ -d "scripts" ]; then
    check_pass "scripts/ exists"
else
    check_fail "scripts/ missing"
fi

echo ""
echo "2. Template Files"
echo "-----------------"

if [ -f "docs/contracts/contract_template.yml" ]; then
    check_pass "contract_template.yml exists"
else
    check_fail "contract_template.yml missing"
fi

if [ -f "src/__tests__/contracts/contractTemplate.test.ts" ]; then
    check_pass "contractTemplate.test.ts exists"
else
    check_fail "contractTemplate.test.ts missing"
fi

if [ -f "scripts/check-contracts.js" ]; then
    check_pass "check-contracts.js exists"

    # Check if executable
    if [ -x "scripts/check-contracts.js" ]; then
        check_pass "check-contracts.js is executable"
    else
        check_warn "check-contracts.js not executable (run: chmod +x scripts/check-contracts.js)"
    fi
else
    check_fail "check-contracts.js missing"
fi

echo ""
echo "3. Documentation"
echo "----------------"

if [ -f "docs/contracts/README.md" ]; then
    check_pass "contracts/README.md exists"
else
    check_fail "contracts/README.md missing"
fi

if [ -f "CLAUDE.md" ]; then
    # Check if CLAUDE.md has contract section
    if grep -q "Architectural Contracts" CLAUDE.md; then
        check_pass "CLAUDE.md has contract section"
    else
        check_warn "CLAUDE.md missing contract section (add from CLAUDE-MD-TEMPLATE.md)"
    fi
else
    check_warn "CLAUDE.md not found (create it with contract section)"
fi

echo ""
echo "4. Template Examples"
echo "--------------------"

if [ -f "docs/contracts/templates/META-INSTRUCTION.md" ]; then
    check_pass "META-INSTRUCTION.md exists"
else
    check_fail "META-INSTRUCTION.md missing"
fi

if [ -f "docs/contracts/templates/contract-example.yml" ]; then
    check_pass "contract-example.yml exists"
else
    check_warn "contract-example.yml missing (helpful reference)"
fi

if [ -f "docs/contracts/templates/test-example.test.ts" ]; then
    check_pass "test-example.test.ts exists"
else
    check_warn "test-example.test.ts missing (helpful reference)"
fi

echo ""
echo "5. Checker Script Functionality"
echo "--------------------------------"

if [ -f "scripts/check-contracts.js" ]; then
    # Try to run the checker
    if node scripts/check-contracts.js >/dev/null 2>&1; then
        check_pass "check-contracts.js runs without errors"
    else
        check_warn "check-contracts.js has runtime errors (may need project-specific setup)"
    fi
else
    check_fail "Cannot test checker - script missing"
fi

echo ""
echo "6. Test Infrastructure"
echo "----------------------"

if [ -f "package.json" ]; then
    check_pass "package.json exists"

    # Check if test script exists
    if grep -q '"test"' package.json; then
        check_pass "npm test script configured"

        # Try to run contract tests
        if npm test -- --listTests 2>/dev/null | grep -q "contracts"; then
            check_pass "Contract tests are discoverable"
        else
            check_warn "Contract tests not found by test runner (may need to create first contract)"
        fi
    else
        check_fail "npm test script not configured"
    fi
else
    check_fail "package.json missing"
fi

echo ""
echo "7. CI/CD Integration"
echo "--------------------"

CI_FOUND=false

if [ -d ".github/workflows" ]; then
    if grep -r "npm test" .github/workflows/*.yml >/dev/null 2>&1; then
        check_pass "GitHub Actions CI runs npm test"
        CI_FOUND=true
    fi
fi

if [ -f ".gitlab-ci.yml" ]; then
    if grep -q "npm test" .gitlab-ci.yml; then
        check_pass "GitLab CI runs npm test"
        CI_FOUND=true
    fi
fi

if [ -f "azure-pipelines.yml" ]; then
    if grep -q "npm test" azure-pipelines.yml; then
        check_pass "Azure Pipelines runs npm test"
        CI_FOUND=true
    fi
fi

if [ "$CI_FOUND" = false ]; then
    check_warn "No CI configuration found or CI doesn't run npm test"
fi

echo ""
echo "8. Contract Validation"
echo "----------------------"

# Check if any actual contracts exist
CONTRACT_COUNT=$(find docs/contracts -maxdepth 1 -name "*.yml" ! -name "*template*" | wc -l)

if [ "$CONTRACT_COUNT" -gt 0 ]; then
    check_pass "Found $CONTRACT_COUNT contract(s)"

    # Validate YAML syntax if Python is available
    if command -v python3 &> /dev/null; then
        INVALID=0
        for contract in docs/contracts/*.yml; do
            if [[ "$contract" != *"template"* ]]; then
                if python3 -c "import yaml; yaml.safe_load(open('$contract'))" 2>/dev/null; then
                    check_pass "$(basename $contract) is valid YAML"
                else
                    check_fail "$(basename $contract) has invalid YAML syntax"
                    ((INVALID++))
                fi
            fi
        done
    else
        check_warn "Python not available - skipping YAML validation"
    fi
else
    check_warn "No contracts created yet (create your first contract)"
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    if [ $WARN -eq 0 ]; then
        echo -e "${GREEN}✅ Perfect! Contract infrastructure is fully set up.${NC}"
        echo ""
        echo "Next steps:"
        echo "1. Create your first contract: cp docs/contracts/contract_template.yml docs/contracts/my_contract.yml"
        echo "2. Fill in contract rules and patterns"
        echo "3. Create tests: cp src/__tests__/contracts/contractTemplate.test.ts src/__tests__/contracts/myContract.test.ts"
        echo "4. Update scripts/check-contracts.js with your patterns"
        echo "5. Run: npm test -- myContract"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Contract infrastructure is set up with minor warnings.${NC}"
        echo ""
        echo "Review warnings above and fix if needed."
        echo "You can proceed with creating contracts."
        exit 0
    fi
else
    echo -e "${RED}❌ Contract infrastructure setup incomplete.${NC}"
    echo ""
    echo "Fix the failed checks above before proceeding."
    echo "See: docs/contracts/templates/META-INSTRUCTION.md"
    exit 1
fi
