# Authoritative delivery acceptance index
#138–142, exact acceptance text fetched after the PRD reconciliation. Prefixes disambiguate ticket-local IDs; original IDs and issue links are retained.


## [SPECFLOW] TSAFE-EPIC: evidence-grounded advice for Specflow builds
https://github.com/Hulupeep/Specflow/issues/138
AC-138-EPIC-1 (AC-EPIC-1): All four child stories deliver their specified local behaviour and executable evidence.
AC-138-EPIC-2 (AC-EPIC-2): Both interactive host directions preserve one builder, an independent peer and one shared goal, with no manual message copying.
AC-138-EPIC-3 (AC-EPIC-3): TypeSafe judgments never bypass required tests, source freshness, permissions, finding closure or release gates; unavailable service is explicit.
AC-138-EPIC-4 (AC-EPIC-4): Labelled held-out evaluations and live build → review → correction → re-review evidence are recorded, including limits and simulated boundaries.
AC-138-EPIC-5 (AC-EPIC-5): A fresh final combined-tree run verifies all child integration points and installation in both hosts; local tests, CI, merge, deployment and customer validation are separately reported.

## [SPECFLOW] TSAFE-CLIENT-01: bounded TypeSafe HTTP client and durable judgment records
https://github.com/Hulupeep/Specflow/issues/139
AC-139-CLIENT-1 (AC-CLIENT-1): A real synthetic call returns a typed result with model/version, hashes, usage and duration, without revealing credentials.
AC-139-CLIENT-2 (AC-CLIENT-2): The configured primary key takes precedence; alias-only configuration works; absent keys produce unavailable without sending a request.
AC-139-CLIENT-3 (AC-CLIENT-3): Timeout, 401/403, 429, 5xx, network failure, oversize input/response and malformed/extra/missing answers produce recorded reason codes with no success judgment and no silent retry.
AC-139-CLIENT-4 (AC-CLIENT-4): Changing state, snapshot, question set/version or pinned model invalidates replay. The response model string is retained verbatim; alias requests are visibly not pinned and only support labelled historical replay, never current-version verification. Exact pinned replay is labelled cached and sends no live request.
AC-139-CLIENT-5 (AC-CLIENT-5): A crash between pending and final persistence leaves an identifiable interrupted operation; restart cannot mistake it for completed evidence.
AC-139-CLIENT-6 (AC-CLIENT-6): The installed Specflow package contains the adapter and works with its documented Node version without uv, Python or typesafe-sdk.
AC-139-CLIENT-7 (AC-CLIENT-7): Two or more independent questions on the same bounded state cause exactly one provider request with the complete question set and recorded questionSetId/version; dependent follow-up or bounded-state partitioning is explicit and never silently omits a question.
AC-139-CLIENT-8 (AC-CLIENT-8): Invalid question definitions and detected credential material cause safe unavailable records without transmitting the material; stored failure records contain hashes and safe reasons, not rejected payloads.
AC-139-CLIENT-9 (AC-CLIENT-9): Evaluation under a changed model/question version is a new identifiable run, not a reuse of prior qualification.

## [SPECFLOW] TSAFE-EVAL-01: evaluate acceptance coverage and evidence-support judgments
https://github.com/Hulupeep/Specflow/issues/140
AC-140-EVAL-1 (AC-EVAL-1): Both question families return only their declared outcomes, with source identities and reproducible configuration.
AC-140-EVAL-2 (AC-EVAL-2): At least 50 labelled cases and a non-overlapping 30+/20+ development/held-out split exist; related paraphrases cannot cross the split.
AC-140-EVAL-3 (AC-EVAL-3): All listed failure classes and valid counterexamples are represented with rationale, and evaluation never treats missing context as support.
AC-140-EVAL-4 (AC-EVAL-4): A live run privately records complete per-case results and aggregate metrics with denominators; offline replay is separately labelled and reproducible.
AC-140-EVAL-5 (AC-EVAL-5): Unavailable calls remain visible in totals; comparison uses identical cases and no held-out tuning.
AC-140-EVAL-6 (AC-EVAL-6): The report explicitly states limitations and shadow/advisory recommendation; no metric or confidence score changes an acceptance or release gate.
AC-140-EVAL-7 (AC-EVAL-7): The two independent question families for a case are evaluated together; the report includes question/request counts and tests catch accidental serial per-question calls, without promising vendor benchmark speedups.
AC-140-EVAL-8 (AC-EVAL-8): An unsafe in-repository output destination is rejected, and default output is private; offline replay reports zero network calls and clearly names original result provenance.
AC-140-EVAL-9 (AC-EVAL-9): Robustness and repeat-run metrics, probability calibration and confidence-threshold accuracy are separately reported with denominators; changed models/questions require fresh qualification.

