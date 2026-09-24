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
