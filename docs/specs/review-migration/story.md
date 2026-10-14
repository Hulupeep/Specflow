# REVIEW-MIGRATE — supported legacy review recovery (#199)

Supersedes #199's reset proposal and PR #200's initial implementation after #203.
Owner requested resolving and merging the remaining work. Preserve the same run;
never erase rounds or introduce a successor to evade limits.

## Scope and acceptance
- [ ] MIG-1: An explicitly owner-authorized migration with a reason and current diagnosis evidence selects the current runtime for a recorded legacy run, preserving its old runtime bytes and exact pre-migration run.json in a separate archive. Existing current-policy, ceased, completed, unknown-runtime and pending-review runs refuse migration.
- [ ] MIG-2: Wrong owner, changed acceptance, active run/installer/scoped lock, bad evidence or corrupt runtime refuses without changing authoritative run/scoped state. A failed pre-commit write leaves the old runtime selected. Retries never erase prior archives.
- [ ] MIG-3: Keep every raw round, finding, instruction, owner binding, indexed definition, legacy counter and scoped journal. Initialize the new controller conservatively from actual historical calls and validated progress; invalid/unknown outcomes cannot earn acceptance. No limit reset, new run, inferred refund or product acceptance.
- [ ] MIG-4: Fresh capture and independent review are required after migration; old verified criteria and continuation cannot finish the run. Further guards use #203's evidenced bounded recovery. Repeated migration refuses. CLI status/resume dispatch to the selected immutable runtime.

## Decisions
Command: `duo-build migrate-review RUN --session TOKEN --input FILE`.
Input: `{ownerAuthorized:true, reason, evidence:[{path,sha256}]}`. The flag records
actual owner authorization; it is not authentication. Cooperative session fencing
remains the trust boundary. This command explicitly selects a new runtime; the
installer still cannot modify an active run or its preserved runtime bytes.
Only recorded legacy runs lacking reviewControl qualify. Unknown formats fail
closed. No database/UI surface, no new provider, no network mutation during migration.

## Gherkin
```gherkin
Feature: Recover a legacy review without losing its history
  Scenario: Authorized owner adopts the current policy
    Given a blocked legacy run with intact runtime and diagnosis evidence
    When its owner explicitly migrates it
    Then the same run uses the new immutable runtime and retains its history
    And it cannot finish before fresh independent acceptance
  Scenario: Interrupted or repeated migration
    Given a failed pre-commit migration or an already migrated run
    When the owner retries
    Then the failed migration keeps the old state authoritative
    And an already migrated run cannot reset its controller
  Scenario: Concurrent review or wrong owner
    Given an active review or a different owner session
    When migration is requested
    Then it refuses without changing the run or scoped journal
```

## Definition of Done
Failing-first migration regression; real temporary Git/filesystem and CLI
coverage; canonical tests pass; independent read-only Claude review; privacy
scan before publication. Fixtures simulate model transport only.

## Simulation Findings (proposed)
2026-10-14T08:28:17Z. Applied under the owner's request to resolve the issue.
- Returning operator: migrate -> capture -> review succeeds; stale diagnosis -> refuse. MIG-1/2 cover evidence hashes, and MIG-4 requires fresh acceptance.
- Collaborator: own token -> migration; another session or active peer -> refuse. MIG-2 covers both operation and specification locks, not just an environment flag.
- Interrupted operator: complete staging -> commit state; disk failure -> old state remains selected. MIG-2 requires unique archives and a single authoritative state commit.
- Repeat operator: adopt once -> bounded diagnosis; repeated migration -> refuse. MIG-3/4 preserve counts, findings and previous achievements rather than awarding the same progress again.
Open product questions: none; this is explicit migration, not a general journal reset.

## Audit phase 1 — gap analysis
Bug/workflow repair. PRESENT: issue/scope, observable requirements, personas,
Gherkin, DoD and negative routes. MISSING: explicit contract/test mapping.
N/A: SQL/RLS, frontend interface, testids and Playwright (CLI-only).

## Audit phase 2 — surgical uplift
- Existing JSON state remains readable; add selected runtime directory and migration event/archive reference, no deletion or mutation of historical review records.
- Reuse I-DUOACT-001/002/003 and I-DUOOPS-001/002/003: old bytes retained, installer unchanged, ownership and independent evidence preserved.
- Tests: tests/scripts/duo-review-migration.test.js maps MIG-1..4 to archive integrity, owner/locks, failure injection, controller replay and real CLI dispatch. Existing runtime-pinning and review-continuation suites retain current-run controls.
- Architecture: existing runtime pinning, atomic run.json rename and operation locks; no new service. This is an explicit migration capability, not implicit installation.

## Pre-flight Findings
simulation_status: passed
Scope: #199 replacement design only, not implementation acceptance.
CRITICAL: None. P1: None. P2: None.
