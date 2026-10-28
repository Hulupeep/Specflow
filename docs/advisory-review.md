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

Run storage is not a blanket source exclusion. Known private adapter/advisory
directories, generated builder prompts, adapter-smoke transcripts, run control
files and explicitly declared private state stay withheld. Other run-tree
source, tests and accepted contracts remain in the manifest and build patches.

Only the executor-owned `evidence/review-<issue>.md` projection is excluded from
the public source subject. Writing or committing that report does not stale its
own review. Changed source, tests, accepted decisions or routing input do. Scope
status is recomputed at handoff. Missing or edited Markdown is reported, while
findings come from the canonical attempt, never from that Markdown.

The executor requires complete native content coverage of the accepted artifacts
and build patches. Valid consecutive `sed`/Read chunks can satisfy coverage;
one-line access cannot. The complete patches expose all changed code, including
untracked files. Relevant frozen source/test context can be inspected selectively;
the background manifest is an index, not a demand to read every unchanged file.
Inspection and full coverage remain separate receipt facts. This stricter
advisory check does not relabel historical Duo receipts or their pinned policy.

## Attempts and findings

Private attempt files are written once by the executor under
`.specflow/runs/<slug>/advisory/<attempt>/`. They retain the actual invocation,
raw output, frozen input hashes, content receipts and structured result. The
public Markdown is a projection. It names requested and actually observed model
identities separately; absent served-model metadata stays unknown.

Terminal receipts hash-pin the result and native artifacts. The runner retains
the completion anchor and its last observed finding history separately. A
schema-valid canonical rewrite, deletion, or replaced pointer cannot silently
erase earlier concerns at the actual handoff. Historical unanchored records
remain historical evidence; they cannot establish current clean assurance.

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

If native execution finishes but canonical publication fails, the rail stays
pending. It retains invocation and finding history; an outer error with unknown
invocation cannot claim `not_invoked` or advance to provenance. Repair the
reported local artifact obstruction, then resume using retained custody.

If the kernel custody capability is unavailable before an attempt starts, the
runner records an explicit uninvoked advisory gap and continues mandatory
verification. It never substitutes an unsafe lock. Existing active or uncertain
custody stays pending, with its invocation facts retained.

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

A detached session keeper stays alive until cleanup finishes, including when
the direct critic forks and exits immediately. It records custody before
launch and anchors termination of its own session through a short TERM/KILL
grace period, on timeout and on normal completion. The outer executor verifies
the group has ended before publishing a terminal result. Surviving members
retain custody; uncertain termination cannot become a clean review or permission
to duplicate the call. No polling interval is used as proof that descendants
were discovered.

Simulation fixtures must supply a byte-pinned fixture executable in an isolated
PATH. A missing or mismatched fixture blocks before provider authentication or
launch. Such fixtures prove protocol behavior only; actual authenticated host
qualification is recorded separately.

Contract: `docs/contracts/feature-review.yml` (I-REVIEW-001 through I-REVIEW-004).
Journeys: `tests/contracts/feature-review.test.js`, with runner and host-routing
regressions. This replaces the original unbuilt
`docs/specs/feature-review/contract.yml` placeholder; no duplicate contract exists.
The contract is shipped as a framework reference in the Specflow package. It is
not installed as an application's domain contract with unavailable framework
test hooks. Fresh setup projects declare the pinned Zod schema dependency;
existing custom package manifests remain preserved. A legacy copied project
without that dependency reports the capability gap. Use the complete Specflow
package, or explicitly install `zod@4.6.7` in that project before retrying.
