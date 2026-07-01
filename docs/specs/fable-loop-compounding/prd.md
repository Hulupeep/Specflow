# Fable-Class Loop Compounding PRD

**Date:** 2026-07-01
**Loop:** spec-build
**Slug:** `fable-loop-compounding`
**Goal:** Adapt Specflow for stronger long-horizon agent models without weakening gates.

## Problem

Fable-class models can sustain larger planning horizons, stronger reasoning, richer delegation, and longer autonomous sessions than current day-to-day agents. That changes the risk profile for Specflow. A stronger model can complete more of a loop in one run, but it can also make larger unsupported changes, spend more budget, and overwrite process memory unless the controller records state, routes models by role, isolates workers, and separates maker output from independent verification.

Specflow should treat Fable-class models as high-capability workers and orchestrators, not as trusted gates. The product change is to add explicit control-plane surfaces for model routing, state, verifier separation, worktree isolation, routines, vision evidence, and cost accounting.

## Requirements

- `MODEL-ROUTING-01`: Adapter policies support model roles, effort levels, complexity tiers, fallback model IDs, and per-role budget caps.
- `STATE-01`: Specflow maintains `.specflow/STATE.md` plus one-lesson-per-file memory for verified facts, failed gates, distilled rules, and last-session resume state.
- `VERIFIER-01`: Specflow can launch or require an independent verifier stage after generative provider output before any gate advances.
- `WORKTREE-01`: Specflow supports isolated worktree execution for delegated maker/verifier agents and records the worktree path in the ledger.
- `ROUTINE-01`: Specflow can scaffold `/loop`/routine manifests for cron, GitHub Actions, or hosted agent triggers while preserving the same run contract and stop rules.
- `VISION-GATE-01`: Teardown/Gate D evidence supports screenshot plus vision-verifier findings, while the mechanical gate still validates evidence paths and value-bearing re-reads.
- `COST-01`: Loop ledgers record provider/model, token/cost estimates when available, gate attempt counts, and cost-per-accepted-change counters.

## Non-Goals

- Auto-trusting Fable-class model output as a gate result.
- Requiring Anthropic-specific infrastructure for normal Specflow use.
- Letting routines push, open PRs, merge, use `--no-verify`, or override contracts without human approval.
- Letting agents silently rewrite skills or policies. Skill changes are proposed artifacts until reviewed.
- Claiming access, pricing, or safety behavior beyond what the installed provider/API reports at runtime.
- Hardcoding provider-specific effort names as universal. Specflow may carry user/provider policy fields such as `low`, `medium`, `high`, `xhigh`, or `ultracode`, but the adapter must validate support against the active provider surface.

## Operating Model

Specflow remains the control plane:

```text
run contract -> stage prompt -> routed provider/worktree -> transcript/state update
             -> independent verifier -> mechanical gate -> advance or stop
```

Fable-class models are routed to heavy orchestration, adversary, simulation, Gate D, and rule distillation. Lower-cost models remain appropriate for high-volume worker tasks and cheap verifier/classifier tasks. The run contract, ledger, provenance gate, and teardown-gate remain the gate of record.

For implementation work, the default recommendation is planner/implementer separation:

- Fable-class provider: planning, decomposition, adversary, simulation, rule distillation, and project-improvement proposals.
- Codex/GPT-class provider: implementation slices and test repair when feature-build is active.
- External reviewer provider: independent review of Fable-generated plans before implementation tickets are accepted.

Provider names and plugin surfaces are policy fields, not hard dependencies. Specflow records the selected provider and role, then reruns the same mechanical gates.

Prompt generation should avoid over-constraining capable models. Stage prompts should carry:

- **Goal/context:** larger task, audience, and what the output enables.
- **Request:** the current stage in one sentence.
- **Output format:** durable artifact paths and required structure.
- **Constraints:** stop rules, human gates, and forbidden actions.

The prompt should say why the work matters and when to stop/check in, but it should not inline every loop document or bury the model under duplicative instructions already available through the run contract.

Portfolio-level routines may ask a planning provider to inspect important projects and propose improvements, but any proposed improvement must enter spec-build as a normal PRD/ticket packet before implementation.

## Success Criteria

- Tickets declare executable journeys and surfaces for all seven requirements.
- Gate A falsification attacks overclaim, self-modifying skills, cost runaway, and weak verifier separation.
- Gate B seam/ADR/journey checks pass against the local ticket packet.
- Gate B.5 simulation covers long-running session, hosted routine, UI vision, and model fallback routes.
- Resulting GitHub issues are ready for feature-build implementation.
