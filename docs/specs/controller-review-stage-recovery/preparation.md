# #311: completed review-stage recovery

Bounded non-UI controller bug; fixes the observed blocked continuation without claiming a new product cycle passed. Existing tests intentionally reject automatic resume, so retain that default. Recovery is an explicit, authenticated corrected-input request, not unconditional clearing of a stop reason.

## Simulation Findings (proposed)

- Current subscription holder: a malformed critique input fails, is corrected, and the holder requests a retry. Preserve the original receipt and counters; reject automatic or identical-input retries.
- Replacement holder: predecessor dies after a completed failure. Official assignment/resume must happen before retry; stale holders and unresolved child operations stay denied.
- Adversarial or mistaken caller: labels a consumed holdout/build as a review, changes the next stage, or retries after cancellation/deadline. Restrict to the same failed critique/oracle/judge stage, exact active cycle, authenticated terminal receipt and fresh input binding; keep all other stops.

Accepted under standing implementation authority. No product/permission expansion. Review-only model calls can consume existing subscription allowance but no paid fallback or cap reset follows from this request.

## Gap analysis and surgical uplift

Present: problem and observed error, scope/non-goals, five behavioural acceptance criteria and delivery checks in #311. Add the interface and negative routes below. SQL, browser testids and Playwright are N/A: controller/CLI state only, no UI/data schema change.

Proposed existing-interface extension (subject to tests):
```ts
type ReviewRetry = { operation_id: string; reason: string };
// Optional; omitted retains current fail-closed behaviour.
// Controller request carries retry?: ReviewRetry; worker adapter forwards it.
start(stage: string, args: unknown[], options?: { retry?: ReviewRetry }): ChildProcess;
```

Only critique/oracle/judge are eligible. The current execution holder, matching profile and cycle, completed sealed nonzero stage_failure receipt, changed input hash, no pending operations, unexpired original deadline and remaining explicit allowance are required. Consume the retry in the same atomic transaction that reserves its replacement stage. Record old/new operation/input linkage and the stated repair; do not erase original failure/evidence. No reuse of a failed stage receipt as acceptance.

```gherkin
Scenario: Explicit corrected review input
  Given a completed sealed critique failure and no outstanding operations
  When the current holder requests that same stage with corrected input and a repair reason
  Then the same run and cycle reserve a new bound operation
  And the failed receipt, deadline and consumed counters remain
Scenario: An unsupported retry
  Given an expired, cancelled, unresolved, foreign, unchanged-input or non-review attempt
  When a caller requests review recovery
  Then no child starts and the authoritative stop remains
```

Contracts: reuse feature_improve_controller.yml and feature_improve_recovery.yml; no new invariant namespace. Regression deliverable: tests/integration/improve-review-stage-recovery.test.js (actual child/receipt lifecycle), plus malformed-input coverage at controller-worker/core boundaries. Existing improve-recovery-stage.test.js must still prove no automatic resume. Required checks: focused contracts/integration, canonical suite, independent review and CI. Tests are not yet run; implementation/release are unproven.

## Pre-flight disposition

No CRITICAL or P1 specification gap identified for this bounded non-UI repair. No formal build-ready promotion or passing execution is claimed. The red-before-fix reproduction, scoped tests and review remain mandatory delivery gates. P2: a live pinned job cannot simply have its runtime overwritten; qualify upgrade/recovery separately and preserve any expired job as incomplete.
