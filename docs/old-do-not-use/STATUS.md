# Specflow Repository Status

**Last Updated:** 2026-01-05
**Status:** Ready for use

---

## How Specflow Works

### The Core Insight

> Models don't read, they pay attention. Prompting expresses intent. Contracts enforce behaviour.
> If you don't turn continuity into code, you'll mistake fluency for truth.

### The Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER INPUTS                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ Markdown Spec          CSV Journeys           Plain English             │
│ AUTH-001 (MUST)...     Steps + Expected       "Our auth uses Redis"     │
└──────────┬─────────────────┬────────────────────────┬───────────────────┘
           │                 │                        │
           ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    LLM GENERATES (using examples)                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Contract YAML          Journey YAML + Tests        CLAUDE.md update     │
│ (CONTRACT-SCHEMA.md)   (Playwright from CSV)       (CLAUDE-MD-TEMPLATE) │
└──────────┬─────────────────┬────────────────────────┬───────────────────┘
           │                 │                        │
           ▼                 ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CI BLOCKS                                     │
│ npm run test:contracts    npm run test:e2e         Future LLMs read     │
│ Pattern violations        Journey failures          CLAUDE.md first     │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Principle

**Contract violations must BLOCK merges, not just warn.**

---

## Repository Structure

```
Specflow/
├── README.md                    # Entry point, quick start
├── SPEC-FORMAT.md               # USER: How to write invariants
├── USER-JOURNEY-CONTRACTS.md    # USER: How to write journeys
├── CONTRACT-SCHEMA.md           # LLM: YAML schema to generate
├── LLM-MASTER-PROMPT.md         # LLM: Workflow to follow
├── CLAUDE-MD-TEMPLATE.md        # LLM: Template for project CLAUDE.md
├── CI-INTEGRATION.md            # CI: How to block on violations
├── MID-PROJECT-ADOPTION.md      # Existing projects
├── examples/
│   ├── contract-example.yml     # LLM: Example contract
│   ├── test-example.test.ts     # LLM: Example test
│   └── user-journeys.csv        # USER: Example journey CSV
├── demo/                        # Proof it works
├── sample_spec/                 # Full working example
└── context/                     # Deep-dive mechanics (reference only)
    ├── MASTER-ORCHESTRATOR.md
    ├── META-INSTRUCTION.md
    ├── SUBAGENT-CONTRACTS.md
    └── SPEC-TO-CONTRACT.md
```

---

## Document Purpose Map

### For Users (Writing Invariants)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| SPEC-FORMAT.md | Write specs with REQ IDs | New features, requirements |
| USER-JOURNEY-CONTRACTS.md | Define user journeys | E2E flows, DOD |
| MID-PROJECT-ADOPTION.md | Add to existing projects | Brownfield adoption |
| examples/user-journeys.csv | CSV journey format | Bulk journey definition |

### For LLMs (Generating Contracts)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| CONTRACT-SCHEMA.md | YAML schema reference | Generating contracts |
| LLM-MASTER-PROMPT.md | Workflow to follow | Every session |
| CLAUDE-MD-TEMPLATE.md | Project CLAUDE.md template | Setting up new project |
| examples/contract-example.yml | Contract example | Reference for generation |
| examples/test-example.test.ts | Test example | Reference for generation |

### For CI/CD

| Document | Purpose | When to Use |
|----------|---------|-------------|
| CI-INTEGRATION.md | CI setup for all platforms | GitHub Actions, GitLab, etc. |

### Context (Deep Understanding)

| Document | Purpose | When to Use |
|----------|---------|-------------|
| context/MASTER-ORCHESTRATOR.md | Full automation approach | Advanced/reference only |
| context/META-INSTRUCTION.md | Infrastructure setup | Reference only |
| context/SUBAGENT-CONTRACTS.md | Claude subagent patterns | Advanced users |
| context/SPEC-TO-CONTRACT.md | Conversion examples | Deep-dive reference |

---

## Component Status

### Core Documentation

