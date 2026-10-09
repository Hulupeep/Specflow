---
name: specflow-loop-selector
description: Choose the lightest Specflow workflow that covers an ask’s size, uncertainty and risk, then select a loop only when needed. Use for work triage, proportionate verification, loop selection, or explicit spec-build, feature-build and Gate D requests. A lightweight decision does not start a loop.
---

# Specflow Loop Selector

## Choose The Work Weight

Choose the lightest level that covers the actual risk before selecting a loop.
Inspect the affected behaviour and interfaces; file count, issue labels and a
small diff do not establish low risk. Reuse current tickets and evidence. State
one short decision in the existing task/issue or response: **weight, reason,
required checks, simulation needed or not, loop needed or not**. Do not create a
triage document, ticket, run contract or provider call just to make this decision.

| Weight | Typical ask | Parts to invoke |
|---|---|---|
| Tweak | Copy, CSS, a display-only component; deck hint or compact cards | No Specflow ceremony. Relevant unit tests, lint and an emulator screenshot for changed UI (browser equivalent for web). |
| Bug | Stale flick-down, ghost-click tap | Capture a failing regression test before the fix, then pass it and applicable contract tests. A short issue is enough; add a journey when the failure crosses UI/backend boundaries. |
| UI feature, no schema change | Reorder, quick add, full deck using established behaviour | Short ticket with Gherkin, failure cases and `data-testid` selectors; contract tests and an executed emulator/browser journey. Simulate only for a new or changed gesture/mental model, or an already-required gate. |
| Schema or RPC change | Table, constraint, RLS, trigger or RPC contract change | Full ticket; Gate C with migration replay, rollback and pgTAP; CI migration-replay. These checks are mandatory for the applicable database change, even if the diff is tiny. |
| New concept / behaviour change | Detours, pause reasons, changing what “hold” means | Simulate personas and edge routes before building; run a kill check, then implement with the applicable UI/database verification. |
| Multi-slice epic | A Live Stax build spanning dependent slices | Coordinate waves and dependencies, run slice journey gates, then Gate D on the merged result. Keep each slice’s applicable checks. |

These are work profiles, not six CLI modes or a ladder where every higher level
includes every lower ceremony. Combine them when risks overlap: a billing bug
needs its failing test and billing checks; a concept with an RPC needs simulation
and database gates. A ready single slice need not repeat discovery or run waves.

### Adjust For Risk

Raise verification depth for database access, persistent writes, auth/security
rules, changes to gestures or relied-on behaviour, hard-to-undo data, money or
billing, and cross-repository seams. Name the extra check that addresses each
risk. Verify permissions and ownership boundaries for auth/security work, failure
and retry behaviour for money/data writes, and both sides of a cross-repo contract.
Changing a familiar gesture requires simulation even when only one UI file moves.

Display-only changes, easy reversal, a feature flag and an owner committed to
hands-on testing within a day can reduce planning and coordination overhead.
They do not cancel a raised risk or replace tests, database gates, security
checks or a required journey. A persistent write through an unchanged API does
not automatically require a schema ticket: keep the UI profile, but verify the
real write, persistence and relevant failure/permission paths. A changed schema
or RPC contract always invokes the database profile.

For a new concept, the **kill check** asks whether the proposed behaviour solves
the user’s problem, whether an existing interaction already does so, and which
simulation finding would make us stop, simplify or reframe it. Record the result
with the existing acceptance notes before building; do not invent another gate
artifact. Re-triage if implementation reveals a new risk or a wider seam.

### Journey Evidence Is A Floor

For every required journey involving server state, run the emulator/browser
against a real seeded backend (local or isolated test/staging is sufficient;
production is not required). Exercise the actual API/RPC, auth and persistence
paths in scope. Mocks, intercepted success responses, an in-memory substitute,
a screenshot alone or a written-but-never-run test cannot satisfy that journey.
For a truly display-only tweak, a screenshot does not create a backend requirement.

Keep the journey ID, ordered steps and success criteria, executable spec path,
command, tested revision, non-secret environment identity, and actual executed /
failed / skipped results with the existing test evidence. Assert the observable
state after the action, including persisted state when relevant. Missing backend
access means **blocked verification**, not a pass. A missing, skipped or never-run
required UI journey is CRITICAL for Specflow compliance; deferral needs a linked
tracking issue and remains an explicit gap, not completion. Owner testing and
feature flags never substitute for this evidence.

### Decide Whether A Loop Is Needed

