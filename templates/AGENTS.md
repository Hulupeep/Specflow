# AGENTS.md

Use this file for Codex, K2.7, and other agents that read repository-level agent instructions.

<!-- specflow:work-routing:start -->
## Specflow Work Routing

Scale ceremony to the ask’s size, uncertainty and risk. Use the installed
`specflow-loop-selector` skill to choose the lightest sufficient work weight
before deciding whether a loop is needed: Tweak, Bug, UI feature without schema
change, Schema/RPC change, New concept/behaviour change, or Multi-slice epic.
The skill contains the decision table and risk modifiers. Consulting it does
not start a loop or require a run contract. State the weight, reason and checks
briefly in the existing task/response; do not manufacture a triage artifact.

Raise verification for database/data writes, auth/security, relied-on gestures,
hard-to-undo data, billing and cross-repo seams. Display-only scope, reversibility,
a feature flag or owner testing within a day can reduce ceremony, but cannot
waive required checks. Bugs need a failing test before the fix. Schema/RPC changes
need the full ticket, Gate C replay/rollback/pgTAP and CI migration-replay. New
concepts or changed gestures need simulation before building; new concepts also
need a kill check. Epics retain waves, journey gates and Gate D.

Required UI journeys must actually execute; server-state journeys must use a real
seeded backend and exercise the relevant auth/API/persistence paths. Mocks,
screenshots alone and unexecuted specs do not prove them. Preserve the journey
ID, steps, success criteria, spec path and run evidence. Missing backend access
blocks verification. A missing, skipped or never-run required journey is CRITICAL;
a linked deferral records a gap, never a pass. Feature flags and owner testing
cannot replace this evidence.

This managed section supersedes older guidance that automatically sends every
ask into a full loop. Work weight is not a specification-depth label or a new
runner mode. Existing contracts, explicit project requirements and CI/release
gates still apply. Formal Specflow stories retain their prescribed simulation,
audit and pre-flight path; selected full-loop build-ready work still uses the
shared tier helper and its required evidence. Never claim compliance with
CRITICAL/P1 findings. Report requirements that conflict with a lighter route;
do not silently waive them.

Only selected loops require a run contract, runtime routing and model
confirmation. Explicit audit/simulation requests use their own workflows without
automatically starting a build loop. Report checks actually run and remaining gaps.
<!-- specflow:work-routing:end -->

## Specflow Loop Routing

For work-weight triage and any subsequent loop selection, use the installed skill:

- Claude Code: `.claude/skills/specflow-loop-selector/SKILL.md`
- Codex: `.codex/skills/specflow-loop-selector/SKILL.md`
- Generic agents: `.agents/skills/specflow-loop-selector/SKILL.md`

If the skill is not listed in the current session's tool/skill registry, do not fall back to ad hoc loop reading. Read the local `SKILL.md` file directly from the paths above. If none exists, stop and tell the human to run `npx @colmbyrne/specflow init .` or `npx @colmbyrne/specflow update .`, then restart/reload the agent session.

If triage selects a loop, do not only reference `QA/loops/*.yaml`. Select the loop, then emit a concrete `run_contract` with the selected loop, goal, input artifact, current stage/rail, next gate, durable evidence, stop condition, and `never_without_human` rules.

If `specflow run` is available, prefer it for local loop state:

```bash
npx @colmbyrne/specflow run spec-build --slug <slug> --goal "<done state>" --input <artifact>
```

This writes `.specflow/runs/<slug>/run-contract.yaml` and
`.specflow/runs/<slug>/ledger.jsonl`. Treat those files as the source of truth
for where the loop resumes.

Continuation rule: keep advancing through all currently unblocked stages/rails in the same invocation. Stop only for a true human gate, a `never_without_human` action, missing required input/evidence, exhausted repair budget, external wait such as branch-protected CI, or the loop's done/handoff state. Do not stop just because the next item is a soft gate such as `GATE_B` or `GATE_B5`.

## Specflow Simulation Path

Read `SPECIFICATION.md` and use `scripts/specflow-tier.cjs` before creating,
refining, simulating, uplifting or auditing a ticket. Thin work stays thin;
contracted UI flows receive a paper walkthrough. The following scoped path is
required for the selected build-ready slice before production work:

`create/refine story -> specflow-simulate -> specflow-audit/uplift -> pre-flight gate -> implementation`

Implement using the parts selected by work-weight triage, or `feature-build`
when a full loop is needed. Run-contract requirements apply only to an active
loop. Either route must validate applicable readiness evidence.

Do not mark a ticket ready for `feature-build` when required simulation is missing,
stale, skipped or only mentioned in chat. Derive `run_contract.tier` and
`simulation_required` from the shared policy on start and resume. A tier label
alone cannot grant readiness. Production routes must validate current evidence.

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
