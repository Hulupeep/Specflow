# Advisory review #304

Purpose: advisory; Gate C decision: pending.
Execution: invalid; scope at execution: current; mode: live; invoked: true.
Attempt: a3457917-6544-4086-a0db-1ad4cf61124e
Input snapshot: 92e770a12109e4188b391b8fcf76d8e3c5120bbdf64f20660f11c3661cc5cce7
Diff: a508e2166a5c1313189e71c93dcdc6d2e142ca95cff231ddca49fe1e585f4a8c
Base: 9b6dd41412aa942b0b315e5ad8889aa1d18601cd
Reviewer: codex-sol-reviewer; requested: gpt-5.6-sol; served: unknown

Cause: Missing native content reads: tree/tests/contracts/improve-core.test.js

- **p1 REV-304-005** scripts/improve-review-evidence.cjs:101: Structurally invalid verifier findings can authorize omission of required images
  Disposition: reported fixed. Image omission no longer trusts verifier findings. Practice roots require a valid phase receipt, an exact receipt-bound evidence-item hash, a matching native execution artifact hash, and the expected phase/version/result metadata. Validation fails closed, and roots shared with holdout or gate evidence are preserved. Frozen integration tests exercise malformed receipts, mutated evidence, loose findings, and overlapping roots.
  Evidence: scripts/improve-review-evidence.cjs sha256:cc5c89c4922d5bea80f94417e053033184b2d414d1eebb8f07088c49f466b0f5
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293
- **p1 REV-304-001** scripts/improve-review-evidence.cjs:15: Malformed binding and backend envelopes can be treated as recognized shapes and have fields discarded
  Disposition: reported fixed. Summarization now requires strict JSON plus producer-aligned, exact-key validation of binding and backend envelopes, including nested workspace tokens, service semantics, configuration projection, and stage hashes. Unrecognized or malformed documents remain copied verbatim. The frozen tests include malformed outer and nested structures, duplicate keys, and producer-shaped positive cases.
  Evidence: scripts/improve-review-evidence.cjs sha256:cc5c89c4922d5bea80f94417e053033184b2d414d1eebb8f07088c49f466b0f5
  Evidence: scripts/improve-binding.cjs sha256:1b0b4e9fafdc90786b5249fb3823dab915de1c6a2a2f6296ff13c42b17fc85ca
  Evidence: scripts/improve-backend-runtime.cjs sha256:4971ea0b32137d808b6a8692875ce38b8876ac799c07c837fb784c0ebe7aaae9
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293
- **p1 REV-304-002** scripts/specflow-improve.cjs:1084: Judge retries overwrite prior provenance and can record stale judgments after an adapter failure
  Disposition: reported fixed. Each judge attempt now receives a UUID-qualified input directory, transcript, output, and prompt path. Adapter output is parsed only after a successful zero-exit invocation; failed attempts record zero judgments. The frozen regression verifies that a second failed attempt neither overwrites the first attempt's artifacts nor records its stale output.
  Evidence: scripts/specflow-improve.cjs sha256:bf68094606c5490dfeb1526a18e6e925cbc1769e139597ffe3332a52c84b6c55
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: tests/contracts/improve-core.test.js sha256:02edfc224d62315564b1569a31ec16f87774b3ceaac6d8e13032a52137ddb833
- **p1 REV-304-003** docs/specs/improve-review-evidence/RESULTS.md:7: The required installed native repaired-route qualification is absent
  Disposition: reported fixed. The frozen evidence now identifies an installed-package qualification from runtime commit a139777, records the native subscription-CLI session and exact input hash, and reports successful receipt-bound presentation of both phases. The result explicitly distinguishes this native route from the separate canonical retry and binding regressions. The broader full suite and CI remain pending, but they are not the missing installed-native qualification identified here.
  Evidence: docs/specs/improve-review-evidence/RESULTS.md sha256:8f69328cb9fae424efa8f0a7b273c76168396643f90ea959df176a6f3faa9443
  Evidence: evidence/review-evidence-304/proof.json sha256:2c81090c174bec8eb97e803411a14ca675daa7b521ac7c9c519486be35bf380b
  Evidence: evidence/review-evidence-304/native-output.json sha256:026744e7661bb4b47874f4c89d2815e19ef6240a317adc4db787d18a765a0c03
- **p2 REV-304-004** scripts/specflow-improve.cjs:1523: End-to-end judge results discard the actionable role-limit diagnosis
  Disposition: reported fixed. The worker emits bounded structured role-limit diagnostics with observed measurements and a safe next action; the runner retains stderr in the failed adapter entry; and the judge recognizes the allowlisted role-limit codes and records an actionable failure without replaying holdout evidence. Frozen tests cover the worker message and judge failure projection.
  Evidence: scripts/improve-worker.cjs sha256:af285200913c5fe022be678add30eafa3ecf6fd11e671762eb08bed4cc0a5a9c
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: scripts/specflow-improve.cjs sha256:bf68094606c5490dfeb1526a18e6e925cbc1769e139597ffe3332a52c84b6c55
  Evidence: tests/contracts/improve-core.test.js sha256:02edfc224d62315564b1569a31ec16f87774b3ceaac6d8e13032a52137ddb833
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ac97b699c3f3dd526cbb61b34943dd4ea7619ebd8739cb0edba1c71095b1b293
- **p1 REV-304-006** scripts/specflow-improve.cjs:1503: Judge judgments are not bound to the workspace patch they evaluated
  Disposition: open. The judge computes workspace.patch from the current workspace but validates baseline and after receipts with current:false. A workspace can therefore be changed after verification, judged using the changed patch alongside evidence bound to the earlier tree, and then restored before evaluate. Evaluation revalidates the restored after receipt but accepts any qualifying judgment matching the criterion and contract version; judgment records carry the transcript path but no patch hash or verified Git identity. This permits a mismatched judgment to satisfy or fail a mandatory level-3 criterion.
  Evidence: scripts/specflow-improve.cjs sha256:bf68094606c5490dfeb1526a18e6e925cbc1769e139597ffe3332a52c84b6c55

This report is a projection; canonical attempts and the current handoff retain findings and freshness. It grants no preparation, Duo or merge approval.
