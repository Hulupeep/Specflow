# Confined backend recipe — #293

Preparation draft; not implementation, qualification or release acceptance. Parent #176; consumers #171 single Improve and #172 bounded cycles. Original AC-BACKEND-01..07 remain unchanged. This is a security-sensitive runtime change consuming existing product UI and schema, with no new product UI, schema, RPC or RLS. The complete migration source is tabstax@11d3973874df3e2b9f629f9ba2f7ac7ed8e32f09; reviewed app source d08c52db4de97d14179f2eb6c442b45f435aca8e.

## Architecture and applicable decisions

Reuse DockerWorker, admitted input/dependency/output capsules, currentAuthority, the pinned worker launcher, existing Improve verifyPhase/boundReceipt/evaluate and durable commit. Add scripts/improve-backend.cjs and scripts/improve-backend-supervisor.cjs. Never launch product scripts on the host or introduce generic Docker RPC. Trusted host coordination may inspect fixed Docker IDs and private evidence; repository code executes only in the existing confined app/checker roles.

No production/shared backend, host ports/network, new mount authority, remote package acquisition, mail, paid model fallback, scheduler or new KEEP evaluator. A caller cannot select arbitrary images, Docker options, executable commands, mounts or environment. Read-only sealed software, migration and runtime-input mounts are allowed only at fixed destinations resolved by the trusted coordinator; user-supplied host mounts remain forbidden.

## Exact interface

backend-request.schema.json declares the closed request. Managed v2 requests use baseline, after, or dev-rN (canonical positive safe integer); see backend-generations.md and its closed attempt/binding schemas. Legacy explicit v1 sessions are not factory authority. backend-inputs.schema.json declares complete pinned service/migration/seed/configuration inputs. backend-receipt.schema.json declares the terminal result. A qualified terminal result requires executed checks, no failure/skip, a manifest and completed owned cleanup. JSON schema is structural validation only: byte hashes, no-follow filesystem checks, duplicate-key parsing, duplicate migration names, ownership, phase and live state are runtime checks. Wrong expected/measured hashes must reject even when each is individually valid SHA-256.

The trusted coordinator freezes input descriptors before starting the job. Resolve only no-follow regular files/directories under admitted private roots; reject traversal, links, collisions, missing/extra migration files and duplicate names. Exact configuration content must match the closed recipe, not merely a caller-provided hash. Validate all fields before any create. Image tags, unqualified images, writable roots, privilege, shared PID namespace, devices and ports are unsupported.

Sequence: create network-none app anchor through existing production consumer; supervisor creates fresh Postgres tmpfs and bootstrap roles/extensions, then Auth migration service, then unchanged complete product migrations, then Auth/REST/gateway. Real readiness precedes fixture restore and phase measurement. Restore the same job-private synthetic public/auth fixture, using session-local trigger suppression only within the trusted import transaction. Schema equality and ordinary-user Auth/RLS controls follow. No row identifiers, timestamps, password hashes or sequence values are normalized.

## Resource and lifecycle protocol

backend-resource-profile.json is the finite ceiling: 8 unique slots, total4352MiB RAM/swap ceiling,8 CPUs,640 PIDs,640MiB tmpfs charged inside RAM. The app uses existing2GiB consumer limit; checker768MiB; six service slots256MiB each. Auth migration and seed slots count even when idle or already terminated; no overlapping replacement instances. All slots use read-only roots, cap-drop ALL, no-new-privileges and separate PID/filesystem namespaces in the exact owned network-none anchor. Scratch mounts: app /tmp128MiB; checker /tmp128MiB+/output64MiB; database /work256MiB; gateway /work32MiB+/tmp16MiB; seed /output16MiB. Other slots have no writable scratch. No silent extra /tmp or anonymous image volumes.

Original absolute deadline is300s including20s cleanup. Phase maxima are bootstrap90s, readiness60s, measurement10s, execution120s. The sum including cleanup is300s; a phase may finish early but cannot extend a later phase beyond its own ceiling or the original deadline. Supervisor polls at100ms; polling does not renew authority. Failure to clean before the cleanup bound yields backend_cleanup_failed and no successful receipt.

