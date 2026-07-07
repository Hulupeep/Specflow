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

prompt_model_routing() {
  local template="$TARGET_DIR/.specflow/adapter-policies/claude-code-large-routing.yml"
  local destination="$TARGET_DIR/.specflow/adapter-routing.yml"

  if [ -f "$destination" ]; then
    echo -e "${GREEN}✓${NC} Model routing already active → .specflow/adapter-routing.yml"
    return 0
  fi
  if [ ! -f "$template" ]; then
    echo -e "${YELLOW}⚠️${NC}  Model routing template not found; run specflow update after upgrading Specflow"
    return 0
  fi

  case "${SPECFLOW_MODEL_ROUTING:-}" in
    1|true|TRUE|yes|YES|y|Y)
      cp "$template" "$destination"
      echo -e "${GREEN}✓${NC} Enabled model routing → .specflow/adapter-routing.yml"
      return 0
      ;;
    0|false|FALSE|no|NO|n|N)
      echo -e "${YELLOW}⚠️${NC}  Model routing not enabled"
      return 0
      ;;
  esac

  if [ -t 0 ]; then
    printf "Enable model routing now? This activates Claude/Fable for planning/review and Codex for coding. [y/N] "
    read -r answer
    case "$answer" in
      y|Y|yes|YES)
        cp "$template" "$destination"
        echo -e "${GREEN}✓${NC} Enabled model routing → .specflow/adapter-routing.yml"
        ;;
      *)
        echo -e "${YELLOW}⚠️${NC}  Model routing not enabled. Enable later with: specflow run --setup-routing"
        ;;
    esac
  else
    echo -e "${YELLOW}⚠️${NC}  Model routing not enabled in non-interactive install. Enable later with: specflow run --setup-routing"
  fi
}

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

echo -e "${BLUE}[1/6]${NC} Checking requirements..."

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

echo -e "${BLUE}[2/6]${NC} Creating .claude directory structure..."

mkdir -p "$TARGET_DIR/.claude/hooks"

echo -e "${GREEN}✓${NC} Created $TARGET_DIR/.claude/hooks/"
echo ""

# ============================================================================
# 3. Copy hook files
# ============================================================================

