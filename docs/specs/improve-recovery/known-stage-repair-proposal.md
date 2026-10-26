# Known pre-provider stage repair — scope amendment draft

Status: proposed future scope only. No repair/release command or callback is
implemented or authorised by this document. This draft addresses review F-R10-1;
it does not change #183's frozen acceptance. Current known stage failures keep
repository ownership and need a separately authorised audited repair. Their
reports must name the actual stage failure, not uncertain receipt reconciliation.

A future selected story should qualify a narrow owner-host `repairKnownStage`
transition (or a typed extension to resume) for positively known pre-provider
local failures. An authenticated current executor with current execute grants
may request the check; only an owner-registered trusted host verifier can establish
repairability. Caller text, a model verdict or a filesystem path supplied by the
caller cannot establish that authority. An unsupported repair stays blocked.

Before the transition, authenticate the original complete failed-operation
receipt, input digest, assignment/generation, exact cycle/run binding and current
profile. Positively establish death of its recorded processes. Require no reserved
or uncertain operations, no provider call, no oracle, no frozen contract, no
implementation/holdout consumption and an intact actual core ledger. Verify
current original inputs and the concrete recorded cause's correction using
owner-private evidence. Cancellation, deadline, revocation, auth/quota brakes,
unknown process identity or any failed check deny the repair.

Under the existing authority/controller locks, append `known_stage_repair` with
actual actor, assignment, original operation/seal/input identity, verified repair
evidence digest and timestamp. Remove only the specifically justified known
stage reason, with one stable idempotency receipt. The original failed operation
remains failed and auditable. Changed retry input conflicts. A later stage still
needs ordinary current-authority, paused launch and receipt checks.

Keep original pinned source/config/gateway/pass-fail bytes, job/cycle/experiment
identity, repository ownership, consumed attempts/cycles and deadline. Refund
nothing, extend nothing, replay nothing uncertain, make no product or experiment
verdict, and do not release ownership or publish. A crash during repair must be
recoverable from exact durable intent/evidence without losing the failure or
performing a second protected action.

Future tests must cover real pre-provider local failure/correction/continuation;
missing/false/stale proof; corrupt/swapped receipts; stale/wrong/revoked actor,
repo or generation; live/unknown/reused PID; any provider/oracle/freeze/holdout;
other retained brakes; idempotent and conflicting retries; crashes around the
audit transition; and zero protected calls/refunds/window resets by the repair
itself. Simulate, audit and independently review the new story before building.
