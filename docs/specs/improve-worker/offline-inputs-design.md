# Offline dependency acquisition — #284

Status: preparation proposal; not implementation acceptance. Parent #176;
real-product decisions remain #171/#172. The normative rules are in
`docs/contracts/feature_offline_inputs.yml`.

## Evidence and decision

The confined pnpm 10.7.1 probe installed real React 19.2.1 with a frozen lock
from a sealed read-only store. A fresh consumer read the installed version;
an index-only store failed with `ERR_PNPM_NO_OFFLINE_TARBALL`. All owned
containers were removed. This proves the mechanism for one package only.

The target lock at `63c44153b5006edad8872adc92152515111225e3` has 573 package
and snapshot entries, all with integrity resolutions and one root importer.
Static traversal for Linux x64 glibc reaches 452 snapshots, all represented in
the selected cache index. Neither index presence nor static traversal proves
package byte completeness or a successful full installation.

Use two sequential setup workers: copy approved cache bytes into a private
store, seal that store using the existing capsule implementation, then install
from the read-only capsule. The shared host cache is never an installation
mount. Existing capsule hardlink rejection remains unchanged.

## Proposed interfaces

`prepareOfflineInputs(worker, request)` orchestrates copy, install and capture.
Its request contains immutable package/lock byte references, an approved cache
root and complete cache manifest, expected pinned pnpm version/software-layer
identity, destination, and `resourceProfile: offline-dependencies-v1`.
The job identity comes from the existing worker, not an untrusted package.

A canonical recipe digest covers package and lock bytes, complete cache
manifest, pinned software/tool bytes, effective configuration, platform and
resource profile. A successful response contains the recipe digest and existing
CapsuleReceipt. Failure returns a named diagnostic and no usable receipt.
Diagnostic evidence is private; package configuration and cache contents are
not printed to the issue tracker.

The helper and its in-container copy program join the existing launcher pin
set. Installed and source checkouts use the same implementation. No host
package script or host dependency tree participates in acquisition.

## Cache copy protocol

The approved manifest records every directory and regular file, relative path,
mode, size and SHA-256 digest; content-addressed pnpm blobs also retain their
index-declared integrity. Input manifests have finite file, byte and depth
limits matching or tighter than the capsule defaults. Discovery uses no-follow
descriptor-relative traversal and excludes special files and privileged modes.

Only this source cache boundary permits multiple hardlinks to a regular file.
The in-container copier opens each parent without following links, verifies
the selected bytes and stable descriptor metadata, and creates a new exclusive
regular destination file. Output files have one link. Concurrent source changes
either fail the digest/metadata comparison or produce the already approved
bytes; newly added source entries cannot silently enter the result.

The producer is paused before existing capsule capture. Complete output
manifest comparison establishes that the private copy represents exactly the
approved input. The original shared cache is no longer needed by installation.
Each phase owns its teardown and preserves failed diagnostics without admitting
partial output. A source-copy failure cannot be relabelled a cache miss.

## Resource and mount proposal

The named profile fixes `/work` at 1 GiB, `/tmp` at 128 MiB, aggregate tmpfs
at 1152 MiB, memory and memory-swap at 2 GiB, CPU at 1, PID limit at 128 and
phase duration at 600 seconds. Existing watchdog teardown grace remains 10
seconds. Copy and install run sequentially. These bounds are an installation
proposal, not evidence of adequate resources for a production Next build.

The profile is selected by an exact name; arbitrary numeric overrides are not
part of the recipe API. Legacy callers retain their existing resource defaults.
Pre-create validation compares all effective bind and tmpfs destinations,
including `/tmp` and trusted software. Duplicate paths, ancestors, descendants,
noncanonical paths and attempts to shadow trusted mounts reject. The existing
browser-directory selection happens before this comparison. Docker inspection
checks actual limits and tmpfs options, not just destination names.

## Package-manager boundary

Supported preparation scope: pnpm lock v9, one importer `.`, registry packages
with integrity resolutions, complete snapshot references and peer-qualified
versions, and ordinary dependency/devDependency/optionalDependency groups.
The complete graph is validated, including platform-inapplicable entries.
pnpm remains the installation authority for platform optional selection.

