# #183 recovery and #235 B selected preparation

Sources: imported story.md and effort-policy-source.md. Preserve all original
Coverage: AC-11-1..6, AC-RECOVERY-01..10 and AC-EFFORT-01..05. This document supplements
them; it does not mark runtime recovery or nightly release proven.

Weight: high-risk persistent/authenticated behaviour. Reuse #181 controller,
#182 memory, #216 profile authority, #217 worker/archive and #235 A review policy.
Kill check: a second executor or time-expiry lease would duplicate authority and
unknown side effects; extend the existing engine with kernel exclusion, fenced
execution and exact receipt reconciliation. No new DB/RPC or graphical UI.
No SQL, pgTAP, selectors or browser journey is invented for this host/CLI slice.
Future #218 API/MCP and #219 publisher/HeyStax transport remain thin.

## Simulation Findings (proposed)

Three independent read-only persona agents walked these routes, then findings
were consolidated. These are paper simulations, separate from the executed
six-assertion Linux flock/SIGKILL capability experiment.

- Interrupted/returning operator: finish a cycle, lose the holder, recover the
  same job. Divergences: kill before/after rename, admitted launch without PID
  ack, corrupt receipt, consumed holdout and partial initialization. Add exact
  format/initialization and receipt-to-operation states; unknown never means safe.
- Replaced/adversarial worker: authorized successor claims after quiescence.
  Divergences: stale live holder, cross-repo/revoked identity, concurrent resume,
  late receipt and reused PID/PGID. Add boot-bound identity, current host assignment,
  synchronized outbound fencing and owner inspection separate from execution.
  The registry mkdir mutex is also crash-sticky; fixing only the writer is inadequate.
- Subscription/costly-route operator: >24 useful calls within one work window.
  Divergences: explicit cap, horizon during a call, unmeasured quota, falsified
  cheap label, repeated failure and stale KEEP report. Add nullable v2 ceilings,
  exact merge rules, registry-based route class, receipt-only late reconciliation,
  evidence-backed report revision and one agent-owned next action.

Accepted within current owner direction (no new product/UX decision is required):
- REQ-RECOVERY-11 / AC-RECOVERY-11: Both controller and profile authority locks in
  opted-in v2 mode survive real process death without unsafe stale-lock deletion.
  Old v1 bytes and active/uncertain work are not silently adopted or rewritten.
- REQ-RECOVERY-12 / AC-RECOVERY-12: Missing launch ack is unknown, not no-child.
  Recorded generation, immutable operation inputs and host/process identity bind
  each protected start and receipt. Only the current holder reconciles a receipt.
- REQ-RECOVERY-13 / AC-RECOVERY-13: Late receipt reconciliation is read/adoption
  only after horizon/cancellation, with the original window and usage unchanged.
- REQ-RECOVERY-14 / AC-RECOVERY-14: Durable report ID is stable and revisions
  reflect reconciled facts. Historical KEEP, missing retained artifacts or unknown
  work cannot alone establish current product improvement.

## Audit phase 1 — gap analysis

Present: outcome, scope, original requirements/negative acceptance, prior
simulation, planned verification and source trust invariants. Missing selected
executable decisions: lock formats/initialization, holder/delegation identity,
launch/receipt reconciliation, optional limit semantics, report projection and
mapping. Those missing parts are added below and in interface.d.ts/new contract.
No source implementation is authorized by this draft alone; promote only after
current preparation gate and independent native review have no CRITICAL/P1.

## Audit phase 2 — surgical decisions

### D1: explicit versioned kernel exclusion

V1 stores/runtimes retain their existing format and limits. New v2 host
configuration explicitly selects format2 for BOTH registry authority and controller
store. Linux-only capability requires a registered `/usr/bin/flock` executable,
exact hash/version and successful real lock qualification. No silent platform
fallback. A permanent owner-private lock inode is never unlinked/rotated. Acquire
Linux flock via an inherited descriptor; the host retains that descriptor through
the complete protected transition and synchronous launch. Kernel process death
releases exclusion, not any timer/PID heuristic.

Publish a fully written/fsynced versioned lock header atomically with exclusive
hard-link creation from a unique owned candidate; never replace an existing lock.
A crash may leave a candidate alias; reclaim only that exact same-inode owned
candidate under kernel exclusion. Reject extra links, symlinks, wrong owner/mode,
invalid headers or a legacy mkdir/writer lock. Controller state is version2 with
all original bounded envelope fields; no second DB or execution ledger.

