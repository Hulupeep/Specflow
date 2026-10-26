# #235 selected slice A: progress-led review recovery

Source: [#235](https://github.com/Hulupeep/Specflow/issues/235), original body and
comments preserved in the live imported record. Select only review continuation
for this build. Controller limits, route price classification and unattended
window/checkpoint changes remain slice B with #183. Keep #235 open after A.

Owner authority: on 26 October the user explicitly requested subscription/cheap
work not stop at a fixed review count, with brakes for costly routes and no
default multi-day run. This authorises revising the one-recovery clause of
I-DUOOPS-003; it does not waive evidence, permissions or explicit ceilings.

## Decisions for slice A

- Keep existing policy fields, declared usage mode and optional explicit
  maxCalls/maxElapsedMs. No default call/dollar ceiling, new paid provider or
  inferred billing classification. No controller deadline/attempt change here.
- Keep protocol/stagnation thresholds as diagnosis boundaries. Recovery history
  is append-only; the first legacy evidenced recovery remains compatible.
  Further recoveries need validated, stable executed diagnosis evidence recorded
  after the previous call, with a previously unused semantic observation key.
- Summarise actual `duo_capture: 1` records only after existing path/SHA checks.
  Validate argv, stdout/stderr, exit/error, matching sourceBefore/sourceAfter,
  stable=true and finishedAt. Hash command/result/source facts, excluding capture
  filenames and timestamps. With captured evidence present, narrative attachments
  cannot change its key. Multiple capture keys are sorted/deduplicated.
- Non-capture legacy evidence uses its sorted content hashes for the first
  recovery only. Later recovery requires execution evidence. Malformed, unstable,
  stale, duplicate, renamed or timestamp-only observations cannot permit a call.
- Preserve pending recovery evidence hashes until consumption; tampering cannot
  consume a call. No native judgment is manufactured: findings/criteria,
  first-time progress, ownership, immutable acceptance and finish gates remain.
- Persist observation key/type and last-call time additively. Old receipts remain
  readable with derived legacy hash keys; new code does not edit archived/pinned
  runtimes. Existing pinned sessions retain their recorded behaviour; migration
  remains explicit, not a journal rewrite or new run to evade a bound.

The novelty check is mechanical, not proof a strategy is useful. The builder
must select a materially different justified action; the independent peer still
judges support. A new diagnostic key never counts as verified product progress.

## Simulation Findings (proposed, bounded paper walkthrough)

- Subscription builder: missing source read → diagnosis A → failed repair →
  new missing-read observation B and changed batch → second recovery. Divergence:
  rephrase A or rename its capture → reject duplicate evidence, preserve calls.
- Cost-sensitive owner: explicit call/time cap → diagnosis remains possible but
  cannot purchase another invocation or erase the cap. Divergence: task text
  says subscription/free → registered policy/authority stay unchanged.
- Returning operator: queued recovery survives host change → validate same bytes
  and consume once. Divergence: evidence changed, old capture timestamp, stale
  source or missing native access → retain exact cause, no acceptance/replay.

All gaps map to J-EFFORT-RETRY/REPLAY/FRESHNESS/CAPS/COMPAT in
tests/contracts/review-effort.test.js and existing root/scoped integration tests.
These are planned implementation checks; only the RETRY regression exists and
is expected red before the fix. No model/worker operation is launched by it.

## Audit phase 1: gap analysis

Present: owner intent, verified pure-policy reproduction, positive/negative ACs
and phased scope. Missing before preparation: semantic evidence novelty,
freshness, legacy/pending receipt handling and root/scoped consistency decisions.
The decisions above resolve these for A; B stays explicitly outside this build.

## Audit phase 2: surgical contract and test mapping

No database/RPC or UI surface; existing local JSON receipt storage is reused.
Reuse I-DUOOPS-001 ownership, I-DUOOPS-002 finish, revise only the authorised
one-recovery clause of I-DUOOPS-003. Receipt fields are additive: observationKey
(SHA-256), executionEvidence (boolean), and lastCallAt (finite epoch milliseconds).
No new invariant identifier or second continuation engine.

1. AC-A1 (REQ-EFFORT-01/02): multiple distinct evidenced subscription recoveries
   proceed in one history, without a fixed lifetime recovery count.
2. AC-A2 (REQ-EFFORT-02): duplicate/stale/unstable/tampered evidence, timestamp-only
   recapture and renamed notes cannot permit another review or credit progress.
3. AC-A3 (REQ-EFFORT-03/05): explicit ceilings, owner fencing, findings and finish
   remain enforced; quota and actual charges are not fabricated.
4. AC-A4 (REQ-EFFORT-05): root and scoped ledgers agree; old receipts remain
   readable, pending recovery consumes once, pinned runtime bytes stay unchanged.
5. AC-A5: failed recovery reports its real diagnosis and available next action,
   never a fake financial exhaustion or a request for routine owner resumption.

DoD: execute these actual contract/helper/ledger cases, full canonical tests and
native independent Duo acceptance on final source; retain the original red
regression. No CI or provider capability inferred from protocol fixtures.

## Audit phase 3: scoped pre-flight

Read-only walkthrough of these decisions and the current APIs: no remaining
CRITICAL/P1 for preparing slice A. A bugfix is not implemented or compliant from
prose: production still requires current native preparation/promotion and the
executed implementation gates. Slice B retains its #183 checkpoint/migration
decisions; this preparation cannot promote it. No web journey applies to A.
