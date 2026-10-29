# Sealed input capsule boundary — #176, slice A

Design under preparation; not a shipped API or qualification claim. This selects
the representation and admission rules needed by `next-recipe.md` REQ-NEXT-03.
Ordinary evidence capture keeps its current no-links policy.

## Format

Use a versioned JSON manifest alongside a `tree/` directory. Root-relative entry
names are sorted and unique, with no absolute paths, empty segments, backslashes,
NULs, `.` or `..` components. Link target strings may contain `..` only when
resolution against the complete captured graph stays inside the root. The root
itself is a private directory and is not an entry supplied by untrusted content.

```typescript
type CapsuleEntry =
  | { path: string; kind: 'directory'; mode: number }
  | { path: string; kind: 'file'; mode: number; size: number; sha256: string }
  | { path: string; kind: 'link'; target: string };
interface InputCapsuleV1 {
  schema: 'specflow.input-capsule/v1';
  entries: CapsuleEntry[];
  bytes: number;
  entryCount: number;
}
interface CapsuleReceipt {
  manifestSha256: string;
  jobId: string;
  sourceContainerId: string;
  recipeSha256: string;
  sourceInputSha256: string;
}
```

Reject unknown fields and duplicate JSON keys. Hash canonical UTF-8 JSON with a
fixed serialization, including paths, types, modes, link strings, sizes and file
hashes. Count every consumed file and directory; no dependency/build exclusion.
The trusted job pins the manifest digest and provenance receipt before use.
An attacker-supplied matching manifest alone is not authority to admit a layer.

Serialization is sorted object keys, compact separators, unescaped valid Unicode
encoded as UTF-8, and no trailing newline (Python `sort_keys=True`,
`separators=(',', ':')`, `ensure_ascii=False`, `allow_nan=False`). Sort entries by
their path's Unicode scalar sequence. Reject invalid Unicode, non-integer or
boolean counts/sizes/modes, negative counts/sizes and modes outside0000–0777.
Receipt fields are trusted provenance, not additional tree entries.

## Graph semantics

Resolve links from the root using the manifest graph, never by following a host
path. Every intermediate node must exist and be a directory after link expansion.
Permit at most40 expansions. Reject absolute, dangling, cyclic, escaping and
ancestor-directory links. Every parent must be a declared directory, not a link;
do not copy bytes through a linked parent. Regular files must have one hardlink
only. Reject devices, sockets, FIFOs and setuid/setgid/sticky modes. Preserve
ordinary permission bits, including executable bits and empty directories.

Actual pnpm packages currently contain hardlinks. Acquisition must use the
installed pnpm's supported `--package-import-method copy`, together with offline,
frozen-lockfile, ignored lifecycle scripts and store-integrity verification.
Do not weaken admission because the existing host installation is hardlinked.
A materialized copy of that layout can test representation; it does not prove
the worker performed a valid installation.

## Capture and admission protocol

1. Require the exact job-owned worker to be paused. Bind Docker identity, PID,
   source mount and paused state before capture; verify again afterward.
2. Traverse directories using fd-relative, no-follow operations. Compare opened
   inode/type/mode/size against enumeration. Bound depth, entries, individual
   bytes, aggregate bytes and time while reading, not just from initial `stat`.
   A changing file/directory or process identity invalidates the whole result.
3. Write into a new owner-private staging directory. Copy regular-file bytes
   without following source or destination links. Build the complete graph;
   validate it before creating destination symlinks. Apply allowed modes only
   after content writes. Preserve empty directories.
4. Independently rehash and validate the completed staged tree against its
   manifest. Bind the originating input/recipe/job and record the exact limits.
   Fsync files, manifest and directories. Admit using no-replace atomic rename
   followed by parent-directory fsync. Never merge into or overwrite an existing
   capsule directory. A failed final fsync is commit-unconfirmed, not admitted.
5. Only a confirmed capsule may be mounted read-only for setup/build/runtime.
   Revalidate complete content and provenance before each protected invocation.
   Subsequent mutation, loss, changed mode/link or stale receipt blocks use.
   Abandoned staging data is quarantined, not inferred complete or auto-replayed.

The prototype data-copy probe is not this production protocol: atomic admission,
hostile concurrent-writer resistance and engine-bound pause checks still need
implementation and adversarial verification.

## Finite initial resource profile

Proposed owner-selected Next recipe ceiling:4GiB container memory/swap ceiling,
one CPU,128 PIDs,2GiB aggregate requested tmpfs including the standard128MiB `/tmp`,
100,000 entries,512MiB per file and2GiB per capsule. Capture/read depth is bounded
at128, link expansion at40, installation/build phase at15minutes and capture at
5minutes. These values are finite admission limits, not measured peak usage or
permission to extend a running/frozen phase. Reject unsupported values before
container creation. Legacy worker defaults remain unchanged. Measure the actual
target; a failed capacity qualification requires an evidenced profile revision.

## Acceptance obligations before integration

- Round-trip real pnpm-shaped internal links, empty directories and executable
  files; compare every file byte/hash, mode and link target.
- Reject link escapes, dangling/cyclic/ancestor links, undeclared parents,
  hardlinks, privileged modes, special files and all size/depth/count breaches.
- Deny reads through raced source parents and writes through raced destination
  parents; no host canary changes. A complete source graph does not waive this.
- Interrupt before/during admission, lose final acknowledgement and inject
  fsync/rename failures. No incomplete capsule is executable; confirmed retry is
  idempotent for the same identity and never overwrites a different capsule.
- Detect byte/mode/link mutation and input/recipe/job mismatch before execution.
- Exercise actual confined acquisition and Next build afterward. A copied host
  dependency layout is a representation fixture, not completion of those gates.

Tests belong in a dedicated capsule suite plus actual worker integration, with
the existing ordinary evidence-capture rejection tests retained. New executable
contract rules go in YAML. #171 and #172 retain the real-product outcome gates.

## Scoped simulation and preparation audit

These are follow-up paper routes for the selected capsule design, not independent
review or production readiness:

- Returning operator: intact capsule → digest verification → read-only use;
  same bytes with an altered mode or link → reject before invocation. The format
  binds modes and link strings as well as file hashes.
- Hostile dependency: valid relative package link → graph resolution → import;
  linked parent, escaping target or source-directory race → reject without host
  traversal. The import protocol requires fd-relative reads and graph validation.
- Interrupted operator: completed staging → fsync → no-replace rename → confirmed
  parent sync; failure at any earlier point → quarantine, while uncertain final
  sync → commit-unconfirmed. Never infer readiness from a directory's existence.

Audit phase1: identity, format, bounds, negative routes, provenance and admission
sequence are present. Executable YAML/test mapping and independent preparation
review remain absent. Product UI/SQL changes are N/A for this helper; real product
journeys remain downstream obligations, not waived checks.

Audit phase2: the serialization and integer/Unicode restrictions above resolve
the ambiguity in how two implementations calculate the same manifest digest.
Keep ordinary evidence capture unchanged; the new helper receives a separate
suite for graph validation, race/fault handling and actual round-trip cases.

Audit phase3: format feasibility is supported by the retained representation
probe. Production build readiness remains unestablished: bind the selected
acceptance tests and YAML contract, obtain scoped review, and run the canonical
promotion check before implementing or integrating a shipping helper. The
prototype is private experimental code and is not a runtime dependency.
