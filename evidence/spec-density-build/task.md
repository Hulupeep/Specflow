# SPEC-DENSITY implementation acceptance

User authorization: Implement and test #162–167 with Claude reviewing.

This implementation run follows completed preparation run 1790166939520-f2043bd4. It preserves every published acceptance criterion. Product work is local to this isolated branch; no merge, release, deployment or customer-validation claim is authorized by a passing local test. Existing required gates remain in force.


# [SPECFLOW] SPEC-DENSITY: progressive specification around the next decision and build slice

Source: https://github.com/Hulupeep/Specflow/issues/162

## Outcome

Specflow specifies enough to make the next decision safely, builds to resolve empirical uncertainty, and deepens only the affected specifications as evidence arrives. The whole feature retains a shared goal and observable outcomes; only the selected next slice receives implementation detail.

**Planning state:** this epic and its children are thin planning tickets, not a claim of build readiness or implemented behaviour.

## Why

The [Pastor E09 implementation brief](https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374) reports about 320 requirements, 360 acceptance criteria, 13 contract packages and four adversary cycles. Upstream capabilities did not yet exist and the parser had never opened the real archive. Later reviews found contradictions introduced by earlier specification repairs, while the largest empirical uncertainty remained unresolved.

Keep the work that earned its cost: early review of ownership, storage, privacy, destructive operations, identity and external data flows; UI persona walkthroughs; reuse checks; recorded owner decisions; independently expected fixtures and executable contracts when needed. Stop generating exact implementation details for distant work merely to fill a template.

The historical brief remains the source of the observations. **The revised bodies of #162–167 replace its earlier implementation prescriptions where they differ.** In particular, there is no universal full-specification package, automatic dependency-finding deferral or finish-only discovery capture.

## The specification triangle

| Scope / tier | Sufficient detail | When to deepen |
|---|---|---|
| Whole feature and future tickets — `spec:thin` | Goal, outcome, boundaries, a small set of behaviour ACs, known dependencies and explicit unknowns | A decision or selected build slice needs more evidence |
| Relevant decisions and seams — `spec:contracted` | Applicable shared decisions, interface responsibilities, dependency reasons, reuse references and a plan to resolve material unknowns | An expensive-to-reverse decision must be made, or the next slice needs a stable seam |
| Selected next slice — `spec:build-ready` | Precise scoped behaviour, applicable new or reused contracts, fixture/oracle references, executable check mapping, scoped simulation and pre-flight evidence | Only after the promotion and freshness checks pass |

Proximity determines when to examine work; risk, uncertainty and existing evidence determine how deeply. Shared irreversible decisions can be examined early without promoting every dependent ticket. Three to eight thin ACs is a guide, not a quota. Build-ready is readiness to implement a bounded slice, not evidence that its acceptance tests have already passed or that it has shipped.

## Scope and ownership

- [ ] #163 — One tier policy, conditional artifacts and consistent enforcement across entry points.
- [ ] #164 — Explicit build frontier, bounded promotion and experiments before production readiness.
- [ ] #165 — Proportional reviews, safe deferral, bounded convergence and honest status.
- [ ] #166 — Discoveries during work and invalidation of affected readiness.
- [ ] #167 — Small tickets, reuse and specification-volume visibility.

Reuse existing Specflow preparation, build, Duo and gate machinery. No new orchestration service, automatic model router or blanket relaxation of tests, privacy, permissions or release gates. A label, owner override, model endorsement or green job containing skipped checks cannot establish acceptance.

Implementation order: establish #163's shared policy first; #165 defines review eligibility for #164 promotion; #166 consumes those transitions. #167 consumes the same policy. These are planning dependencies, not permission to promote the chain together.

## Acceptance criteria

