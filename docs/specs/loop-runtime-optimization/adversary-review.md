# Loop Runtime Optimization - Adversarial PRD Review

**Date:** 2026-06-30
**Reviewer:** adversarial-prd-reviewer skill
**Target:** `docs/specs/loop-runtime-optimization/prd.md`
**Mode:** single-operator dueling protocol, Special Mandate enabled because the
PRD concerns gates, verifier execution, and silent-lie prevention.

```text
┌──────────────────────── SPEC-BUILD ────────────────────────┐
  DISCOVER ─▶ PRD ═╣⛔A╠═▶ TICKETS ─▶ ╎B╎ ─▶ ╎B.5╎ ─▶ handoff
     ✓       ✓      ▶       ✓        ✓       ✓        ✓
└─────────────────────────────────────────────────────────────┘
  now: GATE_A re-review   next: amended packet verification   blocked-on: none
```

## Issue Ledger - Round 1

Total identified: 2
Open FATAL: none
Open SERIOUS: B-001, B-002
Open WEAK: none
Resolved in document: 0
Deferred / out of scope: 0
Verdict: DO NOT SHIP until B-001 and B-002 are written into the PRD/tickets.

### B-001 SERIOUS - CLI Overclaims Generative Execution

Location: PRD lines 50-52 before amendment.

Problem: "executes every unblocked stage" implied the CLI can perform PRD writing
or agent judgment even though no LLM adapter is in scope.

Question: What exactly does the local runner execute, and where does it stop?

Required fix: Define an agent-supervised operating model: mechanical gates run as
commands; generative stages stop with `agent_action_required` and a concrete
`next_action`.

Resolution: Applied to `prd.md` Operating Model, Non-Goals, REQ-01, Risks, and
to `tickets.md` AC/Gherkin/DoD.

### B-002 SERIOUS - Durable Storage Path Not Pinned

Location: PRD acceptance/success metrics before amendment.

Problem: The PRD required durable state but did not define default contract and
ledger paths. Two engineers could choose incompatible locations.

Question: Where are run contracts and ledgers stored by default, and how can the
caller override them?

Required fix: Pin default paths and CLI override behavior.

Resolution: Applied to `prd.md` Operating Model and `tickets.md` data contract /
acceptance criteria.

## Reality-Grounding Ledger

| # | PRD claim | Verified against | Holds? | Evidence / finding |
|---|---|---|---|---|
| 1 | `specflow run` is not present today | `bin/specflow.js` command map | Yes | Commands are `init`, `verify`, `update`, `audit`, `graph`. |
| 2 | Loop selector requires run contracts | `skills/specflow-loop-selector/SKILL.md` | Yes | Skill says referencing YAML is not enough and gives `run_contract` schema. |
| 3 | Spec-build has mandatory B.5 simulation | `templates/QA/loops/spec-build.yaml` | Yes | Stage `GATE_B5` gates handoff. |
| 4 | Install copies skills to agent homes | `setup-project.sh` | Yes | Installs to `.claude/skills`, `.codex/skills`, `.agents/skills`. |

## Loophole Hunt

| Smell | Found? | Location | Severity | Required fix |
|---|---|---|---|---|
| Fake loop progress | Found | PRD REQ-01 before amendment | SERIOUS | Define mechanical-vs-generative execution and `agent_action_required`. |
| Duplicate source of truth | Not found | Ticket reuse and docs mapping | None | Reuse existing loop YAML and selector skill. |
| Mock-as-real | Not found | Test expectations | None | Ticket requires command/ledger behavior, not mocked success as acceptance. |
| All-green-as-success | Not found | Success Metrics | None | Metrics name state/resume/invalid-contract behavior. |
| Skip-to-green | Not found | Ticket DoD | None | Adds contract tests, no skip allowance. |

## Final Verification

Total issues identified: 2
Issues resolved in document: 2
Issues unresolved: 0
Verdict: SHIP_WITH_STIPULATIONS

Stipulations:

- Feature-build must keep the CLI as an agent-supervised local controller unless
  a separate LLM adapter ticket is created.
- Feature-build must prove generative stages stop with
  `agent_action_required`; they must not be marked executed by the CLI.
