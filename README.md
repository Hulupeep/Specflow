# Specflow

**The trust harness for frontier coding agents.**

AI agents can now run for hours and produce large, plausible changes — then confidently certify their own work as done. Specflow lets Claude, Codex, Fable-class models, or agent swarms produce the work, but only **contracts, verifier evidence, mechanical gates, ledger state, and human boundaries** decide what advances or ships.

**Capability does not create authority.** The model proposes; Specflow disposes.

---

## The Problem

Two failure modes, one root cause: the model grading itself.

**Drift.** LLMs don't read, they attend. Your spec competes with millions of training examples:

```typescript
// Your spec: "Service workers MUST NOT use localStorage"
// LLM adds this anyway after iteration 3:
const token = localStorage.getItem('auth') // No crash. Just drift.
```

**Plausible completion.** The frontier-model version is worse: working-looking UIs over dead backends, green tests over hard-coded data, journeys that were never actually driven — shipped with confidence by an agent that planned, built, summarized, and approved its own work. No team can read every line of a six-hour agent run, and "the agent says it's done" is not evidence.

You can't fix either with better prompts. You need a gate the model can't flatter.

---

## The Product

Specflow is a gated control loop that runs an LLM as an **untrusted worker** and won't let it advance until an **independent, mechanical check** passes:

| Part | Role | What it is |
|------|------|------------|
| **Contract** | the setpoint | "done" as machine-checkable rules — invariants, acceptance criteria, journeys |
| **Adapter** | the actuator (untrusted) | runs a model to produce the work (`claude -p` / `codex exec`) under budget/tool/timeout caps |
| **Verifier** | the adversary | an independent stage that *drives the built behavior* at runtime and writes findings separately — it never sees the maker's reasoning |
| **Gate** | the sensor (trusted) | a deterministic check decides pass/fail from evidence — it cannot be flattered or hurried |
| **Ledger** | the memory | run state on disk (`run-contract.yaml` + `ledger.jsonl`) — runs survive hours, compaction, and resume |

The **enforced verifier rail**: slices touching UI, workflows, API behavior, integrations, data mutation, auth, or billing **cannot pass the gate without verifier evidence**. A maker's "complete" claim cannot outvote a failed finding. A screenshot alone never satisfies a value-bearing check. Only a human can skip a required verification — and the skip is ledgered.

The output per change is an **evidence packet**: contract, verifier findings, runtime proof, provenance, model metadata, and every human authorization — something a reviewer, client, or auditor can absorb in minutes instead of a diff they'd never finish. `specflow run trace` renders any run readable after the fact, divergences first.

---

## The Invariant

> **Frontier-model scaffolding is disposable. Gates, ledger, state, verifier evidence, and human boundaries are not.**

As models get stronger they need less prompt scaffolding — so prompts, skills, and sprint decomposition are expected to come and go. What does **not** move is the trust layer: a provider's output (or exit code) is never a verdict; the mechanical gate decides, the ledger remembers, and unsafe boundaries stay human-authorized.

---

## Install

```bash
npx @colmbyrne/specflow init .          # one command — sets up everything (safe to re-run)
npx @colmbyrne/specflow update . --ci   # wire the build/commit hooks + CI
```

Then open **CLAUDE.md** and fill in the **Project Context** — *only the fields still blank/placeholder; an existing project may already have these:*
- **Repository** — `your-org/your-repo`
- **Project Board** — where issues are tracked (e.g. GitHub Issues)
- **Board CLI** — the command-line tool for that board. For GitHub Issues that's **`gh`** (the [GitHub CLI](https://cli.github.com)); for Jira it'd be the `jira` CLI, etc. Agents use it to read/create issues, so it must be installed + authenticated.
- **Tech Stack**

**`init` installs the whole thing in one go:**
- **Specflow** — contracts, hooks, agents, tests
- the **loop kit** (`QA/loops/`) — **three loops** (see below) + the gate scripts (`verify-graph`, `verify-seed`, `adversary-spawn`, `verify-ticket-journey`, `verify-falsification`, `verify-seams`, `teardown-gate`)
- the **adversary critic** skill (Gate A) into `~/.claude/skills/` (and `~/.codex/skills/` if you use Codex) — add `--no-adversary` to skip
- the **process docs** (`PROCESS.md` / `-GUIDE` / `-CLAUDE` / `-CODEX`)

On **Mac/Linux** any terminal works.