- [ ] AC-162-1: A feature can contain all three tiers. Preparing one selected slice changes only that ticket, directly relevant seams and necessary shared decisions; unrelated future tickets remain thin without generated schemas, field names or fixture packages.
- [ ] AC-162-2: A small change can reuse existing contracts and checks, while a material ownership/privacy/interface change receives the additional applicable review. Unsupported artifact requirements cannot force either into a universal full-spec template.
- [ ] AC-162-3: In the Pastor replay, a bounded parser experiment inspects approved representative input before downstream implementation details are frozen. Its raw result and limits inform the selected slice; unavailable private input is recorded as blocked, never replaced by an invented successful replay.
- [ ] AC-162-4: The replay exercises the documented offline, correction-storage, identity, network and reuse risks within #165's review caps. Deterministic seeded checks and any live model review are reported separately, with reviewer identity, evidence and unresolved findings; no override or unreviewed fix is reported as passed.
- [ ] AC-162-5: A discovery from successful, failed or interrupted work updates affected planning assumptions and invalidates affected readiness before promotion, build/resume or completion; unrelated work can continue.
- [ ] AC-162-6: A fresh installation and resumed runs in both supported hosts follow the same tier policy through selector, spec-build, specflow-simulate, audit/uplift, feature-build, Duo and the board-auditor → waves-controller → sprint-executor route. Runner `simulation_required` defaults and installer checks consume that same policy. Required execution/release gates and privacy checks still block invalid completion/publication at every tier.
- [ ] AC-162-7: The replay reports body sizes, linked specification volume and which artifacts were reused, created or deferred. Tickets meet #167's limit; moving text into documents or splitting it into more tickets does not count as reducing premature specification.

## Definition of done

Executed workflow evidence demonstrates the acceptance above, including negative routes, with missing/skipped checks explicit. The selected slice is tested against its customer-visible outcome; a paper walkthrough alone does not verify the implementation. Record remaining blockers and production/customer-validation limits. The child issues own the implementation and focused regression checks; this epic owns the end-to-end replay.



# [SPECFLOW] SPEC-DENSITY-01: evidence-based tiers and consistent workflow enforcement

Source: https://github.com/Hulupeep/Specflow/issues/163

Epic: #162 · Story: SPEC-DENSITY-01 · Declared tier: `spec:thin`

The revised epic/body governs implementation. The [original brief](https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374) supplies the rationale, not conflicting earlier rules.

## Outcome

An agent can tell what detail is justified now and what readiness has actually been established. Every entry point uses the same tier policy; changing labels or invoking another skill cannot silently expand a thin ticket or bypass a gate.

## Scope

Define the shared policy and wire it through installation, the loop selector/run contract, spec-build, specflow-simulate, story writer, audit/uplift/pre-flight, feature-build, Duo, and the board-auditor → waves-controller → sprint-executor route with their installed instructions/templates. Include the selector/runner `simulation_required` default and installer checks so direct simulation and wave execution cannot retain a contradictory policy. Align the existing policy contracts and their tests through the repository's authorization process; contradictory legacy instructions must not remain silently active. Reuse existing state and verification machinery. #164 owns promotion; #165 owns review budgets; #166 owns discovery invalidation; #167 owns size/reuse checks.

| Tier | Required information | Review depth |
|---|---|---|
| `spec:thin` | Outcome, scope, a small set of behaviour ACs, known dependencies and explicit unknowns | No automatic full simulation, adversary or artifact generation; universal safety/publication rules still apply |
| `spec:contracted` | Applicable shared decisions, interface responsibilities, dependency reasons, reused contracts and evidence needed for material unknowns | Bounded review of relevant irreversible decisions; a paper persona walkthrough for UI flows |
| `spec:build-ready` | Exact slice behaviour, applicable new/reused contracts, fixture/oracle references and executable check mapping, scoped simulation and pre-flight | Required gates for that slice; passing implementation tests remains a completion requirement |

Readiness depends on relevant evidence, not document count. Reuse existing artifacts. A missing applicable artifact blocks; an inapplicable DB/UI/contract artifact needs a brief reason, not generated filler. No new mandatory schema fields, UI selectors or fixture IDs for distant work. A paper UI walkthrough never replaces execution of a required UI journey before completion.

## Acceptance criteria

