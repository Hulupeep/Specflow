# #218 — authenticated durable Improve API/MCP

Parent #215. Authoritative original acceptance is GitHub #218 body and comments
(REQ/AC-SERVICE-01–20); this selected brief supplements those sources. No UI,
Postgres/RPC or migration is introduced. SQL, pgTAP and graphical selectors do
not apply. Non-UI journey execution is required before implementation completes.

## Outcome and routing

An authorised agent starts or recovers one registered, qualified job without
holding an overnight tool call open. The service strengthens operational trust;
it does not select a different research idea or introduce a second builder.
Weight: new auth/durable interface, with independent simulation, full contracts,
real process/storage/client journey and Duo. Dependencies #216/#217/#181/#182/#183
are reused. Database access, new hosting accounts, API billing, arbitrary commands,
autonomous publication/merge/deploy and Hooktunnel guarantees are outside this slice.

## Selected boundaries

See preparation.md and interface.d.ts. Owner-local Linux/Node22 service binds
127.0.0.1; one authenticated HTTP application exposes API v1 and MCP. Use official
MCP server/client2.4.0 and Node middleware2.1.2, with pinned lockfile and tested
legacy-client compatibility. Missing remote ingress remains explicit; no public
hosting/deployment is claimed from a loopback test.

A credential identifies its real principal plus role/holder/assignment revision.
Credentials are owner-provisioned, private, revocable and never emitted to chat,
logs, source or tool output. V1 admission supports the authenticated policy
creator, including multiple separately auditable agent credentials acting for
that principal. A noncreator is rejected before dispatch; do not impersonate the
owner to simulate delegated admission. A bot/model brand is never an authority.
Authenticate the credential’s stored principal/role/holder/assignment revision
against the current assignment. A mismatch is denied; never relabel an old
credential as its successor. Replacing a client credential does not implicitly cancel accepted owner-host
work. Revoking execution grants or explicitly cancelling does prevent new work.

The owner registers qualified repo/worker/plan bindings once. A prepared task
reference is data: stable task/experiment identity and source/contract revision,
not a path, executable, routing override or permission. A host-resolved prepared
plan uses existing core/worker stages. Unsupported/missing plans return an
agent-owned preparation action; service reachability alone is not readiness.
No generic arbitrary-repo or unsupported-adapter execution is advertised.

Admission atomically stores original canonical request, task→job claim and
pending dispatch intent in the existing controller transaction. An identical
currently authorised retry returns its original receipt before resolving changed
defaults. Changed payload/contract under an existing identity conflicts. Another
request for the same task cannot create another worker; reveal only currently
permitted existing/owned status. Profile/default changes cannot re-admit a job.

The original horizon starts at admission, including queue time. Admission records a trusted live host assignment and immutable client provenance.
After acceptance, dispatch uses a separately trusted owner-host execution assignment;
client role replacement alone neither invalidates it nor creates a new job. Then
use owner-authorised worker assignment,
generation and ticket. A paused child cannot execute before its durable release.
Restart reconstructs the original job and reconciles existing operation evidence;
queue lease/timeout never proves death or authorises replay. All metadata outside
the controller is subordinate bookkeeping, not a second ownership/recovery store.

Cancel stops new execution and future proposal publication. Preserve finalized
results and already-issued operations; reporting/cancellation acknowledgement
and reconciliation still occur. #219 implements publication and consumes this
retained cancellation intent. Disconnect is not cancellation. Unknown external
completion and known-stage repair remain the explicit unsupported recovery
boundaries from #183; no release/refund/reset command is added.

Every control request is durably bound to its original internal command payload
and expected generation before execution. An identical authorised retry returns
that command’s receipt, never a freshly derived generation or repeated action.

Status embeds the shared authenticated report, original limits/consumption,
profile/task binding and separate delivery state. Historical KEEP, current
verified improvement, experiment verdict and delivery are distinct. Correct the
shared known-stage report edge cases after cancel/deadline before exposing API v1.

## Required executable journey J-SERVICE-RECOVER

1. Start real local service with an owner-private qualified profile/plan and two
   real MCP clients plus CLI. Client portability is distinct from native context
   isolation, which requires actual canary/trace/launch evidence. Preflight shows actual supported versions, worker,
   backend, billing and permission findings; no model call occurs.
2. Both clients request one task; durable acceptance occurs before response.
   Lose the response, retry and use repo-scoped lookup: one original run/claim.
3. Kill/restart service at admission/dispatch/receipt boundaries; the same run,
   original horizon, authority and operation identities survive. No unknown
   provider/holdout is repeated. Worker assignment/release uses #183, not timeout.
4. Observe matching CLI/MCP/API report ID/revision and actual core/archive facts.
   Missing retained evidence removes a current claim, not historical decisions.
5. Execute denied identity/extra-field/cross-repo/Origin/Host/version/revocation
   paths and known/unknown/cancel/deadline branches; assert zero extra starts.

Planned specs: tests/contracts/improve-service.test.js and
 tests/integration/improve-mcp.test.js. These paths are obligations, not current
execution claims. Node/backend/native release evidence is separate from doubled
protocol tests. A real service journey must run; no skipped stub can finish.

## Definition of done

Every original AC1–12 and proposed AC13–20 has a test mapping; strict transport,
owner-private auth, atomic admission/dispatch and reconstruction are qualified.
Run current unit/contracts, real-client process journey and protected CI with no
required failure/skip, source/privacy gate and independent review. Commit/push,
review and merge; report execution and optional delivery separately. #219 and
parent operational release remain open. Preparation itself grants no build readiness.
