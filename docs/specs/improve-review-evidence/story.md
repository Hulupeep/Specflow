## Bug: UX review rejects valid real-backend evidence before the model runs

Parent #171; observed during real product #180 follow-through, productPR Hulupeep/tabstax-webapps#232.

### Verified reproduction
Installed runtime from30efb4b: after real baseline/build/acceptance, `improve judge` copies verification evidence into its input. The worker `curatedText` caps text at256KiB; `prepareRoleImages` caps byte-distinct images at16. Actual bundle:1,172,559 text bytes and22 distinct PNGs. Two binding receipts alone were403,410 and403,642 bytes. The model never ran: `role_input_limit`; zero judgments. Six images were public development-practice frames,16 belonged to frozen acceptance. Existing review-evidence summarization recognizes only input-capsule receipts, not these backend identities. This is a presentation/capability defect, not exhausted subscription allowance or failed product acceptance.

### Required outcome / scope
Bound review presentation before launching a provider, preserving original evidence and the evaluation contract. No changes to the frozen oracle, candidate, binding authority, original deadline or consumed holdout. No acceptance rerun for transport repair. No raised/unbounded token or image limits as the default fix.

Requirements:
- REQ01: Recognized oversized infrastructure inventories may become explicit hash-referenced presentation summaries; complete originals remain immutable and authoritative. Unknown shapes must not be silently summarized.
- REQ02: All required acceptance result/error/observation evidence remains reviewable. Separate practice evidence is labelled, and image inclusion/omission has a deterministic manifest. No favorable-result selection. If required visual evidence cannot fit, return a precise capability limitation with a safe next action; never a false UX pass.
- REQ03: Preserve failure/retry provenance and distinguish presentation metadata from receipts granting authority. Transport retry must not execute acceptance or reset limits.
- REQ04: Native registered/installed proof must exercise the repaired route, not only a source helper.

Acceptance: a fixture of the observed envelope reproduces the current pre-model failure; after repair the bounded request contains all deciding result/error evidence and required images, references original metadata hashes, and the independent model can return a bound judgment. Mutation, unknown-shape, image-limit and oversized required-report cases must fail closed with actionable reasons. Raw files/hashes and frozen acceptance stay unchanged.

### Retained diagnostic and workaround
Original failure is archived. A private presentation wrapper retained all16 acceptance frames and all native reports, omitted6 practice screenshots, and summarized only infrastructure fields:207,338 text bytes. Original pinned worker/model/authority executed unchanged. Independent Opus5.5 returned UX pass; deterministic evaluation KEEP and finalize retained commit6ebc4e8d8ba3f08b710cd9d4ad92af9c6d99d3e3. The workaround is not a shipped fix or proof that arbitrary bundles are safe.

### Verification / preparation state
Bug with verifier trust-boundary impact. Requires failing regression first, preservation/adversarial contracts, prescribed persona simulation and audit/pre-flight before implementation. No UI journey applies to this CLI transport change. Planning: not yet build-ready. This issue remains required for #171 fresh-install usability and the next release; successful product proof does not waive it.
