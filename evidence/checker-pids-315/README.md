# Checker capacity qualification (#315)

A combined real browser workload exhausted a 128-task checker cgroup. Kernel
`pids.events max 1`, `pids.current=128` and `pids.peak=128` corroborated the failure;
valid process samples showed no zombies. Public login failed and 12 of 16 public
cases were unexecuted. That prebuild run remains incomplete; it is not a product
REVERT or KEEP.

The patch adds an explicitly selected, byte-bound v2 profile (checker 256 tasks,
aggregate 768). Old profiles, ordinary worker defaults and every deadline remain
unchanged. A numeric caller override cannot grant additional capacity.

## Executed evidence

- Initial regression run: three failures, 132 passes. New profile creation and
  inspection were unavailable before the patch; all 135 passed afterward.
- Broader contracts/integration: 500 passed across 19 suites, no failed or skipped
  tests. Additional v1/v2 credential parity run: 82 passed across three suites.
- Independent advisory review found the new profile missing from the core's
  runtime identity list. The new mutation regression failed before repair by
  incorrectly recording a baseline. After repair, the full core/profile run
  passed 193 tests across two suites, no failures/skips.
- One intermediate Jest invocation also discovered copied tests in the private
  review snapshot and failed that extra suite for a missing dependency. The real
  193 tests passed there too. The final invocation used `--runTestsByPath` and
  passed cleanly; the earlier failure is retained in the private log.
- `kernel-capacity.json`: actual finite, static C thread probe executed through
  ordinary and managed Docker workers. Both old-profile runs denied creation at
  120 threads; both v2 runs created all 160. All workers were cleaned up. This
  proves task capacity, not the browser journey or product outcome.
- Fresh v2 backend preflight: passed in 180,631 ms, zero owned resources remaining.
  Previously verified immutable source/dependency capsules were reused explicitly;
  this was not claimed as a new acquisition.
- Dry package inventory: 414 files; the new profile JSON is included. This does
  not claim publication or installed qualification.

## Final native qualification and remaining gates

The committed v2 preparer passed in 180,127 ms with zero owned resources remaining.
The committed combined browser runner then executed all 36 cases in 486,247 ms:
fit 6 pass/10 expected layout failures, preservation 4/4 pass, public 8 pass/8
expected layout failures; no skipped or flaky cases. All failure messages were
inspected: only MOBILE_FIT_VIOLATIONS and DOCUMENT_MUST_FIT. Checker task peaks
were 120, 125 and 143 with zero kernel denials. Continuity, secret scanning and
clean teardown passed. The six check files matched the earlier diagnostic run
byte-for-byte. See `browser-capacity.json` and `source-manifest.json`.

Source CI passed 3,439 tests across 170 suites with zero failures/skips/retried
assertions. Downloaded report and matching source/merge tree are recorded in
`ci-source.json`. Final native Claude advisory review accepted the source and qualification
evidence, with one non-blocking suite-label finding addressed by an explicit
`suiteMapping` in the JSON. This was not formal Duo and the reviewer did not run
tests. See `review.json`. CI on the evidence commit remains required before merge. One attempted browser fixture supplied an
incorrect local oracle directory and failed ENOENT before cases ran; cleanup was
confirmed. The corrected invocation uses the actual oracle directory and checks
input existence before allocating its backend. Neither attempt consumes a
product deciding holdout or changes the original qualification deadline.

All public evidence excludes credentials and private fixture paths. This scoped
capacity fix does not prove two completed Improve cycles, revenue, production
readiness or permission to deploy a product.
