# #218 implementation acceptance index

Source acceptance remains issue218 body/comments. This execution index preserves
its original01–12 and makes proposed13–20 observable; preparation acceptance is
not implementation or deployment evidence. All new original semantics remain.

AC-SERVICE-01: A client disconnect after acceptance can recover the same run through idempotent retry and status.
AC-SERVICE-02: Cross-repo reads/cancel/resume and forged repo paths fail without disclosing private status or logs.
AC-SERVICE-03: Concurrent starts and timer/manual overlap yield one job, not two builds or double provider use.
AC-SERVICE-04: A blocked start or pending GitHub/HeyStax delivery is never presented as successful improvement.
AC-SERVICE-05: CLI and MCP expose the same run/decision/limits, and a restart loses no accepted job or operation identity.
AC-SERVICE-06: A second authorised client recovers an accepted run ID without submitting another job.
AC-SERVICE-07: A request claiming another principal creates no job and reveals no private existence information.
AC-SERVICE-08: A crash before admission creates no orphan worker; a lost response after admission resolves to the original run.
AC-SERVICE-09: Profile/default edits after a lost start response cannot create a replacement run or a false payload conflict.
AC-SERVICE-10: Cancellation fences fresh execution and future publication while preserving finalized results and issued unknown effects; #219 consumes retained cancel intent and qualifies actual PR-race delivery, rather than this facade claiming it executed publication.
AC-SERVICE-11: Two authorised watchers receive the same task: exactly one authoritative job is admitted; the other receives its existing/owned state. A saved text action without admission remains requested, not running.
AC-SERVICE-12: Replace one supported agent with another: recover the same authorised task/job, reject the old assignment before further protected work, and preserve repo isolation. Missing native isolation evidence remains unqualified, not inferred from MCP clients.
AC-SERVICE-13: Concurrent request credentials retain immutable identity; revoked or mismatched current role/holder/assignment are denied with the same opaque envelope for inaccessible known and unknown resources.
AC-SERVICE-14: Stable task/experiment/source/contract claim is independent of retry key; payload/revision changes conflict and blocked retry receipts remain immutable.
AC-SERVICE-15: Actual admission/dispatch/fork/ack/release/receipt/terminal failure boundaries reconstruct one original controller job without extra provider or holdout starts.
AC-SERVICE-16: Known completion, not_started, live issued work, unknown completion and known failed stage stay distinct. Unsupported repair/disposition is explicit and consumed holdout cannot replay.
AC-SERVICE-17: Shared CLI/API/MCP report ID/revision preserves actual causes/failed checks/next actor and separates historical code, current improvement, experiment validity and delivery, including known completed stage failure after cancel/deadline.
AC-SERVICE-18: Service versions/capabilities are separate from qualified worker/backend/billing readiness; unsupported plans/routes and native auth failures keep exact remedy and no substitute execution.
AC-SERVICE-19: Disconnect/credential replacement alone does not cancel accepted host work; explicit cancel stops new execution/publication but preserves original decision, issued receipts and acknowledgement/reconciliation.
AC-SERVICE-20: Queue delay, restart and role replacement preserve original deadline/caps/consumption; an expired queued job cannot start work or acquire a new window.

GATE-FULL: Current canonical local and protected remote CI suites execute with zero required failure/skip; unchanged core/profile/worker/controller/memory/recovery invariants, privacy and independent native review pass on final source.
GATE-JOURNEY: J-SERVICE-RECOVER executes using real local HTTP, two official MCP clients, CLI, durable controller storage and process restart. Actual core/backend/native-worker evidence is labelled separately; protocol doubles cannot establish native isolation or arbitrary-repo support. No deployed cloud service or #219 result delivery is claimed.
