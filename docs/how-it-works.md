# How Specflow Works

The mechanics behind contract enforcement, the core loop, and what happens when things break.

[← Back to README](../README.md)

---

## The Core Loop

```
Write spec with IDs → Generate contract → Auto-create test → Violation = Build fails
```

### Step by step

**1. Write a spec with requirement IDs**

```markdown
### AUTH-001 (MUST)
Auth tokens must be stored in httpOnly cookies, never localStorage.
```

**2. Generate a contract**

```yaml
rules:
  non_negotiable:
    - id: AUTH-001
      forbidden_patterns:
        - pattern: /localStorage\.setItem.*token/i
          message: "Tokens must use httpOnly cookies, not localStorage"
```

**3. Generate a test**

```typescript
it('AUTH-001: No localStorage for tokens', () => {
  // Scans source code for violations
  // Fails with: CONTRACT VIOLATION: AUTH-001
})
```

**4. Someone (or an LLM) adds a violation**

```typescript
localStorage.setItem('token', jwt) // Added in iteration 3
```

**5. Test fails → Build fails → PR blocked**

```
❌ CONTRACT VIOLATION: AUTH-001
   File: src/auth.ts:42
   Pattern: localStorage.setItem
   Message: "Tokens must use httpOnly cookies, not localStorage"
```

---

## Two Enforcement Layers

### Contract Tests (fast gate)

Pattern scans run on source code before build. They check:
- **forbidden_patterns**: Must NOT appear in any file in scope
- **required_patterns**: Must appear in at least one file in scope

Violations block CI immediately. No build needed. These are hard gates — always fail, never bypass.

### Journey Tests (authoritative gate)

Playwright runs against your running application after a successful build. Journey tests verify users can accomplish their goals end to end.

```yaml
# Journey contract
journey_id: J-CHECKOUT-FLOW
steps:
  - user_does: "Adds item to cart"
    system_shows: "Cart updates with item"
  - user_does: "Clicks checkout"
    system_shows: "Payment form"
```

Journey tests can be hard-gated in CI or reviewed manually — your choice. See [CI-INTEGRATION.md](../CI-INTEGRATION.md).

### What Each Layer Catches

| Scenario | Unit Tests | Contract Tests | Journey Tests |
|----------|------------|----------------|---------------|
| Function returns correct value | ✅ | — | — |
| Refactor breaks architecture | ❌ | ✅ | — |
| LLM uses wrong API | ❌ | ✅ | — |
| Security pattern violated | ❌ | ✅ | — |
| User journey still works end to end | ❌ | — | ✅ |

---

## Default Gates (Out of the Box)

Copy these into any project for immediate protection:

```bash
cp Specflow/templates/contracts/*.yml docs/contracts/
```

| Template | Rules | What It Catches |
|----------|-------|-----------------|
| `security_defaults.yml` | SEC-001..005 | Hardcoded secrets, SQL injection, XSS via innerHTML, eval(), path traversal |
| `accessibility_defaults.yml` | A11Y-001..004 | Missing alt text, icon buttons without aria-label, unlabelled inputs, broken tab order |
| `production_readiness_defaults.yml` | PROD-001..003 | Demo/mock data in production, placeholder domains, hardcoded UUIDs |
| `test_integrity_defaults.yml` | TEST-001..005 | Mocking in E2E tests, swallowed errors, placeholder tests, suspicious assertions |

All 17 rules are `non_negotiable` by default.

---

## How Builds Are Stopped

Contract tests are regular tests that scan source code. When they find a violation:

```
❌ CONTRACT VIOLATION: AUTH-001
   File: src/auth.ts:42
   Pattern: localStorage.setItem
   Message: "Sessions must use Redis, not localStorage"
```

The test fails → the build fails → the PR is blocked.

### CI integration options

| Approach | How It Works |
|----------|--------------|
| **npm test** | Contract tests run with your regular tests |
| **Separate job** | `npm test -- contracts` as dedicated CI step |
| **Pre-commit hook** | Run contract tests before commits |
| **GitHub Action** | Block PRs on contract violations |

See [CI-INTEGRATION.md](../CI-INTEGRATION.md) for GitHub Actions, GitLab, Azure, and CircleCI examples.

---

## Self-Healing Fix Loops

When contract tests fail during wave execution, the `heal-loop` agent attempts automated fixes before escalating.

**What it can fix:**
- Missing `required_patterns` (e.g. add a missing import)
- `forbidden_patterns` with an `auto_fix` hint in the contract YAML

**What it escalates:**
- Journey test failures, build errors, forbidden patterns without `auto_fix` hints

The heal-loop respects a retry budget (default: 3 attempts). After exhaustion it reverts changes and reports all strategies tried.

Contracts can provide `auto_fix` hints to guide it:

```yaml
auto_fix:
  strategy: "wrap_with"
  wrap_pattern: "router.use(authMiddleware)"
```

Fix patterns are scored by historical success rate and stored in `.specflow/fix-patterns.json`:

| Tier | Confidence | Behaviour |
|------|------------|-----------|
| Platinum | >= 0.95 | Auto-apply immediately |
| Gold | >= 0.85 | Auto-apply, flag in commit for review |
| Silver | >= 0.75 | Suggest only |
| Bronze | < 0.70 | Learning only |

Initialise the fix pattern store:

```bash
mkdir -p .specflow
cp Specflow/templates/fix-patterns.json .specflow/fix-patterns.json
```

See [agents/heal-loop.md](../agents/heal-loop.md) for the full agent specification.

---

## Contract YAML Format

```yaml
contract_meta:
  id: auth_feature
  version: 1
  covers_reqs: [AUTH-001, AUTH-002]

rules:
  non_negotiable:
    - id: AUTH-001
      title: "API endpoints require authMiddleware"
      scope: ["src/routes/**/*.ts"]
      behavior:
        forbidden_patterns:
          - pattern: /router\.(get|post).*\/api\//
            message: "Route missing authMiddleware"
        required_patterns:
          - pattern: /authMiddleware/
            message: "Must use authMiddleware"
```

See [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) for the full schema.

---

→ **Setting up for a team?** See [Team Workflows](team-workflows.md)
→ **Commands and config reference?** See [Reference](reference.md)