V2 registry retains a permanent private `.authority-lock` directory containing
its permanent `kernel-v2.lock` inode, fencing old mkdir clients. This permits a
qualified quiescent migration to acquire the legacy mkdir once and retain that
same directory; it must never remove a live legacy directory. V2 controller uses permanent `writer.lock`, fencing old wx clients.
No active old operation is migrated. An explicit owner-only migration command
may convert only a declared dedicated private host (one registry and its complete
registered store inventory), after exclusive legacy authority/store admission and
proof no active/unknown stage/provider/cycle exists in that inventory. Unknown
registry consumers or incomplete inventory make migration unavailable. Under the
legacy mutexes it first fsyncs a migration intent with old inode/snapshot digests,
then retains the authority directory, publishes its kernel inode, writes the v2
writer header on the exclusively owned writer inode and atomically commits v2
state/receipt. A partial header is repairable only through that matching intent
and still-exclusive authority; otherwise it is incomplete/unknown, never fresh. It appends a
migration receipt with original snapshot digest, preserves all run IDs, authorship,
limits/deadlines/history and leaves old runtime bytes unchanged. If safe migration
cannot be established, return `legacy_recovery_unavailable` with read/status
available; never delete an unknown v1 lock. Partial v2 initialization is recognized
from the authenticated header and safely completed under its kernel lock, or
reported as `recovery_initialization_incomplete`; never treated as a blank job.
This is the reviewed migration path required by #235, not an automatic grant.

### D2: host-bound generation and launch

Current owner-private host assignment supplies holder, assignment revision,
principal and process identity. Identity = host boot ID + PID + /proc birth ticks;
missing process visibility is unknown. Preserve original run principal as origin.
Current execute grants intersect with explicit owner assignment for a successor;
no caller identity field or task text grants delegation. Same-principal replacement
also needs a new authenticated assignment/generation. Owner can inspect preserved
delegate history through current read authority; unrelated/cross-repo callers
receive nothing. Former holder's private context remains fenced.

Claim/resume is a stable command with expected generation and idempotent input.
A generation transfers only after old holder AND all issued owned processes are
positively quiescent and no unresolved launch exists. Do not infer this from an
expired lease. Generation validation, intent commit and synchronous protected
launch serialize with authority/replacement. The worker/provider context carries
its fixed generation; caller JSON cannot replace it. The check occurs before
every stage/provider start, not only before receipt writes. A reused PID/PGID is
neither old authority nor a cleanup target; strengthen the existing watchdog.

Use the existing stage/provider gateway with a fixed paused-child handshake:
commit intent, spawn an inert child, persist actual boot/PID/birth and input digest,
then authorize release. Parent/pipe loss before release terminates the inert child.
Never issue protected work before release. Kill-between-spawn-and-ack stays unknown
until independently proved quiescent; zero recorded children is insufficient.
A receipt from an old generation can remain private auditable evidence; it cannot
change authoritative state directly. Current holder alone adopts exact matching
proof. No arbitrary executable, process group or receipt path enters requests.

### D3: operation and terminal reconciliation

Durable intent binds run/cycle/operation, kind/stage/role, generation, fixed input
hash, core/contract/runtime identities and original consumption. State distinguishes
intent, released/issued, complete, confirmed-not-started and unknown. No automatic
retry from unknown. A killed issued call has already consumed its start allowance.
A confirmed-not-started checkpoint may continue only with fresh admission under
the same job/window; it does not refund history or replay consumed verification.

Existing owner-host code writes private integrity-bound operation receipts before
acknowledging completion: typed result, stdout/stderr hashes and original binding,
atomic fsync/rename and authenticated store proof. Trusted configured resolver
accepts opaque IDs, never caller paths or claimed completion. Receipt adoption
requires exact original operation/generation/input binding, authenticated bytes,
current actor and expected revision. Lost-ack replay returns the same receipt;
conflicts/corruption/unavailable evidence retain unknown. An archive cannot clear
an unrelated reserved provider. Reconcile each exact operation before completeCycle
uses its existing DurableStore/verifyTerminalArchive path, which atomically appends
memory and the terminal decision. Core consumed holdout/exposure/frozen checks are
unchanged. Crash after holdout consumption but before result never permits rerun.

Cancellation blocks starts immediately and reports cancelling while issued work
is unresolved. Stop only positively owned processes, retain proof before cleanup,
and never remove another workspace. Receipt-only reconciliation can occur after
cancellation/deadline without new stage/provider/checker/holdout execution.

### D4: progress-led effort, finite window

V2 limits are exactly `{maxCycles, maxAttempts, maxConsecutiveNoProgress,
maxWallMs}`. `maxAttempts` and `maxConsecutiveNoProgress` permit null = no
invented hard cap. Defaults: maxCycles1, both optional ceilings null, maxWallMs
7,200,000 (2h). An explicit overnight registration selects28,800,000 (8h).
Longer explicit registration may use the existing finite7-day ceiling, never
an automatic chain/extension. V1 defaults24 starts/2 no-progress/30min stay exact.

Request overrides can only tighten registered ceilings: null/increase cannot
remove a finite registered cap; absent inherits; finite can tighten null. Bound
values remain safe positive integers within existing hard numeric schema bounds.
Resume retains original limits, deadline and consumed counts. Core-specific frozen
build/holdout budgets remain unchanged. Stagnation is a diagnostic boundary;
current-evidence-backed different repair can proceed when no owner cap forbids it.
Renamed evidence/strategy does not count as progress or excuse uncertainty.

