# daily-use-teardown invocation prompt (template)

For a product that's **already built**. Fill the values and paste into your agent. Don't restate the path — point at it.

```
Goal:   a human-confirmed journey map + evidence-grounded do-list for <app>, feeding spec-build
Path:   QA/loops/daily-use-teardown.yaml
Inputs: { slug: <name>-teardown, app: <live URL/env>, personas: <list, OR "propose in stage 1 — I'll confirm at the gate"> }

Load the path and follow it — do not restate it. Each tick:
1. Render the path's progress_display.
2. Locate the current stage from the committed artifacts (journey-map.md, findings.md, do-list.md).
3. Advance exactly ONE gate; persist to those artifacts (never only to chat).
4. STOP at GATE_HITL — present the one-page journey map and wait for my written confirmation
   before any deep dive. Stop again for my priority sign-off on the do-list.

Hard rules from the path: walk the LIVE app with a real backend (never fake a walk you couldn't
do); judge clarity AND correctness per journey (WORKS / CONFUSING / BROKEN, each with screenshot
evidence); the do-list is observations + priorities, not solutions; tickets only ever come from
spec-build behind its own gates.
```
