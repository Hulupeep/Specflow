---
name: specflow-loop-selector
description: Selects the correct Specflow loop and forces a concrete run contract before work starts. Use when an agent is asked to start Specflow work, build a ticket, create/refine a PRD, investigate an existing product, run Gate D, choose between spec-build and feature-build, or "go find out about" Specflow loops. Compatible with Claude Code, Codex, K2.7, and other agents because it emits a plain YAML run_contract instead of relying on vendor-specific orchestration.
---

# Specflow Loop Selector

Use this before starting any Specflow loop work. Do not rediscover the process by grepping the repo unless a named file is missing.

## Select The Loop

- Rough idea, discovery, PRD, story slicing, ticket creation, or "turn this into ready tickets":
  use `QA/loops/spec-build.yaml`.
  Output: audited, journey-contracted tickets.

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

After selecting a loop, emit a `run_contract` before doing work. Referencing the YAML is not enough.

```yaml
run_contract:
  loop: spec-build | feature-build | gate-d | daily-use-teardown
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

## Mandatory Simulation Path

When the selected work creates, refines, uplifts, or audits a Specflow story/ticket, run the simulation path before that story/ticket can feed build work:

```
create/refine story -> specflow-simulate -> specflow-audit/uplift -> pre-flight gate -> feature-build
```

Rules:
- If the user asks to "simulate", "simulate usage end to end", "run personas through this", "stress-test this story", or "find gaps/edges", use `specflow-simulate` directly.
- If `spec-build` produces or changes tickets/stories, the run contract must include `simulation_required: true` until `specflow-simulate` has run on those tickets/stories.
- A ticket/story is not ready for `feature-build` if simulation is missing, stale, skipped, or only mentioned in chat.
- Simulation findings must be durable: issue comment, story section, or committed artifact. Record the evidence path or issue comment in the run contract.

## Templates

`spec-build`:

```yaml
run_contract:
  loop: spec-build
  goal: SHIP PRD plus audited, journey-contracted tickets
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
  simulation_required: true until specflow-simulate has run on created/refined tickets
  stop_condition: audited tickets handed to feature-build
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
