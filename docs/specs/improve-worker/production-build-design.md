# Confined production build — #291

Preparation proposal, not implementation acceptance. Parent #176; consumers
#171/#172. Reuse #282 capsules and #284 acquisition. The fixed acceptance is
the six REQ-BUILD/AC-BUILD pairs in #291. No production code has changed.

## Evidence and architecture decision

Actual Next 16.0.10 rejects an external node_modules symlink under Turbopack.
An exact in-root copy then fails native SWC loading on the noexec work mount.
The discriminating control loads the same library from the read-only admitted
capsule; actual kernel mount flags distinguish the two locations. All owned
workers were removed. These observations do not establish a successful build.

The proposed internal `production-build-v1` layout is:

| Destination | Input authority | Mutability |
| --- | --- | --- |
| `/app` | same-job source capsule | read-only |
| `/app/node_modules` | same-job dependency capsule | read-only |
| `/app/.next` | finite generated-output tmpfs | writable, noexec |
| `/tmp` | disposable scratch | writable, noexec |

This is a closed internal layout, not a general overlap allowance. The only
allowed ancestry pairs are `/app` with its two exact children above. Existing
legacy and acquisition topology validation remains unchanged. Reject all
other duplicates, ancestors, descendants, noncanonical paths and shadowing of
trusted software before Docker. Caller-provided mounts cannot activate this
exception. `/app` has reserved empty ordinary directories `node_modules` and
`.next`; reject links, files, nonempty directories and source conflicts there.
These entries and modes belong to the source capsule identity. Never silently
drop tracked source content to manufacture the reserved directories.

The source ancestor stays read-only: code cannot rename a dependency mount's
parent and substitute a new mutable tree. Before repository code executes,
validate actual Docker inspection and kernel mount topology, flags, IDs and
destinations. A mismatch destroys the worker. Capture source/dependency
write-denial and parent rename/unlink/link-replacement negatives with a
writable-output positive control. Native SWC loading must genuinely succeed
from the admitted dependency mount.

Network none, no published ports, dropped capabilities, no-new-privileges,
non-root UID, software-library pinning and credential isolation are inherited.
No executable writable work mount is introduced. Initial resource bounds:
output 1 GiB, scratch 128 MiB, aggregate tmpfs 1152 MiB, memory and swap 2 GiB,
CPU 1, PIDs 128, phase 600 seconds and watchdog grace 10 seconds. These are
finite proposed bounds, not proof that the real target builds within them.

## Build input and receipt interface

No SQL, RPC, RLS or graphical UI changes. This is a filesystem/process and
JSON interface; browser selectors do not apply. Use the implemented nested capsule receipt below; the older flat planning
sketch in `capsule-design.md` is not the shipped ABI. No caller-authored
substitute is trusted.

```typescript
type Digest = string; // validated lowercase SHA-256, exactly 64 hex digits
interface CapsuleReceipt {
  identity: { jobId: string; sourceContainerId: Digest;
    recipeSha256: Digest; sourceInputSha256: Digest };
  manifestSha256: Digest;
}
interface ProductionBuildInput {
  schema: 'specflow.production-build-input/v1';
  jobId: string;
  source: { target: string; receipt: CapsuleReceipt };
  dependencies: { target: string; receipt: CapsuleReceipt };
  dependencySource: { packageSha256: Digest; lockSha256: Digest;
    manifestSha256: Digest }; // acquisition's admitted store manifest
  runtimeSha256: Digest;
  command: readonly string[];
  environment: Readonly<Record<string, string>>;
  resourceProfile: 'production-build-v1';
}
interface ProductionBuildReceipt {
  schema: 'specflow.production-build-receipt/v1';
  jobId: string;
  inputSha256: Digest;
  producerIdentitySha256: Digest;
  output: CapsuleReceipt;
  buildIdSha256: Digest;
}
```

The executable proposals are `production-build-input.schema.json` and
`production-build-receipt.schema.json`. They reject unknown keys, invalid enums
and malformed digests. Runtime semantic validation must additionally reject
foreign jobs, NULs, malformed Unicode, duplicate JSON keys and unapproved
commands/environment; JSON Schema alone does not prove those constraints. Complete input identity includes source,
dependencies, runtime/software/library bytes, command, cwd, controlled effective
environment, profile and format version. Secret values stay private; only
digests and sanitized reasons can be published. A lockfile alone is not a
dependency identity. Do not normalise away meaningful paths or variables.