Use individual parts directly when the selected work is bounded. Tweak and Bug
do not acquire PRD/ticket ceremony just because this skill was consulted. A
bounded UI feature can use its short ticket, contracts and real-backend journey
without a full loop. Select a loop for explicit loop requests, substantial
discovery, dependency coordination or durable multi-stage execution. Standalone
audit/simulation requests use their prescribed workflows without automatically
starting spec-build or feature-build.

Work weight is separate from specification depth. Existing contracts, explicit
project instructions and required CI/release checks still apply. When working
on a formal Specflow story, use its prescribed simulation/audit path; weight
cannot waive it. In particular, the current full-loop build-ready policy still
requires simulation evidence. Do not set `simulation_required: false`, relabel a
ticket or call a required artifact N/A to evade that gate. Report a conflict
between a lightweight recommendation and an existing requirement explicitly.

If no loop or formal specification work is needed, execute the selected checks
and stop here; no tier record or run contract is needed. Otherwise use the depth
policy below, and emit a run contract only if a loop is selected.

Read `SPECIFICATION.md` (source kit: `templates/SPECIFICATION.md`). Run
`node scripts/specflow-tier.cjs inspect <record.json> specflow-loop-selector inspect`
before selecting depth. Missing labels mean thin; conflicting labels block.
For a selected loop, record the returned `tier` and `simulation_required` in its
run contract; using a specification component alone does not require one.
The detailed lifecycle below applies only to evidence justified for the selected
slice. Thin selection ends at planning state; it does not generate a full spec.

## Select The Loop (Only When Needed)

- Rough idea, discovery, PRD, story slicing, ticket creation, or "turn this into ready tickets":
  use `QA/loops/spec-build.yaml`.
  Output: a mixed-tier backlog with only the next justified slice deepened.

- Existing approved Specflow ticket/issue ready to implement:
  use `QA/loops/feature-build.yaml`.
  Output: one branch/slice ready for review after provenance and Gate C.

- Merged slices, epic close, wave integration, seam walk, or cross-slice persona check:
  use `QA/loops/feature-build.yaml` -> `epic_gate`.
  Output: Gate D result.

- Already-built product needs investigation before specs:
  use `QA/loops/daily-use-teardown.yaml`.
  Output: evidence-grounded do-list for spec-build.

If two loops look plausible, inspect current artifacts and evidence and choose
the first unmet lifecycle need. Do not repeat spec-build for an already-ready
ticket. State why the selected loop is needed.

## Select The Runtime Routing Profile

Before starting `spec-build` or `feature-build`, select routing from the active
agent runtime. Use the agent identity supplied by the host; never infer the
runtime from `.claude/`, `.codex/`, or `.agents/` directories because Specflow
installs all three.

- Claude Code: use
  `.specflow/adapter-policies/claude-code-large-routing.yml`.
- Codex: use
  `.specflow/adapter-policies/codex-gpt56-sol-routing.yml`.
- Any other or unknown runtime: stop and ask the human which routing profile to
  activate.

Activate or refresh the selected profile through the canonical project setup path:
`npx @colmbyrne/specflow update . --runtime <codex|claude-code>`. Creating the
routing file does not invoke a provider. The same command refreshes the installed
loop-selector skills. The installer switches known managed or legacy shipped
profiles, and preserves custom routing unless the human explicitly requests
`--replace-routing`. Display a preserved custom file's actual current-stage
policy during model confirmation.

If a loop returns `code: routing_required`, stop before provider invocation and
show its `recovery_command` verbatim. Do not substitute a template copy command
or a separate runner setup command.

## Mandatory Run Contract

Only after selecting a loop, emit a `run_contract` before loop execution. Referencing the YAML is not enough.

```yaml
run_contract:
  loop: spec-build | feature-build | gate-d | daily-use-teardown
  tier: <effective tier returned by specflow-tier.cjs>
  tier_record: <current record.json>
  simulation_required: <returned boolean; false for thin>
  goal: <one sentence done-state>
  input_artifact: <issue/prd/epic/app/discovery path or URL>
  path: QA/loops/<selected>.yaml
  current_stage_or_rail: <id from the selected YAML>
  next_gate: <gate text from the selected YAML>
  durable_evidence: <files/branch/evidence paths that must persist>
  stop_condition: <where this tick stops>
  never_without_human:
    - <copied from selected YAML>
```

