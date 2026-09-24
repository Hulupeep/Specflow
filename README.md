# Specflow

**Specs that enforce themselves.**

LLMs drift. You write a rule; three iterations later the model "helpfully" ignores it. Specflow turns your specs into contract tests that break the build when violated — so drift can't ship.

---

## The Problem

```typescript
// Your spec: "Service workers MUST NOT use localStorage"
// LLM adds this anyway after iteration 3:
const token = localStorage.getItem('auth') // No crash. Just drift.
```

**LLMs don't read. They attend.** Your spec competes with millions of training examples. You can't fix this with better prompts. You need a gate.

---

## The Solution

Contract tests scan your source code for forbidden patterns. Break a rule → build fails. Journey tests run Playwright against your critical flows. If a journey doesn't pass, the feature isn't done.

---

## Core Workflow: `spec-build` → `feature-build`

For serious product work, Specflow is two loops:

| Loop | Use it when | Output |
|------|-------------|--------|
| **`spec-build`** | You have an idea, PRD, discovery note, bug cluster, or already-built-product teardown | A shared goal, thin backlog and scoped evidence for the selected next slice |
| **`feature-build`** | You have one approved Specflow ticket ready to implement | A branch/slice that passes contract tests, journey tests, provenance, and Gate C |

Run `spec-build` before code:

```bash
npx @colmbyrne/specflow run spec-build \
  --slug auth-system \
  --goal "ready tickets for auth system" \
  --input docs/auth-idea.md
```

Then run `feature-build` for each ready ticket:

```bash
npx @colmbyrne/specflow run feature-build \
  --slug auth-system-244 \
  --goal "branch for #244 green on CI" \
  --input "#244"
```

The short version:

```text
spec-build    = decide what should be built, harden it, slice it into enforceable tickets
feature-build = build one ticket on rails until CI and evidence say it is ready
```

