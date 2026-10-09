## DUO-BUILD-01 — Interactive build with automatic peer review

Standalone feature requested by the user; related: #54 (advisory review), #94 (minimal harness).

## Personas and scope
Builder: invoke one native workflow with an issue, feature description or saved run ID; remain interactive and receive peer findings directly.
Reviewer: independently inspect the exact snapshot and raw evidence, return findings without editing or delegating.
Returning user: resume with the same objective, acceptance and review history.

In scope: native Claude Code/Codex skill, cross-CLI helper, shared goal, bounded run objective/finish, snapshots including uncommitted changes, structured review, durable resume and concise documentation.
Out of scope: orchestration service, replacing spec-build/feature-build machinery, automatic merge/deployment, unrelated redesign.

## Requirements
- REQ-01 MUST expose duo-build <issue-or-feature> and resume through both runtimes' native skill conventions. Reuse spec-build preparation for ideas and feature-build implementation for ready tickets.
- REQ-02 MUST share goal.md, repository instructions and acceptance. Reuse mission/contracts; pin the bounded objective and finish. For Timebreez: accurate explainable entitlements/balances across arrangements/jurisdictions, traced to rules, facts, calculations and transactions; explicitly distinguish supported behaviour from ambition and unknowns.
- REQ-03 MUST keep the interactive builder in charge: Codex calls claude -p; Claude Code calls codex exec. Check installation/auth/permission. Peer unavailable means blocked, never verified.
- REQ-04 MUST review coherent batches against an exact frozen snapshot including uncommitted changes, relevant diff/history and raw evidence. Reviewer reads artifacts independently; builder pauses edits. Return accepted, changes_required or blocked.
- REQ-05 MUST preserve findings/resolution evidence across repairs and resume; stop after at most three repair rounds per batch, or no new evidence/progress.
- REQ-06 MUST check direction and correctness, customer-visible values, required executed tests (skips/absences fail), distinguish facts/hypotheses/causes and implemented/tested/merged/deployed/customer-validated. Check fixture/environment/auth before product blame. Blocking findings cite acceptance, gate or concrete material risk. Record unrelated improvements separately. Preserve permissions, contracts and release gates.
- REQ-07 MUST verify both CLI directions, missing evidence, recursive review prevention and demonstrate a real correction/re-review cycle, labelling simulations/unavailable capabilities accurately.

## Acceptance criteria
- [ ] AC-1: One native invocation routes an issue or idea and resumes a saved run without message copying.
- [ ] AC-2: Both agents see identical pinned goal/task references; acceptance cannot silently weaken.
- [ ] AC-3: Real peer output flows back to the builder with durable request, snapshot, stdout/stderr and findings; missing peer or evidence yields blocked.
- [ ] AC-4: Changed snapshots cannot receive stale acceptance; recursive duo review is rejected; reviewer cannot edit product files.
- [ ] AC-5: Findings persist through correction/re-review and resume. Three repair rounds maximum; unchanged failed input stops.
- [ ] AC-6: Acceptance stays scoped and does not imply passing release gates or deployment. Status says outcome advanced, blocker, next action.
- [ ] AC-7: Automated negative-path/direction checks and a real CLI correction/re-review demonstration are recorded honestly.

## Gherkin scenarios
```gherkin
Feature: Interactive duo build
 Scenario: Repair from independent evidence
  Given a ready task and an interactive Codex builder
  When a meaningful implementation batch is reviewed by Claude
  Then actionable findings return directly and remain in run history
  When the builder fixes the findings and submits updated raw evidence
  Then a fresh review can accept that scope
 Scenario: Missing or stale evidence
  Given a batch without raw execution evidence or a changed reviewed tree
  When review is requested
  Then the outcome is blocked rather than duo-verified
 Scenario: Returning Claude builder
  Given a saved run with findings and pinned acceptance
  When Claude resumes and requests review
  Then codex exec reviews the current snapshot and previous findings
 Scenario: Recursive reviewer
  Given a peer reviewer environment
  When it attempts duo-build
  Then the helper rejects the call before invoking a CLI
```

## Definition of Done
- [ ] Runner and native skill shipped by existing installers.
- [ ] Meaningful automated tests pass, including errors and both command directions.
- [ ] Live build/review/correction/re-review artifacts are readable, with any unavailable direction stated.
- [ ] Exact install/invoke/resume instructions are documented.