Command selection is recipe-owned, fixed before invocation and bound in the
receipt. Build exits zero plus nonempty BUILD_ID is necessary, not sufficient.
Pause the producer and capture all consumed `.next` entries using the existing
capsule admission protocol; no live writer may affect the admitted tree.
Source/dependency/output/runtime/command/environment mutation invalidates
before the next protected invocation. A newly created consumer uses only the
admitted source, dependency and output identities. No host-built output counts.

Fresh admission per job remains mandatory. Recovery checks a prior admitted
result by its exact job and input identity; it does not turn incomplete build
output into a receipt or replay a consumed holdout. Preserve raw stdout/stderr
for every phase, including preparation, inspection and capture, before error
propagation. Failed output never receives a successful receipt. Confirm owned
process teardown before acknowledging a terminal result.

External fonts or other build-time fetches remain an explicit qualification
uncertainty. Do not mock them, stub modules, change the pinned product silently,
enable unrestricted egress or claim synthetic success. A newly observed input
requirement must be recorded and resolved with bound real inputs before AC1.

## Simulation Findings (proposed)

Scoped paper routes, not independent review or runtime execution. The builder
accepts these engineering additions under standing implementation authority;
no product or spending decision is inferred.

1. **Returning operator** needs trustworthy recovery. Happy route: admitted
   input → completed build → paused capture → fresh consumer. Divergence:
   crash after build but before durable capture → no output receipt; preserve
   cause and remove owned worker. Gap: distinguish raw build output from
   consumable output. Addition: REQ-BUILD-04/05 requires durable admission and
   exact recovery identity; test `build-capture-interruption`.
2. **Hostile repository** stresses nested mounts. Happy route: source/dependency
   reads and output writes. Divergence: rename `/app` or dependency parent,
   replace reserved directory, introduce a source link, or supply an extra
   mount → deny before execution or at the immutable boundary. Gap: a writable
   ancestor could allow relocation. Addition: REQ-BUILD-02/03 fixes the source
   ancestor read-only and requires live relocation controls; tests
   `build-layout-rejection`, `build-input-write-denial`.
3. **Replacement coding agent** cannot inherit stale authority. Happy route:
   current same-job admitted inputs → current invocation. Divergence: copied
   foreign receipt, changed library, modified command, restored output bytes
   or absent installed helper → reject before execution. Gap: a receipt without
   complete command/runtime identity could appear reusable. Addition:
   Mapped to REQ-BUILD-04/06 and tests `build-input-mutation`, `build-installed-pins`.
4. **First real-product operator** wants an actual app, not a fixture. Happy
   route: native compiler and complete real product build. Divergence: font
   fetch, unsupported write or resource exhaustion → exact unavailable reason,
   no fallback or completion. Addition: REQ-BUILD-01/05 and tests
   `build-real-target`, `build-failure-diagnosis`.

No owner decision is needed for these safety requirements. Actual resource
capacity and external build inputs need evidence, not a product guess.

## Verification / Definition of Done

| Requirement | Planned executable checks |
| --- | --- |
| REQ-BUILD-01 | `build-real-target`, complete receipt and actual BUILD_ID |
| REQ-BUILD-02 | `build-layout-rejection`, actual-mount mismatch, legacy/default parity |
| REQ-BUILD-03 | `build-native-load`, `build-input-write-denial`, real egress/canary controls |
| REQ-BUILD-04 | `build-input-mutation`, `build-fresh-consumer`, capture/admission faults |
| REQ-BUILD-05 | `build-capture-interruption`, deadline/ENOSPC/process loss and diagnostics |
| REQ-BUILD-06 | `build-installed-pins`, existing worker/capsule/acquisition regressions |

Planned files: `tests/contracts/improve-production-build.test.js`,
`tests/integration/improve-production-build.test.js`, and existing
`tests/contracts/improve-worker-install.test.js`. No such new test execution is
claimed yet. The normative proposed YAML is `feature_production_build.yml`.

```gherkin
Feature: Confined native production build
  Scenario: Complete admitted real build
    Given current same-job source, dependency and native runtime identities
    When the real production command completes inside the validated layout
    Then paused output is admitted with a complete bound receipt
    And a fresh same-job consumer validates and uses that output
  Scenario: Reject replacement inputs
    Given an admitted result
    When any consumed byte, mode, command or environment identity changes
    Then protected invocation is denied before repository code runs
  Scenario: Stop without inventing success
    Given a build or capture in progress
    When its process dies or a required input or resource is unavailable
    Then no consumable success receipt is returned
    And private phase evidence and confirmed owned teardown remain available
```

