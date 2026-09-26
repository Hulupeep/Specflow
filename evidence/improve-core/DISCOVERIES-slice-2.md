# IMPROVE-CORE slice 2: discoveries (Duo rounds, hidden holdout)

Slice 1 findings stay in `DISCOVERIES.md`. That file is hash-referenced by the Specflow
discovery journal, so it is not edited. This file covers slice 2 and run
`improve-heystax-002` against the same base, `tabstax-webapps@df8cdf9`.

| ID | Kind | Finding | Affects |
|---|---|---|---|
| S2-D1 | observation | duo-build pairs vendors and hard-wires the reviewer to "the other CLI". With only Claude installed, the reusable parts were the direction schema and prompt, the hardened read-only Claude reviewer invocation, and the 1 + 3 repair budget. The ledger records `independence: same-vendor`. | #177, #178 |
| S2-D2 | observation | The Duo critique turned a vague contract into a strict one: a two-line title rule, bounded holdout names, control wrap, and body no-harm checks (next-action rows and the overdue pill). It also named the real product tension: cards have a fixed max-height, so any header growth takes space from the body. | #175, #174 |
| S2-D3 | observation | Whether a criterion is an "improvement" or a "preservation" depends on the sample. At holdout widths the list path already exists (AC-2), and the narrow title is 0px, so a click fails (AC-5), while practice widths behave differently. Baseline expectations need to be per check set; a single expectation per criterion is too coarse. | #174 |
| S2-D4 | observation | A pre-freeze dry-run of the holdout on base is necessary and legitimate. Only the host sees base results; the builder and peer never see the holdout. The oracle can be re-authored before freezing, and never after. | #174, #178 |
| S2-D5 | observation | The phone viewport is distorted by C2: the layout viewport is 493px on a 390px device. The holdout records the observed innerWidth so phone claims stay scoped. | #180 |
