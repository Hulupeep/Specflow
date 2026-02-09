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

## The 18 Agents

### Orchestration
| Agent | What it does |
|-------|--------------|
| **waves-controller** | Master orchestrator: executes entire backlog in dependency-ordered waves through all 8 phases |

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
| **test-runner** | Executes E2E and contract tests; parses results; reports failures with file:line details |
| **e2e-test-auditor** | Scans tests for anti-patterns that silently mask failures; generates health score and remediation plan |

### Closing
| Agent | What it does |
|-------|--------------|
| **ticket-closer** | Posts implementation summaries, links commits, closes validated issues (requires Tier 1 pass certificate for UI issues) |

### Agent Teams (Requires `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=true`)
| Agent | Team Name | What it does |
|-------|-----------|--------------|
| **journey-gate** | Scathach | Three-scope journey enforcement: Tier 1 (issue), Tier 2 (wave), Tier 3 (regression). Hard gates that block progress. |
| **issue-lifecycle** | *(from pool)* | TEAMMATE that owns full lifecycle of a single GitHub issue: contract -> build -> test -> fix -> close |
| **db-coordinator** | Hamilton | TEAMMATE that manages shared DB resources: migration numbers, table registry, conflict detection |
| **quality-gate** | Keane | TEAMMATE that runs tests on request: contracts, Tier 2 wave gate, Tier 3 regression gate |
| **PROTOCOL** | — | Inter-agent communication protocol: message format, message types, coordination rules |
| **team-names** | — | Mythic Irish naming system: team names, name pools, flavor mapping, completion message templates |

---

## Model Routing

Each agent is routed to the optimal Claude model tier for cost efficiency.
Override per-project in `.specflow/config.json`.

> Inspired by model routing in forge (github.com/ikennaokpala/forge) by Ikenna N. Okpala,
> adapted from the TinyDancer pattern in V3 QE Skill by Mondweep Chakravorty
> (github.com/mondweep/vibe-cast).

### Routing Table

| Agent | Model | Reasoning |
|---|---|---|
| **waves-controller** | `sonnet` | Orchestration logic, spawns others |
| **specflow-writer** | `sonnet` | Complex spec generation (SQL, Gherkin, contracts) |
| **board-auditor** | `haiku` | Reads issues, checks fields exist |
| **specflow-uplifter** | `sonnet` | Gap analysis and spec completion |
| **contract-generator** | `sonnet` | YAML generation from specs |
| **contract-test-generator** | `sonnet` | Test code generation |
| **dependency-mapper** | `sonnet` | Graph analysis |
| **sprint-executor** | `sonnet` | Orchestration logic |
| **migration-builder** | `sonnet` | SQL migration generation |
| **frontend-builder** | `sonnet` | Component generation |
| **edge-function-builder** | `sonnet` | Serverless function generation |
| **contract-validator** | `haiku` | Pattern matching against rules |
| **journey-enforcer** | `haiku` | Coverage percentage checks |
| **playwright-from-specflow** | `sonnet` | Test generation from Gherkin |
| **journey-tester** | `sonnet` | Cross-feature test generation |
| **test-runner** | `haiku` | Runs commands, parses output |
| **e2e-test-auditor** | `haiku` | Pattern scanning for anti-patterns |
| **ticket-closer** | `haiku` | Posts comment, closes issue |
| **heal-loop** | `opus` | Deep reasoning for fix generation |

### Cost Savings

Typical wave (10 agents): ~40-60% token cost reduction vs all-Opus.

### Override

```json
// .specflow/config.json
{
  "model_routing": {
    "default": "sonnet",
    "overrides": {
      "heal-loop": "opus",
      "test-runner": "haiku",
      "ticket-closer": "haiku"
    }
  }
}
```

---

## The Pipeline

### One-Command Execution (Recommended)

```
YOU: "Execute waves"
  │
  ↓
waves-controller (orchestrates all 8 phases automatically)
  │
  ├─ Phase 1: Discovery & dependency mapping
  ├─ Phase 2: Contract generation (specflow-writer)
  ├─ Phase 3: Contract audit (contract-validator)
  ├─ Phase 4: Implementation (migration-builder, frontend-builder, edge-function-builder)
  ├─ Phase 5: Test generation (playwright-from-specflow, journey-tester)
  ├─ Phase 6: Test execution (test-runner, journey-enforcer, e2e-test-auditor)
  ├─ Phase 7: Issue closure (ticket-closer)
  └─ Phase 8: Wave report → next wave or EXIT
```

### Manual Execution (Step-by-Step Control)

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
Phase 5: TEST EXECUTION
  test-runner + e2e-test-auditor
  │
  ├─ npm test -- contracts ← ARCH/FEAT CONTRACTS VERIFIED
  ├─ npx playwright test ← JOURNEY CONTRACTS VERIFIED
  └─ Anti-pattern scan ← TEST RELIABILITY VERIFIED
  │
  ↓
  All tests pass + no anti-patterns? → Continue
  Tests fail or anti-patterns found? → Fix and re-run
  │
  ↓
YOU: "Close the completed issues"
  │
  ↓
Phase 6: CLOSE
  ticket-closer
