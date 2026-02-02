# Wave Execution Protocol

This document defines the complete workflow for executing GitHub issues in dependency-ordered waves with full contract compliance, testing, and validation.

**Copy this to your project's `docs/WAVE_EXECUTION_PROTOCOL.md` and customize.**

---

## Quick Start

Tell Claude Code:
```
Execute waves
```

Or with a filter:
```
Execute waves for milestone "v1.0"
Execute waves for label "sprint-3"
Execute issues #50, #51, #52, #53
```

The `waves-controller` agent reads this protocol and handles everything.

---

## The 8 Phases

| Phase | What Happens | Agents Used |
|-------|--------------|-------------|
| 1. Discovery | Fetch issues, build dependency graph, calculate waves | - |
| 2. Contract Generation | Create YAML contracts for each issue | specflow-writer |
| 3. Contract Audit | Validate contracts, run contract tests | contract-validator |
| 4. Implementation | Build migrations, functions, frontend | migration-builder, edge-function-builder, frontend-builder |
| 5. Test Generation | Create Playwright tests from contracts | playwright-from-specflow, journey-tester |
| 6. Test Execution | Run all tests, verify implementation | test-runner, journey-enforcer |
| 7. Issue Closure | Document and close completed issues | ticket-closer |
| 8. Wave Report | Summarize wave, prepare next | - |

---

## Phase 1: Discovery & Priority Analysis

### What Gets Parsed

From each GitHub issue:
- `Depends on #XXX` → dependency relationship
- `Blocks #YYY` → blocking relationship
- Labels → priority weight
- Gherkin scenarios → acceptance criteria
- SQL contracts → database requirements
- `data-testid` → UI test selectors

### Priority Scoring

```
score = label_weight + (blocker_count × 2) + context_bonus + risk_factor

Where:
  label_weight:
    critical     = 10
    priority-high = 7
    priority-medium = 5
    priority-low = 3
    bug          = +3 (cumulative)

  context_bonus:
    +5 if issue relates to files changed in last 5 commits

  risk_factor:
    +3 for database migrations (fail early)
    +2 for edge functions (deployment complexity)
    +0 for UI-only changes
```

### Wave Calculation

```
Wave 1 = issues with ZERO dependencies
Wave 2 = issues blocked ONLY by Wave 1 issues
Wave 3 = issues blocked ONLY by Wave 1 or 2 issues
...continue until all assigned
```

Within each wave, issues are ordered by priority score (highest first).

---

## Phase 2: Contract Generation

For each issue in the wave, generate a YAML contract:

**Input:** GitHub issue with acceptance criteria
**Output:** `docs/contracts/feature_{name}.yml`

Contract must include:
- Feature ID (e.g., `AUTH-001`, `DASH-003`)
- Non-negotiable rules (`rules.non_negotiable`)
- Gherkin scenarios
- `data-testid` requirements
- API contract specifications (if applicable)
- Database schema requirements (if applicable)

**Parallelization:** All contract writers spawn in a single message.

---

## Phase 3: Contract Audit

1. Validate each contract:
   - YAML schema compliance
   - Rule IDs are unique
   - Gherkin syntax valid
   - `data-testid` naming convention followed

2. Run existing contract tests:
   ```bash
   npm test -- contracts
   ```

**Quality Gate:** If ANY validation fails, STOP. Fix before continuing.

---

## Phase 4: Implementation

Execute in dependency order, parallel within wave.

### For Database Changes
```bash
# Create migration
supabase/migrations/{NNN}_{feature}.sql

# Apply
npm run db:migrate
# or
supabase db reset
```

### For Edge Functions
```bash
# Create function
supabase/functions/{name}/index.ts

# Deploy
supabase functions deploy {name}
```

### For Frontend
- Create/update components in `src/`
- Add `data-testid` attributes per contract
- Ensure TypeScript compiles: `npm run type-check`

### Commit Format
```
feat(scope): description (#issue_number)

[detailed changes]

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Quality Gate:** Build must pass. TypeScript must compile.

---

## Phase 5: Test Generation

Generate Playwright tests from contracts:

**Input:** `docs/contracts/feature_{name}.yml`
**Output:** `tests/e2e/{name}.spec.ts`

Tests must cover:
- All Gherkin scenarios from contract
- All `data-testid` selectors
- Database assertions (where applicable)
- API contract validation (where applicable)

For journey contracts, also generate:
- `tests/e2e/journeys/{journey}.journey.spec.ts`

**Parallelization:** All test generators spawn in a single message.

---

## Phase 6: Test Execution

Run sequentially:

```bash
# 1. Build
npm run build

# 2. Contract tests
npm test -- contracts

# 3. E2E tests
npm run test:e2e
# or
npx playwright test

