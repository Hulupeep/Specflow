# IMPROVE-09 — bounded controller (#181)

Parent: #215. Existing acceptance is preserved below. Controller milestone first; live schedule activation waits for #183.

Epic: #172 · Story: IMPROVE-09 · Declared tier: `spec:thin`

Depends on the trusted single-cycle primitive in #171.

## Outcome

Repeat verified improvement cycles under hard limits such as `--cycles`, `--budget-usd` and a time bound without weakening the per-cycle contract/evaluation rules.

## Acceptance criteria

- [ ] AC-09-1: A loop starts a new cycle only after the previous cycle has a durable terminal decision.
- [ ] AC-09-2: Cycle, spend and time limits are checked at safe boundaries; exhaustion stops honestly without fabricating completion.
- [ ] AC-09-3: Model retries/fallbacks consume the same registered budget rather than resetting it.
- [ ] AC-09-4: Remaining budget/limits are visible in status and final report.
- [ ] AC-09-5: Reaching the requested cycle count is never itself a success criterion.

## Verification

Exercise normal completion, budget exhaustion, time stop and no-safe-next-work stop with preserved evidence.

## Existing planning supplements

## Improve service planning supplement — parent #215

This supplements the original issue and its acceptance criteria; it does not mark them implemented or replace earlier evidence. The new service epic reuses this work.

# IMPROVE-09: explainable limits and one-cycle nightly scheduling

Story key: `limits`. Planning depth: thin; not build-ready.

## Outcome
Run a bounded nightly job without unexplained budget stops or treating subscription estimates as actual spend.

## In Scope
Extend existing bounded controller; default one candidate cycle per scheduled occurrence; retain future multi-cycle support behind explicit configuration.

## Not In Scope
No infinite loop, inferred API billing, reset-on-retry limits, automatic merge or deployment.

## Dependencies
#180, #216, #217

## Acceptance criteria
- [ ] AC-LIMITS-01: Each limit has a deterministic stop test, remaining allowance and preserved history; quota unavailability is not mislabeled budget exhaustion.
- [ ] AC-LIMITS-02: The user can distinguish provider quota, protocol failure, test failure, no progress, deadline and operator cancellation.
- [ ] AC-LIMITS-03: Duplicate timer delivery cannot create a second run; missed and skipped occurrences remain visible.
- [ ] AC-LIMITS-04: A manual and scheduled request racing produce one owner and one explicit busy result.
- [ ] AC-LIMITS-05: An empty opportunity set creates no patch/PR; a verified nightly run honours its original limits across restart.

## Requirements proposed for preparation
- REQ-LIMITS-01 (MUST): Define finite wall-time, cycle, attempt and consecutive-no-progress limits in the approved profile. Retries and configured fallbacks share counters. Separate provider quota/rate limiting from operator limits and measured API spend; estimated subscription dollar values cannot exhaust an actual-spend limit.
- REQ-LIMITS-02 (MUST): On any stop, record reason_code, stage, last completed action, failed check/evidence, remaining limits, retryability and one exact recovery action. A time stop mid-cycle is incomplete until reconciled, never a fabricated terminal success.
- REQ-LIMITS-03 (MUST): A scheduled occurrence has stable identity from repo/profile/schedule and intended fire time. Use an IANA timezone and store the UTC instant; a repeated/DST ambiguous wall-clock slot produces at most one run, a nonexistent slot is recorded skipped, and downtime does not create catch-up storms.
- REQ-LIMITS-04 (MUST): Acquire one atomic active-run lease per canonical repo across scheduled and manual calls. Do not start a next cycle before the current cycle is durably terminal; record an overlap as skipped/busy rather than queueing unlimited work.
- REQ-LIMITS-05 (MUST): Scheduling remains disabled until #183 recovery evidence passes. Default to one cycle and at most one reviewable result; no safe eligible candidate yields no_safe_work, not a low-value change to satisfy the schedule.

## Evidence and open decisions
- No live schedule is created by this ticket preparation. Scheduler implementation selection stays open until worker qualification.

Planned verification (not executed or existing-path claims):
- tests/contracts/improve-limits.test.js (planned: each reason and usage mode)
- tests/integration/improve-schedule.test.js (planned: fake clock for DST/limits, real durable lock store for races)


## Simulation Findings (proposed)

**simulated_at:** 2026-10-22T07:10:32Z
**Scope:** #181, original body/comments plus the #215 planning supplement. Three independent persona walkthroughs; this is not native Duo review or runtime execution.

**Personas:** repeat/first-time owner (setup and useful morning result); delegated agent (authority and hostile repository content); returning operator (interruption, overlapping work and uncertain side effects).

