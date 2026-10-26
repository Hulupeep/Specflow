Epic: #172 · Story: IMPROVE-11 · Declared tier: `spec:thin`

Depends on the repeat controller and cross-cycle evidence.

## Outcome

An unattended improvement run can be interrupted/resumed without duplicating uncertain work, and finishes with a concise morning report that tells the owner what changed and what actually needs a decision.

## Acceptance criteria

- [ ] AC-11-1: Resume reconstructs committed improvements, cycle decisions, pending/uncertain stages, spend and remaining limits from durable state.
- [ ] AC-11-2: Uncertain provider/tool completion is not blindly reissued; deduplication/idempotence rules preserve cost and evidence honesty.
- [ ] AC-11-3: The final report separates retained, reverted and inconclusive experiments and reports regressions/risks discovered.
- [ ] AC-11-4: The top-line claim is product-level and evidence-backed: why the product is measurably better, or that the run did not establish improvement.
- [ ] AC-11-5: The report gives one highest-value human decision/action next, not a generated backlog dump.
- [ ] AC-11-6: A bounded unattended dogfood run completes or resumes successfully with no production side effects.

## Verification

Interrupt a multi-cycle run at an uncertain boundary, resume it, and prove no duplicate committed change/provider request is falsely counted as new work.

## Dependencies

Consumes #181 and #182; resume/reporting must preserve their limits and learning evidence.

## Imported comments

## Improve service planning supplement — parent #215

This supplements the original issue and its acceptance criteria; it does not mark them implemented or replace earlier evidence. The new service epic reuses this work.

# IMPROVE-11: durable recovery and truthful morning results

Story key: `recovery`. Planning depth: thin; not build-ready.

## Outcome
An interrupted run has a recoverable status and a useful morning report, rather than being restarted blindly.

## In Scope
Reuse the existing ledger and #179 reporting; recover single-cycle jobs first, retain full multi-cycle ACs as the original completion condition.

## Not In Scope
No blind replay of uncertain calls, repeated consumed holdout, hidden reset of limits, or inferred success.

## Dependencies
#181, #182

## Acceptance criteria
- [ ] AC-RECOVERY-01: Two workers cannot both own a resumed run; old receipts remain auditable and cannot overwrite the winner.
- [ ] AC-RECOVERY-02: Crash after a request but before receipt causes no automatic duplicate provider request.
- [ ] AC-RECOVERY-03: Crash before/after holdout or finalization cannot manufacture KEEP or erase a failure.
- [ ] AC-RECOVERY-04: Cancel during a provider call returns cancelling until resolved, without deleting another job’s workspace.
- [ ] AC-RECOVERY-05: A no-gain or blocked night says improvement not established; restart cannot duplicate the report identity.

## Requirements proposed for preparation
- REQ-RECOVERY-01 (MUST): Persist stage transitions, operation intent/receipt, immutable contract/runtime identity, holdout consumption and limits before acknowledging progress. Use fenced ownership so a stale worker cannot append authoritative outcomes after lease transfer.
- REQ-RECOVERY-02 (MUST): Reconcile uncertain external/model calls using stored operation identifiers and provider evidence. If completion cannot be determined, return reconciliation_required with one recovery action rather than replay; recheck scope/authentication on resume.
- REQ-RECOVERY-03 (MUST): Recover an evaluated result only when matching receipts and durable artifacts exist; a consumed or exposed holdout cannot be rerun to obtain a pass. Preserve interrupted/nonterminal states distinctly from core decisions.
- REQ-RECOVERY-04 (MUST): Cancellation is durable and visible; stop new calls, interrupt cancellable work and report unresolved operations honestly. Cleanup only owned resources after required evidence persists.
- REQ-RECOVERY-05 (MUST): Produce one report per run with result, branch/commit if retained, evidence links, regressions, usage mode and known/unknown counters, stop reason and one next action. Notification failure is separate from run decision.

## Evidence and open decisions
- Full multi-cycle completion still consumes #181/#182. The first release requires the single-cycle crash matrix, not a claim that the whole issue is finished.

