# EFFORT-POLICY-01: progress-led subscription runs without fixed review stops

Parent: #215; related #134, #181, #183. Planning depth: thin; not build-ready. Owner direction: 26 October 2026.

## Problem and verified reproduction
Codex/Claude subscription work should not hand back to Colm after an arbitrary number of reviews. Repeated failure must prompt an adaptive, evidenced recovery, while true safety and expensive-route controls remain. Kimi follows the same principle when qualified; no adapter support is implied here.

A pure local probe of current review-continuation.cjs created subscription state with no maxCalls/maxElapsedMs, observed three protocol failures, attempted one evidenced recovery, and observed another protocol failure. A second materially different recovery was rejected with: protocol recovery did not establish progress; inspect the retained cause and recovery evidence before escalating. Calls remained4. Thus default financial caps are already absent, but a one-recovery rule remains a hard stop. Existing tests/contracts/review-continuation.test.js and duo-operations.test.js enforce it. Improve controller defaults separately remain24 native starts/30minutes. No runtime code was changed by this probe.

## Scope and acceptance
- REQ-EFFORT-01 / AC-EFFORT-01: On subscription or explicitly declared low-cost routes, do not invent a financial/review-count cap. Multiple useful reviews continue; actual route/provider quota and billing knownness remain visible. No assumption from model name and no new paid fallback authority.
- REQ-EFFORT-02 / AC-EFFORT-02: Treat repeated protocol/stagnation thresholds as diagnostic boundaries. Permit further materially different, current-evidence-backed recoveries without a fixed one-recovery lifetime allowance. Same strategy with renamed evidence/wording is rejected for the concrete lack of new recovery evidence; it cannot manufacture acceptance or first-time progress.
- REQ-EFFORT-03 / AC-EFFORT-03: Explicitly costly routes and owner-set limits retain configured brakes. A caller or repository cannot reclassify a costly registered route as subscription/cheap to bypass its limits. Estimates, declared billing mode and measured charges remain distinct.
- REQ-EFFORT-04 / AC-EFFORT-04: Bound unattended work by a configured working-session/overnight horizon, not an unlimited multi-day loop. Use a documented finite default for new unattended profiles; explicit long-run intent may choose longer. At the boundary preserve state and report exact progress/limitation; continuation requires the already authorised schedule/recovery policy, never a hidden reset. Ordinary recovery must not require Colm to choose implementation details.
- REQ-EFFORT-05 / AC-EFFORT-05: Preserve original owner-set caps, run IDs, findings, elapsed time and consumed work. Version new defaults and provide an explicit reviewed migration for old/pinned runs; do not hot-edit journals or extend frozen deadlines. Unknown side effects, permissions, mandatory evidence and consumed holdouts stay protected.

## Delivery slices
A: review continuation's one-recovery dead end, with current-evidence/recovery deduplication and honest reporting. This is the next runtime correction before #182 work.
B: align Improve profile/controller defaults and window semantics with verified #183 checkpoint/recovery; retain V1/frozen grants. Do not delay A on a new scheduler or implement a second engine.

## Simulation Findings (proposed; bounded paper routes)
- Subscription builder: four useful reviews continue; failed checker → diagnosis → different bounded strategy → continue. Divergence: same failure with renamed note must not evade stagnation.
- Costly-route operator: registered expensive route has an explicit ceiling; injected subscription label cannot remove it. No authority is gained from task prose.
- Returning unattended worker: same job across restart keeps its history/window; uncertain side effect remains fenced; a horizon yields an evidenced checkpoint/limitation, not a silent Colm-wait or five-day loop.

## Audit phase1 — gap analysis
Present: concrete source reproduction, owner outcome, positive/negative acceptance, reuse boundaries and staged delivery. Missing before build-ready: exact policy fields/default horizon, recovery evidence equivalence and legacy migration contract.

## Audit phase2 — surgical preparation
No SQL/RPC or graphical UI change is proposed; use the existing local JSON policy/history boundary. Reuse trust contracts: required native reads, exact acceptance, authenticated ownership, immutable job limits and holdout rules. Planned executable mapping: extend tests/contracts/review-continuation.test.js and tests/contracts/duo-operations.test.js for01/02/03/05; tests/contracts/improve-limits.test.js and tests/integration/improve-controller.test.js for04/05. Write the desired failing regression before fixing the current behaviour.

```gherkin
Scenario: A distinct evidenced subscription recovery can continue
  Given a subscription review run has no explicit call ceiling
  And one diagnosed recovery failed
  When a materially different recovery has validated current evidence
  Then it may proceed without an owner handback
  And original history and acceptance gates remain intact
Scenario: A renamed failed strategy cannot keep looping
  Given a recovery produced no new relevant evidence
  When the same approach is resubmitted with different wording
  Then it is rejected for the concrete missing recovery evidence
  And no journal, deadline or financial limit is reset
```

## Audit phase3 — pre-flight: blocked for build-ready
P1: select exact recovery freshness/equivalence and route-policy fields, and migration semantics, before implementation. P1 for sliceB: choose safe horizon/checkpoint behaviour using #183 proof; no timeout should fabricate a terminal core decision or replay a holdout. These are builder-owned technical decisions, not requests for Colm to approve routine steps. No native review, policy migration, runtime fix or deployment is claimed.


Slice A merged in https://github.com/Hulupeep/Specflow/pull/236 (main 91a6195e054581299a428e93f76c9b5879ded939).

The fixed one-recovery dead end is removed for updated helpers/new runtimes. Further recoveries in the same history need fresh, stable, previously unused executed observations after the preceding call. Explicit owner call/time ceilings, ownership, findings, mandatory evidence and finish gates remain. Old pinned runtime bytes and journals are unchanged.

Evidence: original desired regression ran red before the fix; final canonical suite 1,729 passed across 85 suites, zero failed/skipped. One earlier final-source full run failed a hook subprocess test (1,728 passed/1 failed); all 9 isolated hook tests and the unchanged-source full retry passed. No remote CI success is claimed: this PR reported no CI checks.

Duo preparation 1793010740905-ad7b307f accepted 5/5 and finished. Implementation 1793011250960-613ddda8 accepted 6/6 and finished on attempt 4 after three retained protocol-invalid responses and executed same-run diagnosis/recovery. Those responses granted no acceptance. All 20 committed files were checked against the frozen accepted bytes. Canonical raw receipt SHA256 f3b4798eb8fb339c7331becc750ac12e29b09faac5f7bf6949edd5ea470d68a9.

Keep this issue OPEN: B remains controller defaults (currently 24 starts/30 minutes), qualified resumable windows and route-cost/expensive-model brakes. Continue #182 memory, then #183 recovery/window alignment, #218 service and #219 portable HeyStax handoff. Live scheduling remains off. No new Kimi/API adapter, paid fallback, global installation or old-session hot migration is claimed.