Route class comes from owner-registered immutable routing/effort policy, matched
to actual requested/effective model and role at the trusted provider gateway.
No model-name price inference and no request cheap/subscription relabel. Registered
expensive routes require an explicit finite start ceiling, preserved across resume;
unknown billing denies starts. Qualified subscription quota/capacity may remain
unmeasured without blocking; observed quota/auth rejection does block precisely.
No API/Kimi support or paid fallback is introduced: unsupported routes fail before
invocation. Report declared mode, estimated usage and unmeasured charges separately.

### D5: morning report and delivery boundary

Derive report from store/verified archives/memory. Stable report ID = run ID;
revision reflects its factual input digest. Preserve original source criteria and
baseline, actual retained commit/tree and measured before/after claim. Distinguish
code KEEP/REVERT/INCONCLUSIVE, experiment proven/disproven/needs-change, verification
validity, retained versus merely proposed branch and unknown work. Historical KEEP
without available evidence/current retained state cannot establish improvement.
When no supported gain exists say `improvement not established`, never synthesize
success or disproof. Preserve concrete regressions and unevaluated risks.

Show original/remaining window and ceilings, consumed attempts/cycles, billing
knownness, precise stop/unknown cause and one next action. Routine repair/recovery
belongs to the agent. Only a real intent/permission decision belongs to the owner.
Late authenticated reconciliation revises this same report; notification failure
cannot change the decision. External notification/publisher remains #219.

## Executable acceptance mapping and DoD

| Check | Requirements / source AC | Planned executable proof |
|---|---|---|
| REC-LOCK | RECOVERY11;11-1 | tests/integration/improve-resume.test.js: real SIGKILL in both locks, initialization phases, old runtime exclusion, migration refuses active/unknown work |
| REC-FENCE | RECOVERY01/07/08/09/12 | same file: simultaneous claims, former/revoked/wrong-repo/principal, birth/boot reuse, kill after fork before ack,0 former-holder starts |
| REC-RECEIPT | RECOVERY02/03/04/12/13;11-2 | same file: actual intent/issue/receipt/rename kills, corrupted/missing/swapped proof, consumed holdout, late receipt and cancel;0 replay |
| REC-CYCLE | 11-1/6;RECOVERY09 | same file: actual two core cycles, interruption/replacement, same job/contract/history/usage, one terminal memory/proposal |
| EFFORT-V2 | EFFORT01/02/03/04/05;RECOVERY06/10 | tests/contracts/improve-limits.test.js plus resume integration:31 real protocol starts, exact explicit cap/window, route forgery denied, genuine quota distinguished |
| REC-REPORT | 11-3/4/5;RECOVERY05/08/10/14 | tests/contracts/improve-report.test.js: authentic retained/no-gain/unknown, lost ack/report revision, one owned next action |
| GATE-FULL | existing release floors | canonical CI including current main; no required skip/failure; unchanged core/worker/memory safety, source/privacy and independent final review |
| GATE-LIVE | original broader AC | real supported backend/native interrupted run with actual immutable archive; label protocol/native/backend evidence separately; do not close original AC from fixture mechanics alone |

Minimum release is not full issue completion. Actual multi-cycle/native proof
remains required for original #183 and parent #215/#172 completion. Test references
above are planned, not execution claims. No production code is in this preparation.

## Audit phase 3 — pre-flight pending

CRITICAL: none asserted from paper analysis alone. P1 pending: exact interfaces,
new contract, preparation gate/native review and dependency capability receipts
must be current before build-ready. This is NOT compliant or production eligible
until those artifacts and independent pre-flight clear. The six passing kernel
capability assertions prove only the selected Linux primitive, not recovery.

### Current local pre-flight disposition

The exact interfaces/new v2 contract and mapped checks are now present. The local
preparation gate executed115 assertions,0failed/skipped, including a genuine
six-assertion process-kill/kernel experiment. Current upstream canonical CI1776
passed with0failed/skipped; its virtual merge tree matches main0fee60a exactly.
Local selected design has no remaining identified CRITICAL/P1 after incorporating
the three persona findings. `simulation_status: completed_paper_routes`.
Independent native pre-flight is still pending; no build-ready or runtime
compliance claim follows from this local disposition. Unsupported/native backend
behaviour remains a required implementation/release proof, not a waived gate.

```gherkin
Scenario: Death releases both v2 transaction boundaries
  Given a qualified private v2 authority and controller store
  When the holder is killed while committing a protected transition
  Then the next authorized process can inspect the same committed job
  And no legacy/live lock is removed and no unknown operation is replayed
Scenario: A late receipt is evidence without a new work window
  Given an issued operation crossed its original deadline
  When the current assigned holder adopts exact authenticated completion proof
  Then the same job/report is revised once
  And no new stage, provider, holdout or extended deadline is authorized
Scenario: Subscription progress has no invented starts ceiling
  Given the registered v2 subscription policy has null starts ceiling
  When 31 real protocol invocations complete within the original work window
  Then all remain admitted with their actual consumed counters
  And a separately configured finite ceiling still stops exactly at its bound
```
