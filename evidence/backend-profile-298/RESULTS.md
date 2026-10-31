# Backend journey profile qualification (#298)

Implementation: PR #302. The separately named `heystax-backend-journeys-v1`
profile admits the complete native inventory before creating resources. The
original `heystax-backend-v1` profile bytes remain unchanged. Running jobs,
consumed evidence and original deadlines are not extended or rewritten.

This is infrastructure capacity and cleanup evidence for the pinned real
HeyStax source `428f73b7d0021c74cb03c149497f1e9da0b3f30b`. It repeats the
mapped real login/save/reload/wrong-user-RLS journey at 1280px and 360px through
four baseline invocations and three candidate invocations. It does not establish
four distinct features, an actual product improvement, revenue impact or KEEP.

## Admission and identity

The closed profile permits 600,000ms execution and 780,000ms backend lifetime.
The app and checker have separately bounded lifetimes, with the original task
cutoff still authoritative. The selected profile bytes and ordered inventory are
bound in the phase plan and verifier identity. Unknown/mutated profiles and
inventories or remaining horizons that do not fit reject before resource creation.

Four 100-second invocations require 580,000ms including declared dispatch,
setup and continuity allowances. Four default 120-second invocations require
660,000ms and are rejected. There is no automatic profile growth or lease refresh.

## Successful execution

Backend workload source: `2f8fb8a1c435bfb7b90e444b03f6c6c2e2e674d1`.

| Measurement | Baseline | Candidate |
|---|---:|---:|
| Native invocations | 4 | 3 |
| Browser case executions | 8 | 6 |
| Failed / skipped / flaky | 0 / 0 / 0 | 0 / 0 / 0 |
| Generation open | 181,969ms | 190,092ms |
| Setup, including admission | 59,917ms | 59,414ms |
| Native invocation elapsed times | 28,966 / 28,753 / 28,589 / 28,610ms | 28,864 / 28,808 / 28,647ms |
| Continuity | 7,445ms | 7,585ms |
| Directly measured shutdown | 11,758ms | 12,184ms |
| Complete attempt | 386,670ms | 363,469ms |
| Owned resources removed | 9 | 9 |
| Credential envelope removed | yes | yes |

Complete-attempt duration also includes integrity checks, artifact scans and
report writes outside the named timing intervals. Both terminal causes are null.
The native artifacts and built static output had zero server-secret canary hits.
The same original 10:18:03.937 UTC qualification cutoff was retained.

## Controller loss

The controller process group was actually terminated after server readiness.
Independent watchdogs removed all nine owned resources. A separately created
foreign control survived that cleanup and was then removed by its own explicit
cleanup handler. The backend cause is `backend_controller_died`.

The interrupted attempt remains `operator_required`, with no success receipt and
its private credential envelope retained in quarantine. This proves owned
container cleanup and conservative fencing; it does **not** prove automatic
whole-attempt release or resume. Its fence and original deadline remain intact.

## Retained failures and review

The initial baseline stopped before any browser cases because the private
credential reader still enforced the old 600-second envelope limit. Its failed
attempt and cleanup evidence remain retained. The reader now recognises only
the explicitly admitted closed profile; legacy and excessive-lifetime rejection
remain tested.

The first advisory review identified missing profile files in verifier identity,
qualification success written before cleanup validation, lost original/open
failure evidence, absent direct shutdown timing, and missing frozen execution
proof. Current regression coverage and evidence address these concerns; their
final independent dispositions belong in the retained advisory report.

A broad local run exposed a separate test assertion requiring all Specflow
containers on the host to be absent. The reported container belonged to the
concurrent qualification acquisition, as its retained source receipt proves.
The test now inspects every container ID actually created by its own worker.
Its nine integration tests passed concurrently with other work. Exact-head CI
on implementation commit b17d012 passed all 3,327 tests in 167 suites.

## Evidence

`proof.json` binds the tested commit, runtime source manifest, original private
receipt hashes, native case summaries, timing and cleanup results. Seven native
Playwright JSON reports are copied byte-for-byte under `baseline/` and `after/`.
The runtime manifest lists all 138 recorded files as path/digest records. All
public files passed the configured mechanical privacy scanner before export.

The first export was blocked because four filename-keyed SHA-256 digests matched
the generic API-key rule. Separating paths and digests preserved every value and
passed the unchanged scanner. No credential was published and no detector was
disabled. Original private journals, raw evidence and failed/interrupted attempts
remain retained; the public projection does not replace them.


## Core identity addition and evidence composition

The third advisory review confirmed all-profile admission but found that core
`inputIdentity` omitted `improve-worker.cjs`. The mutation regression reproduced
this: a changed worker was accepted as `baseline_recorded`. Adding the worker to
the explicit verifier list makes it return `blocked` with no verification receipt.
All 158 core tests pass, with no failures or skips.

`identity-delta.json` records the exact one-file, one-list-entry source addition.
The other 137 recorded runtime files remain byte-for-byte identical to the native
workload manifest. The capacity driver calls worker/generation/backend/native
execution directly and does not execute core `inputIdentity`; the new core
behavior is therefore evidenced separately by its regression and core suite.
The native proof stays pinned to `2f8fb8a`; it is not relabelled as a later run.

CI on `2f8fb8a` passed 3,328 tests in 167 suites, with no failures or skips.
The same local suite also passed. Final merge requires current-head CI and the
independent advisory result; see PR #302 and `evidence/review-298.md`.
