# SPIKE-IMPROVE-TRUST: establish what makes an improve KEEP trustworthy

Type: research spike · specification depth: thin · surface: CLI/evidence only.
Status: prepared locally; independent Duo review pending. No GitHub issue assigned.
Parent context: IMPROVE-CORE (#171); existing contract/evaluation/isolation work
(#174, #176, #178). These are historical references, not freshly fetched issue state.

## Outcome and decision

Determine the smallest change that prevents an unsupported KEEP, before extending
improve with autonomous orchestration or instruction learning. Deliver evidence
that distinguishes reproduced defects, source-level concerns, and unavailable
experiments. Recommend one bounded implementation slice or an explicit no-go.

This packet prepares the spike and requests Duo review. It does not claim the
research is complete or grant production build readiness.

## Grounding

- Mission: `docs/PRD.md`, sections 1 and 6: independent evidence and mechanical
  gates decide what advances; model claims do not establish acceptance.
- `scripts/specflow-improve.cjs`: `verifyPhase`, `build`, `evaluateCriteria`,
  `decide`, `evaluate`, `finalize` are the relevant decision boundary.
- `docs/contracts/feature_improve_core.yml`: reuse I-IMPROVE-001/002/003/005/006/011;
  do not amend or weaken them during this spike. No new invariant IDs allocated.
- `tests/contracts/improve-core.test.js`: existing fixture, independent fake peer,
  real temporary Git/worktree tests; fake model replies are test fixtures only.
- `evidence/improve-core/DISCOVERIES.md`: D5 records missing mission-level backend
  journeys; L6 records the need for durable private evidence storage.
- `evidence/improve-core/RUN-SUMMARY-improve-heystax-002.md`: repeated layout
  regressions and a fixed-height trade-off. Historical summarized observations,
  not a new HeyStax execution or access to its private source.

## Scope and limits

Investigate three decision questions (Q1–Q3) and design one first slice. Rank four
follow-ups without implementing them: environment coverage, discovery reuse,
whole-run progress/budget limits, and resumable orchestration.

No production changes, contract overrides, migration/auth work, live HeyStax access,
secrets, deployments, push/merge, new sandbox service, prompt self-rewriting, or
new model roles. Existing protections and single-use holdouts remain binding.
Use at most one 90-minute research session after prerequisites are available.
Run each distinct reproduction once, with one retry only after a demonstrated
environment/input change; stop at the timebox with explicit unavailable results.
This is a research limit, not a performance SLA or permission to bypass isolation.

## Questions and reproduction matrix

| ID | Question / experiment | Expected trustworthy behavior | Current evidence |
|---|---|---|---|
| Q1 | Verify a valid patch; change an allowed product file so the check would fail; evaluate and attempt finalize. Compare with an unchanged positive control. | Changed code cannot inherit earlier passing evidence. Capture code identity before/after verification and at decision/finalize. | Source-level concern: verification events omit tested code identity; the existing mutation test starts after evaluation. End-to-end reproduction unavailable in this session. |
| Q2 | Record a valid baseline for v1; freeze v2 with a contradictory baseline expectation; attempt build without a v2 baseline. Then explicitly baseline v2. | Build rejects the stale v1 baseline. New baseline must match the governing contract and disclose mismatch/unavailability. | Source-level concern: build selects the last baseline event without checking its contract version. End-to-end reproduction unavailable in this session. |
| Q3 | Supply only preservation evidence (baseline pass, after pass), an unrelated nonempty diff, and a peer keep recommendation. Compare with a real gain and a regression. | No improvement claim without a frozen, evidenced gain; a peer cannot manufacture one or rescue regression. | The direct decision probe reproduces KEEP for preservation-only evidence. It does not exercise the whole CLI. |

For every experiment retain command/argv, source revision and file hashes, input,
actual output, exit status, expected behavior, and limitations. An environment
failure is unavailable evidence, not a product defect or passing test. Do not
rewrite an assertion to make an unexpected observation pass.

Research requirements:

- REQ-01 (MUST): classify every Q as reproduced, refuted, source-only, or unavailable,
  and retain contradictory evidence rather than discarding it.
- REQ-02 (MUST): explore a receipt binding contract/check identities, tested code,
  and relevant environment identity; compare cheap reuse with a new mechanism.
  Determine how generated files, concurrent edits and legacy runs affect validity.
- REQ-03 (MUST): distinguish gain from preservation; examine matched samples,
  fail-to-pass outcomes and measured thresholds without demanding baseline failure
  on every holdout sample. Decide semantics explicitly before implementation.
- REQ-04 (MUST): recommend a first slice with failure cases, proof commands,
  dependencies, and rollout/legacy handling. Record unresolved decisions as such.
- REQ-05 (MUST): keep all experimental mutations in an approved disposable fixture
  and preserve evidence before cleanup. Never modify the live improve implementation.

## Dependencies and execution boundary

Read-only inspection and the in-process pure decision probe need the existing
checkout and Node dependencies. The probe launches no agents or subprocesses.
Full CLI/worktree experiments need an approved project experiment adapter and a
successful real isolation probe under `templates/SPECIFICATION.md`; none is
configured here. A fabricated green probe or unsandboxed fallback is prohibited.

The preceding contract-suite attempt encountered `spawnSync node EPERM` in its
verification subprocesses (22 tests passed, 20 failed around blocked baselines).
That summary is historical context, not portable proof of Q1/Q2. Recapture raw
results in the supported environment; do not classify those failures as bugs.

Duo preparation uses Codex as builder and Claude as independent peer. Claude
launch currently fails with `spawnSync claude EPERM`. Keep the existing run and
resume it when launch is supported; do not substitute self-review or a fake peer.
GitHub publication requires the configured mechanical privacy scanner; it is
currently absent. Local preparation does not claim remote publication.

## Spike acceptance and Definition of Done

- AC-1: Q1–Q3 have reproducible positive/negative controls and explicit dispositions;
  blocked experiments name the exact prerequisite and constrain the conclusion.
- AC-2: the recommendation prevents stale evidence and unsupported improvement
  claims without weakening current holdout, independence or reversibility rules.
- AC-3: recommend one first slice or no-go; list follow-ups separately with the
  observation that would justify starting each. No automatic scope expansion.
- AC-4: raw evidence is preserved with source identities; a report separates
  observation, inference and open decisions. No claimed backend/UI validation.
- AC-5: independent Duo preparation review accepts the packet or leaves its
  concrete findings/blocker visible. A blocked review is not completion.

Spike completion needs AC-1–AC-5; a bounded inconclusive research result can meet
AC-1 only by naming what remains unknown, not by claiming Q1/Q2 proven.

## Gherkin

```gherkin
Feature: Investigate trustworthy improvement decisions
  Scenario: Distinguish a reproduced decision defect from a hypothesis
    Given a pinned source and preservation-only before and after evidence
    When the existing decision function returns KEEP
    Then record that observation and the function-level limitation
    And do not claim the full CLI reproduction ran

  Scenario: Verification infrastructure is unavailable
    Given the check subprocess is denied by the environment
    When a reproduction cannot reach its intended assertion
    Then classify the reproduction as unavailable
    And retain the error and the prerequisite for a justified retry

  Scenario: A new contract or patch invalidates old evidence
    Given an experiment has recorded a baseline or passing verification
    When its contract or tested patch changes
    Then investigate whether the old result can still authorize KEEP
    And preserve both the original identity and the changed identity
    And do not consume a holdout twice to repair a failed experiment
```

## Preparation review acceptance (this Duo invocation)

- PREP-1: the spike is grounded in named current code/contracts and distinguishes
  measured results from historical summaries and unexecuted hypotheses.
- PREP-2: Q1–Q3 specify controls, evidence, boundaries, unavailable behavior and
  an explicit stop; executable current decision evidence accompanies Q3.
- PREP-3: one first-slice recommendation and deferred follow-ups are justified;
  receipt/gain design alternatives and legacy behavior remain research questions.
- PREP-4: persona simulation and three-phase scoped audit are recorded; missing
  execution, independent review and publication are never reported as passed.

## Initial recommendation to challenge

Investigate evidence binding first (Q1/Q2), then gain semantics (Q3) as a separate
slice if they need independent acceptance. Compare reuse of Duo's source-bound
capture receipts with a minimal improve receipt; do not assume they are compatible.
Legacy unbound evidence must not silently gain authority. Decide whether to cap it
at INCONCLUSIVE or require a new run, preserving history and holdout exposure.

Only after those questions: environment coverage to remove demo-only selection
bias; existing discovery-journal integration to retain applicable constraints;
stagnation/total budget limits; and orchestration over existing stages. The spike
may reorder these if the evidence disproves the proposed trust fixes.

## Contract/test mapping and applicability

Contracts: existing `docs/contracts/feature_improve_core.yml`, unchanged.
Regression home if implementation follows: `tests/contracts/improve-core.test.js`.
Current research probe: `evidence/improve-trust-spike/decision-probe.cjs`.
Simulation and audit: sibling `simulation.md` and `audit.md`.
Data contract, SQL/RLS, frontend interfaces, UI journeys and data-testids: N/A;
this spike changes no application, schema or UI. No new API/schema is prescribed.
Applicable architecture: `docs/PRD.md` trust-layer mission and the existing improve
contract. No new ADR is asserted or silently required.
