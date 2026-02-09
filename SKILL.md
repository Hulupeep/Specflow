---
name: specflow
description: Spec-driven development with executable contracts
version: 1.0.0
author: Hulupeep
---

# Specflow Skill

Specs that enforce themselves. Turn requirements into contracts that break the build when violated.

## Core Loop

```
Spec --> Contract --> Test --> Code --> Verify
```

1. Write requirements with IDs (AUTH-001 MUST, J-CHECKOUT-001)
2. Generate contract YAML with forbidden/required patterns
3. Generate tests that scan source code for violations
4. Implement code that satisfies contracts
5. Violations = build fails = PR blocked

## When Activated

When this skill is active, Claude Code MUST:

1. **Before modifying any file**: Check if it falls under a contract scope in `docs/contracts/*.yml`. If yes, read the contract and respect all `non_negotiable` rules.
2. **Before closing any work**: Run contract tests (`npm test -- contracts`) and journey tests. Work is not done if tests fail.
3. **When creating new features**: Generate the spec (with REQ IDs), contract YAML, and test files BEFORE implementing code.
4. **When a contract violation is reported**: Read the contract rule, understand why it exists, fix the code to comply. Never work around the test.
5. **Never modify `non_negotiable` rules** unless the user explicitly says `override_contract: <contract_id>`.

---

## Contract Enforcement

### Contract Types

| Type | File Pattern | Enforced By | When |
|------|-------------|-------------|------|
| Architecture | `feature_architecture.yml` | Pattern scan (Jest/Vitest) | Before build |
| Feature | `feature_*.yml` | Pattern scan (Jest/Vitest) | Before build |
| Security | `security_defaults.yml` | Pattern scan | Before build |
| Accessibility | `accessibility_defaults.yml` | Pattern scan | Before build |
| Journey | `journey_*.yml` | Playwright E2E | After build |

### Contract YAML Structure

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
      auto_fix:
        strategy: "add_import"
        import_line: "import { authMiddleware } from '@/middleware/auth'"
