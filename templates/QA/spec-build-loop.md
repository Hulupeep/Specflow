# Spec-build loop — rough idea → hardened PRD → defensible tickets

This is the **upstream sibling** of [`feature-build-loop.md`](./feature-build-loop.md). They are two different loops with a clean handoff:

| | Spec-build loop (this file) | Feature-build loop |
|---|---|---|
| Starts at | a rough idea / a real artifact / a half-built repo | a *ready* ticket |
| Ends at | a mixed-tier backlog; selected work has scoped readiness evidence | a tested code slice + evidence |
| Output lives in | **gmh-docs** (`PRDs/`, `QA/journeys/`) + the issue tracker | the code repo (claims-monorepo) |
| Runs in | **gmh-docs** — this is a *documents* loop, not a code loop | claims-monorepo |

It drives the pipeline you already documented in [`adversarial-prd-reviewer/PIPELINE.md`](https://github.com/Hulupeep/adversarial-prd-reviewer) + Specflow — the difference is the loop runs the steps and routes the verdict, instead of you hand-prompting each one. The point of "design loops that prompt your agents" applies here *first*: most rework starts with a spec that was never made honest.

Scope discipline: one loop, one PRD at a time. Its job is **honesty, not perfection** — its happy-path output can still carry UNRESOLVED gaps, as long as each has an owner.

> **Executable path:** [`QA/loops/spec-build.yaml`](./loops/spec-build.yaml) is the source of truth (stages, gates, repair, `done_when`, the per-tick progress map). **This doc is the prose explainer.** If the two ever disagree, the YAML wins.
>
> **You don't paste the contract below into a prompt.** The prompt is thin — goal + inputs + automation — and points at the YAML:
> ```
> Goal:   <e.g. SHIP the TT-ROLLBACK spec — hardened PRD + audited tickets>
> Path:   QA/loops/spec-build.yaml
> Inputs: { slug: <slug>, grounding_ref: <the discovery thread / artifact; no PRD need exist yet> }
> Automation: thread automation — re-fire until the path's done_when is met.
> Each tick: load the path, locate the stage from committed artifacts, advance ONE gate, persist, stop/escalate. Don't restate the path — follow it.
> ```

---

## PART 1 — THE LOOP CONTRACT

```yaml
loop: spec-build
runs_in: gmh-docs            # PRDs + journeys are documents; they live here
emits_tickets_to: AI-Claims-LLC/claims-monorepo   # issues only — no code
version: 1
input:
  source: required           # rough idea, a real artifact (Excel/API/table), or existing repo state
  prd_path: PRDs/<slug>-prd.md
discovery:                   # the front end — do NOT start at a blank PRD
  - point the agent at the REAL artifact (the actual export / API response / legacy table)
  - think out loud against it; capture intent, constraints, "what breaks it?"
  - gate: a draft PRD seeded with real-data facts, not assumptions
# This loop is PROCESS.md Steps 0–5. The dueling pair + writers are MUSCLE;
# the trust gate is GATE A — one hostile critic, NOT the agents' self-consensus.
stages:
  1_draft:       writer agent → PRDs/<slug>-prd.md   [muscle]
                 check: JTBD, scope, acceptance, metrics, deps all present
  2_adversary:   adversarial-prd-reviewer (7-pass rubric + Special Mandate)   [one hostile critic]
                 verify EVERY repo claim (reality-grounding ledger), hunt loopholes surviving
                 (fake backend, no-data, skip-to-green, weakened assertions, forks)
  3_revise:      writer fixes each FATAL/SERIOUS in the document; critic re-reads to close
                 at most one repair/review via scoped Duo; then stop or escalate
  GATE_A:        # HARD — the trust gate of this loop (PROCESS.md Step 2)
                 verdict ∈ {SHIP, SHIP WITH STIPULATIONS} written to a COMMITTED verdict artifact;
                 gate selected-decision promotion and human-approved GH issue creation; local thin backlog capture may precede review; UNRESOLVED items owner-tagged
  4_specflow:    specflow-writer → mixed-tier outcomes; future tickets stay thin
                 check: selected build-ready UI slice reuses its applicable journey contract reference
  GATE_B:        # soft — board-auditor + specflow-uplifter; selected build-ready slice and applicable seams only
                 check: selected scope has applicable requirement→journey→test→issue coverage, no orphans or duplicate IDs
  GATE_B5:       # soft, its own gate — pre-flight-simulator walks real personas through the selected build-ready slice
                 check: no CRITICAL design gap ("won't work for a real user") survives, before code
repair:                      # replaces YOU re-prompting between steps
  on_gate_fail: route back to the owning stage with a targeted prompt
  budget: contracted initial + one repair; build-ready initial + one re-grade; no-new-evidence stops
  on_budget_exhausted: ESCALATE with the open FATAL/SERIOUS list
human_gate:                  # the ONE escape hatch
  escalate_when:
    - adversary verdict = DO NOT SHIP, or a FATAL cannot be closed in the document
    - discovery reveals the idea is wrong (kill it — don't spec the wrong thing)
    - an UNRESOLVED gap has no willing owner
  approve_before: creating GH issues   # tickets are created only from a human-approved SHIP verdict
  never_without_human: [create epics/issues from a DO-NOT-SHIP PRD, fabricate a green verdict]
done_when:
  - for selected contracted promotion or GH publication, applicable PRD/verdict has SHIP evidence and required approval; thin planning can stop before this
  - mixed-tier backlog exists; only the selected build-ready slice has applicable journey evidence; UNRESOLVED items owner-tagged
  - HANDOFF: those ready tickets are the INPUT to the feature-build loop
```

---

## PART 2 — THE DRIVER PROMPT

Run in gmh-docs: *"Run the spec-build loop from QA/spec-build-loop.md on <source>."*

> You are the **driver** of the spec-build loop in `QA/spec-build-loop.md` — PROCESS.md Steps 0–5. You turn a rough idea / real artifact into defensible tickets by running the pipeline — you do not free-style a PRD. **The writers are muscle; trust lives in GATE A — one hostile critic, never the agents' self-consensus.**
>
> 1. **Discover first.** Read the real artifact the user points at. Surface its actual facts (row counts, edge cases, "31% mismatch") and push on "what breaks it?" before drafting. Never start from a blank PRD on assumptions.
> 2. For the selected contracted decisions, **draft or reuse** the relevant PRD material at `PRDs/<slug>-prd.md`, then run the **adversarial-prd-reviewer** as a single hostile critic (7-pass rubric + Special Mandate: reality-grounding ledger over every repo claim, loophole hunt). Apply each FATAL/SERIOUS fix *in the document* and request at most one repair review via scoped Duo; stop on unchanged evidence or exhausted budget. An honest UNRESOLVED gap with an owner is allowed; a fabricated green is not.
> 3. **GATE A (hard):** write the verdict (`SHIP` / `SHIP WITH STIPULATIONS` / `DO NOT SHIP`) to a **committed verdict artifact**. Use that verdict to gate selected-decision promotion and human-approved GitHub issue creation. Local thin backlog capture can precede this review. This critic is deliberately not the swarm approving itself.
> 4. Record useful future outcomes as thin tickets. Deepen only the selected slice and directly relevant shared decisions. For that build-ready slice, reuse applicable journey/test/contract references; GATE B checks its coverage and GATE B.5 performs scoped persona pre-flight. Neither gate forces future tickets through full uplift or simulation.
> 5. **Get human approval of the SHIP verdict before creating GH issues.** Never spec the wrong thing: if discovery shows the idea is wrong, say so and stop. Never create tickets from a DO-NOT-SHIP PRD.
> 6. End with the current tiers, applicable verdict/evidence paths, the mixed-tier backlog and every UNRESOLVED gap with its owner. Hand only verified build-ready work to feature-build; thin planning can stop without producing a full PRD package.
>
> Guardrails: honesty over completeness; the adversary makes the spec honest, Specflow bakes the truth in; a gap named with an owner beats a fake green every time.

---

## The two-loop system

```
  idea / artifact ─▶ [ SPEC-BUILD LOOP ]  ─▶ defensible tickets ─▶ [ FEATURE-BUILD LOOP ] ─▶ tested slice
   (gmh-docs)         PRD → adversary → specs        (handoff)        ticket → /qa → swarm      (claims-monorepo)
                      → uplift → preflight                            → evidence → human gate
```

And a third, meta loop closes it: the **daily mistake-harvest routine** reads runs of *both* loops, finds where a stage got skipped (no adversary pass, no journey contract, slice over 1000 lines) and updates the skills/preamble/contracts the loops depend on. Spec-build makes it honest; feature-build makes it real; harvest makes the loops themselves better.
