# Specflow Hook Templates

Hook scripts for Claude Code that provide automated feedback during development.

These are **templates** -- copy them to your project's `.claude/hooks/` directory via `install-hooks.sh` or manually.

## Available Hooks

| Hook | Trigger | Blocking | Purpose |
|------|---------|----------|---------|
| `post-build-check.sh` | `pnpm build`, `git commit` | Yes (exit 2) | Detect build/commit and trigger journey tests |
| `run-journey-tests.sh` | Called by post-build-check | Yes (exit 2) | Run Playwright tests for issues in recent commits |
| `session-start.sh` | Session start | No | Placeholder for session initialization |
| `post-push-ci.sh` | `git push` | No (advisory) | Check CI status after push, report pass/fail |

## Installation

### Automated (recommended)

```bash
# From your project root
bash /path/to/Specflow/install-hooks.sh .

# Or via curl
curl -fsSL https://raw.githubusercontent.com/Hulupeep/Specflow/main/install-hooks.sh | bash -s .
```

### Manual

```bash
mkdir -p .claude/hooks
cp /path/to/Specflow/hooks/*.sh .claude/hooks/
cp /path/to/Specflow/templates/hooks/post-push-ci.sh .claude/hooks/
chmod +x .claude/hooks/*.sh
```

Then add hook entries to `.claude/settings.json` (see Settings Configuration below).

## Hook Details

### post-build-check.sh

Fires after any Bash command. Inspects the command to see if it was a build (`npm run build`, `pnpm build`, etc.) or a commit (`git commit`). On success, calls `run-journey-tests.sh`.

- **Input:** JSON on stdin from Claude Code PostToolUse
- **Exit 0:** Continue silently
- **Exit 2:** Show error to model (test failure)

### run-journey-tests.sh

Extracts issue numbers from the last 5 commits, fetches each issue via `gh`, finds journey contract references (`J-SIGNUP-FLOW`), maps them to test files (`journey_signup_flow.spec.ts`), and runs only those tests.

- **Requires:** `gh` CLI, `jq`
- **Defer:** `touch .claude/.defer-tests`

### post-push-ci.sh

Checks GitHub Actions CI status after `git push`. Polls the latest workflow run up to 5 times (10-second intervals) and reports results.

**Output examples:**

```
CI: Passing (build)
```

```
CI: Failed - tests (see: gh run view 12345)

CI failed. Options:
  1. gh run view 12345 --log-failed  (view failure details)
  2. Fix and re-push
  3. Continue (CI is advisory)
```

```
CI: Pending... (build, attempt 3/5, next check in 10s)
```

```
CI: No CI workflows found. Repository may not have CI configured.
```

**Configuration:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SPECFLOW_CI_POLL_INTERVAL` | `10` | Seconds between status polls |
| `SPECFLOW_CI_MAX_RETRIES` | `5` | Maximum number of poll attempts |

**Defer:** `touch .claude/.defer-ci-check`

**Graceful handling of edge cases:**
- `gh` CLI not installed -- warns and skips
- `gh` not authenticated -- warns and skips
- No git remote configured -- warns and skips
- No CI workflows on the repo -- reports and exits cleanly
- Network errors -- warns and exits cleanly
- Timeout (still pending after all retries) -- reports and suggests manual check

### session-start.sh

Placeholder script that runs on session start. Currently a no-op. Extend it to display project status, check dependencies, or load context.

## Settings Configuration

The hooks are registered via `.claude/settings.json`. The `install-hooks.sh` script configures this automatically. For manual setup, ensure your settings include:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-build-check.sh"
          },
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/post-push-ci.sh"
          }
        ]
      }
    ]
  }
}
```

The `post-push-ci.sh` hook fires on every Bash command but only acts when it detects a `git push` was executed. If you prefer to wire it into `post-build-check.sh` (like the build/commit detection), see the integration section below.

## Integrating post-push-ci.sh into post-build-check.sh

If you would rather have a single hook entry point, add push detection to `post-build-check.sh`:

```bash
# Add this function
is_push_command() {
    local cmd="$1"
    echo "$cmd" | grep -qE 'git push'
}

# Add this block alongside the build/commit check
if is_push_command "$COMMAND"; then
    if was_successful; then
        if [ -x "$HOOK_DIR/post-push-ci.sh" ]; then
            "$HOOK_DIR/post-push-ci.sh"
        fi
    fi
fi
```

## Disabling Hooks

### Defer individual hooks

```bash
touch .claude/.defer-tests       # Skip journey tests (build/commit hook)
touch .claude/.defer-ci-check    # Skip CI status check (push hook)
```

### Re-enable

```bash
rm .claude/.defer-tests
rm .claude/.defer-ci-check
```

### Disable all hooks

Remove or rename `.claude/settings.json`:

```bash
mv .claude/settings.json .claude/settings.json.disabled
```
