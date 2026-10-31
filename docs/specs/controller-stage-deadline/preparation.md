Parent: #172; release dependency #171; subscription policy #232.
Story: CTRL-STAGE-DEADLINE. Bug, infrastructure execution boundary.

A managed real-product build was interrupted after ten minutes despite a later admitted controller deadline. Verified source: `scripts/improve-controller-worker.cjs` calls `worker.awaitStage(child)` without options; `scripts/improve-worker.cjs` defaults to 600000ms and signals the supervisor group. The controller retained a reserved build operation without an authenticated terminal receipt. Product success is not established. Preserve this qualification history; do not replay it or manufacture completion evidence.

## Scope
In scope: stage observation lifetime, controller deadline/cancel authority, receipt preservation, regression tests and operator diagnosis.
Not in scope: extending admitted windows, changing expensive-route limits, replaying holdouts, production merges, or treating a failed qualification as success.

## Requirements
- REQ-01 MUST allow an admitted stage to pass ten minutes while its authorized work window remains open.
- REQ-02 MUST enforce the original controller deadline and cancellation, with no new work permitted during cleanup.
- REQ-03 MUST let the stage supervisor seal authentic completion evidence after the protected child stops; observation must not kill the supervisor prematurely.
- REQ-04 MUST retain uncertainty explicitly if the supervisor or receipt is lost; never claim success, replay, or synthesize a terminal receipt.
- REQ-05 MUST preserve existing output bounds, process identity checks, legacy controller behavior and billable-route controls.

## Acceptance
- [ ] A deterministic regression demonstrates the current premature ten-minute interruption before the fix and passes afterward.
- [ ] Actual subprocess tests verify deadline and cancellation terminate protected work and retain verifiable terminal receipts.
- [ ] Lost-receipt recovery remains explicitly unresolved, without fabricated success or replay.
- [ ] Legacy stage deadlines and output limits remain tested.

## Implementation plan
Inspect controller worker, worker awaitStage, paused-operation supervisor/watchdog and recovery-stage integration tests. Change only the relevant execution boundary and tests; add focused evidence/docs. Keep pinned historical runtime unchanged. Validate focused regressions, recovery/controller suites, then integrated CI before merge.

## Simulation and audit
Four behavioral routes were reviewed: long subscription work, operator cancellation,
returning investigator with missing evidence, and legacy/billable execution.
See #309 comments for the simulation and surgical audit. No UI or database surface.

Existing invariants: I-CONTROLLER-002 (original absolute deadline),
I-CONTROLLER-004 (authenticated terminal evidence), I-CONTROLLER-008
(uncertainty preserves ownership), I-RECOVERY-002 (process/receipt fencing).
CTRL-LIMITS and REC-RECEIPT are test identifiers, not invariant IDs.

## Decision
Keep the existing supervisor/watchdog as the protected-work deadline authority.
The parent observer waits until the original deadline plus 30 seconds for output
and receipt finalization. Waiting late never grants a new work window. The grace
is observation only; cancellation and new-start denial remain unchanged. If the
supervisor never completes, observation fails and receipt uncertainty remains.
Standalone awaitStage callers retain their existing default timeout/output bound.

## Verification mapping
- REQ-01: tests/contracts/controller-stage-deadline.test.js accelerates the actual
  awaitStage timer for v1/v2 adapters; no provider or process is faked as successful.
- REQ-02/03: tests/integration/improve-recovery-stage.test.js launches real processes,
  exercises cancellation/deadline, validates sealed receipts and denies new starts.
- REQ-04: existing recovery negative-path tests and retained interrupted qualification;
  this fix does not reconstruct or accept its missing receipt.
- REQ-05: controller/worker/recovery integration suites preserve other bounds.

The three new regressions failed before the fix. Full real-product repeat and fresh
installed proof remain #172/#171; these infrastructure tests do not establish them.
