# PROCESS — idea → merged code you can trust

Specification depth is governed by `SPECIFICATION.md` (source kit:
`templates/SPECIFICATION.md`) and `scripts/specflow-tier.cjs`. Thin work stays
at planning depth; contracted reviews cover applicable decisions and UI paper
walkthroughs. The detailed build-ready procedures below apply only to the
selected slice and relevant seams. Reuse existing artifacts; N/A needs a reason.
Required privacy, permission, executable journey and release gates still apply.


The canonical reference for how we run work end to end. The spine in one line:

> **A single hostile critic gates the spec; CI gates the code; the swarm/agent is muscle *inside* a phase, never the thing that approves its own work.**

Trust is never delegated to the thing doing the work. Gate A is one hostile critic. Gate C is the machine. Everything between is muscle.

---

## Step 0 — Discover (human + agent vs. a real artifact)

Start from something real, not a blank page. Walk the **actual artifact** (a third-party export, an API response, a legacy table) and the **real repo** to find the true problem and the true constraints. **No swarm here** — just grounding.

*Output:* a rough problem statement + the real data/oracle it must satisfy.

## Step 1 — PRD, written by a dueling pair

For the selected contracted decisions, the builder drafts or reuses the relevant PRD material and the opposite CLI reviews it through Duo. Permit an initial review and one repair review; retain the issue/tier allowance across sessions. Same-family context switching is labelled honestly and does not supply the required independent peer. Thin backlog capture does not trigger this stage.

- **The rubric (7 passes):** JTBD coherence, requirement→implementation traceability, the two-engineer test, scope boundary, dependency/ordering, success-metrics audit, willingness-to-pay — plus a banned-language scan and a Ramen test.
- **The Special Mandate** (honesty-critical specs): a **reality-grounding ledger** (open every concrete repo claim the author makes and verify it) + a **loophole hunt** (actively try to find the gamed gate / fake backend / skip-to-green / always-green metric *surviving*).

*Output:* a hardened PRD. (Where the adversary catches "a real backend with nobody home," "all-green smuggled in as the metric," etc.)

## Step 2 — GATE A (HARD) — the adversary verdict

The scoped independent verdict and raw evidence govern promotion of the selected decisions. Local thin backlog capture can precede that review. GitHub issue creation still requires the scoped SHIP verdict and human approval; preserve the path's `never_without_human` actions. Contracted promotion requires its live scoped receipt; an ungraded fix or exhausted allowance stays blocked. Use initial + one repair and a no-new-evidence stop, retained across sessions and run names. Durable local evidence supports uncommitted work, so a per-review commit is not required.

## Step 3 — Tickets (Specflow)

`specflow-writer` records thin feature and future tickets with behaviour acceptance and explicit unknowns. Only the selected build-ready slice receives applicable Gherkin, selectors, contract references and executable journey mapping, reusing existing material. For canonical journeys the Gherkin lives **once** in the catalogue (`journeys-must-have.md`); the issue carries a headline + deep-link (don't triplicate the spec). This phase can fan out with ruflo for parallelism.

*Output:* scoped issues and applicable new or reused executable evidence; future tickets need no generated contract package.

## Step 4 — GATE B (soft) — audit + closure

`board-auditor` + `specflow-uplifter` check the selected build-ready slice and its material seams: applicable requirement → journey → test → issue links resolve, with no orphan requirements or duplicate IDs. Reuse existing artifacts and explain N/A decisions; future tickets remain thin.

## Step 5 — GATE B.5 (soft, its own gate) — pre-flight simulation

`pre-flight-simulator` examines the selected build-ready slice and its direct seams before production code. A contracted UI decision receives a bounded paper walkthrough. Thin future tickets need no full simulation. A relevant CRITICAL design gap blocks. (Cheaper to find "new staff land at zero balance" here than in the build.)

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
| A | **hard** | native independent scoped Duo review → durable receipt | promotion of the selected decisions without acceptance |
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
- **The host (how)** — the interactive agent owns the path and invokes the opposite CLI for read-only peer review:
  - [`PROCESS-CLAUDE.md`](PROCESS-CLAUDE.md) — Claude Code starts `/duo-build`; Codex reviews through `codex exec`.
  - [`PROCESS-CODEX.md`](PROCESS-CODEX.md) — Codex starts `$duo-build`; Claude reviews through `claude -p`.

**Start in either host.** The interactive builder stays in charge; the other model inspects frozen evidence and returns findings directly. Stop on missing peer access, missing evidence or an exhausted allowance. Required human approval and release gates remain in force.
