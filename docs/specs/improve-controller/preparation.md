# #181 selected controller preparation

Selected from main8e30c68 on2026-10-25. High weight: persistent identity, permissions, concurrency and existing agent behaviour. Reuse #216 profile authority, #217 qualified owner-local Node worker and existing Improve core. No new public API, plugin, database, daemon, deployment or production scheduler. Existing issue acceptance is in story.md; this supplement does not replace it.

## Simulation Findings (proposed)

Three independent deep walkthroughs ran before uplift. They are paper simulations, not execution or Duo acceptance.

- Authority delegate: authorised start→revoke→retry; forged identity→private dedup lookup; profile change→same timer delivery; alias→repo collision. Gaps: authenticate before looking up private requests, revalidate authority at every provider/cycle start, stable manual identity after completion, canonical repo exclusion and immutable policy snapshot.
- Interrupted operator: launch→crash before acknowledgement; uncertain child→restart; cancel→late outcome; wrong-cycle archive→advance. Gaps: reserve original counters/operation before launch, atomic durable admission, quarantine uncertain work, distinguish active ownership from #216 start leases and #217 terminal evidence, independently verify the exact terminal receipt.
- Subscription owner: normal cycle→useful morning report; lost acknowledgement; estimate→hard dollar ceiling; exact attempt/deadline equality; Dublin autumn/spring; pause race; several missed nights. Gaps: define units/precedence, reject unsupported actual-spend enforcement, DST policy, lateness and report all limits/reasons without claiming cycle count means improvement.

Concrete proposed additions, accepted for this build under the owner's standing instruction to use inferred judgement:

- REQ-LIMITS-10 / AC-LIMITS-10: Authenticated principal+canonical repo+manual request ID binds original inputs durably; identical retry returns the same run even after completion/restart. Changed inputs conflict. Authorise before duplicate/busy/private history lookup. CLI requires the owner to supply a stable request ID; a different ID expresses an intentional new request.
- REQ-LIMITS-11 / AC-LIMITS-11: Admission durably captures immutable original limits, absolute deadline, profile revision, policy digest, creator authority and canonical repo identity before any launch. Reserve each cycle and provider invocation before it starts. Failed/uncertain starts never refund allowance. Original grants and current same-revision authority intersect at each protected start; profile replacement never resets limits.
- REQ-LIMITS-12 / AC-LIMITS-12: Status is a read-only projection of durable state, with original/consumed/reserved/remaining limits, exact primary/all stop reasons, stage, last completed action, failing check and evidence, usage knownness, retryability and one recovery action. Distinguish no_safe_work from pending_review and actual charges from partial estimates.
- REQ-LIMITS-13 / AC-LIMITS-13: Process/lock/operation uncertainty yields reconciliation_required with retained ownership and evidence, never automatic restart, lease expiry takeover, another holdout or fabricated core decision. #183 alone adds verified reconciliation/resume.

## Audit phase1 — gap analysis

Type: owner-local CLI/agent controller, no graphical UI. PRESENT: outcome, original ACs, dependencies, privacy/core invariants, three divergent simulations. MISSING: selected durable schema, precise counter units, terminal-receipt verification, public/private interfaces, schedule/authority decisions, negative mappings and DoD. Earlier planning choices were explicitly unresolved; none is treated as implemented.

## Audit phase2 — surgical decisions and interfaces

### Selected decisions