For already-built products, start one step earlier with `daily-use-teardown`;
for merged epics, finish with Gate D. Most day-to-day work is still
`spec-build` → `feature-build`.

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
npx @colmbyrne/specflow verify          # Check installation (13 sections)
npx @colmbyrne/specflow audit 500       # Audit issue #500 for compliance
npx @colmbyrne/specflow run spec-build --slug my-feature --goal "ready tickets" --input docs/idea.md
npx @colmbyrne/specflow graph           # Validate contract cross-references
```

---

## Why `spec-build` Comes First

Specflow makes acceptance enforceable. Specification depth follows the next
useful decision: keep the whole feature and future tickets **thin**, review
material shared decisions at **contracted** depth, and make only the selected
implementation slice **build-ready**. Reuse contracts and checks where they fit.

A bounded experiment can resolve an empirical unknown before production
contracts exist. Its observed result deepens affected assumptions; it does not
establish readiness. Independent review, current dependency evidence and required
gates govern promotion. Discoveries invalidate affected readiness at the next
work boundary, including after failure or interruption.

`feature-build` then implements the selected ready slice, preserving applicable
contract, journey, oracle, provenance and release gates. Future siblings do not
inherit readiness. See [the installed progressive specification procedure](templates/SPECIFICATION.md).

---

## What You Get

| Layer | What it does |
|-------|-------------|
| **Contract tests** | YAML rules scan source for forbidden patterns — break a rule, build fails |
| **Journey tests** | Playwright tests for critical user flows — if a journey doesn't pass, the feature isn't done |
| **Loop runner** | `specflow run` writes a durable run contract and ledger so agents execute the loop instead of referencing it |
| **Hooks** | Auto-trigger tests on build/commit, catch violations on Write/Edit, reject commits without issue numbers |
| **CI workflows** | PR compliance gate + post-merge audit — no contract violations merge to main |
| **30+ agents** | Orchestrate wave execution, write contracts, audit boards, simulate specs |

---

## Two ways to use it

**On its own.** Contracts + journey tests + hooks + CI = your specs enforce themselves. That's everything in "What You Get" above — no adversary, no loop kit required. Specflow is independently useful as the architectural-enforcement layer.

**As part of the end-to-end pipeline.** `specflow init` also scaffolds a runnable loop kit (`QA/loops/`) + process docs that place Specflow as **Gates B / B.5 / C** inside the larger idea→merged-code loop:

```
DISCOVER → PRD → [GATE A: adversary] → TICKETS → [Specflow: GATE B/B.5] → BUILD → [GATE C] → merged
```

Gate A (the hostile critic) is a separate skill — the [adversarial-prd-reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer). Specflow doesn't require it, but the pipeline pairs them. The loop runs whole on either runtime — Claude Code (`Workflow`) or Codex (automations); see `PROCESS-CLAUDE.md` / `PROCESS-CODEX.md`. The path (`QA/loops/*.yaml`) is the source of truth; each runtime is a binding of it. **Muscle never self-approves — Gate A (a hostile critic) and Gate C (CI on a real backend) decide.**

### Prompt vs contracted loop

A prompt is one instruction. A Specflow loop is a job contract: goal, input,
current stage, next gate, durable evidence, stop condition, and
`never_without_human` rules. `specflow run` makes that contract visible on disk
under `.specflow/runs/<slug>/run-contract.yaml` and appends progress to
`.specflow/runs/<slug>/ledger.jsonl`.

The local runner is not a hosted scheduler. It runs or records the next bounded
step, preserves state, and stops when a human gate, missing evidence, failed
gate, or `agent_action_required` state is reached.

After an agent completes a rail that has no built-in verifier, persist a
hash-bound stage-evidence manifest and resume with `--stage-evidence`:

```yaml
stage_evidence:
  schema_version: 1
  stage: 2_contract
  artifacts:
    - path: docs/specs/example/contract.yml
      sha256: <sha256-of-the-file>
  checks:
    - name: contract-tests
      command: npm test -- --runInBand
```

```bash
specflow run feature-build --slug example --stage-evidence evidence/example-2-contract.yml
```

Specflow re-reads every artifact hash and reruns every check before advancing.
The manifest is evidence, not a verdict: stale hashes, failed checks, stage
mismatches, and commands requiring a human action all block advancement. Rail
`7_ci_handoff` stops with `human_ci_handoff_required`; it never pushes or opens
a PR automatically.

For generative stages, an optional adapter policy can delegate one turn to an
operator-owned CLI such as Claude Code (`claude -p`) or Codex (`codex exec`).
Those CLIs keep their own authentication and subscriptions; Specflow stores no
Claude/Codex subscription secrets. Provider output is never itself a gate result:
the owning Specflow verifier must rerun before the run contract advances.

For larger initiatives, use `.specflow/adapter-routing.yml` to declare the
runtime profile. Claude Code uses the shipped Claude/Fable planning and review
profile; Codex uses the shipped Codex-only GPT-5.6 Sol profile. Each policy also declares a thinking level
(`effort`) such as `medium`, `high`, or `xhigh`. The shipped
runtime-specific template requires
`--confirm-models` before invoking a routed provider, so expensive model choices
are shown to the operator before spend or quota use. Budget fields are caps /
quota guards, not guaranteed costs; ChatGPT-authenticated Codex consumes Codex
plan quota/credits rather than OpenAI API billing. Select the runtime explicitly
with `specflow init . --runtime codex`, `specflow update . --runtime
claude-code`, or `specflow run --setup-routing --runtime codex|claude-code`.
Reruns are idempotent, custom routing is preserved unless `--replace-routing`
is supplied, and `.specflow/install-state.yml` records routing provenance.

Before any build loop starts, the agent should say either `Model routing active:`
with the current stage's provider/model choices, or explain how to install the
routing file. No routed model spend should happen before that confirmation.

See [Specflow Model Routing](MODEL_ROUTING.md) for the operator workflow, the
technical routing format, and how to change the defaults.

### The three loops (`QA/loops/`)

| Loop | For | In one line |
|------|-----|-------------|
| **spec-build** | a new feature / rough idea | discover → thin backlog → **Gate A** for selected contracted decisions → applicable **Gate B/B.5** for the next build-ready slice; future tickets stay thin |
| **feature-build** | a ready ticket → tested slice | the 5 rails (ticket → contract → real-backend e2e → oracle-anchored → impl) → **Gate C** (CI vs a real seeded backend); an epic isn't done until **Gate D** — the persona walk on the *merged* tree (catches seam bugs per-slice green is blind to) |
| **daily-use-teardown** | an *already-built* product | investigate the live app → **human confirms the map (hash-bound sign-off)** → top-thinker persona walks (WORKS/CONFUSING/BROKEN + evidence) → prioritized do-list → feeds spec-build |

Start at `QA/loops/README.md`. **Maturity:** spec-build + feature-build are battle-tested on real epics; **daily-use-teardown is newer** — its distinctive stages were unproven until their first real run, so treat its output as a strong draft.

---

## FAQ

**Isn't this just more testing?** No. Tests verify behaviour. Contracts verify architecture. "No localStorage in service workers" survives any refactor.

**What if I don't have a perfect spec?** Start with "document what works today." Your first contract can be: whatever we're doing now, don't break it.

**Can LLMs actually follow contracts?** Even if they don't, tests catch it. You don't need the LLM to behave. You need it to be checkable.

---

## Addendum: the full execution pipeline (adversary + Specflow + ruflo)

Specflow is **Gates B / B.5 / C** of a larger loop that turns a rough idea into merged code you can
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
| **A** | the PRD | Independent scoped review of selected contracted decisions through Duo: initial review plus one repair, with a durable receipt. Thin backlog writing does not require full adversary review or per-round commits. | **HARD** |
| **B** | tickets | `specflow audit` + closure validator — every requirement → journey → test → issue, no orphans, no duplicate IDs. | soft (controller) |
| **B.5** | tickets | **Pre-flight simulation** — examine the selected build-ready slice and direct seams; a relevant CRITICAL design gap blocks. Future tickets stay thin. *Its own gate.* | soft (controller) |
| **C** | each build/slice | **Specflow CI** — contract tests + journey tests against a *real seeded backend* + anti-pattern audit + coverage ratchet. Runs in CI under branch protection: a violation **cannot merge**. | **HARD (unfakeable)** |
| **D** | the *merged* epic | **Persona-walk integration gate** — per-slice green is blind to seam bugs (vertical slices, horizontal collisions). GATE D walks personas across the merged tree; a red hop is dispositioned `bug` or a *human-countersigned* `stale-oracle` — the agent can't reconcile its own oracle. An epic isn't done until D is green. | **HARD** |

For applicable selected work, Gate A includes the relevant persona and falsification evidence. Contracted UI decisions receive a paper walkthrough; build-ready slices receive scoped simulation. Reuse shared evidence without imposing that package on the entire backlog.

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
(Gate A, Gate C) outside the swarm. **No fork needed** — the adversary is a runtime skill the critic
invokes; Specflow is a CLI + CI the swarm calls.

---

## Links

<!-- absolute URLs so links resolve on the npm page too, not just GitHub -->
| | |
|---|---|
| [The loop kit](https://github.com/Hulupeep/Specflow/blob/main/templates/loops/README.md) | Run the pipeline — paths, prompts, the three loops |
| [Detailed Setup](https://github.com/Hulupeep/Specflow/blob/main/docs/getting-started.md) | Manual paths, updating, SKILL.md |
| [Agent Library](https://github.com/Hulupeep/Specflow/blob/main/agents/README.md) | 30+ agents for wave execution |
| [Adversarial PRD Reviewer](https://github.com/Hulupeep/adversarial-prd-reviewer) | Review relevant irreversible decisions before promotion (Gate A) |
| [Contract Schema](https://github.com/Hulupeep/Specflow/blob/main/CONTRACT-SCHEMA.md) | YAML format for contracts |
| [CI Integration](https://github.com/Hulupeep/Specflow/blob/main/CI-INTEGRATION.md) | GitHub Actions setup |
| [npm](https://www.npmjs.com/package/@colmbyrne/specflow) | `@colmbyrne/specflow` |
| [Issues](https://github.com/Hulupeep/Specflow/issues) | Bugs and ideas |

### Interactive build with a second model

Use `/duo-build #905` in Claude Code or `$duo-build #905` in Codex. Feature text
works too; the skill reuses spec-build preparation and feature-build implementation,
then automatically sends each coherent batch to the other CLI for read-only review.
Resume with `duo-build resume <run-id>` using the same native prefix.
Install this checkout into the target project, then restart the agent session:

```sh
bash /path/to/Specflow/install-hooks.sh /path/to/project --runtime claude-code
# For a Codex starting session, use --runtime codex instead.
```

Both `claude` and `codex` must be installed and authenticated. The builder remains
interactive; the other CLI reviews frozen source and raw evidence. Missing peer
access blocks duo verification. Each run saves its goal, findings, evidence and
resume ID locally. Updated runs use the tier policy above; older active runs keep
their pinned runtime until completion.

For optional TypeSafe advice, put the key in the **target project's untracked
`.env.local`**:

```dotenv
TYPESAFE_API_KEY=your-key
```

Tell the builder: “Use TypeSafe in advisory mode for this Duo run, reading
`.env.local`, with a maximum of 20 calls.” It configures that file explicitly;
the workflow does not search for keys. TypeSafe checks focused evidence and flags
uncertainty; it cannot replace peer review or pass a required gate. Shadow mode
records a comparison without influencing the review. The Python SDK is not needed.
See [duo-build configuration, invocation and evidence](docs/duo-build.md).
