# IMPROVE-BIND preparation (#201)

## Simulation Findings (proposed)

Scoped CLI/agent workflow; method: specflow-simulate, before audit. Four behavioral personas:

- **Repeat operator** (contract changes): v1 freeze → matching baseline → build/verify/finalize succeeds. Divergence: v2 changes expectations → old v1 success must not admit build; even a newly failed v2 baseline cannot fall back. BIND-1 covers both; current accepted blocker leads only to INCONCLUSIVE.
- **Returning operator** (legacy/interrupted): resume current bound results → unchanged candidate remains decidable. Divergence: old after evidence has no receipt, or process dies after first holdout check → fail closed and no re-exposure. BIND-4 and the pre-execution consumption decision cover this. No automatic migration of historical evidence.
- **Concurrent collaborator** (filesystem race): untouched tree → KEEP exact verified tree. Divergence: edit/restore while check runs, add ignored input, change mode/symlink, or mutate between evaluate/finalize → unavailable/refusal, no changed commit. BIND-2/3 cover these; Git metadata alone cannot identify tested bytes.
- **Runtime maintainer** (generated inputs): setup materializes dependencies/generated files → manifest covers them → read-only checks succeed. Divergence: server/check writes within the product tree, symlink points outside, executable cannot be resolved → explicit unavailable receipt; logs must go to evidence directory. Conservative compatibility cost is stated in implementation decisions, not hidden by broad exclusions.

Proposed additions: no missing required behavior after tracing these routes to BIND-1–5 and the implementation decisions. Optional P2: future tooling could report which generated input changed; human-readable mismatch categories suffice in this slice. No unresolved product question; choosing strict fail-closed identity preserves the owner's reviewed first-slice scope.

## Audit phase 1 — gap analysis

Type: bounded CLI bug repair, material trust/retention seam. PRESENT: parent/stable ID, scope/non-goals, BIND requirements/negative acceptance, decisions, Gherkin, DoD. Persona routes now present above. MISSING: explicit applicability, invariant/test/ADR mapping. No DB or UI surface; SQL, frontend types and data-testids would not be executable acceptance for this change.

## Audit phase 2 — surgical uplift

Supplement only; original story requirements unchanged.

- Data Contract: no DB/schema change. Existing on-disk contract/ledger/evidence JSON remains readable. New versioned verification receipt is internal CLI evidence, hash-bound to the existing append-only ledger; legacy absence cannot be upgraded into proof.
- Frontend Interface / data-testid / Playwright: N/A, no UI, browser or application behavior changes. CLI lifecycle tests are the executable journey.
- Invariants: reuse I-IMPROVE-001/002 (baseline/governing contract), 003 (evidence strength), 004 (secret/side-effect boundary), 005/006/007 (retention, terminality, ledger), 010/011/012 (oracle, single-use holdout, peer veto) in `docs/contracts/feature_improve_core.yml`. No existing invariant weakened or renumbered.
- Test mapping: BIND-1 → fresh-baseline, superseded-baseline, failed-latest-baseline, accepted-blocker controls; BIND-2 → ignored/untracked/mode/symlink/environment identity; BIND-3 → mutation-before-evaluate, mutation-during-check including restore, mutation-before-finalize, exact retained tree; BIND-4 → legacy/missing/tampered receipt and swapped output; BIND-5 → positive KEEP plus existing Improve regression/holdout/scope/veto tests. Add these to `tests/contracts/improve-core.test.js` and keep its real Git/check fixtures. New test expectations run red before source repair. Test doubles remain limited to model transports.
- Existing sources/dependencies: `scripts/specflow-improve.cjs`, runner Git/verifier primitives and their existing tests are present at main `bb5273d`; #174/#178 are broader tracking references, not unbuilt implementation dependencies. #194 provides research evidence, not readiness for this repair. No cross-repo dependency.
- ADRs: reuse `docs/PRD.md` trust boundary and the existing Improve contract; no new external platform, provider, UI or database architecture. Internal receipt decision is in the story and independently reviewed here.
- Implementation validation: focused Improve suite, full canonical `npm test -- --runInBand --roots tests`, actual lifecycle subprocess/retention assertions, independent Duo review, privacy gate. Test scope avoids private `.specflow` backup copies; no canonical tests omitted.

## Audit phase 3 — Pre-flight Findings

simulation_status: passed
scope: selected #201 binding slice only; implementation has not run
CRITICAL: None. Existing source/contracts resolve; no UI/SQL requirement applies; every acceptance row has a concrete positive and failure path.
P1: None. Receipt legacy handling, contract supersession, generated files, mutation/retention interval and holdout consumption are explicit.
P2: Optional per-path mismatch diagnostics; not required to reject unsafe evidence.

Preparation acceptance: each BIND behavior is deterministic enough to implement, mappings and failure cases cover it, privacy/retention/holdout rules remain intact. Passing this preflight does not establish an implemented fix; the mechanical planning check and live independent preparation review still precede promotion.

Audited at 2026-10-11T20:34:19.011Z. Contract load inventory retained in the preparation execution evidence.
