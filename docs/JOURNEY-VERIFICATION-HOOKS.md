# Journey Verification Hooks

Claude Code hooks that **automatically run Playwright tests** after builds and commits.

---

## ⚠️ Critical: Commit Message Format

**Hooks only work if commits reference GitHub issues:**

```bash
# ✅ GOOD - hooks find #375 and run its journey tests
git commit -m "feat: add signup validation (#375)"

# ❌ BAD - hooks find nothing, no tests run
git commit -m "feat: add signup validation"
```

---

## How It Works

```
pnpm build (success)
    ↓
PostToolUse hook fires (matcher: Bash)
    ↓
post-build-check.sh detects "build" or "commit"
    ↓
run-journey-tests.sh:
    1. git log -5 → extract #issue numbers
    2. gh issue view → find J-XXX journey contract
    3. Map J-SIGNUP-FLOW → journey_signup_flow.spec.ts
    4. Run: pnpm test:e2e <those files only>
    ↓
Exit 0 (pass) or Exit 2 (fail → blocks with error to Claude)
```

**Key point:** Only tests relevant to the issues you're working on run. Not the full suite.

---

## Installation

```bash
# From your project root
bash Specflow/install-hooks.sh .

# Or manually
mkdir -p .claude/hooks
cp Specflow/hooks/*.sh .claude/hooks/
cp Specflow/hooks/settings.json .claude/settings.json
chmod +x .claude/hooks/*.sh
```

### Requirements

- `gh` CLI installed and authenticated (`gh auth login`)
- `jq` installed (`brew install jq` or `apt install jq`)

---

## Three Things Must Be True

### 1. Commits Reference Issues

```bash
# ✅ Works
git commit -m "feat: add signup validation (#375)"
git commit -m "fix: handle edge case (#375, #376)"

# ❌ Doesn't work
git commit -m "feat: add signup validation"
```

### 2. Issues Have Journey Contracts

Issue body must contain journey reference:

```markdown
## Journey Contract
J-SIGNUP-FLOW (CRITICAL)

## Acceptance Criteria
...
```

The hook extracts `J-SIGNUP-FLOW` using regex: `J-[A-Z0-9-]+`

### 3. Test Files Follow Naming Convention

| Journey Contract | Test File |
|------------------|-----------|
| `J-SIGNUP-FLOW` | `tests/e2e/journey_signup_flow.spec.ts` |
| `J-BILLING-DASHBOARD` | `tests/e2e/journey_billing_dashboard.spec.ts` |
| `J-USER-CHECKOUT` | `tests/e2e/journey_user_checkout.spec.ts` |

**Pattern:** `J-UPPER-CASE` → `journey_lower_case.spec.ts`

---

## Deferring Tests

If tests are slow or you need to skip temporarily:

```bash
# Defer tests (creates flag file)
touch .claude/.defer-tests

# Re-enable tests (removes flag file)
rm .claude/.defer-tests
```

When deferred, hook outputs: `"Tests deferred. Run 'rm .claude/.defer-tests' to re-enable."`

---

## Files Installed

| File | Purpose |
|------|---------|
| `.claude/settings.json` | Claude Code hook configuration |
| `.claude/hooks/post-build-check.sh` | Detects build/commit commands |
| `.claude/hooks/run-journey-tests.sh` | Smart test runner |
| `.claude/hooks/README.md` | Documentation |

---

## Hook Configuration

`.claude/settings.json`:

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
          }
        ]
      }
    ]
  }
}
```

---

## Build Commands Detected

The hook triggers on these commands:

- `npm run build`
- `pnpm build`
- `yarn build`
- `vite build`
- `next build`
- `turbo build`
- `make build`
- `git commit`

---

## Customization

### Different Test Directory

Edit `run-journey-tests.sh`:

```bash
# Change this line
echo "tests/e2e/journey_${test_name}.spec.ts"

# To your pattern
echo "e2e/journeys/${test_name}.test.ts"
```

### Different Test Command

The script auto-detects package manager. Override by editing:

```bash
get_test_command() {
    echo "your-custom-test-command"
}
```

### More Build Commands

Edit `post-build-check.sh`:

```bash
is_build_command() {
    echo "$cmd" | grep -qE '(npm run build|pnpm build|your-command)'
}
```

---

## Troubleshooting

### "No issues found in recent commits"

- Commits need `#123` format
- Check: `git log -5 --oneline`
- Fix: Use `git commit -m "feat: thing (#123)"`

### "No journey contract found"

- Issue body needs `J-FEATURE-NAME`
- Check: `gh issue view 123`
- Fix: Add `J-SIGNUP-FLOW` to issue body

### "Test file not found"

- Naming mismatch
- `J-SIGNUP-FLOW` expects `journey_signup_flow.spec.ts`
- Check: `ls tests/e2e/journey_*.spec.ts`

### Tests not running at all

- Check hook registered: `/hooks` in Claude Code
- Check scripts executable: `ls -la .claude/hooks/`
- Check jq installed: `which jq`
- Check gh authenticated: `gh auth status`

---

## Example Flow

```bash
# 1. Make changes for issue #375 (has J-SIGNUP-FLOW)
# 2. Commit with issue reference
git commit -m "feat: add email validation (#375)"

# 3. Hook automatically runs:
🔍 Detecting issues worked on...
📋 Issues found: 375
  Checking #375 for journey contracts...
  ✓ #375 → J-SIGNUP-FLOW → tests/e2e/journey_signup_flow.spec.ts

🧪 Running journey tests: tests/e2e/journey_signup_flow.spec.ts

  7 passed (28.3s)

✅ Journey tests PASSED
```

---

## Why This Approach?

### Before (Manual)

```
User: "Run the playwright tests"
Claude: [runs ALL tests - slow, noisy]
```

### After (Smart Hooks)

```
[Claude commits code for #375]
[Hook detects #375 → J-SIGNUP-FLOW → journey_signup_flow.spec.ts]
[Runs ONLY that test - fast, targeted]
```

**Benefits:**
- **Fast** - Only relevant tests run
- **Automatic** - No manual "run tests" needed
- **Targeted** - Issue #375 → its journey tests
- **Blocking** - Failures stop the workflow

---

## Summary

| Component | Purpose |
|-----------|---------|
| Commit format | `#issue` numbers enable hook discovery |
| Issue body | `J-XXX` journey contracts define what to test |
| Test naming | `journey_xxx.spec.ts` maps from contracts |
| Hooks | Auto-trigger after build/commit |
| Defer flag | `.claude/.defer-tests` skips when needed |
