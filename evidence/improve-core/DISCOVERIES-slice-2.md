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
| S2-D6 | observation | The Duo loop worked as intended. Round 1 turned a false "complete" claim into a precise redirect. Round 2 stopped the loop with an infeasibility argument and a user-owned decision instead of letting the builder keep tuning. The peer and the mechanical decision agreed. | #178 |
| S2-D7 | observation | The held-out sample caught harm the practice sample missed: the Must card footer is cut at 1280px but not at 1440px. The dev/holdout split added real information beyond overfitting protection. | #174, #178 |
| S2-D8 | observation | The report's "Human next decision" was generic when the peer had already named a user-owned decision. Fixed: user-owned peer steps now become the human next decision. | #179 |
| S2-D9 | observation | The product constraint the run found is a real scope question. The card's fixed max-height (C3) and fixed control set make "readable name" and "no body harm" incompatible on narrow cards. Only a human can pick the trade-off; improve surfaced it for about $3.30 without touching the product. | #180 |
| S2-D10 | observation | Duo peer cost dominated builder cost (about $0.37 vs $0.20 per round), and the oracle author was the single largest cost ($1.25). Oracle authoring is a one-time cost per contract, and reusing an oracle across runs of the same candidate would amortise it. | #179, #177 |
