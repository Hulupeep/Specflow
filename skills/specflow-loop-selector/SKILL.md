---
name: specflow-loop-selector
description: Selects the correct Specflow loop and forces a concrete run contract before work starts. Use when an agent is asked to start Specflow work, build a ticket, create/refine a PRD, investigate an existing product, run Gate D, choose between spec-build and feature-build, or "go find out about" Specflow loops. Compatible with Claude Code, Codex, K2.7, and other agents because it emits a plain YAML run_contract instead of relying on vendor-specific orchestration.
---

# Specflow Loop Selector

Use this before starting any Specflow loop work. Do not rediscover the process by grepping the repo unless a named file is missing.

Read `SPECIFICATION.md` (source kit: `templates/SPECIFICATION.md`). Run
`node scripts/specflow-tier.cjs inspect <record.json> specflow-loop-selector inspect`
before selecting depth. Missing labels mean thin; conflicting labels block.
Record the returned `tier` and `simulation_required` in the run contract.
The detailed lifecycle below applies only to evidence justified for the selected
slice. Thin selection ends at planning state; it does not generate a full spec.

## Select The Loop

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

If two loops look plausible, choose the earlier loop in the lifecycle and state why.

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

Activate or refresh the selected profile with
`specflow run --setup-routing --runtime <codex|claude-code>`. Creating the
routing file does not invoke a provider. The installer switches known managed or
legacy shipped profiles, and preserves custom routing unless the human explicitly
requests `--replace-routing`. Display a preserved custom file's actual
current-stage policy during model confirmation.

## Mandatory Run Contract

After selecting a loop, emit a `run_contract` before doing work. Referencing the YAML is not enough.

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
