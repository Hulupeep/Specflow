# Advisory review #304

Purpose: advisory; Gate C decision: pending.
Execution: completed; scope at execution: current; mode: live; invoked: true.
Attempt: e5b109d6-17bd-4e76-b2a8-088c3b2f7390
Input snapshot: a964528faa7c2a32b9cca67823f223c271c09df1036e891bb183e67d08494261
Diff: b827287dc5e1180261436aba5200f179ba844ebd34e4b94b7345fcc12ff4f735
Base: 9b6dd41412aa942b0b315e5ad8889aa1d18601cd
Reviewer: codex-sol-reviewer; requested: gpt-5.6-sol; served: unknown

- **p1 REV-304-005** scripts/improve-review-evidence.cjs:101: Structurally invalid verifier findings can authorize omission of required images
  Disposition: reported fixed. Image omission now requires a strictly validated phase receipt, exact receipt and evidence-record hashes, matching phase/version metadata, and intact native execution receipts. Any inconsistency retains every image, while roots referenced by holdout or gate evidence override development classification. Frozen regressions cover overlapping roots and mutated receipts, items, and native evidence.
  Evidence: scripts/improve-review-evidence.cjs sha256:cc5c89c4922d5bea80f94417e053033184b2d414d1eebb8f07088c49f466b0f5
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293
- **p1 REV-304-007** scripts/specflow-improve.cjs:1680: Manual judgments can impersonate a successful native judge attempt
  Disposition: reported fixed; tracking issue #304. Native origin is now assigned only through a module-private Symbol passed by judge; submitJudgment overwrites caller-provided native flags. Judge hashes the same captured output bytes it parses, and evaluation requires the private-origin marker, intact output hash, matching attempt event, executor, transcript, and judgment binding. The regression copies an exact successful binding and forges native_judgment, but the manual failure remains non-deciding; altered native output also invalidates the genuine judgment.
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p1 REV-304-001** scripts/improve-review-evidence.cjs:15: Malformed binding and backend envelopes can be treated as recognized shapes and have fields discarded
  Disposition: reported fixed. Summarization uses duplicate-key-rejecting strict JSON and exact outer and nested shape checks. Workspace inventories, backend service projections, counts, hashes, and producer relationships are validated before any fields are summarized; malformed or unknown documents remain byte-complete. Frozen regressions exercise duplicate keys, unknown fields, inconsistent projections, and malformed outer envelopes.
  Evidence: scripts/improve-review-evidence.cjs sha256:cc5c89c4922d5bea80f94417e053033184b2d414d1eebb8f07088c49f466b0f5
  Evidence: scripts/improve-binding.cjs sha256:1b0b4e9fafdc90786b5249fb3823dab915de1c6a2a2f6296ff13c42b17fc85ca
  Evidence: scripts/improve-backend-runtime.cjs sha256:4971ea0b32137d808b6a8692875ce38b8876ac799c07c837fb784c0ebe7aaae9
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293
- **p1 REV-304-002** scripts/specflow-improve.cjs:1084: Judge retries overwrite prior provenance and can record stale judgments after an adapter failure
  Disposition: reported fixed. Every judge invocation uses a UUID-qualified input directory, prompt, transcript, and output path. Output is captured and parsed only after gate_rerun_required with a zero exit code; failed attempts record no judgments and retain earlier attempt artifacts. The frozen retry regression verifies distinct paths, unchanged first-attempt bytes, and zero records from the failed retry.
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p1 REV-304-003** docs/specs/improve-review-evidence/RESULTS.md:7: The required installed native repaired-route qualification is absent
  Disposition: reported fixed. Frozen evidence records an installed-package qualification at runtime commit a139777, including the installed presentation route, bounded real envelope, receipt-bound image selection, native subscription-CLI session, exact input hash, and structured judgment. The documents explicitly limit this qualification to presentation and transport and do not misattribute the later judgment-binding changes to that native run.
  Evidence: docs/specs/improve-review-evidence/RESULTS.md sha256:2b76bcaab97f479da119e43961c7d5e3a1b5a0eed6f38de5982aaab3bb8e4326
  Evidence: evidence/review-evidence-304/proof.json sha256:2c81090c174bec8eb97e803411a14ca675daa7b521ac7c9c519486be35bf380b
  Evidence: evidence/review-evidence-304/native-output.json sha256:026744e7661bb4b47874f4c89d2815e19ef6240a317adc4db787d18a765a0c03
- **p2 REV-304-004** scripts/specflow-improve.cjs:1523: End-to-end judge results discard the actionable role-limit diagnosis
  Disposition: reported fixed. The worker emits bounded structured code, observed evidence, and recovery guidance. The runner retains adapter stderr in the failed entry, and judge projects allowlisted role input/image failures into a precise failure while replacing arbitrary recovery text with a safe no-replay action. Frozen regressions cover oversized required text and propagation of role_input_limit through a failed judge retry.
  Evidence: scripts/improve-worker.cjs sha256:af285200913c5fe022be678add30eafa3ecf6fd11e671762eb08bed4cc0a5a9c
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293
- **p1 REV-304-006** scripts/specflow-improve.cjs:1503: Judge judgments are not bound to the workspace patch they evaluated
  Disposition: reported fixed. Judge validates the current after receipt before invocation, renders workspace.patch from the receipt's immutable Git tree, records patch and baseline/after receipt hashes plus after-identity digest, and repeats current-identity and patch checks after invocation. Evaluation accepts a judgment only when those references match the selected current receipts and workspace patch. Frozen tests cover drift before and during review, mismatched bindings, and unbound manual pass/fail observations.
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p2 REV-304-008** scripts/improve-review-evidence.cjs:78: Valid SHA-256 Git binding receipts cannot be summarized
  Disposition: open. The binding producer explicitly supports both SHA-1 and SHA-256 Git object formats, so base_commit and identity.git tree/parent can legitimately be 64 hexadecimal characters. The presentation validator accepts only 40-character commits. A valid oversized binding from a SHA-256 repository therefore remains raw and can recreate the 256 KiB pre-model role_input_limit failure. This fails closed and does not grant false authority, but the repaired transport is unavailable for a producer-supported repository format; current presentation fixtures cover only 40-character Git identities.
  Evidence: scripts/improve-review-evidence.cjs sha256:cc5c89c4922d5bea80f94417e053033184b2d414d1eebb8f07088c49f466b0f5
  Evidence: scripts/improve-binding.cjs sha256:1b0b4e9fafdc90786b5249fb3823dab915de1c6a2a2f6296ff13c42b17fc85ca
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293

This report is a projection; canonical attempts and the current handoff retain findings and freshness. It grants no preparation, Duo or merge approval.
