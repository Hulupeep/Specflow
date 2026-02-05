# Specflow Documentation Index

> A complete guide to all Specflow documentation.

---

## Quick Navigation

| I want to... | Start here |
|--------------|------------|
| **Get started quickly** | [QUICKSTART.md](../QUICKSTART.md) |
| **Understand the system** | [README.md](../README.md) |
| **See it work** | [demo/](../demo/) |
| **Add to existing project** | [MID-PROJECT-ADOPTION.md](../MID-PROJECT-ADOPTION.md) |
| **Write specs** | [SPEC-FORMAT.md](../SPEC-FORMAT.md) |
| **Create contracts** | [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) |
| **Set up CI** | [CI-INTEGRATION.md](../CI-INTEGRATION.md) |
| **Automate test verification** | [JOURNEY-VERIFICATION-HOOKS.md](JOURNEY-VERIFICATION-HOOKS.md) |
| **Use with Claude Code** | [context/CLAUDE-CODE-SKILL.md](../context/CLAUDE-CODE-SKILL.md) |

---

## Reading Order

### Phase 1: Understand (30 min)

| Order | Document | Purpose | Priority |
|-------|----------|---------|----------|
| 1 | [README.md](../README.md) | What Specflow is, why it exists, the formula | **MUST** |
| 2 | [QUICKSTART.md](../QUICKSTART.md) | Choose your path, copy-paste prompts | **MUST** |
| 3 | [demo/README.md](../demo/README.md) | See it work before reading more | **MUST** |

### Phase 2: Core Concepts (1 hour)

| Order | Document | Purpose | Priority |
|-------|----------|---------|----------|
| 4 | [SPEC-FORMAT.md](../SPEC-FORMAT.md) | How to write specs with REQ IDs | **MUST** |
| 5 | [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) | YAML contract format | **MUST** |
| 6 | [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) | Journey testing (Definition of Done) | **MUST** |
| 7 | [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) | How LLMs should use contracts | **SHOULD** |

### Phase 3: Integration (as needed)

| Order | Document | Purpose | Priority |
|-------|----------|---------|----------|
| 8 | [JOURNEY-VERIFICATION-HOOKS.md](JOURNEY-VERIFICATION-HOOKS.md) | Auto-run E2E tests at build boundaries | **SHOULD** |
| 9 | [CI-INTEGRATION.md](../CI-INTEGRATION.md) | GitHub Actions, GitLab CI setup | **SHOULD** |
| 10 | [MID-PROJECT-ADOPTION.md](../MID-PROJECT-ADOPTION.md) | Adding to existing projects | **SHOULD** |
| 11 | [CLAUDE.md](../CLAUDE.md) | Project CLAUDE.md for LLM guardrails | **SHOULD** |

### Phase 4: Advanced (reference)

| Order | Document | Purpose | Priority |
|-------|----------|---------|----------|
| — | [context/MASTER-ORCHESTRATOR.md](../context/MASTER-ORCHESTRATOR.md) | End-to-end automation | Reference |
| — | [context/SUBAGENT-CONTRACTS.md](../context/SUBAGENT-CONTRACTS.md) | Claude Code subagent patterns | Reference |
| — | [context/SPEC-TO-CONTRACT.md](../context/SPEC-TO-CONTRACT.md) | Deep-dive conversion examples | Reference |
| — | [docs/MEMORYSPEC.md](MEMORYSPEC.md) | ruvector learning integration | Reference |

---

## Complete Document List

### Core Documents (Root)

