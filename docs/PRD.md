# Specflow PRD — A Trust Harness for Frontier Coding Agents

**Version:** 1.1
**Date:** 2026-10-28 (source/documentation reconciliation; original positioning dated 2026-07-02)
**Status:** Active — supersedes positioning in `docs/old-do-not-use/preflightprd.md` for the loop-runtime era
**Sources:** current source, active contract index and canonical CI for the 2026-10-28 reconciliation. Original positioning drew on `main` + `feat/verifier-rail-102`, issues/PRs #77–#103, `docs/ss/loops.md`, `docs/ss/loops-talk-evaluation.md` and `docs/specs/fable-enable.md`. Those dated sources are not current capability receipts.

---

## 1. Product summary

The desired outcome is unassisted intent-to-evidence development: an owner sets
general intent and standing boundaries; agents choose useful work, build and
test it, report a defensible experiment verdict, and learn from the result.
HeyStax is the target operational control plane for human/agent instruction and
explainability. Verification effort adapts to the problem's uncertainty and
consequences. Faster validated value and revenue are the purpose; more tickets,
reviewers or green checks are not success measures. This is the product target,
not a claim that unattended delivery or HeyStax command dispatch is available.
For research-led work, the research agent owns discovery and selection; Specflow
consumes its issues, strengthens the contract, builds and returns evidence.
Existing research is reused, not restarted as mandatory ceremony.
Researcher, builder, reviewer and chief of staff are replaceable roles. Their
briefs, assignments and durable work live in HeyStax and versioned task/evidence
artifacts, so replacing an agent does not require rebuilding its chat memory.

Specflow is a model-agnostic trust harness for frontier coding agents. It lets Claude, Codex, Fable-class models, Ruflo, or other agent swarms produce the work — but only contracts, verifier evidence, mechanical gates, ledger state, and human boundaries decide what advances or ships. The model is the actuator; the gate is the sensor. A provider's output — and its exit code — is never a gate verdict. Specflow runs an LLM as an untrusted worker inside a contracted loop (`specflow run`), requires an independent verifier to exercise the built thing where behavior matters, records everything to a durable on-disk ledger, and mechanically enforces the boundaries (push, merge, PR, override) that only explicit human authorization may cross. The thesis in one line: **frontier models can carry more of the work; Specflow must carry the trust.**

---

## 2. The real problem

The problem is not that models are bad at coding. It is that they are now good enough to be dangerous in a specific way: **autonomous coding agents can produce plausible, incomplete, unsafe, or commercially risky work and then confidently self-certify it as done.**

Concretely:

- **Frontier agents run long enough to create large, plausible changes.** A multi-hour run can touch dozens of files across auth, data, and billing seams, and produce a diff no one will fully read.
- **They can plan, build, summarize, and self-approve.** A single model instance is happy to be planner, implementer, reviewer, and judge — and it is good enough at each role that you will be tempted to let it.
- **They remain weak judges of their own output.** Self-evaluation is a trap. A model that just built something inherits its own assumptions when asked whether it works; it can identify legitimate issues and then talk itself into approving them anyway.
- **Commercial teams cannot merge on model confidence.** "The agent says it's done" is not evidence. Production brownfield systems, paid client delivery, and audit-sensitive work need runtime evidence, provenance, and a decision trail.
- **Plausible completion is the new failure mode.** Not crashes — working-looking UIs with dead backends, green unit tests over hard-coded data, journeys that were never actually driven.

The failure path is letting capability accumulate authority: the stronger the model, the more roles it absorbs, until the entity producing the change is also the entity certifying it. Specflow separates those responsibilities and rejects unsupported acceptance within its declared checks; it cannot guarantee that an incomplete contract catches every defect.

**Capability does not create authority.**

---

## 3. Why now

Fable-class models changed the operating conditions, and Anthropic's own long-running-agent findings (the loop materials in `docs/ss/`) confirm each pressure independently:

