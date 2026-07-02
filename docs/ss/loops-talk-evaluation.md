# Evaluating Anthropic's "Building Long-Running Agents" Against Specflow's Loop Runtime

**Date:** 2026-07-01
**Author:** Analysis for the `fable-loop-compounding` work (#83–89)
**Talk source:** `docs/ss/loops.md` (transcript; slide images alongside in `docs/ss/*.png`). Citations below use the transcript's section titles and timestamps, e.g. *(loops.md § "The generator-evaluator contract", ~24:56)*.

---

## 1. Context

The talk is an Anthropic applied-AI session (Andrew + Ash) on harnesses for agents that run for hours-to-days. First half is a history of Claude Code primitives; second half is the current state-of-the-art harness pattern: a **planner → generator → evaluator** loop with adversarial pressure, file-system state, and granular contracts.

Our recent work is the same problem from the other side. The local runtime lives in `scripts/specflow-runner.cjs` (the `specflow run` command: `spec-build` / `feature-build` loops, `run-contract.yaml`, `ledger.jsonl`, `claude-print`/`codex-exec` adapter policies, a verifier registry, `never_without_human` enforcement, `--until-terminal`). The `fable-loop-compounding` packet (#83–89, branch `specbuild/fable-loop-compounding`) is **explicitly our response to this talk** — its PRD goal is *"Adapt Specflow for stronger long-horizon agent models without weakening gates"* and treats "Fable-class models as high-capability workers and orchestrators, not as trusted gates."

This document evaluates how well that packet — and the runtime it extends — lines up with what Anthropic actually reported, where we're ahead, where we diverge, and what to change.

**Bottom line:** the talk is strong external validation of Specflow's core bet (granular contracts + file-system state + no self-grading), and #83–89 is the right set of moves. But there is one philosophical tension to resolve on purpose (planner granularity), and two gaps the packet does not cover (a verifier that drives the running product; trace-review tooling).

---

## 2. What the talk validates about what we already shipped

Three existing Specflow invariants are the talk's hard-won lessons, arrived at independently:

1. **"Self-evaluation is a trap — use an adversarial evaluator."** *(loops.md § "Key takeaways for long-running agents", ~38:56; § "The evolution…", the GAN framing ~18:27–20:42)* → our `I-ADAPTER-001`: *"a provider process exit code is never a Specflow gate result"* and `I-LOOP-002`. We already refuse to let the generator grade itself.
   - **We're ahead here.** Their evaluator is still an LLM and is *sycophantic out of the box* — they spent "an exorbitant amount of time" tuning it *(§ "Specificity in contracts and debugging traces", ~32:40)*. Our mechanical gates (`verify-seams`, `verify-adr`, `provenance-gate`) are deterministic scripts and **cannot be flattered**. Wherever the gate is mechanical, we sidestep their single hardest failure mode.

2. **"Compaction ≠ coherence — use the file system for shared state."** *(§ "Key takeaways…", ~39:09; § "How to build your own…", ~36:26; breadcrumb JSON state, ~54:54)* → our `run-contract.yaml` + `ledger.jsonl` + resumable `runUntilTerminal`. Their "leave breadcrumbs (tried X, found bug, fix worked ✓)" log *is* our ledger. Their note that **models overwrite markdown but not JSON** *(§ "First long-running agent patterns", `feature_list.json`, ~12:34)* validates our `.jsonl` choice for machine state.

3. **"Granular criteria → actionable critique; vague criteria → the generator shrugs."** *(§ "Specificity in contracts and debugging traces", "27 contract criteria", ~32:04)* → Specflow's entire thesis (named invariants, ACs, journey IDs). They reinvented our contract granularity as the thing that made long runs work.

One place we are **stricter than the talk, correctly**: in their GAN loop the evaluator's verdict effectively *is* the gate. In Specflow every LLM judgment is **evidence subordinate to a mechanical gate** (#84: "Gate advance remains blocked until the owning script/verifier gate passes"; #88: "vision verdict is evidence, not self-attested gate pass"). This is a better answer to their own unsolved sycophancy problem. Keep it.

---

## 3. Ticket-by-ticket mapping (#83–89)

| Ticket | Talk lesson it implements | Citation | Verdict |
|---|---|---|---|
| **#84 VERIFIER-01** | Generator/evaluator split. "Verifier input is artifact + rubric, **not maker reasoning trace**" is verbatim their Q&A answer. | § generator-evaluator contract ~24:56; Q&A ~1:00:05 ("feeding the trace muddies the two model streams; let it judge the output") | Right idea, **underscoped** — §4, §5. |
| **#85 STATE-01** | File-system state + breadcrumbs; STATE.md sections map 1:1 to their tried/fixed/worked log. "Don't save facts already in repo/contracts/transcripts." | § "Key takeaways…" ~39:09; breadcrumbs ~54:54 | Correct. Machine state in jsonl, STATE.md append-only. |
| **#86 WORKTREE-01** | Git worktrees for parallel maker/verifier without file collisions. | Q&A ~1:07:04 (Andrew: "git work trees so you're not overwriting the file system") | Correct and durable. |
| **#83 MODEL-ROUTING-01** | "Opus for planning, Sonnet as workhorse"; model selection informs harness. Our "silent downgrade = failed contract" honesty rule goes **beyond** the talk. | § "Opus 4.5 and the role of sub-agents" ~11:02; Q&A model-selection-informs-harness ~53:07 | Split value — see §6 (co-evolution risk). |
| **#87 ROUTINE-01** | Their long runs live on remote servers via the Agent SDK, **not** Claude Code on a laptop. Our REQ-05B ("hosted scheduling out of scope for the local runner") + "all variants call `specflow run`, no parallel loop process" is the posture they endorse. | Q&A ~57:10–58:24 (Agent SDK for cloud/sandboxed runs; "caffeinate on your machine") | Correct posture; resist scope creep. |
| **#88 VISION-GATE-01** | Evaluator opening live pages / screenshots / vision. Partial coverage of "evaluator uses the app." | § "…experimental work… design taste" ~22:22; play-mode demo ~30:33 | Correct but narrow (UI-only). |
| **#89 COST-01** | The "$200 / six hours… half the cost" thread; cost-per-accepted-change. | § retro-game demo ~29:02; § "Adjusting harnesses…" ~36:39 | Prudent; transient — see §6. |

---

## 4. The core tension: planner granularity

This is the talk's **biggest architectural claim**, and it cuts against Specflow's grain, so decide it deliberately.

> The planner should be *deliberately high-level* — set creative direction and hard outer lines only. It must **not** plan granular technical details, because a planner error "cascades through every single one of these sprints and magnifies errors over a multi-hour time horizon." The granular, testable assertions get **negotiated at build time between the generator and evaluator**, written to disk, and the evaluator grades against *that* contract — "not the original spec which the planner has one-shotted."
> — *loops.md § "Introducing the 'Planner' role", ~23:45; § "The generator-evaluator contract", ~24:56*

They frame this explicitly as the fix for **both** Ralph's fixed `plan.md` *and their own earlier harness* — an initializer that pinned ~200 features up front and was then "forced into" bad design decisions *(Q&A ~52:45)*. Their headline finding: **the stronger the model, the *less* you should pre-specify.**

Specflow's `spec-build` is the opposite. It front-loads prd + tickets + falsification + seams + ADR + journeys + simulation, then `feature-build` executes against that pinned plan. Structurally, **that is the *old* Anthropic harness they moved away from.**

**Reasoning about why this is still fine for us — and where to bend:**

- Our defense is legitimate and the talk concedes it. Specflow targets brownfield, multi-session, team, auditable, no-ticket-no-code, CI-enforced work, where a *durable pinned contract is the product* (traceability, compliance, PR-blocking). Their harness is greenfield one-shot demos where nobody audits *why*. They admit brownfield "needs more control… custom rubrics" and is "more suited towards brand-new applications" *(Q&A ~1:11:00)*. So we do **not** throw out spec-build.
- But absorb the lesson by moving where granularity lives:
  - Keep **ticket ACs / invariants / `never_without_human`** as the durable *outer* contract (creative direction + hard constraints).
  - Push the fine-grained "what does *done* mean for this slice, tested how" into a **maker↔verifier negotiation sub-stage inside #84**, written to disk *before* the maker builds. That back-and-forth ("scope too big, tests too weak, you missed edge case Z") is *the one primitive the talk says Ralph never had*, and #84 currently under-specifies it — it reads as a static plan reviewer, not a negotiation.
- Practical guardrail: resist the urge to pin more detail in spec-build "because the model is stronger." The talk's evidence says that magnifies cascade errors. Spec-build owns the **WHAT** (journeys, invariants, forbidden actions); #84 owns the **HOW-verified**.

---

## 5. Two gaps the packet misses

**Gap 1 — the verifier must drive the running product, not just check artifacts.** *(Highest leverage.)*
Their evaluator uses Playwright/vision to *actually play the game, press the arrow keys, read console and network errors* — and that is what caught route-ordering, boolean-logic, and "space bar does nothing" bugs that a Ralph loop's CI sailed past *(§ retro-game play-mode ~30:33–31:18; "the evaluator actually launched the game, tried to play it" ~30:58)*. Our verifiers are mostly **static** (grep-like scripts, schema, provenance); #88 adds UI vision but only at teardown/Gate D.
→ **Broaden #84** so a verifier policy can name an *adversarial runtime verifier* that exercises the built thing against a granular, weighted rubric — and instruct it to default to **refute/harsh** (their explicit counter to LLM-verifier sycophancy, § ~32:40). "External plan reviewer / Oracle" is the weakest, most static form of what they demonstrated.

**Gap 2 — trace-review tooling.**
The talk's #1 practical claim is that the primary debugging loop is **reading transcripts by hand**; piping them to another agent is only a "first pass," and observability for long runs is unsolved green-field software *(§ "Specificity…" ~33:26; Q&A ~1:01:25 "read the whole thing"; Q&A ~1:06:45 observability unsolved)*. We produce the ideal artifact for this (`ledger.jsonl` + `transcript_path`) but ship **zero** tooling to triage it or surface where the maker's judgment diverged from the gate.
→ Clean candidate **#90**: a `specflow run trace` / divergence report. No current ticket covers the single most-used debugging practice in the talk.

---

## 6. Co-evolution risk (applies to #83, #89)

Their closing meta-lesson is a warning against exactly the elaborate config #83/#89 add:

> "The lesson isn't our harness was wrong, but rather it was right for 4.5 — the frontier moved." They *dropped* context-resetting and per-sprint evaluator cadence once 4.6 could hold a two-hour coherent build. "Get a feel for the spiky behaviors of any individual model, then adapt your harness to fill the gaps… I'd be hunting for the model release where I can strip it out."
> — *loops.md § "Adjusting harnesses as models evolve", ~34:14–36:08*

Sort the seven tickets by **durability**, not just alignment:

- **Model-independent trust primitives — build with confidence:** #84 (verifier separation), #85 (state/lessons), #86 (worktree isolation), plus the existing `never_without_human` guardrails. These survive any model generation.
- **Durable core inside a transient wrapper:** #83's *honesty* rule (requested-vs-effective model; silent-downgrade = failed contract) is durable; the effort-tier taxonomy (`low/high/xhigh/ultracode`) and #89's cost-per-change dashboards are the scaffolding most likely to be obsoleted by a cheaper/more-honest next model. Build them thin, keep them behind the ledger, be willing to delete.

Add one line to the PRD operating model: *the harness stays minimal and gate-centric, and scaffolding is removed as models improve.* Today the PRD says "without weakening gates" (the safety half) but not the "strip it back" half.

---

## 7. Values divergence — keep ours; it's a feature

The talk is deliberately "AGI-pilled": minimize human checkpoints, bake fixes into the harness, use hooks only for stop conditions *(Q&A ~1:08:17)*. Specflow's `never_without_human` (push/PR/merge/`--no-verify`/override, **mechanically** enforced from provider events via `forbiddenFromProviderEvents`) is the opposite by design. Do **not** converge on their default.

Their own answer to "what if I want to review mid-run" is "implement hooks at a stop condition" — our `never_without_human` *is* that hook, made declarative and enforced. The fable PRD non-goals ("auto-trusting Fable output as a gate," "routines pushing/merging without approval") are the correct guardrails and directly counter the talk's more permissive posture. For brownfield/team/production work, our stance is more appropriate than theirs.

---

## 8. Top recommendations (ranked)

1. **Broaden #84 before building it.** Add (a) a **maker↔verifier contract-negotiation sub-stage** written to disk before the maker builds, and (b) an **adversarial *runtime* verifier** (Playwright/vision-driven, harsh weighted rubric, defaults to refute), not just an external plan reviewer. Keep "artifact + rubric, not maker trace." *This is the talk's core and our biggest current gap.*
2. **Ship #85 + #86 next.** Durable, model-independent, low regret. Keep machine state in `jsonl` (overwrite-resistant), `STATE.md` append-only, and enforce the "don't duplicate repo/contract/transcript facts" AC.
3. **Open #90: trace-review tooling.** A `specflow run trace` / divergence report over `ledger.jsonl` + transcripts. It's the #1 debugging practice in the talk and nothing covers it.
4. **Build #83 / #89 thin.** Implement the honesty/ledger parts; keep the effort-tier taxonomy and cost dashboards minimal and disposable. Add the "strip scaffolding as models improve" line to the PRD.
5. **Hold the conservative line on #87 / #88.** No parallel scheduler (all variants call `specflow run`); vision/routines are evidence-only and cannot bypass human gates. The talk confirms hosted/background execution belongs to the Agent SDK, not the local runner.
6. **Reaffirm the trust boundary as a headline, not a footnote.** Our mechanical gate + `never_without_human` is the answer to the two hardest unsolved problems in the talk (sycophantic self-grading; human-in-the-loop for high-stakes work). Lead with it in README/positioning.

---

### Appendix — key talk citations

| Claim | loops.md location |
|---|---|
| Self-eval is a trap → adversarial evaluator | § "Key takeaways…", ~38:56; GAN framing ~18:27 |
| Tuning a harsh standalone critic is tractable; a self-critical builder is not | ~19:50–20:42 |
| Subjective quality is gradable via a weighted rubric (design/originality/craft/functionality) | § "Evaluating subjective output with rubrics", ~21:31 |
| Planner stays high-level; granular planning cascades errors | § "Introducing the 'Planner' role", ~23:45 |
| Generator/evaluator negotiate "done" on disk; grade the negotiated contract, not the spec | § "The generator-evaluator contract", ~24:56 |
| 27 contract criteria; granular → agent fixes the exact line | § "Specificity in contracts…", ~32:04 |
| Evaluator drives the app (plays the game) and catches behavioral bugs CI misses | ~30:33–31:18 |
| Read the traces by hand as the primary debugging loop | ~33:26; Q&A ~1:01:25 |
| Strip scaffolding as models improve; right for 4.5, frontier moved | § "Adjusting harnesses as models evolve", ~34:14 |
| File system for shared state; models don't overwrite JSON | § "First long-running agent patterns", ~12:34; ~36:26 |
| Verifier should NOT get the maker's reasoning trace | Q&A ~1:00:05 |
| Git worktrees for parallel work | Q&A ~1:07:04 |
| Hosted/long runs belong to the Agent SDK, not laptop Claude Code | Q&A ~57:10 |
| This pattern is greenfield-biased; brownfield needs custom control | Q&A ~1:11:00 |
| Models willingly throw everything away and restart | Q&A ~46:37 |
