# Loops — run the whole pipeline

> **Canonical source: Specflow.** This kit was scaffolded by `specflow init` and is refreshed by `specflow init`/`update`. Don't hand-edit it per-project — change it in Specflow (`templates/QA/loops/`) so every project gets the fix.

## The problem this solves

**Your best thinking becomes invisible to future you.** You think in rich, parallel texture — but the moment you need to *act* on it (retrieve it, build on it, hand it to an agent), there's no schema. It evaporates.

The same gap shows up in the work itself: hand-prompting agents isn't painful because it's *tedious* — it's painful because it's **untyped**. An agent hands back *"done," "tests pass," "the file says so"* — claims with nothing enforcing they're true. So plausible-but-wrong flows straight downstream and you find out in production:

- a spec that was **never made honest** becomes tickets, then code;
- a number someone **guessed** becomes a test assertion;
- a test that's **green against a mock** becomes a merge;
- "it ran" gets treated as "it works" — and there's no record of why anything was trusted.

Nothing at the boundaries rejects a wrong-typed artifact. That's the real cost, and it's a *correctness* problem, not a labor one.

## Why this — type-safe practice, not automation

Think of it as a **type system for the whole lifecycle**. Each phase emits a *typed artifact* that the next phase refuses to consume until it conforms:

| Artifact | Its "type" is enforced by |
|---|---|
| discovery | a **real artifact** — no grounding, no PRD |
| PRD | a **hostile critic** (Gate A) — no SHIP verdict, no tickets |
| tickets | the **specflow auditor** (Gate B) — every requirement→journey→test→issue, no orphans, no dup IDs |
| an asserted number | the **oracle** — checked against the real calc/source, never guessed |
| the merge | **CI vs a real backend** (Gate C) — green-but-broken can't typecheck |

The gates **are** the type-checker. The honesty rule — *"it ran / it's green / the file says so" is not evidence* — is just the compiler rule: an untyped claim doesn't cross a boundary. The loop is only *how you run the checker* continuously and hands-off; the point is that **a wrong artifact can't reach production whether a human or an agent produced it.**

## What makes it safe to let it run

- **The producer never certifies its own type** — an outsider does: the hostile critic at Gate A, CI at Gate C. (Muscle does the work; it never approves it.)
- **Typed values are durable and inspectable** — state lives in committed files (PRD, verdict, contract, evidence), not chat, so nothing can "remember" a green it never proved.
- **A type error is caught at its boundary, cheaply** — worst case is a branch you don't merge or a PRD that never ships, never polluted live data.

## The loop is execution; the practice must be storied