### Per-persona routes
- Owner: scheduled run → report; cancel or pause → separate explicit schedule controls.
- Delegate: authorised timer → one run; revoked grant → no service-account elevation.
- Returning: timer/manual overlap → one lease; profile edit/redelivery → same occurrence, no duplicate.

### Proposed additions
- **REQ-LIMITS-06 (MUST):** Expose durable authorised enable, pause and disable controls with schedule state and next occurrence; cancelling a run is distinct from controlling future occurrences. Define active-run handling explicitly before implementing these controls.
  **AC-LIMITS-06:** After an acknowledged pause/disable no new occurrence starts, including after restart; status distinguishes run cancellation from schedule state. — from Owner/cancel versus schedule.
- **REQ-LIMITS-07 (MUST):** Deduplicate timer deliveries by immutable schedule identity and intended occurrence, independent of mutable profile revision. Capture the effective approved profile revision once on occurrence admission; changed profile cannot create another job for that occurrence.
  **AC-LIMITS-07:** A profile edit plus redelivery returns the original occurrence or a recorded stale/blocked result, never a second job. — from Returning operator/profile edit and redelivery.
- **REQ-LIMITS-08 (MUST):** Persist the explicitly selected owner/creator delegation policy and authenticated grant provenance. At firing, revalidate that grant and repo/profile authority; scheduler credentials cannot widen it. Undefined delegation semantics block schedule enablement.
  **AC-LIMITS-08:** Revoked or undefined authority yields authority_revoked or authority_unresolved and no provider work. — from Authority/delegation revoked.
- **REQ-LIMITS-09 (MUST):** Split controller delivery from schedule activation: controller/occurrence/lease tests run with live scheduling disabled; #182 consumes that milestone, #183 consumes it plus minimum #182 memory, and only activation awaits #183 evidence. Persist an absolute wall-clock deadline including downtime.
  **AC-LIMITS-09:** Controller/recovery tests can run before activation; enabling a schedule without recovery evidence is blocked; restart never extends the deadline. — from Returning operator/dependency activation cycle.

### Open questions
- Should pausing a schedule leave an active run alone or cancel it too? Future admissions must stop in either case.
- Is a schedule owner-owned (survives creator departure) or creator-bound? Enablement requires an explicit authenticated delegation choice.
- While a PR awaits owner review, may unrelated opportunities run, or does the repo pause? Duplicate equivalent proposals are prohibited in either policy.

## Specflow Audit — phase 1: gap analysis

**Type:** CLI/agent/service workflow; no new graphical UI.
**PRESENT:** parent/story identity; outcome and in/out scope; requirements and positive/negative acceptance; dependency intent; planned verification and unknowns. Persona routes are now present above.

**MISSING before uplift:** explicit interface/data applicability, reused invariant mapping, Gherkin, DoD, testid applicability, per-requirement test mapping, architectural decision disposition. Do not manufacture SQL or browser selectors for a non-UI planning slice. Where durable storage is still a decision, this is deferred—not a claim that there is no persistence surface.

## Specflow Uplift — phase 2: surgical additions

The additions below supplement existing text. The simulation safety/failure cases above are incorporated into the planned acceptance; open product questions are not silently decided. Existing acceptance and IDs remain. No existing frozen contract is changed.

### Data contract and interface
Proposed logical boundary below, not an implemented or validated storage schema. Reuse existing JSON/append-only evidence where applicable. The selected persistence adapter must define its atomicity, schema and access controls before build-ready. If SQL/RPC is introduced, add its executable schema, permission, replay, rollback and pgTAP/CI gates; do not mark them N/A.

```typescript
interface OccurrenceDraft {
  scheduleId: string; intendedAtUtc: string; timezone: string;
  approvedProfileRevision: string; authorityRef: string;
  scheduleState: 'enabled' | 'paused' | 'disabled';
  result: 'admitted' | 'skipped' | 'blocked'; runId: string | null;
  reasonCode: string | null;
}
interface LimitsDraft {
  deadlineUtc: string; maxCycles: number; maxAttempts: number;
  maxConsecutiveNoProgress: number; actualApiSpendCeilingUsd: number | null;
}
```

### Invariants referenced
Reuse `docs/contracts/feature_improve_core.yml`: I-IMPROVE-001/002/003 (frozen acceptance and independent evidence), 004/005 (side effects and core no-push/no-merge), 006/007 (decision/ledger), 008/009 (bounded candidate/critique), 010/011/012 (oracle, single-use holdout and peer veto), 013 (matched demonstrated gain). Reuse `feature_spec_density.yml` for planning versus verified readiness. No new invariant IDs allocated.

