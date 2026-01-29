# Specflow Agent Library

## What This Is

These agents make Specflow work with Claude Code's **Task tool as the orchestrator**. They ensure your GitHub issues are specflow-compliant — meaning they have **ARCH**, **FEAT**, and **JOURNEY** contracts that execute as:

1. **Pattern tests at build time** (`npm test -- contracts`) — catches architectural violations
2. **Playwright tests post-build** — verifies user journeys work end-to-end

This three-layer approach reduces architectural drift and ensures work meets Definition of Done.

```
Layer 1: ARCH contracts  → "Components must not call database directly"
Layer 2: FEAT contracts  → "Passwords must be hashed with bcrypt"
Layer 3: JOURNEY contracts → "User can complete checkout flow"
```

---

## The Problem

LLMs drift. You explain a requirement, they build something, and three prompts later they've "optimized" your auth flow into a security hole. They confidently break things while appearing to understand perfectly.

**Traditional fixes don't work:**
- **More instructions?** LLMs attend to what feels salient, not what you emphasize
- **Better prompts?** Works until context window fills and early instructions fade
- **Code review?** You're now the bottleneck, reviewing AI output line by line
- **Unit tests?** Test implementation details, not architectural invariants

## The Solution

**Make requirements executable.** Turn "tokens must be in httpOnly cookies" into a pattern test that fails the build if violated.

```
Spec → YAML Contract → Jest Test → npm test → Build fails on violation
```

The LLM can drift all it wants. The build catches it.

---

## How It Works with Claude Code

Claude Code's Task tool spawns subagents that run independently. You give a high-level goal; Claude Code figures out which agents to call.

**High-level prompt (recommended):**
```
YOU: "Make sure all TODO issues are specflow-compliant with contracts and tests"
     ↓
CLAUDE CODE: [Figures out the right agents, spawns them]
     - board-auditor to check compliance
     - specflow-uplifter to fix gaps
     - contract-generator for YAML contracts
     - contract-test-generator for Jest tests
     - playwright-from-specflow for Playwright tests
     ↓
AGENTS: [Do the work, return results]
     ↓
YOU: [Review, give next direction]
```

**Specific prompt (when you want control):**
```
YOU: "Run contract-generator on issues #12-#18"
```

Both work. High-level for convenience; specific for control. No external orchestrator needed — the parent conversation coordinates; agents do the work.

---

## Your Role (Human)

Two jobs:

### 1. Ensure stories are Specflow-compliant

Before work starts, issues should have:
- **ARCH contracts** — architectural invariants (what must NEVER change)
- **FEAT contracts** — feature requirements with Gherkin scenarios
- **JOURNEY references** — which user flow this enables

Run `board-auditor` to check. Run `specflow-uplifter` to fix gaps.

### 2. Execute with the right agents

Tell Claude Code what to do:

```
"Run specflow-writer on issues #12-#18"
"Generate YAML contracts for these features"
"Execute sprint 0: issues #12, #13, #14"
"Check if we're release-ready"
```

The agents know the patterns. You provide direction.

---

## The 15 Agents

### Writing Specs
| Agent | What it does |
|-------|--------------|
| **specflow-writer** | Turns feature descriptions into build-ready issues with Gherkin, SQL, RLS, TypeScript interfaces, journey references |
| **board-auditor** | Scans issues for compliance; produces a matrix showing what's missing (Ghk, SQL, RLS, TSi, Jrn) |
| **specflow-uplifter** | Fills gaps in partially-compliant issues |

### Generating Contracts
| Agent | What it does |
|-------|--------------|
| **contract-generator** | Creates YAML contracts from specs (`docs/contracts/*.yml`) with `forbidden_patterns` and `required_patterns` |
| **contract-test-generator** | Creates Jest tests from YAML contracts that run at `npm test -- contracts` |

### Planning & Building
| Agent | What it does |
|-------|--------------|
| **dependency-mapper** | Extracts dependencies from SQL REFERENCES and TypeScript imports; builds sprint waves via topological sort |
| **sprint-executor** | Coordinates parallel build waves; pre-assigns migration numbers; dispatches implementation agents |
| **migration-builder** | Creates database migrations from SQL contracts |
| **frontend-builder** | Creates React hooks and components following project patterns |
| **edge-function-builder** | Creates serverless edge functions |

