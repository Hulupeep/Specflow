# [SPECFLOW] IMPROVE-10: cross-cycle learning and opportunity memory

Epic: #172 · Story: IMPROVE-10 · Declared tier: `spec:thin`

Depends on #171 and the bounded loop controller.

## Outcome

Later cycles use relevant evidence from earlier cycles so the run changes its product model after success, failure or uncertainty instead of behaving as independent repeated prompts.

## Scope

Persist/consume learned evidence and a bounded opportunity backlog. Detect already-tried hypotheses, no-progress repeats and keep/revert oscillation. Failed and inconclusive experiments remain useful evidence.

## Acceptance criteria

- [ ] AC-10-1: Candidate selection can cite prior-cycle evidence that materially changed the next choice.
- [ ] AC-10-2: Repeating an equivalent failed/inconclusive hypothesis without new evidence is blocked or explicitly justified.
- [ ] AC-10-3: A retained change updates the baseline used by subsequent contracts; later cycles do not evaluate against stale pre-run state.
- [ ] AC-10-4: Opportunities discovered but not selected remain visible without automatically becoming work.
- [ ] AC-10-5: Contradictory evidence is preserved; the system does not rewrite prior outcomes to create a coherent success story.

## Verification

Demonstrate at least one run where cycle N changes direction because of cycle N-1 evidence.

## Dependencies

Consumes #181 for bounded-loop execution and #171 for the proven single-cycle primitive.

## Improve service planning supplement — parent #215

This supplements the original issue and its acceptance criteria; it does not mark them implemented or replace earlier evidence. The new service epic reuses this work.

# IMPROVE-10: repo-scoped evidence memory without rewriting acceptance

Story key: `memory`. Planning depth: thin; not build-ready.

## Outcome
Prevent tomorrow’s run from repeating an already rejected idea while keeping the first release small.

## In Scope
Minimum durable tried-opportunity and owner-decision memory; preserve the original broader cross-cycle learning ACs for later completion.

## Not In Scope
No vector platform requirement, self-editing acceptance, cross-repo private knowledge pooling or autonomous policy rewriting.

## Dependencies
#181

## Acceptance criteria
- [ ] AC-MEMORY-01: An equivalent rejected attempt is recognized across renamed runs and restarts.
- [ ] AC-MEMORY-02: One repeat is rejected while a materially changed-input retry is admitted with visible justification.
- [ ] AC-MEMORY-03: An unmerged PR cannot silently become the next night’s main; changed main invalidates stale evidence.
- [ ] AC-MEMORY-04: A stored instruction to skip tests or expose another repo is ignored and reported.
- [ ] AC-MEMORY-05: Reports distinguish minimum memory support from the still-unproven broader learning behaviour.

## Requirements proposed for preparation
- REQ-MEMORY-01 (MUST): Key opportunity history by repo, relevant baseline/profile/contract and normalized hypothesis; include KEEP, REVERT, INCONCLUSIVE, rejection and pending owner decisions with source evidence.
- REQ-MEMORY-02 (MUST): Block equivalent failed/uncertain attempts without materially new evidence; retain a scoped reason and evidence when retry is justified. A changed run ID or paraphrased hypothesis is not new evidence.
- REQ-MEMORY-03 (MUST): Revalidate baseline against current authorised main for each new nightly job. A retained unmerged branch is not deployed state; within a separately authorised multi-cycle run, only an explicitly selected retained commit becomes its next baseline.
- REQ-MEMORY-04 (MUST): Keep owner decisions and contradictions append-only with repo-specific access; inherited text is advisory and cannot alter frozen gates, routing or permissions.
- REQ-MEMORY-05 (MUST): Keep advanced ranking/learning as an explicit later milestone within this issue. Minimal duplicate prevention can support release, but does not close the original cross-cycle direction-change AC.

## Evidence and open decisions
- Opportunity equivalence needs explicit fixtures before build-ready; semantic similarity alone cannot silently discard an owner request.

Planned verification (not executed or existing-path claims):
- tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation)
- Existing ledger-chain contract plus a persisted two-run integration fixture