- [ ] AC-163-1: Installation supplies the three tier labels idempotently without altering unrelated labels or ticket contents. The selector records the effective tier in `run_contract.tier`; an unlabeled ticket is thin with a warning, and conflicting tier labels block with a correction message.
- [ ] AC-163-2: Selecting or auditing a thin ticket reports its current planning state and next justified action without generating full-contract artifacts or automatically promoting it. Invoking another installed entry point yields the same policy decision.
- [ ] AC-163-3: The policy assesses a small eligible change using existing relevant contracts/checks without demanding replacements; #164 owns the promotion transaction. A change introducing a material seam names the additional evidence it needs. Neither a fixed document count nor an artifact unrelated to the change is required.
- [ ] AC-163-4: A contracted UI flow receives the bounded persona walkthrough as well as applicable irreversible-decision review. Common ownership/privacy/reuse decisions may be reviewed once and referenced by affected slices.
- [ ] AC-163-5: Every production build route, including feature-build and wave execution through board-auditor/waves-controller/sprint-executor, refuses thin, contracted, stale or manually relabeled-but-unverified work and identifies the unmet readiness condition. The policy distinguishes production building from bounded experimentation; #164 supplies experiment execution without granting production readiness.
- [ ] AC-163-6: Existing acceptance criteria, repository instructions, permissions, required tests and release gates remain authoritative across tiers. Readiness is separate from implemented, tested, merged and deployed status; reviewer or TypeSafe advice cannot promote a ticket by itself.
- [ ] AC-163-7: Fresh-install and resumed-run checks exercise both Claude Code and Codex entry points, including direct specflow-simulate and wave execution, missing/conflicting labels, reuse, N/A evidence and a manual label bypass. Stale prompt/template instructions cannot force a different gate policy; any legacy migration limitation is reported explicitly.

## Verification and dependencies

Sequencing: AC-163-5/7 verify the shared eligibility decision against supplied current/stale/unverified states now; #164 owns real experiment dispatch and #166 owns discovery-driven invalidation and their integration checks. Missing later capabilities stay unavailable, and the epic integration ACs stay unverified until their owners land; #163 does not depend on those implementations to establish the policy.

No new database or browser UI surface is introduced by this policy ticket. Verify the installed CLI/skill workflow and its mechanical gates, using simulated provider calls only where clearly labelled. At promotion, bind the ACs to the existing runner/installer tests and the minimal additional executable checks. Do not invent downstream implementation interfaces while this ticket is thin. Done requires those checks to execute, with required skips treated as missing evidence.



# [SPECFLOW] SPEC-DENSITY-02: bounded build frontier and learning experiments

Source: https://github.com/Hulupeep/Specflow/issues/164

Epic: #162 · Story: SPEC-DENSITY-02 · Declared tier: `spec:thin`

The revised epic/body governs implementation. The [original brief](https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374) supplies the rationale, not conflicting earlier rules.

## Outcome

The builder prepares the explicitly selected next slice and resolves its real unknowns without specifying the entire dependency chain. A useful experiment can run before production readiness.

## Scope

Use an existing selector/runner route or a small promotion command; do not add an orchestration service. Depends on #163's tier policy and #165's gate outcomes. #166 later consumes the durable observations/transitions delivered here and adds discovery-driven invalidation; #167 checks scope and volume.

The frontier is the explicitly selected next implementation slice or independent slices whose required dependency capabilities have evidence at the stage needed. A closed issue, merged PR or build-ready label alone is insufficient. Immediate seams may be prepared to contracted depth when necessary; that does not recursively promote successors. Early shared irreversible decisions are permitted without promoting the whole feature.

A **bounded experiment** records the question, allowed input and code scope, existing permission/privacy constraints, resource/time stop condition, expected observation and raw evidence location. It produces learning, not production acceptance. Reusing experimental code in the product requires normal promotion and all applicable tests/release gates.

## Acceptance criteria

- [ ] AC-164-1: Promotion records the selected slice, dependency reasons/evidence and why additional depth is needed now. Missing, circular or unverifiable required dependencies produce a specific blocker, not an inferred ready state.
- [ ] AC-164-2: For a chain A → B → C, preparing A does not make B and C build-ready. A build-ready label on A cannot establish an unbuilt capability; B may have only the directly necessary seam discussion until its own readiness is justified.
- [ ] AC-164-3: spec-build deepens the selected ticket, its directly relevant seams and necessary shared decisions only. The frontier report shows tiers, evidence gaps, stale work and unjustified far-future detail; it distinguishes planned interfaces from implemented capabilities.
- [ ] AC-164-4: A deliberate owner-authorized exception to preparation scope records who, why, scope and unresolved risks. A command-line reason or model-written approval cannot impersonate the owner. Such an exception never supplies missing dependency evidence or waives privacy, production acceptance or release gates, and is never labelled passed.
- [ ] AC-164-5: From a thin parser story, the builder can run a bounded experiment on approved representative input before production contracts exist. Success, failure, unavailable input and budget exhaustion each retain raw evidence and an honest outcome; no route marks the product accepted or silently ships experimental code.
- [ ] AC-164-6: Experiment results are durable inputs for #166's later discovery integration and already inform this slice's next promotion decision. Unrelated downstream tickets stay thin. A repeat with no new evidence does not trigger another specification/review cycle automatically.
- [ ] AC-164-7: Promotion validates current scope, dependency and gate evidence before persisting readiness. Concurrent edits or changed acceptance invalidate the attempted transition; resume cannot rely solely on a prior label or historical successful check.

