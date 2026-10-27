#!/bin/bash
# Existing post-build hook. Native case execution, never exit-zero certification.
set -e
trap 'echo "Hook error at line $LINENO" >&2; exit 2' ERR
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
if [ -f "$PROJECT_DIR/.claude/.defer-tests" ]; then
    echo "Tests deferred globally; required verification has NOT run." >&2
    echo '{"status":"deferred","verification":"not_run","scope":"hook continuation only"}'
    exit 0
fi
if ! command -v gh &> /dev/null; then
    echo "Warning: gh CLI not installed. Cannot fetch journey contracts from issues." >&2
    echo "  Install gh and authenticate before retrying required verification." >&2
    exit 2
fi
if ! gh auth status &> /dev/null; then
    echo "Warning: gh CLI not authenticated. Cannot fetch journey contracts." >&2
    echo "  Run: gh auth login" >&2
    exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HELPER="$PROJECT_DIR/scripts/test-execution.cjs"
if [ ! -f "$HELPER" ]; then
    HELPER="$SCRIPT_DIR/../scripts/test-execution.cjs"
fi
if [ ! -f "$HELPER" ]; then
    echo "Native journey helper missing; run specflow update to install scripts/test-execution.cjs and its dependencies." >&2
    exit 2
fi
node "$HELPER" journeys "$PROJECT_DIR" || exit 2
