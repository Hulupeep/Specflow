# Selected preparation decisions and verification

Status: selected preparation, not implemented or promoted. Sources: issue218
body/comments, three independent persona routes, current #183 source and its
valid completed native review. User standing authority permits routine engineering
choices and project delivery; no new spend, outreach or unrelated repo is needed.

## Decisions

1. **Auth/transport.** Owner-local loopback HTTP + API v1/MCP, official published
   SDK server/client2.4.0 + node2.1.2, Node22/CJS-compatible exports verified from
   npm metadata. Keep protocol compatibility explicit and test actual clients.
   Validate Host/Origin and bounded JSON; no permissive CORS or remote ingress.
   Owner-private hashed credentials map immutable per-request actor, repo/action
   scope and current role assignment. Never share mutable current-caller state.
2. **Authority.** Reuse creator-only controller admission for v1, without owner
   impersonation for a delegate. Current qualified callers have distinct
   credential/holder provenance for the actual owner principal. Unsupported
   delegation blocks before worker launch. Logical research-role replacement is
   distinct from trusted execution-holder replacement. API tokens never become
   execution tickets. Owner-host accepted work can outlive client disconnect or
   credential replacement; current execution grants/cancel/horizon still gate it.
3. **Atomicity.** Extend the same controller transaction for canonical request,
   stable task/experiment claim and pending dispatch intent. Do not maintain an
   independently authoritative queue/job lease. Accepted job must survive lost
   acknowledgement, partial dispatch and restart. Prefix/phase reconstruction
   must come from original controller/core/receipt facts, never rerun uncertainty.
4. **Worker scope.** Owner-registered prepared plan and qualified #217 worker/core
   APIs, #182 memory and #183 live assignment/generation/receipt protocol. No
   arbitrary caller paths/executables or second generative build loop. Initial
   actual qualification is the supported local Node/Docker native-subscription
   recipe. New repo/recipe needs real onboarding evidence before execution.
5. **Results/cancel.** Shared report source and revision; historical code decision,
   experiment validity, verified retained improvement and delivery separate.
   Cancel stops fresh execution/publication, preserves report/ack and issued
   reconciliation. Deadline includes queue time. Unsupported repair/disposition
   stays blocked. Fix two reproduced known-stage+cancel/deadline projection cases
   within the shared report before exposing the facade.

Official sources checked 2026-10-26:
- https://github.com/modelcontextprotocol/typescript-sdk (stable v2 and packages)
- https://modelcontextprotocol.io/specification/2025-11-25/basic/transports
- npm metadata: server/client2.4.0, node2.1.2 (peer server^2.4.0). Package version
  numbers differ; do not assume middleware2.4.0 exists. No packages installed into
  production yet and no SDK transport execution is claimed by metadata inspection.

## Simulation and audit

Authority: creator happy path; delegate denial; forged principal; revoked token;
concurrent different keys for one task; changed payload/defaults; current role
holder replacing an old credential without copying execution tickets.
Crash: accepted HTTP disconnect; service death before/after admission/assignment;
fork-before-ack; release/receipt loss; known versus unknown completion; holdout
consumed; archive/terminal acknowledgement loss; original finite horizon.
Operator: missing/mismatched service; real worker/backend readiness; exact blocker
and one next actor; two MCP clients and CLI; completed versus delivered;
known failed stage plus cancellation/deadline (two reproduced protocol-fixture
failures; actual nonzero stage, host clock advanced, no real2h wait claim).

Existing REQ1–12 preserved. Proposed13–20 supplement gaps; public consolidated
simulation comment is on #218. This document records choices, not a silent rewrite
of prior source. No graphical journey/SQL artifacts are manufactured.

Gap analysis: outcome/scope/dependencies/AC and simulation present; selected data
contracts, atomicity/auth/dispatch decisions, invariant registration, executable
mapping and current scoped preflight are being added. Before promotion, verify
all mappings and strict schemas, concrete dispatch reconstruction, capability
compatibility and no delegated-authorship ambiguity. Any CRITICAL/P1 blocks;
planned tests do not count as executed service/runtime evidence.

Required implementation matrix: request spoofing/size/extra field; role revocation
and isolation; concurrent task/request reservation; defaults changed on retry;
wrong repo/unknown existence hiding; private storage/symlink/corruption; every
admission→assignment→paused release→receipt→terminal cut; live/unknown PID; known
stage failure and unknown provider; cancel/deadline; lost run ID; report parity;
retained tree/archive missing; protocol compatibility and two actual clients.

Kill check: a stateless HTTP wrapper over an in-memory job map would lose accepted
work and recreate jobs; rejected. Keeping a second durable queue as authority
would disagree with #183; rejected. Missing prepared plan/qualified worker is an
honest preflight blocker with an agent-owned next step, not a reason to invent
an execution adapter or ask the owner to restate the task.


## D6: exact durable representation and reconstruction

Preserve controller format2 and existing top-level keys. Service records live in
its existing `requests`, each discriminated by `kind`; run metadata lives on its
original `runs[run_id].service`. Never reinterpret ordinary controller receipts.
The service admission method performs one authorised `store.change` transaction:
1. Current transport identity/scope/role is checked before any private lookup.
2. A service retry key hashes `[principal, canonicalRepo, request_id]` with a
   service namespace. Compare the original strict caller-payload digest first.