## [SPECFLOW] TSAFE-DUO-01: share snapshot-bound TypeSafe advice in duo-build
https://github.com/Hulupeep/Specflow/issues/141
AC-141-DUO-1 (AC-DUO-1): The same native duo-build entry point produces durable check records in both host directions, with no message copying or extra required user command.
AC-141-DUO-2 (AC-DUO-2): Off sends no request; shadow does not affect the peer prompt/outcome; advisory supplies the identical saved checks to builder and reviewer.
AC-141-DUO-3 (AC-DUO-3): A changed snapshot or evidence invalidates prior advice; oversized/missing inputs produce explicit incompleteness without silent omitted coverage.
AC-141-DUO-4 (AC-DUO-4): A failed TypeSafe call remains visibly unavailable while the required independent peer review still occurs; no acceptance or release gate is bypassed.
AC-141-DUO-5 (AC-DUO-5): A stale owner cannot run/save checks or change mode; takeover/resume preserve mode, records, findings and repair budgets; no recursive calls occur.
AC-141-DUO-6 (AC-DUO-6): Every flagged concern in advisory mode receives an evidence-backed reviewer disposition; disagreement does not automatically block or approve the work.
AC-141-DUO-7 (AC-DUO-7): A live unsupported-claim → correction → re-review cycle and package installation checks pass for both host adapters, with live versus simulated boundaries recorded.
AC-141-DUO-8 (AC-DUO-8): Creating, finishing or appending per-round TypeSafe records leaves the product snapshot fingerprint and source manifest unchanged; changing actual source/raw evidence changes the fingerprint and rejects stale acceptance. Advisory records are available explicitly to the peer without becoming product inputs; shadow records are absent from the peer request/tree.
AC-141-DUO-9 (AC-DUO-9): Missing credentials do not trigger a request or block an otherwise available peer; no environment-file contents or key values reach snapshots, requests or peer process environment.
AC-141-DUO-10 (AC-DUO-10): Two provider failures suppress further calls; explicit owner recovery clears only the streak. Budget exhaustion persists across resume/takeover and never disables peer review. Stale owners cannot change mode, limits or recovery state.
AC-141-DUO-11 (AC-DUO-11): A confident false flag may be rejected with evidence without creating a blocker; every actual blocking finding still identifies acceptance, a gate or material risk.

## [SPECFLOW] TSAFE-REPAIR-01: evaluate goal alignment and repeated repair observations
https://github.com/Hulupeep/Specflow/issues/142
AC-142-REPAIR-1 (AC-REPAIR-1): A reworded old hypothesis and a changed timestamp are classified/evaluated against prior history without counting as newly confirmed progress merely because text changed.
AC-142-REPAIR-2 (AC-REPAIR-2): A genuine new observation, partial fix and necessary prerequisite can be distinguished from unrelated cleanup without changing the scoped acceptance.
AC-142-REPAIR-3 (AC-REPAIR-3): Environment, authentication and fixture explanations remain hypotheses until source evidence confirms a cause; unsupported facts remain explicit.
AC-142-REPAIR-4 (AC-REPAIR-4): Existing finding IDs, closure evidence, repair ceilings and no-progress rules survive renamed batches, model disagreement and host takeover.
AC-142-REPAIR-5 (AC-REPAIR-5): Contradictory, uncertain or unavailable judgments remain visible and cannot autonomously close a finding, execute a command, alter counters or complete the run.
AC-142-REPAIR-6 (AC-REPAIR-6): The extended corpus and live evaluation include all required repair classes and the held-out split; a real resumed repair cycle records both model judgments and peer dispositions.
AC-142-REPAIR-7 (AC-REPAIR-7): Alignment, novelty and evidence-relation questions sharing one bounded state are submitted together with complete question/request accounting. Appending their results leaves the product snapshot fingerprint/manifest unchanged, including after host transfer.
AC-142-REPAIR-8 (AC-REPAIR-8): Repair report outputs follow private-destination checks; resume preserves provider-budget and repair-budget histories independently.
