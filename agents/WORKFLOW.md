# Specflow Workflow

## What This Is

These agents make Specflow work with Claude Code's **Task tool as the orchestrator**. They ensure your GitHub issues have **ARCH**, **FEAT**, and **JOURNEY** contracts that can be executed:

- **At build time** — Jest pattern tests catch architectural violations (`npm test -- contracts`)
- **Post-build** — Playwright tests verify user journeys work end-to-end

This three-layer approach reduces architectural drift and ensures work meets Definition of Done.

```
ARCH contracts  → Build fails if: forbidden patterns in code
FEAT contracts  → Build fails if: required patterns missing
JOURNEY contracts → Release blocked if: user flows don't work
```

---

## How You Use It

You give Claude Code a high-level goal. It figures out which agents to call.

**High-level prompt:**
```
"Create tasks to make sure all stories in TODO status are specflow-compliant,
that all contracts are created, and every UI story has a journey contract
with Playwright tests."
```

Claude Code will:
1. Run `board-auditor` to check compliance
2. Run `specflow-uplifter` on non-compliant issues
3. Run `contract-generator` to create YAML contracts
4. Run `contract-test-generator` to create Jest tests
5. Run `journey-enforcer` to check journey coverage
6. Run `playwright-from-specflow` and `journey-tester` to create Playwright tests

**You don't need to name agents explicitly.** Just describe what you want. The agents are documented so Claude Code knows when to use each one.

**But you can be specific if you prefer:**
```
"Run board-auditor on issues #42-#48"
"Run journey-tester for J-AUTH-LOGIN"
```

Both approaches work. High-level prompts for convenience; specific commands for control.

---

## Example Session

### Morning: Prep the Sprint

```
YOU: "Run board-auditor on all open issues labeled 'feature'"

CLAUDE: [Spawns board-auditor agent via Task tool]

AGENT RETURNS:
  Compliance Matrix:
  #42 User Profile      Ghk=Y SQL=Y RLS=N TSi=Y Jrn=N  → Partial
  #43 Settings Page     Ghk=Y SQL=Y RLS=Y TSi=Y Jrn=N  → Partial
  #44 Password Reset    Ghk=N SQL=Y RLS=Y TSi=N Jrn=N  → Partial

  3 issues need work before sprint.

YOU: "Run specflow-uplifter on #42, #43, #44 — add missing sections"

CLAUDE: [Spawns 3 specflow-uplifter agents in parallel]

AGENTS RETURN:
  #42: Added RLS policy, added J-USR-PROFILE journey reference
  #43: Added J-USR-SETTINGS journey reference
  #44: Added Gherkin scenarios, TypeScript interface, journey reference
```

### Mid-Morning: Generate Contracts and Tests

```
YOU: "Generate all contracts and tests for the user management features"

CLAUDE: [Figures out which agents to call, spawns them]

  1. contract-generator → Creates YAML contracts from issue specs:
     - docs/contracts/feature_architecture.yml (ARCH-001, ARCH-002)
     - docs/contracts/feature_user_management.yml (USR-001, USR-002, USR-003)
     - docs/contracts/journey_user_profile.yml (J-USR-PROFILE)

  2. contract-test-generator → Creates Jest tests from YAML:
     - src/__tests__/contracts/architecture.test.ts
     - src/__tests__/contracts/user_management.test.ts

  3. playwright-from-specflow → Creates Playwright tests from Gherkin:
     - tests/e2e/user-profile.spec.ts
     - tests/e2e/settings.spec.ts

  4. journey-tester → Creates journey tests from journey contracts:
     - tests/e2e/journeys/user-profile.journey.spec.ts

AGENT RETURNS:
  Created:
  - 3 YAML contracts (ARCH, FEAT, JOURNEY)
  - 2 Jest test files (run at: npm test -- contracts)
  - 3 Playwright test files (run at: npx playwright test)
```

Or be specific if you prefer:
```
YOU: "Run contract-generator on #42-#44, then contract-test-generator"
```

### Afternoon: Build

```
YOU: "Map dependencies and show me the sprint waves"

CLAUDE: [Spawns dependency-mapper agent]

AGENT RETURNS:
  Wave 0 (no dependencies): #44 (password reset - standalone)
  Wave 1 (depends on #44): #42 (user profile), #43 (settings page)

YOU: "Execute wave 0, then wave 1. Last migration was 015."

CLAUDE: [Spawns sprint-executor, which dispatches:]
  Wave 0:
    - migration-builder for #44 → creates 016_password_reset.sql

  Wave 1 (after 0 completes):
    - migration-builder for #42 → creates 017_user_profile.sql
    - migration-builder for #43 → creates 018_settings.sql
    - frontend-builder for #42 → creates useProfile hook
    - frontend-builder for #43 → creates useSettings hook

BUILD: npm test -- contracts
  ✓ ARCH-001: No direct DB calls in components
  ✓ ARCH-002: Auth context required
  ✓ USR-001: Profile data validation
  ✓ USR-002: Settings access control
  ✓ USR-003: Password requirements enforced
```

