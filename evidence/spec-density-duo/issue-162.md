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
