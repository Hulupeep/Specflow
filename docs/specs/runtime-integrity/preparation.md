# Scoped preparation: #222 runtime integrity repair

## Simulation Findings (proposed)
Three behavioural routes: a runtime maintainer builds/seals generated code, but an after-check mutation must revoke KEEP; a delegated builder supplies a path with a symlink ancestor, which must fail before any deletion; a returning operator verifies a previously unignored output, which must not become a staged product file. Happy paths are a sealed build with a passing gain, safe cleanup inside the owned workspace, and retention of only the tested source. Divergent routes include mid-check writes, post-evaluation writes, missing output parents and mutable reports below a build directory.

Proposed additions are accepted within the owner's explicit instruction to decide/proceed: generated runtime inputs are sealed by default; only explicitly classified non-consumed logs/reports/caches may be mutable. The independent oracle/contract author must not classify executable application, dependencies or verification inputs as mutable. For Next.js this implies production build/start for a sealed build, not treating the entire dev compilation directory as an unhashed cache. No unresolved product decision in this bounded repair; OS isolation and service durability remain #176/#217 scope.

## Audit phase 1 — gap analysis
PRESENT: parent/story, outcome, scope/non-goals, FIX-1 through FIX-6 behaviour acceptance, real failing-first regressions, existing invariant references. MISSING before this supplement: exact boundary interface, Gherkin, test mapping, explicit UI/DB applicability and architectural disposition. No database/RPC or graphical UI is changed; SQL/RLS, data-testids and a Playwright journey are N/A for this repair. #180 separately owns the actual application/browser proof.

## Audit phase 2 — surgical uplift
Data interface (the implementation remains JavaScript):
```typescript
interface RuntimeIdentity {
  max_bytes?: number; max_entries?: number;
  disposable_outputs?: string[]; // regenerated before setup, sealed after setup
  mutable_outputs?: string[]; // explicitly non-consumed logs/reports/caches
}
interface BindingOptions {
  outputs?: string[]; mutableOutputs?: string[];
  limits?: {max_bytes?: number; max_entries?: number};
}
```
All paths must be safe workspace-relative literals, with no symlink component and no tracked file. Within each class outputs are unique and disjoint. A mutable child may sit inside a sealed generated directory; a mutable ancestor cannot hide a sealed output. Changing generated content during verification, evaluation or retention is rejected. Mutable file contents can churn but their declared location/classification stays frozen. Resource bounds cover sealed source, dependencies and generated inputs. All output paths are excluded from Git staging; unrelated source paths remain staged and bound exactly as before.

Architecture: preserve the existing streaming hash, worktree, verifier, contract, oracle and ledger implementation. The repair extends the existing identity options; no second trust engine, new service or sandbox is introduced. Existing contracts lacking outputs remain unchanged. Existing contracts treating a consumed build directory as disposable now seal it rather than silently retain weakened identity. Unfinished historical receipts from a different verifier implementation cannot acquire fresh authority.

Invariants: reuse `docs/contracts/feature_improve_core.yml` I-IMPROVE-001 through 013, especially binding/retention, single-use holdout and demonstrated gain. No invariant additions or overrides.

```gherkin
Feature: Runtime output integrity
  Scenario: Seal regenerated application inputs
    Given setup generates the application used by the frozen checks
    When baseline and candidate checks run without consumed-input mutation
    Then a matching gain and preservation evidence may authorise KEEP
    And generated files are not retained as product source
  Scenario: Prevent escaping cleanup
    Given an output path has a symlink ancestor pointing outside the worktree
    When verification prepares its output directory
    Then cleanup rejects the path before deleting any external file
  Scenario: Revoke changed generated-input evidence
    Given a passing candidate receipt consumes a generated input
    When that input changes during verification or before evaluate/finalize
    Then the change prevents KEEP or retention of the stale result
  Scenario: Permit explicitly non-consumed report churn
    Given a frozen contract identifies a mutable report below a sealed build
    When checks write the report without changing the consumed build
    Then binding remains valid and the report is excluded from product retention
```

Test mapping: FIX-1 → ancestor symlink and missing-parent regression; FIX-2 → during-check, after-verification and after-evaluation mutation controls; FIX-3 → mutable report churn, class overlap and change-scope validation; FIX-4 → unignored generated output retained-tree assertion; FIX-5 → existing complete Improve trust suite; FIX-6 → failing-first evidence, focused/full execution, docs and native independent review. All checks are in `tests/contracts/improve-core.test.js`. Model transports in lifecycle fixtures remain explicit doubles; real Git and check subprocesses test the integrity boundary.

DoD: these regressions fail on #221, pass after repair, full canonical tests and contract suite pass with zero required skips, native independent peer review has no material findings, and the authorised corrective PR is merged with evidence. No claim of OS sandbox, #180 proof or #176 closure follows from this repair.

## Audit phase 3 — scoped Pre-flight Findings
simulation_status: passed
scope: #222 bounded CLI repair specification only; not #176 parent acceptance or implementation success.
CRITICAL: None. P1: None. The earlier unresolved general runtime-ABI/isolation decisions are not weakened or claimed fixed; the selected change seals regenerated bytes in the existing identity and confines cleanup. Mutable paths require independent contract classification and cannot serve as hidden consumed inputs.
P2: No generic dependency scanner can prove a repository never reads an alleged log/cache; classification remains a frozen, independently reviewed contract responsibility. The later worker isolation ticket must still enforce the actual execution boundary.

Applicable decisions, source/test mappings and failure outcomes are explicit. Native preparation review and current mechanical gate evidence still precede readiness promotion. Timestamps, native model identity and actual results are recorded in the run journal; this document does not assert tests passed before implementation.

## Preparation acceptance
- PREP-SCOPE: The selected repair outcome, non-goals and data/UI applicability are explicit and preserve parent #176 scope.
- PREP-BOUNDARY: Path safety, generated versus mutable inputs, Git retention and before/after integrity semantics have deterministic definitions and negative routes.
- PREP-MAPPING: FIX-1 through FIX-6 map to executable regression/preservation obligations with honest failing-first limitations.
- PREP-GATE: The required preparation mapping gate executed with no failures or skips; this does not claim the unbuilt implementation passes.
