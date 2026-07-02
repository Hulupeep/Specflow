TL;DR — **the repo is heading in the right direction, but the frontier-model problem is not “make Specflow understand Fable.” The problem is: Fable-class agents are now strong enough to run long, coherent, expensive, plausible, partially autonomous loops — and that makes weak harness boundaries lethal.**

Specflow will work if it stays a **gate/runtime harness**. It will fail if it becomes a decorative YAML/process pack, or if it lets Fable’s own confidence become evidence.

The sharp version:

**Fable can now carry the work. Specflow must carry the trust.**

## What changed with frontier models

Fable-class models change the operating problem in five ways.

First, the model can now run longer and make more complex changes. Anthropic says Fable 5 leads most on longer, more complex tasks, can work autonomously longer than previous Claude models, and performs strongly on software engineering, vision, memory, and long-context work. It also uses safeguards that may route some requests to Opus 4.8, and Anthropic explicitly says those safeguards may catch harmless requests. ([Anthropic][1])

Second, the model needs **less scaffolding**, but not **no scaffolding**. Anthropic’s prompting guide says older skills and prompts can be too prescriptive for Fable 5 and may degrade output. It recommends explicit self-verification, fresh-context verifier subagents, memory systems, progress grounding, and removing old instructions when the model does better without them. ([Claude Platform][2])

Third, long-running agents need **state outside the model**. Your attached analysis says the durable core is file-based state, structured handoffs, planner/maker/judge split, and no self-grading. The Anthropic transcript says the same thing: context, planning, and judgment are the three reasons agents lose the plot; compaction does not solve coherence by itself; and file-system state is the reliable coordination surface.  

Fourth, Fable creates a provenance problem. A run may request one model, receive another effective model, fallback, partial refusal, or different safety behavior. Specflow 0.10.0 is already reacting correctly: it records role, effort, requested model, effective/reported model, fallback, budget, usage, and cost-per-gate accounting, and says silent model downgrade is not acceptable evidence. ([GitHub][3])

Fifth, the biggest danger is now **plausible completion**. The repo README already has the core insight: LLMs drift, specs compete with training priors, and prompts are not enough; contract tests and journey tests must break the build when violated. ([GitHub][4])

## My deeper read of Specflow now

Specflow is no longer just “specs that enforce themselves.” It is becoming a **control loop runtime for untrusted autonomous work**.

That is the right category.

The repo now has the correct major pieces: `specflow run`, durable run contracts, ledger entries, loop kits, adapter policies, mechanical gates, journey tests, CI hooks, and Gate C/Gate D language. The README says the loop runner writes a durable run contract and ledger so agents execute the loop instead of merely referencing it; CI and hooks catch violations; journey tests use Playwright for critical flows. ([GitHub][4])

That is exactly the harness shape frontier models need:

| Frontier-model failure                          | Specflow answer                        | Current status          |
| ----------------------------------------------- | -------------------------------------- | ----------------------- |
| Long run forgets why it started                 | `run-contract.yaml` + `ledger.jsonl`   | Good core               |
| Model says “done” too early                     | Mechanical gates                       | Strong                  |
| Model implements plausible UI with dead backend | Journey tests / Gate D                 | Needs runtime hardening |
| Model self-reviews generously                   | Independent verifier / no self-grading | Partly open             |
| Model fallback/downgrade hidden                 | Requested vs effective model metadata  | Correct direction       |
| Long run impossible to debug                    | Trace tooling                          | Still weak              |
| Subagents collide in repo                       | Worktree isolation                     | Still open              |
| Model scaffolding becomes stale                 | Harness-minimal rules                  | Still open              |

## The real problem for Fable running

The problem is **not capability**. Fable has enough capability to make Specflow valuable.

The problem is **authority**.

A frontier model wants to become planner, implementer, verifier, summarizer, and judge. It is good enough that you will be tempted to let it. That is the failure path.

Specflow must enforce this split:

**Planner proposes scope. Maker produces change. Verifier attacks the change. Gate decides. Ledger remembers. Human authorizes unsafe boundaries.**

