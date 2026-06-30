# Falsification Pass — <slug>

Required output of adversary-mandate@v2 (spec-build). Do not polish or summarize — **falsify**: ask not "is this clear?" but "how can it be false while still sounding clear?" Findings recorded only in chat do not count. Every table below must carry ≥1 data row (`verify-falsification.cjs` rejects a stub); GATE_A additionally requires a PASS/PASS WITH STIPULATIONS bound to the current PRD hash (`--require-pass --binds-prd`). Claim `Type` ∈ {definition, assumption, theorem, impl-choice, hypothesis, citation}. The Dependency Audit asserts no edge without a one-line reason.

PRD SHA-256: <sha256 of PRDs/<slug>-prd.md at review time>

## Premise Attack
| Premise | Source | Could be false because | Verdict | Required correction |
|---|---|---|---|---|

## Claim Inventory
| Claim | Type | Source support | Load-bearing? | Status | What breaks downstream if wrong | Correction |
|---|---|---|---|---|---|---|

## Dependency Audit
| Edge (A → B) | Reason edge exists | False-edge risk | Verdict | Correction |
|---|---|---|---|---|

## Acceptance Gate Attack
| Gate | How it could be gamed | Missing oracle | Correction |
|---|---|---|---|

## Source / Reality Ledger
| Concrete claim | Verified against (file:line / query) | Holds? | Evidence |
|---|---|---|---|

## Overclaim / Scope Leakage
| Text | Why it overclaims | Replacement text |
|---|---|---|

## Banned-Mode Self-Check
Each disqualifies a PASS. Mark present? + evidence for each.
| Banned mode | Present? | Evidence / note |
|---|---|---|
| blanket dependency | | |
| definition-as-assumption | | |
| source laundering | | |
| nearby-proof | | |
| green-by-assertion | | |
| inventory-as-reliance | | |
| unapplied correction | | |

## Final Verdict
`PASS` / `PASS WITH STIPULATIONS` / `FAIL` — one line, then any owned stipulations (each with an owner).
