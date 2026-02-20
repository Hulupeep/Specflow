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

# Check for defer flag
if [ -f "$DEFER_FILE" ]; then
    echo "Tests deferred. Run 'rm $DEFER_FILE' to re-enable." >&2
    exit 0
fi

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

# Function to get journey contracts from an issue
get_journey_for_issue() {
    local issue_num="$1"
    local body
    body=$(gh issue view "$issue_num" --json body -q '.body' 2>&1) || {
        echo "  Warning: Could not fetch issue #$issue_num" >&2
        return 0
    }
    echo "$body" | grep -oE 'J-[A-Z0-9]+(-[A-Z0-9]+)*' | head -1
}

# Function to convert journey ID to test file
journey_to_test_file() {
    local journey="$1"
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

        JOURNEY=$(get_journey_for_issue "$issue")

        if [ -n "$JOURNEY" ]; then
            TEST_FILE=$(journey_to_test_file "$JOURNEY")

            if [ -f "$PROJECT_DIR/$TEST_FILE" ]; then
                echo "  ✓ #$issue → $JOURNEY → $TEST_FILE" >&2
                TEST_FILES="$TEST_FILES $TEST_FILE"
            else
                echo "  ⚠ #$issue → $JOURNEY but test file not found: $TEST_FILE" >&2
            fi
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
