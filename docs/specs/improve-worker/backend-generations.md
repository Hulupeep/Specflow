# Managed backend generations — #293 revision

Selected preparation, not implemented/qualified. Original AC-BACKEND-01..07 and
I-WORKER invariants remain unchanged. No new product UI/schema/RPC/RLS or evaluator.

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
