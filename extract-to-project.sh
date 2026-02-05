#!/bin/bash
# Specflow Frontier Improvements - Project Extraction Script
# Usage: bash Specflow/extract-to-project.sh /path/to/target/project

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

TARGET_DIR="$1"

if [ -z "$TARGET_DIR" ]; then
  echo "Usage: bash Specflow/extract-to-project.sh /path/to/target/project"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo "Error: Target directory $TARGET_DIR does not exist"
  exit 1
fi

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Specflow Frontier Improvements - Project Extraction     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo -e "${GREEN}Source:${NC} $SOURCE_DIR"
echo -e "${GREEN}Target:${NC} $TARGET_DIR"
echo ""

# ============================================================================
# 1. Quality Contract System
# ============================================================================

echo -e "${BLUE}[1/6]${NC} Copying Quality Contract System..."

mkdir -p "$TARGET_DIR/docs/contracts"
mkdir -p "$TARGET_DIR/docs/testing"
mkdir -p "$TARGET_DIR/scripts"

cp "$SOURCE_DIR/docs/contracts/quality_e2e_test_standards.yml" "$TARGET_DIR/docs/contracts/" 2>/dev/null || echo "  ⚠️  quality_e2e_test_standards.yml not found"
cp "$SOURCE_DIR/docs/testing/E2E_ANTI_PATTERN_FIX_GUIDE.md" "$TARGET_DIR/docs/testing/" 2>/dev/null || echo "  ⚠️  E2E_ANTI_PATTERN_FIX_GUIDE.md not found"
cp "$SOURCE_DIR/scripts/check-test-antipatterns.sh" "$TARGET_DIR/scripts/" 2>/dev/null || echo "  ⚠️  check-test-antipatterns.sh not found"
chmod +x "$TARGET_DIR/scripts/check-test-antipatterns.sh" 2>/dev/null || true

echo -e "${GREEN}✓${NC} Quality contract system copied"
echo ""

# ============================================================================
# 2. Wave Execution Framework
# ============================================================================

echo -e "${BLUE}[2/6]${NC} Copying Wave Execution Framework..."

cp "$SOURCE_DIR/docs/WAVE_EXECUTION_PROTOCOL.md" "$TARGET_DIR/docs/" 2>/dev/null || echo "  ⚠️  WAVE_EXECUTION_PROTOCOL.md not found"
cp "$SOURCE_DIR/docs/promptright.md" "$TARGET_DIR/docs/" 2>/dev/null || echo "  ⚠️  promptright.md not found"

echo -e "${GREEN}✓${NC} Wave execution framework copied"
echo ""

# ============================================================================
# 3. Agent Library
# ============================================================================

echo -e "${BLUE}[3/6]${NC} Copying Agent Library..."

mkdir -p "$TARGET_DIR/scripts/agents"

# Essential agents
ESSENTIAL_AGENTS=(
  "README.md"
  "WORKFLOW.md"
  "PROTOCOL.md"
  "waves-controller.md"
  "specflow-writer.md"
  "contract-validator.md"
  "migration-builder.md"
  "playwright-from-specflow.md"
  "journey-tester.md"
  "journey-enforcer.md"
  "journey-gate.md"
  "issue-lifecycle.md"
  "db-coordinator.md"
  "quality-gate.md"
  "e2e-test-auditor.md"
  "ticket-closer.md"
)

COPIED_COUNT=0
for agent in "${ESSENTIAL_AGENTS[@]}"; do
  if cp "$SOURCE_DIR/scripts/agents/$agent" "$TARGET_DIR/scripts/agents/" 2>/dev/null; then
    COPIED_COUNT=$((COPIED_COUNT + 1))
  else
    echo "  ⚠️  $agent not found"
  fi
done

echo -e "${GREEN}✓${NC} Agent library copied ($COPIED_COUNT/${#ESSENTIAL_AGENTS[@]} agents)"
echo ""

# ============================================================================
# 3b. Agent Teams Supporting Files
# ============================================================================

echo -e "${BLUE}[3b/6]${NC} Setting up Agent Teams infrastructure..."

# Baseline for regression detection
mkdir -p "$TARGET_DIR/.specflow"
if [ ! -f "$TARGET_DIR/.specflow/baseline.json" ]; then
  echo '{"version":1,"last_updated":null,"last_wave":null,"last_commit":null,"tests":{}}' \
    > "$TARGET_DIR/.specflow/baseline.json"
  echo "  Created .specflow/baseline.json"
fi

# Scoped defer journal (replaces deprecated .defer-tests)
mkdir -p "$TARGET_DIR/.claude"
if [ ! -f "$TARGET_DIR/.claude/.defer-journal" ]; then
  cat > "$TARGET_DIR/.claude/.defer-journal" <<'DEFER_EOF'
# Scoped journey deferrals -- each requires a tracking issue
# Format: J-ID: reason (#tracking-issue)
#
# Rules:
# - Only listed J-IDs are skipped by journey-gate
# - Every deferral MUST reference a tracking issue
# - Review and prune monthly
# - .defer-tests is IGNORED (deprecated)
DEFER_EOF
  echo "  Created .claude/.defer-journal"
fi

# Remove deprecated defer mechanism
if [ -f "$TARGET_DIR/.claude/.defer-tests" ]; then
  rm -f "$TARGET_DIR/.claude/.defer-tests"
  echo "  Removed deprecated .claude/.defer-tests"
