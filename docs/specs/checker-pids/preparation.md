# Checker task capacity (#315)

The real combined 16 fit + 4 preservation + 16 public browser workload exhausted
its checker cgroup at 128 tasks (`pids.events max 1`). The public login failed and
12 cases were skipped. This is infrastructure failure, not a product verdict.
No zombies were observed in valid samples; a browser hydration explanation was
only a hypothesis. The original run remains incomplete and unmodified.

## Fixed scope

Explicitly select `heystax-backend-journeys-v2`: checker 256 tasks, aggregate 768.
All other limits match v1. Preserve both old profile files byte for byte; generic,
source, build and app workers remain at 128 tasks. The closed profile binding,
including its hash and slot, determines the limit. Arbitrary PID overrides are
not accepted. Live inspection and managed lifecycle fingerprints must agree.
No running job is upgraded; no deadline is extended. No database, product UI,
production deployment or authorization change.

## Acceptance and evidence mapping

- REQ-1/AC-3: immutable old profile hashes, exact v2 resource delta and unchanged
  phase/deadline tests: `tests/contracts/improve-backend-profile.test.js`.
- REQ-2/AC-2: exact managed argv, no numeric override, tampered binding rejection:
  `tests/contracts/improve-managed-worker.test.js`.
- REQ-2/AC-2: live inspect rejects mismatched limits and binding hashes:
  `tests/contracts/improve-worker.test.js`.
- REQ-3: v1/v2 signed service-token expiry and serialized reader parity:
  `tests/contracts/improve-backend-{server,semantics}.test.js`.
- REQ-4/5, AC-1/4: actual confined ordinary and managed kernel task pressure:
  `tests/qualification/improve-checker-pids.test.cjs`. This requires a hash-bound
  worker input capsule and a static C compiler. It requests only 160 threads,
  joins them and tears down the workers; it is not a browser acceptance claim.
- REQ-4/5, AC-1/4: `tests/qualification/improve-checker-journeys.test.cjs` takes
  a separately admitted v2 backend state, unfrozen draft check inventory and
  independently authored oracle directory. It runs every declared native case,
  rejects skips/flaky cases and kernel task denials, scans artifacts for the
  server credential and requires continuity and clean teardown. Actual native
  failures must still be inspected for intended product assertions. No product
  KEEP, frozen baseline or permission to implement follows from this fixture.

## Simulation and gate

Issue #315's simulation/audit comment records repeat-operator, adversarial-caller
and interrupted-operator routes. It added exact selected limits across lifecycle
paths, immutable historical bindings and real combined kernel/browser evidence.
Ticket preflight passed with the warning that proposed capacity requires actual
qualification. This document mirrors that scoped contract; implementation is not
accepted until the real browser workload, independent review and exact-source CI
are evidenced. Existing I-IMPROVE-001/002/004/005 apply; no new invariant ID.

## Test commands

```sh
node tests/qualification/improve-checker-pids.test.cjs <inputs.private.json>
node tests/qualification/improve-backend-journeys-prepare.cjs <inputs.private.json> <descriptor.json> <original-deadline-ms> heystax-backend-journeys-v2
node tests/qualification/improve-checker-journeys.test.cjs <v2-state.json> <draft-contract.json> <oracle-directory>
```

Use the returned root/qualification-state.json as <v2-state.json>. The preparer
defaults to v1 and accepts only the two closed journey profiles. It records the
selected profile in admission and state and checks the actual terminal profile.
All paths are private local artifacts. Neither credentials nor their
contents belong in issue comments, PRs or committed evidence. Finite task-capacity
success and product success remain separate claims.
