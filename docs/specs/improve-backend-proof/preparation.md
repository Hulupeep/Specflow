# #180 scoped preparation: genuine backend and deciding screenshots

## Simulation Findings (proposed)
**simulated_at:** 2026-10-23T06:35:24.484753+00:00. Personas: returning owner (navigation/persistence after interruption); phone/tablet user (breakpoint boundaries and menu reachability); wrong-permissions collaborator (visible denied action and unchanged owner state).

- Returning owner happy: sign in → recover seeded Stax → save a next action → reload → see the saved action. Divergence: a previous aborted check left an action; comparison would duplicate it. Addition REQ-PROOF-07: restore the exact owned namespace and validate the same semantic seed digest before every phase; refuse a mismatch. Actual prototype confirmed persistence, not a mock.
- Phone/tablet happy: Menu and Today stay reachable → existing destination works. Divergence: a phone-only fix below sm still breaks 768. Addition REQ-PROOF-08: practice AND independent deciding checks cover360/390/768; preserve1280; capture screenshots before assertions even on baseline failure. Keep the existing navigation/copy and avoid overflow-hiding as a false fix.
- Wrong-permissions collaborator happy: own account signs in. Divergence: opens another owner's private Stax and attempts Add. Addition REQ-PROOF-06: actual UI must show Forbidden on403 and a real owner re-read must be identical; the other user sees neither owner title nor action. Prototype executed this exact route successfully.

User delegated routine decisions: apply these safety/evidence additions to this selected cycle. No new product choice or card-layout decision is assumed. Kill check: reuse the existing Improve engine and existing UI; no new controller, navigation destination or design system.

## Audit phase 1 — gap analysis
Present in original ticket/comments: product mission, outcome, nine AC-08 and seven AC-PROOF obligations, UX rubric, dependencies and no-production scope. Missing for this cycle: current exact selectors/spec/execution, deterministic seed, oracle/screenshots, applicable interfaces and check mapping. The additions below fill those gaps; prior failed/cloud evidence remains history, never reused as a fresh holdout.

## Audit phase 2 — surgical uplift
No SQL/schema/RPC changes. Existing local migrations/auth/RLS are consumed, not edited. No new public API. Reuse I-IMPROVE-001..014 in feature_improve_core.yml; only frozen acceptance and mechanical evidence can authorise KEEP. Role identities do not imply cross-vendor independence: the existing Improve trace supports Claude tools, so this supervised cycle uses Sonnet builder/Opus peer+oracle+UX judge with explicit same-vendor provenance; separate native Duo review uses this Codex builder and Claude peer. No claim of full filesystem isolation; #217 owns unattended worker qualification.

```typescript
interface ProofEvidence {
  journey: 'J-IMPROVE-HEYSTAX-BACKEND'; source: string;
  initialFixtureDigest: string; // semantic owned seed, no credential values
  stats: {expected: number; unexpected: number; skipped: number; flaky: number};
  privateRaw: string; // private persisted artifact, never a password/token dump
}
```

### Ordered journey and assertions
Executable prototype: evidence/improve-backend-proof/journey_180.spec.cjs. It ran as tests/e2e/journey_180.spec.cjs in the private harness; actual command/results and revision in initial-journey.json. Five actual tests, two pass/three fail/zero skip: mobile/tablet geometry is intentionally red on unchanged baseline, not an unexecuted UI stub.
1. UI /attention sign in; handle setup if actually presented; assert Menu. Dismiss real Close tour control when present; no auth bypass.
2. At1280/360/390/768 assert seeded Stax visible; record screenshots and viewport/header rects. Gain: no horizontal overflow, Today `[data-testid="nav-today"]` and `button[aria-label="Menu"]` fit, do not overlap branding/each other, retain minimum32px height.
3. Open Menu; assert eight existing navigation labels; choose Today; assert /today; return /attention and assert persisted seeded Stax. Baseline desktop passes; phone/tablet gain currently fails before the change.
4. Owner /stax/<owned id>: exact heading; placeholder Add next action… and button Add; assert action text, reload and assert same text. Genuine user-scoped backend read confirms exactly one row.
5. Independent userB browser: owner title/action absent; same form Add attempts a write; assert actual403 and visible Forbidden. Real owner re-read remains identical, and userB RLS reads return no owner rows. Capture both states.