## Verification and dependencies

Sequencing: AC-164-6 delivers durable experiment observations; #166 owns verification that they reach affected tickets. AC-164-7 verifies current scope/dependency/gate evidence here without requiring #166; #166 later adds discovery-triggered invalidation. The complete producer-to-consumer route remains an epic integration gate, not a prerequisite that makes these tickets depend on each other.

Exercise the installed workflow on a dependency chain, independent slices, a closed-but-unimplemented dependency, an owner-scope exception, a stale promotion and successful/failed/unavailable experiments. These are CLI/workflow journeys, not a new browser UI or DB schema. At promotion, attach executable mappings using existing runner tests; done requires executed negative and positive routes. The full private Pastor-input replay belongs to #162, with unavailable inputs explicit.



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



# [SPECFLOW] SPEC-DENSITY-04: discoveries during work invalidate affected readiness

Source: https://github.com/Hulupeep/Specflow/issues/166

Epic: #162 · Story: SPEC-DENSITY-04 · Declared tier: `spec:thin`

The revised epic/body governs implementation. The [original brief](https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374) supplies the rationale, not conflicting earlier rules.

## Outcome

Learning from building or experimenting changes the affected planning assumptions before another agent relies on them. Previously build-ready work becomes ineligible when its supporting assumptions are no longer current.

## Scope

Extend existing build/experiment evidence and ticket records, consuming #163's policy and #164's transitions. Capture discoveries at meaningful work boundaries and on failure, blocking or interruption; finish reconciles the list rather than being its only entry point. A discovery records the observation, evidence, affected assumption/seam and tickets, plus whether an explanation is confirmed or only a hypothesis.

Propose the smallest relevant ticket edit. Do not regenerate the epic or expand every sibling. Preserve the original goal and acceptance; changing them requires the existing owner's authority. Discoveries can refer to private evidence locally, but public comments must pass #165's publication rules.

## Acceptance criteria

- [ ] AC-166-1: Successful, failed and blocked build/experiment batches persist discoveries before finish. Interruption/resume preserves acknowledged observations, and an explicit “no discoveries” result is distinguishable from a missing report.
- [ ] AC-166-2: Each material discovery creates a traceable proposed-edit comment for affected tickets within existing permissions and marks their relevant specification evidence stale. Retry/resume does not duplicate the same discovery or erase its history; a failed remote write remains pending and visible.
- [ ] AC-166-3: A stale ticket cannot promote, start/resume production building, or claim completion using invalidated evidence, even if it already carries `spec:build-ready`. Affected active runs surface the discovery at the next boundary; unrelated work may continue. Local pending discoveries cannot be bypassed merely because GitHub publication is unavailable. If a required discovery/freshness source cannot be checked, affected work reports that blocker instead of assuming no discoveries exist.
- [ ] AC-166-4: Accepting a proposed change requires revalidation of affected readiness. Rejecting it requires an evidence-backed non-impact rationale. Removing a label or acknowledging a comment alone cannot restore readiness or silently weaken acceptance.
- [ ] AC-166-5: Impact follows actual assumption/contract references, including users of a changed shared contract; it does not stale an entire epic merely because a comment was added. Unrelated notes and unchanged acceptance do not invalidate relevant verification.
- [ ] AC-166-6: Concurrent ticket changes are detected before applying a proposed edit; intervening owner/agent work is preserved and reconciliation remains explicit. Hypotheses are not written as confirmed causes, and contradictory evidence remains visible.
- [ ] AC-166-7: The frontier/status report shows open discoveries, affected stale readiness, pending publications and the next reconciliation action. From a parser failure, only affected downstream assumptions change; unaffected thin stories remain thin.

## Verification and dependencies

