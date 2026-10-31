# Abandoning a frozen cycle before implementation

A blocked baseline is not an implementation attempt. Do not create a dummy build,
change a frozen oracle, delete the controller's owner entry, or extend its deadline
to get past a repository lock.

The version 2 trusted recovery host may expose `resolvePrebuildSource(binding)`.
It resolves the original private `runDir`, its `DurableStore` archive, and (for a
managed backend) the original `backendStore`. These are host bindings, never
caller-selected file paths or a caller-supplied cleanup boolean.

The owner calls `reconcilePrebuild` with `repo_id`, `run_id`, `cycle_id`,
`request_id`, `expected_generation`, and a specific `reason`. This control
operation can run after the original deadline. It launches no models, tests,
servers or product implementation and does not change a Git ref or remove the
old worktrees.

The operation requires:

- A stopped/cancelled/expired run and its exact current repository ownership.
- A positively dead previous holder and a live trusted recovery operator.
- Every issued operation completed, authenticated and quiescent; uncertain
  receipts, processes and backend cleanup remain blocking.
- An intact frozen core ledger with a baseline attempt and no implementation,
  deciding holdout or after verification. The latest baseline may be completed,
  explicitly blocked, or interrupted; an interrupted attempt is recorded as
  untested, after controller process and receipt quiescence is proven. Corrupt
  frozen checks still block recovery.
- On the first attempt, the recorded base and every prepared isolated workspace
  present and unchanged. After a durable abandonment-start record, retries use
  that captured proof; unrelated later changes to main do not strand recovery.
- For managed backends, authenticated terminal receipts for the run's entire
  attempt history, with removed credentials/resources and no active or operator
  fence. This does not clear a fence or infer cleanup from elapsed time. Legacy
  backend contracts without construction identity, missing attempt histories, and
  unconfirmed cleanup remain named blockers; this operation cannot upgrade their
  evidence into managed cleanup proof.

It preserves the full ledger, checks and evidence. The terminal archive explicitly
records `disposition: abandoned_before_build`, `implementation_attempted: false`
and `decision: INCONCLUSIVE`. This means no product improvement was evaluated;
it is not a successful product-build dogfood cycle. The report retains the original
baseline failures. Memory records `not-attempted`, rather than implying a tested
product needs changes. No deadline or allowance is refunded.

Only after the archive is durable does the controller release that run's ownership.
Reuse the same request ID for an identical retry. The core disposition identity
is bound to the run, cycle and frozen contract, so a replacement request after a
lost acknowledgement can finish the same disposition. A core-only prior record
can be adopted by the trusted owner after validating its captured unchanged
base proof and baseline evidence. An identical binding reuses its captured
workspace proof; adoption under a different binding rechecks the workspaces. Later movement of
main does not invalidate that captured proof. Authenticated archive adoption uses
the captured proof, retains the original identity and records the new owner request. All original reasons and the new owner request remain
in the audit trail. Retried acknowledgements
cannot release a successor's ownership or create a second memory result. A new
run needs a separate authorisation; revisiting the same idea still requires fresh
relevant executed evidence.

If any proof is missing, preserve the run and inspect the named blocker. Neither
this operation nor a later passing job turns the failed attempt into a pass.

A losing backend claimant may leave an inert attempt record. Recovery accepts it
only with a dead owner, no matching active claim, and no other per-attempt record
or mutation fence. A cleanup terminal plus its matching signed release can prove
cleanup even when the dead process did not unlink its active claim. Recovery
retains that claim; it never clears it to start another job under the same identity.

If controller persistence fails after archive publication, a retry uses that
bound, authenticated archive even if live source files were lost. It retains the
damaged source unchanged. Missing or corrupt archive evidence still blocks release.
Frozen generated-output exclusions are respected without staging Git changes;
tracked source changes and undeclared untracked files remain blocking.

This API requires a version 2 recovery host. Version 1 controller runs need an
explicit migration path and are not silently upgraded by abandonment.

A signed record for another run is excluded before validating that run's attempt
schema. An unreadable or unauthenticated record cannot safely be attributed to
another run; recovery names the offending record and retains ownership. It does
not ignore unknown records or infer that they cannot own resources.

Host-run baselines with setup/server commands, or interrupted after verification
starts, remain blocked as `prebuild_descendants_unproven`: a dead parent does not
prove its detached children stopped. Interruption before verification starts is
eligible. Managed backend recovery instead requires signed resource cleanup and
matches every recorded core attempt reference to its authenticated backend history.
Orphan backend records and missing referenced attempts remain named blockers.
Recovery rejects configured Git filters and diff/merge drivers before inspecting
workspace status, so inspection cannot invoke a repository's external driver.

Host quiescence covers every recorded baseline attempt, including earlier attempts
before a later completed baseline. Any timed-out host command also blocks release;
parent-PID death does not establish process-group or detached-child cleanup. This
API supplies no general process-group cleanup proof. The same checks apply when
adopting a terminal archive. Repositories with indexed submodules are unsupported
for this recovery operation and remain blocked before Git status can recurse.
Retries using an already captured unchanged-workspace proof do not run Git status
or inspect subsequently added drivers. An abandoned outcome cannot acquire either
an experiment verdict or a delivered-proposal observation.

All frozen contract versions are hash-checked during live recovery and archive
adoption. If their runtime declarations differ, recovery remains blocked as
`prebuild_runtime_history_changed`; changing runtime cannot erase earlier cleanup
obligations. This operation does not yet reconcile mixed-runtime histories.

Guarded commands and native checks record a command start before execution and a
matching result afterward. An unmatched start blocks recovery, including commands
outside a baseline. Historical records without these starts cannot retroactively
prove command-level quiescence; controller recovery still requires sealed terminal
receipts for every issued operation. Normally exiting commands that intentionally
leave detached children are not independently proven clean by the parent PID;
managed resources require the separate signed backend cleanup proof.
