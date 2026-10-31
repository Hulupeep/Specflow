# Advisory review #304

Purpose: advisory; Gate C decision: pending.
Execution: invalid; scope at execution: current; mode: live; invoked: true.
Attempt: aa283ea1-1c34-453f-b3b9-bbb0fba9a91b
Input snapshot: a072c75a8a3e22c267f041b3f34c1988f2ca9a944410924afeec07d82926dd34
Diff: 70ebdde89f0df84ea1de3d8c38412a690f84335cb7ffe04608e3ea77ea9ca0bd
Base: 9b6dd41412aa942b0b315e5ad8889aa1d18601cd
Reviewer: codex-sol-reviewer; requested: gpt-5.6-sol; served: unknown

Cause: Finding cites content without a successful native read

- **p1 REV-304-001** scripts/improve-review-evidence.cjs:15: Malformed binding and backend envelopes can be treated as recognized shapes and have fields discarded
  Disposition: open; tracking issue #304. The recognition predicates validate key presence but not the complete producer invariants. Binding tokens accept arbitrary strings and lengths; backend optional managed fields may appear independently, while nested configuration, services, and stageHashes accept nearly arbitrary objects. Such mutated or inconsistent envelopes are summarized and those fields removed, contrary to the requirement that unknown or mutated shapes remain complete and fail closed. Existing tests cover duplicate keys and input-capsule inconsistencies, but not these binding/backend mutations.
  Evidence: scripts/improve-review-evidence.cjs sha256:fb2e286dbe1f51d8bcdc97a83af918e32b1dcc5c228b16d17d15c59ae786cc55
  Evidence: scripts/improve-binding.cjs sha256:1b0b4e9fafdc90786b5249fb3823dab915de1c6a2a2f6296ff13c42b17fc85ca
  Evidence: scripts/improve-backend-runtime.cjs sha256:4971ea0b32137d808b6a8692875ce38b8876ac799c07c837fb784c0ebe7aaae9
  Evidence: tests/integration/improve-review-evidence.test.js sha256:5d4cf0faf5c715fba10ad8f3eb7a038de43319f7423bf7ad8c09ef2296426813
- **p1 REV-304-002** scripts/specflow-improve.cjs:1084: Judge retries overwrite prior provenance and can record stale judgments after an adapter failure
  Disposition: open; tracking issue #304. Each retry reuses the same input directory, transcript, prompt, and final-output paths; judge deletes the prior input directory, while runAdapter leaves an existing output file untouched on failure. Judge then parses policy.output_path regardless of result.status. A text/image-limit failure can therefore destroy the prior input, overwrite its transcript, and consume a stale successful final file as a new judgment despite no provider completing this attempt. No end-to-end failed-retry test covers this path.
  Evidence: scripts/specflow-improve.cjs sha256:1d9eb3a279a4b36ce8487af327c57d307ff550f639a3eff9f63dbd5d8fb6fa5a
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: tests/contracts/improve-core.test.js sha256:0b9b42f218ebad248b51f840d70b56ea71c94d7097c76f92e53bbcfe9bbc9087
- **p1 REV-304-003** docs/specs/improve-review-evidence/RESULTS.md:7: The required installed native repaired-route qualification is absent
  Disposition: open; tracking issue #304. REQ04 requires registered/installed proof that exercises the repaired route and returns a bound independent judgment. The frozen results explicitly state that installed/native provider qualification and CI remain pending. The included regression exercises helpers and limits but is not evidence of the required installed route.
  Evidence: docs/specs/improve-review-evidence/story.md sha256:05f34292be0aec00b698617414aa5bc0bf258a7bc9647f51e2c437da3948bdbb
  Evidence: docs/specs/improve-review-evidence/RESULTS.md sha256:15da4d7f8817454eae97670adc2873a10966f0222d557b89a91d43f405244ad1
  Evidence: tests/integration/improve-review-evidence.test.js sha256:5d4cf0faf5c715fba10ad8f3eb7a038de43319f7423bf7ad8c09ef2296426813
- **p2 REV-304-004** scripts/specflow-improve.cjs:1523: End-to-end judge results discard the actionable role-limit diagnosis
  Disposition: open; tracking issue #304. The worker emits structured role_input_limit or role_image_limit details and a safe next action on stderr. runAdapter classifies the nonzero process only as adapter_failed, and judge returns status plus reduced provenance without the failure payload, code, offending artifact, or next action. Thus the shipped command does not return the precise capability limitation required by REQ02/REQ06 even though direct helper tests see the underlying WorkerError.
  Evidence: scripts/improve-worker.cjs sha256:43be747c9ce52662f6010a7a50c36f237c744416db327ac5063ce5eccf81e248
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: scripts/specflow-improve.cjs sha256:1d9eb3a279a4b36ce8487af327c57d307ff550f639a3eff9f63dbd5d8fb6fa5a
  Evidence: tests/contracts/improve-worker.test.js sha256:a63085e00d15f1b52992bdbdcba5e841915e26a34fd9a5e362d28399ce397e0f

This report is a projection; canonical attempts and the current handoff retain findings and freshness. It grants no preparation, Duo or merge approval.