> **Windows:** run these in **Git Bash**, not PowerShell or WSL. The scripts target Git Bash; PowerShell's `bash` is usually WSL, which can't see your `C:\` paths and will error with "No such file or directory".

### Commands

```bash
npx @colmbyrne/specflow init .          # Set up everything (safe to re-run)
npx @colmbyrne/specflow update . --ci   # Update hooks + install CI workflows
npx @colmbyrne/specflow verify          # Check installation
npx @colmbyrne/specflow audit 500       # Audit issue #500 for compliance
npx @colmbyrne/specflow graph           # Validate contract cross-references

# The contracted loop
npx @colmbyrne/specflow run spec-build --slug my-feature --goal "ready tickets" --input docs/idea.md
npx @colmbyrne/specflow run feature-build --slug my-feature   # one approved slice, through the verifier rail
npx @colmbyrne/specflow run trace --slug my-feature           # divergence report: maker claim vs verifier finding vs gate result
```

---

## Trust guarantees

Enforced by the harness, not requested by prompt:

1. The maker cannot mark its own work as accepted.
2. A provider exit code cannot become a pass.
3. A screenshot alone cannot satisfy value-bearing behavior (API, data mutation, billing).
4. Missing verifier evidence cannot advance runtime-required work.
5. A failed required finding cannot be overridden silently — human-only, ledgered skips.
6. Model fallback or downgrade cannot be hidden (requested vs effective model, per action).
7. The agent cannot push, merge, or open a PR without human approval (`never_without_human`).
8. The verifier is never contaminated by the maker's chain-of-thought.
9. Scheduled/automated runs go through the same gates — no weaker second loop.

The full set, with enforcement detail: [docs/PRD.md §10](docs/PRD.md).

---

## Recommended workflow: harden the PRD *before* you write tickets

Specflow makes tickets **enforceable**. It does not make them **correct** — a perfectly
specflow-compliant ticket can still encode the wrong thing, or a plausible lie with a green
checkmark on it. So put a hostile review *in front* of ticket-writing:

```
1. ADVERSARY      Harden the PRD with the Adversarial PRD Reviewer until it earns a
   (build spec)   SHIP / SHIP WITH STIPULATIONS verdict. Catches no-JTBD, untestable
                  requirements, fake backends, no-data loopholes, skip-to-green, and
                  false claims about the repo — BEFORE any ticket exists.
                  → https://github.com/Hulupeep/adversarial-prd-reviewer

2. SPECFLOW       Turn the hardened PRD into tickets: Gherkin acceptance criteria,
   (write)        data-testid selectors, contract references, E2E journey files.
                  (specflow-writer agent)

3. BOARD AUDITOR  Uplift the tickets to full compliance — fill missing SQL/RLS,
   (uplift)       TypeScript interfaces, invariants, data-testid coverage — then re-audit.
                  npx @colmbyrne/specflow audit <issue>
                  + the board-auditor / specflow-uplifter agents.
