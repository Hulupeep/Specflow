# IMPROVE-BIND: bind lifecycle evidence to tested inputs

Bug repair following #194 / #198; parent #171; narrows freshness work within #174/#178. Owner selected this reviewed first slice with “continue with bind”. No permission or contract exception requested.

## Outcome and scope
A KEEP must refer to the code and governing contract actually verified. A baseline from another contract, or one superseded by a failed attempt, cannot admit implementation. In scope: baseline/build/verify/evaluate/finalize and durable receipts. Out of scope: gain semantics (#178), backend journeys (#180), autonomous repetition/learning/resume (#181–183). Those tickets remain open.

## Requirements and acceptance
- [ ] BIND-1: Build requires the latest successful baseline attempt for the governing contract version/hash and recorded base, with intact evidence. A new version, newer failure/unavailable attempt or missing legacy binding cannot reuse old success. An explicitly accepted current baseline blocker still caps the decision at INCONCLUSIVE.
- [ ] BIND-2: Verification binds outcomes to run, phase, contract/check hashes, base, effective verifier configuration and tested product inputs. Inputs cover tracked, untracked, ignored/generated files, deletions, modes and symlink targets. No secrets are emitted in identity metadata.
- [ ] BIND-3: Input mutation during verification (including edit-and-restore), after verification, or after evaluation cannot retain a KEEP patch. A mismatch or unavailable identity produces INCONCLUSIVE or a stronger existing REVERT/refusal, with an explicit reason. Final retention uses the exact verified Git tree, avoiding commit-hook changes to the accepted tree.
- [ ] BIND-4: New receipts are hash-bound to ledger entries and identify their exact evidence items. Missing, replaced, tampered or mixed-phase/version receipts/results cannot satisfy acceptance or gates. Unfinished legacy runs remain inspectable but cannot fabricate fresh KEEP authority; completed historical records remain readable.
- [ ] BIND-5: An unchanged valid candidate still reaches KEEP and retains its verified tree. Scope, protected-base, mandatory regression, evidence-strength, oracle-dispute, peer-veto and single-use holdout behavior remains enforced. Receipt failure cannot permit another consumed-holdout run.

## Implementation decisions
Reuse the existing Improve ledger, frozen contracts, verifier and Git worktrees. Add a small versioned receipt rather than importing Duo's checkout-specific review controller. Record full workspace content identity plus filesystem change tokens before/after checks; exclude only Git administration. Reject external/dangling symlinks, special files, unreadable/changing/oversized trees and Git content transformations that prevent matching verified bytes to retained blobs. This is conservative input binding, not a new hostile-process sandbox; #176 remains the isolation owner.

Runtime setup runs before the tested-input boundary. Every resulting generated input is covered; checks/servers that modify the product tree make evidence unavailable. Logs belong in the existing external evidence directory. Record hashes of the effective environment, runtime/check configuration, Node/verifier implementation and resolved check/gate executables; never record environment values. Unsupported/unresolved command identity fails closed. A same-user hostile process with control of the ledger/toolchain/kernel remains outside this change's OS trust boundary.

Use filesystem change tokens to detect transient edits within a verification interval, in addition to content hashes. At retention, use a verified Git tree and compare-and-swap the isolated branch from its checked parent; do not execute commit hooks on the accepted artifact. No push, base-ref mutation or deployment is added. Legacy after-results without a receipt yield INCONCLUSIVE and preserve evidence; no automatic holdout retry or inferred receipt. A failed prerequisite before consuming the holdout may be repaired and retried; mark holdout consumption before executing its first after-check.

## Gherkin
```gherkin
Feature: Keep only the verified change
  Scenario: Stable verified candidate
    Given a matching successful bound baseline and frozen contract
    When a valid candidate is verified, evaluated and finalized unchanged
    Then KEEP retains exactly the verified tree and leaves the base unchanged
  Scenario: Contract supersedes a successful baseline
    Given a successful baseline for contract v1
    When contract v2 is frozen and has no matching success or has a newer failed attempt
    Then build refuses historical success unless an explicit current blocker is accepted
    And that accepted blocker cannot produce KEEP
  Scenario: Verified code changes
    Given a passing single-use after verification
    When an input changes during verification or before evaluate or finalize
    Then no changed patch inherits the passing evidence
    And the consumed holdout cannot be rerun
  Scenario: Legacy or corrupted result
    Given missing binding or altered receipt or result content
    When the operator evaluates the run
    Then the result cannot be KEEP and the evidence remains available
```

## Definition of Done
- Failing-first regressions reproduce Q1/Q2, then pass after the repair with unchanged positive controls.
- Real temporary Git/worktrees and check subprocesses exercise the lifecycle; model transports are labelled fixture doubles.
- Focused Improve contract suite and all canonical tests pass; independent Duo acceptance passes; publication/privacy gates pass before delivery.
- No gain, backend, UI, provider independence or general OS-sandbox proof is claimed by this repair.