## Simulation Findings (proposed)

**simulated_at:** 2026-10-22T07:10:32Z
**Scope:** #182, original body/comments plus the #215 planning supplement. Three independent persona walkthroughs; this is not native Duo review or runtime execution.

**Personas:** repeat/first-time owner (setup and useful morning result); delegated agent (authority and hostile repository content); returning operator (interruption, overlapping work and uncertain side effects).

### Per-persona routes
- Owner: rejected idea → different choice; pending successful PR → no equivalent new build.
- Delegate: authentic decision → evidence; model-forged approval → proposal only.
- Returning: current main → fresh baseline; PR closed/unknown → reconcile without automatic retry.

### Proposed additions
- **REQ-MEMORY-06 (MUST):** Suppress an equivalent retained opportunity while publication or owner review is pending; reference its run/PR and do not rebuild it. This does not itself decide whether unrelated work may proceed while a PR is open.
  **AC-MEMORY-06:** Two occurrences against unchanged main cannot create equivalent retained proposals with renamed hypotheses. — from Owner/pending successful proposal.
- **REQ-MEMORY-07 (MUST):** Record authenticated source, author, repo scope and source revision for owner decisions. Treat model/repository claims as proposals only; they cannot satisfy owner approval.
  **AC-MEMORY-07:** A model statement claiming owner approval leaves the real decision unresolved. — from Authority/forged owner decision.
- **REQ-MEMORY-08 (MUST):** Consume authenticated proposal lifecycle observations from #219 when available and retain unknown/inaccessible observations distinctly. Closed-unmerged is not implicit rejection or retry permission. Minimal local outcome reconciliation must work before the optional HeyStax adapter exists.
  **AC-MEMORY-08:** A missing or closed PR does not silently free an equivalent opportunity for automatic repetition. — from Returning operator/PR changed elsewhere.

### Open questions
- How does the owner record reject-this-idea versus close-this-PR-and-retry? Specify an authenticated command/config path before enabling automatic reselection.

## Specflow Audit — phase 1: gap analysis

**Type:** CLI/agent/service workflow; no new graphical UI.
**PRESENT:** parent/story identity; outcome and in/out scope; requirements and positive/negative acceptance; dependency intent; planned verification and unknowns. Persona routes are now present above.

**MISSING before uplift:** explicit interface/data applicability, reused invariant mapping, Gherkin, DoD, testid applicability, per-requirement test mapping, architectural decision disposition. Do not manufacture SQL or browser selectors for a non-UI planning slice. Where durable storage is still a decision, this is deferred—not a claim that there is no persistence surface.

## Specflow Uplift — phase 2: surgical additions

The additions below supplement existing text. The simulation safety/failure cases above are incorporated into the planned acceptance; open product questions are not silently decided. Existing acceptance and IDs remain. No existing frozen contract is changed.

### Data contract and interface
Proposed logical boundary below, not an implemented or validated storage schema. Reuse existing JSON/append-only evidence where applicable. The selected persistence adapter must define its atomicity, schema and access controls before build-ready. If SQL/RPC is introduced, add its executable schema, permission, replay, rollback and pgTAP/CI gates; do not mark them N/A.

```typescript
interface OpportunityObservationDraft {
  repoId: string; opportunityKey: string; baselineRef: string;
  runId: string; evidenceRefs: string[];
  decision: 'KEEP' | 'REVERT' | 'INCONCLUSIVE' | null;
  proposalState: 'none' | 'pending_delivery' | 'open' | 'merged' | 'closed_unmerged' | 'unknown';
  ownerDecisionRef: string | null; sourceRevision: string;
}
```

### Invariants referenced
Reuse `docs/contracts/feature_improve_core.yml`: I-IMPROVE-001/002/003 (frozen acceptance and independent evidence), 004/005 (side effects and core no-push/no-merge), 006/007 (decision/ledger), 008/009 (bounded candidate/critique), 010/011/012 (oracle, single-use holdout and peer veto), 013 (matched demonstrated gain). Reuse `feature_spec_density.yml` for planning versus verified readiness. No new invariant IDs allocated.

