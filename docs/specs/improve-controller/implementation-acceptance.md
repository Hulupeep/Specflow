# #181 implementation acceptance index

Verbatim behaviour acceptance from story.md (original issue and planning supplements) and preparation.md (four accepted additions). Those sources and YAML remain authoritative. Controller delivery excludes automated recovery and live timer activation until #183; retaining that boundary does not mark activation done.

AC-09-1: A loop starts a new cycle only after the previous cycle has a durable terminal decision.

AC-09-2: Cycle, spend and time limits are checked at safe boundaries; exhaustion stops honestly without fabricating completion.

AC-09-3: Model retries/fallbacks consume the same registered budget rather than resetting it.

AC-09-4: Remaining budget/limits are visible in status and final report.

AC-09-5: Reaching the requested cycle count is never itself a success criterion.

AC-LIMITS-01: Each limit has a deterministic stop test, remaining allowance and preserved history; quota unavailability is not mislabeled budget exhaustion.

AC-LIMITS-02: The user can distinguish provider quota, protocol failure, test failure, no progress, deadline and operator cancellation.

AC-LIMITS-03: Duplicate timer delivery cannot create a second run; missed and skipped occurrences remain visible.

AC-LIMITS-04: A manual and scheduled request racing produce one owner and one explicit busy result.

AC-LIMITS-05: An empty opportunity set creates no patch/PR; a verified nightly run honours its original limits across restart.

AC-LIMITS-06: After an acknowledged pause/disable no new occurrence starts, including after restart; status distinguishes run cancellation from schedule state. — from Owner/cancel versus schedule.

AC-LIMITS-07: A profile edit plus redelivery returns the original occurrence or a recorded stale/blocked result, never a second job. — from Returning operator/profile edit and redelivery.

AC-LIMITS-08: Revoked or undefined authority yields authority_revoked or authority_unresolved and no provider work. — from Authority/delegation revoked.

AC-LIMITS-09: Controller/recovery tests can run before activation; enabling a schedule without recovery evidence is blocked; restart never extends the deadline. — from Returning operator/dependency activation cycle.

AC-LIMITS-10: Authenticated principal+canonical repo+manual request ID binds original inputs durably; identical retry returns the same run even after completion/restart. Changed inputs conflict. Authorise before duplicate/busy/private history lookup. CLI requires the owner to supply a stable request ID; a different ID expresses an intentional new request.

AC-LIMITS-11: Admission durably captures immutable original limits, absolute deadline, profile revision, policy digest, creator authority and canonical repo identity before any launch. Reserve each cycle and provider invocation before it starts. Failed/uncertain starts never refund allowance. Original grants and current same-revision authority intersect at each protected start; profile replacement never resets limits.

AC-LIMITS-12: Status is a read-only projection of durable state, with original/consumed/reserved/remaining limits, exact primary/all stop reasons, stage, last completed action, failing check and evidence, usage knownness, retryability and one recovery action. Distinguish no_safe_work from pending_review and actual charges from partial estimates.

AC-LIMITS-13: Process/lock/operation uncertainty yields reconciliation_required with retained ownership and evidence, never automatic restart, lease expiry takeover, another holdout or fabricated core decision. #183 alone adds verified reconciliation/resume.