1. Delivery order: #181 controller primitives (live timers OFF)→#182 minimum owner-decision memory→#183 recovery→#218 API/MCP→#219 plugin. Never claim scheduling/recovery/API capability from controller tests. Activation always returns recovery_required in this milestone; synthetic occurrence tests cannot enable a timer.
2. Owner-local private filesystem store, mode0700/0600, atomic exclusive writer lock, fsync temporary snapshot→rename→fsync parent. Single committed snapshot is the admission/control ordering point; append retained history in that snapshot. No SQL/RPC/schema migration. Reject symlink/unsafe/overbroad store paths and corrupt state. An uncertain writer lock cannot be auto-deleted; status can read the last committed snapshot. No store path comes from repository or agent text. Bounded state sizes/history fail closed rather than silently evicting identity records.
3. Strict ControllerPolicy v1 is owner-registered alongside the unchanged strict #216 RepoProfile v1, bound to its exact revision/digest. Fields: repo_id, profile_revision, finite limits, optional daily schedule, creator principal, usage_mode=subscription_cli. Registration requires trusted host owner identity and execute authority; caller supplies only repo_id, request_id and optional smaller limits. Trusted host supplies principal and capabilities. ControllerPolicy is not a caller-created execution profile. Do not add unsupported fields to #216 v1 or change its frozen invariants.
4. Profile authorisation lock precedes controller lock; never reverse or hold either lock across model work. Every real native provider start passes through the controller admission gateway, which forwards only the registered CLI path/hash and approved no-I/O arguments. Generated gateway/context enter #217's existing pinned launcher closure before a cycle freezes. Metadata --version/auth status does not spend an inference attempt. No repository-controlled commands, caller principal, new fallback or credentials cross this boundary.
5. All native inference invocations count, across builder, oracle, peer, judge, retries and configured fallbacks. Counters measure CLI starts, not unobservable internal provider HTTP retries; deadline bounds process lifetime. Increment before spawn, retain uncertain/failed reservations. maxCycles counts started cycles; terminalCycles separately counts authenticated durable terminal outcomes. noProgress increments for verified non-KEEP outcomes and a diagnosed failed iteration; KEEP stops pending_review. no_safe_work creates no cycle, patch or PR. Never retry unknown/partially consumed cycles. All limits are positive finite safe integers; maxCycles default1, maxAttempts default24, maxConsecutiveNoProgress default2, maxWallMs default1800000. Optional caller limits can only lower registered values. maxCycles>1 requires explicit owner policy.
6. actualApiSpendCeilingUsd is unsupported on subscription_cli: reject configuration/admission with unmeasured_spend_limit and exact remedy, never ignore the ceiling or substitute estimated dollars. actual spend/remaining are null/unmeasured, estimates separately labelled partial provider telemetry. Quota/auth/protocol/test failures retain actual diagnoses; login metadata never proves future quota. No API fallback.
7. At each protected start check all applicable reasons in precedence: cancellation, authority/stale profile, reconciliation_required, pending_review, deadline, attempts, cycles (new cycle only), no_progress. Equality exhausts a bound; reaching final count stops execution but does not prove gain. Preserve all simultaneous reasons. Cancellation durably fences future work; active operation is cancelling until owned process quiescence/receipt is known. A genuine late result is retained but cannot start another cycle.
8. Durable per-canonical-repo owner excludes all aliases, profiles and principals. Busy is explicit, not queued. Duplicate manual requests remain bound after release. Unknown operation keeps the repo quarantined even after wall deadline or worker death; no TTL takeover before #183. Missing evidence or corrupt/wrong-repo/principal/job/cycle/profile/core receipt fails closed. Only a verified #217 durable result, valid core ledger and exact frozen run identity permit cycle completion. Controller never calls DurableStore.commit with its own invented decision.
9. Pause/disable affect future admissions only; already admitted jobs continue under their original limits/current authority. Cancel-run is separate. Controls and synthetic occurrence admission share durable ordering. Creator-bound authority is revalidated; revoked/undefined authority blocks without service-account elevation. Rejected/revoked/late occurrence is terminal for that slot; restoring authority requires a fresh intended slot/manual ID, not automatic catch-up. Pending retained KEEP blocks ALL further repo work until authenticated #182 decision support exists; controller cannot infer approval from PR closure.
10. Daily slot identity = canonical repo + immutable schedule ID + IANA zone + intended local date/time; independent of mutable profile revision/delivery UTC. Autumn ambiguous slot chooses earliest UTC and both deliveries resolve to that slot. Spring nonexistent slot gets skipped, no substitute. Policy edit affects future unadmitted slots only; prior occurrences keep their captured identity/limits. Late grace300seconds, then missed; no replay storm. Missed ranges can be bounded summaries with first/last/count, never hidden. Explicit synthetic dispatch is test-only and cannot invoke a provider/live scheduler. Status distinguishes disabled activation from schedule intent/next intended slot.