### Gherkin scenarios
```gherkin
Feature: IMPROVE-09: explainable limits and one-cycle nightly scheduling
  Scenario: Admit a single occurrence
    Given an authorised schedule has passed activation gates
    When its intended occurrence is delivered twice
    Then one occurrence and at most one job are admitted
  Scenario: Reject revoked scheduling authority
    Given a recorded delegation is revoked under its configured ownership policy
    When the timer fires
    Then authority_revoked is recorded and no provider work starts
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
| REQ-LIMITS-01 / AC-LIMITS-01 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-01` — Each limit has a deterministic stop test, remaining allowance and preserved history; quota unavailability is not mislabeled budget exhaustion. |
| REQ-LIMITS-02 / AC-LIMITS-02 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-02` — The user can distinguish provider quota, protocol failure, test failure, no progress, deadline and operator cancellation. |
| REQ-LIMITS-03 / AC-LIMITS-03 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-03` — Duplicate timer delivery cannot create a second run; missed and skipped occurrences remain visible. |
| REQ-LIMITS-04 / AC-LIMITS-04 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-04` — A manual and scheduled request racing produce one owner and one explicit busy result. |
| REQ-LIMITS-05 / AC-LIMITS-05 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-05` — An empty opportunity set creates no patch/PR; a verified nightly run honours its original limits across restart. |
| REQ-LIMITS-06 / AC-LIMITS-06 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-06` — After an acknowledged pause/disable no new occurrence starts, including after restart; status distinguishes run cancellation from schedule state. |
| REQ-LIMITS-07 / AC-LIMITS-07 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-07` — A profile edit plus redelivery returns the original occurrence or a recorded stale/blocked result, never a second job. |
| REQ-LIMITS-08 / AC-LIMITS-08 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-08` — Revoked or undefined authority yields authority_revoked or authority_unresolved and no provider work. |
| REQ-LIMITS-09 / AC-LIMITS-09 | tests/contracts/improve-limits.test.js (planned: each reason and usage mode): case `LIMITS-09` — Controller/recovery tests can run before activation; enabling a schedule without recovery evidence is blocked; restart never extends the deadline. |

These case names and future test files are acceptance obligations, not tests claimed written or executed. 

### Relevant architectural decisions / dependency clarification
Reuse the current Improve contract, `templates/SPECIFICATION.md`, #177 routing and #179 ledger/report. New host/auth/storage decisions remain scoped preparation outputs, not implied ADR approval. #176 proves its initial application isolation/input boundary; #217 qualifies a hosted/durable worker around that boundary. #181 controller delivery precedes #182 minimum memory and #183 recovery; only **schedule activation** depends back on #183. #218 consumes those capabilities; #219 is the optional delivery/plugin wrapper. Broader #182/#183 ACs remain open until their own multi-cycle proof.

## Audit phase 3 — pre-flight result (not a passing status)

**Reviewed at:** 2026-10-22T07:10:32Z
**Scope:** combined ticket and comments; bounded planning review. **Result:** blocked for build-ready/compliance; valid thin backlog preparation.

- **P1: Schedule policy decisions remain open.** Resolve active-run handling on pause, ownership/delegation after creator revocation, and treatment of unrelated work while a PR is pending. Preserve the controller-versus-activation milestone separation.

**Lenses checked:** dependency order (controller/activation distinction above); shared state (repo leases, run ownership and operation identities); schema reality (existing contracts loaded, proposed interfaces explicitly unimplemented); timing (absolute deadline, persisted occurrences); partial failure (uncertain calls, artifact loss and delivery reconciliation). Cross-ticket concurrency was also checked at portfolio scope.

**Gate evidence:** live issue imported; `specflow-tier inspect` executed for `specflow-simulate`, `specflow-audit`, and `pre-flight-simulator`: each returned `status: planning`, `tier: thin`. This is not a passing production gate. No runtime tests, provider inference, native Duo review, readiness promotion or deployment were run. Per the user’s audit instruction, any P1 blocks compliance even where an older agent template calls it a warning.

**Executed preparation validation:** 10 checks, 0 failed, 0 skipped through `specflow-specification gate`. Checks cover requirement/AC mappings, review structure, dependency DAG, unchanged reused contracts and truthful status. They do not replace semantic pre-flight or runtime acceptance. Raw gate SHA-256: `59fb3d382298de83591554b550268bc4c91e19aebbcb4d3ae917ecd5e2f79e43`.


The preparation below supersedes the earlier unresolved design choices, not the original behaviour acceptance. Earlier runtime and compliance limitations remain historical evidence.
