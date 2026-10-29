# Real-product worker recipe — implementation plan for #176

Parent: #171; bounded multi-cycle consumer: #172. This supplements #176 and the
qualified #217 worker; it does not reopen or replace their historical evidence.
Status: preparation, not implemented or qualified.

## Outcome and scope

Run the real Next application and its dedicated Supabase backend inside the
existing worker boundary, then feed actual browser evidence to the existing
Improve core. No alternate evaluator, simulated backend, host build fallback,
network-enabled worker, production credentials, or automatic publication.

Weight: security-sensitive cross-repository runtime change. Use simulation,
contract/integration tests, actual confinement probes, real backend journeys and
independent review. No product schema/RPC changes are proposed; existing product
migrations and RLS must execute unchanged in the new disposable backend. A schema
change discovered later requires re-triage and the database gates.

## Observed starting point

- Published worker 0.12.0 completed its synthetic fixture cycle and recovery.
- Its existing same-job shared network namespace passed an actual loopback
  positive control and separate-namespace/unowned-container denials.
- Current target at `63c44153b5006edad8872adc92152515111225e3` uses Next16.0.10,
  pnpm10.7.1, 11 runtime and13 development dependency declarations.
- Current target disk usage is549MiB for dependencies and44MiB for `.next`.
  Historical larger build sizes are not a current measurement. Build peak usage
  still needs measurement; a small final directory does not establish its peak.
- The target's recorded package store is on the Crucial disk,546MiB. The other
  pnpm stores in the user home are not evidence of a usable target cache.
- `runOfflinePackage` rejects dependencies. `DockerWorker.create` caps each
  requested tmpfs at256MiB. Artifact capture rejects symlinks/hardlinks, does not
  reconstruct empty directories, and writes files mode0600. These semantics
  cannot silently be reused to recreate an executable pnpm dependency tree.

## Ordered slices and acceptance

### A. Sealed dependency/build inputs

REQ-NEXT-01 MUST: acquire dependencies only inside the existing confined setup
worker from an explicitly selected, content-bound read-only offline store and
frozen package/lockfile/tool versions. Disable lifecycle hooks and repository
package-manager configuration during acquisition. Cache misses, workspace/file
dependencies, unsupported package hooks or lock mismatches give named failures;
they never enable network or execute host scripts.

AC-NEXT-01: real target offline acquisition succeeds with the selected cache, or
returns an exact unavailable artifact before build. A missing-cache negative
case performs no network acquisition. Final qualification requires success.

REQ-NEXT-02 MUST: use an explicit resource profile for this recipe with finite
aggregate tmpfs, memory, CPU, PID, phase-time, file-count and capture-byte limits.
Keep legacy defaults. Reject invalid/oversized/overlapping mounts before creating
a container. Record configured limits and observed outcomes; exceeding a limit
destroys the owned phase and cannot yield a usable capsule.

AC-NEXT-02: a dependency tree larger than256MiB is materialized in confinement;
over-limit and interrupted runs leave no admitted output and no surviving worker.

REQ-NEXT-03 MUST: introduce a dedicated sealed-input capsule format rather than
relaxing ordinary evidence capture. Preserve regular-file bytes, necessary
execute permissions, directories and internal relative symlinks. Resolve every
link against the complete captured graph; reject absolute/dangling/cyclic/escape
links, hardlinks, special files, privileged modes and concurrent writers. Inputs
are captured from a quiesced owned container, imported into a new private path,
verified completely, then admitted atomically. Never follow source or destination
links during host extraction. A partial copy remains quarantined.

AC-NEXT-03: actual pnpm-style internal links and executable binaries survive a
capsule round trip and execute only inside a worker. Adversarial links, links to
host canaries, permissions changes, missing entries and interrupted capture are
rejected without altering destination/host content. Ordinary evidence capture
continues rejecting all links.

REQ-NEXT-04 MUST: bind the full installed dependency capsule, source, environment,
package-manager/configuration, build command and generated executable outputs.
Run the real production build in confinement. Seal generated consumed inputs
before browser verification; mutable logs/caches cannot conceal consumed code.
Restore/import/mutation invalidates stale receipts. Keep host paths out of
logical equivalence only when actual bytes and semantics match.

AC-NEXT-04: the actual target builds using the admitted dependency layer; a
dependency-byte, executable-mode or generated-input mutation fails validation
before the next protected invocation. No host-built `.next` is accepted as this
qualification's build evidence.

### B. Job-owned backend recipe

REQ-NEXT-05 MUST: pin and inspect real Postgres/Auth/REST/gateway images and
configuration; use one network-none job namespace with separate filesystems and
process namespaces. Create fresh job-only database/auth credentials, apply the
existing target migrations and seed only disposable test users/data. Mount no
existing database volume or host credential. Resource limits and process-loss
teardown include every service. No port publication or host networking.

AC-NEXT-05: actual Auth login and REST/database write/readback succeed in the job;
wrong-user access is denied by real RLS. Host/other-job/production/egress negative
probes remain denied with positive controls. Owner teardown removes only this
job's resources. Unknown or unavailable service readiness prevents execution.

