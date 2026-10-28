# How Specflow works

[Start with the product](../README.md) or [choose the work weight](should-i-use-specflow.md). Pattern contracts are useful, but they do not replace runtime verification of behavior.

## From intent to evidence

1. An owner or another agent supplies intent, boundaries and existing research. Reuse that work rather than starting discovery again by default.
2. The loop selector chooses the lightest checks that cover the change's risk. Work weight and thin/contracted/build-ready planning depth are separate.
3. For formal specification work, `spec-build` identifies the next justified slice, applicable contracts, failure routes and acceptance. Required simulation precedes audit and pre-flight; future siblings remain thin.
4. Promotion binds current scope, direct dependency capability and required evidence. A passing audit or label alone cannot authorize a build.
5. The maker proposes the slice-local verification contract. An independent verifier accepts or strengthens the checks and expected references before they govern execution.
6. The builder implements the selected slice. Accepted criteria and oracles do not move merely to make the build pass.
7. Required native checks exercise the actual built behavior. UI/server-state work uses the required real seeded backend path, with case-level execution accounting.
8. Correctness compares actual values against accepted independent expectations. Source provenance and record/version consistency are checked separately where applicable.
9. The gate consumes current owning evidence. Provider success, a saved report, a screenshot or a required skip cannot grant acceptance.
10. Findings, attempts, ownership, unknown cost and decisions survive in the run contract and ledger. Repeated non-progress calls for diagnosis; it is not a fictional subscription bill.
11. Existing privacy, permission, CI and release boundaries control publication and advancement. A human-authorized exception remains distinct from a pass.
12. Trace and the evidence packet explain the result. Integrated outcomes require [Gate D](gate-d.md); shipping and customer benefit still need their own proof.

## What a reviewer should receive

The selected issue and contract, exact revision and non-secret environment identity, commands and individual executed/failed/skipped results, oracle/provenance where applicable, current findings, gate state and explicit limitations. A model's reasoning transcript is not independent verification input.

Fresh same-host advisory review helps find defects. [Duo](duo-build.md) requests an explicit cross-family peer review. Neither substitutes for the owning mechanical checks. [Advisory review](advisory-review.md) preserves serious concerns at handoff instead of laundering an unavailable critic into a clean result.

## What the primitive checks can and cannot prove

| Evidence | Establishes | Does not establish |
|---|---|---|
| Source pattern contract | Declared patterns in scanned scope | Complete runtime behavior or security |
| Unit/contract execution | Mapped assertions on declared inputs | An unexecuted browser/backend journey |
| Native journey/checker | The bound cases actually exercised | Uncovered cases or customer value |
| Provenance | Source-to-output support | Independent numerical correctness by itself |
| Screenshot | Visible state | Persistence, authorization or a value-bearing result by itself |
| Report lint | Report structure | Integrated outcome acceptance |

## Durable re-entry

Use the existing run contract and ledger; do not start a renamed run to reset findings or limits. [Progressive specification](../templates/SPECIFICATION.md) describes freshness, discoveries, scoped review and promotion. [The reference](reference.md) lists runner commands. Missing required input or adapter support is an explicit nonpassing capability gap.
