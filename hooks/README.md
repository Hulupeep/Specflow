# Specflow Development Hooks

Claude Code hooks that enforce contracts at three trigger points: **journey tests** after builds/commits, **pipeline compliance** on Write/Edit, and **CI polling** after push.

## What It Does

### Journey verification (build/commit)

After a successful `pnpm build` or `git commit`:

1. **Detects issues** from recent commit messages (`#123`, `#456`)
2. **Looks up journey contracts** in each issue (e.g., `J-SIGNUP-FLOW`)
3. **Maps to test files** (e.g., `tests/e2e/journey_signup_flow.spec.ts`)
4. **Runs only those tests** - not the full suite
5. **Blocks on failure** - shows error to Claude with exit code 2

### Pipeline compliance (Write/Edit)

After every Write or Edit tool use:

1. **Checks the written/edited file** against contract forbidden patterns
2. **Blocks on violation** - shows contract ID and message to model

### CI polling (push)

After `git push`:

1. **Polls GitHub Actions** for the latest workflow run status
2. **Reports pass/fail** (advisory, does not block)

## Requirements

- `gh` CLI installed and authenticated (`gh auth login`)
- `jq` installed (`brew install jq` or `apt install jq`)
- Issues must reference journey contracts in body: `J-FEATURE-NAME`
- Commits must reference issues: `fix: thing (#123)`
- Test files follow naming: `journey_feature_name.spec.ts`

## Quick Install

```bash
# From your project root
bash /path/to/Specflow/install-hooks.sh .

# Or manually
mkdir -p .claude/hooks
cp Specflow/hooks/*.sh .claude/hooks/
cp Specflow/hooks/settings.json .claude/settings.json
chmod +x .claude/hooks/*.sh
```

## Files

| File | Purpose |
|------|---------|
| `settings.json` | Claude Code hook configuration |
| `post-build-check.sh` | Detects build/commit commands, triggers tests |
| `run-journey-tests.sh` | Finds issues → journeys → runs relevant tests |
| `check-pipeline-compliance.sh` | Checks written/edited files against contract patterns |
| `session-start.sh` | SessionStart: prints the re-entry briefing for every non-terminal `.specflow/runs/*` run (durable position, not memory) |
| `model-switch-hook.sh` | PreModelSwitch: blocks a downgrade during top-thinker stages (adversary, persona, B.5) unless it is the routed policy's declared fallback. PostModelSwitch: ledgers every switch as `model_switch` |
| `post-push-ci.sh` | Polls GitHub Actions CI status after push |
| `session-start.sh` | Placeholder (silent) |

## Flow

```
pnpm build (success)
    ↓
PostToolUse hook fires (matcher: Bash)
    ↓
post-build-check.sh
    - Parses JSON input for command
    - Detects "build" or "commit"
    - Calls run-journey-tests.sh
    ↓
run-journey-tests.sh
    - git log -5 → extract #issue numbers
    - gh issue view → find J-XXX journey
    - Convert J-SIGNUP-FLOW → journey_signup_flow.spec.ts
    - Run: pnpm test:e2e <files>
    ↓
Exit 0 (pass) or Exit 2 (fail → show to model)
```

## Deferring Tests

**Per-journey deferral (recommended):** Use `.claude/.defer-journal` to skip specific journeys with a tracking issue. This is scoped and auditable.

```bash
# In .claude/.defer-journal, add:
# J-SIGNUP-FLOW: blocked by auth refactor (#42)
```

**Global deferral (legacy):** Use `.defer-tests` to skip all journey tests temporarily.

```bash
# Defer all tests
touch .claude/.defer-tests

# Re-enable all tests
rm .claude/.defer-tests
```

## Issue Format

For the hook to find journey tests, issues need:

```markdown
## Journey Contract
J-SIGNUP-FLOW (CRITICAL)

## Acceptance Criteria
...
```

The hook extracts `J-SIGNUP-FLOW` and maps it to `tests/e2e/journey_signup_flow.spec.ts`.

## Commit Format

Include issue numbers in commits:

```
feat: add signup validation (#375)
fix: handle edge case (#375, #376)
```

The hook extracts `#375` and `#376` from recent commits.

## Customization

### Different test directory

Edit `run-journey-tests.sh`:
```bash
# Change this line
echo "tests/e2e/journey_${test_name}.spec.ts"
# To your pattern
echo "e2e/journeys/${test_name}.test.ts"
```

### Different test command

The script auto-detects package manager. Override by editing:
```bash
get_test_command() {
    echo "your-custom-test-command"
}
```

### More build commands

Edit `post-build-check.sh`:
```bash
is_build_command() {
    echo "$cmd" | grep -qE '(your|custom|commands)'
}
```

## Troubleshooting

**"No issues found in recent commits"**
- Commits need `#123` format
- Check: `git log -5 --oneline`

**"No journey contract found"**
- Issue body needs `J-FEATURE-NAME`
- Check: `gh issue view 123`

**"Test file not found"**
- Naming mismatch
- J-SIGNUP-FLOW expects `journey_signup_flow.spec.ts`

**Tests not running at all**
- Check hook is registered: `/hooks` in Claude Code
- Check scripts are executable: `ls -la .claude/hooks/`