# 4. Journey coverage check
# (journey-enforcer agent)
```

**Quality Gates:**
- Build fails → STOP, fix, retry Phase 4
- Contract tests fail → STOP, fix, retry Phase 4
- E2E tests fail → STOP, fix, retry Phase 4
- Journey coverage low → WARN, continue

---

## Phase 7: Issue Closure

For each issue in the wave:

1. Verify Definition of Done:
   - [ ] All acceptance criteria pass
   - [ ] Contract tests pass
   - [ ] E2E tests pass
   - [ ] `data-testid` attributes added
   - [ ] TypeScript compiles
   - [ ] Database migrations applied (if needed)

2. Comment on GitHub:
   ```markdown
   ## ✅ Implementation Complete

   **Commit:** abc1234
   **Files:**
   - src/features/profile/ProfilePage.tsx
   - tests/e2e/profile.spec.ts
   - docs/contracts/feature_profile.yml

   **Contract:** PROF-001 to PROF-005
   **Tests:** 5 scenarios, all passing

   Closing as complete.
   ```

3. Close issue:
   ```bash
   gh issue close {number}
   ```

---

## Phase 8: Wave Report

```
┌─────────────────────────────────────────────────┐
│ Wave {N} Complete - {X} Issues                  │
├─────────────────────────────────────────────────┤
│ Issues Closed: #50, #51, #53                    │
│ Contracts: 3 generated, 3 audited               │
│ Migrations: 1 applied                           │
│ Tests: 8 Playwright tests created               │
│ Build: PASS ✅                                  │
│ Contract Tests: PASS ✅                         │
│ E2E Tests: PASS ✅ (24/24)                      │
│ Journey Coverage: 87%                           │
├─────────────────────────────────────────────────┤
│ Commits:                                        │
│ - a1b2c3d feat(profile): User profile (#50)    │
│ - e4f5g6h feat(settings): Settings page (#51)  │
│ - i7j8k9l feat(admin): Admin dashboard (#53)   │
├─────────────────────────────────────────────────┤
│ Next: Wave 2 - 2 issues ready                   │
│ Remaining: 5 issues in later waves              │
└─────────────────────────────────────────────────┘
```

If more waves remain → Continue to Phase 2 for next wave
If all issues complete → Output final summary and EXIT

---

## Error Handling

### Circular Dependency
```
STOP: Circular dependency detected

#50 depends on #51
#51 depends on #52
#52 depends on #50

Resolution: Break the cycle by removing one dependency.
```

### Contract Conflict
```
STOP: Contract conflict

New: docs/contracts/feature_profile.yml
Rule: PROF-003 "Avatar must be circular"

Conflicts with: docs/contracts/feature_architecture.yml
Rule: ARCH-015 "All images must be rectangular"

Resolution: Update one contract or create an exception.
```

### Test Failure
```
STOP: E2E test failed

Test: tests/e2e/profile.spec.ts:45
Scenario: "User can view profile"
Error: Element [data-testid='profile-avatar'] not found
Screenshot: test-results/profile-avatar-failure.png

Resolution: Add data-testid to component or fix selector.
```

---

## Customization

### Project-Specific Commands

Update these for your project:

```yaml
# Build
build_command: npm run build

# Type check
typecheck_command: npm run type-check

# Contract tests
contract_test_command: npm test -- contracts

# E2E tests
e2e_test_command: npm run test:e2e

# Database migration
migrate_command: npm run db:migrate

# Function deployment
deploy_function_command: supabase functions deploy
```

### Label Weights

Customize priority scoring:

```yaml
label_weights:
  critical: 10
  priority-high: 7
  priority-medium: 5
  priority-low: 3
  bug: 3  # Added to base weight
  security: 5  # Added to base weight
```

### Quality Thresholds

```yaml
thresholds:
  journey_coverage_minimum: 80  # Percentage
  contract_test_coverage: 100   # Must be 100%
  e2e_test_pass_rate: 100       # Must be 100%
```

---

## File Artifacts

After wave execution, verify these exist:

```
docs/contracts/
  ├── feature_{name}.yml          # Feature contracts
  ├── journey_{name}.yml          # Journey contracts

src/__tests__/contracts/
  ├── {name}.test.ts              # Contract enforcement tests

tests/e2e/
  ├── {name}.spec.ts              # Feature E2E tests
  ├── journeys/
      ├── {journey}.journey.spec.ts  # Journey tests

supabase/migrations/              # If DB changes
  ├── {NNN}_{name}.sql
```

---

## Resuming After Interruption

If execution is interrupted:

```
Resume wave execution

Completed:
- Wave 1: #50, #51 (closed)
- Wave 2: #52 (Phase 4 complete, Phase 5 pending)

Resume from: Phase 5 for #52
Remaining: #53, #54, #55
```

The waves-controller will pick up where it left off.

---

## This Protocol Ensures

1. **Contract compliance** - Every feature has YAML contracts enforced by tests
2. **Dependency ordering** - Issues execute in correct sequence
3. **Parallel execution** - Independent work runs concurrently
4. **Test coverage** - Playwright tests generated from contracts
5. **Verification** - Tests run after every implementation
6. **Traceability** - Commits reference issues, contracts link to tests
7. **Quality gates** - Build/test failures block progression
8. **Documentation** - Contracts serve as living specs
