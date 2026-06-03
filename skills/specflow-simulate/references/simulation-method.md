# Simulation Method — personas × routes → proposed story edits

The goal: surface what a single happy-path reading of the story misses, by
running realistic actors through it on realistic (and adversarial) routes, then
turning every gap into a concrete proposed addition. Pairs with the
`specflow-audit` skill (run simulate first; audit/pre-flight after).

## Step 1 — derive personas (3–5)

Personas are **behavioural archetypes**, not demographics. Pick the ones that
actually stress *this* story. A useful starting set:

| Archetype | What they stress |
|-----------|------------------|
| Power user / repeat | shortcuts, bulk actions, MRU/state, "I've done this 50 times" |
| First-timer | empty states, onboarding, unlabeled affordances, defaults |
| Adversarial / edge | bad input, huge/zero/negative values, unicode, double-submit, back button |
| Wrong-permissions | non-owner, expired session, cross-tenant, read-only role |
| Interrupted / returning | mid-flow reload, tab switch, stale data, resume after days |
| Cross-surface | starts on one surface (e.g. CLI/extension), finishes on another (web) |
| Collaborator / multi-actor | two people acting on the same object; ordering and races |

For each chosen persona, state in one line *why it stresses this story* — if it
doesn't, drop it.

## Step 2 — route each persona end-to-end

For every persona, walk the story's flow twice:
- **Happy route** — the intended path; confirm the story actually supports it step by step.
- **≥1 divergent route** — the realistic place this persona deviates: an empty/error/permission state, an unanticipated branch, a decision the story is silent on, a back-out/cancel, a concurrent action, a retry.

At each step ask: *Does the story say what happens here? Is the success state observable? What does this persona expect that the story doesn't deliver?*

## Step 3 — collect gaps, map each to a story edit

A gap with no proposed edit is incomplete. Map every gap to one of:

| Gap kind | Becomes |
|----------|---------|
| Silent behaviour / missing rule | a new `REQ-NN (MUST|SHOULD)` |
| Unhandled error/empty/permission state | a negative-path `AC` + a Gherkin scenario |
| Divergent route not covered | a new Gherkin branch and/or a journey step + `data-testid` |
| Ambiguous wording | a clarifying REQ edit or an open question |
| Cross-surface/ordering/race | an explicit REQ + an invariant `I-<DOMAIN>-NNN` candidate |
| Product decision needed | an **open question** (do NOT invent the answer) |

## Step 4 — output as a proposed block (do not silently rewrite)

Post ONE labelled block — `gh issue comment` or an appended section. Default is
*propose*; only apply into the story body if the user says so.

```markdown
## Simulation Findings (proposed)

**Personas run:** <persona> (why), <persona> (why), …
**simulated_at:** <RFC 3339 UTC>

### Per-persona routes
- **<persona> — <route>**: <what happened> → gap: <the silence/edge>
- …

### Proposed additions (accept into the story, then run specflow-audit)
- [ ] REQ-NN (MUST): <rule the story was missing>  — from <persona/route>
- [ ] AC: <observable negative-path behaviour>  — from <persona/route>
- [ ] Gherkin: Scenario "<edge>" Given/When/Then …  — from <persona/route>
- [ ] Journey step: <step> → assert `data-testid="…"`  — from <persona/route>

### Open questions (need a human decision)
- <product/UX question the simulation surfaced — no invented answer>
```

## Parallel fan-out (deep runs)
For thorough simulation, spawn one agent per persona so routes are explored
independently (each blind to the others), then dedupe and synthesize into the
single block above. The `ux-critique` skill already runs parallel persona agents
against a live screen — reuse that machinery, scoped to the story text. Always
collapse to one consolidated findings block; never post N overlapping comments.

## Discipline
- Personas must route *differently* — five personas that all walk the happy path is one simulation, not five.
- Every finding cites the persona+route that motivated it (traceability).
- Don't answer product questions; surface them.
- The output improves the artifact (proposed edits), it is not a critique essay.
