# Verifier Runtime Lifecycle - Falsification

**Date:** 2026-07-02
**Reviewed PRD:** `docs/specs/verifier-runtime-lifecycle/prd.md`
PRD SHA-256: 18da98bac8d66590eb662f74f54d8f6c3c7f5d3780a46aa1fc9430810955e7a7

## Premise Attack

| Claim | Attack | Result |
|---|---|---|
| A verifier lifecycle improves trust for frontier agents. | A verifier can still be another model and can still be fooled. | Holds only because verifier output is not the gate; mechanical gates remain decisive. |
| Runtime verification is necessary. | Static tests may be enough for non-UI CLI slices. | Holds with scope: runtime verification is required for UI/workflow surfaces and optional/custom for pure CLI slices. |
| Maker proposal before implementation improves outcomes. | Maker could propose weak checks that approve its intended approach. | Holds only because verifier can reject the proposal before implementation. |

## Claim Inventory

| Claim | Source | Verification route |
|---|---|---|
| Provider output must not advance gates. | Existing adapter/genuine-looper docs and #100 | Encode invariant and ledger gate result separately. |
| Verifier must not consume maker reasoning trace by default. | #100 and long-running agent evaluation | Add verifier policy/input contract and tests. |
| Runtime evidence should include Playwright/console/network/rereads where applicable. | #100 and docs/ss evaluation | Add runtime evidence artifact schema and smoke tests. |
| Trace must show maker/verifier/gate divergence. | #93 and #100 | Add ledger fields consumed by trace/status output. |

## Dependency Audit

| Dependency | Risk | Disposition |
|---|---|---|
| `scripts/specflow-runner.cjs` | Existing runner may not have verifier lifecycle primitives. | Ticket VERIFIER-CONTRACT-01 owns additions. |
| Adapter policy templates | Maker/verifier policy split can be underspecified. | Ticket VERIFIER-POLICY-01 owns schema and validation. |
| Playwright/runtime tools | Not every project has a running app. | Verifier can block with missing executable surface rather than invent evidence. |
| `ledger.jsonl` | Divergence can be lost if maker/verifier/gate are a single event. | Ticket VERIFIER-TRACE-01 owns event separation. |

## Acceptance Gate Attack

| Acceptance | Attack | Required guard |
|---|---|---|
| Persist verification contract. | Persisted but not enforced. | Gate/stage must read contract before maker implementation. |
| Separate verifier context. | Verifier gets maker transcript as convenience. | Default must forbid maker reasoning trace. |
| Runtime evidence path. | Screenshot-only proof passes. | Value-bearing state requires reread/API/DB/custom assertion. |
| Trace divergence. | Summary hides failed evidence. | Trace must link raw evidence paths and missing refs. |

## Source / Reality Ledger

| Source claim | Reality check | Status |
|---|---|---|
| Repo has `specflow run` and ledger surfaces. | `bin/specflow.js` and `scripts/specflow-runner.cjs` expose loop runtime surfaces. | PASS |
| Repo has Playwright journey concept. | Docs and compiler mention Playwright journey tests. | PASS |
| Repo has Gate D/teardown evidence model. | `scripts/teardown-gate.cjs` exists and validates evidence paths. | PASS |
| Repo already has full verifier lifecycle. | Only partial verifier references exist. | GAP OWNED |

## Overclaim / Scope Leakage

| Overclaim | Correction | Owner |
|---|---|---|
| "Independent verifier solves trust." | Verifier is evidence; mechanical gate decides. | VERIFIER-POLICY-01 |
| "Vision proves UI correctness." | Vision supports evidence; journey/value rereads prove behavior. | VERIFIER-RUNTIME-01 |
| "This makes Specflow an orchestrator." | Specflow remains a harness for one contracted lane. | PRD non-goal |

## Banned-Mode Self-Check

| Banned mode | Present? | Evidence |
|---|---|---|
| Self-grading accepted as pass | No | Invariant forbids provider/verifier output as gate. |
| Decorative YAML only | No | Tickets require runner, ledger, schema, tests. |
| Hidden model downgrade/fallback | No | Model fields are inherited from #83/#89 and preserved as metadata. |
| Runtime verification optional for UI/workflow | No | Required by VERIFIER-RUNTIME-01. |
| Human gates bypassed | No | No push/merge/override automation in scope. |

## Final Verdict

PASS WITH STIPULATIONS. The PRD is valid if implementation preserves the authority split: maker proposes, verifier attacks, mechanical gate decides, ledger remembers.