Sequencing: this story consumes #163's existing eligibility decision and #164's durable observations/transitions. AC-166-1/2/3 own the live experiment-to-discovery and invalidation integrations referenced by AC-163-5/7 and AC-164-6/7; those earlier stories establish their own producer/policy behaviour first, and #162 retains the full end-to-end gate until this consumer is verified.

Exercise discovery from a failed experiment, interruption and idempotent retry, an already-ready downstream ticket, a shared-contract consumer, unrelated comments, a failed GitHub write and a concurrent edit. No new browser UI or DB schema. Bind executable cases to existing runner/state tests at promotion and execute them before completion. Publication tests use sanitized fixtures; they do not disclose the private archive.



# [SPECFLOW] SPEC-DENSITY-05: ticket size, reuse and total specification visibility

Source: https://github.com/Hulupeep/Specflow/issues/167

Epic: #162 · Story: SPEC-DENSITY-05 · Declared tier: `spec:thin`

The revised epic/body governs implementation. The [original brief](https://github.com/Hulupeep/Specflow/issues/162#issuecomment-5792444374) supplies the rationale, not conflicting earlier rules.

## Outcome

Tickets remain readable and executable, and unnecessary specification is visible even when moved into linked documents. Reuse and removal of premature detail are preferred to generating a new document package for every ticket.

## Scope

Extend the existing backlog/verification path using #163's tier and artifact-applicability policy. Keep issue bodies below 20,000 characters as a target and enforce a 30,000-character maximum. More than roughly 40 requirements is a scope/split review trigger, not a reason to produce equally speculative child tickets. Counts are warning signals, not quotas or evidence of quality.

The issue's outcome and behaviour ACs remain the acceptance authority. Supporting details reference existing canonical contracts, decisions, fixtures and evidence where possible. Create a spec/contract document only when the scoped work needs one; do not require links to all of `docs/specs/`, `docs/reviews/` and `docs/contracts/` for every contracted ticket. Executable Specflow contracts remain YAML under the existing contract conventions.

## Acceptance criteria

- [ ] AC-167-1: The verifier reports body character count and fails above 30,000, warns above the 20,000 target, and identifies roughly 40-plus requirements as needing scope review. A passing length check is not a build-readiness verdict.
- [ ] AC-167-2: Before promotion, applicable new or reused artifacts have valid references; missing applicable evidence blocks. Thin and contracted tickets are not forced to create inapplicable spec/contract/review files merely to satisfy a link check. Inapplicability has a recorded reason.
- [ ] AC-167-3: Reports show linked specification volume and which artifacts are shared, reused, newly generated or deferred, distinguishing historical evidence from maintained specifications. Moving text out of a body or duplicating it across child tickets is reported honestly rather than counted as less specification.
- [ ] AC-167-4: A proposed oversized story can be narrowed, stripped of premature implementation detail or split into independently useful outcomes, leaving future children thin. Shared contracts are referenced once rather than copied, and unrelated acceptance is not silently removed to meet a size limit.
- [ ] AC-167-5: Moving necessary details preserves every existing requirement/acceptance identifier and its resolvable canonical reference. Removal, renaming or changing meaning requires an explicit recorded decision; an ID-preservation check rejects accidental loss or conflicting definitions.
- [ ] AC-167-6: Verification identifies broken references and unjustified artifact expansion using the common policy, and distinguishes observed counts from semantic review judgments. All publication and privacy requirements still apply to linked files and comments as well as issue bodies.

## Verification and dependencies

Exercise an inline thin ticket, a ready slice reusing a contract, valid N/A artifacts, a missing required reference, length boundaries, shared versus duplicated files and an ID-preserving move with a negative missing-ID case. This is CLI/document verification with no new DB or browser UI surface. Bind and execute focused checks at promotion; the complete Pastor volume comparison belongs to #162. This ticket does not claim that shorter text alone proves a better specification.



## Required verification gates for this implementation task

GATE-TESTS: Relevant unit, contract, schema, installer and complete workflow tests must execute and pass; missing or skipped required checks cannot prove acceptance.

GATE-PEER: Every meaningful implementation batch and the final scoped acceptance receive actual Claude CLI review; findings and resolution evidence persist.

GATE-HONESTY: Distinguish deterministic seeded tests, simulated provider/board boundaries, real native reviews and the real private Pastor replay. Unavailable input, peer access or required execution is an explicit blocker; no invented proof or weakened acceptance.
