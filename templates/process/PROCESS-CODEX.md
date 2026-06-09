# Running this process in Codex (no loops — use goals + automations)

Companion to [`PROCESS.md`](./PROCESS.md) and the loop docs. Claude Code runs the process as programmatic **loops**. Codex has no loop construct — but it has **goals**, **automations**, and **thread automations**, which give you the same thing in pieces.

## The reframe: a loop is just three parts

| Loop part | Claude Code | Codex equivalent |
|---|---|---|
| The tick (what re-prompts) | `Workflow` / `/loop` | **automation** (schedule or thread trigger) |
| Durable state across iterations | in-run memory + journal | **the thread** + committed artifacts in the repo |
| Stop condition | `while` / `done_when` | **goal** (its done-criteria) |
| The path (stages/gates/repair) | `QA/loops/*.yaml` | **same `QA/loops/*.yaml`** — reused as-is |
| One iteration's instructions | thin prompt → the YAML path | **thin automation prompt → the same YAML path** |

So: **stop thinking "loop," start thinking "tick + a self-locating driver + a goal."** The *path* never lives in the prompt — it lives in [`QA/loops/spec-build.yaml`](QA/loops/spec-build.yaml) and [`QA/loops/feature-build.yaml`](QA/loops/feature-build.yaml). The automation prompt is **thin**: goal + inputs + automation, then "follow the path." Each run is *one* iteration that asks *"where am I?"* (by reading real state + the path), advances exactly **one gate**, persists to a real artifact, then stops / escalates / waits for the next tick. The YAML is the source of truth; if this doc ever disagrees with it, the YAML wins.

Because state lives in **committed artifacts** (the verdict file, journey contracts, the evidence note, ticket status) — never just in chat — this is *more* honest than an in-memory loop: it can't "remember" a green it never proved. That is the honesty rule, enforced by the architecture.

## The one limitation (and the workaround)

Codex automations are **time/thread-triggered, not event-triggered** — there's no "fire the instant CI goes red." So failure-routing happens two ways:
1. **Within a run** — the agent repairs inline (classify → fix → re-run) within its turn. Handles fast failures.
2. **Across runs** — for slow state (CI, a deploy), the *next tick* reads the state and picks up. Set the interval to match how fast that state changes (an 8-min CI run → don't tick every minute).

This changes *latency*, not *trust*: Gate A is a committed file either way; Gate C is branch-protected CI either way.

## Setup (one-time)

The agents are already Codex-installable:
```bash
git clone https://github.com/Hulupeep/adversarial-prd-reviewer ~/.codex/skills/adversarial-prd-reviewer
# Specflow companion: https://github.com/Hulupeep/Specflow
```
Then create the three automations below, each with the matching goal.

---

## Automation 1 — Spec-build (goal: hardened PRD + defensible tickets)

**Path:** `QA/loops/spec-build.yaml` (the prompt below follows it; it does not restate it).
**Goal / done-criteria:** a committed verdict artifact says `SHIP` (or `SHIP WITH STIPULATIONS`) and specflow-audited tickets exist for `<X>`.
**Trigger:** thread automation (re-enters the same thread until the goal is met).

> You are advancing the SPEC-BUILD loop for `<X>` (PROCESS.md Steps 0–5). This is one tick — locate, advance one gate, persist, then stop or wait.
> 1. **Locate.** Read the thread + repo: is there a PRD at `PRDs/<slug>-prd.md`? A committed verdict artifact? Audited tickets? Decide which step is next.
> 2. **Advance one gate:**
>    - No grounding yet → discover against the REAL artifact; write a grounded problem statement. Stop.
>    - Grounded, no PRD → draft the PRD. Stop.
>    - PRD exists, not SHIP → run `adversarial-prd-reviewer` as a single hostile critic (7-pass + Special Mandate: verify every repo claim, hunt loopholes). Fix each FATAL/SERIOUS *in the document*. Write the verdict to a **committed verdict artifact**. If not yet SHIP, stop (next tick re-attacks).
>    - **GATE A:** verdict = SHIP → escalate to the human for approval before creating issues.
>    - SHIP approved → `specflow-writer` creates tickets; **GATE B** = `board-auditor` + `specflow-uplifter` wire every ticket to a journey + test + contract, kill orphans/dupes, re-audit to compliant; **GATE B.5** = `pre-flight-simulator` walks personas, block on a CRITICAL gap.
> 3. **Persist** to real files (PRD, verdict artifact, contracts, issue links) — never only to chat.
> 4. **Stop** when audited tickets exist + verdict SHIP. Escalate on DO-NOT-SHIP, an unclosable FATAL, an ownerless UNRESOLVED gap, or a wrong idea. Otherwise the automation re-fires.
>
> Rule: the writers are muscle; trust lives in GATE A — one hostile critic, never the agents agreeing with themselves. A gap named with an owner beats a fake green.

---

## Automation 2 — Feature-build (goal: ticket merged via Gate C)

**Path:** `QA/loops/feature-build.yaml` (the prompt below follows it; it does not restate it).
**Goal / done-criteria:** branch for `#<issue>` is green on branch-protected CI and merged (or ready-for-review with CI green).
**Trigger:** thread automation per ticket; interval matched to CI duration.

> You are advancing the FEATURE-BUILD loop for `#<issue>` (PROCESS.md Step 6→7). One tick — locate, advance one rail, persist, then stop/wait. **Trust lives only in Gate C; you and the swarm are muscle, never self-approval.**
> 1. **Locate.** Read the branch + thread: which of the 5 rails is done? What is CI saying right now?
> 2. **Advance one rail** (in order): ticket exists → contract YAML promoted stub→full → real-backend e2e test → **assertions oracle-anchored** (every number traced to the live calc / real source — never guessed) → implementation that passes. Use `/qa`, multicheck, or the swarm as muscle (swarm only if a trigger fires); spot-check `/qa` before trusting it.
> 3. **Persist** the diff + an evidence note (WHERE/WHICH/HOW MANY/SKIPPED, audit row per state mutation, oracle for each asserted number).
> 4. **GATE C:** read branch-protected CI vs the REAL seeded backend. Green → stop at "ready for review" (never push/PR/merge/--no-verify without the human). Red → repair inline within budget; if slow, the next tick re-reads. Budget exhausted or ambiguous AC → escalate.
>
> Rule: keep the slice under 1000 lines (else propose a 4–8 slice split). "It's green" is not evidence until Gate C says so against real data.

---

## Automation 3 — Mistake-harvest (no goal — a recurring tick)

**Trigger:** scheduled daily automation. No goal/stop — it just runs each day.

> Run the daily mistake-harvest (see `docs/routines/daily-mistake-harvest.md`): read the last 24h of threads across repos, find repeated AI and HITL mistakes (cite real sessions), update the cross-project skill that prevents the dominant pattern, and emit a ≤100-line report. Read-only on transcripts; the only writes are the report + skill files; never commit/push/PR.

---

## Why it still holds in Codex

The gates don't depend on the loop being programmatic. Gate A is a committed verdict file; Gate B is the specflow auditor's compliance pass; Gate C is branch-protected CI on real data. Codex ticks the work instead of looping it — same soft front, same two hard walls, same rule: **the muscle never approves its own work.**