The attached evaluation gets this right: the model is swappable; the check is not. The adapter is an actuator. The gate is the sensor. Provider output and provider exit codes must never become the verdict. 

That is the product.

## Where Specflow is ahead

Specflow is ahead on **mechanical trust**.

Anthropic’s own loop still depends heavily on an LLM evaluator. Their transcript says out-of-the-box Claude was a poor QA agent: it could identify legitimate issues, then talk itself into approving them anyway. Your attached deck explicitly calls out that Specflow is ahead where the critic is not an LLM but a deterministic script.  

That matters. A harsh LLM verifier is useful. A script is better. A script cannot be flattered, hurried, bored, or persuaded by the maker’s narrative.

Specflow also has the right commercial wedge: **“frontier agents can produce the work; Specflow decides what counts.”**

That is stronger than “AI coding workflow.”

## Where Specflow is still exposed

The biggest gap is **runtime verification**.

Your docs say the Anthropic evaluator drove the app with Playwright, clicked around, read console/network errors, and caught bugs like route ordering, boolean logic, missing keyboard behavior, and dead interactions. Those are exactly the bugs static contract checks miss.  

Specflow has journey tests, but the frontier-loop version needs a first-class runtime adversary:

| Needed                                            | Why                                     |
| ------------------------------------------------- | --------------------------------------- |
| Verifier launches app                             | Static diffs are not enough             |
| Verifier drives actual journey                    | “Looks done” is the frontier-model trap |
| Verifier reads console/network/backend state      | UI-only screenshots are weak evidence   |
| Verifier writes findings separately               | Maker cannot grade itself               |
| Gate consumes verifier evidence, not maker claims | Keeps trust boundary intact             |

So #84 and #92 are the keystone. Not #83. Not cost. Not model routing.

**The whole thing lives or dies on verifier design.**

## Ticket priority: reorder the backlog

Your current open list is good, but I would reorder it.

| Priority | Ticket                  | Why                                              |
| -------- | ----------------------- | ------------------------------------------------ |
| 1        | **#84 / #92 Verifier**  | This is the core trust boundary                  |
| 2        | **#93 Trace**           | You cannot improve what you cannot inspect       |
| 3        | **#85 State**           | Long runs need durable memory                    |
| 4        | **#86 Worktree**        | Delegated agents need isolation                  |
| 5        | **#83 Model routing**   | Important, but subordinate                       |
| 6        | **#94 Harness minimal** | Prevents Fable-era over-scaffolding              |
| 7        | **#88 Vision gate**     | Useful evidence, not a gate                      |
| 8        | **#89 Cost**            | Necessary for commercial use, not trust-critical |
| 9        | **#87 Routine**         | Only after the above are safe                    |
| 10       | **#97 Audit skill**     | Important docs hygiene, not runtime-critical     |

GitHub currently shows #83 through #89 plus #92, #93, #94, and #97 open, including model routing, independent verifier, state, worktree, vision, cost, trace, and harness-minimal issues. ([GitHub][5])

## What #84 must become

Do not implement #84 as “another reviewer prompt.”

That would be too weak.

#84 should define a **Verifier Contract Lifecycle**:

| Stage                                | Output                          | Rule                                 |
| ------------------------------------ | ------------------------------- | ------------------------------------ |
| Maker proposes verification contract | `verification-proposal.md/json` | Before code                          |
| Verifier rejects/accepts             | `verification-contract.json`    | Must be stricter than maker proposal |
| Maker builds                         | Code + evidence                 | Cannot mark done                     |
| Verifier runs runtime checks         | `verifier-findings.jsonl`       | Separate context, no maker trace     |
| Gate decides                         | pass/fail                       | Mechanical or script-backed          |
| Ledger records divergence            | `ledger.jsonl`                  | Maker claim vs verifier result       |

Key invariant:

**Verifier sees artifacts, app behavior, spec, and rubric. Verifier does not inherit maker reasoning.**

Your attached docs flag this exact point from the Anthropic Q&A: feeding the maker trace to the verifier muddies the streams and makes the verifier more likely to inherit the maker’s delusion. 

