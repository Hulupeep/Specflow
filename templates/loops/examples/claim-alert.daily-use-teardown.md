# Example — daily-use teardown of Claim Alert (a built product)

A filled invocation of [`../prompts/daily-use-teardown.prompt.md`](../prompts/daily-use-teardown.prompt.md). Claim Alert is already shipped — the question isn't "what should we build," it's **"are the journeys confusing, and are they doing the right thing?"** Run with the agent pointed at the Claim Alert repo (after `specflow init .`).

```
Goal:   a human-confirmed journey map + evidence-grounded do-list for Claim Alert, feeding spec-build
Path:   QA/loops/daily-use-teardown.yaml
Inputs: { slug: claim-alert-teardown, app: <Claim Alert live URL/env>, personas: "propose in stage 1 — I'll confirm at the gate" }
```

> If your repo was scaffolded before this loop existed, **re-run `npx @colmbyrne/specflow init .`** to refresh `QA/loops/` — otherwise the `Path:` above points at a file you don't have yet.

## What a correct run looks like

1. **INVESTIGATE** — the agent explores the app + repo and returns a **one-page journey map**: routes as parseable `- J: <id> — <purpose>` lines, entry points, proposed personas, and the env it will walk. Inventory, not critique. It **stops**.
2. **⛔ GATE HITL (you, mechanically)** — five minutes: confirm/correct each route's purpose, kill stale routes, add what it missed, sign the personas + env. Then **you** run:
   ```
   node scripts/teardown-gate.cjs sign docs/teardown/claim-alert-teardown/journey-map.md --by "Colm"
   ```
   That sign-off is **hash-bound** to the map's content — if the agent edits the map afterwards, the gate fails. *The agent never runs `sign`, and a `confirmed-by` line typed into the map counts for nothing.*
3. **DEEP DIVE** — per confirmed journey × persona, a top-thinker walk of the **confirmed env** via a **committed Playwright script** (reproducible, not narrated): where it works, where it's confusing, where it's broken. Screenshot at every stall, **URL bar visible**, referenced from the findings entry. Verdicts: WORKS / CONFUSING / BROKEN — with CONFUSING marked `[hypothesis]` (a simulated persona is not a real user). Bugs land in `bugs.md` the moment they're found.
4. **GATE (script)** — `node scripts/teardown-gate.cjs check docs/teardown/claim-alert-teardown` must pass: valid sign-off, every mapped journey has findings, every finding's evidence file exists. Self-attestation doesn't pass.
5. **DO-LIST** — prioritized, every item traceable to a screenshot. Observations + priorities, **no solutions** ("missing a bulk-edit button" is a solution in costume — write what the persona *couldn't do*). **You sign the do-list the same way.**
6. **HANDOFF** — the do-list becomes `grounding_ref` for **spec-build**: PRD → adversary → tickets → build → done.

## Red flags that the run is wrong

- It starts walking journeys with **no passing `teardown-gate check`** → stop it; the gate isn't landing.
- A journey verdict with **no evidence file**, or screenshots without the URL bar → "I walked it" is not evidence.
- The do-list proposes **solutions** → it's doing the PRD's job without the adversary; push it back to observations.
- It asks you to confirm **in chat** → chat approval counts for nothing; only the signed artifact does.

**Precedent (stated honestly):** timebreez EPIC #673 ran *spec-build* with a 3-persona Playwright walkthrough as its discovery stage — 73 indexed screenshots + a committed walk script, a PRD that survived Gate A, 9 sliced tickets, and a live bug (#680) found mid-walk. That validates the *walkthrough-as-grounding* idea and set the evidence bar this loop now mandates. The teardown's **distinctive** stages — the signed journey map, the WORKS/CONFUSING/BROKEN ledger, the signed do-list — are **new and unproven until a first real run** (Claim Alert would be it).
