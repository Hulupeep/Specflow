# Bounded owner-local controller (#181)

This milestone adds admission, original allowances, exact diagnoses, canonical
repo ownership, provider and worker-stage guards around the qualified #217
worker. It is not a managed service, HTTP/MCP endpoint, plugin or live scheduler.
Those follow minimum memory #182, recovery #183, then #218/#219. The qualified
execution recipe remains the owner-invoked zero-dependency Node HTTP fixture on
the observed Linux/Docker host. No arbitrary repo, Next/Supabase or API-billed
route is qualified by this change.

Use `specflow improve-controller <register|admit|status|report|cancel|schedule>
--host /absolute/owner-private-host.json`. Registration also takes `--file` for
an owner-private ControllerPolicy v1. Admission requires `--repo` and a stable
`--request`. Status/report/cancel take `--run` as applicable. Admission records
work; a trusted owner-host adapter starts the worker. No caller body supplies
commands, file paths, principal, provider or permission overrides.

Host v1 supplies uid, principal, ownerPrincipal, store, registry and observed host
capabilities. Keep it and policy files mode0600 outside target repositories; the
store is0700. The original strict RepoProfile v1 is unchanged. The companion
policy binds its exact revision, positive finite limits and optional daily
schedule intent. Default limits:1cycle,24native attempts,2non-progress events,
30minutes. More cycles require explicit owner policy; caller limits only lower
that policy. Subscription dollar estimates cannot enforce actual spend. An
actual-dollar ceiling is rejected as `unmeasured_spend_limit` with a remedy.

`createControllerWorker` binds a private pinned #217 job config to one controller
run/cycle. Every root build/test/core stage reserves a durable intent before
spawn, checks deadline/cancellation/current profile authority, and records its
actual PID/birth and outcome. Native gateway invocations must descend from the
active owned stage. All native roles, retries and configured fallbacks share the
original CLI-start counter. Requested aliases and observed full model names are
separate identities. Do not use an unguarded worker launch in a controller job.
The qualification helper binds the old helper's launch/wait methods only inside
its one-job process; the production adapter has no global monkeypatch.

A native failure with known process completion can be retried by the existing
core workflow only within the same original allowance. Its prior diagnosis,
evidence and consumed count remain. Quota/auth failure stops for restored access;
unknown launch/lock/process/receipt stays quarantined for #183. No automatic
replay, takeover or deadline extension exists here. Native calls and active
stages are terminated at cancellation/deadline boundaries; independent guardians
allow at most1000ms for bounded quiescence/receipt cleanup after the absolute
deadline. This does not allow another inference or evaluation stage. Existing
bounded durable evidence capture/reporting can finish after a terminal core
decision; it never supplies a fresh decision or reruns a holdout.

`status` is live and read-only. `report` projects final/stopped state with original,
consumed/reserved/remaining allowances, precise primary/all reasons, failed check,
evidence, actual charges unmeasured and partial CLI estimates. A quiesced final
report is byte-stable; incomplete output is explicitly incomplete. Successful
cycle count does not mean improved software. Only verified core KEEP marks a
retained result, and pending owner review keeps the repo blocked. Cancelling an
old result cannot release a newer owner's lease or resolve pending review.

Pause/disable affect future admissions; cancellation is separate. Schedule enable
always returns `recovery_required` in production. Synthetic schedules require a
separate simulation store, launch no provider, choose the earlier ambiguous UTC
slot, skip nonexistent/late slots, and preserve their original disposition across
replay/profile edits. Their results are not a nightly deployment claim.

Qualification: run `node evidence/improve-controller/run-live-controller.cjs
/absolute/owner-private-worker-input.json transport` to create a NEW private case.
Then use `configure`, followed by `begin`, `critique`, `oracle`, `seed`, `freeze`,
`baseline`, `build`, `verify`, `judge`, `evaluate`, `finalize`, `persist`, always
supplying that NEW case root after the phase. Each phase is once-only and retains
its result; an interrupted/failed phase requires diagnosis, not automatic replay.
This delegates to the same core/worker and existing browser/backend seed probe.
The transport's two approved native metadata/role probes precede controller
admission and are reported separately. Never point this driver at a consumed
#180/#217 case. Do not replay the candidate holdout or refinalize a terminal core.

Execution results and current independent acceptance will be recorded separately.
Implementation, tested, merged and deployed are distinct. No CI or deployment
success can be inferred from local test output.