### Versioned private interface (to implement, not an existing public API)

ControllerService.registerPolicy(hostContext, policy)
ControllerService.admit(hostContext, {repo_id, request_id, limits?})
ControllerService.status(hostContext, {repo_id, run_id?})
ControllerService.cancel(hostContext, {repo_id, run_id})
ControllerService.controlSchedule(hostContext, {repo_id, state:'paused'|'disabled'|'enabled'})
ControllerService.syntheticOccurrence(hostContext, {repo_id, local_date, local_time}) // zero inference; activation OFF
Internal service reserveCycle/reserveAttempt/recordAttempt/completeCycle takes trusted adapter context only, not a public caller payload. Public transport is #218; reconciliation/resume is #183. Exported JS is a trusted-host API, not a sandbox for hostile same-UID callers. No graphical data-testids; structured JSON reason_code is the selector. No production payload accepts commands, filesystem paths or claimed principal.

Store envelope v1: revision, policies, requests, canonicalRepoOwners, runs, occurrences, schedules, history. Run captures id, authenticated principal, canonical repository, profile_revision, policy_digest, request_hash, created_at, deadline_utc, original_limits, consumed_cycles, terminal_cycles, consumed_attempts, consecutive_no_progress, active_cycle, active_operations, state, reasons, last_completed_action, failed_check, evidence, cancel_requested, actual_spend_usd:null and labelled estimates. Strict envelope/version/field/size validation before use; no arbitrary executable contents. Atomic mutation failures acknowledge no completion; actual disk faults and lost acknowledgements are tested. Publisher credentials and secret values never enter this store or public report.

### Kill check

Fail the design if it can start after an uncertain operation/deadline/revocation, infer KEEP from process exit, let caller text select provider/commands, turn estimates into spend, lose idempotency across restart, or enable live timers before #183. Avoid a second controller/recovery implementation: reuse registered profiles, qualified worker, core ledgers and durable archives; #182/#183 consume this admission journal.

### Executable verification mapping / Gherkin

New YAML source of invariant truth: docs/contracts/feature_improve_controller.yml, I-CONTROLLER-001…008. Preserve existing I-IMPROVE-001…014, I-PROFILES-001…005 and I-WORKER invariants unchanged. Planned tests (not claimed executed): tests/contracts/improve-limits.test.js and tests/integration/improve-controller.test.js. Contract schema supplies the exact acceptance IDs; test descriptions include the case IDs below.

```gherkin
Feature: Durable bounded owner-local Improve controller
  Scenario: Duplicate manual acknowledgement after completion (CTRL-IDENTITY)
    Given a trusted authorised principal submitted request R with immutable limits
    When R completes durably and the response is lost
    And the owner repeats R after restart
    Then the original run and counters return without starting a cycle
    And changed input under R conflicts without exposing another principal's state
  Scenario: Shared attempt bounds (CTRL-LIMITS)
    Given every native role, retry and fallback shares one registered attempt counter
    When the final permitted invocation is reserved and fails
    Then no further provider starts and the actual failure plus remaining limits survive
    And subscription dollar estimates cannot produce budget_exhausted
  Scenario: Real process race (CTRL-RACE)
    Given manual and timer representations target the same canonical repo
    When independent host processes race durable admission
    Then one owns the repo and the other observes duplicate or busy
    And a different alias cannot acquire another active owner
  Scenario: Uncertain launch or storage failure (CTRL-INTERRUPT)
    Given a durable operation intent exists before a protected launch
    When the process dies before its authenticated completion receipt
    Then restart reads the original deadline and consumed reservation
    And reconciliation_required retains ownership without another provider or holdout
  Scenario: Denied authority and cancellation (CTRL-AUTH)
    Given current authority was revoked or the run was cancelled
    When any further provider or cycle start is requested
    Then it is denied with the exact typed reason and no private cross-caller lookup
    And schedule pause is separately reported from run cancellation
  Scenario: Terminal evidence and next cycle (CTRL-TERMINAL)
    Given the exact cycle's existing core ledger and durable worker result are verified
    When an authorised next cycle is considered under the original remaining limits
    Then only genuine terminal evidence permits advancement
    And wrong/corrupt/missing receipts never do
    And KEEP stops pending_review rather than automatically publishing or repeating
  Scenario: Synthetic Dublin slots (CTRL-SCHEDULE)
    Given live timer activation is disabled pending #183
    When daily 01:30 autumn, spring, late and replayed Dublin slots are resolved
    Then autumn selects one earliest instant and spring records skipped
    And late slots are missed and all replays preserve their original disposition
    And no test slot starts a provider or enables a timer
  Scenario: Empty opportunities (CTRL-NOWORK)
    Given existing selection returns no eligible safe candidate
    When the owner reads the occurrence report
    Then no_safe_work includes reason evidence and no patch or PR
    And pending_review is separately linked and not experimental success
```

