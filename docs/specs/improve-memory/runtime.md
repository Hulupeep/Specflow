# Decision memory runtime (#182)

Memory extends the existing controller store and authority gateway. New jobs are
memory-enabled only when trusted host configuration supplies `memory.required`,
`resolveActor` and `resolveEvidence`. Legacy jobs retain their recorded mode.
The owner-private CLI host may configure `memory.actor` (holder, assignment
revision, role) and `memory.evidenceRoot`; principal comes from the host identity.

Use controller `decisionPack`, `selectMemory`, `resolveMemory`, `observeMemory`
and the corresponding CLI `memory-*` commands. Commands require stable
`request_id` and the exact pack `expected_revision`. Identical lost-ack retries
return the original receipt. Different input under the same ID conflicts.
The pack contains chained events with `hash`, `previous`, `sequence`, `run_id`,
actor and typed data. Its last 128 events are a projection; suppression reads
all retained history. It is advisory, fenced untrusted input, never authority.
The preparation interface is a proposed logical sketch; runtime event names
are as documented here and enforced by the executable validators.

A family is canonical repository plus sorted affected paths and a normalized
observable. This conservative structural mechanism is not universal semantic
similarity. Rewording the title, changing run IDs or alternating candidate IDs
cannot release that family. New retry evidence must come from a trusted
independent captured observation with relevant scope and metric. Renaming the
same observation is insufficient. Unknown legacy evidence needs reconciliation.

The private file resolver expects `<opaque-id>.json` with version 1, typed
ResolvedEvidence metadata (excluding sha256), and `capture_sha256`, plus a
private `<opaque-id>.capture.json` execution record. It authenticates both files,
checks valid stable execution, and parses an exact `{metric, observed}` scalar
measurement. It never reads caller-provided paths. Other trusted host resolvers
must use `bindCapturedEvidence(metadata, capture)` over authenticated capture
bytes. A plain metadata object or caller assertion cannot authorize a retry.
No raw artifact contents enter the exported pack.

Before cycle admission, the controller validates current profile, registered
Git ref/commit and pack. The worker binds core ID, candidate bytes and frozen
criteria; its critique receives the fenced pack, evaluator/oracle inputs do not.
Terminal code decision and memory append share one transaction after actual
archive authentication. Missing/corrupt evidence retains suppression. Owner
resolution and safe pending-review release are likewise atomic. A closed PR is
an observation, not owner rejection or permission to retry. Retained code becomes
a later baseline only after explicit source-control/profile authorization.

`report.memory` separates original code decisions, verification validity and
latest experiment observations. Default experiment verdict is `needs-change`.
Proven/disproven needs independent evidence against the original criteria.
A KEEP implementation alone proves neither demand nor revenue.

Reproduce the focused qualification:

```sh
npx jest --runInBand --runTestsByPath tests/contracts/improve-memory.test.js tests/integration/improve-memory.test.js
```

These execute real Git, core checks/finalization, authenticated archives,
filesystem faults, competing processes, restart/idempotency and two-cycle changed
selection. Model transport is an explicit protocol double. The worker bridge
launches real processes; this suite does not claim live model quality, a deployed
API, HeyStax product UI coverage, or unattended nightly readiness. Recovery,
API/MCP and bidirectional transport qualification remain #183, #218 and #219.