### Gherkin scenarios
```gherkin
Feature: IMPROVE-10: repo-scoped evidence memory without rewriting acceptance
  Scenario: Remember a pending proposal
    Given an equivalent retained opportunity has an open draft PR on unchanged main
    When the next occurrence selects the same hypothesis with different wording
    Then it references the pending result and creates no duplicate implementation
  Scenario: Reject forged owner decision
    Given an opportunity awaits an authenticated owner decision
    When model output claims the owner approved retry
    Then that text remains a proposal and cannot satisfy the required decision
```

### Definition of Done
- [ ] Resolve the scoped P1/CRITICAL findings below and obtain current preparation/promotion evidence before production implementation.
- [ ] Execute mapped positive and negative contract/integration checks; retain command, revision, environment and executed/failed/skipped counts.
- [ ] Verify real side-effect/persistence boundaries where claimed; protocol doubles do not prove deployment/backend behaviour.
- [ ] Preserve existing trust contracts and privacy/release gates.
- [ ] Record implementation, tested, merged and deployed status separately.

### data-testid coverage / journey
N/A for graphical selectors: no web/desktop UI is introduced. Exercise CLI/MCP protocols, real processes/storage and denied operations. The actual product browser proof remains owned by #180.

### SpecFlow contract mapping
Existing source of invariant truth: `docs/contracts/feature_improve_core.yml`; future feature/adapter schemas must be placed in YAML contracts before promotion, not treated as existing because this ticket names them.

