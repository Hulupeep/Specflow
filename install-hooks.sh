#!/bin/bash
# Specflow Journey Verification Hooks - Installation Script
# Usage: bash install-hooks.sh /path/to/target/project
#    or: curl -fsSL https://raw.githubusercontent.com/YOUR_ORG/Specflow/main/install-hooks.sh | bash -s /path/to/project

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

TARGET_DIR="$1"

# If no target specified, use current directory
if [ -z "$TARGET_DIR" ]; then
  TARGET_DIR="$(pwd)"
fi

# Resolve to absolute path
TARGET_DIR="$(cd "$TARGET_DIR" 2>/dev/null && pwd)" || {
  echo -e "${RED}Error: Target directory does not exist: $1${NC}"
  exit 1
}

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Specflow Journey Verification Hooks Installer        ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}Target:${NC} $TARGET_DIR"
echo ""

# Determine source directory (where this script lives)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOOKS_DIR="$SCRIPT_DIR/hooks"

# Check if running from Specflow repo or via curl
if [ -d "$HOOKS_DIR" ]; then
  echo -e "${GREEN}Source:${NC} $HOOKS_DIR (local)"
else
  # Download from GitHub
  echo -e "${YELLOW}Downloading hooks from GitHub...${NC}"
  TEMP_DIR=$(mktemp -d)
  HOOKS_DIR="$TEMP_DIR"

  curl -fsSL "https://raw.githubusercontent.com/YOUR_ORG/Specflow/main/hooks/journey-verification.md" -o "$HOOKS_DIR/journey-verification.md" || {
    echo -e "${RED}Error: Failed to download journey-verification.md${NC}"
    exit 1
  }

  curl -fsSL "https://raw.githubusercontent.com/YOUR_ORG/Specflow/main/hooks/settings.json" -o "$HOOKS_DIR/settings.json" || {
    echo -e "${RED}Error: Failed to download settings.json${NC}"
    exit 1
  }

  echo -e "${GREEN}Source:${NC} GitHub (downloaded)"
fi

echo ""

# ============================================================================
# 1. Create .claude directory structure
# ============================================================================

echo -e "${BLUE}[1/3]${NC} Creating .claude directory structure..."

mkdir -p "$TARGET_DIR/.claude/hooks"

echo -e "${GREEN}✓${NC} Created $TARGET_DIR/.claude/hooks/"
echo ""

# ============================================================================
# 2. Copy hook files
# ============================================================================

echo -e "${BLUE}[2/3]${NC} Installing hook files..."

# Copy journey verification spec
cp "$HOOKS_DIR/journey-verification.md" "$TARGET_DIR/.claude/hooks/"
echo -e "${GREEN}✓${NC} Installed .claude/hooks/journey-verification.md"

# Handle settings.json - merge if exists, create if not
if [ -f "$TARGET_DIR/.claude/settings.json" ]; then
  echo -e "${YELLOW}⚠️${NC}  Existing settings.json found - merging hooks..."

  # Check if jq is available
  if command -v jq &> /dev/null; then
    # Merge using jq
    TEMP_SETTINGS=$(mktemp)
    jq -s '.[0] * .[1]' "$TARGET_DIR/.claude/settings.json" "$HOOKS_DIR/settings.json" > "$TEMP_SETTINGS"
    mv "$TEMP_SETTINGS" "$TARGET_DIR/.claude/settings.json"
    echo -e "${GREEN}✓${NC} Merged hooks into existing settings.json"
  else
    echo -e "${YELLOW}⚠️${NC}  jq not found - backing up and replacing settings.json"
    cp "$TARGET_DIR/.claude/settings.json" "$TARGET_DIR/.claude/settings.json.backup"
    cp "$HOOKS_DIR/settings.json" "$TARGET_DIR/.claude/settings.json"
    echo -e "${GREEN}✓${NC} Installed .claude/settings.json (backup: settings.json.backup)"
  fi
else
  cp "$HOOKS_DIR/settings.json" "$TARGET_DIR/.claude/settings.json"
  echo -e "${GREEN}✓${NC} Installed .claude/settings.json"
fi

echo ""

# ============================================================================
# 3. Add CLAUDE.md section (if CLAUDE.md exists)
# ============================================================================

echo -e "${BLUE}[3/3]${NC} Checking CLAUDE.md integration..."

CLAUDE_MD="$TARGET_DIR/CLAUDE.md"

if [ -f "$CLAUDE_MD" ]; then
  # Check if hook section already exists
  if grep -q "Journey Verification Hook" "$CLAUDE_MD"; then
    echo -e "${YELLOW}⚠️${NC}  Journey Verification Hook section already exists in CLAUDE.md"
  else
    echo -e "${YELLOW}⚠️${NC}  CLAUDE.md found but missing Journey Verification Hook section"
    echo ""
    echo -e "Add the following to your CLAUDE.md:"
    echo ""
    cat << 'CLAUDE_SECTION'
---

## Journey Verification Hook

**MANDATORY**: Before claiming ANY ticket complete:

1. Claude MUST identify journey contracts from context (tasks, waves, git)
2. Claude MUST run Playwright tests at BUILD BOUNDARIES
3. Claude MUST capture and report console errors
4. Claude MUST verify against production after deploy

**Trigger points (BUILD BOUNDARIES ONLY):**
- PRE-BUILD: Before running pnpm build
- POST-BUILD: After build succeeds
- POST-COMMIT: After commit succeeds
- POST-MIGRATION: After supabase db push succeeds

**Ticket discovery is AUTOMATIC from:**
- Active tasks (TaskList)
- Wave execution context
- Recent git commits
- Conversation context

**See:** `.claude/hooks/journey-verification.md` for detailed behavior.

CLAUDE_SECTION
  fi
else
  echo -e "${YELLOW}⚠️${NC}  No CLAUDE.md found - skipping integration"
  echo "    Create a CLAUDE.md and run again, or manually add hook instructions"
fi

echo ""

# ============================================================================
# Cleanup temp files if downloaded
# ============================================================================

if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi

# ============================================================================
# Summary
# ============================================================================

echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                 Installation Complete                     ║${NC}"
echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${GREEN}Installed files:${NC}"
echo "  .claude/settings.json          - Hook triggers"
echo "  .claude/hooks/journey-verification.md - Hook behavior spec"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. If not already done, add Journey Verification Hook section to CLAUDE.md"
echo ""
echo "2. Ensure your project has Playwright tests:"
echo "   tests/e2e/journey_*.spec.ts"
echo ""
echo "3. Ensure your tickets reference journey contracts:"
echo "   ## Journey"
echo "   J-FEATURE-NAME (criticality: CRITICAL)"
echo ""
echo "4. Test the hook by running a build:"
echo "   pnpm build"
echo "   # Claude should run Playwright tests after build passes"
echo ""

echo -e "${GREEN}Documentation:${NC} .claude/hooks/journey-verification.md"
echo ""