Mapping: AC-09-1 / LIMITS-04 / LIMITS-11/13 → CTRL-TERMINAL, CTRL-RACE, CTRL-INTERRUPT.
Mapping: AC-09-2/3/4/5 / LIMITS-01/02/05/12 → CTRL-LIMITS, CTRL-INTERRUPT, CTRL-NOWORK, CTRL-TERMINAL.
LIMITS-03/06/07/08/09/10 → CTRL-SCHEDULE, CTRL-AUTH, CTRL-IDENTITY.

DoD: exact acceptance tests run and zero required skips; real processes/filesystem races and write/fsync/rename/lost-ack negatives; actual new qualified worker/core cycle through the admission gateway with fresh once-only oracle evidence, observed counted native starts and independently retained terminal outcome. Protocol doubles prove only mechanics, not model/backend capability. Full canonical suite and separate live proof required; GitHub CI absent must be reported absent. Native Duo acceptance and privacy scan before publication. Implementation/tested/merged/deployed status separate; no deployment or nightly activation claim. Existing consumed #180/#217 holdouts are never replayed. Original acceptance requiring restart is bounded fail-closed here; automated continuation and live nightly proof remain #183 activation obligations, not claimed done by this milestone.

### Private data interfaces

```typescript
interface ControllerLimits {
  maxCycles: number; maxAttempts: number;
  maxConsecutiveNoProgress: number; maxWallMs: number;
}
interface ControllerRequest {
  repo_id: string; request_id: string; limits?: Partial<ControllerLimits>;
}
interface ControllerStop {
  reason_code: string; reasons: string[]; stage: string;
  last_completed_action: string | null; failed_check: string | null;
  evidence: string[]; retryable: boolean; next_action: string;
}
```

These interfaces are authoring artifacts, not claims of an implemented transport. Runtime validators must reject unknown fields and non-finite/fractional/non-positive limits, including an unmeasured actual-spend ceiling. Store and protected internal operation schemas are enforced by the new controller invariant/tests; existing RepoProfile v1 remains unchanged.

## Pre-flight Findings

**simulation_status:** passed for scoped preparation; not runtime acceptance
**simulated_at:** 2026-10-25T11:04:16.580374+00:00
**scope:** ticket #181 controller milestone

### CRITICAL
None in the selected preparation design. Runtime obligations remain required before implementation acceptance.

### P1
None unresolved in this selected design. Earlier policy ambiguities are resolved by the explicit builder decisions above under standing owner delegation.

### P2
Native-provider internal HTTP retries are not separately measurable: CLI invocations and wall deadline are the bounded units. Reports must retain that limit. Live schedule activation and automated recovery are explicitly unavailable until #183; #181 must not close those activation obligations as complete.


Scoped design pre-flight: dependency order, shared state, schema reality, timing and partial failure checked against current APIs/contracts. Prior open P1 policy choices resolved explicitly above. No SQL or graphical journey is invented for this non-UI controller. New worker qualification still requires its genuine app/backend journey and fresh once-only evaluation. The gate verifies current upstream APIs and mapping, not future controller acceptance. Implementation and live activation NOT established. Independent native preparation review remains required before promotion; any evidenced CRITICAL/P1 blocks it.