echo -e "${BLUE}[3/6]${NC} Installing hook files..."

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
    # Merge using jq — concatenate hook arrays, dedupe on (matcher, command) pair
    # so that Write→X and Edit→X are treated as distinct entries.
    TEMP_SETTINGS=$(mktemp)
    if jq -s '
      (.[0].hooks.PostToolUse // []) as $existing |
      (.[1].hooks.PostToolUse // []) as $new |
      .[0] * .[1] |
      .hooks.PostToolUse = ($existing + $new | unique_by([.matcher, (.hooks[0].command // "")]))
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
# 4. Refresh QA loops kit + gate scripts
# ============================================================================

echo -e "${BLUE}[4/6]${NC} Refreshing QA loops kit + gate scripts..."

REFRESHED_KIT=false
if [ -d "$SCRIPT_DIR/templates/QA" ]; then
  mkdir -p "$TARGET_DIR/QA"
  cp -a "$SCRIPT_DIR/templates/QA/." "$TARGET_DIR/QA/"
  QA_FILES=$(find "$TARGET_DIR/QA" -type f | wc -l | tr -d ' ')
  echo -e "${GREEN}✓${NC} Refreshed QA/ ($QA_FILES files)"
  REFRESHED_KIT=true
  if [ -f "$SCRIPT_DIR/templates/PROCESS.md" ]; then
    cp -a "$SCRIPT_DIR/templates/PROCESS.md" "$TARGET_DIR/PROCESS.md"
    echo -e "${GREEN}✓${NC} Refreshed PROCESS.md"
  fi
fi
if ls "$SCRIPT_DIR/scripts/"*.cjs >/dev/null 2>&1; then
  mkdir -p "$TARGET_DIR/scripts"
  for script in "$SCRIPT_DIR/scripts/"*.cjs; do
    cp "$script" "$TARGET_DIR/scripts/"
    echo -e "${GREEN}✓${NC} scripts/$(basename "$script")"
  done
  REFRESHED_KIT=true
fi
if [ -f "$SCRIPT_DIR/templates/AGENTS.md" ]; then
  if [ ! -f "$TARGET_DIR/AGENTS.md" ]; then
    cp -a "$SCRIPT_DIR/templates/AGENTS.md" "$TARGET_DIR/AGENTS.md"
    echo -e "${GREEN}✓${NC} Installed AGENTS.md"
  elif ! grep -q "Specflow Loop Routing" "$TARGET_DIR/AGENTS.md" 2>/dev/null; then
    {
      echo ""
      cat "$SCRIPT_DIR/templates/AGENTS.md"
    } >> "$TARGET_DIR/AGENTS.md"
    echo -e "${GREEN}✓${NC} Appended Specflow loop routing to AGENTS.md"
  else
    echo -e "${GREEN}✓${NC} AGENTS.md already has Specflow loop routing"
  fi
  REFRESHED_KIT=true
fi
if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_target in ".claude/skills" ".codex/skills" ".agents/skills"; do
    mkdir -p "$TARGET_DIR/$skill_target"
    for skill_dir in "$SCRIPT_DIR/skills/"*; do
      if [ -d "$skill_dir" ] && [ -f "$skill_dir/SKILL.md" ]; then
        rm -rf "$TARGET_DIR/$skill_target/$(basename "$skill_dir")"
        cp -a "$skill_dir" "$TARGET_DIR/$skill_target/"
      fi
    done
    echo -e "${GREEN}✓${NC} Installed Specflow skills → $skill_target/"
  done
  REFRESHED_KIT=true
fi
if [ "$REFRESHED_KIT" = false ]; then
  echo -e "${YELLOW}⚠️${NC}  QA kit/scripts not in source (curl install?) — run 'specflow init' from the package to install them"
fi

ADAPTER_POLICY_DIR="$SCRIPT_DIR/templates/adapter-policies"
if [ -d "$ADAPTER_POLICY_DIR" ]; then
  mkdir -p "$TARGET_DIR/.specflow/adapter-policies"
  for policy in "$ADAPTER_POLICY_DIR"/*.yml; do
    [ -f "$policy" ] || continue
    cp "$policy" "$TARGET_DIR/.specflow/adapter-policies/"
    echo -e "${GREEN}✓${NC} Installed .specflow/adapter-policies/$(basename "$policy")"
  done
  prompt_model_routing
else
  echo -e "${YELLOW}⚠️${NC}  Adapter policy templates not found in Specflow source"
fi

echo ""

# ============================================================================
# 5. Install CI workflows (optional)
# ============================================================================

echo -e "${BLUE}[5/6]${NC} CI workflow installation..."

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
for skill_path in \
  ".claude/skills/specflow-loop-selector/SKILL.md" \
  ".codex/skills/specflow-loop-selector/SKILL.md" \
  ".agents/skills/specflow-loop-selector/SKILL.md"; do
  if [ ! -f "$TARGET_DIR/$skill_path" ]; then
    INSTALL_OK=false
  fi
done
if [ ! -f "$TARGET_DIR/AGENTS.md" ] || ! grep -q "Specflow Loop Routing" "$TARGET_DIR/AGENTS.md" 2>/dev/null; then
  INSTALL_OK=false
fi
for policy_path in \
  ".specflow/adapter-policies/claude-code-large-routing.yml" \
  ".specflow/adapter-policies/claude-print.safe.yml" \
  ".specflow/adapter-policies/codex-exec.safe.yml"; do
  if [ ! -f "$TARGET_DIR/$policy_path" ]; then
    INSTALL_OK=false
  fi
done

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
echo "  .claude/skills/specflow-loop-selector - Claude Code loop router"
echo "  .codex/skills/specflow-loop-selector  - Codex loop router"
echo "  .agents/skills/specflow-loop-selector - Generic agent loop router"
echo "  .specflow/adapter-policies/          - Safe Claude/Codex adapter policies"
echo "  AGENTS.md                         - Agent bootstrap instructions"
echo ""
if [ ! -f "$TARGET_DIR/.codex/skills/specflow-loop-selector/SKILL.md" ]; then
  echo -e "${YELLOW}Skill note:${NC} specflow-loop-selector is missing from .codex/skills."
  echo "  If you installed from a raw curl script, run instead:"
  echo "    npx @colmbyrne/specflow init ."
  echo "  Then restart/reload the agent session so project-local skills are indexed."
fi
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
