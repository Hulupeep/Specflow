# Improve child acceptance reconciliation (#173–#176)

Audited 2026-10-31 against runtime `c2ed6843995b4314c4f645017fc57ad0d1b129bf`.
This reconciles the child requirements with executed evidence. It does not close
the fresh installed-release requirement in #171 or the repeated-mode proof in #172.

The exact reviewed source merged by #305 passed [canonical CI](https://github.com/Hulupeep/Specflow/actions/runs/41202928917):
3,375 tests, 167 suites, zero failures or skips. Test assertions were inspected;
test names alone are not the basis of the mapping below.

## Mission and selection — #173

| Criterion | Evidence |
|---|---|
| AC-01-1: mission, starting state, sources | The retained Today-draft run records its mission and immutable product `428f73b7d0021c74cb03c149497f1e9da0b3f30b`; its candidate sources include the product issue and real reproduction. |
| AC-01-2: observation versus hypothesis and impact | The selected candidate records observed failed-save draft loss at 1280/360 and the resulting retyping. False-empty and modal concerns are explicitly source-only hypotheses. Production frequency remains unknown. |
| AC-01-3: selection rationale | The recorded selection ranks directly reproduced context loss above weaker source-only concerns, with explicit evaluability, risk, cost and reversibility fields and reasons for both alternatives. |
| AC-01-4: preserve unevaluable opportunities | Both alternatives remain opportunities. `improve-core.test.js` additionally rejects silently discarding high-value unevaluable work. |
| AC-01-5: one bounded candidate | The frozen contract targets draft retention, pending input and preservation of creation behavior, excluding navigation persistence, redesign, schema changes and production actions. |

The core candidate tests also reject gratuitous redesign, novelty-only claims and
selection without a reason for every alternative. These are negative fixtures,
not claims of real customer research.

## Contract and evidence strength — #174

| Criterion | Evidence |
|---|---|
| AC-02-1: contract and baseline before build | Core tests reject build without a frozen contract. The real run froze v1 before implementation and executed baseline gain and preservation checks. An explicit baseline blocker cannot produce KEEP. |
| AC-02-2: acceptance cannot be weakened after building | Tests reject late oracle replacement and a weakened contract; the original failed change remains REVERT. Superseded versions cannot reuse an old baseline. |
| AC-02-3: criterion, level and source | Bound phase receipts and the decision-selected evidence retain criterion IDs, evidence levels, artifact references and input identities. #305 adds native judgment origin, verified-patch binding and output integrity. |
| AC-02-4: judgment cannot fill missing execution | Tests submit level 3/4 supporting evidence against missing deterministic evidence and require INCONCLUSIVE. Builder self-review is not deciding evidence. |
| AC-02-5: bounded contract | The actual Today-draft v1 has four mandatory criteria and explicit non-goals; unrelated opportunities remain outside its scope. |

## Restrained UX — #175

| Criterion | Evidence |
|---|---|
| AC-03-1: inspect the journey | `templates/improve/UX_REFINEMENT_PROFILE.md` covers intent, repeated input, information timing, recovery, mobile and accessibility. The real critique and UX evaluation apply it to failed-save recovery and pending focus. |
| AC-03-2: observable consequence | Actual input loss and required retyping establish the problem. Candidate tests reject aesthetic novelty and redesign as sufficient grounds for selection. |
| AC-03-3: preserve unrelated behavior | The frozen contract explicitly preserves navigation, layout and ordinary creation; preservation journeys and 27 existing unit/contract cases passed. |
| AC-03-4: removal is valid improvement | The profile explicitly prefers removal of steps/UI where useful. The observed gain removes retyping rather than adding a new feature; no code-churn or visual novelty score grants KEEP. |
| AC-03-5: runtime verification | Actual isolated browser/Auth/API/Postgres evidence: deciding acceptance 6/6, separately executed public journey 12/12, at desktop and mobile widths; independent UX judgment is supporting evidence. |

## Isolation and side effects — #176

| Criterion | Evidence |
|---|---|
| AC-04-1: protected base | Core tests verify KEEP retains a separate identifiable commit with the base untouched, and revert out-of-scope changes. The real product retained tree was delivered separately in product PR #232. |
| AC-04-2: block prohibited effects | Core tests reject prohibited commands before execution and record the blocker. Managed-worker boundary tests cover authority, path and artifact escapes; live qualification uses confined workers and tool-free native model roles. This is not a claim that keyword filtering alone is a sandbox. |
| AC-04-3: identifiable retain/revert | The real retained commit and exact delivery tree are recorded below. Persisted KEEP/REVERT/INCONCLUSIVE reconstruction is separately documented by #306, with simulated-provider cases labelled as fixtures. |
| AC-04-4: interruption is not success | The actual controller-loss qualification removed all nine owned resources while preserving a foreign control; it leaves an `operator_required` fence and no success receipt. Worker persistence/lost-ack qualification preserves uncertainty and recovers the same durable manifest. |
| AC-04-5: release/merge authority | No product production deployment or automatic product merge is claimed. Pending review and owner baseline acceptance remain enforced; autonomous baseline advancement is not implied by KEEP. |

Supporting artifacts: [worker qualification](../docs/specs/improve-worker/RESULTS.md),
[backend qualification and controller loss](backend-profile-298/RESULTS.md),
[native review evidence](review-evidence-304/proof.json), and
`tests/contracts/improve-core.test.js`, `tests/contracts/improve-worker.test.js`,
`tests/integration/improve-worker.test.js` and the recovery suites.
Each historical qualification retains its source pin and scope; these records do
not assert that every historical native run executed the latest runtime bytes.

## Actual product result and remaining work

[Product PR #232](https://github.com/Hulupeep/tabstax-webapps/pull/232) delivers
the verified tree `138f5a146be42249af2fa91c0dd0bd57f998ab48`; its originating retained
commit is `6ebc4e8d8ba3f08b710cd9d4ad92af9c6d99d3e3`. The
[completion audit](https://github.com/Hulupeep/tabstax-webapps/issues/231#issuecomment-6543007509)
records the actual product proof and limitations. The original run used runtime
`30efb4b`; its UX transport workaround preceded the canonical #304 repair. Its
holdout was not replayed or relabelled as a new-runtime run.

Known mobile overflow, terse error copy, lack of an explicit pending cue and
navigation persistence remain outside that contract. There is no measured
adoption or revenue result. Model independence was same-vendor, not cross-family
Duo; subscription usage estimates are not invoices.

The child requirements above have evidence, but #171 remains open for outstanding
#177 provenance and a distinct installed release. #172 still needs a real bounded
multi-cycle run whose later work consumes earlier evidence. Public npm 0.12.0
predates the current runtime. Neither this audit nor fixture reconstruction
substitutes for those remaining deliverables.
