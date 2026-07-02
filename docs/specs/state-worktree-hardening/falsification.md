# State + Worktree Hardening — Falsification

**Date:** 2026-07-02
**Reviewed PRD:** `docs/specs/state-worktree-hardening/prd.md`
PRD SHA-256: fc5ad22cb58fce245def7508606fb3a0c4bf7f7ca783e95743a1e17712dc56e5

## Premise Attack

| Claim | Attack | Result |
|---|---|---|
| Durable state makes re-entry safe. | State can be stale or wrong, so the agent still resumes wrong. | Holds only because the durable run-contract position is authoritative and conflicts are ledgered, not silently trusted. |
| Worktree isolation prevents collision. | A worktree can still point at the main tree by misconfiguration. | Holds only because preparation refuses a path resolving to the main working tree. |
| State should inform re-entry. | State could be treated as a gate result. | Holds with scope: state is context only; the mechanical gate still decides. |

## Claim Inventory

| Claim | Source | Verification route |
|---|---|---|
| Durable position overrides caller-assumed memory. | #85 and long-running agent evaluation | Add reentry briefing + conflict ledger + test. |
| Missing durable position is unsafe. | #85 | assertSafeReentry returns unsafe + test. |
| Worktree branch/base/path/cleanup are ledgered. | #86 | Ledger entries on prepare/release + test. |
| No silent collision with the main tree. | #86 | Refuse path == repo root + hostile fixture. |

## Dependency Audit

| Dependency | Risk | Disposition |
|---|---|---|
| `scripts/specflow-runner.cjs` | Existing state/worktree functions are scaffolding, not enforced. | Tickets STATE-REENTRY-01 and WORKTREE-ISOLATION-01 own enforcement. |
| `git worktree` | Not all environments allow worktree creation. | Reference mode + collision guard work without creating a worktree. |
| `ledger.jsonl` | Re-entry/worktree events could be lost if not recorded. | Both tickets append dedicated ledger events. |

## Acceptance Gate Attack

| Acceptance | Attack | Required guard |
|---|---|---|
| Safe re-entry. | Caller-assumed stage silently used. | Durable stage overrides; conflict ledgered. |
| Worktree ledgered. | Prepared but not recorded. | Prepare/release append ledger entries. |
| No collision. | Path equals main tree. | Refuse before any git call. |
| State not a gate. | State update marks gate passed. | State updates never replace mechanical gate evidence. |

## Source / Reality Ledger

| Source claim | Reality check | Status |
|---|---|---|
| Runner has state-memory surfaces. | `appendStateMemory`, `readStateDigest`, `recordRunState` exist. | PASS |
| Runner has a worktree surface. | `prepareWorktree` exists and returns branch/base/path. | PASS |
| Enforcement already exists. | No reentry conflict handling or main-tree collision guard yet. | GAP OWNED |

## Overclaim / Scope Leakage

| Overclaim | Correction | Owner |
|---|---|---|
| "State guarantees correct resume." | State makes the durable position authoritative; it does not decide gates. | STATE-REENTRY-01 |
| "Worktrees make Specflow a scheduler." | Isolation is per-lane; orchestration stays out of scope. | PRD non-goal |
| "Delegated work can auto-merge." | Auto-merge/auto-push remain false and human-gated. | WORKTREE-ISOLATION-01 |

## Banned-Mode Self-Check

| Banned mode | Present? | Note |
|---|---|---|
| Stub sections / empty tables | No | Every section carries real attacks. |
| Overclaim beyond runtime evidence | No | State/worktree are context, not verdicts. |
| Hidden scope creep | No | Scope limited to #85 and #86 enforcement. |

## Final Verdict

PASS WITH STIPULATIONS — proceed to Gate B. Stipulation: state and worktree records are context/evidence only and must never advance a mechanical gate.
