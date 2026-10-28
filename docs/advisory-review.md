# Advisory feature review

The feature-build path includes `5_review` between `5_impl` and `6_provenance`.
`7_ci_handoff` keeps its existing ID. Both shipped runtime profiles select their
own fresh read-only critic. The normal runner invokes this role directly, using
the frozen snapshot, native command construction and content receipts shared
with the existing review engine. It does not start a second preparation workflow.

The critic is advisory. Its output cannot establish specification readiness,
pass explicit Duo, accept native verification, or decide Gate C. Mandatory
verification continues when the critic is unavailable, with that gap visible
at handoff. A stronger accepted project or release requirement still applies.

## Inputs and freshness

A new feature run records its Git base before implementation. A historical run
can reuse its actual matching worktree base or a validated merge-base against
the configured upstream/default branch. Missing defensible base is unavailable;
the runner never substitutes the post-build HEAD and hides committed changes.

The frozen subject includes committed, staged, working and new source files,
accepted ticket/decision artifacts, relevant tests and routing input. Builder
adapter transcripts, State Memory, lessons and session/resume arguments are
excluded. Canonical ticket control data is projected into accepted-ticket.json;
private review history is not copied as builder context. Custom control paths
outside `.specflow/` produce an explicit isolation gap rather than silently
omitting application source. Sensitive files and uninitialised dependency source
cannot count as inspected content.

Only the executor-owned `evidence/review-<issue>.md` projection is excluded from
the public source subject. Writing or committing that report does not stale its
own review. Changed source, tests, accepted decisions or routing input do. Scope
status is recomputed at handoff. Missing or edited Markdown is reported, while
findings come from the canonical attempt, never from that Markdown.

## Attempts and findings

Private immutable attempt files live under
`.specflow/runs/<slug>/advisory/<attempt>/`. They retain the actual invocation,
raw output, frozen input hashes, content receipts and structured result. The
public Markdown is a projection. It names requested and actually observed model
identities separately; absent served-model metadata stays unknown.

Execution is completed, unavailable, invalid or interrupted. Scope is current,
stale or unknown. A missing earlier review is `not_reviewed`, including historical
runs already at rails 6/7. Empty findings means clean only for a valid completed
current review. Errors, missing content reads, missing output and malformed JSON
never become a clean result. Failed preflight is `not_invoked`; a real native
attempt and an explicitly simulated fixture are labelled separately.

Finding IDs and original concerns survive retries. Omission cannot close a prior
finding. Serious concerns remain in handoff even when reported fixed, along with
their rationale and change/check evidence. Deferrals name a tracking issue. These
dispositions remain advisory claims; the owning mandatory gates verify behavior.

## Recovery

The one-shot detached worker records pending custody before native work. On the
currently supported Linux execution path, the existing kernel mutex and actual
boot/PID/start/process-group identity prevent duplicate live work. A returning
terminal observes the existing attempt. Unknown process visibility stays unknown.
If the worker dies while its native child survives, recovery waits for that
owned group to terminate. It then retains the interrupted attempt and starts a
fresh one. An older attempt cannot publish over a later result.

Unsupported process/lock capability is an explicit advisory gap, not a sandbox
bypass or a claim of supported host execution. No recurring timer is installed.
The worker retains the selected timeout and any explicit owner limits. There is
no invented fixed subscription review allowance and no paid/opposite-host
fallback. A configured fallback is never passed to the native invocation.

Simulation fixtures must supply a byte-pinned fixture executable in an isolated
PATH. A missing or mismatched fixture blocks before provider authentication or
launch. Such fixtures prove protocol behavior only; actual authenticated host
qualification is recorded separately.

Contract: `docs/contracts/feature-review.yml` (I-REVIEW-001 through I-REVIEW-004).
Journeys: `tests/contracts/feature-review.test.js`, with runner and host-routing
regressions. This replaces the original unbuilt
`docs/specs/feature-review/contract.yml` placeholder; no duplicate contract exists.
