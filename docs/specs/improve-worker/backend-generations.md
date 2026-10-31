# Managed backend generations — #293 revision

Implemented; runtime qualification was executed on 2026-10-30 and 2026-10-31 UTC across the
source revisions listed below. Evidence retains its original revision; no single
head is claimed for every historical probe. Independent acceptance and merge of
[PR #294](https://github.com/Hulupeep/Specflow/pull/294) remain separate gates.
Original AC-BACKEND-01..07 and I-WORKER invariants remain unchanged. No new product
UI/schema/RPC/RLS or evaluator.

## Evidence revisions

| Evidence class | Executed source revision |
| --- | --- |
| Six-phase lifecycle, Auth/RLS, browser, isolation and seed-identity mismatch | `7ec2f671af6a23b225452e58003b35ee41c40f4a` |
| Before-create controller loss | `2814e8b` |
| During-create controller loss | `33e8752` |
| After-create controller loss | Original observer fingerprint retained; do not infer a Git revision from the later aggregate report. |
| Anchor-loss late acknowledgement | `8252f6bb54c56fb7d97917fd73543ab4446d2b42` |
| Readiness, output limit, missing migration and foreign-name cases | Original per-run observer fingerprints retained; aggregate verification at `7ec2f67` does not relabel those executions. |
| Original admission negatives | Original 15-case output retained; it lacks a source-bound observer receipt and is not a current-head execution claim. |
| Four supervisor boundary cases | `28e96a6ffa0b2ec01a1a5ec174c4d9b6269260eb` |
| Refreshed before/during/after-create controller loss and 15 admission cases | `4654fce90bcb4d802ff439739e8251a4c837ebed` |
| Storage-exhaustion repair, schema/environment negatives and 316 backend tests | Executed on the uncommitted repair whose complete tracked script/test fingerprint matches committed `8911d5e11953cd11e62570cf6e58ea6c8ff36157`; not claimed as post-commit executions. |

The documentation-only `28e96a6` follow-up preserved the `7ec2f67` runtime and test
bytes. Later refreshes must retain their own source-bound receipts alongside these
originals, including failures; they do not replay the consumed lifecycle holdout.

## Evidence and limits

| Claim | Evidence and boundary |
| --- | --- |
| Service availability | Pinned local service images started with the admitted configuration and unchanged product migrations in disposable, job-owned backends. Cached images or a successful startup alone do not establish runtime qualification. This is not production-service availability or approval of arbitrary image versions. |
| Runtime qualification | The real product at `d08c52db4de97d14179f2eb6c442b45f435aca8e` passed 29 Auth/RLS checks, two browser journeys at 1280px and 360px, and 57 isolation controls, with zero failures or skips. Expected and measured backend identities matched, and owned cleanup verified. A deliberate one-row disposable seed mutation was rejected as `backend_identity_mismatch` before any protected check. |
| Product improvement | Not established by this qualification. The managed lifecycle intentionally exercised a rejecting fixture: baseline failed, development failed then passed, and the once-only held-out check failed. Evaluation returned `REVERT` with no binding errors; finalization retained no candidate commit or branch and left the base unchanged. Real product-value proof remains [#171](https://github.com/Hulupeep/Specflow/issues/171), followed by bounded repeated improvement under [#172](https://github.com/Hulupeep/Specflow/issues/172). |

The lifecycle preserved one holdout consumption and one decision application in a
verified 35-entry ledger. Each baseline, development and after generation removed
its nine owned resources, deleted its credential envelope and recorded signed
release. The original task deadline was not renewed. These are mechanical safety
and evidence results; passing the development check did not override the failing
held-out check.

Actual fault qualification covers controller loss before, during and after create,
anchor removal before a late creation acknowledgement, unavailable readiness,
output-limit breach, a missing staged migration and a foreign object occupying the
reserved name. The foreign-name case preserved foreign resources and removed all
known owned resources, but retained `cleanup_failed` / `operator_required` and its
private envelope for unresolved dispatch. It is a verified safe rejection, not a
clean baseline or authority to retry that job. Earlier failed runs and manual
containment remain in the private history with their original revisions; they were
not rewritten as successful qualification.

The subsequent storage regression filled the owned gateway's 16 MiB `/tmp`
mount and recorded an actual ENOSPC error with zero available blocks. Before the
repair, the runtime still attempted execution; a test guard intercepted it before
any protected check. That guard produced `backend_restart_invalid`, so the result
is not described as a spontaneous restart failure. Earlier inconclusive writer
attempts remain retained separately.

The repair observes capacity on the closed database `/work` and gateway
`/work`/`/tmp` mounts through bounded commands after service ownership checks,
and checks continuity again before execution. It leaves the kernel resource
limits unchanged. The live repaired run rejected exhaustion as
`backend_storage_limit`, removed all eight owned attempt resources (including five
backend services), deleted the credential envelope, preserved a foreign control,
and never reached the execution guard. Separate repaired-source probes rejected
an actual schema mutation as `backend_identity_mismatch` and staged environment
mutation as `backend_input_changed`; each cleaned five services and ran zero
protected checks, with no skips. The environment rejection does not claim a
measured identity. All observers preserve the original task deadlines.

The repaired source also passed 316 backend contract/integration tests in 15
suites, with no failures or skips. Independent acceptance and current-head CI are
still required; these results do not constitute a product improvement.

[CI run 41125490725](https://github.com/Hulupeep/Specflow/actions/runs/41125490725)
passed 3,249 tests in 164 suites at the earlier qualification head, with no failures or
skips. The actual owner-local qualification uses the drivers in
`tests/qualification/improve-managed-core.test.cjs`,
`improve-backend-product.test.cjs`, `improve-backend-admission.test.cjs`,
`improve-backend-fault.test.cjs` and `improve-backend-operational-fault.test.cjs`.
Raw native receipts, signed ownership/cleanup records and frozen manifests are
retained privately; CI success does not substitute for those live runs.

Scope remains the selected owner-local Linux/Docker recipe and admitted product,
not arbitrary repositories, hosted clouds, production deployment or shared database
access. Recurring timers and paid fallback remain off. The already published npm
`0.12.0` predates these runtime changes; a later versioned release and installed
npm/plugin verification are still required.

## Closed authority and identities

The managed declaration is exactly {recipeId, expectedSemanticSha256,
constructionSha256}. A trusted pre-freeze job binding, signed by the existing
DurableStore MAC, holds the corresponding inputs template, admitted dependencies,
source recipe and resource profile (backend-job-binding.schema.json). Validate all
referenced bytes/capsules, current job/run and authority; a contract cannot provision
its own binding. Never learn candidate expected state after freezing the contract.

constructionSha256 hashes the exact validated inputs manifest after replacing ONLY
credentialBinding.sha256 with improve-backend-semantics.projection of the actual
validated issued credential and request. Preserve credential path, job, images,
migrations, seed, configuration, complete expected state and stable database/sodium
hashes. Validate all raw referenced bytes independently. Raw entry manifests retain
their actual inputManifestSha256. Expected/measured semantic identities must match;
changed candidate product identity is separately bound and may legitimately differ.

Generation credentials expire after3600s; runtime-only service-role tokens after600s.
These are distinct credentials in existing code, not a lifetime discrepancy. Fresh
issue before each build; reject expiry/revocation at admission and check dispatch.
No credential issuance renews task/operation/backend deadlines.

## Core lifecycle

Pinned coreStage installs an opaque process-local capability after currentAuthority,
from the signed private binding. Unique frozen object + module-private WeakMap bind
canonical runDir/job; never accept a callback, capability or backendSession from
serialized arguments. Trusted options replace/reject conflicting caller options.
No globally mutable factory. build carries the capability into internal devRound.

1. Acquire atomic per-job active reservation in existing private DurableStore.
2. Re-read frozen contract, authority and actual ledger under that reservation.
3. Issue/consume unique generation, seal current selected workspace into an owned
   paused source producer through existing captureCapsule, verify dependency lock,
   and perform a fresh confined production build with that generation's anon key.
4. Recheck authority and remaining credential life; start backend, restore/measure
   exact expected fixture, bind actual product workspace/capsule/build.
5. Select frozen checks: baseline = existing baseline checks; dev-rN = dev_check
   only; after = once-only final holdout. Practice never emits holdout_consumed,
   verification_completed or final verification_receipt. Re-read consumed/legacy
   final state immediately before final dispatch; unknown is not replay authority.
6. Continuity, capture and teardown of ALL producers/build/app/checker/backend and
   private envelope precede a usable receipt. Preserve original failure cause.

Phase grammar is baseline|after|dev-rN for canonical integers1..9007199254740991;
round originates in the build loop. Reject leading zero, exponent, newline and
unsafe integer. Same predicate is used at every runtime seam. Backend requests and
receipts are v2; legacy v1 explicit sessions keep their old parser and cannot invoke
this factory. No fallback to unconfined runtime for backend-declared contracts.

Seal actual candidate bytes, including scope-approved new files, with existing
no-follow scope rules. Reject escaping/link/special files and Git/private/oracle
inputs. Reserve empty node_modules/.next, compare package/lock bytes with admitted
dependencies, and reject changed dependencies rather than fetch/install. Before/
after workspace identity must match; snapshot receipt binds producer, manifest and
actual workspace. Never reuse baseline output for changed candidate bytes.

## Durable reservation and complete resource ownership

backend-attempt.schema.json defines attempt value; sign canonical {value,mac} using
existing DurableStore. Use fd-anchored0700 area, exclusive0600 no-follow files,
owner/nlink/size checks, write+fsync before acknowledgment. Active reservation binds
job/run/attempt/hash. Competing caller fails backend_attempt_active before issue.
Process identity reuses boot_id/pid/start/group; unknown visibility is not death.

The attempt deadline is the original task/operation deadline. Each source/build
operation also keeps its existing qualified phase ceiling; backend300s begins at
backend admission and remains capped by the task deadline. Build completes and its
producer is removed BEFORE backend starts. The existing8-slot backend aggregate and
qualified production-build profile remain unchanged; no overlap enlarges peak limits.
At most10 unique resource slots across the whole sequential attempt are retained in
the terminal (8backend slots plus source-producer/build); only8backend slots may
coexist. No retries/replacements within an attempt or hidden watchdog grace renewal.

Persist signed resource intent (exact name, slot, config hash, creator/supervisor
identities, original deadline) before any create. The supervisor readiness handshake
precedes dispatch. Supervisor owns Docker create and its response, not the disposable
controller. States: not_dispatched → dispatching → returned_created; a lost/error
response may remain unknown. Persist returned ID/config match before allowing start.
Controller loss fences start; supervisor finishes in-flight create and removes only
its matched object. Removal rechecks exact name/ID/image/labels/configuration. A
mismatch is retained, never swept by generic labels. Complete signed terminal
requires every recorded intent accounted for and envelope removed; no surviving
app/checker can be hidden behind the five-service backend terminal.

Extend existing watchdog with a separate closed supervised-intent mode. Keep legacy
ID mode intact. Intent mode receives an authenticated descriptor through private
stdin/file, validates exact signed intent/current authority and owns the fixed
create/start/inspect/remove protocol; it accepts no arbitrary Docker program/flags.
Do not merely loosen the current 64hex-ID regex to permit arbitrary names. Original
deadline and parent process identity remain authoritative; watchdog polls do not
renew them. A watcher cannot declare absence while creation outcome is unknown.

## Unknown dispatch and explicit operational recovery

A fixed settle interval plus not-found is NOT absence proof. A sentinel briefly
claiming the name is also insufficient if removed before an older daemon request
settles. Normal controller loss is recovered by its still-live supervisor. If both
are lost, daemon visibility is unknown, a matching object cannot be safely removed,
or cleanup exceeds its original bound, record state=operator_required,
cause=backend_cleanup_unconfirmed. Stop the attempt, preserve active reservation
and holdout history, publish no usable result and permit no successor on that job.
This is a named terminal operational condition, not an indefinite running loop.

Exact release procedure, deliberately outside automatic agent authority:
- Operator establishes current authority for the same job and fences the original
  creator/supervisor identities; PID absence alone is insufficient for unknown daemon
  requests. Through host administration, establish a completed daemon shutdown and
  restart with retained before/after daemon identities and service-manager evidence
  that all old request handlers terminated. This affects other jobs and requires
  separate operator authorization; the agent must not perform it automatically.
- Trusted reconciliation checks the new daemon identity, preserved signed intents
  and exact names/IDs. Remove only proven matching objects; retain/report mismatches.
  Confirm absence after all old handlers are known gone. If any premise is unknown,
  retain operator_required; never accept a free-text 'cleaned' flag as evidence.
- Sign a recovery terminal containing attempt hash, referenced operator authority/
  daemon evidence, resource inspections/removals and envelope deletion. Persist it
  before compare-and-release of that exact active reservation. The failed attempt
  stays failed. A consumed final holdout cannot rerun; new work needs existing core
  fresh-run rules. This procedure is not an automatic daemon-restart capability.

## Receipt correspondence and implementation proof

Core receipt references signed attempt and complete attempt terminal, actual raw
inputs hash, construction hash, backend entry/terminal and product receipt. Require
matching job/run/phase/attempt/generation, exact frozen construction, measured semantic
identity, actual workspace/capsule/build and cleanup of every intent. Structural
schemas cannot prove MAC/ownership/hash correspondence; runtime verifies each.
Duplicate slots/intents, missing intent, foreign terminal, changed hash, unknown
cleanup or practice-as-final are rejected before evaluator acceptance.

Required qualification: actual baseline/dev-r1/dev-r2/after/evaluate on rebuilt
product and real backend; equal identity accepted, changed schema/seed/Env rejected
before deciding checks; contention in separate processes; delayed build/expiry and
revoked authority; controller kill before create, during delayed create and after
create before ID receipt; supervisor/controller loss gives operator_required; foreign
same-name object survives. A fake-Docker asynchronous fixture is preparation only.
Live implementation/CI/independent review and the unchanged two-width real-backend
journey remain mandatory. No prototype result is a product-improvement verdict.

## Binding input correction — dependency provenance and original deadline

This supplements the existing closed authority and deadline rules; it does not
change AC-BACKEND-01..07 or grant implementation readiness.

The signed pre-freeze job binding also requires `dependencySource`, exactly
`{packageSha256, lockSha256, manifestSha256}`, using the admitted offline-input
provenance. Before issuing credentials or creating a resource, validate that its
canonical SHA-256 equals `dependencies.expected.identity.sourceInputSha256` and
that the capsule's exact receipt matches the binding. Preserve the provenance
preimage at admission; never reconstruct it from a digest or search unrelated
jobs for a matching value. Each selected source must still have matching package
and lock bytes under the existing production builder. Missing or mismatched
provenance fails `build_dependency_source` without fetching dependencies.

The binding requires `deadlineAtMs`, a positive safe integer UTC epoch millisecond
value taken from the trusted task admission's original absolute deadline. Task
admission must persist that deadline before freezing/signing the binding. If no
original deadline exists, reject admission rather than create a phase-relative
replacement. Every baseline, practice and after generation copies this exact
value into its attempt; all phase ceilings are additionally capped by it. Re-read
it at dispatch. An expired deadline fails `backend_lease_expired` before issue or
create; malformed, missing or authority-mismatched binding fails admission. Resume,
credential refresh, a new round or an edited caller argument cannot renew it.

Preparation tests: generation-preparation-checks.py validates the closed shapes,
missing fields, unsafe/fractional deadline values, provenance correspondence and
expiry/nonrenewal examples. These tests establish the specification only. Runtime
qualification must additionally prove tampered provenance rejection before create,
expired admission, and unchanged deadlines across actual baseline/dev/after runs.
