# Generative Loop Adapter - Adversarial PRD Review

**Date:** 2026-06-30
**Reviewer:** adversarial-prd-reviewer skill
**Target:** `docs/specs/generative-loop-adapter/prd.md`
**Mode:** single-operator dueling protocol, Special Mandate enabled because this
feature touches agent execution, tool permissions, gates, budgets, and
provenance.

```text
┌──────────────────────── SPEC-BUILD ────────────────────────┐
  DISCOVER ─▶ PRD ═╣⛔A╠═▶ TICKETS ─▶ ╎B╎ ─▶ ╎B.5╎ ─▶ handoff
     ✓       ✓      ▶       ·        ·       ·        ·
└─────────────────────────────────────────────────────────────┘
  now: adversary/GATE_A   next: tickets   blocked-on: none after fixes
```

## Issue Ledger - Round 1

Total identified: 3
Open FATAL: none
Open SERIOUS: B-001, B-002, B-003
Open WEAK: none
Resolved in document: 3
Deferred / out of scope: 0
Verdict: SHIP_WITH_STIPULATIONS

### B-001 SERIOUS - Adapter Could Bypass Specflow's Human Gates

Problem: A CLI agent with tools enabled could push, open PRs, create issues, or
override contracts unless Specflow blocks those actions outside the provider.

Required fix: Add adapter policy `never_without_human`, deny tool patterns, and
a post-run attempted-action audit that stops with `blocked_human_required`.

Resolution: Present in PRD Non-Goals, REQ-07, adapter policy contract, AC-4.

### B-002 SERIOUS - CLI Success Could Launder Gate Success

Problem: `claude -p` or `codex exec` returning zero does not mean the Specflow
stage passed. The adapter could become a green-by-assertion loophole.

Required fix: Require the owning verifier/gate to rerun after adapter output
before advancing the run contract.

Resolution: Present in REQ-06 and AC-3.

### B-003 SERIOUS - Subscription/Auth Boundary Could Leak Secrets

Problem: Users with Max/Pro plans should not be asked to paste subscription
secrets into Specflow config. A naive adapter spec might invent secret storage.

Required fix: State that provider CLIs own authentication; Specflow only detects
availability/auth readiness and records provider/session metadata.

Resolution: Present in Non-Goals, REQ-08, AC-7, and Risks.

## Reality-Grounding Ledger

| # | PRD claim | Verified against | Holds? | Evidence / finding |
|---|---|---|---|---|
| 1 | Claude supports non-interactive print mode | `claude --help` | Yes | Help says `-p, --print` prints response and exits. |
| 2 | Claude supports JSON/stream-json output | `claude --help` | Yes | Help lists `--output-format text|json|stream-json`. |
| 3 | Claude supports permissions/tool controls | `claude --help` | Yes | Help lists `--permission-mode`, `--allowedTools`, `--disallowedTools`. |
| 4 | Claude supports a max budget flag | `claude --help` | Yes | Help lists `--max-budget-usd` for `--print`. |
| 5 | Codex supports non-interactive execution | `codex exec --help` | Yes | Help says "Run Codex non-interactively". |
| 6 | Codex supports JSONL output and output schemas | `codex exec --help` | Yes | Help lists `--json` and `--output-schema`. |
| 7 | Codex supports sandbox and approval controls | `codex exec --help` | Yes | Help lists `--sandbox` and `--ask-for-approval`. |

## Loophole Hunt

| Smell | Found? | Location | Severity | Required fix |
|---|---|---|---|---|
| Gate gaming | Found and closed | REQ-06 / AC-3 | SERIOUS | Rerun owning gate after adapter output. |
| Mock-as-real | Closed by scope | Success Metrics | SERIOUS if violated | CI uses fake adapter by default; live smoke tests are opt-in. |
| Skip-to-green | Closed by policy | AC-5 | SERIOUS if violated | Non-zero/malformed/timeout stops with transcript evidence. |
| Secret leakage | Found and closed | REQ-08 / AC-7 | SERIOUS | Provider CLI owns auth; Specflow stores no subscription secrets. |
| Duplicate source of truth | Closed by reuse | Dependencies | None | Reuse loop YAML and run contract instead of separate adapter flow. |

## Final Verification

Total issues identified: 3
Issues resolved in document: 3
Issues unresolved: 0
Verdict: SHIP_WITH_STIPULATIONS

Stipulations:

- Feature-build must test the adapter with a fake provider in CI and keep live
  Claude/Codex calls opt-in.
- Feature-build must prove `never_without_human` actions are blocked outside the
  provider, not merely requested in the prompt.