### End of Day: Validate & Close

```
YOU: "Validate and check release readiness"

CLAUDE: [Spawns contract-validator, then journey-enforcer]

RETURNS:
  ARCH/FEAT Contracts: All satisfied
  Critical Journeys:
  - J-USR-PROFILE: ✓ passing
  - J-AUTH-LOGIN: ✓ passing
  - J-CHECKOUT-FLOW: ⚠️ no test

  Status: NOT READY (1 critical journey untested)

YOU: "Generate the checkout journey test"

CLAUDE: [Spawns journey-tester agent]

YOU: "Now close #42, #43, #44"

CLAUDE: [Spawns ticket-closer agent]
```

---

## Who Generates What (And When)

| What | Agent | Input | Output | When to Run |
|------|-------|-------|--------|-------------|
| **YAML contracts** | `contract-generator` | Issue specs (Gherkin, SQL, journeys) | `docs/contracts/*.yml` | After issues are specflow-compliant |
| **Jest pattern tests** | `contract-test-generator` | YAML contracts | `src/__tests__/contracts/*.test.ts` | After YAML contracts exist |
| **Playwright feature tests** | `playwright-from-specflow` | Gherkin scenarios in issues | `tests/e2e/*.spec.ts` | After implementation or alongside |
| **Playwright journey tests** | `journey-tester` | Journey contracts in issues/epics | `tests/e2e/journeys/*.journey.spec.ts` | After implementation or alongside |

**The flow:**
```
Issues with specs → YAML contracts → Jest tests → BUILD
                                   ↘
                    Gherkin/Journeys → Playwright tests → POST-BUILD
```

**Key insight:** Jest tests come from YAML contracts. Playwright tests come from issue content (Gherkin + journeys). Both can be generated before or after implementation — they test what SHOULD happen, not what currently exists.

---

## The Three Layers

| Layer | What It Enforces | When It Runs | Failure Mode |
|-------|------------------|--------------|--------------|
| **ARCH** | Structural invariants | `npm test` | Build fails |
| **FEAT** | Feature requirements | `npm test` | Build fails |
| **JOURNEY** | User flows work | Playwright | Release blocked |

**Example ARCH contract:**
```yaml
- id: ARCH-001
  forbidden_patterns:
    - pattern: /supabase\.(from|rpc)/
      message: "Components must use hooks, not direct DB calls"
  scope: ["src/components/**/*.tsx"]
```

**Example FEAT contract:**
```yaml
- id: USR-002
  required_patterns:
    - pattern: /validatePassword/
      message: "Password validation required"
  scope: ["src/features/auth/**/*.ts"]
```

**Example JOURNEY contract:**
```yaml
journey_meta:
  id: J-USR-PROFILE
  dod_criticality: critical
steps:
  - name: "User updates profile"
    required_elements:
      - selector: "[data-testid='profile-form']"
```

---

## The Pattern

Every interaction:

```
YOU: [Direction] "Do X on issues Y"
     ↓
CLAUDE: [Spawns appropriate agent(s) via Task tool]
     ↓
AGENT: [Does work, returns result]
     ↓
YOU: [Review, next direction]
```

You're directing traffic, not writing code.

---

## When Things Go Wrong

**ARCH violation (build fails):**
```
CONTRACT VIOLATION: ARCH-001 - direct DB call in component
  src/components/UserCard.tsx:42 - "supabase.from('users')"
```
→ "Fix the violation — use a hook instead of direct call"

**FEAT violation (build fails):**
```
CONTRACT VIOLATION: USR-003 - password validation missing
  src/features/auth/hooks/usePasswordReset.ts:42
```
→ "Add password validation to usePasswordReset"

**JOURNEY violation (release blocked):**
```
Step 3: Profile updated successfully → FAILED
  Element not found: success-message
```
→ "The success message isn't showing. Check the mutation response."

**Issue missing specs:**
```
#56 Export Feature - Non-compliant (missing: Gherkin, SQL)
```
→ "Run specflow-writer on #56"

---

## Checklist

**Before sprint:**
- [ ] All issues have Gherkin, SQL, RLS, TypeScript, journey refs
- [ ] YAML contracts generated (ARCH, FEAT, JOURNEY)
- [ ] Jest tests generated for ARCH/FEAT contracts
- [ ] Dependencies mapped into sprint waves

**Before release:**
- [ ] `npm test -- contracts` passes (ARCH + FEAT)
- [ ] All critical journey tests exist and pass

---

## The Magic

You never write specs by hand. Agents generate them.
You never write contracts by hand. Agents generate them.
You never write tests by hand. Agents generate them.
You never track dependencies by hand. SQL REFERENCES tells us.

You point. Agents work. Build catches mistakes. Release blocked if journeys fail.