```

---

## Who Generates What

| What | Agent | Input | Output |
|------|-------|-------|--------|
| **Wave execution** | `waves-controller` | GitHub issues | Complete implementation with tests |
| **YAML contracts** | `contract-generator` | Issue specs | `docs/contracts/*.yml` |
| **Jest tests** | `contract-test-generator` | YAML contracts | `src/__tests__/contracts/*.test.ts` |
| **Playwright feature tests** | `playwright-from-specflow` | Gherkin in issues | `tests/e2e/*.spec.ts` |
| **Playwright journey tests** | `journey-tester` | Journey contracts | `tests/e2e/journeys/*.journey.spec.ts` |
| **Test execution report** | `test-runner` | Test files | Failure report with file:line details |
| **Test quality audit** | `e2e-test-auditor` | Test files | Health score + remediation plan |

**The key insight:** Jest tests enforce YAML contracts (pattern scanning). Playwright tests verify behavior (Gherkin + journeys). Both can be generated before or after implementation. `test-runner` executes them and produces actionable failure reports. `e2e-test-auditor` ensures tests actually fail when features break.

---

## Six Enforcement Layers

| Layer | Contract Type | When | What it catches |
|-------|---------------|------|-----------------|
| **ARCH** | `feature_architecture.yml` | `npm test` (build) | Structural violations — wrong imports, forbidden patterns |
| **SEC** | `security_defaults.yml` | `npm test` (build) | OWASP Top 10 — secrets, injection, XSS, eval, path traversal |
| **A11Y** | `accessibility_defaults.yml` | `npm test` (build) | WCAG AA — missing alt text, labels, focus order |
| **TEST** | `test_integrity_defaults.yml` | `npm test` (build) | No-mock in E2E/journey, silent anti-patterns |
| **FEAT** | `feature_*.yml` | `npm test` (build) | Feature rule violations — missing validation, wrong auth |
| **JOURNEY** | `journey_*.yml` | Playwright (post-build) | User flow failures — can't complete checkout, broken flow |

**SEC catches:** Hardcoded API keys, SQL injection, XSS via innerHTML, eval(), path traversal.

**A11Y catches:** Images without alt, icon buttons without aria-label, inputs without labels.

**TEST catches:** jest.mock in E2E tests, swallowed errors, placeholder tests, unconditional skips.

**ARCH catches:** `localStorage` in service workers, direct DB calls in components, hardcoded secrets.

**FEAT catches:** Missing input validation, wrong error handling, auth bypass.

**JOURNEY catches:** User can't complete registration, checkout flow broken, data not syncing.

**test-runner** executes all three layers and produces actionable failure reports with file:line references.

---

## Quick Commands

| Goal | Say this |
|------|----------|
| **Execute entire backlog** | "Execute waves" |
| **Execute with agent teams** | "Execute waves with agent teams" |
| **Execute specific issues** | "Execute issues #A, #B, #C" |
| **Execute by filter** | "Execute waves for milestone v1.0" |
| **Run journey gate (issue)** | "Run journey gate tier 1 for issue #50" |
| **Run journey gate (wave)** | "Run journey gate tier 2 for issues #50 #51 #52" |
| **Run regression check** | "Run journey gate tier 3" |
| Make issues spec-ready | "Run specflow-writer on issues #X-#Y" |
| Check compliance | "Run board-auditor on all open issues" |
| Fill spec gaps | "Run specflow-uplifter on issues missing RLS" |
| Generate YAML contracts | "Run contract-generator on issues #X-#Y" |
| Generate Jest tests | "Run contract-test-generator for all contracts" |
| Plan the sprint | "Run dependency-mapper, show me the waves" |
| Build a wave | "Execute sprint 0: issues #A, #B, #C" |
| Validate contracts | "Run contract-validator on the implemented issues" |
| Run tests | "Run test-runner" or "Run all tests" |
| Check what's failing | "What tests are failing?" |
| **Audit test quality** | "Run e2e-test-auditor" |
| **Find unreliable tests** | "Why are tests passing but app broken?" |
| Check release readiness | "Are critical journeys passing?" |
| Close tickets | "Run ticket-closer on issues #X-#Y" |

---

## The Key Insight

**Contracts in tickets ARE the dependency graph.**

A SQL `REFERENCES` clause is a dependency. A TypeScript interface import is a dependency. The `dependency-mapper` agent reads these and builds the sprint order automatically.

No manual linking. No Gantt charts. The code tells us what depends on what.

---

## Journey Gates (Three-Tier Enforcement)

| Gate | Scope | Blocks | When |
|------|-------|--------|------|
| Tier 1: Issue | J-* tests from one issue | Issue closure | After implementing issue |
| Tier 2: Wave | All J-* tests from all wave issues | Next wave | After all issues pass Tier 1 |
| Tier 3: Regression | Full E2E suite vs baseline | Merge to main | After wave passes Tier 2 |

Deferrals: `.claude/.defer-journal` (scoped by J-ID with tracking issue).
Baseline: `.specflow/baseline.json` (updated only on clean Tier 3 pass).

## Default Contract Templates

Specflow ships with contract templates in `templates/contracts/`:

| Template | Rules | Default |
|----------|-------|---------|
| `security_defaults.yml` | SEC-001 to SEC-005 | Always enforced |
| `accessibility_defaults.yml` | A11Y-001 to A11Y-004 | Always enforced |
| `test_integrity_defaults.yml` | TEST-001 to TEST-003 | Configurable (no-mock ON for E2E/journey) |

Install to any project:
```bash
cp Specflow/templates/contracts/*.yml docs/contracts/
```

The `specflow-writer` agent references these defaults when generating new contracts.

---

## Adding Agents

Create `agents/{name}.md` with:
- **Role**: What this agent does
- **Trigger**: When to use it
- **Process**: Step-by-step with examples
- **Quality gates**: What must be true when done

See existing agents for the pattern.
