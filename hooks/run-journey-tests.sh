#!/bin/bash
# Specflow Journey Test Runner
# Runs only tests relevant to issues worked on
#
# Usage: Called by PostToolUse hook after build commands
# Exit 0 = tests passed or skipped
# Exit 2 = tests failed (blocks with error message to model)

set -e
trap 'echo "Hook error at line $LINENO" >&2; exit 2' ERR

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DEFER_FILE="$PROJECT_DIR/.claude/.defer-tests"
DEFER_JOURNAL="$PROJECT_DIR/.claude/.defer-journal"

# Check for global defer flag (legacy, still honored)
if [ -f "$DEFER_FILE" ]; then
    echo "Tests deferred globally. Run 'rm $DEFER_FILE' to re-enable." >&2
    exit 0
fi

# Check per-journey deferrals from .defer-journal
# Format: one J-ID per line (e.g. J-SIGNUP-FLOW)
is_journey_deferred() {
    local journey="$1"
    if [ -f "$DEFER_JOURNAL" ]; then
        grep -qx "$journey" "$DEFER_JOURNAL" 2>/dev/null
    else
        return 1
    fi
}

# Pre-flight: verify gh CLI is installed and authenticated
if ! command -v gh &> /dev/null; then
    echo "Warning: gh CLI not installed. Cannot fetch journey contracts from issues." >&2
    echo "  Install: brew install gh && gh auth login" >&2
    exit 2
fi
if ! gh auth status &> /dev/null; then
    echo "Warning: gh CLI not authenticated. Cannot fetch journey contracts." >&2
    echo "  Run: gh auth login" >&2
    exit 2
fi

# Function to extract issue numbers from recent git commits
get_recent_issues() {
    cd "$PROJECT_DIR"
    # Get issues from last 5 commits
    git log -5 --pretty=format:"%s %b" 2>/dev/null | grep -oE '#[0-9]+' | sort -u | tr -d '#'
}

# Function to get journey contracts from an issue (body + comments)
get_journey_for_issue() {
    local issue_num="$1"
    local body comments all_text

    # Read issue body
    body=$(gh issue view "$issue_num" --json body -q '.body' 2>/dev/null) || {
        echo "  Warning: Could not fetch issue #$issue_num" >&2
        return 0
    }

    # Read issue comments for journey IDs
    comments=$(gh issue view "$issue_num" --json comments -q '.comments[].body' 2>/dev/null) || true

    all_text="$body
$comments"
    echo "$all_text" | grep -oE 'J-[A-Z0-9]+(-[A-Z0-9]+)*' | sort -u | head -5
}

# Function to find test file for a journey ID
# 1. Check contract YAML for explicit test_hooks.e2e_test_file
# 2. Fall back to heuristic naming convention
journey_to_test_file() {
    local journey="$1"

    # Try contract YAML lookup first
    local contract_dirs=("docs/contracts" "contracts" "docs")
    for dir in "${contract_dirs[@]}"; do
        if [ -d "$PROJECT_DIR/$dir" ]; then
            for contract in "$PROJECT_DIR/$dir"/journey_*.yml "$PROJECT_DIR/$dir"/journey_*.yaml; do
                [ -f "$contract" ] || continue
                # Check if this contract defines our journey ID
                if grep -q "id:.*$journey" "$contract" 2>/dev/null; then
                    # Extract e2e_test_file from test_hooks
                    local test_path
                    test_path=$(grep -A1 'test_hooks' "$contract" 2>/dev/null | grep 'e2e_test_file' | sed 's/.*e2e_test_file:[[:space:]]*//' | tr -d '"' | tr -d "'" | xargs)
                    if [ -n "$test_path" ]; then
                        echo "$test_path"
                        return 0
                    fi
                fi
            done
        fi
    done

    # Fallback: heuristic naming convention
    # J-SIGNUP-FLOW -> journey_signup_flow.spec.ts
    local test_name=$(echo "$journey" | sed 's/^J-//' | tr '[:upper:]-' '[:lower:]_')
    echo "tests/e2e/journey_${test_name}.spec.ts"
}

# Detect package manager
get_test_command() {
    if [ -f "$PROJECT_DIR/pnpm-lock.yaml" ]; then
        echo "pnpm test:e2e"
    elif [ -f "$PROJECT_DIR/yarn.lock" ]; then
        echo "yarn test:e2e"
    elif [ -f "$PROJECT_DIR/bun.lockb" ]; then
        echo "bun test:e2e"
    else
        echo "npm run test:e2e"
    fi
}

# Main logic
main() {
    cd "$PROJECT_DIR"

    echo "🔍 Detecting issues worked on..." >&2

    # Get recent issues
    ISSUES=$(get_recent_issues)

    if [ -z "$ISSUES" ]; then
        echo "No issues found in recent commits. Skipping targeted tests." >&2
        exit 0
    fi

    echo "📋 Issues found: $ISSUES" >&2

    # Collect test files to run
    TEST_FILES=""

    for issue in $ISSUES; do
        echo "  Checking #$issue for journey contracts..." >&2

        JOURNEYS=$(get_journey_for_issue "$issue")

        if [ -n "$JOURNEYS" ]; then
            while IFS= read -r JOURNEY; do
                [ -z "$JOURNEY" ] && continue

                # Check per-journey deferral
                if is_journey_deferred "$JOURNEY"; then
                    echo "  ⏭ #$issue → $JOURNEY deferred (in .defer-journal)" >&2
                    continue
                fi

                TEST_FILE=$(journey_to_test_file "$JOURNEY")

                if [ -f "$PROJECT_DIR/$TEST_FILE" ]; then
                    echo "  ✓ #$issue → $JOURNEY → $TEST_FILE" >&2
                    TEST_FILES="$TEST_FILES $TEST_FILE"
                else
                    echo "  ⚠ #$issue → $JOURNEY but test file not found: $TEST_FILE" >&2
                fi
            done <<< "$JOURNEYS"
        else
            echo "  - #$issue: No journey contract found" >&2
        fi
    done

    # Remove duplicates
    TEST_FILES=$(echo "$TEST_FILES" | tr ' ' '\n' | sort -u | tr '\n' ' ' | xargs)

    if [ -z "$TEST_FILES" ]; then
        echo "No journey tests to run for these issues." >&2
        exit 0
    fi

    echo "" >&2
    echo "🧪 Running journey tests: $TEST_FILES" >&2
    echo "" >&2

    # Get the right test command for this project
    TEST_CMD=$(get_test_command)

    # Run the tests
    if $TEST_CMD $TEST_FILES; then
        echo "" >&2
        echo "✅ Journey tests PASSED" >&2
        exit 0
    else
        echo "" >&2
        echo "❌ Journey tests FAILED" >&2
        echo "" >&2
        echo "To defer tests temporarily: touch $DEFER_FILE" >&2
        echo "To run manually: $TEST_CMD $TEST_FILES" >&2
        # Exit 2 to show error to model
        exit 2
    fi
}

main "$@"
