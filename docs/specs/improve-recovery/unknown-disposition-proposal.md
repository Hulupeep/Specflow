# Unknown external operation disposition — scope amendment draft

Status: proposed future scope only. No disposition/release command is implemented
or authorised by this document. Existing REC-RECEIPT quarantine and no-replay
acceptance remain unchanged. This draft addresses review F-R9-3; it does not
silently expand #183's immutable implementation acceptance.

The proposed owner-only `disposeUnknown` command would accept a strict job,
original operation ID, idempotency key, expected generation, disposition and
reason with evidence references. The authenticated original repository owner
must explicitly choose `abandon_unknown_without_completion`. An executor,
researcher, model output, ticket prose or broad execute grant cannot do so.

Under the existing authority and controller locks, verify current owner grants,
exact original binding and observation seal, positive death of every recorded
issued process, and no other unreconciled reserved work. Append a permanent
`unknown_operation_disposition` audit event with the actual owner principal,
input digest, original receipt/observation identity, reason, evidence and time.
Record an abandoned-unknown tombstone, never a complete receipt or successful
core decision. Release repository ownership only in that same durable transaction.
Idempotent retry returns the original disposition; changed input conflicts.

Preserve the original deadline, consumed attempts/cycles, native session,
operation identity, unknown evidence and any genuine archived results. Do not
refund consumption, reset a work window, infer provider cancellation, credit
KEEP/REVERT or experimental disproof, replay the uncertain call, rerun consumed
holdouts, or release a different job's ownership. Any later job needs fresh
explicit authority and must retain prior uncertainty in its decision memory.
Delivery remains separate; no publication, merge, deployment or scheduler starts.

Required future negative verification: non-owner and revoked owner; forged or
cross-repository binding; live/unknown/reused PID; additional unresolved work;
missing/corrupt/conflicting observation; stale generation; mismatched retry;
crash before/after the disposition transaction; a later exact receipt arriving;
new job ownership racing disposition; and no additional provider/holdout starts,
no refund, no experimental verdict or product success. A new selected story must
simulate, audit, review and qualify this command before implementation.
