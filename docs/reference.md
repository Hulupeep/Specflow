# Specflow Reference

Commands, file locations, model routing, and success criteria in one place.

[← Back to README](../README.md)

---

## Commands

```bash
# Contract tests
npm test                    # All tests (558 across 14 suites)
npm run test:contracts      # Contract pattern tests (SEC, A11Y, PROD, TEST)
npm run test:hooks          # Hook behaviour tests
npm run test:schema         # Contract YAML schema validation
npm run test:compile        # CSV compile script tests

# Journey tests
npx playwright test         # Run all E2E journey tests

# Scoped runs
npm test -- contracts       # Contract tests only
npm test -- journeys        # Journey tests only

# Setup
bash install-hooks.sh .     # Install Claude Code hooks
./verify-setup.sh           # Check all 10 setup sections

# CSV compilation
npm run compile:journeys -- path/to/journeys.csv
```

## Skill Commands

```
/specflow              Full autonomous loop: spec, contract, test, implement, verify
/specflow verify       Contract validation only against existing contracts
/specflow spec         Generate spec with REQ IDs for current issue or feature
/specflow heal         Run fix loop on failing contract tests
/specflow status       Render full execution dashboard (all 5 visualizations)
/specflow compile      Compile CSV journeys to YAML contracts + Playwright stubs
```

## Agent Commands (say these to Claude Code)

```
Execute waves                     Full backlog execution in dependency-ordered waves
Execute issues #50, #51, #52      Specific issues only
Execute waves for milestone v1.0  By milestone
Run board-auditor                 Audit issue compliance
Run e2e-test-auditor              Find tests that silently pass when broken
Run test-runner                   Execute tests, report failures with details
Run journey-enforcer              Verify journey coverage, release readiness
```

---

## File Locations

```
docs/
  contracts/
    feature_architecture.yml    # Architecture rules
    feature_*.yml               # Feature rules
    journey_*.yml               # User flow DOD
    security_defaults.yml       # SEC-001..005
    accessibility_defaults.yml  # A11Y-001..004
    production_readiness_defaults.yml
    test_integrity_defaults.yml
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
.claude/
  .defer-tests                  # Touch to skip hook-triggered tests
  .defer-ci-check               # Touch to skip CI polling
```

---

## Requirement ID Format

```
AUTH-001 (MUST)   = Non-negotiable rule
AUTH-010 (SHOULD) = Guideline
J-AUTH-LOGIN      = User journey
```

---

## simulation_status Values (Pre-Flight)

```
passed               No CRITICAL findings
passed_with_warnings P1 findings present but acknowledged
blocked              CRITICAL findings unresolved; ticket cannot enter a wave
stale                Ticket or referenced contract updated after last simulation
override:[reason]    Human override applied; wave can proceed
```

---

## Model Routing

Default routing for cost efficiency (~40-60% savings vs running everything on Opus):

| Tier | Agents |
|------|--------|
| **Haiku** | board-auditor, contract-validator, journey-enforcer, test-runner, e2e-test-auditor, ticket-closer |
| **Sonnet** | waves-controller, specflow-writer, specflow-uplifter, contract-generator, contract-test-generator, dependency-mapper, sprint-executor, migration-builder, frontend-builder, edge-function-builder, playwright-from-specflow, journey-tester |
| **Opus** | heal-loop |

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

## Success Criteria

You're doing it right when:

1. ✅ Spec has requirement IDs (`AUTH-001`, `EMAIL-042`)
2. ✅ Contract maps IDs to rules (`AUTH-001` → forbidden patterns)
3. ✅ Test references contract ID (`it('AUTH-001: ...')`)
4. ✅ Intentional violation fails with clear message
5. ✅ CI runs contract tests on every PR

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│ Specflow Quick Reference                                │
├─────────────────────────────────────────────────────────┤
│ Core Loop:                                              │
│   Spec → [Pre-Flight] → Contract → Test → Code → Verify │
│                                                         │
│ Contract Location:                                      │
│   docs/contracts/feature_*.yml   = Pattern rules        │
│   docs/contracts/journey_*.yml   = E2E journeys         │
│                                                         │
│ Test Location:                                          │
│   src/__tests__/contracts/*.test.ts = Contract tests    │
│   tests/e2e/journey_*.spec.ts       = Journey tests     │
│                                                         │
│ Override:                                               │
│   override_contract: <contract_id>  (human only)        │
│   override_preflight: <id> reason: <text>               │
└─────────────────────────────────────────────────────────┘
```

---

## All Documentation

### Core

| Doc | Purpose |
|-----|---------|
| [SPEC-FORMAT.md](../SPEC-FORMAT.md) | How to write specs with `AUTH-001 (MUST)` IDs |
| [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) | YAML schema for contracts |
| [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) | Prompt that makes LLMs follow contracts |
| [CONTRACTS-README.md](../CONTRACTS-README.md) | System overview and philosophy |

### Adoption

| Doc | Purpose |
|-----|---------|
| [QUICKSTART.md](../QUICKSTART.md) | Multiple paths to get started |
| [MID-PROJECT-ADOPTION.md](../MID-PROJECT-ADOPTION.md) | Adding contracts to existing codebases |
| [CI-INTEGRATION.md](../CI-INTEGRATION.md) | GitHub Actions, GitLab, Azure, CircleCI |

### Specialized

| Doc | Purpose |
|-----|---------|
| [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) | E2E journey testing as Definition of Done |
| [CONTRACT-SCHEMA-EXTENSIONS.md](../CONTRACT-SCHEMA-EXTENSIONS.md) | DPAO extensions: anti-patterns, fix patterns |
| [docs/DESIGNER-GUIDE.md](DESIGNER-GUIDE.md) | Designer workflow |
| [docs/MEMORYSPEC.md](MEMORYSPEC.md) | Learning from violations |

### Agentic Execution

| Doc | Purpose |
|-----|---------|
| [agents/README.md](../agents/README.md) | Setup guide and agent library |
| [agents/WORKFLOW.md](../agents/WORKFLOW.md) | Step-by-step walkthrough |
| [agents/waves-controller.md](../agents/waves-controller.md) | Master orchestrator |
| [templates/WAVE_EXECUTION_PROTOCOL.md](../templates/WAVE_EXECUTION_PROTOCOL.md) | Wave execution protocol template |