| Document | Status | Notes |
|----------|--------|-------|
| README.md | Working | Clear entry point with greenfield/existing paths |
| SPEC-FORMAT.md | Working | REQ ID format well-defined |
| CONTRACT-SCHEMA.md | Working | Complete YAML schema |
| LLM-MASTER-PROMPT.md | Working | Incremental workflow |
| USER-JOURNEY-CONTRACTS.md | Working | Journey + DOD format |
| CLAUDE-MD-TEMPLATE.md | Working | Excellent - tells LLMs what to do |
| CI-INTEGRATION.md | Working | All major CI platforms covered |
| MID-PROJECT-ADOPTION.md | Working | Good for brownfield |

### Examples

| Example | Status | Notes |
|---------|--------|-------|
| examples/contract-example.yml | Working | Real contract example |
| examples/test-example.test.ts | Working | Complete test patterns |
| examples/user-journeys.csv | Working | Proper CSV format |

### Working Demos

| Demo | Status | How to Test |
|------|--------|-------------|
| demo/ | Working | `cd demo && npm run demo` |
| sample_spec/ | Working | Full project structure |

---

## User Journey CSV Format

The `examples/user-journeys.csv` uses this structure:

| Column | Purpose |
|--------|---------|
| Id | Journey identifier (e.g., "1", "2a") |
| Journey | Journey name (e.g., "Journey 1: First-Time User") |
| Statestart | Initial state (e.g., "not signed in", "signed in") |
| User type | User tier (e.g., "free", "pro") |
| Step 1-10 | Sequential user actions |
| Expected results 1-4 | What should happen |

LLM converts this to:
1. Journey contract YAML
2. Playwright E2E tests

---

## Two Entry Points

### Greenfield (New Project)

1. Write spec with REQ IDs (SPEC-FORMAT.md)
2. Write journeys (CSV or markdown)
3. Tell LLM: "Generate contracts using LLM-MASTER-PROMPT.md"
4. LLM creates: contracts/, tests/, updates CLAUDE.md
5. Add to CI (CI-INTEGRATION.md)

### Existing Project

1. Document current behavior in plain English
2. Tell LLM: "Convert to spec format and create freeze contracts"
3. LLM generates:
   - Spec with REQ IDs
   - Contracts that lock current behavior
   - Tests that catch regressions
4. Add to CI

---

## The CLAUDE.md Loop

This is critical for LLM enforcement:

```
Session 1: User defines invariants
              ↓
           LLM generates contracts
              ↓
           LLM updates project CLAUDE.md (using CLAUDE-MD-TEMPLATE.md)
              ↓
Session 2: Fresh LLM reads CLAUDE.md
              ↓
           Sees: "Check contracts before editing protected files"
              ↓
           Reads contract YAML before making changes
              ↓
           Respects constraints OR tests catch violation
```

---

## npm Scripts Pattern

Projects using Specflow should have:

```json
{
  "scripts": {
    "test": "jest",
    "test:contracts": "jest src/__tests__/contracts/",
    "test:e2e": "playwright test",
    "check:contracts": "node scripts/check-contracts.js",
    "verify:contracts": "npm run check:contracts && npm run test:contracts"
  }
}
```

CI runs: `npm run verify:contracts` - blocks merge on failure.

---

## Success Criteria

You're using Specflow correctly when:

1. Spec has REQ IDs: `AUTH-001 (MUST)`, `J-CHECKOUT (Critical)`
2. Contract YAML maps IDs to rules
3. Tests reference REQ IDs: `it('AUTH-001: ...')`
4. CLAUDE.md points to contracts
5. CI blocks on contract violation
6. Future LLMs read CLAUDE.md first

---

## Summary

| What | Who | How |
|------|-----|-----|
| Define invariants | User | SPEC-FORMAT.md, CSV journeys, plain English |
| Generate contracts | LLM | CONTRACT-SCHEMA.md, examples/ |
| Generate tests | LLM | test-example.test.ts pattern |
| Update CLAUDE.md | LLM | CLAUDE-MD-TEMPLATE.md |
| Block violations | CI | CI-INTEGRATION.md |
| Future enforcement | LLM reads CLAUDE.md | Automatic |

**The methodology is sound. The repo is ready for use.**
