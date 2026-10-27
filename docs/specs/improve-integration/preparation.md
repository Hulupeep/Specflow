# Selected #219 decisions, simulation and pre-flight

## Decisions

- Retain the exact five version1 service operations. Package a local thin plugin
  with portable plugin.json/mcp.json and only observed host compatibility overlays.
  A credential-reading stdio bridge may load the owner-configured installed SDK
  and forward HTTP/MCP only; no controller/worker/scheduler/publisher launch.
  Check active resource hashes/version and service capabilities before admission.
  Resolve private config independently of cwd; emit no bearer or raw private config.
- Two actual installed hosts are Codex CLI0.162.1 and Claude Code2.1.285 at
  preparation time. Their help confirms native install commands; this is NOT an
  installation/tool-invocation pass. Actual installed-candidate proof is DoD.
  Official package reference: https://developers.openai.com/plugins/build/plugins.
- Use the SAME controller transaction for delivery intent, serialized operation
  reservations and exact receipts. Public service task/control schemas stay
  strict. Delivery is an owner-host adapter with separate current publish grants;
  a worker-scoped controller cannot obtain those transitions or credentials.
- I-IMPROVE-005 remains unchanged and enforced on Improve core execution: isolated
  KEEP is local and core has no push/merge credentials or command capability.
  #219 qualifies a DISTINCT external publisher consuming an authenticated result
  and explicit repo/run/commit/base/ref grant. It is not an existing qualified
  exception or authority inferred from KEEP. It never merges/deploys or moves base.
  Independent preparation review must assess this boundary before implementation;
  if it requires a governing contract change, keep that precise blocker rather
  than silently rewriting a non-negotiable.
- Revalidate canonical report/archive/retained Git commit, destination remote,
  exact expected base and ref contents before each NEW issued publication step.
  Bind all bytes to durable intent and privacy-scan exact outgoing text. Push
  exact commit OID, never mutable HEAD, never force unexpected branch contents.
  Cancellation/revocation fences new issuance; previously issued uncertain writes
  are reconciled without claiming they can be recalled after remote commit.
- GitHub reconciliation uses exact configured repo, run marker, head/base/ref and
  returned PR ID. Absent or contradictory outcome after unknown create stays
  unknown; no blind retry. Changed main blocks stale export, without rebasing or
  rerunning consumed holdout. Record independently authenticated PR observation
  provenance into #182 before equivalent reselection; legacy free-form observation
  text cannot supply delivery or merged-baseline authority.
- Live HeyStax discovery2026-10-27:94 accessible Stax; exact configured owner
  Stax7af7f0dc-26e7-4491-806a-407028fe1be7, repo Hulupeep/Specflow. Existing
  adapter-owned action feeaf3dd-8e80-42f7-8c7a-4e410e8dd586 is selected for this
  project. Read actual Stax/permissions/actions before mutation. Preserve other
  human actions and standing Chief of Staff/project instructions.
- Current tools provide Stax/action read/update but no dispatch/atomicclaim/ack;
  no suitable typed job/result record exists. Personal memory.recollection and
  evidence.request have unrelated capture semantics and MUST NOT be repurposed.
  Selected transport is the connected host agent's actual MCP callbacks plus
  explicit polling/reconciliation. No new HeyStax endpoint or Hooktunnel guarantee.
- Prefer the explicitly configured existing action ID for result and next action,
  avoiding uncertain create dedup. Persist prior content digest and adapter marker;
  missing/changed/completed human content is conflict. Exact update read-back can
  reconcile a lost ack. API lacks CAS: no claim of atomic preservation against an
  uncooperative simultaneous editor. Stop on observed conflict; do not claim remote
  exactly-once creation or match a missing item by title. Dedicated new surfaces,
  if requested later, require separately qualified create reconciliation.
- Cold bootstrap maps durable authorised brief/source issue and immutable task to
  current separately provisioned holder credential under the supported owner
  principal. Notifications do not confer permissions. Persist task/job/report
  correlation; delivered projection and recipient observation are separate facts.
  A disconnected host leaves pending work; reconnect polls original identities.

## Simulation Findings (proposed)

Three independent paper personas (not runtime/model execution proof):

1. Publication authority: exact authorised KEEP export succeeds; injected repo,
   revoked grant/cancel between push and PR, changed base/ref and unknown PR ack
   require exact binding/per-step fences and authenticated proposal provenance.
2. Interrupted handoff: duplicate task/result, crash after remote write, role
   change, delayed report and human action edit require controller-held intent,
   read-back reconciliation, monotonic observations and explicit unknown/conflict.
3. Installed-caller/cold successor: both hosts reach one service; stale resources,
   different cwd, absent credentials/service and absent predecessor chat require
   verified active package bytes, private bootstrap and current holder scope.

Concrete additions are AC11–18 in story.md and the typed binding/operation model
in interface.d.ts. They supplement original REQ/AC1–10. No human product choice
was identified; technical proof and independent boundary review remain required.

## Specflow audit — phase1 gap analysis

Type: non-UI agent/service/delivery feature. PRESENT original parent/outcome,
REQ/AC1–10, scope, invariants, Gherkin and planned tests. Missing selected atomic
storage, current publication/remote identity contract, real capability inputs,
installed bootstrap and actor/retry/human-edit semantics. SQL/testids are N/A,
not deferred database/browser implementation. Actual protocol/process/GitHub/
HeyStax execution remains required.

## Phase2 surgical uplift

Added only selected decisions, interface.d.ts, AC11–18, ordered
J-INTEGRATION-RETURN and mappings below. Reuse core I-IMPROVE001–014,
controller/memory/recovery/service contracts unchanged; new delivery invariants
are in docs/contracts/feature_improve_integration.yml. No alternative scoring,
executor, permissions, frozen acceptance or migration.

| Original/supplemental acceptance | Executable obligation |
|---|---|
| AC01,10,17 | tests/integration/improve-plugin-callers.test.js; actual installed-host qualification |
| AC02,03,05,06,07,11,12,13,16 | tests/contracts/improve-publication.test.js; actual GitHub publication journey |
| AC04,05,08,09,11,13,14,15,18 | tests/integration/improve-handoff.test.js; actual connected HeyStax journey |
| All | canonical local/protected CI, privacy and final native Duo |

```gherkin
Scenario: Reconcile authorised export after a lost acknowledgement
 Given an exact retained result and separately granted destination binding
 When PR creation commits but acknowledgement is lost
 Then reconcile the same PR by original marker and exact head/base
 And an unknown or ambiguous lookup never authorises another create
Scenario: Cold replacement recovers the original task
 Given one task has a canonical report and a different holder now owns research
 When a fresh installed caller resolves its authorised durable brief
 Then the current holder retrieves that report and the old holder is denied
 And no build, consumed holdout or proposal is repeated
Scenario: Human edit conflicts with remote projection
 Given the configured action changed after the adapter's last receipt
 When result delivery retries
 Then preserve human content and original core outcome
 And report conflict without creating a replacement action
```

## Phase3 pre-flight disposition

Schema reality: live tools/registry/access read; no invented remote schema.
Authority/shared state: separate publisher under same controller, current grants,
owner-principal replacement mapping explicit. Timing/partial failure: original
horizon, unknown writes, cancel issuance and missing CAS acknowledged. Dependencies:
merged #218 with actual1933/108 canonical local/protected CI and valid Duo7 all22;
#182/#183 reuse those current tests. No remaining identified local CRITICAL/P1
in selected preparation; independent review and executable gate are REQUIRED
before build-ready promotion. This is not passing runtime acceptance or deployment.
