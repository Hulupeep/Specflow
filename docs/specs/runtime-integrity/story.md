Parent: #176 · Story: IMPROVE-RUNTIME-REPAIR · Type: bounded integrity bug repair after #221.

## Outcome
A verified runtime cannot change its consumed generated inputs while retaining KEEP authority, and output cleanup cannot escape its worktree. Declaring generated outputs must not require an undocumented .gitignore edit.

## Scope
Repair output validation, generated-input binding and Git staging in the existing Improve primitive. Reuse #221 streaming hashing and explicit resource bounds.

Not in scope: general sandbox hosting, production deployment, unrelated #176 isolation/durable-service acceptance, or new database/UI behaviour.

## Requirements and acceptance
- [ ] FIX-1: Reject output paths with any symlink ancestor, unsafe component, tracked input or escaping destination before deletion. A fixture outside the worktree must survive every rejected cleanup.
- [ ] FIX-2: Regenerated outputs (`runtime.identity.disposable_outputs`) are wiped before setup and then included in the sealed identity used before/after deciding checks and at evaluate/finalize. A consumed generated file changed during verification or after verification prevents KEEP.
- [ ] FIX-3: Introduce explicit `runtime.identity.mutable_outputs` for non-consumed logs/reports/caches only. They may churn, must be wiped/validated, must never contain the executable application/dependencies/check inputs, and cannot overlap the allowed product-edit scope. Contracts must classify generated runtime code as sealed; uncertain classification blocks acceptance. Mutable children may be scoped below a sealed build directory without hiding its other contents.
- [ ] FIX-4: Generated and mutable output paths are excluded from Git staging/retention independently of .gitignore. Existing tracked files under an output remain an error; product bytes actually tested are still the bytes retained.
- [ ] FIX-5: Preserve fail-closed bounds, dependency hashing, independent oracle/evaluator, frozen acceptance, holdout single-use, matched gain, regression veto, ledger integrity, untouched protected base, and legacy non-authoritative receipt handling.
- [ ] FIX-6: Add failing-first regression tests for ancestor deletion, generated-input mutation during/after verification, unignored generated output and scoped mutable churn; execute focused and full canonical tests. Update runtime-identity guidance, then independent review with no open material findings before merge.

## Verification
- Existing `tests/contracts/improve-core.test.js` owns real Git/worktree and verification subprocess lifecycle coverage; provider transports remain explicit protocol doubles.
- No database or frontend schema change; no Playwright/testids apply to this CLI repair. #180 owns real browser/backend proof.
- Preserve `docs/contracts/feature_improve_core.yml` I-IMPROVE-001 through 013. No override requested.

## Owner-authorised work
The owner instructed this session to implement/review/merge the repair, complete #180, then implement #216/#217 as a continuous goal, using inferred judgment for decisions. That grants the requested repair PR/merge but no production release or trust-contract weakening.
