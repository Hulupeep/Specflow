# Example — feature-build for a TT-ROLLBACK ticket (running as a goal)

A real, filled invocation of [`../prompts/feature-build.prompt.md`](../prompts/feature-build.prompt.md). This **continues the tt-rollback story**: spec-build ([`tt-rollback.spec-build.md`](tt-rollback.spec-build.md)) shipped audited, journey-contracted tickets — this builds **one** of them. **Run with the agent pointed at the code repo** (timebreez, where `QA/loops/feature-build.yaml`, the branch, and CI live), *not* gmh-docs. Issue numbers below are illustrative — use the ones the spec-build run actually created.

```
Goal:   branch for #571 green on branch-protected CI vs the real seeded backend, ready for review
Path:   QA/loops/feature-build.yaml
Inputs: { issue: 571 }
Automation: thread automation per ticket; interval matched to CI duration — re-fire until done_when.

Load the path and follow it — do not restate it. Each tick:
1. Render the path's progress_display (the rail map + CI status).
2. Locate the current rail from the branch + CI state.
3. Advance exactly ONE rail; persist the diff + an evidence note (tests WHERE/WHICH/HOW MANY/SKIPPED, oracle for each asserted number, provenance for each value-bearing output, an audit row per state mutation).
4. After implementation, prove the value comes from stored versions/live calc, not a hard-coded literal or fake API payload.
5. If CI has not been triggered, stop at the human CI handoff. After CI exists, read GATE C. Green → stop at "ready for review". Red → repair (inline if fast, else next tick). Stop / escalate per the path.

Ticket: #571 TT-ROLLBACK-03 — "revert updated rows via stored versions" (one of the tickets the tt-rollback spec produced). Its Gherkin ACs + data-testids + contract ref + e2e filename are on the issue (Rule 1).

Hard rules from the path: trust lives ONLY in Gate C — you and any swarm are muscle. Keep the slice <1000 lines (else propose a 4–8 slice split). Oracle-anchor every assertion and source-prove every value-bearing output after code — a reverted balance is RECALCULATED from stored versions, never additive-inverse or hard-coded, so read the live calc. Never push / open PR / merge / --no-verify / override a contract without me.
```

## What a correct first tick looks like

- Prints the rail map with ticket → contract → e2e → oracle → impl → provenance → human CI handoff → Gate C, with `now: 1_ticket   next: 2_contract   CI: —   blocked-on: none`.
- **Checks the precondition first:** #571 has Gherkin ACs + data-testids + contract ref + e2e filename. If any is missing it **escalates** — it does not invent the ACs.
- Advances **one** rail (confirms the ticket + journey id), persists, **stops.** If it writes the implementation on tick 1, the "one rail per tick" rule isn't landing — tighten the YAML.

## Then continue

Re-fire the automation:
- **tick 2 — contract:** YAML stub → full (steps + selectors pulled from the catalogue).
- **tick 3 — e2e:** the real-backend e2e test runs against a **real seeded backend** (never a mock).
- **tick 4 — oracle:** the reverted-balance assertion is traced to the **live recalc**, not a guessed number.
- **tick 5 — impl:** the smallest mergeable slice (<1000 lines) makes it pass.
- **tick 6 — provenance:** the reverted balance is traced source → transform → API/input → output → assertion, with no hard-coded business literals or mock/fake/stub source on the tested path.
- **tick 7 — human CI handoff:** if CI does not exist yet, it stops for *you* to push/open the PR or otherwise trigger branch-protected CI.
- **⛔ GATE C:** contract + journey tests green on **branch-protected CI vs the real seeded backend**, with provenance passing → it **stops at "branch ready for review."**

## Red flags that the run is wrong

- It writes implementation **before the e2e test exists** → rails run ticket → contract → e2e → oracle → impl, in order.
- A green claim with **no evidence note** → "tests pass" without WHERE / WHICH / HOW MANY / SKIPPED is not evidence.
- An asserted number with **no oracle** → a reverted balance computed as `-original` instead of recalculated from stored versions is exactly the bug this ticket exists to prevent.
- A value-bearing output with **no provenance** → a reverted balance supplied as a literal/API payload instead of read from stored versions is a false green.
- It **pushes, opens the PR, or merges** → never without you.
- It calls a red **"inherited baseline"** without first running that test on the BASE branch to prove it.

**Slice-done ≠ epic-done.** When all the tt-rollback tickets have merged, the epic still isn't closed — run **GATE D** on the merged tree. See [`tt-rollback.gate-d.md`](tt-rollback.gate-d.md).