The supervisor durably records exact creation intent before dispatch and each returned ID before start acknowledgement (backend-generations.md), records pre-start and post-start inspection fingerprints, and owns cleanup independently of controller finally. State: initializing→bootstrap→readiness→measured→execution→quiescing→cleaned. Any invalid transition, controller death, service death, expired lease, or resource failure goes to failing→cleaned|cleanup_failed, never back to measured. Record exact signed name/intention and returned IDs; verify original job labels, full intended configuration and image identities before removal. Missing response is not absence. Parent PID/starttime fences PID reuse. Persist directory ownership before credentials are written. Crash recovery is historical inspection/cleanup, not a fresh baseline or deciding-check retry. Simultaneous supervisor/controller loss or unknown daemon outcome reaches operator_required with no success receipt; exact recovery requirements are in backend-generations.md. Automatic recovery across supervisor death or reboot is not claimed.

Docker service logs use bounded local logging (1MiB,one file,no compression); supervisor also counts streamed output per slot and aggregate and terminates on1MiB/8MiB overflow. Bounded logging prevents host disk growth even before attachment. Capture admits at most64MiB,16MiB/file,4096 entries,depth32 after writers stop, using existing no-follow capture. Raw secret-bearing service logs stay private and are not copied into public evidence. Actual storage exhaustion and output overflow must be integration tests, not assertions that limit flags exist.

## Credentials and measurements

Factory creates two ordinary fake users and owned Stax/block/action by actual Auth/REST. It clears disposable sessions/refresh tokens and seals the complete fixture. Keep database password and sodium key fixed within one logical job only; generation signing secret and compiled anonymous key rotate per attempt. Validate the complete issued credential before projecting semantics. The issued generation credential has a3600s lifetime (improve-backend-credentials.cjs); the separate runtime service-role token has a600s lifetime (improve-backend-runtime.cjs). Both are upper bounds, not job/operation lease extensions. Their stable/projection hashes are construction bindings, not independent measured success counts. Retain raw per-generation configuration hashes and validate signature, exact job/generation/role/audience/issuer for the server token. Runtime-only stdin/tmpfs envelope is unlinked before Next starts. Browser/checker never receives a signing secret or server-role key; the checker receives only public config and ordinary fake-user credentials in private inputs.

At each phase entry, one repeatable-read read-only transaction hashes complete ordered JSONB rows for every public/auth table, all relevant sequence state, migration history and schema. Preserve raw Docker inspection/environment/configuration hashes. Semantic identity compares complete fixed recipe fields and byte bindings; mount arrays sort by destination but preserve all fields. Actual anchor IDs/physical paths differ and require current ownership validation; generated server token differs only through validated capability semantics. Product source/build stays separately bound and may change through the candidate workflow.

## Existing-core handoff — required call sites

1. Frozen ImprovementContract gains a strict optional runtime.backend declaration naming recipeId, expectedSemanticSha256 and constructionSha256 for managed generations. The actual raw inputManifestSha256 is retained per attempt; legacy explicit two-manifest declarations never authorize a managed factory. Legacy absent-backend contracts retain existing behavior. Backend-declared contracts without the admitted capability fail; no fallback to host runtime or legacy fixture.
2. Existing improve-worker.cjs coreStage verifyPhase/build paths, after currentAuthority, use the closed generation coordinator to create a job/run/phase-bound opaque session. Sessions are process-local registered capabilities, never accepted from arbitrary JSON/options or repository code. Only the trusted pinned launcher/coordinator can resolve private session descriptors; app/checker cannot access the control socket or host Docker.
3. core.verifyPhase receives that capability through an internal optional parameter. Before holdout_consumed and runCheckSet, canonical backend admission validates current service ownership and input bytes and measures the backend. The declared frozen expected semantic SHA must equal the measured SHA. Missing/expired/foreign/changed state returns verification_blocked before deciding checks.
4. inputIdentity binds the stable expected backend declaration and backend module/supervisor/input manifest in the verifier identity. The measured entry manifest and raw configuration/service hashes are retained with the attempt in the binding receipt. The backend identity is distinct from the product workspace/build identity. Do not add phase-specific token bytes or container IDs to the cross-phase verifier hash.
5. The existing pinned check launcher recognizes only the qualified recipe and exact current attempt. It attaches an isolated checker to that owned anchor and executes the existing frozen check artifact; it cannot select a new backend, commands, host files or arbitrary namespace. Dynamic private attempt descriptors are outside the builder workspace and do not replace static frozen configuration. Check outputs retain native executed/failed/skipped accounting and secret scans.
6. Post-check validation rechecks fixed inputs, process ownership, configuration, phase continuity and evidence integrity; it must not demand that application rows still equal the initial seed after a legitimate test write. Quiesce/capture/owned teardown must succeed before the successful core receipt and completion event are published. A cleanup failure preserves the consumed-holdout marker and returns failure, never retries it.
7. boundReceipt validates the retained entry/terminal manifest hashes and correspondence to the attempt. evaluate compares baseline/after expected AND measured backend semantics alongside existing verifier identity. A legitimate changed candidate product is still bound by its own Git/build receipt. No alternate evaluator or inferred KEEP. Retained manifests are private evidence, with sanitized hashes only in public reports.

