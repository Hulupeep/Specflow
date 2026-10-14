# #189: Explain review stops and continue while evidence advances

## Execution brief
The owner approved replacing arbitrary review allowances with evidence-based continuation. Duo currently hides the real blocker behind exhausted-limit messages, and scoped reviews charge metadata failures as product repairs. Implement one consistent policy for scoped preparation and Duo implementation. This supersedes the fixed initial-plus-one policy in #189/#199; #199's proposed manual reset is emergency tooling, not a dependency. #201 supplied the optional-finding paraphrase reproduction. Existing pinned runs remain on their recorded runtime; do not rewrite their histories or claim this change repairs them automatically.

Weight: behaviour change plus bug. Simulate, audit, failing-first behavioural tests, contract suite and independent code review. No DB or UI changes. Kill check: preserve acceptance and stop actual repeated failure; reject any design where renaming work, cosmetic edits or invalid responses earn acceptance or endless retries.

## Scope
In: honest stop reports, progress-based review continuation, separate protocol recovery, optional execution ceilings, usage-mode labelling, append-only recovery records, shipped instructions and installer/runtime parity.
Out: provider billing integration, model routing changes, unattended scheduling, automatic provider quota polling, modifying pinned old runtimes, DB/UI work, #201 implementation, submodule snapshot support (historical adjacent observation, not part of this fix).

## Acceptance criteria
- [ ] AC-RC-1: Every blocked status preserves the concrete cause, unresolved findings/criteria, raw evidence locations, attempted recovery and actionable next step; guard/ceiling is separate and cannot overwrite the cause. A preflight refusal preserves the last substantive failure.
- [ ] AC-RC-2: Valid reviews can exceed two scoped/four Duo rounds while advancing previously unverified criteria/gates or closing previously unresolved findings. Cosmetic edits, renamed runs/batches/hosts, repeated closures and paraphrased diagnostics do not replenish progress. Historical counts remain visible.
- [ ] AC-RC-3: Two consecutive non-progressing valid reviews require diagnosis. Three consecutive invalid peer responses require protocol diagnosis. One evidenced materially different recovery attempt per failure episode is allowed; its failure blocks with the concrete cause. A changed hash or builder assertion alone cannot establish acceptance or verified progress. Recovery may be prepared autonomously, but gates remain closed until independent review validates the result.
- [ ] AC-RC-4: Protocol-invalid reports apply no partial acceptance, preserve all prior findings and do not charge product repairs. A rephrased optional finding preserves its original identity/basis, with updated wording retained separately, and does not block an otherwise passing review. Genuine criterion reassignment is rejected. Pending/interrupted reservations cannot be silently dropped.
- [ ] AC-RC-5: Optional explicit maxCalls and maxElapsedMs checkpoint before another peer invocation, preserving history/acceptance. Usage mode is subscription, api or unknown; default unknown, monetary cost unmeasured. No implied dollar cost or monetary stop derives from review counts. Extending an explicit ceiling requires recorded owner authorization; normal recovery cannot extend it.
- [ ] AC-RC-6: Run ownership, independent live acceptance, complete current gate evidence, privacy and pinning remain required. Current eligibility includes scoped preparation blockers. Recovery is locked, reference/hash checked, durable across resume/host changes and refuses absent/stale evidence. Old pinned runs report the migration boundary honestly.

## Gherkin
```gherkin
Feature: Explain and recover review interruptions
  Scenario: Product keeps improving
    Given a review has already run four times
    When the peer verifies a previously unverified requirement with current evidence
    Then another needed review is allowed without resetting history
  Scenario: Work is spinning
    Given two valid reviews made no first-time verified progress
    When the builder supplies inspected diagnosis evidence and a different repair action
    Then one recovery review is allowed and a repeated failure requires escalation
  Scenario: Optional finding wording changes
    Given an accepted preparation review has optional finding P2-DIAG
    When the next independent review paraphrases that same finding
    Then its original basis remains recorded and the paraphrase does not block acceptance
  Scenario: Subscription execution checkpoint
    Given subscription usage and an explicit maximum of three calls
    When three calls have been invoked
    Then the next call is refused with a checkpoint reason separate from the product problem
    And no invented monetary cost is reported
  Scenario: Invalid or stale recovery
    Given a protocol failure with retained raw output
    When recovery omits diagnosis evidence or changes it after recording
    Then no extra peer invocation or acceptance is granted
```

## Definition of Done
- Failing-first reproductions for lost blocker and optional-finding paraphrase.
- Executed contract/CLI journeys for advancing beyond old caps, stagnation, one recovery, malformed responses, stale evidence, ownership and explicit ceilings.
- Full canonical Jest suite passes (tests root only); installation and pinning include new helper.
- Independent review findings resolved; commit/PR linked to #189. No claim that test-double peer transport is a live model review.

## SpecFlow contract mapping
- I-DENSITY-004: replace fixed allowance with shared evidence-progress/recovery rule; preserve no false readiness. Other I-DENSITY rules unchanged.
- I-DUOOPS-001/002/003: preserve ownership, complete current acceptance, explicit findings and non-cosmetic progress; clarify recovery policy.
- I-DUOACT-002/003: no partial protocol acceptance; unchanged runtime pinning.
- Tests: tests/contracts/review-continuation.test.js, spec-density-reviews.test.js, duo-operations.test.js; tests/scripts/duo-build.test.js, duo-runtime-pinning.test.js; installer alignment tests.
- CLI journeys J-DUO-CONVERGE/J-DUO-HANDOFF remain applicable. Browser journey/data-testids/frontend/SQL/RLS: N/A, local CLI and JSON journals only.

## Simulation Findings (proposed)

Applied under the owner's request to build/update the ticket and execute.