| Document | Purpose | Related To | Priority |
|----------|---------|------------|----------|
| [README.md](../README.md) | Main entry point, system overview, the formula | QUICKSTART, CONTRACTS-README | **MUST** |
| [QUICKSTART.md](../QUICKSTART.md) | Choose your path, copy-paste prompts | README, all core docs | **MUST** |
| [SPEC-FORMAT.md](../SPEC-FORMAT.md) | How to write specs with REQ IDs | CONTRACT-SCHEMA, LLM-MASTER-PROMPT | **MUST** |
| [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) | YAML contract format | SPEC-FORMAT, SPEC-TO-CONTRACT | **MUST** |
| [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) | Journey testing, Definition of Done | CI-INTEGRATION, CONTRACT-SCHEMA | **MUST** |
| [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) | How LLMs enforce contracts | SPEC-FORMAT, CONTRACT-SCHEMA | **SHOULD** |
| [CONTRACTS-README.md](../CONTRACTS-README.md) | System overview (alternative entry) | README, QUICKSTART | **SHOULD** |
| [CI-INTEGRATION.md](../CI-INTEGRATION.md) | CI/CD setup (GitHub, GitLab) | USER-JOURNEY-CONTRACTS | **SHOULD** |
| [MID-PROJECT-ADOPTION.md](../MID-PROJECT-ADOPTION.md) | Adding to existing projects | QUICKSTART (Path 2) | **SHOULD** |
| [CLAUDE.md](../CLAUDE.md) | Project CLAUDE.md template | CLAUDE-MD-TEMPLATE | **SHOULD** |
| [CLAUDE-MD-TEMPLATE.md](../CLAUDE-MD-TEMPLATE.md) | Detailed CLAUDE.md template | CLAUDE.md | Reference |
| [PROMPT-TEMPLATE.md](../PROMPT-TEMPLATE.md) | LLM prompt templates | LLM-MASTER-PROMPT | Reference |

### Context Documents (context/)

Advanced documentation for automation and subagents.

| Document | Purpose | Related To | Priority |
|----------|---------|------------|----------|
| [CLAUDE-CODE-SKILL.md](../context/CLAUDE-CODE-SKILL.md) | `/specflow` skill for Claude Code | QUICKSTART, LLM-MASTER-PROMPT | **SHOULD** |
| [MASTER-ORCHESTRATOR.md](../context/MASTER-ORCHESTRATOR.md) | Complete end-to-end automation | All core docs | Reference |
| [META-INSTRUCTION.md](../context/META-INSTRUCTION.md) | Infrastructure setup guide | CI-INTEGRATION | Reference |
| [SPEC-TO-CONTRACT.md](../context/SPEC-TO-CONTRACT.md) | Deep-dive conversion examples | CONTRACT-SCHEMA, SPEC-FORMAT | Reference |
| [SUBAGENT-CONTRACTS.md](../context/SUBAGENT-CONTRACTS.md) | Claude Code subagent patterns | CLAUDE-CODE-SKILL | Reference |

### Docs Folder (docs/)

Supplementary documentation and guides.

| Document | Purpose | Related To | Priority |
|----------|---------|------------|----------|
| [DOC-INDEX.md](DOC-INDEX.md) | This document | All docs | Reference |
| [MEMORYSPEC.md](MEMORYSPEC.md) | ruvector learning integration | LLM-MASTER-PROMPT | Reference |
| [DESIGNER-GUIDE.md](DESIGNER-GUIDE.md) | Designer/PM workflow | SPEC-FORMAT | Reference |
| [SIMPLE-WALKTHROUGH.md](SIMPLE-WALKTHROUGH.md) | Simple step-by-step guide | QUICKSTART | Reference |
| [LIVE-DEMO-SCRIPT.md](LIVE-DEMO-SCRIPT.md) | Presentation script | demo/ | Reference |
| [AGENTIC-FOUNDATIONS-DECK.md](AGENTIC-FOUNDATIONS-DECK.md) | 7-slide presentation | README | Reference |
| [STATUS.md](STATUS.md) | Implementation status | — | Reference |

### Demo (demo/)

Working example that proves the concept.

| Document | Purpose | Related To | Priority |
|----------|---------|------------|----------|
| [demo/README.md](../demo/README.md) | Demo instructions | QUICKSTART | **MUST** |
| [demo/QUICKSTART.md](../demo/QUICKSTART.md) | Demo quick start | demo/README | Reference |
| [demo/docs/spec.md](../demo/docs/spec.md) | Example spec | SPEC-FORMAT | Reference |
| [demo/IMPLEMENTATION-PLAN.md](../demo/IMPLEMENTATION-PLAN.md) | Demo implementation plan | — | Reference |

---

## By Use Case

### "I'm new to Specflow"