3. A task claim key hashes `[principal, canonicalRepo, task_id, experiment_id]`.
   Existing claim checks source/contract revisions, returns its authorised job,
   and records this caller retry receipt; it never creates a second worker.
4. Only a new task resolves the current owner registration/profile/plan. Invoke
   existing `admitIn` inside this SAME transaction. A blocked receipt is immutable.
5. For allowed admission, store the task claim, immutable plan/profile digest,
   original client actor and `{state:'pending', binding_revision:1}` dispatch
   intent on the run before commit/ack. No process starts in this transaction.

Owner-private registry format1 contains `credentials`, `assignments`, and `plans`.
Credentials contain id, SHA256 token digest, principal, role, holder, assignment
revision, repo/action scopes and revoked boolean. Tokens are random256-bit secrets,
compared in constant time; never returned from service APIs. Assignment lookup
must match ALL stored identity fields; replacing an assignment never upgrades an
old credential. An unauthorised known resource and an unknown resource share one
403 `not_authorised` envelope; no paths, raw exception or private logs are returned.
All registry/config/store paths are owner-trusted process startup configuration,
private regular files/directories, rejecting symlinks/wrong ownership/mode.

A registered plan binds task/experiment/source/contract revision, repo/profile
revision, qualified worker recipe/runtime digest, prepared contract/candidate input
hashes and a trusted owner-installed driver module. The driver uses existing core
and controller-worker APIs; HTTP callers cannot supply modules or arguments. An
installed module is an owner trust boundary, not a hostile same-UID sandbox.
Registration must have actual matching worker qualification evidence. Missing plan
returns `plan_preparation_required`, next actor agent; unknown recipe returns
`worker_unqualified`, zero execution. Qualification fixtures are not a generic
repository adapter. A supported prepared plan is onboarded once by an authorised
agent, without requiring a human to configure every request. The first supported
recipe is the already qualified local Node/Docker native-subscription worker;
other repo/recipe combinations remain unsupported pending evidence.

Dispatch serialises on the existing controller transaction. It records a proposed
worker identity only after a real idle IPC child is spawned. Owner assignment,
resume generation and execution ticket are committed before the idle child is
released. A crash after pending acceptance reconstructs this original run. A
crash with an existing live child does not spawn another. Missing launch ack is
unknown until positive host process evidence proves quiescence. A successor uses
#183 assignment/reconcile/resume and original receipts; it never invokes an
already-issued phase because a bookkeeping marker is missing.

The driver checkpoints each phase through the existing core ledger, controller
operations and authenticated receipts. Phase reconstruction: no operation + no
core phase => not started, eligible only under current authority/window; reserved
operation => reconcile exact receipt or remain live/unknown; complete nonzero =>
known failed stage, no automatic repair; complete zero => inspect original core
phase outputs before the next phase; consumed holdout without authenticated
result => blocked, no replay; archived terminal => existing completeCycle only.
A private driver log is diagnostic, never authority to repeat a phase. Plan/core
inputs are pinned per job; changed defaults/registration cannot mutate acceptance.

Control requests are bound before execution in namespaced controller `requests`
records: principal/repo/run/request id, canonical caller digest, action, original
internal payload/expected generation, pending or complete and original receipt.
An identical current-authority retry reuses that exact command after lost ack.
Never derive a new expected generation on retry. Transport client identity is
immutable audit provenance, separate from accepted host execution assignment.
Cancel intent remains on the original run for #219; no future publication may
start after cancellation, while an already-issued result must be reconciled.

## D7: shared status decision table

Use one shared report projection; the facade never recomputes a core decision.
Priority for reason: unknown issued completion; otherwise actual cancel/deadline;
otherwise known failed stage; otherwise live/runnable/receipt/evidence state.
Known completed failed stages always retain the failed check and an owner-owned
unsupported-repair action, including after cancel/deadline; do not direct the
agent to reconcile nonexistent uncertain receipts. Expired queued jobs are
blocked/deadline, not runnable or newly admitted. Preserve original historical
KEEP independently of archive/current branch availability. Delivery starts as
not_requested; #219 alone may provide evidence-backed delivery facts.

## Acceptance mapping (selected executable obligations)

All original requirements remain authoritative, including original AC11–12.
Each row is a named implementation test obligation, not an execution claim.
Contract file: docs/contracts/feature_improve_service.yml. Contract tests:
`tests/contracts/improve-service.test.js`. Real protocol/process journey:
`tests/integration/improve-mcp.test.js`, J-SERVICE-RECOVER. Shared projection
regressions extend `tests/contracts/improve-report.test.js`.

