# daily-use-teardown invocation prompt (template)

For a product that's **already built**. Fill the values and paste into your agent. Don't restate the path — point at it.

```
Goal:   a human-confirmed journey map + evidence-grounded do-list for <app>, feeding spec-build
Path:   QA/loops/daily-use-teardown.yaml
Inputs: { slug: <name>-teardown, app: <live URL/env>, personas: <list, OR "propose in stage 1 — I'll confirm at the gate"> }

Load the path and follow it — do not restate it. Each tick:
1. Render the path's progress_display.
2. Locate the current stage from the committed artifacts (journey-map.md + its .signoff.json,
   findings.md, do-list.md + its .signoff.json).
3. Advance exactly ONE gate; persist to those artifacts (never only to chat).
4. STOP at GATE_HITL — present the one-page journey map and tell me to run
   `node scripts/teardown-gate.cjs sign <map> --by "<me>"`. You NEVER run `sign` yourself,
   and you do not proceed until `node scripts/teardown-gate.cjs check <dir>` passes.
   Same again for my sign-off on the do-list.

Hard rules from the path: walk the CONFIRMED env via a COMMITTED Playwright script (reproducible,
never narrated; URL bar visible in every screenshot); judge clarity AND correctness per journey
(WORKS / CONFUSING / BROKEN — CONFUSING is marked [hypothesis]: a simulated persona is not a real
user); bugs go to bugs.md the moment they're found; the do-list is observations + priorities, not
solutions; the deep-dive gate is `teardown-gate check`, not your own say-so; tickets only ever
come from spec-build behind its own gates.
```
