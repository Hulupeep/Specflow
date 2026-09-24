# [SPECFLOW] SPEC-DENSITY-03: scoped reviews, safe deferral and convergent stop rules

Source: https://github.com/Hulupeep/Specflow/issues/165

Epic: #162 · Story: SPEC-DENSITY-03 · Declared tier: `spec:thin`

The revised epic/body governs implementation. The [original brief](https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374) supplies the rationale, not conflicting earlier rules.

## Outcome

Reviews resolve evidenced risks within a bounded scope and budget. They preserve material blockers without creating endless document-repair cycles or treating a stopped review as acceptance.

## Scope

Consume #163's tier policy and feed #164 promotion. Contracted review examines applicable storage/ownership, privacy, destructive operations, identity/keys, external data flows and reuse; UI flows also receive a paper persona walkthrough. Build-ready review covers scoped acceptance and required gates. Preserve required privacy/publication checks at every tier. These are specification-review budgets, not a reset or extension of Duo's existing implementation-repair budgets.

Every blocking finding identifies a violated acceptance criterion, required gate or concrete material risk, with supporting evidence. Preserve observed facts separately from hypotheses. Optional improvements stay non-blocking. A finding about an unbuilt dependency may be deferred only after establishing that it cannot invalidate the current slice or a decision being committed now; uncertainty about that impact remains a blocker.

## Acceptance criteria

- [ ] AC-165-1: Reviews receive a tier-derived scope and applicable artifact/evidence references. They do not demand exact details for unrelated future work. Existing material acceptance, permission and release failures cannot be reclassified as optional because the ticket is thin.
- [ ] AC-165-2: Contracted review permits one initial adversary review and at most one repair review (two total); build-ready pre-flight permits one initial grade and at most one re-grade. Exhaustion with unresolved material findings is blocked/escalated, never passed. Resume, renaming or host switching cannot reset the budget; no-new-evidence/no-progress outcomes stop automatic cycling.
- [ ] AC-165-3: `targets_unbuilt_dependency` does not automatically defer a finding. Deferral records its evidence, non-impact rationale, owning ticket and reconsideration trigger. An unbuilt storage dependency threatening current correction durability still blocks; a future-only field spelling can be deferred. Unknown impact blocks.
- [ ] AC-165-4: Reviews track repair-induced findings against the prior repair. If they exceed 50% of new FATAL/SERIOUS findings in a cycle, escalate without another automatic cycle. Preserve counts and links; uncertain attribution is explicit and cannot extend the hard caps or suppress a material finding.
- [ ] AC-165-5: Scoped acceptance passes only with no evidenced blocking finding and all required gates satisfied. P2-only results are `passed_with_warnings`; an owner exception is `override:<who>:<reason>`; a changed fix without re-grade is “fixed as specified, not re-graded.” A required skipped/missing test cannot become green acceptance.
- [ ] AC-165-6: Every review records provider/model family and whether it was live or simulated. Reuse the existing cross-model Duo boundary for independent review; same-family fresh-context review is labelled honestly, and an unavailable required peer blocks rather than being silently substituted.
- [ ] AC-165-7: Publication at any tier preserves the project's required mechanical privacy checks, including private-baseline-derived value forms and a real scanner canary where applicable. Missing or failing required checks block publication. Only sanitized evidence is shared; private source data and raw provider evaluation records are not published to prove a gate passed.

## Verification and dependencies

Execute scoped-review cases for safe deferral versus present material risk, zero/new/repair-induced findings, exhausted budgets, interrupted resume, same-family/unavailable reviewers, skipped tests and privacy canary failure. No new browser UI or DB schema. Bind exact executable cases at promotion; a simulated provider proves control flow only. Keep any real peer demonstration and the #162 replay separately identified.