## The planner-granularity trap

This is the subtle architectural risk.

Specflow’s instinct is to front-load detail: PRD, tickets, ACs, invariants, seams, journeys, falsification, audit. That is correct for brownfield and paid work.

But Fable-class models punish over-prescription. Anthropic’s prompting guide says older skills may be too prescriptive and should be reviewed or removed when default Fable performance is better. ([Claude Platform][2]) Your attached evaluation says Anthropic moved away from huge up-front feature lists because early wrong decisions cascaded through later work. 

So the fix is not “less Specflow.”

The fix is **split contract levels**:

| Contract level    | Owner                        | Detail                                                     |
| ----------------- | ---------------------------- | ---------------------------------------------------------- |
| Outer contract    | Specflow/spec-build          | JTBD, invariants, forbidden actions, acceptance boundaries |
| Slice contract    | Maker + verifier negotiation | Concrete runtime checks for this change                    |
| Gate contract     | Specflow scripts/CI          | Deterministic pass/fail                                    |
| Evidence contract | Ledger                       | What happened, what model, what changed, what passed       |

This keeps Specflow strong without turning it into brittle waterfall theatre.

## What will make it fail

Specflow will fail with Fable if any of these happen:

1. **The model can self-advance gates.** Fatal.
2. **Runtime verification stays optional.** Plausible UI/backend bugs will ship.
3. **Trace review remains unreadable.** Long runs become black boxes.
4. **Model routing becomes the product.** Wrong wedge. Routing is plumbing.
5. **Spec-build over-specifies implementation.** Fable will fight stale scaffolding.
6. **Vision evidence becomes verdict.** Screenshots help, but they do not prove value.
7. **Routine/cron runs arrive before trust gates.** That creates unattended garbage at scale.

## What will make it work

Specflow works if it becomes this:

**A model-agnostic, file-backed, CI-enforced trust harness for long-running AI agents.**

Not a prompt system.

Not a Claude Code plugin.

Not a swarm manager.

Not a PM assistant.

The repo already supports that positioning. The README says contracts and journey tests enforce specs, hooks/CI block violations, and the loop runner creates durable run state. ([GitHub][4]) The 0.10.0 changelog shows the Fable-facing runtime controls are already moving into adapter metadata, state memory, worktree/routine scaffolding, and Gate D vision evidence. ([GitHub][3])

Now the work is to remove ambiguity.

## Product positioning

Use this line:

**Specflow is the trust harness for frontier coding agents. It lets Fable, Claude Code, Codex, Ruflo, or any swarm write the work — but only contracts, gates, and evidence decide what ships.**

The commercial buyer pain is clean:

**“My AI agent produced something that looks done. I need to know if it is safe to merge.”**

That is a real problem now. Fable makes it bigger.

## Next Actions

1. **Rewrite #84/#92 as one verifier epic:** maker-verifier negotiation, runtime Playwright verifier, separate verifier ledger, no maker-trace contamination.

2. **Ship `specflow run trace`:** maker claim vs verifier finding vs gate result, with links to transcript, files changed, model metadata, and failed invariant.

3. **Add one invariant to the repo docs:** “Frontier-model scaffolding is disposable; gates, ledger, state, and human boundaries are not.”

[1]: https://www.anthropic.com/news/claude-fable-5-mythos-5 "Claude Fable 5 and Claude Mythos 5 \ Anthropic"
[2]: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5 "Prompting Claude Fable 5 - Claude Platform Docs"
[3]: https://github.com/Hulupeep/Specflow/blob/main/CHANGELOG.md "Specflow/CHANGELOG.md at main · Hulupeep/Specflow · GitHub"
[4]: https://github.com/Hulupeep/Specflow "GitHub - Hulupeep/Specflow: Specs that enforce themselves. Turn specs into contracts that can't be broken by helpful LLMs. · GitHub"
[5]: https://github.com/Hulupeep/Specflow/issues "Issues · Hulupeep/Specflow · GitHub"

