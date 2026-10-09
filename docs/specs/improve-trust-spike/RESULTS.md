# #194 research result — 2026-10-09

**Recommendation: bind evidence to the exact tested workspace and governing contract first; then add explicit gain semantics before enabling autonomous KEEP/repeat loops.** All three concerns reproduced against production lifecycle code. This report completes bounded research, not either fix or production readiness.

The original spike and accepted preparation packet remain unchanged. This report supersedes their Q1/Q2 source-only and Q3 function-only availability statements. Source commit: `9af73701c4b74597bc8d53a714042bd088460ea9`. Production `scripts/specflow-improve.cjs` SHA-256: `0baa368cc0aa1afbb9859b1a83ccab4217adaac02408516857c53f36f6f9f9d8`.

## Observations, not inferred implementation success

| Question/control | Actual result | Disposition |
|---|---|---|
| Q1: mutate steps 2 → 9 after verify, before evaluate | KEEP; finalize exit 0; retained commit contains steps 9, which the holdout would reject | Reproduced unsupported retained code |
| Q1 unchanged control | KEEP; retained steps 2; tested/evaluated/final hashes match | Expected positive control |
| Q1 mutate after evaluate | Decision KEEP; finalize exit 2; no retained commit | Existing later mutation protection works |
| Q2: successful v1 baseline, freeze contradictory v2, no new baseline | Build starts with governing version 2 and no accepted blocker | Reproduced stale baseline admission; not a claim of final KEEP |
| Q2: explicitly run contradictory v2 baseline | Baseline returns `baseline_blocked`; build still starts, no accepted blocker | Reproduced failed fresh baseline masked by historical success |
| Q2: matching fresh v2 baseline | Baseline recorded; build starts normally | Expected positive control |
| Q3: preservation pass → pass; unrelated metadata-only change | KEEP; finalize exit 0; branch retained | Reproduced absence of a gain requirement |
| Q3 gain control | Mandatory acceptance fail → pass; KEEP and retained branch | Expected positive control |
| Q3 failed-acceptance control | Mandatory acceptance fail → fail; REVERT, no branch retained | Expected failure veto; this is not a pass → fail regression |
| Q3 actual regression control | Acceptance fail → pass, navigation gate pass → fail; REVERT, no retained branch | Expected regression veto despite gain and peer keep |

The initial preservation scenario was **unavailable**: it attempted oracle authoring after contract freeze. Its error remains in `research/first.json` (experiment exit 2). The only retry moved oracle authoring before the first freeze in a new disposable fixture. It ran only preservation, succeeded, and did not consume an earlier holdout again. The additional navigation regression control is a distinct scenario, not a replay of the completed failed-acceptance control. Ten distinct scenarios, eleven attempts including the one prerequisite repair; experiment timestamps 18:59–19:03 UTC, within the 90-minute bound.

## Evidence and limits

Canonical raw material is under `evidence/improve-trust-spike/research/`. `manifest.json` binds byte-identical helper receipts, plans, historical probe versions, execution argv/output, permission record and issue snapshot. Each receipt retains its real isolation probe, command result, productionAccepted=false, and source hashes; stdout includes per-scenario lifecycle calls, decision JSON and ledger events. `first.json` deliberately remains failed. The final runnable harness is `lifecycle-probe.cjs`, invoked through `sandbox.cjs`; archived `*-probe.cjs` files preserve executed bytes, not standalone runnable locations. `verify-research.cjs` checks archive integrity and recorded observations without rerunning experiments.

Bubblewrap actually denied writes to the mounted public source kit, hid host checkout/home, permitted writes to the disposable fixture, and supplied a separate network namespace. Source kit and runtime were read-only; private host state and credentials were not mounted. This is evidence for those exercised boundaries, not a general adversarial sandbox certification. Git, worktrees, checks and baseline/verify/evaluate/finalize CLI subprocesses were real. Setup/build/critique used the existing test APIs and **fake model transports**. Fixture oracle identities do not prove independent authorship in production. No live model efficacy, backend, UI journey, deployment or customer validation is claimed. No production source or frozen existing contract changed.

## Mechanism inferred from source

- `verifyPhase` records contract version and check outcomes but no identity of the tested product snapshot. `evaluate` then associates those outcomes with the *current* diff. `finalize` checks only that evaluation's patch stayed unchanged. That explains the reproduced verify→evaluate gap; the evaluate→finalize guard must remain.
- `build` selects the last `baseline_recorded` event without requiring the governing version. A newer `baseline_blocked` does not supersede that older success. Admission must consider the latest attempt for the exact contract, not merely the latest successful event.
- `evaluateCriteria` qualifies after-results; `decide` requires mandatory satisfaction and no regression, but no positive delta. Source inspection and the preservation lifecycle jointly support the missing-gain diagnosis. No code change tested a proposed repair, so its adequacy remains a design recommendation.