| REQ / AC | Check ID | Required observation |
|---|---|---|
| SERVICE-01 | SERVICE-ASYNC | lost accepted response retries same durable run without waiting for providers |
| SERVICE-02 | SERVICE-AUTH | denied cross-repo/path/read/control discloses no existence |
| SERVICE-03 | SERVICE-CLAIM | simultaneous manual/timer/task callers produce one original worker |
| SERVICE-04 | SERVICE-REPORT | blocked admission/pending delivery is not improvement |
| SERVICE-05 | SERVICE-JOURNEY | CLI/two MCP clients/restart share report, limits and operation identity |
| SERVICE-06 | SERVICE-LOOKUP | authorised repo lookup recovers lost run ID without admission |
| SERVICE-07 | SERVICE-SCHEMA | principal/commands/paths/extra fields fail before dispatch |
| SERVICE-08 | SERVICE-COMMIT | storage fault before commit launches nothing; after commit lost ack returns original |
| SERVICE-09 | SERVICE-RETRY | changed defaults preserve identical retry, changed original payload conflicts |
| SERVICE-10 | SERVICE-CANCEL | cancel fences fresh execution/publication, retains known/unknown issued results |
| SERVICE-11 | SERVICE-CLAIM | two scoped watchers one task/experiment/source/contract create one authoritative job |
| SERVICE-12 | SERVICE-ROLE | A replaced credential denied, B separately provisioned credential recovers same job; native isolation needs actual evidence |
| SERVICE-13 | SERVICE-AUTH | concurrent credentials immutable, revoked/stale assignments denied with opaque envelope |
| SERVICE-14 | SERVICE-RETRY | task claim independent of retry key, revision conflicts and busy receipts immutable |
| SERVICE-15 | SERVICE-CRASH | admission/dispatch/fork/ack/release/receipt/terminal cutpoints preserve one run/no blind replay |
| SERVICE-16 | SERVICE-RECOVER | known/not_started/live/unknown distinct, consumed holdout never reruns |
| SERVICE-17 | SERVICE-REPORT | report parity/revision/failed check/next actor; known failed stage after cancel/deadline |
| SERVICE-18 | SERVICE-PREFLIGHT | versions/capabilities separate from backend/native auth, precise remedy/no fallback |
| SERVICE-19 | SERVICE-CANCEL | disconnect does not cancel; cancellation preserves decision and issued receipt/history |
| SERVICE-20 | SERVICE-WINDOW | queue/restart/role changes retain original finite horizon/caps/consumption |

```gherkin
Feature: Authenticated durable prepared-plan execution
  Scenario: Two replaceable watchers recover one task
    Given independently provisioned current owner-principal credentials A and B
    When both start the same pinned task with different request IDs
    Then exactly one original job is durably accepted
    And replacing A's role denies A without relabelling its provenance
    And current B discovers that same job without resetting its work window
  Scenario: Lost resume acknowledgement cannot mint new control authority
    Given a resume command was durably bound to its original expected generation
    When its response is lost and a later holder advances the generation
    Then an authorised identical retry returns the original command receipt
    And it cannot claim another generation or repeat protected work
  Scenario: Service restart encounters uncertain issued work
    Given a worker was released and its original operation lacks terminal proof
    When the service restarts
    Then live or unknown work remains reserved under its original job
    And no provider or consumed holdout repeats
  Scenario: Known failure remains explainable after deadline
    Given every operation completed and a stage failed its recorded check
    When the original deadline ends or the operator cancels
    Then status preserves that actual brake and failed check
    And the next action names unsupported audited repair rather than receipt reconciliation
```

## Invariants and local pre-flight

Reuse I-IMPROVE-001–013, I-CONTROLLER-001–008 and I-RECOVERY-001–006 unchanged.
New I-SERVICE-001–006 below cover transport identity, atomic portable task claim,
original control retries, evidence-based projection, qualified plans and bounded
protocol safety. No SQL/RLS/RPC/schema migration: persistence is the existing
private atomic controller JSON transaction. No graphical testids: no UI surface.

Audit phase1: PRESENT parent/personas/scope/REQ/AC/DoD/Gherkin/typed interface,
new selected storage/control/dispatch representation, mapping and architectural
decisions. SQL and testids are explicitly inapplicable; actual non-UI execution
is mandatory at implementation, not fabricated during preparation.
Phase2 adds only these missing selected decisions and contract/check artifacts.
Phase3 remains pending executable preparation gate and independent native review;
no claim of production eligibility or runtime compliance follows from these notes.


### Current local pre-flight disposition

2026-10-26: selected source/interface/storage/control/state-table mappings reviewed
through schema-reality, traceability, authority/shared state, timing and partial
failure lenses. No remaining identified CRITICAL/P1 in this local preparation;
independent native review is required before promotion. Three divergent persona
routes and authority follow-up are paper simulation, not runtime verification.
Official SDK2.4.0 server/client +node2.1.2 actually exercised two clients over
loopback HTTP, five assertions passed; this proves selected transport capability
only. Current merged main bba7a9a has protected CI1891 tests/104suites, zero failures
or skips, verified exact tree3740de1. Service implementation and real qualified
plan/native/legacy-client/restart journey remain explicit DoD obligations.

Native context isolation claims retain actual canary/trace/launch evidence from
qualified workers. A successful MCP client exchange alone never establishes that
claim. The two known stage report edge cases have recorded negative evidence and
must gain executed regression proofs before the implementation release.