The handoff above is a design, not an implemented path. Repository tests must demonstrate the actual call chain, including rejection before any deciding check, different candidate product bytes, forged session objects and post-entry config mutation. A prepared JSON receipt alone cannot qualify it.

## Requirement and test mapping

Canonical behavior: docs/contracts/feature_confined_backend.yml; journey: docs/contracts/journey_confined_backend.yml. Existing I-WORKER-001/003/004/005/006/007 are reused, not duplicated.

- Verification mapping for AC-BACKEND-01: tests/contracts/improve-backend.test.js validates strict request/recipe and all input negatives; tests/integration/improve-backend.test.js executes readiness, input/image/migration/foreign-job failures before product code.
- Verification mapping for AC-BACKEND-02: integration uses real Auth and ordinary owner/other-user API; read/update/insert denial with complete row equality, service-role/bypass negatives.
- Verification mapping for AC-BACKEND-03: tests/e2e/journey_confined_backend.spec.cjs maps J-CONFINED-HEYSTAX-BACKEND at1280/360, using the existing actual selectors/accessible labels from the executed prototype.
- Verification mapping for AC-BACKEND-04: integration executes host/other-job/production/internet IPv4/IPv6/DNS denials plus reachable positives, no Docker/host secrets/input mutation/foreign join. Production addresses are contacted only from network-none denial probes, never host production access.
- Verification mapping for AC-BACKEND-05: integration kills controller at bootstrap/readiness/execution, kills another service, expires original lease, fills storage and exceeds output; verifies named failure, no successful receipt, owned cleanup, foreign control survival and unknown/mutated/interrupted restart rejection.
- Verification mapping for AC-BACKEND-06: contract and integration verify equal and unequal live manifests, actual seed mutation, missing/changed migration/image/config, forged capability rejection and existing-core receipt/evaluation consumption; changed product code remains separately bound.
- Verification mapping for AC-BACKEND-07: full canonical tests plus actual integration and both journeys with zero required skips, current-head CI, independent review and merge. Availability, prototype, implementation and product improvement remain distinct.

## Gherkin and definition of done

Given pinned unchanged migrations and an admitted fresh backend, when an ordinary owner signs in, saves an action and reloads at1280/360, then actual Next API201, persisted owner readback and visible saved action agree.
Given a second ordinary user, when they read/update/insert against private owner rows and one UI request carries their real bearer, then RLS/route denial is actual, the error is visible and every owner row field is unchanged.
Given backend identity differs or controller/service/lease fails, when a phase attempts deciding execution, then no successful receipt is produced, only owned resources are removed, and the original deadline/holdout history remains authoritative.

Done requires all original AC01–07, the mapped repository journey executed and passing, current CI/independent review and merged code. Earlier2/2 prototype journeys are preparation evidence only. No new UI testids are invented: login-form, attention-board, block-card, add-action-button, add-action-input, next-action-item plus real Email/Password and handle labels are the consumed surface. Mobile overlap and settings false-unsaved remain product findings for later Improve selection.


## Managed generation revision

backend-generations.md specifies the just-in-time factory, durable attempt fencing,
practice-only dispatch, complete-consumer cleanup and operator-required recovery.
The new request/receipt v2 schemas and attempt/resource-intent/attempt-terminal/
job-binding schemas define the selected implementation interface. Existing runtime
commits at2f0ed1a are prerequisites and partial implementation; they do not yet
implement this revision. Preparation checks are not production qualification.

Verification mapping supplements (original criteria unchanged): AC01 adds closed
managed declaration/private-binding rejection; AC05 adds pre-create, slow-create,
lost-response, supervisor-loss, name-conflict and foreign-object fixtures plus
cross-process reservation; AC06 adds real baseline → dev-r1 → dev-r2 → after →
evaluate, current candidate capsule/build and complete receipt correspondence.
Tests belong in tests/contracts/improve-backend-generation-factory.test.js and
tests/qualification/improve-backend-native.test.cjs; preparation fixtures validate
the proposed protocol but do not satisfy those runtime gates.