| Step | Document | Why |
|------|----------|-----|
| 1 | [README.md](../README.md) | Understand what it is |
| 2 | [demo/](../demo/) | See it work |
| 3 | [QUICKSTART.md](../QUICKSTART.md) | Start using it |

### "I have an existing project to protect"

| Step | Document | Why |
|------|----------|-----|
| 1 | [MID-PROJECT-ADOPTION.md](../MID-PROJECT-ADOPTION.md) | Adoption strategy |
| 2 | [QUICKSTART.md](../QUICKSTART.md) | Path 2: Protect Existing Project |
| 3 | [CI-INTEGRATION.md](../CI-INTEGRATION.md) | Set up enforcement |

### "I'm building a new feature with LLM help"

| Step | Document | Why |
|------|----------|-----|
| 1 | [SPEC-FORMAT.md](../SPEC-FORMAT.md) | Write the spec |
| 2 | [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) | Create contracts |
| 3 | [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) | Define DOD |
| 4 | [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) | Give to LLM |

### "I want to set up CI/CD"

| Step | Document | Why |
|------|----------|-----|
| 1 | [CI-INTEGRATION.md](../CI-INTEGRATION.md) | Full CI setup |
| 2 | [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) | Journey test setup |
| 3 | [context/META-INSTRUCTION.md](../context/META-INSTRUCTION.md) | Infrastructure details |

### "I use Claude Code"

| Step | Document | Why |
|------|----------|-----|
| 1 | [context/CLAUDE-CODE-SKILL.md](../context/CLAUDE-CODE-SKILL.md) | Set up /specflow skill |
| 2 | [context/SUBAGENT-CONTRACTS.md](../context/SUBAGENT-CONTRACTS.md) | Subagent patterns |
| 3 | [CLAUDE.md](../CLAUDE.md) | Project CLAUDE.md |

### "I want full automation"

| Step | Document | Why |
|------|----------|-----|
| 1 | [context/MASTER-ORCHESTRATOR.md](../context/MASTER-ORCHESTRATOR.md) | End-to-end automation |
| 2 | [context/SUBAGENT-CONTRACTS.md](../context/SUBAGENT-CONTRACTS.md) | Subagent coordination |
| 3 | [docs/MEMORYSPEC.md](MEMORYSPEC.md) | Learning loop with ruvector |

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **MUST** | Essential for understanding and using Specflow |
| **SHOULD** | Important for effective use, read when relevant |
| Reference | Deep-dive or specialized content, consult as needed |

---

## The Three Layers

Every document relates to one of the three layers:

| Layer | What It Defines | Key Documents |
|-------|-----------------|---------------|
| **Architecture** | Structural invariants | CONTRACT-SCHEMA, SPEC-FORMAT |
| **Features** | Product capabilities | CONTRACT-SCHEMA, SPEC-TO-CONTRACT |
| **Journeys** | User accomplishments (DOD) | USER-JOURNEY-CONTRACTS, CI-INTEGRATION |

---

## Document Relationships

```
README.md
    │
    ├── QUICKSTART.md ──────────────────┐
    │       │                           │
    │       ├── Path 1: LLM generates   │
    │       ├── Path 2: Protect existing│
    │       ├── Path 3: From spec       │
    │       └── Path 4: Manual          │
    │                                   │
    ├── SPEC-FORMAT.md ─────────────────┤
    │       │                           │
    │       └── CONTRACT-SCHEMA.md ─────┤
    │               │                   │
    │               └── context/SPEC-TO-CONTRACT.md
    │                                   │
    ├── USER-JOURNEY-CONTRACTS.md ──────┤
    │       │                           │
    │       └── CI-INTEGRATION.md       │
    │                                   │
    ├── LLM-MASTER-PROMPT.md ───────────┤
    │       │                           │
    │       ├── context/CLAUDE-CODE-SKILL.md
    │       └── context/SUBAGENT-CONTRACTS.md
    │                                   │
    └── docs/MEMORYSPEC.md (ruvector)   │
                                        │
                    context/MASTER-ORCHESTRATOR.md
                    (ties everything together)
```

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-12 | Initial document index created |
