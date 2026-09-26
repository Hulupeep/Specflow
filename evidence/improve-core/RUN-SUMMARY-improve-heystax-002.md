# improve-heystax-002 — REVERT (sanitized public summary, slice 2)

The full record is private to the TabStax web-app clone: ledger (90 entries, chain
verified), frozen contract, practice and holdout checks, screenshots and the patch.
This summary contains no product source.

**Product result:** Improvement not established; product unchanged. Giving the card
name its own row made every name readable at every tested width, and all controls and
list paths stayed intact. But under the fixed card height it pushed the overdue pill,
footer controls and next-action rows out of view. That trades one "what matters now"
signal for another.

| Stage | What happened |
|---|---|
| Candidates | Run 001's set, with C1 restated as one intended change: the name gets its own row and controls wrap. No control is removed. |
| Duo critique | Peer (opus → claude-opus-5-5, same vendor): **pursue**, with 9 contract requirements. These were: a two-line title rule, bounded holdout names, all controls visible, DOM order kept, body no-harm (action rows, overdue pill), header growth caps of 32/72px, and the fixed-height tension named up front. $0.33 |
| Oracle | An independent oracle author (opus → claude-opus-5-5) wrote the hidden holdout: 1280, 1024, 820 and 390px, real names plus injected names of 12–40 characters. A dry run on base found 2 criteria that are preservation at holdout widths; their baseline expectation is `n/a`. $1.25 |
| Baseline | Holdout and practice both reproduced the problem; every frozen expectation matched. |
| Round 1 | Builder (sonnet → claude-sonnet-5) stacked the title over the controls and claimed "complete". Practice: AC-1/2/3/5 pass, AC-4 fails with 9 regressions. Peer: **continue/redirect**. It rejected the claim and prescribed a layout where the controls share the title's line when there is room. $0.20 + $0.36 |
| Round 2 | Builder applied it and claimed "partial". There was no measurable change: the same 9 regressions. Peer: **revert**, with an infeasibility argument. The four controls are about 211px wide and card height is fixed, so on narrow cards AC-1+AC-3 cannot hold together with AC-4. The peer drafted two contract amendments and routed the choice to the user. $0.21 + $0.39 |
| Holdout (used once) | AC-1/2/3/5 pass, AC-4 fails. It also caught harm the practice widths missed: at 1280px the Must card footer (Overdue, View List, Open Tabs) is cut in half. |
| UX evaluator | Read-only, no builder transcript: AC-6 **fail**. Names are readable, but the header dominates narrow cards and urgency signals are lost. $0.57 |
| Decision | **REVERT**: mandatory AC-4 and AC-6 failed. The peer and the mechanical rule agree. |
| Applied | Worktrees removed, branch deleted, patch kept; base `main` df8cdf9 unchanged; 0 prohibited actions; holdout never exposed. |
| Cost | $3.31 measured model spend (7 adapter roles); 1 host role has unknown cost. |

**Human next decision** (routed by the Duo peer): for a new run, choose (a) the card's
max-height may grow by the header's growth, or (b) below a set width, Settings and Flip
move into the existing card menu. Otherwise accept truncated names on narrow cards and
stop work on the card header.