```

### Pattern Semantics

- **forbidden_patterns**: Must NOT match in ANY file in scope. If found, violation.
- **required_patterns**: Must match in AT LEAST ONE file in scope. If absent, violation.

### Violation Output Format

```
CONTRACT VIOLATION: AUTH-001 - API route missing authMiddleware
  File: src/routes/users.ts
  Line: 42
  Match: router.get('/api/users', async (req, res) => {
```

### Override Protocol

Only humans can override non-negotiable rules. User must say:

```
override_contract: <contract_id>
```

When overriding: explain what rule is broken, warn about consequences, ask if contract should be updated permanently.

---

## Default Security Gates (SEC-001 to SEC-005)

These patterns are enforced as non-negotiable in all `src/**/*.{ts,js,tsx,jsx}` files (excluding tests).

### SEC-001: No Hardcoded Secrets

```
Forbidden patterns:
  /(password|secret|api_key|apikey|token)\s*[:=]\s*['"][^'"]{8,}['"]/i
  /sk_live_[a-zA-Z0-9]{20,}/
  /sk_test_[a-zA-Z0-9]{20,}/
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----/
  /ghp_[a-zA-Z0-9]{36}/
  /xoxb-[0-9]{10,}-[a-zA-Z0-9]{20,}/
```

Fix: Use `process.env.VAR_NAME` instead.

### SEC-002: No SQL String Concatenation

```
Forbidden patterns:
  /query\s*\(\s*['"`].*\$\{/
  /query\s*\(\s*['"`].*\+\s*\w/
  /execute\s*\(\s*['"`].*\$\{/
```

Fix: Use parameterized queries (`$1`, `$2`).

### SEC-003: No Unsanitized innerHTML

```
Forbidden patterns:
  /dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:(?!\s*(sanitize|DOMPurify|purify))/
  /\.innerHTML\s*=(?!\s*['"`]<)/
```

Fix: Sanitize with DOMPurify before rendering.

### SEC-004: No eval() or Function Constructor

```
Forbidden patterns:
  /\beval\s*\(/
  /new\s+Function\s*\(/
```

Fix: Use JSON.parse or safe alternatives.

### SEC-005: No Path Traversal

```
Forbidden patterns:
  /readFile(Sync)?\s*\(\s*(?!path\.join|path\.resolve|__dirname)/
  /writeFile(Sync)?\s*\(\s*(?!path\.join|path\.resolve|__dirname)/
```

Fix: Use `path.join(__dirname, 'safe-dir', path.basename(input))`.

---

## Default Accessibility Gates (A11Y-001 to A11Y-004)

Enforced in `src/**/*.{tsx,jsx}` files.

### A11Y-001: Images Must Have Alt Text

```
Forbidden: /<img\s+(?![^>]*\balt\s*=)[^>]*\/?>/
```

### A11Y-002: Buttons Must Have Accessible Labels

```
Forbidden: /<button(?![^>]*aria-label)[^>]*>\s*<(?:svg|img|[A-Z]\w*)[^>]*\/?\s*>\s*<\/button>/
```

### A11Y-003: Form Inputs Must Have Labels

```
Forbidden: /<input(?![^>]*(?:aria-label|aria-labelledby|id\s*=))[^>]*>/
```

### A11Y-004: No Positive Tabindex

```
Forbidden: /tabIndex\s*=\s*\{?\s*[1-9]/
```

---

## Agent Behaviors (Condensed)

### Spec Writer

**When**: New feature needs acceptance criteria, Gherkin, and contracts.

**Process**:
1. Understand the domain -- read existing code, schema, and issues
2. Define scope (In Scope / Not In Scope)
3. Design data contracts with complete executable SQL
4. Define invariants (I-DOMAIN-NNN)
5. Generate Gherkin scenarios (happy path, edge cases, error paths)
6. Write acceptance criteria as testable checkboxes
7. Define user journeys for all UI features
8. Create contract YAML and update CONTRACT_INDEX.yml

**Output**: GitHub issue with Gherkin, data contracts, journey reference, and contract YAML files.

### Contract Validator

**When**: After implementation, before closing tickets.

**Process**:
1. Parse ticket sections (scope, data contract, Gherkin, acceptance criteria)
2. Trace code paths for each Given/When/Then step
3. Validate data contracts against actual migrations
4. Check journey coverage for UI-facing issues
5. Verify invariants are enforced (DB constraint, app logic, or both)
6. Generate validation report with PASS / PARTIAL / FAIL status

**Key rule**: Issues with UI but no journey contract are PARTIAL at best, never PASS.

### Test Runner

**When**: After implementation, before closing tickets or creating PRs.

**Process**:
1. Detect test framework (Playwright, Jest, Vitest, Cypress)
2. Run tests with verbose output
3. Parse results, categorize failures (locator, assertion, network, auth, flaky, setup)
4. Map failures to source files with root cause candidates
5. Generate report with summary, failures, skip reasons, and rerun commands

**Mandatory reporting**: WHERE tests ran, WHICH tests, HOW MANY passed/failed, SKIPPED with reasons.

### Self-Healing Fix Loop

**When**: Contract tests fail. Invoked by orchestrator, never by users directly.

**Scope**: Only contract violations with enough YAML context to generate a fix. Never journey tests, build errors, or forbidden patterns without `auto_fix` hints.

**Process**:
1. Parse violation output (rule ID, file, line, matched text)
2. Load contract rule and extract patterns, auto_fix hints, examples
3. Read the violating file and understand context
4. Determine fix strategy from auto_fix or infer from required_patterns
5. Generate minimal fix (smallest possible change)
6. Apply fix and re-run the specific contract test
7. If pass: report and continue. If fail: retry (max 3 attempts)
8. After exhaustion: revert last failed attempt, escalate with all strategies tried

**Fix strategies**: `add_import`, `remove_pattern`, `wrap_with`, `replace_with`

---

## Model Routing

Route tasks to the optimal model tier for cost efficiency (~40-60% savings).

| Tier | Task Types |
|------|-----------|
| **Haiku** | Compliance audits, pattern matching validation, test execution and parsing, coverage checks, issue closing |
| **Sonnet** | Spec generation, contract YAML creation, test code generation, dependency mapping, component building, orchestration |
| **Opus** | Deep fix reasoning (heal-loop), complex architectural analysis |

Override in `.specflow/config.json`:

```json
{
  "model_routing": {
    "default": "sonnet",
    "overrides": {
      "heal-loop": "opus",
      "test-runner": "haiku"
    }
  }
}
```

---

## Quality Gates

All four gates must pass before work is considered complete.

### Gate 1: Contract Tests

```bash
npm test -- contracts
```

Pattern scans source code for forbidden/required patterns. Violations block the build.

### Gate 2: Journey Tests

```bash
npx playwright test
```

E2E tests verify user flows work end-to-end. Critical journeys must pass before release.

### Gate 3: Security Defaults

SEC-001 through SEC-005 scan for OWASP Top 10 patterns. Non-negotiable.

### Gate 4: Accessibility Defaults

A11Y-001 through A11Y-004 scan for WCAG AA violations. Non-negotiable.

### Definition of Done

| Level | Meaning | Release Impact |
|-------|---------|---------------|
| `critical` | Core user flow | Blocks release if failing |
| `important` | Key feature | Should fix before release |
| `future` | Planned feature | Can release without |

Never report "ready for release" if any critical journey is failing or not_tested.

---

## Confidence-Tiered Fix Patterns

Fix patterns are stored in `.specflow/fix-patterns.json` and scored by historical success rate.

| Tier | Confidence | Behavior |
|------|-----------|----------|
| Platinum | >= 0.95 | Auto-apply immediately |
| Gold | >= 0.85 | Auto-apply, flag in commit message for review |
| Silver | >= 0.75 | Suggest only, do not auto-apply |
| Bronze | < 0.70 | Learning only, track for analysis |

**Score rules**: New patterns start at 0.50 (Silver). +0.05 per success, -0.10 per failure. Decay -0.01/week after 90 days unused. Below 0.30: archived.

**Pattern entry format**:

```json
{
  "id": "fix-sec-001-hardcoded-secret",
  "contract_rule": "SEC-001",
  "violation_signature": "Hardcoded secret detected",
  "fix_strategy": "replace_with",
  "fix_template": {
    "find": "const KEY = \"sk_live_...\"",
    "replace_pattern": "const KEY = process.env.STRIPE_SECRET_KEY"
  },
  "confidence": 0.50,
  "tier": "silver"
}
```

---

## Invocation

```
/specflow              Full autonomous loop: spec, contract, test, implement, verify
/specflow verify       Contract validation only against existing contracts
/specflow spec         Generate spec with REQ IDs for current issue or feature
/specflow heal         Run fix loop on failing contract tests
```

### /specflow (Full Loop)

1. Check if `docs/contracts/` exists. If not, create it and install default templates.
2. Read existing specs and contracts for context.
3. For each feature/issue in scope:
   a. Generate REQ IDs from plain English descriptions
   b. Create contract YAML with forbidden/required patterns
   c. Create contract test files
   d. Implement code that satisfies contracts
   e. Run contract tests -- fix violations
   f. Run journey tests if applicable
4. Report: which REQs covered, which journeys pass, DOD status.

### /specflow verify

1. Load all contracts from `docs/contracts/*.yml`
2. For each non_negotiable rule, scan scoped files for pattern violations
3. Report violations with file:line references
4. Report DOD status (critical journeys passing?)

### /specflow spec

1. Interview user about the feature in plain English
2. Generate REQ IDs (AUTH-001, SEC-001, J-CHECKOUT-001)
3. Create contract YAML
4. Create test stubs
5. Output summary of what was created

### /specflow heal

1. Run contract tests, capture failures
2. For each violation:
   a. Parse rule ID, file, line
   b. Read contract YAML for auto_fix hints
   c. Apply minimal fix
   d. Re-test
3. Report: fixed, escalated, or exhausted

---

## Quick Reference

```
Core Loop:        Spec --> Contract --> Test --> Code --> Verify
REQ ID Format:    AUTH-001 (MUST), AUTH-010 (SHOULD), J-AUTH-LOGIN
Contract Files:   docs/contracts/feature_*.yml, journey_*.yml
Test Files:       src/__tests__/contracts/*.test.ts, tests/e2e/*.spec.ts
Commands:         npm test -- contracts, npx playwright test
Override:         override_contract: <contract_id>
```

---

## File Locations

When setting up Specflow in a new project, create this structure:

```
docs/
  contracts/
    feature_architecture.yml    # ARCH rules
    feature_*.yml               # Feature rules
    journey_*.yml               # User flow DOD
    security_defaults.yml       # SEC-001..005
    accessibility_defaults.yml  # A11Y-001..004
    CONTRACT_INDEX.yml          # Central registry
src/
  __tests__/
    contracts/
      *.test.ts                 # Contract pattern tests
tests/
  e2e/
    journey_*.spec.ts           # Playwright journey tests
.specflow/
  config.json                   # Model routing, overrides
  fix-patterns.json             # Fix pattern store
```

---

> Inspired by the single-file skill packaging of [forge](https://github.com/ikennaokpala/forge) by [Ikenna N. Okpala](https://github.com/ikennaokpala).
