---
name: specflow-simulate
description: Simulates end-to-end usage of a Specflow story across multiple personas and divergent routes to discover gaps, edge cases, and unhandled branches BEFORE the story is built — then proposes each finding as a concrete story addition (new REQ, negative-path AC, Gherkin branch, or journey step). This is the high-value exploratory step run right after a story is created, distinct from the pre-flight compliance gate. This skill should be used when the user asks to "simulate this story", "simulate usage end to end", "find gaps and edges", "run personas through this", "stress-test this story", or invokes /specflow-simulate on a story file or GitHub issue. Scope is Specflow story exploration — it is generative (surfaces and proposes), not a build or a verification gate.
---

# Specflow Simulate

Run a story through realistic usage — multiple personas, multiple routes — to find the gaps and edges a single happy-path reading misses. The output is not commentary; it is a set of concrete, proposed additions that make the story sharper before any code is written.

## When to run

Trigger on: "simulate this story", "simulate usage end to end", "find gaps / edges", "run personas through this", "stress-test this story", or `/specflow-simulate <file-or-issue>`.

Position in the Specflow flow — this runs *after create, before audit*:
```
create (specflow-writer) → SIMULATE (this skill) → audit/uplift (specflow-audit) → pre-flight gate
```
It is generative (discover + propose). It is NOT the pre-flight gate (that verifies and blocks). Do not conflate the two.

## The method

Full method (persona archetypes, route taxonomy, gap→edit mapping, output format) is in `references/simulation-method.md`. Summary:

1. **Read the story** (issue via `gh issue view <n> --json title,body,comments`, or the file). Extract the intended outcome, the actors, and the surfaces.
2. **Derive 3–5 distinct personas** — not demographics; *behavioural archetypes* that route through the problem differently (e.g. power user, first-timer, adversarial/edge user, wrong-permissions user, interrupted/returning user). Pick the ones that stress *this* story.
3. **Walk each persona through the story end-to-end** — the happy path AND at least one divergent route per persona: where do they get confused, blocked, take an unanticipated branch, hit an empty/error/permission state, or make a decision the story didn't plan for?
4. **Collect gaps** — each gap is a concrete moment where the story is silent, ambiguous, or wrong for that persona/route.
5. **Map every gap to a story edit** — a new `REQ-NN`, a negative-path `AC`, a new Gherkin scenario/branch, a new journey step + `data-testid`, or a flagged open question. A gap with no proposed edit is incomplete.
6. **Propose, don't silently rewrite** — post the findings as ONE labelled block: a GitHub comment (`gh issue comment`) or an appended `## Simulation Findings (proposed)` section. The user (or the subsequent specflow-audit uplift) folds accepted items into the story body. Only edit the body directly if the user explicitly says to apply.

## Parallel personas (optional, for thorough runs)
For a deep simulation, fan out one agent per persona so each route is explored independently and blind to the others — this surfaces more than one sequential reading. The `ux-critique` skill already runs parallel persona agents against a live screen; reuse that pattern here, scoped to the *story text* rather than a running UI. Then dedupe and synthesize into the single findings block.

## Output shape
Report, and post as the findings block:
- the personas chosen and why each stresses this story,
- per persona: the route taken + the gaps found,
- a consolidated **proposed-additions** list (REQ / AC / Gherkin / journey-step), each tagged with the persona/route that motivated it,
- open questions that need a human decision (don't invent answers to product questions).

## Reference
- `references/simulation-method.md` — persona archetypes, route taxonomy, gap→edit mapping table, and the `## Simulation Findings (proposed)` format.