Planned verification (not executed or existing-path claims):
- tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries)
- tests/contracts/improve-report.test.js (planned, reusing #179 report schema)


---

## Simulation Findings (proposed)

**simulated_at:** 2026-10-22T07:10:32Z
**Scope:** #183, original body/comments plus the #215 planning supplement. Three independent persona walkthroughs; this is not native Duo review or runtime execution.

**Personas:** repeat/first-time owner (setup and useful morning result); delegated agent (authority and hostile repository content); returning operator (interruption, overlapping work and uncertain side effects).

### Per-persona routes
- Owner: interruption → useful resume; exhausted deadline → named supported recovery.
- Delegate: valid grant → inspect; revoked resume → no new call.
- Returning: uncertain operation → reconciliation; stale worker or consumed holdout → no replay.

### Proposed additions
- **REQ-RECOVERY-06 (MUST):** Before resume, check original limits and return the exact exhausted limit and authorised recovery path without starting work. No counter/deadline reset is implied by resume; the limit-extension versus new-run policy remains an explicit decision.
  **AC-RECOVERY-06:** Resume after deadline makes no provider call and preserves deadline/attempt history. — from Returning owner/deadline already exhausted.
- **REQ-RECOVERY-07 (MUST):** Fence new external operations as well as ledger writes when ownership changes. Before transferring ownership, reconcile or terminate the old worker; if this cannot be established, block transfer rather than allowing simultaneous side effects.
  **AC-RECOVERY-07:** A former lease owner cannot issue new authorised provider, publication or backend operations after transfer. — from Returning operator/zombie worker.
- **REQ-RECOVERY-08 (MUST):** Exercise revoked-resume access separately from the surviving owner’s right to inspect evidence.
  **AC-RECOVERY-08:** A revoked delegate starts no operation, while an authorised owner can still read the preserved run. — from Authority/revoked resume.

### Open questions
- After an exhausted deadline/attempt allowance, should an owner explicitly extend the same run or create a new run? Define evidence reuse and retained counters; never silently reset.

## Specflow Audit — phase 1: gap analysis

**Type:** CLI/agent/service workflow; no new graphical UI.
**PRESENT:** parent/story identity; outcome and in/out scope; requirements and positive/negative acceptance; dependency intent; planned verification and unknowns. Persona routes are now present above.

**MISSING before uplift:** explicit interface/data applicability, reused invariant mapping, Gherkin, DoD, testid applicability, per-requirement test mapping, architectural decision disposition. Do not manufacture SQL or browser selectors for a non-UI planning slice. Where durable storage is still a decision, this is deferred—not a claim that there is no persistence surface.

## Specflow Uplift — phase 2: surgical additions

The additions below supplement existing text. The simulation safety/failure cases above are incorporated into the planned acceptance; open product questions are not silently decided. Existing acceptance and IDs remain. No existing frozen contract is changed.

### Data contract and interface
Proposed logical boundary below, not an implemented or validated storage schema. Reuse existing JSON/append-only evidence where applicable. The selected persistence adapter must define its atomicity, schema and access controls before build-ready. If SQL/RPC is introduced, add its executable schema, permission, replay, rollback and pgTAP/CI gates; do not mark them N/A.

```typescript
interface RecoveryOperationDraft {
  runId: string; operationId: string; ownershipEpoch: number;
  state: 'intent_recorded' | 'issued' | 'confirmed' | 'uncertain';
  receiptRef: string | null; holdoutConsumed: boolean;
  deadlineUtc: string; remainingAttempts: number;
  reconciliationRequired: boolean;
}
```

### Invariants referenced
Reuse `docs/contracts/feature_improve_core.yml`: I-IMPROVE-001/002/003 (frozen acceptance and independent evidence), 004/005 (side effects and core no-push/no-merge), 006/007 (decision/ledger), 008/009 (bounded candidate/critique), 010/011/012 (oracle, single-use holdout and peer veto), 013 (matched demonstrated gain). Reuse `feature_spec_density.yml` for planning versus verified readiness. No new invariant IDs allocated.

### Gherkin scenarios
```gherkin
Feature: IMPROVE-11: durable recovery and truthful morning results
  Scenario: Recover without duplicate calls
    Given a provider intent has an uncertain completion after a crash
    When an authorised owner resumes the run
    Then the operation is reconciled or remains explicitly blocked and is not blindly reissued
  Scenario: Reject stale operation owner
    Given worker B owns a transferred run
    When worker A tries to admit a new external operation
    Then the attempt is denied and no new outbound call occurs
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
| REQ-RECOVERY-01 / AC-RECOVERY-01 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-01` — Two workers cannot both own a resumed run; old receipts remain auditable and cannot overwrite the winner. |
| REQ-RECOVERY-02 / AC-RECOVERY-02 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-02` — Crash after a request but before receipt causes no automatic duplicate provider request. |
| REQ-RECOVERY-03 / AC-RECOVERY-03 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-03` — Crash before/after holdout or finalization cannot manufacture KEEP or erase a failure. |
| REQ-RECOVERY-04 / AC-RECOVERY-04 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-04` — Cancel during a provider call returns cancelling until resolved, without deleting another job’s workspace. |
| REQ-RECOVERY-05 / AC-RECOVERY-05 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-05` — A no-gain or blocked night says improvement not established; restart cannot duplicate the report identity. |
| REQ-RECOVERY-06 / AC-RECOVERY-06 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-06` — Resume after deadline makes no provider call and preserves deadline/attempt history. |
| REQ-RECOVERY-07 / AC-RECOVERY-07 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-07` — A former lease owner cannot issue new authorised provider, publication or backend operations after transfer. |
| REQ-RECOVERY-08 / AC-RECOVERY-08 | tests/integration/improve-resume.test.js (planned: kill at request, receipt, holdout, finalization and publication boundaries): case `RECOVERY-08` — A revoked delegate starts no operation, while an authorised owner can still read the preserved run. |

These case names and future test files are acceptance obligations, not tests claimed written or executed. 

### Relevant architectural decisions / dependency clarification
Reuse the current Improve contract, `templates/SPECIFICATION.md`, #177 routing and #179 ledger/report. New host/auth/storage decisions remain scoped preparation outputs, not implied ADR approval. #176 proves its initial application isolation/input boundary; #217 qualifies a hosted/durable worker around that boundary. #181 controller delivery precedes #182 minimum memory and #183 recovery; only **schedule activation** depends back on #183. #218 consumes those capabilities; #219 is the optional delivery/plugin wrapper. Broader #182/#183 ACs remain open until their own multi-cycle proof.

## Audit phase 3 — pre-flight result (not a passing status)

**Reviewed at:** 2026-10-22T07:10:32Z
**Scope:** combined ticket and comments; bounded planning review. **Result:** blocked for build-ready/compliance; valid thin backlog preparation.

- **P1: Exhausted-run recovery policy unresolved.** Select audited owner extension versus new-run recovery and define evidence/counter reuse; resolve cancel scope with #218. Uncertain or consumed operations cannot reset.
- **P1: Durable ownership/operation fencing contract incomplete.** Consume the chosen #217 storage/execution boundary and specify durable atomic admission/fencing before build-ready. A ledger-write fence alone is insufficient.

**Lenses checked:** dependency order (controller/activation distinction above); shared state (repo leases, run ownership and operation identities); schema reality (existing contracts loaded, proposed interfaces explicitly unimplemented); timing (absolute deadline, persisted occurrences); partial failure (uncertain calls, artifact loss and delivery reconciliation). Cross-ticket concurrency was also checked at portfolio scope.

**Gate evidence:** live issue imported; `specflow-tier inspect` executed for `specflow-simulate`, `specflow-audit`, and `pre-flight-simulator`: each returned `status: planning`, `tier: thin`. This is not a passing production gate. No runtime tests, provider inference, native Duo review, readiness promotion or deployment were run. Per the user’s audit instruction, any P1 blocks compliance even where an older agent template calls it a warning.

**Executed preparation validation:** 10 checks, 0 failed, 0 skipped through `specflow-specification gate`. Checks cover requirement/AC mappings, review structure, dependency DAG, unchanged reused contracts and truthful status. They do not replace semantic pre-flight or runtime acceptance. Raw gate SHA-256: `86e8849796ff957811bd2f6b99984d414cafb4ce64ff33d6dd5510b8b2cedd2a`.


---

## Portable research-to-build handoff — owner direction

2026-10-26T10:00:56.246Z. Supplements existing acceptance; no implementation/readiness claim. Shared rationale, role boundaries and proportional verification: https://github.com/Hulupeep/Specflow/pull/234. Parent #215 owns the complete loop; existing Chief of Staff/project briefs remain the durable rule sources, not a particular bot.

## Simulation Findings (proposed)
Bounded paper routes: researcher replaced after a result; duplicate coding watchers; interrupted holder/late notification. Happy route preserves one task → one job → returned evidence. Divergent routes must not turn a new actor/transport into new authority, duplicate work or false learning. These are scoped routes from the parent simulation, not independently executed journeys.

## Audit phase 1 — gap analysis
Existing requirements, trust invariants and planned test mappings remain. The portable-role and handoff cases below were missing from this slice's acceptance.

## Audit phase 2 — surgical additions
- **REQ-RECOVERY-09 (MUST):** Reconcile an authorised role replacement using durable task/job and operation identities; fence the old holder before protected operations, preserve original authorship/grants, and never reissue unknown provider work or a consumed holdout under the successor name.
  **AC-RECOVERY-09:** Replace the active holder at an uncertain boundary: the old holder cannot perform another protected operation; the successor observes/reconciles the original job with no second build or fabricated original principal.
- **REQ-RECOVERY-10 (MUST):** An unattended job must not silently await routine owner input. Within existing authority perform bounded repairs or an allowed alternative; otherwise finish with an evidenced limitation, exact cause and owned next action. Preserve explicit approval boundaries and unknown-operation fencing.
  **AC-RECOVERY-10:** Unavailable credentials or an out-of-scope best idea produces an honest limitation/needs-change report without forbidden spend or a silent pending-Colm state. Existing AC-11-5 requests a human decision only when one is genuinely required, not an invented routine ask.

Planned executable mapping: **tests/integration/improve-resume.test.js and tests/contracts/improve-report.test.js (already planned; not executed)**; add the named positive/negative cases above to those checks at implementation. No new invariant IDs or database schema are allocated by this planning change. Reuse existing frozen acceptance, independent-evidence, authority and ledger invariants.

```gherkin
Scenario: Portable evidence-backed handoff
Given the current role holder loses authority while an operation acknowledgement is unknown
When a successor is assigned
Then the original operation is reconciled before another protected start
And the report states the exact limitation without claiming success
```

## Audit phase 3 — pre-flight: blocked for build-ready
P1: actual handover/fencing and terminal limitation state transitions need scoped protocol and process-loss proof; this does not add authority to the existing controller.

Tier inspections returned planning/thin for simulate, audit and pre-flight. No production eligibility, passing runtime journey or Specflow compliance is claimed. Data/interface choices remain for the selected contracted slice; if SQL/RPC is introduced, its database gates apply. Scope has no new graphical UI; do not invent selectors or claim the future agent journey executed.