Done requires every AC, canonical CI and scoped independent review, not merely
this proposal. Real backend and product journeys remain tracked in #176/#171;
bounded cycles remain #172. No graphical UI journey is being waived.

## Audit — phase 1: gap analysis

Feature/runtime ticket. Present: parent/ID, outcome, scope, six atomic
requirements and negative acceptance, finite resource proposal, DoD and test
owners. Missing before additions: persona routes, typed interface, invariant
mapping, Gherkin and explicit architectural decision. These are supplied above
and in the YAML; no unrelated SQL/UI ceremony is added.

## Audit — phase 2: surgical additions

The typed interface, scoped simulation, recovery/capture semantics, immutable
ancestor rule, Gherkin and test matrix supplement #291 without replacing its
acceptance. Reuse I-WORKER-001/003/004/005/008, I-OFFLINE-001/003/004 and the
capsule contract. New I-BUILD-001..004 are proposed in the new YAML; no existing
invariant is weakened. Schema/migration/testids N/A because no DB/UI changes.

## Audit — phase 3: preparation findings

Planning inspection only; **not compliant/build-ready yet**.

- P1: strict input/receipt schemas now exist and match the implemented nested
  capsule receipt. Their executable positive/negative validation and canonical
  identity serializer specification still need preparation evidence.
- P1: the exact executable preparation mapping gate and scoped native review
  remain missing. Proposed tests above are not execution evidence.
- P1: actual kernel validation algorithm and generated-output capsule bounds
  need a concrete ABI mapping; no arbitrary mount parser or larger-output
  exemption is authorised by this prose.
- Required reconciliation: recovered historical D4 and current build-layout
  discoveries remain visible; acknowledge with changed references and current
  gates before promotion. Do not erase them to get a passing state.

Next: settle those executable preparation artifacts, re-run scoped pre-flight
and native preparation review, then implement #291. No production code or
production gate pass follows from this document.

## Preparation addendum: exact identity and mount protocol

This addendum resolves the design questions above; the earlier findings remain
as history until current checks and review validate the resolution.

The named profile is the exact object in `production-build-profile.json`.
Capture limits are 1 GiB aggregate, 512 MiB per file, 100,000 entries, depth
128 and 300 seconds, all within the unchanged capsule helper ceilings.
Exhaustion fails explicitly; no truncated manifest is accepted. Build deadline
and capture deadline are separate bounded phases; preserve their actual times.

### Identity serialization

Validate both schemas plus semantic rules before hashing. Reject duplicate
JSON keys, NUL or lone surrogate characters anywhere, floats/non-finite numbers,
integers outside the exact safe-integer range and unknown fields. Object keys
in this ABI are ASCII; keys sort by ASCII byte order, arrays retain their order,
strings encode as UTF-8 with JSON control/quote/backslash escaping and no ASCII
escaping of other Unicode. Emit compact JSON without whitespace or newline.
SHA-256 of those bytes is the identity. Fixed vector:
`{"a":{"b":"x"},"z":[true,null,3]}`. Boolean values are not numeric fields.

The logical input object is the schema-valid request with each source/dependency
`target` replaced by its fixed container destination, plus `cwd: "/app"`, the
exact complete resource-profile object and `helperAbiSha256` from the pinned
installed runtime. This omits only private host storage locations, never file
bytes, modes, links, capsule provenance or relevant execution semantics. Before
hashing, validate actual host targets through existing no-links and same-job
capsule admission checks. Equivalent relocation inside the same permitted job
root can preserve identity only when the entire expected capsule verifies;
foreign-job relocation remains rejected.

`dependencySource` is the exact acquisition source preimage: packageSha256,
lockSha256 and admitted store manifestSha256. Hash it with the shipped offline
canonical serializer and require equality with the dependency capsule receipt's
sourceInputSha256. Compare its package/lock hashes to the regular `package.json`
and `pnpm-lock.yaml` entries in the source capsule manifest. This prevents a
valid same-job dependency capsule for another source from being substituted.
The descriptor is not independent authority: only the matching trusted receipt
and verified source/capsule manifests can authorize consumption.

