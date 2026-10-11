# #201 binding repair status — 2026-10-11

Prepared, not implemented. The owner requested “continue with bind” following completed research #194. The selected slice is #201; #174/#178 remain broader tracking issues. Story and scoped simulation/audit are prepared. No production source or test assertions have changed.

Duo run `1791750889080-6f95244d` (Codex builder, Claude peer): initial accepted preparation in round 2; subsequent reference-inventory correction required regrade. The current mechanical mapping gate passes 20 checks, zero skipped/failed. The current volume report has status `reported`, errors empty. Optional override-log applicability and a historical changelog reference are explicit in the local record.

Round 4's peer independently accepted all five BIND rows and reported no blocking findings. The scoped-review checker rejected it because it paraphrased the existing optional `P2-DIAG` basis. The recorded error is `P2-DIAG: cannot repurpose an existing finding ID`. The review was charged as complete/blocked, exhausting the initial-plus-one-regrade allowance. No current promotion receipt exists; implementation did not start. An earlier required-read failure and unread-citation failure remain recorded as protocol failures, not acceptance.

This is an unresolved workflow blocker, not an approved exception. Do not edit journals, rename the run, switch reviewers to reset the allowance, or claim production readiness. The original/raw records remain under `.specflow/duo/1791750889080-6f95244d/` and `.specflow/specification/201.json`; the current source record is `.specflow/bind/record.json`.

Next prerequisite: the owner-run review-allowance recovery proposed in #199 / PR #200, then a fresh same-scope review preserving the existing `P2-DIAG` identity and history. That PR is still open at this checkpoint; its reset command is not on main and has not been executed. Agent must not claim it already reset or ask the owner to run a nonexistent main command.

After supported owner recovery: resume the same Duo preparation run, capture the corrected metadata on current source, regrade within the new allowance, finish and promote only #201. Then write/run the Q1/Q2 failing regressions, implement receipts/baseline admission/exact-tree retention, run focused and full canonical tests, and request independent implementation review before merge. Preserve deferred gain semantics and backend journeys.
