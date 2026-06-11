# Example — daily-use teardown of Claim Alert (a built product)

A filled invocation of [`../prompts/daily-use-teardown.prompt.md`](../prompts/daily-use-teardown.prompt.md). Claim Alert is already shipped — the question isn't "what should we build," it's **"are the journeys confusing, and are they doing the right thing?"** Run with the agent pointed at the Claim Alert repo (after `specflow init .`).

```
Goal:   a human-confirmed journey map + evidence-grounded do-list for Claim Alert, feeding spec-build
Path:   QA/loops/daily-use-teardown.yaml
Inputs: { slug: claim-alert-teardown, app: <Claim Alert live URL/env>, personas: "propose in stage 1 — I'll confirm at the gate" }
```

## What a correct run looks like

1. **INVESTIGATE** — the agent explores the live app + repo and returns a **one-page journey map**: the main routes, each with its *purpose* ("what is the user trying to achieve here?"), entry points, and proposed personas. Inventory, not critique. It **stops**.
2. **⛔ GATE HITL (you)** — five minutes: confirm/correct each route's purpose, kill stale routes, add what it missed, sign the personas. Your confirmation is written into the map. *This is the step that keeps the whole run honest — the agent can only infer what Claim Alert is for; you know.*
3. **DEEP DIVE** — per confirmed journey × persona, a top-thinker walk of the **live app**: where it works, where it's confusing (stalls, squints, mis-clicks), where it's broken (doesn't achieve its purpose). Screenshot at every stall. Verdict per journey: WORKS / CONFUSING / BROKEN. Critical bugs surface immediately.
4. **DO-LIST** — prioritized, every item traceable to a screenshot of a real stuck moment. Observations + priorities, **no solutions** yet. You approve the priorities (second, lighter touch).
5. **HANDOFF** — the do-list becomes `grounding_ref` for **spec-build**: PRD → adversary → tickets → build → done. One spec-build run per top-priority cluster.

## Red flags that the run is wrong

- It starts walking journeys **before** you confirmed the map → the HITL gate isn't landing; stop it.
- A journey verdict with **no screenshot** → "I walked it" is not evidence.
- The do-list proposes **solutions** → it's doing the PRD's job without the adversary; push it back to observations.

Precedent: the same shape ran on timebreez as EPIC #673 (3-persona walkthrough → grounding → PRD survived Gate A → 9 sliced tickets, **plus a live bug found during the walk itself**).
