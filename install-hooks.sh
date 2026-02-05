#!/bin/bash
# Specflow Journey Verification Hooks - Installation Script
# Usage: bash install-hooks.sh /path/to/target/project
#    or: curl -fsSL https://raw.githubusercontent.com/Hulupeep/Specflow/main/install-hooks.sh | bash -s /path/to/project

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

  BASE_URL="https://raw.githubusercontent.com/Hulupeep/Specflow/main/hooks"

  for file in settings.json post-build-check.sh run-journey-tests.sh session-start.sh README.md; do
    curl -fsSL "$BASE_URL/$file" -o "$HOOKS_DIR/$file" 2>/dev/null || {
      echo -e "${YELLOW}Warning: Could not download $file${NC}"
    }
  done

  echo -e "${GREEN}Source:${NC} GitHub (downloaded)"
fi

echo ""

# ============================================================================
# 1. Check requirements
# ============================================================================

echo -e "${BLUE}[1/4]${NC} Checking requirements..."

if ! command -v jq &> /dev/null; then
  echo -e "${YELLOW}⚠️${NC}  jq not found. Install with: brew install jq (mac) or apt install jq (linux)"
fi

if ! command -v gh &> /dev/null; then
  echo -e "${YELLOW}⚠️${NC}  gh CLI not found. Install with: brew install gh"
  echo -e "    Required for fetching issue journey contracts"
else
  echo -e "${GREEN}✓${NC} gh CLI found"
fi

echo ""

# ============================================================================
# 2. Create .claude directory structure
# ============================================================================

echo -e "${BLUE}[2/4]${NC} Creating .claude directory structure..."

mkdir -p "$TARGET_DIR/.claude/hooks"

echo -e "${GREEN}✓${NC} Created $TARGET_DIR/.claude/hooks/"
echo ""

# ============================================================================
# 3. Copy hook files
# ============================================================================

echo -e "${BLUE}[3/4]${NC} Installing hook files..."

# Copy main hook scripts
for script in post-build-check.sh run-journey-tests.sh session-start.sh; do
  if [ -f "$HOOKS_DIR/$script" ]; then
    cp "$HOOKS_DIR/$script" "$TARGET_DIR/.claude/hooks/"
    chmod +x "$TARGET_DIR/.claude/hooks/$script"
    echo -e "${GREEN}✓${NC} Installed .claude/hooks/$script"
  fi
done

# Copy README for reference
if [ -f "$HOOKS_DIR/README.md" ]; then
  cp "$HOOKS_DIR/README.md" "$TARGET_DIR/.claude/hooks/"
  echo -e "${GREEN}✓${NC} Installed .claude/hooks/README.md"
fi

# Handle settings.json - merge if exists, create if not
if [ -f "$TARGET_DIR/.claude/settings.json" ]; then
  echo -e "${YELLOW}⚠️${NC}  Existing settings.json found - merging hooks..."

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
# 4. Show usage instructions
# ============================================================================

echo -e "${BLUE}[4/4]${NC} Setup complete!"
echo ""

# Cleanup temp files if downloaded
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
echo "  .claude/settings.json              - Hook configuration"
echo "  .claude/hooks/post-build-check.sh  - Detects build/commit"
echo "  .claude/hooks/run-journey-tests.sh - Runs targeted tests"
echo "  .claude/hooks/README.md            - Documentation"
echo ""

echo -e "${YELLOW}How it works:${NC}"
echo ""
echo "  1. After 'pnpm build' or 'git commit' succeeds"
echo "  2. Hook extracts issue numbers from recent commits (#123)"
echo "  3. Fetches each issue to find journey contract (J-SIGNUP-FLOW)"
echo "  4. Maps to test file (journey_signup_flow.spec.ts)"
echo "  5. Runs only those tests"
echo "  6. Blocks on failure (exit 2)"
echo ""

echo -e "${YELLOW}Requirements:${NC}"
echo ""
echo "  - Commits reference issues: 'feat: thing (#123)'"
echo "  - Issues have journey contract: 'J-FEATURE-NAME' in body"
echo "  - Test files named: 'journey_feature_name.spec.ts'"
echo ""

echo -e "${YELLOW}To defer tests:${NC}"
echo ""
echo "  touch .claude/.defer-tests    # Skip tests"
echo "  rm .claude/.defer-tests       # Re-enable tests"
echo ""

echo -e "${GREEN}Documentation:${NC} .claude/hooks/README.md"
echo ""