fi

# Regression comparison script
cp "$SOURCE_DIR/scripts/compare-baseline.js" "$TARGET_DIR/scripts/" 2>/dev/null || echo "  compare-baseline.js not found"

echo -e "${GREEN}✓${NC} Agent Teams infrastructure set up"
echo ""

# ============================================================================
# 4. Specflow Core (if not already present)
# ============================================================================

echo -e "${BLUE}[4/6]${NC} Copying Specflow Core Files..."

mkdir -p "$TARGET_DIR/Specflow"

if [ -d "$SOURCE_DIR/Specflow" ]; then
  cp "$SOURCE_DIR/Specflow/FRONTIER_IMPROVEMENTS.md" "$TARGET_DIR/Specflow/" 2>/dev/null || echo "  ⚠️  FRONTIER_IMPROVEMENTS.md not found"

  # Copy core Specflow docs if they exist
  CORE_FILES=(
    "CONTRACTS-README.md"
    "SPEC-FORMAT.md"
    "CONTRACT-SCHEMA.md"
    "LLM-MASTER-PROMPT.md"
    "MID-PROJECT-ADOPTION.md"
    "CI-INTEGRATION.md"
  )

  for file in "${CORE_FILES[@]}"; do
    cp "$SOURCE_DIR/Specflow/$file" "$TARGET_DIR/Specflow/" 2>/dev/null || true
  done
fi

echo -e "${GREEN}✓${NC} Specflow core files copied"
echo ""

# ============================================================================
# 5. Journey Verification Hooks
# ============================================================================

echo -e "${BLUE}[5/6]${NC} Installing Journey Verification Hooks..."

mkdir -p "$TARGET_DIR/.claude/hooks"

if [ -d "$SOURCE_DIR/hooks" ]; then
  cp "$SOURCE_DIR/hooks/journey-verification.md" "$TARGET_DIR/.claude/hooks/" 2>/dev/null || echo "  ⚠️  journey-verification.md not found"
  cp "$SOURCE_DIR/hooks/settings.json" "$TARGET_DIR/.claude/settings.json" 2>/dev/null || echo "  ⚠️  settings.json not found"
  cp "$SOURCE_DIR/hooks/README.md" "$TARGET_DIR/.claude/hooks/" 2>/dev/null || true
  echo -e "${GREEN}✓${NC} Journey verification hooks installed"
else
  echo -e "${YELLOW}⚠️${NC}  hooks/ directory not found, skipping"
fi

echo ""

# ============================================================================
# 6. CI/CD Integration Template
# ============================================================================

echo -e "${BLUE}[6/6]${NC} Creating CI/CD integration template..."

mkdir -p "$TARGET_DIR/.github/workflows"

if [ -f "$SOURCE_DIR/.github/workflows/ci.yml" ]; then
  # Extract just the anti-pattern check step
  cat > "$TARGET_DIR/.github/workflows/e2e-quality-gate.yml.template" <<'EOF'
# E2E Quality Gate - Add this step to your CI workflow
# Place BEFORE your E2E test execution step

- name: Check for E2E test anti-patterns
  run: |
    echo "🔍 Checking for E2E test anti-patterns..."
    bash scripts/check-test-antipatterns.sh
    if [ $? -ne 0 ]; then
      echo "❌ FAILED: E2E anti-patterns detected"
      echo "📖 See fix guide: docs/testing/E2E_ANTI_PATTERN_FIX_GUIDE.md"
      echo "📋 Quality contract: docs/contracts/quality_e2e_test_standards.yml"
      exit 1
    fi
    echo "✅ PASSED: No critical anti-patterns detected"
EOF

  echo -e "${GREEN}✓${NC} CI/CD template created: .github/workflows/e2e-quality-gate.yml.template"
else
  echo -e "${YELLOW}⚠️${NC}  Source CI config not found, skipping template"
fi

echo ""

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                  Extraction Complete                      ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}✓${NC} Files copied to: $TARGET_DIR"
echo ""

echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Update agent prompts with your project name:"
echo "   - Replace 'Timebreez' references in scripts/agents/*.md"
echo "   - Update domain knowledge sections"
echo ""
echo "2. Adapt quality contract for your test structure:"
echo "   - Edit docs/contracts/quality_e2e_test_standards.yml"
echo "   - Update test directory paths in scripts/check-test-antipatterns.sh"
echo ""
echo "3. Integrate CI gate:"
echo "   - Copy content from .github/workflows/e2e-quality-gate.yml.template"
echo "   - Add to your CI workflow BEFORE E2E test execution"
echo ""
echo "4. Update CLAUDE.md:"
echo "   - Add Subagent Library section"
echo "   - Add Auto-Trigger Rules"
echo "   - Add Journey Verification Hook section (see .claude/hooks/README.md)"
echo ""
echo "5. Configure journey hooks for your project:"
echo "   - Review .claude/settings.json hook triggers"
echo "   - Update production URL in .claude/hooks/journey-verification.md"
echo "   - Ensure Playwright tests exist at tests/e2e/journey_*.spec.ts"
echo ""
echo "6. Test the extraction:"
echo "   bash scripts/check-test-antipatterns.sh"
echo "   pnpm build  # Should trigger hook reminder"
echo ""

echo -e "${BLUE}Documentation:${NC}"
echo "  - Specflow/FRONTIER_IMPROVEMENTS.md"
echo "  - .claude/hooks/README.md"
echo ""
