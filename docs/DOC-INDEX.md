# Specflow Documentation Index

**Updated:** 2026-07-02 (#107 — loop-runtime/verifier era). Older positioning docs are archived in [`docs/old-do-not-use/`](old-do-not-use/README.md) — do not use them.

---

## Start here

| Doc | Read it when |
|---|---|
| [README.md](../README.md) | First contact — problem, product, install, trust guarantees |
| [docs/PRD.md](PRD.md) | **Canonical positioning** — what Specflow is, trust boundaries, shipped vs planned |
| [docs/PRD-COMMERCIAL.md](PRD-COMMERCIAL.md) | The client/investor/partner narrative (no ticket IDs) |
| [docs/should-i-use-specflow.md](should-i-use-specflow.md) | Deciding whether Specflow fits your project |
| [docs/how-it-works.md](how-it-works.md) | The mechanics: loop, verifier lifecycle, gates, ledger, trace |
| [docs/getting-started.md](getting-started.md) | Installing and wiring up a project |
| [QUICKSTART.md](../QUICKSTART.md) | Shortest path to a working setup |

## The trust core (loop runtime)

The one-idea primer: Specflow runs an LLM as an **untrusted worker** and won't let it advance until an **independent, mechanical check** passes. Provider output is never a gate verdict.

| Doc | Covers |
|---|---|
| [docs/PRD.md](PRD.md) §7–§10 | Principles, current capabilities, workflow, trust boundaries |
| [docs/reference.md](reference.md) | Command reference incl. `specflow run spec-build / feature-build / trace` |
| `QA/loops/README.md` (after `specflow init`) | The three loops: spec-build, feature-build, daily-use-teardown |
| [docs/specs/verifier-runtime-lifecycle/](specs/verifier-runtime-lifecycle/) | Verifier lifecycle spec packet (maker↔verifier contracts, runtime verification) |
| [docs/ss/loops-talk-evaluation.md](ss/loops-talk-evaluation.md) | Why the harness is shaped this way (Anthropic long-running-agent lessons) |

## Contracts & schema

| Doc | Covers |
|---|---|
| [CONTRACT-SCHEMA.md](../CONTRACT-SCHEMA.md) | YAML contract format |
| [CONTRACT-SCHEMA-EXTENSIONS.md](../CONTRACT-SCHEMA-EXTENSIONS.md) | DPAO parallel-execution extensions |
| [CONTRACTS-README.md](../CONTRACTS-README.md) | Contract authoring guide |
| [SPEC-FORMAT.md](../SPEC-FORMAT.md) | Spec document format |
| [USER-JOURNEY-CONTRACTS.md](../USER-JOURNEY-CONTRACTS.md) | Journey contract format |
| [docs/contract-graph.md](contract-graph.md) | Cross-reference validation (`specflow graph`) |

## Operating a project

| Doc | Covers |
|---|---|
| [CLAUDE-MD-TEMPLATE.md](../CLAUDE-MD-TEMPLATE.md) | Project CLAUDE.md template |
| [SKILL.md](../SKILL.md) | Agent-facing skill (loop-era refresh tracked in #97 — see its trust-boundary note) |
| [CI-INTEGRATION.md](../CI-INTEGRATION.md) | GitHub Actions enforcement |
| [docs/JOURNEY-VERIFICATION-HOOKS.md](JOURNEY-VERIFICATION-HOOKS.md) | Build/commit hook behavior |
| [docs/team-workflows.md](team-workflows.md) | Roles, CSV journeys, CI templates |
| [MID-PROJECT-ADOPTION.md](../MID-PROJECT-ADOPTION.md) | Adopting Specflow in an existing codebase |
| [LLM-MASTER-PROMPT.md](../LLM-MASTER-PROMPT.md) | Generating contracts with an LLM |

## Reference & history

| Doc | Covers |
|---|---|
| [docs/RELEASES.md](RELEASES.md) / [CHANGELOG.md](../CHANGELOG.md) | Release history |
| [docs/DESIGNER-GUIDE.md](DESIGNER-GUIDE.md) | Designer-facing guide |
| [docs/LIVE-DEMO-SCRIPT.md](LIVE-DEMO-SCRIPT.md) | Demo walkthrough |
| [docs/MEMORYSPEC.md](MEMORYSPEC.md) / [docs/LEARNING-INJECTION-SPEC.md](LEARNING-INJECTION-SPEC.md) | Memory/lessons design notes (feeds STATE work, #85) |
| [docs/old-do-not-use/](old-do-not-use/README.md) | **Archived, superseded docs — do not use** |

---

### Reading order for a new user

1. [README.md](../README.md) → 2. [should-i-use-specflow.md](should-i-use-specflow.md) → 3. [getting-started.md](getting-started.md) → 4. [how-it-works.md](how-it-works.md) → 5. [PRD.md](PRD.md) for the full picture.

### Reading order for an agent

1. Project `CLAUDE.md` → 2. [docs/PRD.md](PRD.md) §7 (principles) and §10 (trust boundaries) → 3. [docs/reference.md](reference.md) → 4. contracts in `docs/contracts/`.