### Testing & Enforcement
| Agent | What it does |
|-------|--------------|
| **contract-validator** | Verifies implemented code matches contracts; produces gap report |
| **journey-enforcer** | Ensures UI stories have journeys; blocks release if critical journeys fail |
| **playwright-from-specflow** | Generates Playwright tests from Gherkin scenarios |
| **journey-tester** | Creates cross-feature E2E journey tests from journey contracts |

### Closing
| Agent | What it does |
|-------|--------------|
| **ticket-closer** | Posts implementation summaries, links commits, closes validated issues |

---

## The Pipeline

```
YOU: "Make issues #X-#Y specflow-compliant"
  │
  ↓
Phase 1: SPECIFICATION
  specflow-writer → board-auditor → specflow-uplifter
  │
  ↓
YOU: "Generate contracts for these issues"
  │
  ↓
Phase 2: CONTRACTS
  contract-generator → contract-test-generator
  │
  ↓
YOU: "Map dependencies and execute the sprint"
  │
  ↓
Phase 3: BUILD
  dependency-mapper → sprint-executor
    ├─ migration-builder (parallel)
    ├─ frontend-builder (parallel)
    └─ edge-function-builder (parallel)
  │
  ↓
  npm test -- contracts ← ARCH/FEAT CONTRACTS ENFORCED
  │
  ↓
Phase 4: VALIDATE
  contract-validator → journey-enforcer
    ├─ playwright-from-specflow (parallel)
    └─ journey-tester (parallel)
  │
  ↓
  npx playwright test ← JOURNEY CONTRACTS ENFORCED
  │
  ↓
YOU: "Close the completed issues"
  │
  ↓
Phase 5: CLOSE
  ticket-closer
```

---

## Who Generates What

| What | Agent | Input | Output |
|------|-------|-------|--------|
| **YAML contracts** | `contract-generator` | Issue specs | `docs/contracts/*.yml` |
| **Jest tests** | `contract-test-generator` | YAML contracts | `src/__tests__/contracts/*.test.ts` |
| **Playwright feature tests** | `playwright-from-specflow` | Gherkin in issues | `tests/e2e/*.spec.ts` |
| **Playwright journey tests** | `journey-tester` | Journey contracts | `tests/e2e/journeys/*.journey.spec.ts` |

**The key insight:** Jest tests enforce YAML contracts (pattern scanning). Playwright tests verify behavior (Gherkin + journeys). Both can be generated before or after implementation.

---

## Three Enforcement Layers

| Layer | Contract Type | When | What it catches |
|-------|---------------|------|-----------------|
| **ARCH** | `feature_architecture.yml` | `npm test` (build) | Structural violations — wrong imports, forbidden patterns |
| **FEAT** | `feature_*.yml` | `npm test` (build) | Feature rule violations — missing validation, wrong auth |
| **JOURNEY** | `journey_*.yml` | Playwright (post-build) | User flow failures — can't complete checkout, broken flow |

**ARCH catches:** `localStorage` in service workers, direct DB calls in components, hardcoded secrets.

**FEAT catches:** Missing input validation, wrong error handling, auth bypass.

**JOURNEY catches:** User can't complete registration, checkout flow broken, data not syncing.

---

## Quick Commands

| Goal | Say this |
|------|----------|
| Make issues spec-ready | "Run specflow-writer on issues #X-#Y" |
| Check compliance | "Run board-auditor on all open issues" |
| Fill spec gaps | "Run specflow-uplifter on issues missing RLS" |
| Generate YAML contracts | "Run contract-generator on issues #X-#Y" |
| Generate Jest tests | "Run contract-test-generator for all contracts" |
| Plan the sprint | "Run dependency-mapper, show me the waves" |
| Build a wave | "Execute sprint 0: issues #A, #B, #C" |
| Validate contracts | "Run contract-validator on the implemented issues" |
| Check release readiness | "Are critical journeys passing?" |
| Close tickets | "Run ticket-closer on issues #X-#Y" |

---

## The Key Insight

**Contracts in tickets ARE the dependency graph.**

A SQL `REFERENCES` clause is a dependency. A TypeScript interface import is a dependency. The `dependency-mapper` agent reads these and builds the sprint order automatically.

No manual linking. No Gantt charts. The code tells us what depends on what.

---

## Adding Agents

Create `agents/{name}.md` with:
- **Role**: What this agent does
- **Trigger**: When to use it
- **Process**: Step-by-step with examples
- **Quality gates**: What must be true when done

See existing agents for the pattern.
