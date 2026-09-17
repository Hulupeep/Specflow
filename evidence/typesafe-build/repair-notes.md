# Implementation correction evidence

Claude source review round 1 requested four corrections before any held-out API evaluation:
- F-EVAL-COVERAGE-NONE: presence-only assertions now have `none` where they assert no scoped outcome; full/partial/none/insufficient all have corpus examples and an executable class-coverage test.
- F-EVAL-CONTROL-DENOM: every case explicitly marks control/edge; reports split both overall and held-out denominators. `simulated-replay-denominators.json` was generated from actual harness replay with simulated HTTP503, not a provider performance measurement.
- F-DOCS-STATUS: PRD now distinguishes local implemented/tested tooling from outstanding live proof and release.
- F-SNAPSHOT-OMISSION: the actual generated `omission-request.json` lists withheld credential paths without their content. The fixture uses real git/snapshot/helper logic and a simulated peer.

Live installed-CLI exploration independently found response-shape issues: peer dispositions included both source citations and raw evidence, while the helper expected only raw paths; later finding closure and diagnostics included source-line suffixes incompatible with the ledger. The fix preserves strict ledger validation and constrains native JSON-schema evidence arrays to their allowed paths. Additional citations belong in reason/observation text. A focused regression verifies the schema actually sent to native peers.

The first live fixture retains all its blocked rounds and original repair counters. Its raw peers correctly detected the wrong value and accepted the corrected exact-value test, but helper acceptance was blocked by the protocol defects. It is not claimed complete. A fresh regression validation of the revised installed protocol is a separate engineering test, not a reset of that run's budget or findings.

No live held-out predictions were used to tune corpus labels. Independent source review adjudicated labels before inference. No provider benchmark results are included in this repository evidence.

Final input-validation follow-up: successful records now require canonical,
bounded snapshot/question identifiers rather than silently omitting malformed
metadata. A focused negative test also exercises an actual thrown transport
error and confirms its private message is not persisted. This addresses the
source review's non-blocking metadata observation without changing question
semantics, corpus labels or model identity.
