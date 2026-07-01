# Fable-Class Loop Compounding Ticket Packet

## Scope

These tickets adapt Specflow for stronger long-horizon agent models while preserving the current trust boundary: provider output is work product, not a gate result.

## Tickets

### #83 MODEL-ROUTING-01 - Add model roles, effort levels, fallback models, and budgets to adapter policies

**Journey:** `J-FABLE-MODEL-ROUTING`

Acceptance:
- Adapter policies support role fields such as `orchestrator`, `worker`, `verifier`, and `fallback`.
- Adapter policies support provider-specific effort fields such as `low`, `medium`, `high`, `xhigh`, or `ultracode` only when the active provider surface supports them.
- Policies can express planner/implementer separation: Fable-class provider for planning; Codex/GPT-class provider for implementation.
- Runner records provider, requested model id, effective/reported model id when the provider exposes it, role, effort, fallback model id, fallback/refusal reason, and max budget in `ledger.jsonl`.
- When a Fable-class request is refused or routed to Opus/Sonnet/Codex, the ledger preserves both the requested model and the actual model/source used; silent downgrade is a failed contract.
- Unsupported model-role policy fails validation before provider invocation.
- Existing Claude/Codex safe policy templates remain valid.

### #85 STATE-01 - Add `.specflow/STATE.md` and lesson-file compounding memory

**Journey:** `J-FABLE-STATE-MEMORY`

Acceptance:
- State file has sections for verified facts, failed gates, distilled rules, open questions, and last session.
- Confirmed lessons are written one per file under `.specflow/lessons/` with a one-line summary at the top.
- The runner does not save facts already represented by repo files, contracts, or chat transcripts.
- Terminal loop stops append a compact state update.
- Stage prompts reference relevant state sections when present.
- State updates never replace mechanical gate evidence.

### #84 VERIFIER-01 - Add independent verifier stage for provider output

**Journey:** `J-FABLE-INDEPENDENT-VERIFIER`

Acceptance:
- A provider policy can declare a verifier policy separate from the maker policy.
- Verifier policy may name an external reviewer provider for plan review, including Oracle-style review integrations where available.
- Verifier input is artifact plus rubric, not maker reasoning trace.
- Verifier output is recorded separately in the ledger.
- Gate advance remains blocked until the owning script/verifier gate passes.

### #86 WORKTREE-01 - Support isolated worktree execution for delegated agents

**Journey:** `J-FABLE-WORKTREE-ISOLATION`

Acceptance:
- Runner can create or reference an isolated worktree for delegated agent work.
- Ledger records worktree path, branch, base commit, and cleanup status.
- Verifier can run read-only against maker output.
- Specflow never auto-merges delegated work or pushes without human approval.

### #87 ROUTINE-01 - Scaffold `/loop` and routine manifests for scheduled Specflow loops

**Journey:** `J-FABLE-ROUTINE-MANIFEST`

Acceptance:
- CLI scaffolds routine manifests for cron, GitHub Actions, and hosted-agent triggers.
- Manifest stores trigger, `/loop` interval where supported, command, inputs, outputs, budget, and stop rules.
- All variants call `specflow run`; none invent a parallel loop process.
- Portfolio-improvement routines output proposal artifacts that must enter spec-build before implementation.
- Human-gated actions remain blocked.

### #88 VISION-GATE-01 - Add screenshot plus vision-verifier evidence path for teardown and Gate D

**Journey:** `J-FABLE-VISION-EVIDENCE`

Acceptance:
- Teardown/Gate D evidence can include a screenshot and a vision-verifier finding file.
- The finding names the goal, screenshot, model/provider, verdict, and gaps.
- `teardown-gate` validates evidence file presence and value-bearing evidence.
- Vision verdict is evidence, not self-attested gate pass.

### #89 COST-01 - Record model usage and cost-per-accepted-change counters

**Journey:** `J-FABLE-COST-ACCOUNTING`

Acceptance:
- Adapter parser stores token/cost/model metadata when provider output exposes it.
- Ledger records requested model, effective/reported model, role, estimated cost, gate attempt, fallback/refusal reason, and gate result.
- `specflow run status` summarizes attempts, accepted gates, rejected gates, and cost per accepted gate/change.
- Missing usage metadata is recorded as unknown, not fabricated.