Unsupported local/workspace/link/git/URL/alias dependencies, alternate tarball
resolutions, overrides, patches, workspace catalogs and unknown resolution
forms receive `offline_dependency_unsupported`. Missing snapshot references or
package/lock disagreement receive `offline_lock_mismatch`. Missing packageManager
is allowed only because the trusted recipe explicitly pins pnpm; a conflicting
packageManager declaration fails. No automatic Corepack download occurs.

Only selected package and lock bytes are placed in the installation directory.
Repository `.npmrc`, pnpmfile and workspace configuration are not mounted.
Effective environment is an allowlist, with HOME in private tmpfs,
NPM_CONFIG_USERCONFIG and NPM_CONFIG_GLOBALCONFIG set to `/dev/null`, CI=true,
and no inherited package-manager variables. The fixed command is:

```text
pnpm install --offline --frozen-lockfile --ignore-scripts --ignore-pnpmfile
  --package-import-method=copy --store-dir=/cache
```

Root and transitive lifecycle declarations may exist but do not execute.
Unsupported package-level pnpm configuration fails explicitly. Positive controls
exercise the same sentinel bodies inside disposable workers; absence alone
does not prove the instrumentation works. Full-target qualification also tests
native package consumption with scripts disabled; a needed script is a named
unsupported dependency, never an implicit permission to run it.

## Failure vocabulary and verification mapping

| Code | Meaning | Acceptance |
|---|---|---|
| offline_input_changed | Bound bytes, modes or identity changed | AC-OFFLINE-01/04 |
| offline_dependency_unsupported | Unsupported graph/configuration form | AC-OFFLINE-02 |
| offline_lock_mismatch | Invalid references or frozen input disagreement | AC-OFFLINE-01 |
| offline_cache_miss | pnpm explicitly reports unavailable offline artifact | AC-OFFLINE-02 |
| offline_resource_invalid | Invalid profile or mount topology before create | AC-OFFLINE-03 |
| offline_resource_exhausted | Observed memory/storage/PID bound exceeded | AC-OFFLINE-03 |
| offline_interrupted | Deadline, cancellation or owned process loss | AC-OFFLINE-03 |
| offline_install_failed | Other observed installation failure; retain cause | AC-OFFLINE-02 |

No heuristic turns every nonzero exit into a cache miss or resource failure.
Capsule validation/admission failures retain their existing underlying codes.
No result is consumable until installation succeeds, capture completes and
the existing admission protocol confirms durability.

Planned contract tests cover complete graph validation, recipe identity,
configuration allowlist, finite resource profile and mount shadowing. Integration
tests cover changed bytes, source hardlinks versus forbidden links, copy races,
interruption, partial output and ownership. Actual Docker qualification covers
the full target install, a tree above 256 MiB, hook positive/negative controls,
missing cache, read-only store, fresh Next consumer and zero owned survivors.
Existing capsule, ordinary evidence, install and worker tests remain required.

## Remaining preparation gates

Independently review the exact interface, graph support and resource proposal;
execute preparation checks; apply simulation/audit additions and canonically
promote before production implementation. Full-target runtime success is an
implementation gate. A green single-package probe cannot close this ticket.

## Executable interface artifacts

`offline-request.schema.json` closes the request shape; the current selected
recipe pins pnpm 10.7.1 and Linux x64 glibc. `offline-result.schema.json` describes
only successful output and reuses the actual persisted capsule receipt shape
(`identity` plus `manifestSha256`), rather than the earlier flattened design
sketch. Failed calls throw/return the named failure through the existing worker
error boundary and cannot construct a successful result.

Schema validation is only the first check. Reference paths resolve against the
trusted recipe directory; cache root and output destination are absolute,
canonical, no-follow paths. The output stays beneath the worker's stateRoot and
uses the existing no-replace capsule destination check. Package/lock references
are read as data and checked against their digests before parsing. Neither
caller-provided job identity nor mutable arbitrary environment/resource overrides
are accepted. The success recipe hash equals the nested identity recipe hash;
the persisted capsule and actual bytes remain independently verified before use.
