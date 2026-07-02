# Fable Subordinate Controls — Falsification

**Date:** 2026-07-02
**Reviewed PRD:** `docs/specs/fable-subordinate-controls/prd.md`
PRD SHA-256: ac4030ed30481f3b801248baa94555368f7006700436cb7b1e0f539d5afe5f42

## Premise Attack

| Claim | Attack | Result |
|---|---|---|
| These controls matter. | They are subordinate plumbing, not the trust boundary. | Holds with scope: thin and disposable, subordinate to the verifier/gate core. |
| Honesty about downgrade helps. | A downgrade with a reason is still a downgrade. | Holds: the reason makes it honest evidence; silent downgrade is the failure. |
| Cost accounting is safe. | Cost could be fabricated when usage is missing. | Holds only because missing usage is recorded as unknown, never zero. |
| Vision is useful evidence. | Vision could be used as a verdict. | Holds only because gate_result stays pending and vision cannot pass a gate. |

## Claim Inventory

| Claim | Source | Verification route |
|---|---|---|
| Silent downgrade is a failed contract. | #83 and fable-enable.md | assertModelHonesty + hostile fixture. |
| Missing usage is unknown. | #89 | costAccounting + test with missing usage. |
| Vision is evidence only. | #88 | visionFinding gate_result pending + refusal helper. |
| Routines must call specflow run. | #87 | validateRoutineManifest + hostile fixture. |

## Dependency Audit

| Dependency | Risk | Disposition |
|---|---|---|
| `normalizeAdapterPolicy` | Already carries requested/effective/fallback. | Honesty ticket adds the enforcement check. |
| `summarizeLedger` | Cost fields may be absent. | Cost ticket treats absence as unknown. |
| `scripts/teardown-gate.cjs` | Vision evidence path exists but unenforced. | Vision ticket keeps verdict pending. |
| `scaffoldRoutineManifest` | Manifests could bypass specflow run. | Routine ticket validates manifests. |

## Acceptance Gate Attack

| Acceptance | Attack | Required guard |
|---|---|---|
| Downgrade honesty. | Downgrade recorded but not flagged. | Missing reason fails the contract. |
| Cost accounting. | Missing usage counted as zero. | Missing usage is unknown. |
| Vision evidence. | Vision verdict advances a gate. | gate_result pending; refusal helper. |
| Routine safety. | Manifest runs git push directly. | Reject non-specflow-run and human-gated actions. |

## Source / Reality Ledger

| Source claim | Reality check | Status |
|---|---|---|
| Adapter policy has model routing fields. | `normalizeAdapterPolicy` returns requested/effective/fallback. | PASS |
| Ledger summary exists. | `summarizeLedger` exists. | PASS |
| Routine manifest scaffolding exists. | `scaffoldRoutineManifest` exists. | PASS |
| Enforcement already exists. | No honesty/cost/vision/routine enforcement yet. | GAP OWNED |

## Overclaim / Scope Leakage

| Overclaim | Correction | Owner |
|---|---|---|
| "Routing/cost is the product." | Subordinate plumbing; verifier/gate is the product. | PRD non-goal |
| "Vision proves UI correctness." | Vision is evidence; behavior journeys prove value. | VISION-EVIDENCE-01 |
| "Routines can act autonomously." | Human-gated actions stay blocked; proposals enter spec-build. | ROUTINE-SAFETY-01 |

## Banned-Mode Self-Check

| Banned mode | Present? | Note |
|---|---|---|
| Stub sections | No | Real attacks per section. |
| Scope creep | No | Limited to #83/#87/#88/#89 enforcement. |
| Overclaim | No | Controls stay subordinate to the gate. |

## Final Verdict

PASS WITH STIPULATIONS — proceed to Gate B. Stipulation: all four controls remain subordinate to the mechanical gate and human boundaries and must never advance a gate on their own.
