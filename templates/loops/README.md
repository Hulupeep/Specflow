# Loops — run the whole pipeline

> **Canonical source: Specflow.** This kit was scaffolded by `specflow init` and is refreshed by `specflow init`/`update`. Don't hand-edit it per-project — change it in Specflow (`templates/loops/`) so every project gets the fix.

This folder is the runnable kit for the process in [`../../PROCESS.md`](../../PROCESS.md). Everything you need is here:

```
spec-build.yaml        feature-build.yaml      ← the PATHS (stages, gates, repair, done_when) — write once
prompts/               examples/               ← the PROMPTS (thin: goal + inputs + automation) + worked examples
```

**A loop = path + thin prompt + automation (the tick) + durable state (committed artifacts).**
The path lives in the YAML. The prompt only carries *goal + inputs + automation* and says "follow the path." It never restates the stages. The YAML is the source of truth — if a prose doc disagrees, the YAML wins.

## Run the whole pipeline, in order

1. **Spec-build** — turn a rough idea / discovery into defensible tickets.
   Copy [`prompts/spec-build.prompt.md`](prompts/spec-build.prompt.md), fill `goal` / `slug` / `grounding_ref`, paste into your agent (or set it as a thread automation). It runs discover → PRD → adversary → **Gate A (SHIP)** → tickets → Gate B/B.5. Output: audited, journey-contracted tickets.
2. **Feature-build** — turn each ready ticket into a tested slice.
   For every ticket the spec-build loop produced, copy [`prompts/feature-build.prompt.md`](prompts/feature-build.prompt.md), fill `issue`, paste/automate. It builds on the 5 rails → **Gate C (CI on real data)**. Output: a branch ready for review.
3. **Mistake-harvest** (meta, optional) — schedule `docs/routines/daily-mistake-harvest.md` (timebreez). It reads runs of both loops and improves the skills/contracts they depend on.

```
discovery ─▶ [spec-build.prompt] ─▶ tickets ─▶ [feature-build.prompt ×N] ─▶ merged slices
                  Gate A                              Gate C
                          \________ mistake-harvest reads both, improves the loops ________/
```

## How to fill a prompt

Each prompt is a template with three values:
- **goal** — the done-state in one line (e.g. "SHIP the TT-ROLLBACK spec").
- **inputs** — `slug` + `grounding_ref` for spec-build (grounding can be a file *or* "this discovery thread; no PRD yet"); `issue` for feature-build.
- **automation** — thread automation (re-fire until `done_when`), interval matched to how fast the gated state changes.

See [`examples/tt-rollback.spec-build.md`](examples/tt-rollback.spec-build.md) for a real, filled invocation.

## Two rules that make it trustworthy

- **One gate per tick.** Each run locates where it is from committed artifacts, advances exactly one gate, persists, then stops/escalates. State lives in files (PRD, verdict, tickets, evidence) — never only in chat.
- **Muscle never approves its own work.** Agents and the swarm do the work; trust lives only in **Gate A** (one hostile critic) and **Gate C** (branch-protected CI vs a real backend).

## Which repo do I run in?

- **spec-build** produces documents → run where PRDs/journeys live (gmh-docs, or the product repo that owns the spec).
- **feature-build** produces code → run in the code repo (e.g. timebreez, claims-monorepo).
- The paths sit at the same `QA/loops/` location in each repo, so the prompts' `QA/loops/*.yaml` reference resolves wherever you point the agent.
