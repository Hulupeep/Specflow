#!/bin/bash
# Specflow CI Feedback Loop - Post-Push Hook
# Checks CI status after git push and reports results
#
# Usage: Called by PostToolUse hook after git push commands
#        Can also be run standalone: bash post-push-ci.sh
#
# Exit 0 always (advisory, not blocking)
#
# Configuration (environment variables):
#   SPECFLOW_CI_POLL_INTERVAL  - Seconds between polls (default: 10)
#   SPECFLOW_CI_MAX_RETRIES    - Maximum poll attempts (default: 5)
#
# Defer: touch .claude/.defer-ci-check

set -o pipefail

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

POLL_INTERVAL="${SPECFLOW_CI_POLL_INTERVAL:-10}"
MAX_RETRIES="${SPECFLOW_CI_MAX_RETRIES:-5}"

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
DEFER_FILE="$PROJECT_DIR/.claude/.defer-ci-check"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------

info()  { echo "CI: $*" >&2; }
warn()  { echo "CI: [warn] $*" >&2; }
fail()  { echo "CI: [error] $*" >&2; }

# ---------------------------------------------------------------------------
# Pre-flight checks
# ---------------------------------------------------------------------------

# Check defer flag
if [ -f "$DEFER_FILE" ]; then
    info "CI check deferred. Remove $DEFER_FILE to re-enable."
    exit 0
fi

# Check gh CLI is available
if ! command -v gh >/dev/null 2>&1; then
    warn "gh CLI not found. Install with: brew install gh (mac) or apt install gh (linux)"
    warn "Skipping CI status check."
    exit 0
fi

# Check gh authentication
if ! gh auth status >/dev/null 2>&1; then
    warn "gh CLI not authenticated. Run: gh auth login"
    warn "Skipping CI status check."
    exit 0
fi

# Check we are in a git repo
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Not inside a git repository. Skipping CI check."
    exit 0
fi

# Check remote exists
if ! git remote get-url origin >/dev/null 2>&1; then
    warn "No git remote 'origin' configured. Skipping CI check."
    exit 0
fi

# ---------------------------------------------------------------------------
# CI status polling
# ---------------------------------------------------------------------------

get_latest_run() {
    # Returns JSON: status, conclusion, url, name, databaseId
    gh run list --limit 1 --json status,conclusion,url,name,databaseId 2>/dev/null
}

parse_run_field() {
    local json="$1"
    local field="$2"
    echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}

parse_run_id() {
    local json="$1"
    echo "$json" | grep -o '"databaseId":[0-9]*' | head -1 | cut -d: -f2
}

display_result() {
    local status="$1"
    local conclusion="$2"
    local name="$3"
    local run_id="$4"
    local url="$5"

    if [ "$status" = "completed" ]; then
        if [ "$conclusion" = "success" ]; then
            info "Passing ($name)"
        elif [ "$conclusion" = "failure" ]; then
            info "Failed - $name (see: gh run view $run_id)"
            echo "" >&2
            echo "CI failed. Options:" >&2
            echo "  1. gh run view $run_id --log-failed  (view failure details)" >&2
            echo "  2. Fix and re-push" >&2
            echo "  3. Continue (CI is advisory)" >&2
            echo "" >&2
        elif [ "$conclusion" = "cancelled" ]; then
            info "Cancelled - $name (run $run_id)"
        else
            info "Completed with conclusion: $conclusion - $name (run $run_id)"
        fi
    elif [ "$status" = "in_progress" ] || [ "$status" = "queued" ] || [ "$status" = "waiting" ] || [ "$status" = "pending" ]; then
        info "Pending... ($name, waiting for completion)"
    else
        info "Status: $status - $name (run $run_id)"
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

main() {
    info "Checking CI status..."

    # First check: is there any workflow at all?
    RUN_JSON=$(get_latest_run)

    if [ -z "$RUN_JSON" ] || [ "$RUN_JSON" = "[]" ]; then
        info "No CI workflows found. Repository may not have CI configured."
        exit 0
    fi

    # Poll loop
    local attempt=0
    while [ "$attempt" -lt "$MAX_RETRIES" ]; do
        attempt=$((attempt + 1))

        RUN_JSON=$(get_latest_run)

        if [ -z "$RUN_JSON" ] || [ "$RUN_JSON" = "[]" ]; then
            warn "Could not fetch CI run status."
            exit 0
        fi

        STATUS=$(parse_run_field "$RUN_JSON" "status")
        CONCLUSION=$(parse_run_field "$RUN_JSON" "conclusion")
        NAME=$(parse_run_field "$RUN_JSON" "name")
        URL=$(parse_run_field "$RUN_JSON" "url")
        RUN_ID=$(parse_run_id "$RUN_JSON")

        # If completed, display and exit
        if [ "$STATUS" = "completed" ]; then
            display_result "$STATUS" "$CONCLUSION" "$NAME" "$RUN_ID" "$URL"
            exit 0
        fi

        # Still running -- show pending status and wait
        if [ "$attempt" -lt "$MAX_RETRIES" ]; then
            info "Pending... ($NAME, attempt $attempt/$MAX_RETRIES, next check in ${POLL_INTERVAL}s)"
            sleep "$POLL_INTERVAL"
        fi
    done

    # Exhausted retries -- still pending
    info "Still pending after $MAX_RETRIES checks ($((MAX_RETRIES * POLL_INTERVAL))s). Check manually:"
    info "  gh run view $RUN_ID"
    if [ -n "$URL" ]; then
        info "  $URL"
    fi
    exit 0
}

# ---------------------------------------------------------------------------
# Command detection (PostToolUse hook integration)
# ---------------------------------------------------------------------------

is_push_command() {
    local cmd="$1"
    echo "$cmd" | grep -qE 'git\s+push'
}

was_successful() {
    local input="$1"
    local exit_code
    exit_code=$(echo "$input" | grep -o '"exit_code":[0-9]*' | head -1 | cut -d: -f2)
    if [ -z "$exit_code" ]; then
        exit_code=$(echo "$input" | grep -o '"exitCode":[0-9]*' | head -1 | cut -d: -f2)
    fi
    [ "$exit_code" = "0" ] || [ -z "$exit_code" ]
}

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

# When called from PostToolUse hook, input arrives on stdin as JSON.
# When run standalone (terminal is a tty), skip command detection.
if [ ! -t 0 ]; then
    INPUT=$(cat 2>/dev/null || true)

    # Extract the command that was run
    COMMAND=$(echo "$INPUT" | grep -o '"command":"[^"]*"' | head -1 | cut -d'"' -f4)

    if [ -z "$COMMAND" ]; then
        # No command found in input -- not a PostToolUse call we care about
        exit 0
    fi

    # Only act on git push commands
    if ! is_push_command "$COMMAND"; then
        exit 0
    fi

    # Only act on successful pushes
    if ! was_successful "$INPUT"; then
        exit 0
    fi
fi

main "$@"