1. **Longer autonomous runs increase unsupported-change risk.** Models now sustain coherent multi-hour builds. Every additional unattended hour widens the gap between "what the agent claims" and "what a human has verified." The volume of plausible change now outstrips any team's capacity to read it.
2. **Self-evaluation remains a trap.** Anthropic's own harness work found the generator cannot grade itself; even a dedicated LLM evaluator is sycophantic out of the box and took "an exorbitant amount of time" to tune. The durable answer is an adversarial, separated evaluator — and, wherever possible, a deterministic script that cannot be flattered.
3. **File-system state beats lossy context memory.** Compaction does not equal coherence. Long runs need structured handoffs and machine state on disk (their breadcrumb logs; Specflow's `run-contract.yaml` + `ledger.jsonl`), not summaries inside a context window.
4. **Runtime verification catches what static checks miss.** Their evaluator caught route-ordering, boolean-logic, and dead-interaction bugs only by actually driving the application. Diffs, unit tests, and screenshots sail past exactly the bugs that matter commercially.
5. **Stronger models require thinner scaffolding — but stronger gates.** Anthropic explicitly strips harness scaffolding as models improve ("right for 4.5, the frontier moved"). What survives model generations is not prompt structure; it is the trust layer: gates, ledger, state, verifier evidence, human boundaries.

The window is now because organizations are deciding, this year, how much authority to grant coding agents. Teams that grant it without a trust harness will discover plausible-completion failures in production. Teams that refuse agents entirely will lose the speed. Specflow is the third option: full agent speed, independent trust.

---

## 4. Target users

| User | Situation | What they need from Specflow |
|---|---|---|
| **Product/engineering leads** using AI agents on real commercial work | Agents produce more change than the team can review line-by-line | Evidence-backed gates so review effort concentrates where risk is |
| **Consultants and agencies** delivering client software with AI assistance | Clients ask "how do I know the AI work is safe?" | A ledgered evidence packet per change: what ran, what was verified, who authorized what |
| **Teams on brownfield production systems** | Existing behavior must not regress; agents don't know what they don't know | Contracts that pin invariants; runtime verification of touched seams |
| **Teams where auth, billing, workflows, data mutation, compliance, or audit trails matter** | A wrong change has direct customer or legal impact | Mandatory verifier evidence by slice type; human-only boundaries; provenance |
| **Technical founders** | Want agent speed without agent self-certification | One runner, mechanical gates, readable traces |
| **Organizations adopting frontier agents deliberately** | Need evidence before trust, and a decision trail after | Ledger, trace, cost-per-accepted-change, gate history |

---

## 5. Not for

Specflow is deliberately not for:

- **Throwaway demos** — the gate overhead buys nothing if the artifact is disposable.
- **Pure hobby vibe-coding** — if the fun is the flow, a harness is friction.
- **Greenfield experiments where the user will manually inspect everything anyway** — human eyeballs on every line already provide the trust layer.
- **Teams that want fully autonomous merge/deploy with no human gates** — Specflow's `never_without_human` boundary is a feature, not a limitation to be configured away.
- **People looking for an agent swarm/orchestrator as the core product** — Specflow governs one worker's lane; orchestration belongs to the model layer or your existing tooling, and Specflow sits under it.
- **Users who only want prompt templates** — prompts are the disposable layer here, not the product.
- **Low-risk scripts where a simple test suite is enough** — if `npm test` genuinely covers the risk, use `npm test`.

The one-line qualification test: *would you merge a six-hour agent run without reading it?* If the honest answer is "no, but I wish it were yes" — that gap is Specflow. If the answer is "I'd read it all anyway" or "who cares," it is not.

---

## 6. Positioning

**Specflow is the trust layer, not the worker.** It does not write code, plan sprints, or orchestrate swarms. It decides — mechanically, on evidence — whether the work those things produce may advance.

- **The model proposes; Specflow disposes.**
- **Swarm faster. Ship only what survives contracts.**
- **Do not let a powerful model become its own judge.**

### What Specflow is not, and what it sits beneath

| Category | What it does | Why it isn't the trust layer | Relationship to Specflow |
|---|---|---|---|
| Prompt packs | Shape model behavior at generation time | The model can ignore them; no enforcement | Disposable input; Specflow gates the output |
| Claude Code skills | Extend one provider's agent workflow | Provider-specific; live inside the worker | A skill can invoke `specflow run`; the gate stays outside |
| Codex / Ruflo / swarms | Produce and coordinate work at scale | More workers = more plausible change, not more trust | Each lane's output lands only through Specflow's gates |
| Generic CI | Runs whatever checks exist on push | Checks what was written, not whether the maker's claims match runtime behavior; runs after the agent has already self-certified | Specflow's gates run inside the loop, pre-PR; CI re-enforces at merge |
| Test runners | Execute tests the maker wrote | The maker chose the tests; a self-graded exam | Verifier-negotiated contracts decide which checks count |
| Project management workflows | Track intent and status | Status is self-reported | Specflow's ledger makes status evidence-backed |

Specflow sits **underneath or around** those systems as the harness: the model stack above it is swappable and expected to churn; the gate layer is fixed. You upgrade the worker freely. You never let the worker become the sensor.

---

## 7. Core product principles

1. **Provider output is never a gate verdict.** Neither text claims nor exit codes. The gate re-runs and decides (`I-ADAPTER-001`).
2. **Maker and verifier must be separated.** Different contexts, different roles — structurally, not by politeness.
3. **The verifier judges artifacts and behavior, not maker reasoning.** Feeding the maker's trace to the verifier lets it inherit the maker's delusion.
4. **Runtime-required work must receive runtime verification.** If the change is behavioral, something must actually drive the behavior.
5. **Gates decide using evidence, not confidence.** A blocked or failed required finding blocks the gate, whatever the maker claims.
6. **State lives on disk, not only inside context.** `run-contract.yaml`, `ledger.jsonl`, findings files — runs survive compaction, crashes, and resumption.
7. **Human-only boundaries are mechanically enforced.** Push, merge, PR, `--no-verify`, gate override: `never_without_human`, detected from provider events, not requested via prompt.
8. **Vision and screenshots are evidence, not proof.** A screenshot alone cannot satisfy a value-bearing check (API behavior, data mutation, billing).
9. **Model-specific scaffolding stays thin and removable.** Prompts, effort tiers, and provider adapters are expected to be deleted as models improve.
10. **The harness gets stricter around trust and lighter around hand-holding as models improve.** The repo invariant: *frontier-model scaffolding is disposable; gates, ledger, state, verifier evidence, and human boundaries are not.*

---

## 8. Current source capabilities and qualification limits

This section describes source capabilities, not the contents of every published installation. Inspect the installed version and retained runtime pins separately. Current canonical tests and their native reports live in [Actions](https://github.com/Hulupeep/Specflow/actions/workflows/canonical-tests.yml); test totals change with the source and are not a commercial success metric.

| Source capability | Governing reference |
|---|---|
| Risk-based work routing and progressive specification | `skills/specflow-loop-selector/SKILL.md`, `templates/SPECIFICATION.md` |
| Contracted runner, durable ledger and trace | `scripts/specflow-runner.cjs` |
| Accepted verification lifecycle and owning native execution | `docs/contracts/outcome-assurance.yml`, `docs/contracts/test-execution.yml` |
| Independent numerical correctness, separate provenance/consistency | `docs/contracts/oracle-correctness.yml`, `docs/contracts/data-seams.yml` |
| Integrated outcome acceptance distinct from report lint | `docs/gate-d.md` |
| Fresh advisory and explicit Duo review, retained findings/ownership | `docs/advisory-review.md`, `docs/duo-build.md` |
| Host-aware installation and source native adapters | `docs/onboarding.md`, `docs/native-plugin.md` |
| Repo-local Improve/controller/service interfaces | `docs/ops/improve-service.md` |

Selected source/native and synthetic corpus journeys have engineering evidence. This does not establish released marketplace startup, universal host behavior, real-product benefit or customer validation. Required skips, missing current evidence and exceptions cannot become passing acceptance.

Remaining qualification includes final versioned npm/plugin publication and registered released installs, real-product single/multi-cycle Improve outcomes, and the complete unattended operational handoff. HeyStax is the target control plane; existing interfaces do not prove that whole target delivered. Recurring schedules remain off unless separately authorized.

---

## 9. Workflow / user journey

The core loop, end to end:

1. **A human or agent starts with a product/change goal** — an idea doc, a bug, a client requirement.
2. **`spec-build` creates the outer contract**: the applicable goal, contracts, journeys, acceptance, seams and risks — deepening the selected slice while future tickets stay thin. The outer contract owns the *what*; it deliberately does not pin implementation detail (planner over-granularity cascades errors over long horizons).
3. **`feature-build` takes one approved slice.**
4. **The maker proposes a slice-local verification contract** — "done means X, verified by Y" — before writing code.
5. **An independent verifier accepts, rejects, or strengthens it.** The negotiated contract is written to disk. The verifier's job is to be harsher than the maker's proposal.
6. **The maker implements** against the negotiated contract.
7. **The runtime verifier exercises the behavior where required** — launches the app, drives the journey, reads console/network/backend state. Mandatory for UI, workflow, API-behavior, integration, data-mutation, auth, billing, and `runtime_required` slices.
8. **Findings are written separately** — the verifier never sees the maker's reasoning trace, and its findings file is its own artifact.
9. **The mechanical gate consumes verifier evidence.** Maker claims are inputs, not verdicts. Missing or failed required evidence blocks.
10. **The ledger records everything**: model requested/effective, action, evidence, maker-claim/verifier-finding divergence, gate result, and attributed boundary decisions or nonpassing exceptions.
11. **A human reviews or authorizes only where needed** — at `never_without_human` boundaries (push, PR, merge, override) and explicit exceptions, not on every line of diff.
12. **`specflow run trace` explains what happened** — the run is readable after the fact, including where the maker's judgment diverged from the gate.

---

## 10. Trust boundaries

These are the invariants that define the product. If any of these can be crossed, Specflow has failed regardless of what else works.

| # | Boundary | Enforcement |
|---|---|---|
| 1 | **The maker cannot mark its own work as accepted.** | Gate advancement requires verifier/gate evidence; maker claims are recorded but non-authoritative |
| 2 | **A provider exit code cannot become a pass.** | `I-ADAPTER-001`: gates re-run checks; adapter results are never verdicts |
| 3 | **A screenshot alone cannot satisfy value-bearing behavior.** | Value-bearing tags (`api_behavior`, `data_mutation`, `billing`) require non-visual evidence |
| 4 | **Missing verifier evidence cannot advance runtime-required work.** | Enforced verifier rail: required-when slice types block without findings |
| 5 | **A failed required finding cannot be overridden silently.** | Owner exceptions stay attributed and distinct; missing, failed or skipped required evidence cannot pass |
| 6 | **Model fallback/downgrade cannot be hidden.** | Requested vs effective model recorded per ledger entry; silent downgrade = failed contract |
| 7 | **The agent cannot push, merge, open a PR, or override gates without human approval.** | `never_without_human`, mechanically enforced from provider events |
| 8 | **The verifier cannot be polluted by maker chain-of-thought.** | Verifier input is artifact + behavior + spec + rubric — never the maker's reasoning trace |
| 9 | **Routine/cron execution cannot invent a second loop.** | All scheduled variants call `specflow run`; there is no parallel loop process with weaker gates |

---

## 11. Scope

### In scope

- Contracted local loop runtime (`specflow run`, run contracts, stages, gates)
- Verifier lifecycle: negotiation, policies, independent execution, findings
- Runtime verification evidence for behavioral slices
- Gate enforcement (Gates A–D, provenance, verifier rail)
- Traceability (`specflow run trace`, ledger, divergence reporting)
- State memory on disk (STATE.md, lesson files — #85)
- Worktree isolation for delegated execution (#86)
- Adapter policy: provider-agnostic caps, budgets, model honesty metadata
- Cost and model metadata capture (#89, #83 — as ledger metadata, not product center)
- Human-gated boundaries (`never_without_human`, ledgered skips)
- Loop-era audit skill refresh (#97)

### Out of scope (deliberately)

- **A fully hosted autonomous agent platform.** Hosted long runs belong to the Agent SDK / cloud layer; Specflow is the local harness.
- **Replacing Claude Code, Codex, or Ruflo.** They are the workers. Specflow governs their lane.
- **A general swarm orchestrator.** Who runs when is the model layer's job; Specflow decides whether a lane's output may land.
- **Auto-merge / auto-deploy.** The harness cannot grant itself merge/deploy authority; existing scoped owner authorization and release policy remain authoritative.
- **Blind trust in Fable/Claude/Codex output** — including "the model is stronger now, relax the gates." Stronger models get thinner scaffolding, never weaker gates.
- **Heavy provider-specific scaffolding that becomes the product.** Adapters stay thin and deletable (#94).
- **A full project management suite.** Specflow reads and writes issues via board CLIs; it does not replace the board.
- **Guaranteeing correctness without tests, oracles, or evidence.** Specflow enforces that evidence exists and gates on it; it cannot conjure ground truth a project never defined.

---

## 12. Commercial value

The intended buyer problem (positioning, not a sourced customer quotation):

> **"I used an AI agent. It produced something that looks done. I need to know whether it is safe to merge."**

This is the adoption problem Specflow is intended to address; its frequency and willingness to pay require market evidence. Specflow's answer is an evidence packet per change instead of a confidence claim.

| Buyer | Value |
|---|---|
| **Agencies / consultants** | Prove to clients that AI-assisted delivery is controlled: contracts, verifier findings, ledger, trace — a deliverable artifact, not a promise |
| **Product teams** | Reduce review burden without removing accountability: humans review boundaries and divergences, not every line |
| **Commercial clients** | See evidence instead of "the AI says it works" — runtime findings, journey results, provenance |
| **Engineering orgs** | Avoid expensive plausible-completion failures: dead backends, hard-coded data, silently-skipped journeys caught pre-PR instead of in production |
| **Managers** | Allow longer agent runs without surrendering merge authority — the run can go six hours; the merge still needs a human |
| **Audit-sensitive environments** | A decision trail exists by construction: who/what proposed, what was verified, what was skipped and by whom |

The economic frame is **cost per accepted change** (#89): agents make raw output cheap; the scarce quantity is *trusted* output. Specflow makes trusted output measurable and cheaper than either full manual review or production incident recovery.

---

## 13. Risks and failure modes

| Risk | Failure mode | Mitigation |
|---|---|---|
| **Process theatre** | Teams produce contracts and ledgers no gate actually enforces; Specflow becomes decorative YAML | Every contract construct must be consumed by a mechanical check; the verifier rail is enforced, not advisory; `specflow verify` audits the installation itself |
| **Too much YAML, not enough enforcement** | Schema surface grows faster than gate coverage | New schema fields require a consuming gate or verifier in the same change; harness-minimal principle (#94) applies to our own scaffolding |
| **Verifier exists but is optional** | Teams flip `mode: never` and self-certify again | Default is `auto` with mandatory slice types; skips are human-only and ledgered; trace surfaces skip rates |
| **Runtime verification too shallow** | Verifier "drives the app" by loading one page; plausible bugs still ship | Verification contracts are negotiated to name concrete behaviors; granular criteria required (vague criteria produce shrugging); value-bearing checks need non-visual evidence |
| **Trace output too hard to read** | Long runs stay black boxes; humans rubber-stamp | Trace is a first-class product surface: divergence-first ordering, links to transcripts/files; success metric is time-to-understand a run |
| **Agent memory becomes another hallucination surface** | STATE.md fills with model-invented "lessons" that pollute future runs | #85 rules: machine state in append-only JSONL; STATE.md must not duplicate facts already in repo/contracts/transcripts; memory is input, never evidence |
| **Worktrees introduce cleanup/collision problems** | Orphaned worktrees, branch confusion, lost work | #86 ships with lifecycle management (create/track/clean) and a cleanup success metric before delegation defaults on |
| **Model routing distracts from trust** | Effort tiers and routing config become the visible product; wrong wedge | #83 is policy metadata behind the ledger — honesty rules (silent downgrade = failed contract) are durable; taxonomy stays thin and deletable |
| **Vision evidence overtrusted** | Screenshots pass as proof of value | Structural rule already shipped: vision verdicts are evidence subordinate to gates; screenshot-only fails value-bearing checks |
| **Routine automation ships before gates are mature** | Cron-scheduled runs generate unattended garbage at scale | #87 is explicitly sequenced last; all routine variants call `specflow run` — no second loop, same gates, same human boundaries |
| **Users misunderstand Specflow as an agent** | Buyers expect a worker/orchestrator and are disappointed, or worse, trust it as one | Positioning discipline in README/docs: "trust layer, not the worker"; the harness never generates product code itself |

---

## 14. Success metrics

| Metric | What it proves |
|---|---|
| % of runtime-required slices with verifier findings attached | The rail is real, not bypassed |
| Maker/verifier/gate divergences caught per run | The independent verifier earns its cost |
| Blocked self-approval attempts (maker claimed complete, gate blocked) | Trust boundary #1 is doing work |
| Missing-evidence blocks | Gates fail closed, not open |
| Gate failures caught before PR (vs. found in CI or production) | The loop moves trust earlier |
| Time for a human to understand a run via `specflow run trace` | Traceability is usable, not theoretical |
| Cost per accepted change | The commercial frame — trusted output getting cheaper |
| Resumed runs without state loss | Disk state beats context memory in practice |
| Worktree cleanup success rate | Isolation isn't creating new operational debt |
| Reduction in empty/weak PR handoffs | Handoff quality improves at the human boundary |
| Commercial-client-ready evidence packets produced | The agency/consultancy value proposition is being exercised |

---

## 15. Near-term roadmap

The sequence follows remaining proof rather than July ticket status: finish qualified distribution and current audit/handoff/docs; prove a useful real-product Improve cycle; then prove bounded repeat/recovery and operational reporting. Keep control-plane and unattended claims behind actual end-to-end evidence. Do not rebuild already implemented memory, isolation or routing merely because an old table called them planned.

The existing issue tracker records concrete selected work. Source-tested, native-qualified, merged, released, deployed and customer-validated remain separate states. Subscription effort continues on verified progress without invented financial exhaustion; explicit limits and real expensive billable-route brakes still apply.

---

## 16. Definition of done

This PRD is complete because it answers, in one place:

- **What is the actual problem?** Frontier agents produce large plausible changes and self-certify them; capability does not create authority (§2).
- **Why does it matter now?** Long-horizon Fable-class runs, the self-evaluation trap, and the merge-authority decision every org is making this year (§3).
- **Who is it for?** Teams merging AI-produced changes into commercially consequential systems (§4).
- **Who is it not for?** Demos, hobby flow, manual-review-everything projects, and anyone wanting merge/deploy without explicit owner authority (§5).
- **What does Specflow do?** Contracted loop runtime, verifier lifecycle, runtime evidence, mechanical gates, ledger, trace, human boundaries (§8–§9).
- **What does it refuse to do?** Be the worker, orchestrate swarms, auto-merge, trust provider output, or guarantee correctness without evidence (§10–§11).
- **Why is it different from prompt packs, agent swarms, and CI?** It is the trust layer those systems lack, sitting beneath and around them (§6).
- **What trust boundaries must never be crossed?** Nine, enumerated and enforced (§10).
- **What has shipped?** See the scoped source capability table and current canonical execution evidence (§8); counts alone are not acceptance.
- **What remains?** Versioned distribution qualification, remaining handoff/docs and real-product Improve/operational proof (§15).
- **What commercial value does this create?** Evidence packets instead of confidence claims; measurable cost per accepted change (§12).

---
---

# Executive summary

**Specflow: the trust harness for frontier coding agents.**

## The problem

AI coding agents can now run for hours and produce large, plausible changes — and then confidently certify their own work as done. They plan, build, summarize, and self-approve, but they remain weak judges of their own output. For commercial teams — agencies delivering client software, brownfield production systems, anything touching auth, billing, data, or compliance — "the agent says it works" is not a merge criterion. The failure mode is not broken code; it is *plausible completion*: working-looking UIs over dead backends, green tests over hard-coded data, shipped with confidence.

**Capability does not create authority.** The stronger the model, the more tempting it is to let it be planner, builder, verifier, and judge at once. That is the failure path.

## The product

Specflow is a model-agnostic trust harness. Claude, Codex, Fable-class models, or agent swarms produce the work; **contracts, verifier evidence, mechanical gates, ledger state, and human boundaries decide what advances or ships.** The model is the actuator. The gate is the sensor. A provider's output — or exit code — is never a verdict.

The loop: a spec is hardened into a contract; the maker proposes how its slice will be verified; an **independent verifier** — which never sees the maker's reasoning — strengthens that contract, then actually *drives the built behavior* at runtime; a mechanical gate consumes the verifier's evidence; an append-only ledger records models, claims, findings, divergences, and every human authorization; `specflow run trace` makes the whole run readable after the fact. Slices touching UI, workflows, APIs, integrations, data mutation, auth, or billing **cannot advance without verifier evidence** — a maker's "complete" claim cannot outvote a failed finding, and recorded exceptions do not turn missing required checks into a pass. Existing owner authorization and release boundaries remain authoritative.

## Why now

Anthropic's own long-running-agent research confirms the design independently: self-evaluation is a trap; evaluators must be adversarial and separated; file-system state beats context memory; runtime verification catches what static checks miss; and harness scaffolding should thin out as models improve — while gates get stronger. Organizations are deciding *now* how much authority to grant coding agents. Specflow is the option between blind trust and refusing the speed.

## Status and value

Current source implements the contracted runner, owning verifier lifecycle, native accounting, correctness/provenance distinctions, trace, retained state and controlled improvement interfaces. Released-install qualification, real-product gains and unattended operational delivery need their own evidence; source tests do not establish them. See §8 and §15 for current scope.

For a buyer, the value is one sentence: **"My AI agent produced something that looks done — Specflow tells me, with evidence, whether it is safe to merge."** Agencies get client-ready evidence packets instead of assurances. Teams get agent speed with concentrated, boundary-level human review instead of line-by-line reading. The metric that matters is cost per *accepted* change — and Specflow is how it comes down without trust going with it.

**Swarm faster. Ship only what survives contracts.**
