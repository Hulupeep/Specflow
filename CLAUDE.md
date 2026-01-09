# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What Is Specflow?

Specflow is a methodology for building software with LLMs that doesn't drift.

**The problem:** You build with an LLM. It works. You iterate. Slowly, the code drifts from your original intent. Unit tests pass, but architectural rules get violated.

**The solution:** Write specs with requirement IDs → Generate contracts → Auto-create tests → Violations fail the build.

## The Formula

```
Architecture + Features + Journeys = The Product
```

| Layer | What It Defines | Example |
|-------|-----------------|---------|
| **ARCH** | Structural invariants | "No payment data in localStorage" |
| **FEAT** | Product capabilities | "Queue orders by FIFO" |
| **JOURNEY** | User accomplishments (DOD) | "User can complete checkout" |

**Skip any layer → ship blind.** Define all three → contracts enforce them.

## Repository Structure

```
Specflow/
├── README.md                    # Start here
├── QUICKSTART.md               # Choose your path
├── CONTRACTS-README.md         # System overview
├── SPEC-FORMAT.md              # How to write specs
├── CONTRACT-SCHEMA.md          # YAML contract format
├── LLM-MASTER-PROMPT.md        # Prompt for LLMs
├── demo/                       # Working example (run this!)
├── blog/                       # QueueCraft dev blog
├── docs/
│   ├── DESIGNER-GUIDE.md       # Designer workflow
│   ├── MEMORYSPEC.md           # ruvector integration
│   ├── LIVE-DEMO-SCRIPT.md     # Presentation script
│   └── AGENTIC-FOUNDATIONS-DECK.md  # 7-slide deck
└── examples/                   # Contract and test templates
```

## Live Demo (Guaranteed to Work)

The demo proves Specflow catches what unit tests miss.

### Quick Run (2 min)
```bash
cd demo
npm install
npm run demo    # Automated walkthrough
```

### Manual Demo (for presentations)

**1. Setup:**
```bash
cd demo
npm install
npm run demo:reset
```

**2. Show baseline (safe state):**
```bash
npm run test:unit      # ✅ 4 passing
npm run test:contracts # ✅ 1 passing
```

**3. Introduce the violation:**
```bash
cp states/trap.js src/auth.js
```

**4. Unit tests still pass:**
```bash
npm run test:unit      # ✅ 4 passing (!)
```

**5. Contract catches it:**
```bash
npm run test:contracts # ❌ CONTRACT VIOLATION: AUTH-001
```

**6. Reset:**
```bash
npm run demo:reset
```

### The Invariant

| ID | Rule | Violation |
|----|------|-----------|
| AUTH-001 | Sessions must use store with TTL | `localStorage` used instead |

Unit tests verify behavior (they pass). Contracts verify architecture (they catch it).

## Key Concepts

### Requirement IDs
- Format: `[FEATURE]-[NUMBER]` (e.g., `AUTH-001`, `EMAIL-042`)
- Tags: `(MUST)` = non-negotiable, `(SHOULD)` = guideline
- Each REQ maps to exactly one contract rule

### Contract Rules
- `rules.non_negotiable`: MUST requirements - build fails if violated
- `rules.soft`: SHOULD requirements - guidelines, not enforced
- `forbidden_patterns`: Regex patterns that must NOT appear in code
- `required_patterns`: Regex patterns that MUST appear in code

## LLM Behavior Rules

When modifying this repo or using its methodology:

1. **Do NOT modify protected code without checking contracts first**
2. **Do NOT change `non_negotiable` rules unless user says `override_contract: <id>`**
3. **Always work incrementally:** spec → contract → test → code → verify
4. **Contract tests must output:** `CONTRACT VIOLATION: <REQ-ID>` with file, line, and message

## Core Docs (Read Order)

1. **README.md** - What Specflow is, why it exists
2. **demo/** - See it work before reading more
3. **SPEC-FORMAT.md** - How to write specs with requirement IDs
4. **CONTRACT-SCHEMA.md** - YAML format for contracts
5. **LLM-MASTER-PROMPT.md** - How LLMs should use contracts

## The Key Insight

> We don't need LLMs to behave. We need them to be checkable.

Unit tests verify behavior. Contracts verify architecture. Both are needed.
