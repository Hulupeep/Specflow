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

  # Update YOUR_ORG to your actual GitHub organization
  BASE_URL="https://raw.githubusercontent.com/YOUR_ORG/Specflow/main/hooks"

  curl -fsSL "$BASE_URL/journey-verification.md" -o "$HOOKS_DIR/journey-verification.md" || {
    echo -e "${RED}Error: Failed to download journey-verification.md${NC}"
    echo "Make sure to update YOUR_ORG in the script to your GitHub organization"
    exit 1
  }

  curl -fsSL "$BASE_URL/settings.json" -o "$HOOKS_DIR/settings.json" || {
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
# 3. Show CLAUDE.md integration instructions
# ============================================================================

echo -e "${BLUE}[3/3]${NC} CLAUDE.md integration..."

CLAUDE_MD="$TARGET_DIR/CLAUDE.md"

if [ -f "$CLAUDE_MD" ]; then
  # Check if hook section already exists
  if grep -q "Journey Verification Hook" "$CLAUDE_MD"; then
    echo -e "${GREEN}✓${NC} Journey Verification Hook section already exists in CLAUDE.md"
  else
    echo -e "${YELLOW}⚠️${NC}  CLAUDE.md found but missing hook section"
    echo ""
    echo -e "${YELLOW}Add the following sections to your CLAUDE.md:${NC}"
  fi
else
  echo -e "${YELLOW}⚠️${NC}  No CLAUDE.md found"
  echo ""
  echo -e "${YELLOW}Create a CLAUDE.md with these sections:${NC}"
fi

echo ""
cat << 'CLAUDE_SECTION'
─────────────────────────────────────────────────────────────
## Project Configuration

- **Package Manager:** pnpm          # npm | yarn | pnpm | bun
- **Build Command:** `pnpm build`
- **Test Command:** `pnpm test:e2e`
- **Test Directory:** `tests/e2e`
- **Production URL:** `https://www.yourapp.com`
- **Deploy Platform:** Vercel        # vercel | netlify | railway | none
- **Deploy Wait:** 90 seconds
- **Migration Command:** N/A         # supabase db push | prisma migrate | etc

---

## Journey Verification Hook

**MANDATORY**: Before claiming ANY ticket complete:

1. Claude MUST identify journey contracts from context (tasks, waves, git)
2. Claude MUST run E2E tests at BUILD BOUNDARIES
3. Claude MUST capture and report console errors
4. Claude MUST verify against production after deploy

**Trigger points (BUILD BOUNDARIES ONLY):**
- PRE-BUILD: Before running build command
- POST-BUILD: After build succeeds
- POST-COMMIT: After commit succeeds
- POST-MIGRATION: After migration succeeds (if applicable)

**Ticket discovery is AUTOMATIC from:**
- Active tasks (TaskList)
- Wave execution context
- Recent git commits
- Conversation context

**See:** `.claude/hooks/journey-verification.md` for detailed behavior.
─────────────────────────────────────────────────────────────
CLAUDE_SECTION

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
echo "  .claude/settings.json                  - Hook triggers"
echo "  .claude/hooks/journey-verification.md  - Hook behavior spec"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Add Project Configuration section to CLAUDE.md"
echo "   - Set your package manager, build command, test command"
echo "   - Set your production URL and deploy platform"
echo ""
echo "2. Add Journey Verification Hook section to CLAUDE.md"
echo "   - Copy the template shown above"
echo ""
echo "3. Ensure your project has E2E tests"
echo "   - Playwright, Cypress, or other E2E framework"
echo "   - Tests should be runnable via your test command"
echo ""
echo "4. Ensure tickets reference journey contracts"
echo "   - Add ## Journey section to GitHub issues"
echo "   - Format: J-FEATURE-NAME (criticality: CRITICAL/IMPORTANT)"
echo ""
echo "5. Test the hook by running a build"
echo "   - Claude should run E2E tests after build passes"
echo ""

echo -e "${GREEN}Documentation:${NC} .claude/hooks/journey-verification.md"
echo ""
