#!/bin/bash
# Pipeline compliance checker — runs after Write/Edit tool use
#
# This hook is a REGRESSION DETECTOR, not a state auditor.
# It checks whether the file just written introduces a violation,
# not whether the project has any historical violations.
#
# For full audit, use: npx @colmbyrne/specflow verify
#
# Exit codes:
#   0 — file is unrelated, or compliant
#   2 — the just-written file introduces a violation

set -e

# ─── Read stdin (PostToolUse JSON input) ────────────────────────────────────
# Claude Code provides JSON like: {"inputs": {"file_path": "..."}, ...}
# If invoked without input, exit silently — there is nothing to check.

INPUT=$(cat 2>/dev/null || echo "{}")

if ! command -v jq &> /dev/null; then
    # Without jq we cannot scope the check. Don't false-alarm — exit silently.
    exit 0
fi

FILE_PATH=$(echo "$INPUT" | jq -r '.inputs.file_path // .inputs.path // empty' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
    # No file path in the input — likely a non-file operation. Nothing to check.
    exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Normalize to relative path (strip project dir prefix if absolute)
REL_PATH="${FILE_PATH#$PROJECT_DIR/}"
REL_PATH="${REL_PATH#./}"

# ─── Self-disable when Specflow is not active in this project ───────────────
# A project is "Specflow-active" if it has any of:
#   - docs/contracts/ with content
#   - .specflow/ state directory
#   - scripts/agents/ with agents
#
# If none of these exist, this hook is residue from a previous setup —
# do not enforce a pipeline that does not exist here.

contracts_active=false
if [ -d "$PROJECT_DIR/docs/contracts" ] && [ -n "$(ls -A "$PROJECT_DIR/docs/contracts" 2>/dev/null)" ]; then
    contracts_active=true
fi
specflow_state=false
if [ -d "$PROJECT_DIR/.specflow" ]; then
    specflow_state=true
fi
agents_present=false
if [ -d "$PROJECT_DIR/scripts/agents" ] && [ -n "$(ls -A "$PROJECT_DIR/scripts/agents" 2>/dev/null)" ]; then
    agents_present=true
fi

if [ "$contracts_active" = false ] && [ "$specflow_state" = false ] && [ "$agents_present" = false ]; then
    # Not a Specflow project. Hook is residue. Exit silently.
    exit 0
fi

# ─── Build list of test directories (for finding matching tests) ───────────
TEST_DIRS=("$PROJECT_DIR/tests/e2e")
for subdir in "$PROJECT_DIR"/*/tests/e2e "$PROJECT_DIR"/packages/*/tests/e2e "$PROJECT_DIR"/apps/*/tests/e2e; do
    [ -d "$subdir" ] && TEST_DIRS+=("$subdir")
done
if [ -f "$PROJECT_DIR/.specflow/config.json" ]; then
    extra_dirs=$(jq -r '.e2e_test_dirs[]? // empty' "$PROJECT_DIR/.specflow/config.json" 2>/dev/null)
    while IFS= read -r dir; do
        [ -n "$dir" ] && [ -d "$PROJECT_DIR/$dir" ] && TEST_DIRS+=("$PROJECT_DIR/$dir")
    done <<< "$extra_dirs"
fi

# ─── Helper: detect the project's compile script (or fallback) ──────────────
# If npm run compile:journeys exists, use it. Otherwise tell the user how to
# create the YAML manually instead of pointing at a script that does not exist.

get_compile_command() {
    if [ -f "$PROJECT_DIR/package.json" ] && grep -q '"compile:journeys"' "$PROJECT_DIR/package.json" 2>/dev/null; then
        echo "npm run compile:journeys"
    else
        echo "manually create the contract YAML in docs/contracts/"
    fi
}

# ─── Helper: load legacy test allowlist ────────────────────────────────────
LEGACY_FILE="$PROJECT_DIR/.specflow/legacy-tests.txt"
is_legacy_test() {
    local base="$1"
    [ -f "$LEGACY_FILE" ] && grep -qxF "$base" "$LEGACY_FILE" 2>/dev/null
}

# ─── Helper: find a test file matching a journey base name ─────────────────
find_test_file() {
    local base="$1"
    for dir in "${TEST_DIRS[@]}"; do
        local candidate="$dir/${base}.spec.ts"
        [ -f "$candidate" ] && { echo "$candidate"; return 0; }
    done
    return 1
}

# ─── Scope the check to the file just written ──────────────────────────────
# Only files participating in the journey/contract/CSV pipeline are checked.
# Everything else exits 0 immediately.

VIOLATIONS=()
WARNINGS=()
JOURNEY_BASE=""

case "$REL_PATH" in
    # Journey test file (any test directory)
    tests/e2e/journey_*.spec.ts | */tests/e2e/journey_*.spec.ts)
        BASENAME=$(basename "$REL_PATH")
        JOURNEY_BASE=$(basename "$REL_PATH" .spec.ts)

        # Skip legacy tests
        if is_legacy_test "$BASENAME"; then
            exit 0
        fi

        # The just-written test must have a matching contract YAML
        contract="$PROJECT_DIR/docs/contracts/${JOURNEY_BASE}.yml"
        if [ ! -f "$contract" ]; then
            COMPILE_CMD=$(get_compile_command)
            VIOLATIONS+=("REGRESSION: $REL_PATH was just written but $contract is missing.")
            VIOLATIONS+=("  Fix: $COMPILE_CMD")
            VIOLATIONS+=("  Or:  add $BASENAME to .specflow/legacy-tests.txt to exempt")
        fi
        ;;

    # Journey contract YAML
    docs/contracts/journey_*.yml)
        JOURNEY_BASE=$(basename "$REL_PATH" .yml)

        # Check if a matching test exists anywhere
        # First: contract may declare its test path explicitly
        declared_test=$(grep -A1 'test_hooks' "$PROJECT_DIR/$REL_PATH" 2>/dev/null | grep 'e2e_test_file' | sed 's/.*e2e_test_file:[[:space:]]*//' | tr -d '"' | tr -d "'" | xargs)
        if [ -n "$declared_test" ] && [ -f "$PROJECT_DIR/$declared_test" ]; then
            exit 0
        fi
        if find_test_file "$JOURNEY_BASE" > /dev/null 2>&1; then
            exit 0
        fi

        # No test found — this is a SOFT warning, not a hard fail.
        # The user may be writing the contract first, with the test coming next.
        WARNINGS+=("Contract $REL_PATH has no matching test file yet.")
        WARNINGS+=("  Expected: tests/e2e/${JOURNEY_BASE}.spec.ts (or another test dir)")
        WARNINGS+=("  This is a warning, not an error — create the test next.")
        ;;

    # CSV journey definition
    docs/journeys/*.csv)
        BASENAME=$(basename "$REL_PATH")
        # Skip index/metadata files
        case "$BASENAME" in
            *INDEX* | *index* | *README* | *readme*) exit 0 ;;
        esac

        # Check that some compiled output exists for this CSV
        # (We can't know which contract maps to which CSV without parsing it,
        # so we check that ANY journey contracts exist after the CSV is present.)
        if ! ls "$PROJECT_DIR"/docs/contracts/journey_*.yml 2>/dev/null | head -1 > /dev/null; then
            COMPILE_CMD=$(get_compile_command)
            VIOLATIONS+=("REGRESSION: $REL_PATH was just written but no journey YAMLs have been compiled.")
            VIOLATIONS+=("  Fix: $COMPILE_CMD")
        fi
        ;;

    # Anything else — not part of the journey pipeline. Exit silently.
    *)
        exit 0
        ;;
esac

# ─── Report ────────────────────────────────────────────────────────────────

# Print warnings to stderr but don't fail
if [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "" >&2
    echo "⚠ SPECFLOW WARNING (not blocking):" >&2
    for w in "${WARNINGS[@]}"; do
        echo "  $w" >&2
    done
    echo "" >&2
fi

# Hard violations block with exit 2
if [ ${#VIOLATIONS[@]} -eq 0 ]; then
    exit 0
fi

echo "" >&2
echo "╔═══════════════════════════════════════════════════════════╗" >&2
echo "║  SPECFLOW PIPELINE REGRESSION                            ║" >&2
echo "╚═══════════════════════════════════════════════════════════╝" >&2
echo "" >&2
for v in "${VIOLATIONS[@]}"; do
    echo "  ✗ $v" >&2
done
echo "" >&2
echo "  This is a regression check on the file you just wrote." >&2
echo "  For a full project audit: npx @colmbyrne/specflow verify" >&2
echo "" >&2
exit 2
