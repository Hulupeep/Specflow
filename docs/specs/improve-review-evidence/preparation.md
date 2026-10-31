# #304 preparation

Weight: Bug affecting verifier evidence. Bounded parts, no full discovery loop. Required regression, preservation/adversarial contracts, installed native model qualification; no browser UI or schema change. Original mission and acceptance remain unchanged.

## Simulation Findings (proposed)

Time: 2026-10-31T11:56:52.499061+00:00

- Repeat operator: normal backend run reaches UX judgment; larger inventory exceeds transport before model. Add explicit metadata summaries with original hashes, stable source paths and no receipt authority.
- Adversarial producer: normal recognized inventory summarizes; unknown fields or malformed shapes may contain failures. Add fail-closed preservation of unknown shapes; never truncate native reports/errors.
- Interrupted operator: retry a completed acceptance review; divergence repeats consumed holdout or resets deadline. Require presentation-only retry with original contract/receipts/failed attempt retained, no execution/authority edits.
- Evidence reviewer: normal acceptance frames fit; dev frames exhaust image allowance or a required frame is also labelled practice. Omit only proven practice-only image roots, retain their textual reports and a hash manifest, protect every root referenced by acceptance. If remaining required frames exceed limit, explicit actionable blocker with no judgment.

Proposed additions accepted under standing implementation authority: REQ05 practice provenance and acceptance-overlap protection; REQ06 image/text limit errors name offending evidence and recovery; REQ07 generated summary cannot impersonate original receipt schema. No owner product question.

## Audit phase1: gap analysis

Parent/story, observed reproduction, scope, requirements, acceptance and negative cases present. Missing typed interface/invariants, explicit Gherkin/mapping/DoD. Persona routes now present. Data contract/frontend selectors/Playwright UI journey N/A: CLI presentation only, no data/API/UI change. Existing local evidence schema must remain intact.

## Audit phase2: surgical additions

Interface: `copyVerificationEvidence(source, destination, {omitPracticeImages?: boolean} = {}): void`; default preserves existing caller behavior. Only judge opts into practice image exclusion. Receipt summaries use distinct `specflow.review-*-summary/v1` types with SHA256 references, never verification authority.

I-REVIEW-EVIDENCE-001: original evidence bytes and governing acceptance are immutable.
I-REVIEW-EVIDENCE-002: no mandatory native result/error or acceptance image is removed to fit limits.
No existing IDs in this domain found. Existing binding/worker contracts remain applicable.

Gherkin: Given a real-backend receipt envelope exceeds256KiB, when recognized inventories are summarized for review, then all result/error text and original hashes remain and source bytes do not change. Given a practice image root is also referenced by holdout findings, when the judge selects images, then that image is retained. Given17 required distinct frames or oversized required report, when invoking review, then a precise pre-model capability error is returned and no judgment is recorded.

Mapping: tests/integration/improve-review-evidence.test.js for receipt/shape/source/report/image preservation; tests/contracts/improve-worker.test.js for unchanged provider limits and actionable errors; tests/contracts/improve-core.test.js for decision binding. Native installed qualification records provider/model, input manifest, original hashes, structured judgment, and unchanged acceptance; no new gain or rerun of previous holdout is claimed.

DoD: regression fails before fix; relevant tests pass; original real bundle fits via installed shipped code and native reviewer returns bound judgment; privacy-scanned evidence and CI green. Old successful product cycle remains terminal. New review qualification has its own bounded authority and cannot mutate old ledger.

## Audit phase3: Pre-flight Findings

simulation_status: passed_with_warnings
scope: bounded CLI bug preparation (not runtime acceptance)
CRITICAL: none. P1: none. P2: unknown/required oversized evidence deliberately remains blocked rather than truncated. No UI journey obligation applies. Execution evidence remains required before completion.

## Review-driven simulation and audit refresh

Time: 2026-10-31T12:20:55.692378+00:00

Returning operator: first judge succeeds, retry transport fails -> preserve first attempt and reject stale final output. Adversarial producer: mutate a dev finding to point at a required image root -> loose findings must have no classification authority. Evidence reviewer: a complete producer inventory is wrapped in a malformed outer envelope -> preserve the whole envelope. These routes clarify existing REQ02/03/05 rather than add product scope.

