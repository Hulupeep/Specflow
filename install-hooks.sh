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
  TEMPLATES_URL="https://raw.githubusercontent.com/Hulupeep/Specflow/main/templates/hooks"

  # NOTE: This list must be updated when new hooks are added to hooks/
  for file in settings.json post-build-check.sh run-journey-tests.sh session-start.sh check-pipeline-compliance.sh commit-msg pre-push README.md; do
    curl -fsSL "$BASE_URL/$file" -o "$HOOKS_DIR/$file" 2>/dev/null || {
      echo -e "${YELLOW}Warning: Could not download $file${NC}"
    }
  done

  # Download template hooks (post-push-ci.sh)
  curl -fsSL "$TEMPLATES_URL/post-push-ci.sh" -o "$HOOKS_DIR/post-push-ci.sh" 2>/dev/null || {
    echo -e "${YELLOW}Warning: Could not download post-push-ci.sh${NC}"
  }

  echo -e "${GREEN}Source:${NC} GitHub (downloaded)"
fi

echo ""

# ============================================================================
# 1. Check requirements
# ============================================================================

echo -e "${BLUE}[1/5]${NC} Checking requirements..."

if ! command -v jq &> /dev/null; then
  echo -e "${RED}✗${NC}  jq not found — required for hook JSON parsing"
  echo -e "    Install: brew install jq (mac) or apt install jq (linux)"
  exit 1
fi
echo -e "${GREEN}✓${NC} jq found"

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

echo -e "${BLUE}[2/5]${NC} Creating .claude directory structure..."

mkdir -p "$TARGET_DIR/.claude/hooks"

echo -e "${GREEN}✓${NC} Created $TARGET_DIR/.claude/hooks/"
echo ""

# ============================================================================
# 3. Copy hook files
# ============================================================================

echo -e "${BLUE}[3/5]${NC} Installing hook files..."