```gherkin
Feature: J-IMPROVE-HEYSTAX-BACKEND
  Scenario: Evaluate a bounded responsive refinement
    Given equivalent owned local fixtures and a frozen independently authored oracle
    When baseline and candidate run at desktop phone and tablet widths
    Then matching failing-to-passing gain plus preservation gates are required for KEEP
    And screenshots and exact executed failed skipped counts survive either outcome
  Scenario: Wrong user cannot add to the owner Stax
    Given an authenticated second user
    When they submit Add on the owner's private Stax
    Then the actual API returns403 and the UI shows Forbidden
    And the owner re-read is unchanged
  Scenario: Interrupted initial state
    Given a prior local test left a next action
    When the next phase begins
    Then only the dedicated owned fixture is reset and its semantic digest validated
    And unavailable or different fixture identity blocks the comparison
```

### Requirement and acceptance mapping
- Coverage: AC-08-1..3 / AC-PROOF-01..02: current source/mission, actual browser discovery measurements, candidates and independent critique.
- Coverage: AC-08-4 / REQ-PROOF-02: separately authored fresh holdouts, frozen compact ImprovementContract, baseline before builder, all widths represented in practice.
- Coverage: AC-08-5: distinct read-only Opus UX judgment with before/after screenshots, rubric and diff; no builder transcript. Screenshots without execution never prove gain.
- Coverage: AC-08-6 / AC-PROOF-03 / REQ-PROOF-03/08: actual mapped Playwright tests, bound production build/start, typecheck and scoped ESLint gates. Broad product tests do not pass in this standalone layout; all raw failures retained and no release readiness claimed. Their missing parent-monorepo dependencies are outside the header change; do not weaken a frozen gate after seeing candidate results.
- Coverage: AC-08-7 / REQ-PROOF-01/05: dedicated loopback backend with two fake users; local-only service credential stays in private server controller memory, never source/builder env/evidence publication; no production or outbound recipients. Existing worktrees/stack untouched.
- Coverage: AC-08-8..9 / AC-PROOF-04..05 / REQ-PROOF-04: single-use holdout, immutable receipts, exact KEEP/REVERT/INCONCLUSIVE, private before/after evidence and safe summary. CLI estimated dollars are not an API invoice; subscription mode and actual observed usage are explicit. Human next action must follow final failed/missing criteria or retained branch, never stale peer advice.
- Coverage: AC-PROOF-06 / REQ-PROOF-06: executed visible403 + unchanged persisted rows in real backend journey.
- Coverage: AC-PROOF-07 / REQ-PROOF-07: dedicated reset verifies namespace/owner/id and empty initial actions; same semantic initialFixtureDigest is retained per phase. Stop on mismatch rather than fabricate equivalence.

### Definition of Done / release distinction
Complete one normal core cycle, retain both screenshots, raw test counts, verified ledger, unchanged source base, decision and appropriate next action, independently review all original+supplemental acceptance and full Specflow canonical gate. A rejected product patch still completes the proof if evidence is valid. Do not push/merge/deploy the product patch; owner's later product review is separate. The source-kit proof evidence may be committed/pushed/merged within the current user-authorised foundation mission.

## Pre-flight Findings
**simulation_status:** passed_with_warnings. **simulated_at:** 2026-10-23T06:35:24.484753+00:00. Scope: this supervised bounded proof, not unattended runtime service or full product release.
CRITICAL: None. The mapped actual journey exists and has executed; red geometry is the declared pre-change baseline, while real positive/negative backend paths passed.
P1: None for this proof. Repairs #223/#224 have independent acceptance and are merged. Exact selectors, seed ownership, phase reset, all viewports, fresh oracle and screenshot obligations are grounded. No missing schema migration or new auth scopes.
P2: Full product test suite has known standalone-monorepo fixture/other failures; retained honestly, not silently green. Full host/egress isolation is not claimed in this supervised proof; #217 is required before unattended execution. Same-vendor product-loop provenance remains explicit.

## Preparation acceptance
- PREP-SCOPE: Preserve the original proof acceptance and core authority; select only the reproduced header issue with no production release or card redesign.
- PREP-JOURNEY: The actual ordered desktop/phone/tablet Playwright prototype and real persistence/visible-denial route have executed, with exact pass/fail/skip counts and owned seed identity.
- PREP-BOUNDARY: Freeze all deciding checks/screenshots before implementation; preserve explicit same-vendor provenance, subscription usage limits and supervised-versus-isolated scope.
- PREP-GATE: Required mapping/evidence checks run without failures/skips before promotion; a passing preparation does not claim candidate success.
