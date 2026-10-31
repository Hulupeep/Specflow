# Advisory review #304

Purpose: advisory; Gate C decision: pending.
Execution: completed; scope at execution: current; mode: live; invoked: true.
Attempt: 856253ec-12c6-4416-9fb9-3423274738e7
Input snapshot: ca2b3a8c05db213afe4dab347f672bc89c4e938aac79535c8314075b14d65aee
Diff: 40b1e4ff88eb926e72a17fcfa2c11454d47fbc099fa2c702397ba010ccef204e
Base: 9b6dd41412aa942b0b315e5ad8889aa1d18601cd
Reviewer: codex-sol-reviewer; requested: gpt-5.6-sol; served: unknown

- **p1 REV-304-005** scripts/improve-review-evidence.cjs:101: Structurally invalid verifier findings can authorize omission of required images
  Disposition: reported fixed. Evidence validation now binds referenced image artifacts through practiceRoots and rejects missing, mismatched, or unbound evidence instead of silently omitting it. Integration coverage exercises evidence mutations.
  Evidence: scripts/improve-review-evidence.cjs sha256:ec57eea1f1974ca48a01169ea9b0167fab4b9bb0465d03a56a157cbed46bbb32
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ab70f9f9477d1dffe383fff1a60906f2d56b2e7088d9a75adab5cf451ab0bb45
- **p1 REV-304-007** scripts/specflow-improve.cjs:1680: Manual judgments can impersonate a successful native judge attempt
  Disposition: reported fixed; tracking issue #304. Native judgment submission is protected by a module-private capability and requires a successful adapter call, exact native-output byte hash, executor and transcript provenance, and matching judgment bindings. The evaluator independently verifies those properties.
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p1 REV-304-001** scripts/improve-review-evidence.cjs:15: Malformed binding and backend envelopes can be treated as recognized shapes and have fields discarded
  Disposition: reported fixed. The review-evidence path now uses duplicate-key-rejecting strict JSON parsing and exact envelope validation. Malformed input is rejected and preserved as invalid raw evidence rather than reduced to a misleading valid-looking summary.
  Evidence: scripts/improve-review-evidence.cjs sha256:ec57eea1f1974ca48a01169ea9b0167fab4b9bb0465d03a56a157cbed46bbb32
  Evidence: scripts/improve-worker.cjs sha256:af285200913c5fe022be678add30eafa3ecf6fd11e671762eb08bed4cc0a5a9c
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ab70f9f9477d1dffe383fff1a60906f2d56b2e7088d9a75adab5cf451ab0bb45
- **p1 REV-304-002** scripts/specflow-improve.cjs:1084: Judge retries overwrite prior provenance and can record stale judgments after an adapter failure
  Disposition: reported fixed. Each judgment attempt now receives a unique UUID-scoped directory and output path. Output is consumed only after a successful adapter execution, while the evaluator binds the selected judgment to its exact attempt and receipt provenance.
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: scripts/specflow-runner.cjs sha256:2c7abeba2f95c4bb5595ef99560a6f8d94611d31092890d9307f0ba345d3bb04
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p1 REV-304-003** docs/specs/improve-review-evidence/RESULTS.md:7: The required installed native repaired-route qualification is absent
  Disposition: reported fixed. The frozen results and proof now identify the installed-runtime native execution, its exact output receipt, and its historical commit scope. They also explicitly distinguish that native run from the later presentation/transport and SHA-width changes instead of presenting those changes as newly executed native proof.
  Evidence: docs/specs/improve-review-evidence/RESULTS.md sha256:c9b190fa86005000199504d79fa75df670ca21d3edd83795247f484171edb5de
  Evidence: evidence/review-evidence-304/proof.json sha256:2c81090c174bec8eb97e803411a14ca675daa7b521ac7c9c519486be35bf380b
  Evidence: evidence/review-evidence-304/native-output.json sha256:026744e7661bb4b47874f4c89d2815e19ef6240a317adc4db787d18a765a0c03
- **p2 REV-304-004** scripts/specflow-improve.cjs:1523: End-to-end judge results discard the actionable role-limit diagnosis
  Disposition: reported fixed. Worker failures now preserve structured role-limit diagnostics, and the judgment path projects the permitted actionable failure fields without discarding the limiting role information.
  Evidence: scripts/improve-worker.cjs sha256:af285200913c5fe022be678add30eafa3ecf6fd11e671762eb08bed4cc0a5a9c
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p1 REV-304-006** scripts/specflow-improve.cjs:1503: Judge judgments are not bound to the workspace patch they evaluated
  Disposition: reported fixed. Judgment input is rendered from the verified Git tree and records baseline, post-change, patch, and evidence bindings. The implementation revalidates receipts and the current workspace diff after execution, and evaluation requires the judgment bindings to match those exact artifacts.
  Evidence: scripts/specflow-improve.cjs sha256:9264e1b20a6b8b9e8f864925408842e01923b5358681dd03a51e394c4e1d35c1
  Evidence: scripts/improve-binding.cjs sha256:1b0b4e9fafdc90786b5249fb3823dab915de1c6a2a2f6296ff13c42b17fc85ca
  Evidence: tests/contracts/improve-core.test.js sha256:570878ad1715e96d572943d1fda4e167519205d1e96e82885f253d40d7b60ed6
- **p2 REV-304-008** scripts/improve-review-evidence.cjs:78: Valid SHA-256 Git binding receipts cannot be summarized
  Disposition: reported fixed. bindingEnvelope now accepts Git object IDs of either 40 or 64 lowercase hexadecimal characters and requires base_commit, tree, and parent to use the same width. Regression tests cover valid SHA-1 and SHA-256 receipts and reject short, non-hexadecimal, and mixed-width values.
  Evidence: scripts/improve-review-evidence.cjs sha256:ec57eea1f1974ca48a01169ea9b0167fab4b9bb0465d03a56a157cbed46bbb32
  Evidence: tests/integration/improve-review-evidence.test.js sha256:ab70f9f9477d1dffe383fff1a60906f2d56b2e7088d9a75adab5cf451ab0bb45
  Evidence: scripts/improve-binding.cjs sha256:1b0b4e9fafdc90786b5249fb3823dab915de1c6a2a2f6296ff13c42b17fc85ca

This report is a projection; canonical attempts and the current handoff retain findings and freshness. It grants no preparation, Duo or merge approval.