Rules:
- Before starting `spec-build` or `feature-build`, select or validate the runtime routing profile above, then emit a model-routing confirmation. State `Model routing active:` and list the route for the current stage, including provider, role, requested model, effort, fallback model, and budget cap when present. Say "budget cap / quota guard", not "cost". For `codex-exec`, state that if Codex CLI is signed in with ChatGPT, usage consumes Codex plan quota/credits rather than OpenAI API billing.
- Routed providers require explicit confirmation before spend/quota use. Use `specflow run <loop> --slug <slug> --confirm-models` only after the user has accepted the displayed model choices.
- If the user explicitly bypasses routing with `--adapter-policy`, still state that this is a one-off override and name the policy/model before invoking it.
- Load only the selected YAML and its prompt/example if needed.
- Continue through every currently unblocked stage/rail in the same invocation.
- Persist evidence to the paths in the run contract; chat-only evidence does not count.
- Update the run contract after each completed stage/rail.
- Stop only at a selected YAML hard gate that truly requires human input, a `never_without_human` action, missing required input/evidence, exhausted repair budget, external wait such as branch-protected CI, or the loop's done/handoff state.
- Do not stop merely because the next stage is named `GATE_*`, `B.5`, or `handoff`. Soft gates are work to perform now, not boundaries for asking permission.

## Tier-scoped Simulation Path

When promoting the selected slice to build-ready, run the scoped simulation path before it can feed production build work:

```
create/refine story -> specflow-simulate -> specflow-audit/uplift -> pre-flight gate -> feature-build
```

Rules:
- If the user asks to simulate, use `specflow-simulate` with the same tier policy: thin stays a bounded planning inspection, contracted UI gets a paper walkthrough, build-ready gets scoped simulation.
- `simulation_required` is derived from the effective tier, never from merely creating or editing a ticket. A required build-ready simulation still must have current durable evidence.
- A ticket/story is not ready for `feature-build` if simulation is missing, stale, skipped, or only mentioned in chat.
- Simulation findings must be durable: issue comment, story section, or committed artifact. Record the evidence path or issue comment in the run contract.

## Templates

`spec-build`:

```yaml
run_contract:
  loop: spec-build
  goal: define the outcome and deepen only the next justified slice
  tier: thin
  input_artifact: <grounding_ref>
  path: QA/loops/spec-build.yaml
  current_stage_or_rail: discover
  next_gate: grounding written with problem + oracle
  durable_evidence:
    prd: PRDs/<slug>-prd.md
    verdict: PRDs/<slug>-verdict.md
    falsification: PRDs/<slug>-falsification.md
    hops: PRDs/<slug>-hops.md
    simulation: issue comments or docs/specs/<slug>-simulation.md
  simulation_required: false # thin planning; derive from policy on every resume
  stop_condition: next decision identified; only verified build-ready slices feed feature-build
  never_without_human:
    - create issues from a DO_NOT_SHIP PRD
    - fabricate a green verdict
```

`feature-build`:

```yaml
run_contract:
  loop: feature-build
  goal: branch for #<issue> passes provenance and Gate C, ready for review
  input_artifact: issue #<issue>
  path: QA/loops/feature-build.yaml
  current_stage_or_rail: 1_ticket
  next_gate: ticket + ACs + journey id confirmed
  durable_evidence:
    branch: feat/<issue>-<slug>
    evidence_note: branch/thread evidence note
    provenance: evidence/provenance-<issue>.json
  precondition: simulation and audit/pre-flight are complete on the input ticket
  stop_condition: ready for human CI handoff, then Gate C green
  never_without_human:
    - git push
    - open PR
    - merge
    - --no-verify
    - override contract
```

`gate-d`:

```yaml
run_contract:
  loop: gate-d
  goal: Gate D green for epic #<epic>
  input_artifact: epic #<epic> + PRDs/<slug>-hops.md
  path: QA/loops/feature-build.yaml -> epic_gate
  current_stage_or_rail: GATE_D
  next_gate: node scripts/teardown-gate.cjs check-gate-d gate-d/<epic>/
  durable_evidence: gate-d/<epic>/
  stop_condition: evidence/disposition gate passes; signatures only if policy requires them
  never_without_human:
    - sign when signoff_policy.required
    - stale-oracle amendment
    - closing the epic on a red GATE D
```

`daily-use-teardown`:

```yaml
run_contract:
  loop: daily-use-teardown
  goal: confirmed journey map plus evidence-grounded do-list
  input_artifact: <app URL/env>
  path: QA/loops/daily-use-teardown.yaml
  current_stage_or_rail: investigate
  next_gate: journey map committed
  durable_evidence: docs/teardown/<slug>/
  stop_condition: do-list handed to spec-build
  never_without_human:
    - running teardown-gate sign
    - starting deep dive before map signoff
    - creating tickets directly
```
