# Should I Use Specflow?

Decide in two minutes. Specflow is a trust harness for frontier coding agents: the model produces the work, but contracts, verifier evidence, mechanical gates, a ledger, and human boundaries decide what advances or ships. It does not write your code, plan your sprints, or orchestrate a swarm. It decides — on evidence, not confidence — whether the work those things produce may land.

[← Back to README](../README.md)

---

## The one-line test

> **Would you merge a six-hour agent run without reading it?**

- **"No, but I wish I could"** — that gap is exactly what Specflow closes. Read on.
- **"I'd read every line anyway"** — you already have a trust layer (your eyes). Specflow buys you little.
- **"Who cares, it's throwaway"** — skip it. The gate overhead only pays off when the change is consequential.

If the honest answer is the first one, you are the target user.

---

## The problem it solves

Frontier models are now good enough to be dangerous in a specific way: an autonomous agent can run for hours, touch dozens of files across auth, data, and billing, produce a diff no one will fully read, and then confidently self-certify it as done. A single model instance is happy to be planner, implementer, reviewer, and judge — and it is good enough at each role that you will be tempted to let it. But a model that just built something is a weak judge of its own output; it inherits its own assumptions when asked whether the work is correct.

The failure mode is not crashes. It is **plausible completion**: working-looking UIs over dead backends, green unit tests over hard-coded data, journeys that were never actually driven. "The agent says it's done" is not a merge criterion for anyone shipping commercial software.

Specflow's rule: **capability does not create authority.** The entity that produces a change is never the entity that certifies it. Maker and verifier are separated structurally, and a provider's output — including its exit code — is never a gate verdict.

### Before / after

| Without Specflow | With Specflow |
|---|---|
| Agent says "done" | Gate decides from evidence |
| Reviewer reads a huge diff cold | Reviewer reads trace/divergence first |
| Tests may be written by the maker | Verifier contract defines what counts |
| Screenshot implies success | Runtime/value evidence required |
| Model fallback is invisible | Requested/effective model is ledgered |
| Client gets reassurance | Client gets an evidence packet |

---

## Who it's for

**The primary wedge: AI-enabled agencies and consultants** delivering commercial software to clients who need proof that agent-produced work is controlled. You want agent speed for margin, but you have to explain trust to a paying client, and "our AI is careful" is not an answer a client accepts. Specflow's deliverable for you is the **client-ready evidence packet**: per change, a ledgered record of the contract, verifier findings, runtime proof, provenance, model metadata, and every human authorization. That turns AI-assisted delivery from a liability disclosure into a selling point.

Good fit beyond the wedge:

- **Product and engineering leads** running AI agents on real commercial work, where agents produce more change than the team can review line-by-line — you want review effort to concentrate where risk is.
- **Teams on brownfield production systems**, where existing behavior must not regress and agents don't know what they don't know.
- **Anyone touching auth, billing, workflows, data mutation, compliance, or audit trails**, where a wrong change has direct customer or legal impact.
- **Technical founders and orgs adopting frontier agents deliberately**, who need evidence before trust and a decision trail after.

---

## Who it's not for

Specflow is deliberately not for:

- **Throwaway demos** — the gate overhead buys nothing if the artifact is disposable.
- **Pure hobby vibe-coding** — if the fun is the flow, a harness is friction.
- **Greenfield experiments where you'll manually inspect everything anyway** — human eyes on every line already provide the trust layer.
- **Teams that want fully autonomous merge/deploy with no human gates** — Specflow's human-only boundaries (`never_without_human`) are a feature, not a limitation to configure away.
- **People looking for an agent swarm or orchestrator as the core product** — Specflow governs one worker's lane and sits *under* your orchestration, it doesn't replace it.
- **Users who only want prompt templates** — prompts are the disposable layer here, not the product.
- **Low-risk scripts where a simple test suite is enough** — if `npm test` genuinely covers the risk, use `npm test`.

---

## What it actually does

The trust layer is the story. Under it sit real, shipped capabilities:

- **A contracted loop runner** (`specflow run spec-build | feature-build`) runs the model as an untrusted worker inside a contract, stage by stage.
- **A verifier lifecycle**: the maker proposes how its slice will be verified; an independent verifier — which never sees the maker's reasoning — accepts, rejects, or strengthens that contract, then actually drives the built behavior at runtime.
- **Mechanical gates** consume verifier evidence and decide. A maker's "complete" claim cannot outvote a failed required finding. Slices touching UI, workflows, APIs, integrations, data mutation, auth, or billing cannot advance without verifier evidence, and a screenshot alone cannot satisfy a value-bearing check.
- **An append-only ledger** (`ledger.jsonl`) records models requested vs. effective, actions, evidence, divergences, gate results, and every human authorization.
- **`specflow run trace`** makes the whole run readable after the fact, divergence-first.
- **Human-only boundaries** — push, merge, PR, gate override — are mechanically enforced, not requested via prompt.

**Contracts and journey tests are still here** — pattern-scanning contract tests catch known-bad code shapes fast, and Playwright journey tests verify users can accomplish their goals. But they are *one layer* under the trust harness now: they are how gates check specific things, not the whole story. (Mechanics: see [How Specflow Works](how-it-works.md).)

Specflow never claims to guarantee correctness. It enforces that evidence exists and gates on it; it cannot conjure ground truth a project never defined.

---

## What it works with

The model stack above Specflow is swappable and expected to churn — Claude, Codex, Fable-class models, Ruflo, or agent swarms can produce the work. The gate layer underneath is fixed. You upgrade the worker freely; you never let the worker become the sensor.

| Layer | Examples | Relationship to Specflow |
|---|---|---|
| Workers / orchestrators | Claude Code, Codex, Ruflo, swarms | Produce work; their output lands only through Specflow's gates |
| Test frameworks | Jest / Vitest / Mocha (contracts), Playwright (journeys) | The checks gates run |
| CI/CD | GitHub Actions, GitLab, Azure, CircleCI | Specflow gates inside the loop, pre-PR; CI re-enforces at merge |
| Prompt packs / skills | Any | Disposable input; Specflow gates the output |

---

→ **Ready to install?** See [Getting Started](getting-started.md)
→ **Want the mechanics first?** See [How Specflow Works](how-it-works.md)