Accepted additions: judge first validates bound phase receipts through the existing core authority; image classification uses only corresponding digest-bound phase items and matching native receipts. Uncertain attribution preserves all images. Failure output includes the precise allowed error code and safe next action, without reflecting arbitrary stderr.

Audit: requirements/interface/mapping updated by these clarifications, no schema/UI change or new invariants. Executable regressions now cover failed retry, image receipt mutation, outer binding fields and presentation-code identity mutation. Preparation remains noCRITICAL/P1; runtime acceptance and valid independent review still required.

## Judgment identity follow-up: simulation, audit and pre-flight

REV-304-006 confirms that validating receipts without current inputs allowed a changed patch to reach review. This is a clarification of REQ03's binding authority, not a new product feature.

Simulation Findings (proposed):
- Returning operator: verified candidate -> review -> decision succeeds; divergent route changes the workspace before review. Require refusal before model invocation, retaining original receipts.
- Concurrent collaborator: verified candidate -> review completes normally; divergent route edits the candidate while review runs. Record the attempt, but no judgment may gain decision authority after drift.
- Evidence consumer: matching review -> heuristic result counts; divergent route imports an unbound manual pass or failure. Keep the observation, explicitly exclude it from deciding the selected verified candidate.

Accepted under standing implementation authority. Audit phase1: existing scope, invariants, interface, negative-case mapping and DoD present; missing precise judgment binding shape and drift cases. Database/UI/testids remain N/A for this CLI trust-boundary bug.

Audit phase2 additions: REQ08 (MUST): deciding judgments reference the selected baseline/after receipt hashes, after-input identity, reviewed patch hash and native attempt. Generate the patch from the verified Git object, not a mutable worktree index. Validate current after inputs before and after invocation. Evaluation matches these references to its selected receipts and native attempt; missing/mismatched references remain visible but cannot pass or fail a criterion. No retrospective binding of old observations.

Gherkin: Given current verified inputs, when independent review succeeds, then persisted judgment and attempt share the patch/receipt identity and evaluation counts it. Given inputs changed before review, when invoking the judge, then no model is called. Given inputs change during review, then no judgment is recorded. Given an unbound manual pass or failure, when evaluating, then the heuristic criterion remains missing with an explicit explanation. Mapping: `tests/contracts/improve-core.test.js` judge drift, persisted binding, unbound manual judgment and retained retry cases. Existing invariant I-REVIEW-EVIDENCE-001 applies; no new invariant ID needed.

Audit phase3 / Pre-flight Findings: simulation_status passed_with_warnings for this bounded clarification; no CRITICAL/P1 specification gaps. P2: manual/legacy unbound observations remain reportable but cannot authorize decisions; use a fresh canonical review, never invent historical provenance or rerun consumed acceptance. Runtime regression, independent review and CI evidence still required before completion.

### Native origin clarification (REV-304-007 diagnostic)

The next reviewer response was invalid due to a missing required test-file read; its claim of clean001..006 is not assurance. Its additional diagnostic007 was independently reproduced: a manual submission copied the exact successful attempt/binding and changed the result. Adversarial evidence-consumer route: native review passes -> manual forged failure borrows identifiers -> must remain a non-deciding observation. Interrupted evidence custodian route: native output exists -> output bytes later change -> judgment must not count. Normal native review remains countable with intact output.

REQ08 clarification accepted: only the judge's internal recording capability marks native origin; caller-provided native-origin flags are overwritten. Persist and validate the native output SHA256 with the attempt. Existing interface accepts manual observations but does not grant them native authority. Mapped regressions: copied exact binding/native flag, altered native output and normal native review in improve-core.test.js. Simulation -> gap analysis -> surgical clarification -> pre-flight repeated: no CRITICAL/P1 specification gaps; runtime tests and valid review still required. No expanded permissions or new product scope.

### Producer Git-format parity (REV-304-008)

Valid independent review e5b109d6 confirmed001..007 fixed and identified a P2 transport limitation for producer-supported SHA-256 Git repositories. Existing envelope recognition is clarified to accept consistent40- or64-character hexadecimal Git object IDs. A repository operator with either format follows the same bounded review route; mixed formats, shortened and nonhex IDs remain raw. Mapping: integration cases for both valid widths and three malformed shapes. No new authority or summary fields. Scoped simulation/audit/pre-flight: existing requirements/mapping cover this parity correction; no CRITICAL/P1 specification gaps.