```

**Rule of thumb:** never write a ticket from a PRD that hasn't survived the adversary. **The
adversary makes the spec honest to begin with; Specflow bakes the truth in** — contracts +
journey tests enforce it on every build, so it can't drift back.

---

## What You Get

| Layer | What it does |
|-------|-------------|
| **Loop runner** | `specflow run` writes a durable run contract and ledger so agents execute the loop instead of referencing it |
| **Verifier rail** | Maker proposes how its slice will be verified; an independent verifier strengthens the contract, then drives the built behavior at runtime — mandatory for behavioral slice types |
| **Run trace** | `specflow run trace` — human-readable divergence report over the ledger: maker claims vs verifier findings vs gate results |
| **Contract tests** | YAML rules scan source for forbidden patterns — break a rule, build fails |
| **Journey tests** | Playwright tests for critical user flows — if a journey doesn't pass, the feature isn't done |
| **Provenance gate** | Catches hard-coded/mock data posing as implementation |
| **Hooks** | Auto-trigger tests on build/commit, catch violations on Write/Edit, reject commits without issue numbers |
| **CI workflows** | PR compliance gate + post-merge audit — no contract violations merge to main |
| **30+ agents** | Orchestrate wave execution, write contracts, audit boards, simulate specs |

---

## Two ways to use it

**On its own.** Contracts + journey tests + hooks + CI = your specs enforce themselves. No adversary, no loop kit required. Specflow is independently useful as the architectural-enforcement layer.

**As the trust harness for agent work.** `specflow init` also scaffolds a runnable loop kit (`QA/loops/`) + process docs that place Specflow's gates inside the larger idea→merged-code loop:

```
DISCOVER → PRD → [GATE A: adversary] → TICKETS → [Specflow: GATE B/B.5] → BUILD + VERIFIER RAIL → [GATE C] → merged
```

Gate A (the hostile critic) is a separate skill — the [adversarial-prd-reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer). Specflow doesn't require it, but the pipeline pairs them. The loop runs whole on either runtime — Claude Code (`Workflow`) or Codex (automations); see `PROCESS-CLAUDE.md` / `PROCESS-CODEX.md`. The path (`QA/loops/*.yaml`) is the source of truth; each runtime is a binding of it. **Muscle never self-approves — the adversary, the verifier rail, and CI on a real backend decide.**

### Prompt vs contracted loop

A prompt is one instruction. A Specflow loop is a job contract: goal, input,
current stage, next gate, durable evidence, stop condition, and
`never_without_human` rules. `specflow run` makes that contract visible on disk
under `.specflow/runs/<slug>/run-contract.yaml` and appends progress to
`.specflow/runs/<slug>/ledger.jsonl`.

The local runner is not a hosted scheduler. It runs or records the next bounded
step, preserves state, and stops when a human gate, missing evidence, failed
gate, or `agent_action_required` state is reached.

For generative stages, an optional adapter policy can delegate one turn to an
operator-owned CLI such as Claude Code (`claude -p`) or Codex (`codex exec`).
Those CLIs keep their own authentication and subscriptions; Specflow stores no
Claude/Codex subscription secrets. Provider output is never itself a gate result:
the owning Specflow verifier must rerun before the run contract advances.

### The three loops (`QA/loops/`)

| Loop | For | In one line |
|------|-----|-------------|
| **spec-build** | a new feature / rough idea | discover → PRD → **Gate A** (adversary + persona lens + falsification artifact) → tickets → **Gate B** (audit + seam-lite) → **B.5** (persona walk vs tickets) → defensible, journey-contracted tickets |
| **feature-build** | a ready ticket → tested slice | the 5 rails (ticket → contract → real-backend e2e → oracle-anchored → impl) + the **enforced verifier rail** (maker proposes verification → independent verifier strengthens → runtime verification → gate consumes evidence) → **Gate C** (CI vs a real seeded backend); an epic isn't done until **Gate D** — the persona walk on the *merged* tree |
| **daily-use-teardown** | an *already-built* product | investigate the live app → **human confirms the map (hash-bound sign-off)** → top-thinker persona walks (WORKS/CONFUSING/BROKEN + evidence) → prioritized do-list → feeds spec-build |

Start at `QA/loops/README.md`. **Maturity:** spec-build + feature-build are battle-tested on real epics; **daily-use-teardown is newer** — treat its output as a strong draft.

---

## Who it's for

The sharp case: **AI-enabled agencies and consultants delivering commercial software to clients who need evidence that agent-produced work is controlled** — plus brownfield production teams, and anyone whose changes touch auth, billing, data, workflows, or audit trails.

Not for throwaway demos, hobby vibe-coding, or projects where you'll manually read every line anyway. The one-line test: *would you merge a six-hour agent run without reading it?* If the answer is "no, but I wish it were yes" — that gap is Specflow. Full decision guide: [docs/should-i-use-specflow.md](docs/should-i-use-specflow.md).

---

## FAQ

**Is Specflow an agent?** No. It never writes product code. It's the harness around your agents — the model is swappable; the check is not.

**Isn't this just more testing?** No. Tests verify behaviour the maker chose to test. Specflow adds an independent verifier that negotiates *what counts as done* before code exists, drives the built behavior at runtime, and a mechanical gate that rules on that evidence.

**What if I don't have a perfect spec?** Start with "document what works today." Your first contract can be: whatever we're doing now, don't break it.

**Can LLMs actually follow contracts?** Even if they don't, gates catch it. You don't need the LLM to behave. You need it to be checkable.

**Does Specflow guarantee correctness?** No. It guarantees that evidence exists and that gates rule on it. It cannot conjure ground truth your project never defined.

---

## Addendum: the full execution pipeline (adversary + Specflow + ruflo)

Specflow's gates sit inside a larger loop that turns a rough idea into merged code you can
trust — even when a multi-agent swarm (e.g. [ruflo](https://github.com/ruvnet/ruflo) / claude-flow)
does the building. The principle:

> **The swarm is muscle *inside* a phase. The gates live *between* phases, and every gate is owned
> *outside* the swarm. Throughput is delegated; trust never is.**

```
[0] DISCOVER ─► [1] PRD ─[GATE A]─► [2] TICKETS ─[GATE B][GATE B.5]─► [3] BUILD ─[GATE C]─► merged
  human+agent     dueling   adversary  specflow      audit+    pre-flight   ruflo      specflow
  vs real         writer/   verdict    writer        closure   simulation   swarm      CI
  artifact        adversary (HARD)     (ruflo //)    validator (own gate)  (ruflo //)  (unfakeable)
```

| Gate | After | What it is | Type |
|------|-------|------------|------|
| **A** | the PRD | The **[Adversarial PRD Reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer)** verdict must be `SHIP` / `SHIP WITH STIPULATIONS`, written to a **committed `verdict` artifact**. The controller refuses to spawn ticket-writing unless that artifact says SHIP. | **HARD** |
| **B** | tickets | `specflow audit` + closure validator — every requirement → journey → test → issue, no orphans, no duplicate IDs. | soft (controller) |
| **B.5** | tickets | **Pre-flight simulation** — walk real personas through each ticket; a CRITICAL design gap blocks. *Its own gate.* | soft (controller) |
| **C** | each build/slice | **Specflow CI** — contract tests + journey tests against a *real seeded backend* + anti-pattern audit + coverage ratchet, downstream of the **verifier rail** (independent runtime verification per behavioral slice). Runs in CI under branch protection: a violation **cannot merge**. | **HARD (unfakeable)** |
| **D** | the *merged* epic | **Persona-walk integration gate** — per-slice green is blind to seam bugs (vertical slices, horizontal collisions). GATE D walks personas across the merged tree; a red hop is dispositioned `bug` or a *human-countersigned* `stale-oracle` — the agent can't reconcile its own oracle. An epic isn't done until D is green. | **HARD** |

Gate A also carries a **persona/simulation lens** (parallel to the structural review, against the PRD) and a required **falsification artifact** (hash-bound to the PRD); personas walk **twice** — the PRD at Gate A, the tickets at B.5.

**Who does what:** *Discover* — human + agent vs the real artifact (no swarm). *PRD* — dueling
writer/adversary, strong models. *Tickets* — `specflow-writer` fanned out by ruflo. *Build* — ruflo
swarm: one implementer per ticket in worktrees, multi-model cost routing (cheap models for
boilerplate, strong for hard), shared memory, kill-switch dashboard.

**Why it holds:** Gate A is a *single hostile critic*, not the swarm's self-consensus; Gate C is
*CI*, not an agent's opinion. **Soft front (controller-enforced) + hard backstop (branch-protected
CI)** means even a gamed soft gate — or a fooled adversary — can't merge a contract violation. And
because Gate C's journeys run against a real seeded backend, *green-but-broken* can't pass. This is
how Specflow **bakes the truth in**.

**ruflo's role is throughput, not trust** — use it where work is genuinely parallel (tickets,
build, triage) for multi-model cost + memory + observability; keep the trust-critical moments
(Gate A, the verifier rail, Gate C) outside the swarm. **No fork needed** — the adversary is a runtime skill the critic
invokes; Specflow is a CLI + CI the swarm calls.

---

## Links

<!-- absolute URLs so links resolve on the npm page too, not just GitHub -->
| | |
|---|---|
| [Product PRD](https://github.com/Hulupeep/Specflow/blob/main/docs/PRD.md) | Canonical positioning — trust boundaries, shipped vs planned |
| [Commercial narrative](https://github.com/Hulupeep/Specflow/blob/main/docs/PRD-COMMERCIAL.md) | The client/investor version |
| [The loop kit](https://github.com/Hulupeep/Specflow/blob/main/templates/loops/README.md) | Run the pipeline — paths, prompts, the three loops |
| [Detailed Setup](https://github.com/Hulupeep/Specflow/blob/main/docs/getting-started.md) | Manual paths, updating, SKILL.md |
| [Agent Library](https://github.com/Hulupeep/Specflow/blob/main/agents/README.md) | 30+ agents for wave execution |
| [Adversarial PRD Reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer) | Harden the PRD *before* writing tickets (Gate A) |
| [Contract Schema](https://github.com/Hulupeep/Specflow/blob/main/CONTRACT-SCHEMA.md) | YAML format for contracts |
| [CI Integration](https://github.com/Hulupeep/Specflow/blob/main/CI-INTEGRATION.md) | GitHub Actions setup |
| [npm](https://www.npmjs.com/package/@colmbyrne/specflow) | `@colmbyrne/specflow` |
| [Issues](https://github.com/Hulupeep/Specflow/issues) | Bugs and ideas |