- Repeat operator: successive fixes close different findings; divergent route reopens and closes the same finding. Addition AC-RC-2: count first-time achievements only, across host/batch changes.
- Returning operator: resumes after protocol failure; divergent route a pinned old helper still uses old policy. Addition AC-RC-6: preserve the pin, report its boundary; no automatic runtime/journal rewrite.
- Subscription user: finishes under no monetary ceiling; divergent route explicit call ceiling is reached. Addition AC-RC-5: checkpoint separately, require explicit owner authorization to extend, never infer dollar cost.
- Adversarial/repeated-failure route: fixes malformed response; divergent route changes only recovery wording or evidence bytes. Addition AC-RC-3/6: one recovery per cause class per progress episode, current hashed evidence, no acceptance from diagnosis, no second recovery through host transfer.

Kill check passed: retain independent acceptance and scope; replace counts only where they are a poor signal. No unresolved product questions; conservative implementation treats new diagnosis as a bounded recovery, not unlimited new-progress credit.

## Specflow Uplift: missing executable interfaces and failure semantics

Gap analysis: problem, scope, ACs, Gherkin, DoD and contract mapping present. Missing local journal interface and exact recovery/ceiling semantics added below. SQL/RLS/frontend/testids are N/A for this CLI-only slice. Relevant ADR: existing runtime pinning (I-DUOACT-003); this change does not revise pinned active runs.

```typescript
type ReviewPolicy = { usageMode?: 'subscription' | 'api' | 'unknown'; maxCalls?: number; maxElapsedMs?: number };
type Recovery = { kind: 'protocol' | 'stagnation'; cause: string; action: string; evidence: {path: string; sha256: string}[] };
type StopReport = { cause: string; guard: string | null; findings: unknown[]; next_action: string };
```

Recovery requires nonempty cause/action, evidence references that currently match, and an active diagnosis guard. Reserve at most one recovery of each kind per episode; consume it before invocation so interruption cannot grant an extra call. Verified first-time progress advances the episode. Valid protocol output clears consecutive protocol failures but does not itself count as product progress. Retain the original finding basis and record later wording separately; criterion identity cannot change. Optional P2 wording cannot cause a material block.

Explicit ceilings must be positive finite integers. They are off by default; omitted usageMode means unknown. A ceiling extension is an append-only event with reason and explicit ownerAuthorized flag, invoked only after actual user authorization. Recovery cannot change ceilings. The owner-session token still fences mutations. Stop reports retain the complete concrete cause, not a truncated replacement.

Execution mapping: AC-RC-1/3/5/6 -> review-continuation.test.js and Duo CLI journeys; AC-RC-2/4/6 -> scoped review and Duo contract tests. Both contract changes implement the owner's expressly requested policy replacement; all acceptance/pinning constraints remain.

## Pre-flight Findings

**simulation_status:** passed
**simulated_at:** 2026-10-12T06:46:36.581652+00:00
**scope:** ticket

CRITICAL: None. P1: None. P2: None.
Method: read-only trace of each AC through the local journal interface, failure/retry routes, ownership/pinning rules and executable test mapping. This is specification pre-flight, not an implementation test pass or live peer acceptance.

## Independent review disposition

Claude reviewed a frozen source snapshot with Read/Glob/Grep only; no commands or mutations were allowed. Findings were code-reading hypotheses, then reproduced and fixed with executed regressions:

- Validate the Duo recovery before reserving a scoped call; failed preflight cannot charge either controller.
- New interrupted scoped attempts are protocol failures, preserving the reason and permitting an unchanged retry.
- Invalid finding/gate references, unknown closures and unindexed criterion IDs cannot credit progress or discard prior blockers; error classification uses explicit categories, not finding-ID text matching.
- Scoped reasons include material finding basis/action as well as generic gate errors.
- Shared scoped recovery/ceiling commands now run through the owning Duo session using `scope: "specification"`; no new unfenced CLI mutation.
- Pending guard reporting uses the updated in-memory state; old pinned recovery commands explicitly explain the migration boundary.

Tests use real local files, Git, command captures and CLI/controller execution with deterministic peer transport doubles. The independent Claude code review is live; it does not turn the fixtures into live-model acceptance evidence or silently upgrade #201's pinned run.

Follow-up review: rejected deferrals now remain open and are supplied to the next native reviewer; stale carried deferral evidence reopens the obligation. Scoped validation failures cannot credit a discarded Duo acceptance or charge the protocol streak. Pending status retains prior findings. New Duo-owned interruption bookkeeping requires the owner token and excludes live operations. Scoped recovery messages name `scope: "specification"`. Historical unbound reservations keep their existing local interruption bookkeeping; this does not grant readiness. Gate IDs as well as criterion IDs must belong to the reserved scope before earning credit.

## Execution result

Implemented on `fix/189-review-continuation`. Full canonical Jest run: **74 suites, 1,395 tests passed, zero skipped**, exit 0. Raw failing-first and final-suite results plus tested source hashes are in `evidence/review-continuation/`. Loop-template parity and whitespace checks pass. Four live read-only Claude code-review rounds identified concrete acceptance/recovery bugs; the final targeted recheck reports **No remaining findings**. Automated peer transports remain explicitly simulated.

Final regression also covers accepted partial batches: they earn first-time verified progress without granting readiness. New frozen evidence or a different required batch can be regraded under unchanged spec scope; names/history churn alone cannot reset continuation controls.

Pre-flight recheck after implementation refinements: the same four persona routes remain covered, partial acceptance is explicitly covered, and no unresolved CRITICAL/P1 specification findings remain. The user-authorized policy change preserves independent acceptance and history; it does not repair or migrate the older pinned #201 run.
