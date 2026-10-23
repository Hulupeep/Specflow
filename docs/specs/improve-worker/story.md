# [SPECFLOW] IMPROVE-SERVICE-02: qualify an isolated worker and durable evidence adapter

Parent: #215 · Story: IMPROVE-SERVICE-02 · Planning depth: `spec:thin`; not build-ready.

## Outcome
Prove where an unattended Improve cycle can run before promising a managed-agent deployment.

## In Scope
One bounded qualification spike using existing core/routing; compare configured local subscription CLI and OpenAI managed-runtime capability requirements; implement only the first approved viable adapter.

## Not In Scope
No assumption about provider account access, subscription/API equivalence, new paid infrastructure, or automatic switch to API billing.

## Dependencies
#176, #180, #216

## Acceptance criteria
- [ ] AC-WORKER-01: Every required capability has observed evidence or an exact unavailable blocker; a reachable API alone does not count.
- [ ] AC-WORKER-02: A worker run yields core-compatible receipts; a different role name cannot create evaluator independence.
- [ ] AC-WORKER-03: Attempted credential/host/cross-job access fails; an unconfined worker is rejected even if tests pass.
- [ ] AC-WORKER-04: Loss of the worker does not lose a verified result, and failed artifact persistence cannot be reported complete.
- [ ] AC-WORKER-05: The report states the actual mode, unknowns and configuration needed; a subscription job never silently starts API-billed work.

## Requirements proposed for preparation
- REQ-WORKER-01 (MUST): Record a capability matrix for Git, Node/package manager, Playwright/browser, real seeded backend, process lifetime, filesystem/egress isolation, secret injection, durable artifacts and existing independent review roles. Distinguish documented capability from observed execution.
- REQ-WORKER-02 (MUST): Run the same pinned single-cycle interface through the selected approved worker with no duplicate Improve logic. Preserve all evaluation, hidden-holdout, version and model-routing boundaries.
- REQ-WORKER-03 (MUST): Keep repository execution away from control-plane/publisher credentials and other repos. Test denied egress, host reads and cross-job access at the actual isolation boundary.
- REQ-WORKER-04 (MUST): Persist receipts/artifacts outside the ephemeral worker before acknowledging terminal completion; destroy the worker and recover the complete decision from durable evidence.
- REQ-WORKER-05 (MUST): Use an explicit execution/usage mode: subscription_cli, api_billed or unknown. Preserve observed usage without interpreting CLI estimated dollars as an invoice. Missing account permission or route is a typed blocker; no unauthorised fallback.

## Evidence and open decisions
- Deployment host, account capability, secret mechanism and private evidence store are not selected/verified. This spike produces that decision; it does not claim an available managed host.

Planned verification (not executed or existing-path claims):
- tests/integration/improve-worker.test.js (planned: live selected sandbox and durable-store round trip)
- Existing improve-core suites and approved adapter negative probes


## Selected execution contract (owner-delegated engineering decisions)

Use the first observed viable local adapter: Docker29/cgroupv2, an offline scratch image pinned by ID, separate app and checker containers, shared job-only network namespace with no external networking, separate PID/filesystems, read-only roots, no capabilities, no-new-privileges, bounded memory/process/CPU/time/output. No provider/publisher credentials or Docker socket are mounted. Bind only approved software, source, job-only fixture credential and checker-only oracle. Dependency acquisition is offline from a pinned read-only layer; cache misses block instead of enabling egress.

Reuse the existing Improve core once, with normal critique, independent prebuild oracle, frozen contract/baseline, Sonnet builder and Opus peer/evaluator in distinct observed contexts, once-only deciding holdout and mechanical decision/finalization. Model roles run in the trusted control plane using normal OAuth subscription auth, --safe-mode, --restricted, empty I/O tools/MCP, no permissions prompts and no session persistence. StructuredOutput is a permitted non-I/O serialization mechanism. --bare is prohibited for this route because installed help makes it API-key-only. Validate actual effective models/context/input binding; role names are not independence.

Qualify on a bounded Node HTTP/persistent-state repository fixture, not another claimed HeyStax product improvement. Real Playwright owner-save/reload/readback and wrong-credential403/unchanged-state assertions must run at1280 and360. The observed window.status collision is the bounded fixture candidate. #180 already proves the real HeyStax product cycle; a Supabase/Next worker recipe remains explicitly unqualified until separately exercised. No production schema, service key, data or deployment.

Use the actual merged #216 profile/preflight/withAuthorized API and same job-bound profile revision at every new protected transition. #176's merged runtime-binding repairs and #180's completed real-product proof are foundation evidence; do not falsely declare all of the still-open #176 parent implemented. This slice supplies its isolated-worker seam. General MCP/service, plugin, scheduler and repeated-nightly controller remain #218/#219/#181.

Controller artifacts, keys and core ledger are outside containers. Quiesce the whole worker cgroup before bounded artifact capture, then confirm all worker termination before durable commit. This preserves tmpfs outputs without allowing a live writer during snapshot. Reject symlinks, hardlinks, special files, traversal and excessive counts/bytes; secure extraction uses fd-relative no-follow access. Fsync files/directories, authenticate job/revision/blob manifest, atomically commit before terminal acknowledgement. A lost acknowledgement returns that same committed result; wrong/missing/tampered evidence is blocked. Recovery is historical evidence, never new KEEP or publication authority. No automatic GC; incomplete snapshots stay quarantined for owner inspection. Guarantee is worker/container loss on the same healthy local disk, not host/disk disaster.

## Simulation-derived supplemental acceptance (original criteria preserved)

- [ ] AC-WORKER-06: Malicious Git configuration/filter/helper content and model file paths cannot execute on the host, escape approved paths, mutate protected metadata, or expose oracle/host/cross-job canaries.
- [ ] AC-WORKER-07: Real app/checker filesystem/PID and network boundaries deny host/credential/cross-job/IPv4/IPv6/DNS access while approved checker-to-app traffic and job-only fixture access succeed.
- [ ] AC-WORKER-08: Lost acknowledgement is idempotent; corrupt/wrong-job/wrong-revision/missing manifests or blobs and write/fsync/commit failures never yield a fabricated terminal success or rerun a consumed holdout.
- [ ] AC-WORKER-09: Actual fresh-context model calls have only non-I/O structured output, approved observed effective models and input nonce/digest binding. Wrong provenance, duplicate/invalid/out-of-scope output, API mode or stale authority is rejected with an actionable diagnosis.
- [ ] AC-WORKER-10: The mapped actual browser journey exercises seeded owner write, reload/persistence and denied403/no-mutation at desktop and360px; missing/failed/skipped required execution blocks qualification.
- [ ] AC-WORKER-11: Qualified runtime/launcher/helper/software-layer bytes and all consumed generated inputs remain bound and checked; mutable logs cannot hide a consumed dependency or build. Destroying workers retains complete decision/receipts/patch and any retained Git commit bundle.
