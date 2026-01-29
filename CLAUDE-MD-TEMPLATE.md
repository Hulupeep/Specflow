# CLAUDE.md Template for Specflow Projects

**Copy the sections below into your project's CLAUDE.md.** Replace `[PLACEHOLDERS]` with your project-specific values.

This template has two parts:
1. **Core Specflow** (Required) - Contract enforcement rules
2. **Subagent Automation** (Optional) - Parallel execution with agents

---

# ⬇️ PART 1: CORE SPECFLOW (Required) ⬇️

Copy this section for basic contract enforcement.

---

```markdown
# [PROJECT_NAME] - Development Guide

## 🚨 RULE 1: No Ticket = No Code

**ALL work MUST have a GitHub issue before ANY code is written.**

```
NO TICKET → NO CODE
```

### Before Starting ANY Task

1. Check issues: `gh issue list -R [OWNER]/[REPO]`
2. Find or create ticket with acceptance criteria
3. Reference issue in commits: `feat(scope): description (#123)`
4. Link PRs to the issue they close

### Issue Format (Specflow-Compliant)

Every issue MUST have these sections:

```markdown
## Description
Brief description of the work

## DOD Criticality
- [ ] **Critical** - Blocks release if failing
- [ ] **Important** - Should pass before release
- [ ] **Future** - Can release without

## Contract References
- **Feature Contracts:** [ARCH-001, FEAT-002]
- **Journey Contract:** [J-USER-CHECKOUT]

## Acceptance Criteria (Gherkin)
Scenario: [Scenario name]
  Given [precondition]
  When [action]
  Then [expected result]

## data-testid Requirements
| Element | data-testid | Purpose |
|---------|-------------|---------|
| Submit button | `submit-btn` | Form submission |

## E2E Test File
`tests/e2e/[feature].spec.ts`
```

**Quick Checklist** before submitting issues:
- [ ] Has Gherkin acceptance criteria
- [ ] Lists all data-testid selectors
- [ ] References applicable contracts
- [ ] Names the E2E test file

---

## 🚨 RULE 2: Contracts Are Non-Negotiable

This project uses **Specflow contracts** (`docs/contracts/*.yml`) enforced by tests.

**The rule:** Violate a contract → build fails → PR blocked.

### Before Modifying Code

1. Check if file is protected (see table below)
2. Read the contract in `docs/contracts/`
3. Run `npm test -- contracts`
4. Fix any `CONTRACT VIOLATION` errors

### Protected Files

| Files | Contract | Key Rules |
|-------|----------|-----------|
| `src/routes/**` | `feature_architecture.yml` | ARCH-001: Auth required |
| `src/domain/**` | `feature_architecture.yml` | ARCH-002: Zod validation |
| `[ADD YOUR FILES]` | `[CONTRACT]` | `[RULE-ID]: [Description]` |

### Contract Violation Example

```
❌ CONTRACT VIOLATION: AUTH-001
File: src/routes/admin.tsx
Pattern: Missing ProtectedRoute wrapper
See: docs/contracts/feature_architecture.yml
```

### Override Protocol

Only humans can override. User must say:
```
override_contract: [contract_id]
```

Then Claude MUST:
1. Explain what rule is broken and why
2. Warn about consequences
3. Ask if contract should be updated

---

## 🚨 RULE 3: Tests Must Pass Before Closing

Work is NOT complete until tests pass.

### After ANY Code Changes

```bash
# 1. Contract tests (pattern enforcement)
npm test -- contracts

# 2. E2E tests (user journeys)
npm run test:e2e
```

**Do NOT mark work complete if tests fail.**

---

## Active Contracts

### Feature Contracts

| ID | Contract | Description |
|----|----------|-------------|
| ARCH-001 | `feature_architecture.yml` | [Description] |
| [ADD MORE] | `[contract_file]` | [Description] |

### Journey Contracts (Definition of Done)

A feature is DONE when its journeys pass.

#### Critical (MUST pass for release)

| Journey | Description | Test File |
|---------|-------------|-----------|
| `J-USER-LOGIN` | User can log in | `tests/e2e/journey_auth.spec.ts` |
| [ADD MORE] | [Description] | [Test file] |

#### Important (SHOULD pass)

| Journey | Description | Test File |
|---------|-------------|-----------|
| [ADD JOURNEYS] | [Description] | [Test file] |

---

## Contract Locations

| Type | Location |
|------|----------|
| Feature contracts | `docs/contracts/feature_*.yml` |
| Journey contracts | `docs/contracts/journey_*.yml` |
| Contract tests | `src/__tests__/contracts/*.test.ts` |
| E2E tests | `tests/e2e/*.spec.ts` |

---

## Development Commands

```bash
npm test -- contracts    # Contract tests
npm run test:e2e         # Playwright E2E
npm run test:e2e:ui      # Playwright with UI
```
```

---

# ⬆️ END PART 1 ⬆️

---

# ⬇️ PART 2: SUBAGENT AUTOMATION (Optional) ⬇️

**Include this section if you want Claude Code to automatically:**
- Run tests after code changes
- Validate journey coverage before closing tickets
- Execute your backlog in parallel waves

**Skip this section if you prefer manual workflows.**

---

```markdown
---

## Subagent Library

Reusable agents live in `scripts/agents/*.md`. Use Claude Code's Task tool to spawn them.

### Setup

```bash
# Copy agents from Specflow
cp -r Specflow/agents/ scripts/agents/
```

### Agent Registry

| Agent | When to Use |
|-------|-------------|
| `specflow-writer` | New feature needs Gherkin, SQL contracts, acceptance criteria |
| `board-auditor` | Check which issues are specflow-compliant |
| `dependency-mapper` | Extract dependencies, build sprint waves |
| `sprint-executor` | Execute parallel build waves |
| `contract-validator` | Verify implementation matches spec |
| `migration-builder` | Feature needs database schema changes |
| `frontend-builder` | Create React hooks and components |
| `test-runner` | Run tests, report failures with file:line details |
| `journey-enforcer` | Verify journey coverage, release readiness |
| `ticket-closer` | Close validated issues with summaries |

### Auto-Trigger Rules

**Claude MUST use these agents automatically:**

1. **Implementing a feature from GitHub issue:**
   - Run `contract-validator` FIRST
   - Run `migration-builder` if DB changes needed
   - Run `test-runner` after implementation
   - Run `ticket-closer` to close issue

2. **After ANY code changes (MANDATORY):**
   - Run `test-runner`
   - Run `journey-enforcer`
   - Do NOT mark complete if tests fail

3. **User asks to "run tests" or "what's failing":**
   - Run `test-runner`

4. **User asks to "close tickets" or "mark done":**
   - Run `ticket-closer`

### Test Execution Gate

```
Code complete → test-runner → journey-enforcer → ticket-closer
                    ↓                ↓
              if failures      if missing coverage
                    ↓                ↓
              FIX FIRST        ADD JOURNEYS
```

**Claude MUST NOT mark work complete if:**
- Contract tests fail
- E2E tests fail (critical journeys)
- Journey coverage is missing

### Orchestration Pipeline

```
specflow-writer → board-auditor → dependency-mapper
       ↓
sprint-executor → [implementation agents]
       ↓
contract-validator → test-runner → journey-enforcer → ticket-closer
```

### Execute Backlog in Waves

Tell Claude Code:
```
Create tasks to check my GitHub issues with Specflow subagents to be
specflow-compliant. Then create tasks in waves of parallel work based
on dependencies to execute my backlog.
```
```

---

# ⬆️ END PART 2 ⬆️

---

## Customization Checklist

### Part 1 (Core Specflow)
- [ ] Replace `[PROJECT_NAME]` with your project name
- [ ] Replace `[OWNER]/[REPO]` with your GitHub repo
- [ ] Update "Protected Files" table
- [ ] Add contracts to "Active Contracts" section
- [ ] Add journeys to DOD tables

### Part 2 (Subagent Automation)
- [ ] Copy agents: `cp -r Specflow/agents/ scripts/agents/`
- [ ] Review auto-trigger rules for your workflow
- [ ] Customize agent registry if needed

## Enforcement Summary

| Rule | Enforced By | Required |
|------|-------------|----------|
| No ticket, no code | Issue workflow | ✅ Core |
| Contracts | `npm test -- contracts` | ✅ Core |
| Tests before closing | Manual or agent | ✅ Core |
| Auto test execution | `test-runner` agent | ⚡ Optional |
| Auto journey check | `journey-enforcer` agent | ⚡ Optional |
| Parallel waves | `sprint-executor` agent | ⚡ Optional |

## When to Use Each Part

| Scenario | Part 1 | Part 2 |
|----------|--------|--------|
| Small project, manual workflow | ✅ | ❌ |
| Team project with CI | ✅ | Optional |
| Large backlog, want automation | ✅ | ✅ |
| Using Claude Code extensively | ✅ | ✅ |