| Requirement and AC | Planned executable evidence |
|---|---|
| REQ-MEMORY-01 / AC-MEMORY-01 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-01` — An equivalent rejected attempt is recognized across renamed runs and restarts. |
| REQ-MEMORY-02 / AC-MEMORY-02 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-02` — One repeat is rejected while a materially changed-input retry is admitted with visible justification. |
| REQ-MEMORY-03 / AC-MEMORY-03 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-03` — An unmerged PR cannot silently become the next night’s main; changed main invalidates stale evidence. |
| REQ-MEMORY-04 / AC-MEMORY-04 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-04` — A stored instruction to skip tests or expose another repo is ignored and reported. |
| REQ-MEMORY-05 / AC-MEMORY-05 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-05` — Reports distinguish minimum memory support from the still-unproven broader learning behaviour. |
| REQ-MEMORY-06 / AC-MEMORY-06 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-06` — Two occurrences against unchanged main cannot create equivalent retained proposals with renamed hypotheses. |
| REQ-MEMORY-07 / AC-MEMORY-07 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-07` — A model statement claiming owner approval leaves the real decision unresolved. |
| REQ-MEMORY-08 / AC-MEMORY-08 | tests/contracts/improve-memory.test.js (planned: renamed hypothesis, changed base, contradictions and repo isolation): case `MEMORY-08` — A missing or closed PR does not silently free an equivalent opportunity for automatic repetition. |

These case names and future test files are acceptance obligations, not tests claimed written or executed. 

### Relevant architectural decisions / dependency clarification
Reuse the current Improve contract, `templates/SPECIFICATION.md`, #177 routing and #179 ledger/report. New host/auth/storage decisions remain scoped preparation outputs, not implied ADR approval. #176 proves its initial application isolation/input boundary; #217 qualifies a hosted/durable worker around that boundary. #181 controller delivery precedes #182 minimum memory and #183 recovery; only **schedule activation** depends back on #183. #218 consumes those capabilities; #219 is the optional delivery/plugin wrapper. Broader #182/#183 ACs remain open until their own multi-cycle proof.

## Audit phase 3 — pre-flight result (not a passing status)

**Reviewed at:** 2026-10-22T07:10:32Z
**Scope:** combined ticket and comments; bounded planning review. **Result:** blocked for build-ready/compliance; valid thin backlog preparation.

- **P1: Authenticated owner resolution path missing.** Define how reject-this-idea differs from close-and-retry, and how the authenticated resolution is recorded. Until then equivalent unresolved work remains blocked; model inference cannot resolve it.

**Lenses checked:** dependency order (controller/activation distinction above); shared state (repo leases, run ownership and operation identities); schema reality (existing contracts loaded, proposed interfaces explicitly unimplemented); timing (absolute deadline, persisted occurrences); partial failure (uncertain calls, artifact loss and delivery reconciliation). Cross-ticket concurrency was also checked at portfolio scope.

**Gate evidence:** live issue imported; `specflow-tier inspect` executed for `specflow-simulate`, `specflow-audit`, and `pre-flight-simulator`: each returned `status: planning`, `tier: thin`. This is not a passing production gate. No runtime tests, provider inference, native Duo review, readiness promotion or deployment were run. Per the user’s audit instruction, any P1 blocks compliance even where an older agent template calls it a warning.

**Executed preparation validation:** 10 checks, 0 failed, 0 skipped through `specflow-specification gate`. Checks cover requirement/AC mappings, review structure, dependency DAG, unchanged reused contracts and truthful status. They do not replace semantic pre-flight or runtime acceptance. Raw gate SHA-256: `322a56def0fd2c5857409713bbb425376a539e3ee9140d28f52476ca6e4fb5a2`.


## Portable research-to-build handoff — owner direction

2026-10-26T10:00:56.246Z. Supplements existing acceptance; no implementation/readiness claim. Shared rationale, role boundaries and proportional verification: https://github.com/Hulupeep/Specflow/pull/234. Parent #215 owns the complete loop; existing Chief of Staff/project briefs remain the durable rule sources, not a particular bot.

## Simulation Findings (proposed)
Bounded paper routes: researcher replaced after a result; duplicate coding watchers; interrupted holder/late notification. Happy route preserves one task → one job → returned evidence. Divergent routes must not turn a new actor/transport into new authority, duplicate work or false learning. These are scoped routes from the parent simulation, not independently executed journeys.

## Audit phase 1 — gap analysis
Existing requirements, trust invariants and planned test mappings remain. The portable-role and handoff cases below were missing from this slice's acceptance.

## Audit phase 2 — surgical additions
- **REQ-MEMORY-09 (MUST):** Persist a bounded repo-scoped decision pack with intent, fixed criteria/revision, selection rationale, rejected alternatives, real evidence references, prior outcomes and authenticated authorship/role provenance; a replacement researcher or builder can recover it without predecessor chat memory.
  **AC-MEMORY-09:** After the researcher is replaced, its successor recovers the same experiment, fixed criteria, alternatives and contradictions; no duplicate selection/build is created just because the holder changed.
- **REQ-MEMORY-10 (MUST):** Store the evidence-backed experiment verdict separately from the core code decision. Distinguish hypothesis counter-evidence from implementation failure, invalid verification or unavailable real data; prior rules/outcomes remain immutable. Keep this memory outside restricted evaluator/holdout inputs.
  **AC-MEMORY-10:** A failed build or invalid fixture produces no false disproof, and a KEEP implementation is not reported as proven demand/revenue. A changed next choice cites relevant prior evidence.

Planned executable mapping: **tests/contracts/improve-memory.test.js (already planned; not executed)**; add the named positive/negative cases above to those checks at implementation. No new invariant IDs or database schema are allocated by this planning change. Reuse existing frozen acceptance, independent-evidence, authority and ledger invariants.

```gherkin
Scenario: Portable evidence-backed handoff
Given a researcher was replaced after an invalid fixture result
When its successor reads the bounded decision pack
Then the result remains needs-a-change rather than disproven
And the fixed experiment and evidence keep their original identity
```

## Audit phase 3 — pre-flight: blocked for build-ready
P1: choose bounded memory/verdict schema, authenticated decision sources and equivalence fixtures before promotion; the original multi-cycle direction-change acceptance stays open.

Tier inspections returned planning/thin for simulate, audit and pre-flight. No production eligibility, passing runtime journey or Specflow compliance is claimed. Data/interface choices remain for the selected contracted slice; if SQL/RPC is introduced, its database gates apply. Scope has no new graphical UI; do not invent selectors or claim the future agent journey executed.