## One first slice: bind lifecycle evidence

Use a small, versioned Improve verification receipt, borrowing Duo's source-before/source-after and stable-capture pattern. Do not reuse the whole Duo run protocol: Duo fingerprints its review checkout, while Improve tests baseline and candidate worktrees with single-use holdouts. Reusing its storage format blindly would bind the wrong tree or introduce another review controller. Reuse hashing utilities only after proving their input coverage; no new model role or sandbox service is needed.

A receipt should bind run/phase, immutable base commit, contract version **and content hash**, oracle/check artifact hashes, relevant verifier/runtime configuration, product input manifest, before/after product hashes, and raw result identities. Derive manifests outside builder-writable paths. Include tracked edits, staged/unstaged state, untracked allowed inputs, deletions, file modes and symlink targets; do not treat `git diff` alone as all tested input. Record allowlisted environment/configuration identities without secrets. An environment change or an unknown required identity cannot support KEEP.

Generated inputs must be declared and included when consumed. Put disposable logs/screenshots outside product-input identity; never blanket-ignore generated paths that can affect the result. Hash before and after execution and reject changes during checks. Prefer immutable test snapshots and finalize the exact verified tree/commit to avoid edit-and-restore races that two hashes alone cannot exclude. Snapshot creation must also detect concurrent writes. Compare the receipt again at evaluation and before retention; archive mismatches without silently retesting a used holdout.

For baseline admission, require a successful receipt for the exact governing contract and protected base. A newer failed/unavailable attempt cannot be hidden by a previous success. Preserve explicit accepted baseline-blocker behavior, but it must cap the result at INCONCLUSIVE. No builder override can produce KEEP.

Failure cases to specify in the implementation slice: stale baseline after supersession; newer failed baseline; altered checked file/check/config; mutation during verification; mutation between verify/evaluate/finalize; generated/untracked input; unchanged positive control; missing legacy identity. Retain regression, dispute, holdout-exposure, scope, independence and protected-base vetoes. Expected mismatch disposition: INCONCLUSIVE without retention (or an existing stronger REVERT reason), with durable evidence.

Dependencies: existing #174 contract/evidence semantics, #176 isolation, #178 decision rules; reuse the current oracle and append-only ledger. Proposed proof commands after implementing failing-first tests: `npm test -- --runInBand tests/contracts/improve-core.test.js`, then the repository's normal contract suite and a bounded isolated lifecycle reproduction. These repair tests have **not** been run because no repair is implemented here.

Rollout: version the receipt; preserve legacy journals and old decisions unchanged. Unbound unfinished runs may be inspected/exported but cannot acquire fresh KEEP authority. Restart with a new candidate/run and fresh evaluator-controlled holdout when necessary; never manufacture receipts from historical after-results or rerun an exposed holdout. Downstream repeat loops remain no-go until this slice **and gain semantics** have independent evidence. Binding alone would still admit the Q3 preservation-only KEEP.

## Gain decision and ranked follow-ups

1. **Explicit gain semantics next (#174/#178).** Freeze a declared gain target separately from mandatory preservation constraints before build. Compare matched baseline/after samples under the same contract/check/environment; require fail→pass for a designated binary gain or a predeclared meaningful numeric threshold with direction, sample aggregation and noise handling. Do not require every holdout sample to fail at baseline. Passing existing behaviors supports preservation only. Missing/unmatched/inconclusive gain caps at INCONCLUSIVE; regressions still REVERT; peer enthusiasm cannot rescue either. Numerical thresholds and statistical requirements remain domain decisions to settle in that slice, not invented here.
2. **Real backend journey coverage (#180).** Start when receipt/gain behavior is proved. Require an actual seeded backend and mission-level journey; fixture green cannot close the dogfood gap. The current spike provides no evidence that this gap is fixed.
3. **Discovery reuse (#182).** Carry evidenced recurring constraints through the existing discovery journal, with source identities and invalidation. Do not let an automatic lesson rewrite acceptance, holdouts or safety rules. Start after representative trusted cycles expose repeated misses.
4. **Whole-run stagnation/time/spend limits (#181).** Add bounded progress criteria over verified outcomes once outcomes are trustworthy. More iterations do not repair the scoring boundary.
5. **Crash-safe orchestration/resume (#183).** Build over persisted trusted receipts, budgets and side-effect boundaries after the prior primitives have execution evidence.

## Independent review provenance

The preparation run `1791224192444-3bbfc937` and its accepted PREP-1–4 result are preserved in the existing `duo-review-summary.json`; earlier protocol-rejected output never counted as acceptance. This research is a new, explicitly requested scope linked to that completed preparation, not a reset of an exhausted run. Research-result Duo acceptance is reported separately after actual review. No research finding silently promotes #174/#178 or authorizes their implementation.
