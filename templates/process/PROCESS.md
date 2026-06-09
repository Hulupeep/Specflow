# PROCESS — idea → merged code you can trust

The canonical reference for how we run work end to end. The spine in one line:

> **A single hostile critic gates the spec; CI gates the code; the swarm/agent is muscle *inside* a phase, never the thing that approves its own work.**

Trust is never delegated to the thing doing the work. Gate A is one hostile critic. Gate C is the machine. Everything between is muscle.

---

## Step 0 — Discover (human + agent vs. a real artifact)

Start from something real, not a blank page. Walk the **actual artifact** (a third-party export, an API response, a legacy table) and the **real repo** to find the true problem and the true constraints. **No swarm here** — just grounding.

*Output:* a rough problem statement + the real data/oracle it must satisfy.

## Step 1 — PRD, written by a dueling pair

One agent **drafts** the PRD; a second **attacks** it with the `adversarial-prd-reviewer` skill. Round after round: A writes → B challenges on the rubric → A revises *in the document* → B re-reads and closes or reopens. A single model can switch hats.

- **The rubric (7 passes):** JTBD coherence, requirement→implementation traceability, the two-engineer test, scope boundary, dependency/ordering, success-metrics audit, willingness-to-pay — plus a banned-language scan and a Ramen test.
- **The Special Mandate** (honesty-critical specs): a **reality-grounding ledger** (open every concrete repo claim the author makes and verify it) + a **loophole hunt** (actively try to find the gamed gate / fake backend / skip-to-green / always-green metric *surviving*).

*Output:* a hardened PRD. (Where the adversary catches "a real backend with nobody home," "all-green smuggled in as the metric," etc.)

## Step 2 — GATE A (HARD) — the adversary verdict

The critic issues `SHIP` / `SHIP WITH STIPULATIONS` / `DO NOT SHIP`, written to a **committed verdict artifact**. **No ticket-writing starts until that artifact says SHIP.** This is a *single hostile critic* — deliberately not the swarm's self-consensus.

## Step 3 — Tickets (Specflow)

`specflow-writer` turns the shipped PRD into GitHub issues with Gherkin acceptance, data-testid selectors, contract references, and an e2e file name. For canonical journeys the Gherkin lives **once** in the catalogue (`journeys-must-have.md`); the issue carries a headline + deep-link (don't triplicate the spec). This phase can fan out with ruflo for parallelism.

*Output:* issues + thin **contract YAMLs** (the executable encoding of each journey).

## Step 4 — GATE B (soft) — audit + closure

`board-auditor` + `specflow-uplifter`: every requirement → journey → test → issue, no orphans, no duplicate IDs, gaps hardened.

## Step 5 — GATE B.5 (soft, its own gate) — pre-flight simulation

`pre-flight-simulator` walks real personas through each ticket *before* code. A CRITICAL design gap blocks. (Cheaper to find "new staff land at zero balance" here than in the build.)

## Step 6 — Build (the 5 rails, one journey at a time)

The micro-loop inside the macro pipeline. Each journey is built on the same fixed rails:

1. **Ticket** (Rule 1: no ticket = no code)
2. **Contract YAML** promoted stub → full (steps + selectors lifted from the catalogue)
3. **Real-backend e2e** test
4. **Assertions oracle-anchored** — verified against the live calc / the real source numbers, never a guess (e.g. "2 days, not 5" checked against the calc first)
5. **Implementation** that makes it pass

One journey, proven green, *then* the next. ruflo can run implementers per ticket in worktrees here — **as muscle, not as a gate.**

## Step 7 — GATE C (HARD, unfakeable) — CI

Contract tests + journey tests against a **real seeded backend** + anti-pattern audit + coverage ratchet + migrations-replay gate. Runs under branch protection: a violation **cannot merge**. This is *CI*, not an agent's opinion — and because the journeys run against real data, *green-but-broken* can't pass.

---

## Why it holds — soft front, hard backstop

The controller-enforced gates (A, B, B.5) catch most things. But even a *gamed* soft gate or a *fooled* adversary can't merge a contract violation, because **Gate C is branch-protected CI against a real backend.** Trust is never delegated to the thing doing the work — Gate A is one hostile critic, Gate C is the machine.

| Gate | Type | Who/what enforces | Blocks |
|------|------|-------------------|--------|
| A | **hard** | one hostile critic (adversarial-prd-reviewer) → committed verdict | ticket-writing until SHIP |
| B | soft | board-auditor + specflow-uplifter | orphans, dup IDs, gaps |
| B.5 | soft | pre-flight-simulator | CRITICAL design gaps before code |
| C | **hard** | branch-protected CI vs real seeded backend | merge on any contract/journey violation |

## The honesty rule running through all of it

*"It ran / it's green / the file says so" is not evidence.* Every claim is anchored to something real — the oracle for numbers, a real login for the backend. That is exactly why building correctly keeps **surfacing real bugs** instead of hiding them behind a green check.

---

## Runnable form — the loops

This process runs as two paired loops plus a meta loop. Each loop is split in two:

- **The PATH** — a reusable `.yaml` (the stages, gates, repair, `done_when`). Written once, story-agnostic.
- **The PROMPT** — thin and per-story: it only supplies *goal + inputs + automation* and says "follow the path." It does **not** restate the stages.

| Loop | Executable path (the YAML) | Explainer (prose) | Covers |
|------|----------------------------|-------------------|--------|
| **Spec-build** | [`QA/loops/spec-build.yaml`](QA/loops/spec-build.yaml) | [`QA/spec-build-loop.md`](QA/spec-build-loop.md) | Steps 0–5: discover → dueling PRD → **Gate A** → tickets → **Gate B/B.5** → defensible tickets |
| **Feature-build** | [`QA/loops/feature-build.yaml`](QA/loops/feature-build.yaml) | [`QA/feature-build-loop.md`](QA/feature-build-loop.md) | Step 6 (5 rails) → **Gate C** → a tested slice that survived CI |
| **Mistake-harvest** (meta) | — (scheduled routine) | `docs/routines/daily-mistake-harvest.md` (timebreez) | reads runs of both, finds skipped gates, updates the skills/contracts the loops depend on |

A loop is **path + thin prompt + automation (the tick) + durable state (committed artifacts)**. The YAML is the source of truth; if a prose explainer ever disagrees with it, the YAML wins. The gates are why the loops are trustworthy: the muscle never approves its own work.

## Path vs runtime — run the whole thing on either

Separate **what** from **how**:

- **The PATH (what)** — `QA/loops/*.yaml`. Runtime-agnostic stages, gates, repair, `done_when`. Single source of truth.
- **The RUNTIME / binding (how)** — a complete way to execute that path end-to-end on one tool:
  - [`PROCESS-CLAUDE.md`](PROCESS-CLAUDE.md) — the **whole** pipeline on Claude Code via the `Workflow` tool (`agent(schema)`, `parallel(critics)`, `pipeline()` + worktree).
  - [`PROCESS-CODEX.md`](PROCESS-CODEX.md) — the **whole** pipeline on Codex via goals + thread-automations.

**You can run the entire pipeline on Claude Code, or the entire pipeline on Codex** — you don't split a run across both. Each tool has strengths (Claude's `Workflow` shines at the judgment fan-outs; Codex's automations shine at long autonomous grind), but strengths are *guidance, not a forced split* — every runtime runs every stage. **Whichever runtime, the muscle never self-approves; Gate C (external CI) decides.**
