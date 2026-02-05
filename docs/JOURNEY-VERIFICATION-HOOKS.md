# Journey Verification Hooks

## Why This Exists

There are two ways to get Claude to run E2E tests:

### Option A: Manual (You Tell Claude)
```
User: "Run the playwright tests"
Claude: [runs tests]
```

**Problem:** You have to remember to ask every time. You'll forget. Production breaks.

### Option B: Automatic (Hooks Tell Claude)
```
[Claude commits code]
[HOOK fires: "Run journey verification"]
Claude: [automatically runs tests without being asked]
```

**Solution:** Hooks make it automatic. Claude runs tests at the right moments without you asking.

---

## The Problem Hooks Solve

**Scenario without hooks:**
1. You implement a feature
2. `pnpm build` passes ✅
3. You say "done"
4. Code deploys to production
5. Production is broken 💥
6. You discover it hours later

**Scenario with hooks:**
1. You implement a feature
2. `pnpm build` passes
3. [HOOK] Claude automatically runs E2E tests
4. Tests fail - Claude reports the issue
5. You fix it BEFORE deploying
6. Production works ✅

---

## Local vs Production: Critical Distinction

### Two Different Test Environments

| Environment | When | URL | Purpose |
|-------------|------|-----|---------|
| **LOCAL** | Before commit | `localhost:3000` | Verify code works locally |
| **PRODUCTION** | After deploy | `https://yourapp.com` | Verify production works |

### The Deploy Pipeline

```
git push → GitHub → Vercel auto-deploys → PRODUCTION CHANGES

                                          ↑
                                    Tests MUST run here
                                    against production URL
```

### When to Run Where

| Trigger | Environment | Why |
|---------|-------------|-----|
| PRE-BUILD | Local | Baseline before changes |
| POST-BUILD | Local | Verify local changes work |
| POST-COMMIT | **PRODUCTION** | Verify deploy didn't break prod |
| POST-MIGRATION | **PRODUCTION** | Verify schema changes work in prod |

**CRITICAL:** After `git push`, tests MUST run against production URL, not localhost.

---

## Mandatory Reporting Requirements

### Never Hide Information

Claude MUST report ALL of the following. No exceptions. No "skipped" without explanation.

### 1. WHERE Tests Ran

```
❌ BAD: "Tests passed"
✅ GOOD: "Tests passed against LOCAL (localhost:5173)"
✅ GOOD: "Tests passed against PRODUCTION (https://www.yourapp.com)"
```

### 2. WHICH Tests Ran

```
❌ BAD: "E2E tests passed"
✅ GOOD: "Ran tests/e2e/auth/signup.spec.ts, tests/e2e/auth/login.spec.ts"
```

### 3. HOW MANY Tests

```
❌ BAD: "Tests passed"
✅ GOOD: "12/12 tests passed (0 failed, 0 skipped)"
```

### 4. What SKIPPED Means

**Skipped tests are NOT passing tests.** They are tests that didn't run.

```
❌ BAD: "10/12 passed, 2 skipped" (sounds fine!)
✅ GOOD: "10/12 passed, 0 failed, 2 SKIPPED
         SKIPPED TESTS (investigate why):
         - signup-with-demo.spec.ts:45 - @skip tag
         - checkout.spec.ts:78 - conditional skip (missing env var)"
```

**Rule:** Every skipped test needs an explanation. "Skipped" is often hiding problems.

### 5. Console Errors

```
❌ BAD: [silently ignores console errors]
✅ GOOD: "Console errors captured:
         - [ERROR] RPC returned 400: column 'org_id' does not exist
         - [HTTP 500] /api/provision failed"
```

---

## Report Template

After EVERY test run, use this format:

```
══════════════════════════════════════════════════════════════
E2E TEST REPORT
══════════════════════════════════════════════════════════════

ENVIRONMENT: LOCAL (localhost:5173)
             or
             PRODUCTION (https://www.yourapp.com)

CONTEXT: Wave 3 (#325, #326, #327)
JOURNEYS: J-USER-SIGNUP, J-USER-CHECKOUT

TESTS RUN:
  - tests/e2e/auth/signup.spec.ts
  - tests/e2e/auth/login.spec.ts
  - tests/e2e/checkout/flow.spec.ts

RESULTS: 18/20 passed, 1 failed, 1 skipped

FAILURES:
  ✗ signup.spec.ts:67 "should create demo org"
    Error: RPC returned 400
    Expected: org created
    Actual: "column 'organization_id' does not exist"

SKIPPED (explain why):
  ⊘ checkout.spec.ts:120 "should process payment"
    Reason: @skip tag - Stripe not configured in test env

CONSOLE ERRORS:
  - [ERROR] column 'organization_id' does not exist
  - [HTTP 400] POST /rest/v1/rpc/provision_demo_org

══════════════════════════════════════════════════════════════
```

---

## Configuration

Add to your CLAUDE.md:

```markdown
## Test Configuration

- **Package Manager:** pnpm
- **Test Command:** `pnpm test:e2e`
- **Test Directory:** `tests/e2e`
- **Local URL:** `http://localhost:5173`
- **Production URL:** `https://www.yourapp.com`
- **Deploy Platform:** Vercel
- **Deploy Wait:** 90 seconds (time for Vercel to deploy after push)
```

---

## Trigger Behavior

### PRE-BUILD (Local)
```bash
# Run against local dev server
pnpm test:e2e
# Report: "LOCAL (localhost:5173): 15/15 passed"
```

### POST-BUILD (Local)
```bash
# Run against local build
pnpm test:e2e
# Report: "LOCAL (localhost:5173): 15/15 passed"
```

### POST-COMMIT (Production)
```bash
# Wait for deploy
sleep 90

# Run against production
PLAYWRIGHT_BASE_URL=https://www.yourapp.com pnpm test:e2e

# Report: "PRODUCTION (https://www.yourapp.com): 15/15 passed"
```

### POST-MIGRATION (Production)
```bash
# Run against production (schema already changed)
PLAYWRIGHT_BASE_URL=https://www.yourapp.com pnpm test:e2e

# Report: "PRODUCTION (https://www.yourapp.com): 15/15 passed"
```

---

## Anti-Patterns to Avoid

### 1. People-Pleasing Reports

```
❌ "Tests mostly passed with a few minor skips"
✅ "12/15 passed, 2 failed, 1 skipped. Here are the failures..."
```

### 2. Hiding Failures Behind "Skipped"

```
❌ "All tests passed (5 skipped)"
✅ "10/15 passed. 5 tests SKIPPED - investigating why:
    - 3 have @skip tags (need removal)
    - 2 failed to initialize (env issue)"
```

### 3. Vague Environment

```
❌ "E2E tests passed"
✅ "E2E tests passed against PRODUCTION (https://www.yourapp.com)"
```

### 4. Missing Test Count

```
❌ "Journey tests passed"
✅ "Journey tests: 8/8 passed (signup.spec.ts, login.spec.ts, ...)"
```

### 5. Ignoring Console Errors

```
❌ [runs tests, ignores console output]
✅ "Tests passed but captured 2 console errors:
    - RPC 400 error (non-blocking but investigate)
    - Deprecation warning (low priority)"
```

---

## Installation

```bash
# From Specflow repo
bash install-hooks.sh /path/to/your/project

# What gets installed:
# .claude/settings.json - hook triggers
# .claude/hooks/journey-verification.md - behavior spec
```

Then add the configuration section to your CLAUDE.md.

---

## Summary

| Without Hooks | With Hooks |
|---------------|------------|
| You ask "run tests" | Tests run automatically |
| You forget, prod breaks | Can't forget, hooks remind |
| Vague "tests passed" | Explicit WHERE/WHAT/HOW MANY |
| Skipped = ignored | Skipped = explained |
| Local only | Local + Production verified |