The schema fixes the actual Next production command and the controlled variable
names. No inherited environment is included. CI, NODE_ENV, telemetry, heap
option and auth-bypass values are fixed by the schema. The explicit public
backend URL/key values are bound, private in evidence, and never inferred from
the owner's environment. URL must be HTTP with a literal loopback host, no
userinfo/query/fragment; require an explicit port in 1..65535. The anonymous key
is an explicit per-job fixture value or labelled compile-only placeholder,
never an authority to access production. This is not an Auth/RLS proof.
Trusted mount-inspection/control commands always use their separate clean
control environment, never repository build variables.

### Closed mount protocol

1. Validate the selected profile before Docker: reject generic extra mounts,
   custom tmpfs/resource overrides, wrong role, altered command/environment
   shape, wrong job and invalid/changed capsules. Validate source manifest
   entries `node_modules` and `.next` as empty ordinary directories with no
   descendant entries. Source must include a regular package manifest, matching
   its admitted dependency recipe; reject conflicting reserved paths. Existing
   capsule graph checks remain mandatory.
2. Construct the fixed source/dependency/output mounts internally. Trusted
   software mounts must remain disjoint from all three. Do not expose a flag
   that disables `validateMountTopology` for generic callers. The build-only
   validator allows exactly the two listed ancestry pairs, not siblings with
   similar prefixes, deeper descendants or a different writable ancestor.
3. After creation, retain ordinary `validateInspection` checks for UID, image,
   network, ports, capabilities, memory/swap, CPU/PIDs and mount source/mode.
   Read the actual worker's `/proc/self/mountinfo` with pinned Node under a clean
   environment before any product code. Parse the separator ` - `, mandatory
   fields, unique mount IDs, parent IDs, major:minor, filesystem type, mount
   options and superblock options. Decode only documented kernel octal escapes
   (`040`, `011`, `012`, `134`); reject malformed input and duplicate critical
   destinations. Bind the observation to the same running Docker container/PID
   and process-start identity before and after inspection.
4. Require exactly one mount at each `/app`, `/app/node_modules`, `/app/.next`
   and `/tmp`. Reject every unexpected mount below `/app`, including recursive
   source submounts. Source and dependency mounts must be read-only; dependency
   mount must permit native executable mapping. Output and scratch must be
   tmpfs, writable, nosuid/nodev/noexec with the exact bounded sizes and modes
   from Docker inspection. Source/dependency must not alias the writable tmpfs
   mounts. Require the two child mounts to be parented by the `/app` mount in
   mountinfo. A missing or contradictory field fails closed, never inferred
   from an intended CLI flag. Other normal container mounts remain governed by
   existing inspection; do not reject legitimate `/proc` merely for existing.
5. Repeat identity and mount checks before each protected build/consumer
   invocation and before capture. The container owns no capability that can
   alter mounts. Real negative probes must demonstrate input write and parent
   relocation denial; a mocked inspection result is not live qualification.

### Output and recovery

After successful build, stop all build activity by pausing the exact producer,
then capture `/app/.next` with the fixed limits through `captureCapsule`.
Verify its manifest contains a nonempty regular `BUILD_ID`, and bind its bytes
in `buildIdSha256`. No caller-provided BUILD_ID or output path is accepted.
Generated links must satisfy the existing closed-graph rule; an external output
link is a named incompatibility, not a reason to exclude consumed code.

The production receipt is emitted only after durable admission and confirmed
producer teardown. `producerIdentitySha256` binds the validated Docker ID,
image/runtime identity and container process-start identity used for capture.
The output capsule's recipe/sourceInput identities bind the helper ABI and
complete logical input digest. A fresh same-job consumer mounts all three
admitted trees read-only at the same destinations, with scratch disjoint; it
does not create a writable `.next` over the admitted output. Use a separate
closed consumer layout with the same exact nested-pair whitelist and no other
exception. Verify all three capsules and the production receipt before its
protected invocation. Runtime caches are not silently carved out of consumed
output; if the actual target requires such writes, record and qualify that
requirement before widening the layout.

On uncertain admission acknowledgement, use existing same-identity capsule
recovery. A recovered output still requires complete build receipt/provenance
and confirmed teardown before consumption. Do not rerun the build or holdout
merely because an observer timed out. Any unavailable provenance yields an
explicit unavailable state and preserved diagnostics.