# Copy all hook scripts (dynamic — picks up new hooks automatically)
for script in "$HOOKS_DIR"/*.sh; do
  [ -f "$script" ] || continue
  SCRIPT_NAME=$(basename "$script")
  cp "$script" "$TARGET_DIR/.claude/hooks/"
  chmod +x "$TARGET_DIR/.claude/hooks/$SCRIPT_NAME"
  echo -e "${GREEN}✓${NC} Installed .claude/hooks/$SCRIPT_NAME"
done

# Copy template hooks (post-push-ci.sh)
TEMPLATES_HOOKS_DIR="$SCRIPT_DIR/templates/hooks"
if [ -f "$TEMPLATES_HOOKS_DIR/post-push-ci.sh" ]; then
  cp "$TEMPLATES_HOOKS_DIR/post-push-ci.sh" "$TARGET_DIR/.claude/hooks/"
  chmod +x "$TARGET_DIR/.claude/hooks/post-push-ci.sh"
  echo -e "${GREEN}✓${NC} Installed .claude/hooks/post-push-ci.sh"
elif [ -f "$HOOKS_DIR/post-push-ci.sh" ]; then
  # Fallback: downloaded via curl into HOOKS_DIR
  cp "$HOOKS_DIR/post-push-ci.sh" "$TARGET_DIR/.claude/hooks/"
  chmod +x "$TARGET_DIR/.claude/hooks/post-push-ci.sh"
  echo -e "${GREEN}✓${NC} Installed .claude/hooks/post-push-ci.sh"
fi

# Copy README for reference
if [ -f "$HOOKS_DIR/README.md" ]; then
  cp "$HOOKS_DIR/README.md" "$TARGET_DIR/.claude/hooks/"
  echo -e "${GREEN}✓${NC} Installed .claude/hooks/README.md"
fi

# Install git hooks (commit-msg, pre-push)
install_git_hook() {
  local name="$1"
  local desc="$2"
  if [ ! -f "$HOOKS_DIR/$name" ]; then
    return
  fi
  if [ -f "$TARGET_DIR/.git/hooks/$name" ]; then
    echo -e "${YELLOW}⚠️${NC}  Existing .git/hooks/$name found — backing up"
    cp "$TARGET_DIR/.git/hooks/$name" "$TARGET_DIR/.git/hooks/$name.backup"
  fi
  cp "$HOOKS_DIR/$name" "$TARGET_DIR/.git/hooks/$name"
  chmod +x "$TARGET_DIR/.git/hooks/$name"
  echo -e "${GREEN}✓${NC} Installed .git/hooks/$name ($desc)"
}

if [ -d "$TARGET_DIR/.git" ]; then
  mkdir -p "$TARGET_DIR/.git/hooks"
  install_git_hook "commit-msg" "enforces issue numbers"
  install_git_hook "pre-push" "branch freshness check"
else
  echo -e "${YELLOW}⚠️${NC}  Not a git repo — skipping .git/hooks/"
fi

# Handle settings.json - merge if exists, create if not
if [ -f "$TARGET_DIR/.claude/settings.json" ]; then
  echo -e "${YELLOW}⚠️${NC}  Existing settings.json found - merging hooks..."

  if command -v jq &> /dev/null; then
    # Merge using jq — concatenate hook arrays, don't replace
    TEMP_SETTINGS=$(mktemp)
    if jq -s '
      (.[0].hooks.PostToolUse // []) as $existing |
      (.[1].hooks.PostToolUse // []) as $new |
      .[0] * .[1] |
      .hooks.PostToolUse = ($existing + $new | unique_by(.hooks[0].command))
    ' "$TARGET_DIR/.claude/settings.json" "$HOOKS_DIR/settings.json" > "$TEMP_SETTINGS"; then
      mv "$TEMP_SETTINGS" "$TARGET_DIR/.claude/settings.json"
      echo -e "${GREEN}✓${NC} Merged hooks into existing settings.json (preserved existing hooks)"
    else
      rm -f "$TEMP_SETTINGS"
      echo -e "${RED}✗${NC}  Cannot merge settings.json — existing PostToolUse structure is incompatible"
      echo -e "    Your settings.json was NOT changed."
      echo -e "    To fix: manually add the hooks from $HOOKS_DIR/settings.json"
      echo -e "    Or: delete .claude/settings.json and re-run this script"
    fi
  else
    echo -e "${RED}✗${NC}  jq required to merge with existing settings.json"
    echo -e "    Your settings.json was NOT changed."
    echo -e "    Install jq: apt install jq (linux) / brew install jq (mac)"
    echo -e "    Then re-run this script."
  fi
else
  cp "$HOOKS_DIR/settings.json" "$TARGET_DIR/.claude/settings.json"
  echo -e "${GREEN}✓${NC} Installed .claude/settings.json"
fi

echo ""

# ============================================================================
# 4. Install CI workflows (optional)
# ============================================================================

echo -e "${BLUE}[4/5]${NC} CI workflow installation..."

CI_DIR="$SCRIPT_DIR/templates/ci"
WORKFLOWS_DIR="$TARGET_DIR/.github/workflows"

if [ -d "$CI_DIR" ]; then
  # Check if .github/workflows exists or can be created
  if [ -d "$TARGET_DIR/.github" ] || [ -d "$TARGET_DIR/.git" ]; then
    INSTALL_CI=false

    # Auto-install if --ci flag passed, otherwise check if workflows dir exists
    if echo "$@" | grep -q -- "--ci"; then
      INSTALL_CI=true
    elif [ ! -d "$WORKFLOWS_DIR" ]; then
      echo -e "${YELLOW}⚠️${NC}  No .github/workflows/ directory — skipping CI templates"
      echo -e "    To install CI workflows: bash install-hooks.sh $TARGET_DIR --ci"
    else
      INSTALL_CI=true
    fi

    if [ "$INSTALL_CI" = true ]; then
      mkdir -p "$WORKFLOWS_DIR"
      for workflow in specflow-compliance.yml specflow-audit.yml; do
        if [ -f "$CI_DIR/$workflow" ]; then
          if [ -f "$WORKFLOWS_DIR/$workflow" ]; then
            echo -e "${YELLOW}⚠️${NC}  $workflow already exists — skipping (delete to reinstall)"
          else
            cp "$CI_DIR/$workflow" "$WORKFLOWS_DIR/$workflow"
            echo -e "${GREEN}✓${NC} Installed .github/workflows/$workflow"
          fi
        fi
      done
    fi
  else
    echo -e "${YELLOW}⚠️${NC}  Not a git repo — skipping CI workflow installation"
  fi
else
  echo -e "${YELLOW}⚠️${NC}  CI templates not found in Specflow source"
fi

echo ""

# ============================================================================
# 5. Show usage instructions
# ============================================================================

echo -e "${BLUE}[5/5]${NC} Setup complete!"
echo ""

# Cleanup temp files if downloaded
if [ -n "$TEMP_DIR" ] && [ -d "$TEMP_DIR" ]; then
  rm -rf "$TEMP_DIR"
fi

# ============================================================================
# Summary
# ============================================================================

# Verify critical files were actually installed
INSTALL_OK=true
for expected in post-build-check.sh run-journey-tests.sh; do
  if [ ! -x "$TARGET_DIR/.claude/hooks/$expected" ]; then
    INSTALL_OK=false
  fi
done
if [ ! -f "$TARGET_DIR/.claude/settings.json" ]; then
  INSTALL_OK=false
fi

if [ "$INSTALL_OK" = true ]; then
  echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║                 Installation Complete                     ║${NC}"
  echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
else
  echo -e "${RED}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║              Installation Incomplete                      ║${NC}"
  echo -e "${RED}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${RED}Some required files failed to install. Review warnings above.${NC}"
fi
echo ""

echo -e "${GREEN}Installed files:${NC}"
echo "  .claude/settings.json              - Hook configuration"
echo "  .claude/hooks/post-build-check.sh  - Detects build/commit"
echo "  .claude/hooks/run-journey-tests.sh - Runs targeted tests"
echo "  .claude/hooks/post-push-ci.sh      - CI status after push"
echo "  .claude/hooks/README.md            - Documentation"
echo ""

echo -e "${YELLOW}How it works:${NC}"
echo ""
echo "  Build/commit hooks:"
echo "  1. After 'pnpm build' or 'git commit' succeeds"
echo "  2. Hook extracts issue numbers from recent commits (#123)"
echo "  3. Fetches each issue to find journey contract (J-SIGNUP-FLOW)"
echo "  4. Maps to test file (journey_signup_flow.spec.ts)"
echo "  5. Runs only those tests"
echo "  6. Blocks on failure (exit 2)"
echo ""
echo "  Push hook:"
echo "  1. After 'git push' succeeds"
echo "  2. Polls GitHub Actions for latest CI run status"
echo "  3. Reports pass/fail (advisory, does not block)"
echo ""

echo -e "${YELLOW}Requirements:${NC}"
echo ""
echo "  - Commits reference issues: 'feat: thing (#123)'"
echo "  - Issues have journey contract: 'J-FEATURE-NAME' in body"
echo "  - Test files named: 'journey_feature_name.spec.ts'"
echo ""

echo -e "${YELLOW}To defer hooks:${NC}"
echo ""
echo "  touch .claude/.defer-tests       # Skip journey tests"
echo "  rm .claude/.defer-tests          # Re-enable journey tests"
echo "  touch .claude/.defer-ci-check    # Skip CI status check"
echo "  rm .claude/.defer-ci-check       # Re-enable CI status check"
echo ""

echo -e "${GREEN}Documentation:${NC} .claude/hooks/README.md"
echo ""
