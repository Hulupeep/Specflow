# AGENTS.md

Use this file for Codex, K2.7, and other agents that read repository-level agent instructions.

## Specflow Loop Routing

Before starting any Specflow loop work, use the installed skill:

- Claude Code: `.claude/skills/specflow-loop-selector/SKILL.md`
- Codex: `.codex/skills/specflow-loop-selector/SKILL.md`
- Generic agents: `.agents/skills/specflow-loop-selector/SKILL.md`

If the skill is not listed in the current session's tool/skill registry, do not fall back to ad hoc loop reading. Read the local `SKILL.md` file directly from the paths above. If none exists, stop and tell the human to run `npx @colmbyrne/specflow init .` or `npx @colmbyrne/specflow update .`, then restart/reload the agent session.

Do not only reference `QA/loops/*.yaml`. First select the loop, then emit a concrete `run_contract` with the selected loop, goal, input artifact, current stage/rail, next gate, durable evidence, stop condition, and `never_without_human` rules.

If `specflow run` is available, prefer it for local loop state:

```bash
npx @colmbyrne/specflow run spec-build --slug <slug> --goal "<done state>" --input <artifact>
```

This writes `.specflow/runs/<slug>/run-contract.yaml` and
`.specflow/runs/<slug>/ledger.jsonl`. Treat those files as the source of truth
for where the loop resumes.

Continuation rule: keep advancing through all currently unblocked stages/rails in the same invocation. Stop only for a true human gate, a `never_without_human` action, missing required input/evidence, exhausted repair budget, external wait such as branch-protected CI, or the loop's done/handoff state. Do not stop just because the next item is a soft gate such as `GATE_B` or `GATE_B5`.

## Specflow Simulation Path

When creating, refining, uplifting, or auditing a Specflow story/ticket, the simulation path is mandatory before build work:

`create/refine story -> specflow-simulate -> specflow-audit/uplift -> pre-flight gate -> feature-build`

Do not mark a ticket ready for `feature-build` when simulation is missing, stale, skipped, or only mentioned in chat. The `run_contract` must carry `simulation_required: true` until `specflow-simulate` has produced durable findings or a durable clean result.

Lifecycle routing:

- `spec-build`: rough idea/discovery/PRD/ticket creation -> audited tickets.
- `feature-build`: approved Specflow ticket -> implemented slice with provenance and Gate C.
- `gate-d`: merged slices/epic close -> integration persona walk.
- `daily-use-teardown`: already-built product -> evidence-grounded do-list for spec-build.

## Generative Stage Adapters

If a run contract stops at `agent_action_required`, do not pretend the stage is
executed. Either perform the agent work yourself and persist evidence, or resume
with an explicit adapter policy for a local CLI runtime such as `claude -p` or
`codex exec`.

Rules:

- Provider CLI auth/subscription stays with the provider; do not ask for or store
  Claude/Codex subscription secrets in Specflow files.
- Adapter output is not a gate result. Rerun the owning Specflow verifier before
  advancing state.
- Never perform actions listed in `never_without_human`; a provider suggesting
  or attempting one blocks the run.
