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

## 🚨 RULE 3: Mandatory Verification Protocol

### NEVER Claim Work Complete Without Verification

**The Rule:** You MUST run tests and verify BEFORE saying anything is "done."

```
NO PASSING TESTS = NOT DONE
```

### Verification Protocol (NON-NEGOTIABLE)

For EVERY code change, execute this sequence:

#### 1. Run Tests Locally
```bash
npm run lint             # Must pass
npm run build            # Must pass
npm test -- contracts    # Contract tests must pass
npm run test:e2e         # E2E tests must pass
```

#### 2. Check CI Status (if using CI)
```bash
gh run list --limit 1
gh run view <run-id>     # If failed, READ THE LOGS
```

#### 3. For UI Changes - Verify Visually
- Open the app in browser
- Click through changed flows
- Check browser console for errors

### Response Template (Use After Verification)

Only after ALL verification steps pass, respond like this:

```
✅ VERIFIED COMPLETE: [Feature Name]

LOCAL TESTS:
- lint: ✅ PASS
- build: ✅ PASS
- contract tests: ✅ PASS
- e2e tests: ✅ X/Y passing

CHANGES:
- [List of changes]
- Commits: abc123
```

### What NOT To Do

**❌ NEVER say these without running tests:**
- "Done"
- "Complete"
- "Working"
- "Fixed"
- "Tests passing"

**✅ CORRECT phrases BEFORE verification:**
- "Implementation complete, running tests now..."
- "Code pushed, checking CI..."
- "Waiting for test results..."

### Why This Matters

LLMs confidently claim work is complete without verification. This leads to:
- Production outages
- Hours of debugging
- Eroded trust in AI tooling

**Run tests FIRST, report results SECOND.**

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
# Copy agents and protocol template from Specflow
cp -r Specflow/agents/ scripts/agents/
cp Specflow/templates/WAVE_EXECUTION_PROTOCOL.md docs/

# Customize the protocol for your project (optional)
# Edit docs/WAVE_EXECUTION_PROTOCOL.md with your commands and thresholds
```

### Quick Commands

| Goal | Say this |
|------|----------|
| Execute entire backlog | "Execute waves" |
| Execute specific issues | "Execute issues #50, #51, #52" |
| Audit test quality | "Run e2e-test-auditor" |
| Check compliance | "Run board-auditor" |

### Agent Registry

| Agent | When to Use |
|-------|-------------|
| `waves-controller` | **Execute entire backlog** in dependency-ordered waves (MASTER ORCHESTRATOR) |
| `specflow-writer` | New feature needs Gherkin, SQL contracts, acceptance criteria |
| `board-auditor` | Check which issues are specflow-compliant |
| `dependency-mapper` | Extract dependencies, build sprint waves |
| `sprint-executor` | Execute parallel build waves |
| `contract-validator` | Verify implementation matches spec |
| `migration-builder` | Feature needs database schema changes |
| `frontend-builder` | Create React hooks and components |
| `test-runner` | Run tests, report failures with file:line details |
| `e2e-test-auditor` | Find tests that silently pass when broken |
| `journey-enforcer` | Verify journey coverage, release readiness |
| `ticket-closer` | Close validated issues with summaries |

### Auto-Trigger Rules

**Claude MUST use these agents automatically:**

1. **User says "execute waves", "run waves", or "execute backlog":**
   - Run `waves-controller` (orchestrates everything)
   - This handles all 8 phases automatically
   - User just invokes once, agent handles rest

2. **Implementing a feature from GitHub issue:**
   - Run `contract-validator` FIRST
   - Run `migration-builder` if DB changes needed
   - Run `test-runner` after implementation
   - Run `ticket-closer` to close issue

3. **After ANY code changes (MANDATORY):**
   - Run `test-runner`
   - Run `e2e-test-auditor` (check for unreliable tests)
   - Run `journey-enforcer`
   - Do NOT mark complete if tests fail

4. **User asks "why are tests passing but app broken":**
   - Run `e2e-test-auditor`

5. **User asks to "run tests" or "what's failing":**
   - Run `test-runner`

6. **User asks to "close tickets" or "mark done":**
   - Run `ticket-closer`

### Test Execution Gate

```
Code complete → test-runner → e2e-test-auditor → journey-enforcer → ticket-closer
                    ↓               ↓                   ↓
              if failures    if anti-patterns    if missing coverage
                    ↓               ↓                   ↓
              FIX FIRST       FIX TESTS           ADD JOURNEYS
```

**Claude MUST NOT mark work complete if:**
- Contract tests fail
- E2E tests fail (critical journeys)
- E2E tests have anti-patterns (silently passing)
- Journey coverage is missing

### Orchestration Pipeline

**One-command execution (recommended):**
```
"Execute waves" → waves-controller handles all 8 phases
```

**Manual pipeline:**
```
specflow-writer → board-auditor → dependency-mapper
       ↓
sprint-executor → [implementation agents]
       ↓
contract-validator → test-runner → e2e-test-auditor → journey-enforcer → ticket-closer
```

### The 8 Phases (waves-controller)

1. **Discovery** - Fetch issues, build dependency graph, calculate waves
2. **Contract Generation** - specflow-writer creates YAML contracts
3. **Contract Audit** - contract-validator validates contracts
4. **Implementation** - migration-builder, frontend-builder, edge-function-builder
5. **Test Generation** - playwright-from-specflow, journey-tester
6. **Test Execution** - test-runner, e2e-test-auditor, journey-enforcer
7. **Issue Closure** - ticket-closer closes completed issues
8. **Wave Report** - Summary, then next wave or exit

### Execute Backlog in Waves

Tell Claude Code:
```
Execute waves
```

**That's it.** The waves-controller orchestrates everything automatically.
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
