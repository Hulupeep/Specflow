# IMPROVE-GAIN: KEEP requires a demonstrated gain

Scoped bug repair under #174/#178, parent #171; follows #194's reproduced Q3 and merged #201 binding repair. This is direct bounded work using simulation, audit, failing-first lifecycle tests and independent review, not a new autonomous feature-build loop or promotion of the parent backlog.

## Outcome and scope
An operator can distinguish an improvement from preservation. In scope: frozen binary gain declarations, separate practice/holdout baseline expectations, matched evidence, required gates and decision/report output. Existing boolean checks remain the oracle; no new model role.

Not in scope: numeric/statistical gain thresholds, automatic contract rewriting, real-backend proof (#180), OS isolation (#176), repetition/learning/resume (#181–183). No database, UI or deployment changes.

## Requirements and acceptance
- [ ] GAIN-1 (MUST): New frozen contracts declare `intent: gain | preservation` for executable acceptance. At least one mandatory level-1/2 criterion is a gain with holdout baseline expectation `fail`; preservation has expectation `pass`. A malformed or preservation-only new contract is rejected before building. Optional or model-only gains cannot confer KEEP authority.
- [ ] GAIN-2 (MUST): `baseline_expectation` applies to the holdout; an executable practice check declares its own `dev_baseline_expectation: fail | pass | n/a`. Mismatches identify the set and criterion and block ordinary build admission. Practices never decide. A criterion can preserve holdout behaviour while improving practice behaviour, provided another mandatory holdout criterion proves the intended gain.
- [ ] GAIN-3 (MUST): Every declared mandatory gain needs exactly one qualifying baseline-fail and after-pass from the selected bound receipts, for the same criterion, governing contract, frozen oracle and verifier identity. Missing, ambiguous, mismatched or unavailable gain produces INCONCLUSIVE absent an existing stronger REVERT. Preservation pass-to-pass, practice, an optional gain and model praise cannot replace it.
- [ ] GAIN-4 (MUST): Any required gate failing after implementation causes REVERT, including a pre-existing failure. Unavailable/missing gates prevent KEEP. Keep existing regression, peer-veto, dispute, scope, binding, single-use holdout and retention protections.
- [ ] GAIN-5 (MUST): Decisions/reports show the declared gains, paired evidence IDs/outcomes and why a gain was not established. A true gain with passing preservation and gates retains the exact tested tree. Historical records stay readable and unchanged; legacy contracts without explicit gains cannot acquire new KEEP authority. Never rewrite a frozen contract or rerun a consumed holdout to retrofit the declaration.

## Gherkin
```gherkin
Feature: Retain only a demonstrated improvement
  Scenario: A measured gain with preservation
    Given a frozen mandatory gain fails at baseline and a preservation criterion passes
    When the matching holdout verifies both as passing on the candidate
    And every gate and existing safety check passes
    Then KEEP records the paired gain evidence and retains the tested tree
  Scenario: Preservation is mistaken for improvement
    Given a contract declares only preservation or an optional gain
    When the operator freezes the contract
    Then it is rejected with a missing mandatory gain reason
  Scenario: An old contract has no explicit gain
    Given a legacy frozen contract and all its checks pass
    When the operator evaluates an unfinished run
    Then the decision cannot be KEEP
    And historical evidence and the consumed holdout remain unchanged
  Scenario: Practice and holdout have different baseline expectations
    Given practice expects fail and holdout preservation expects pass
    When either set contradicts its own expectation
    Then baseline admission is blocked with the set and criterion named
  Scenario: A different environment explains the apparent gain
    Given baseline and after receipts were captured under different verifier identities
    When a declared gain appears to change from fail to pass
    Then the decision is INCONCLUSIVE and explains the mismatch
  Scenario: A pre-existing required gate remains broken
    Given a real gain and a gate that fails before and after
    When evaluation completes
    Then the decision is REVERT despite the peer recommending KEEP
```

## Definition of Done
Failing-first tests demonstrate Q3 and gate/baseline defects before source changes. Real Git worktrees and check subprocesses exercise lifecycle retention; model transports in tests are explicit fixture doubles. Focused and full canonical tests pass with zero skips; independent read-only review has no unresolved blockers. Sanitized evidence and issue updates distinguish this repair from completion of #174/#178 or real-backend validation.