This loop is the *execution* of a practice — it gives your thinking a schema at the moment you act, so a run produces typed, durable artifacts instead of evaporating texture. But execution is only half of it. The practice itself — the decisions, the *why*, the patterns that recur across runs — has to be **storied**: captured and narrated somewhere durable (e.g. [heystax.ai](https://heystax.ai)) so it survives beyond a single loop and future-you can retrieve it. **The loop types the work; the store remembers the practice.**

---

## What's in the folder

This is the runnable kit for the process in [`../../PROCESS.md`](../../PROCESS.md):

```
spec-build.yaml        feature-build.yaml      ← the PATHS (stages, gates, repair, done_when) — write once
prompts/               examples/               ← the PROMPTS (thin: goal + inputs + automation) + worked examples
```

**A loop = path + thin prompt + automation (the tick) + durable state (committed artifacts).**
The path lives in the YAML. The prompt only carries *goal + inputs + automation* and says "follow the path." It never restates the stages. The YAML is the source of truth — if a prose doc disagrees, the YAML wins.

`specflow run` is the local contracted-loop runner. It writes
`.specflow/runs/<slug>/run-contract.yaml` plus `.specflow/runs/<slug>/ledger.jsonl`
so an agent cannot merely cite this folder and improvise. A prompt is one
instruction; a Specflow loop is a persisted job contract with verifier gates,
state, evidence, and stop rules.

## Run the whole pipeline, in order

1. **Spec-build** — turn a rough idea / discovery into defensible tickets.
   Copy [`prompts/spec-build.prompt.md`](prompts/spec-build.prompt.md), fill `goal` / `slug` / `grounding_ref`, paste into your agent (or set it as a thread automation). It runs discover → PRD → adversary → **Gate A (SHIP)** → tickets → Gate B/B.5. Output: audited, journey-contracted tickets.
2. **Feature-build** — turn each ready ticket into a tested slice.
   For every ticket the spec-build loop produced, copy [`prompts/feature-build.prompt.md`](prompts/feature-build.prompt.md), fill `issue`, paste/automate. It builds on the rails through implementation, post-code provenance, human CI handoff, then **Gate C (CI on real data)**. Output: a branch ready for review.

**Already-built product?** Start one loop earlier: **daily-use-teardown** ([`daily-use-teardown.yaml`](daily-use-teardown.yaml), prompt in [`prompts/`](prompts/)) — investigate the app's main journeys + their purpose, **you confirm the map (hard human gate)**, then top-thinker persona walks judge each journey WORKS / CONFUSING / BROKEN with screenshot evidence, ending in a prioritized do-list that becomes spec-build's `grounding_ref`. Filled example: [`examples/claim-alert.daily-use-teardown.md`](examples/claim-alert.daily-use-teardown.md).
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

- **Continue until done or truly blocked.** Each run locates where it is from
  durable artifacts, advances every currently unblocked stage/rail, persists
  after each gate, then stops only on a true human gate, missing evidence,
  exhausted budget, external CI wait, or handoff/done state. State lives in files
  (run contract, ledger, PRD, verdict, tickets, evidence) — never only in chat.
- **Muscle never approves its own work.** Agents and the swarm do the work; trust lives only in **Gate A** (one hostile critic) and **Gate C** (branch-protected CI vs a real backend).

## Generative stage adapters

Some loop stages require writing or judgment. By default `specflow run` stops
there with `agent_action_required`. To execute one generative stage under tight
controls, provide an adapter policy for a local CLI runtime:

- Claude Code: `claude -p`
- Codex: `codex exec`

The provider CLI owns authentication and subscription use. Specflow stores no
subscription secrets. The adapter policy must name command args, timeout,
budget where supported, transcript path, output path, allowed/denied tools, and
`never_without_human`. The runner records transcript evidence, blocks forbidden
actions outside the provider prompt, and requires the owning Specflow gate to
rerun before state advances.

### Default model routing for larger initiatives

For larger initiatives, enable the project routing default during `specflow init`
or `specflow update` by answering `y` to the model-routing prompt. If you skipped
the prompt, enable it later with:

```bash
npx @colmbyrne/specflow update . --runtime <codex|claude-code>
```

That default routes expensive requirements/planning/review work to the configured
Claude/Fable policy and bounded coding/test work to Codex CLI with GPT-5.5. It
requires confirmation before invoking a routed model:

```bash
specflow run spec-build --slug auth-system --goal "build auth" --input docs/auth-idea.md --adapter-routing .specflow/adapter-routing.yml
```

The first run prints the selected provider, role, model, effort, fallback, and
budget cap/quota guard. For `codex-exec`, ChatGPT-authenticated Codex consumes
Codex plan quota/credits rather than OpenAI API billing.
If the choice is right, rerun with:

```bash
specflow run spec-build --slug auth-system --adapter-routing .specflow/adapter-routing.yml --confirm-models
```

The confirmation is intentional: Fable/frontier routes are expensive and should
not be spent just because an automation resumed. Models do work; Specflow gates,
CI, and humans still approve.

## Which repo do I run in?

- **spec-build** produces documents → run where PRDs/journeys live (gmh-docs, or the product repo that owns the spec).
- **feature-build** produces code → run in the code repo (e.g. timebreez, claims-monorepo).
- The paths sit at the same `QA/loops/` location in each repo, so the prompts' `QA/loops/*.yaml` reference resolves wherever you point the agent.