### C. Existing core and real product proof

REQ-NEXT-06 MUST: replace the fixture-only backend identity with a recipe-specific
manifest covering exact services, seed/migration identity and controlled state.
Baseline/candidate get equivalent fresh backend state. No reused polluted state
or prior consumed holdout. Reuse existing frozen contracts, independent roles,
once-only deciding checks, mechanical evaluation and durable recovery.

AC-NEXT-06: actual browser1280px and360px journeys reach a meaningful product
workflow, persist a change, reload/read it back and exercise a permission failure.
Record exact source/runtime identities and executed/failed/skipped counts. A
fresh #171 improvement cycle retains independent product/UX judgment and durable
decision evidence; #172 then exercises the bounded multi-cycle path. No fixture
cycle, build success or this plan can substitute for those proofs.

## Delivery sequence and kill check

Implement A first, then B, then C. Continue useful preparation while a backend
diagnostic is unavailable; never change the host firewall merely to make a probe
pass. Kill an approach that needs a network-enabled application, mutable consumed
dependency layer, shared database mutation or an unverifiable snapshot. Reframe
the mechanism, preserving the intended real-product outcome.

Expected code owners: `scripts/improve-worker.cjs`, a dedicated capsule helper
beside `scripts/improve-worker-store.py`, recipe/qualification entrypoints,
`tests/contracts/improve-worker.test.js`,
`tests/integration/improve-worker.test.js`, and relevant new capsule tests.
Existing frozen worker/holdout history and ordinary artifact capture are retained.
New YAML rules belong in `docs/contracts/`, not this planning document.

## Simulation Findings (proposed)

- **Returning operator:** intact cache → confined acquisition → sealed build;
  missing cache or a changed lockfile → named unavailable state. Gap: selecting
  any available store can misrepresent reproducibility. Add REQ-NEXT-01 and its
  miss/mismatch checks; record the exact selected store identity.
- **Hostile repository:** ordinary package → isolated setup → usable runtime;
  dependency hook, escaping symlink or privileged executable → rejection before
  host effect. Gap: generic capture cannot recreate pnpm links/execute modes.
  Add REQ-NEXT-03 with a separate capsule boundary and hostile graph tests.
- **Interrupted operator:** completed build → durable capsule → verification;
  process loss during import or a changed service seed → no admitted capsule or
  comparison claim. Add REQ-NEXT-02/04/06 atomic admission, teardown and identity
  tests. Recovery must not rerun a deciding holdout.
- **Concurrent owner:** two separate jobs → own login/data → own result; attempt
  to join another job or read its backend → denial. Add REQ-NEXT-05 and real
  permission/isolation probes, not merely container-name assertions.

These are paper walkthroughs, not independent runtime review or executed tests.

## Audit phase 1 — gap analysis

Present: parent/IDs, scope, observable positive/negative acceptance, risk routing,
personas, dependency order, existing invariant owners and substantive unknowns.
Missing before build-ready: executable capsule schema and import protocol,
resource-profile limits, target package-configuration support decision, concrete
backend image/seed manifest, executable acceptance mappings and independent
review of the chosen runtime boundary.
SQL changes/frontend interfaces/testids: N/A for slice A, which adds no product
schema or UI. Actual product journeys remain mandatory for slice C/#171.

## Audit phase 2 — surgical additions

Reuse I-WORKER-001 (confinement),003 (bound consumed inputs),004 (quiescent bounded
capture),005 (durable history),006 (honest capability/billing) and008 (module
identity), plus existing #176 runtime requirements. Do not weaken these rules.

Verification mapping:01 offline success/cache miss/config rejection;02 resource
admission/phase death;03 capsule graph and mode round-trip/escape/interruption;
04 actual target build and runtime mutation;05 real service/RLS/isolation probes;
06 fresh independent product cycle and retained recovery. The executable paths
and ABI must be settled for each selected slice before its implementation gate.

```gherkin
Feature: Real-product execution without host authority
  Scenario: Confined offline build
    Given the target lockfile and a complete bound offline dependency store
    When the approved worker installs and builds the target
    Then its complete dependency and generated inputs are admitted as sealed capsules
    And no repository code has run on the host or acquired network access
  Scenario: Unsafe or incomplete capsule
    Given an escaping link or an interrupted capsule import
    When the worker attempts admission
    Then no capsule is available for verification and host content is unchanged
  Scenario: Real backend is unavailable
    Given the target services have not passed their real readiness and auth probes
    When an improvement requests its baseline
    Then it reports that named prerequisite and cannot report a product gain
```

## Audit phase 3 — current result

Not build-ready. P1: settle the capsule ABI/import protocol and finite resource
profile before coding slice A; resolve backend manifest and executable journey
mapping before B/C. No passing compliance or production gate is claimed.
Next action: specify and test the capsule graph/admission boundary, then re-run
simulation/audit/pre-flight for slice A with exact artifacts and content hashes.
