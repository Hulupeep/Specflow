# Progressive specification implementation and replay

This work implements the revised #162–167 acceptance in `task.md`. The coding
agent remains interactive; existing Specflow preparation/build machinery and
Duo's opposite CLI perform the work and review. There is no new orchestration
service. Future work stays thin until a selected slice or material shared decision
justifies deeper evidence. Required permissions, tests and release gates remain.

The shared policy is `scripts/specflow-tier.cjs`. The installed
`SPECIFICATION.md` procedure explains import, frontier, scoped gates/review,
promotion, experiments, discovery collection and publication. Durable issue/tier
journals are under `.specflow/specification/`. Production start, resume, review,
capture and finish check current readiness; manual labels cannot replace it.

The implementation run is `1790170999853-45b7e95c`. It began on the older pinned
runtime and retains that runtime and original acceptance throughout. New behavior
is exercised by fresh installed fixtures and the separate native replay below.
Component acceptances are not whole-epic acceptance; the final full-scope review
and raw captures live in that implementation run's excluded local directory.

## What was actually exercised

- The complete Jest suite covers policy/runner/installer routes in both hosts,
  dependency chains, scoped budgets, skipped/absent gates, source changes,
  experiments, discovery invalidation, privacy and volume. The GitHub and
  provider boundaries in deterministic tests are explicitly simulated.
- Fresh full project setup is also executed for both hosts, including the
  generated contract tests and installed PROCESS/host guides. Only dependency
  download and GitHub access are simulated for these tests; cached packages
  supply real test execution. This found and fixed nested installer lock reuse
  and failure propagation. A recursive instruction scan was captured failing
  across eleven files before aligning all installed process surfaces.
- The native contracted replay `1790178810790-262542ea` invoked `claude -p` twice.
  Native metadata reports `claude-opus-5-5`. The first actual call identified all
  five seeded risks (offline operation, corrections, identity, network and reuse),
  but its response was protocol-invalid because it cited an empty diff without
  a content-read receipt. That is retained as a failed review, not valid findings
  or acceptance. The builder corrected the decisions and reran five checks.
  The second and final allowed attempt accepted all six scoped criteria, with
  zero findings, and the helper finished the run. A real local promotion then
  consumed its live review and exact gate evidence to record contracted depth.
  There was no override, budget reset or claim of working parser implementation.
- The reverse CLI direction is exercised through simulated provider-boundary
  tests. It was not another live Codex session. Scoped Codex review binds an
  explicitly approved model to the invocation when its event stream supplies
  no served-model identity; the distinction is recorded, not guessed.
- Real approved representative Pastor input was inspected locally through the
  existing sandbox, without sending source content to a model. Sandbox readiness
  probes passed. The first bounded structure attempt failed; instrumentation
  localized a later attempt to an OSError during structure traversal after archive
  opening/root access. A separate narrow question then observed archive opening
  and root access successfully. The cause of traversal failure remains unknown.
  No content extraction, complete format support or production acceptance follows.
- The first two experiments used actual Pastor #59's contracted planning source.
  The narrow successful question used an explicitly seeded local thin starting
  tier, with real input and unchanged GitHub labels. This separates real input
  execution from the controlled starting state. All three results and collected
  observations remain durable. Changed availability can now justify retry of a
  blocked plan; an unchanged completed experiment cannot be repeated by renaming it.
- Those real observations stale a supplied-state ready consumer and the selected
  planning record through their shared parser assumption. Unrelated thin records
  remain unaffected. The consumer's prior readiness is a fixture, not a fabricated
  live promotion. Tests separately exercise real promotion mechanics and current
  source/dependency validation.
- Before exporting the sanitized results, Pastor's actual mechanical scanner
  checked derived forms from the real representative input baseline and detected
  a planted real canary. The baseline is for that representative input, not a
  claim to scan every private corpus value. Private paths, values, input hashes,
  raw native parser stderr and configuration remain outside the exported files.

The native replay pins the intermediate runtime recorded in its evidence. Later
availability retry, assumption binding and mandatory artifact-read fixes are
covered by the final workflow tests; its historical runtime was not overwritten.

## Specification volume, without claiming artificial savings

All six current Specflow issue bodies are under 20,000 characters (3,626–6,394).
The controlled replay's five planning bodies total 1,668 characters; each is
under 30,000. Linked maintained supporting material totals 111,969 characters,
including reused sandbox/runtime code and their existing canonical references.
Historical execution evidence adds 1,393 characters separately. New instrumentation
and decision material, reused references, deferred output schema and N/A browser
work are identified in `replay/pastor/replay-volume.json`. The frontier has no
unresolved linked-reference count. Moving text into these files is not counted
as eliminating specification.

The historical #162 brief reports roughly 320 requirements, 360 acceptance
criteria, 13 contract packages and four adversary cycles. Those are the author's
reported observations. A current E09 GitHub search returned 29 Pastor issues with
502,517 body characters; nine exceed the new body maximum and some linked
references are unresolved in the current checkout. Search membership and missing
links prevent claiming that this is a complete historical epic inventory. It is
also a different scope from the bounded replay: no percentage reduction is claimed.
Existing Pastor tickets and documents were not rewritten or relabelled.

## Evidence and limits

`replay/native/` retains observed native identities, actual invocation arguments,
structured peer results, read receipts, source manifests, before/after decisions,
raw gate executions and captures wrapped as evidence from their separate repository.
`replay/pastor/` contains scanner-approved raw experiment envelopes, collected
observations, discovery/frontier results, volume and privacy proofs.

Run `node evidence/spec-density-build/verify-replay.cjs` to recheck the retained
results and re-execute the seeded decision checks. It explicitly does not call a
provider or rerun private input. The final implementation review receives both
that raw command result and the full test-suite capture, and independently reads
relevant source and evidence. Local implementation and verification do not mean
merged, published to npm, deployed or customer-validated.

TypeSafe advice was not evaluated: the implementation run has TypeSafe off and
the native replay selected no advisory inputs. Peer review and raw execution,
not TypeSafe output, provide the acceptance evidence here.
