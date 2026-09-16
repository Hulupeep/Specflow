---
name: duo-build
description: Build an issue or feature interactively with automatic read-only review by the other coding CLI; resume a saved duo-build run. Use when the user requests duo-build.
---

# Duo build

You are the interactive builder. Keep the conversation and implementation here.
The peer only reviews; never delegate building or conversation ownership to it.
If `SPECFLOW_DUO_REVIEWER` is set, stop: reviewers cannot start duo-build.

Native invocation: Claude Code `/duo-build #905` or `/duo-build "Explain an employee’s leave balance"`;
Codex `$duo-build #905` or `$duo-build "Explain an employee’s leave balance"`.
Resume in either: `/duo-build resume <run-id>` or `$duo-build resume <run-id>`.
Use the host's runtime identity, not the presence of configuration directories.

## Prepare once, then build here

1. Read relevant repository/ancestor instructions. Run
   `node scripts/duo-build.cjs check --builder codex` (or `claude-code`).
   A missing CLI, authentication or permission is a peer-review blocker; report it
   explicitly. Never label a batch duo-verified without an accepted peer result.
2. Resume: `node scripts/duo-build.cjs resume <run-id>`, then read
   `.specflow/duo/<run-id>/run.json`, `goal.md`, prior requests/findings and raw
   evidence. Preserve task, objective, finish and unresolved findings. If the
   interactive runtime changed, use a new linked run with the correct builder;
   do not silently review with the same provider as the interactive agent.
3. New issue: fetch the actual issue and comments into a repository-local task
   artifact; read its acceptance, contracts and existing mission. Use
   `QA/loops/feature-build.yaml` preparation and implementation rails.
   New feature text: first follow `QA/loops/spec-build.yaml` (discovery through
   ready tickets), then the same feature-build path, within this invocation.
   In the Specflow source repo these paths are under `templates/QA/loops/`.
   Reuse their artifacts/gates; do not ask the user to invoke those workflows
   separately. Honour existing issue creation, audit, simulation and human gates.
   You execute the work interactively; do not start the generative loop runner
   to replace yourself with another builder. Preparation batches also receive
   peer review before being reported complete; use the current preparation
   acceptance as the bounded task, then start a linked implementation run when
   accepted task artifacts change.
4. Load an existing `goal.md`. If absent, create a short goal.md referencing the
   authoritative mission/contracts, without inventing a competing mission.
   For Timebreez the overarching goal is accurate, explainable leave entitlements
   and balances across employee arrangements and jurisdictions. Trace results to
   applicable rules, employee facts, calculation evidence and transactions.
   Clearly separate that ambition from supported behaviour; name unknown facts
   and unsupported jurisdictions. For other products use their own mission.
5. Write a context JSON, e.g. `.specflow/duo-context.json`:
   ```json
   {"goal":"goal.md","task":"evidence/issue-905.md","references":["docs/product/mission.md"],"objective":"Explain the supported employee balance with calculation evidence","finish":"Task acceptance and required gates pass; no evidenced peer blocker remains"}
   ```
   Paths must exist inside the repository. Include authoritative contracts and
   relevant external/ancestor instructions as local evidence references. Do not
   weaken acceptance. Source files are hash-pinned; material changes require
   explicit reconciliation and a new linked run, retaining the old findings.
   Start: `node scripts/duo-build.cjs start '#905' --builder codex --context .specflow/duo-context.json`.
   Use `claude-code` from Claude. Read the saved run's `goal.md` yourself too.

## Work and review loop

- Complete a coherent implementation, diagnosis or verification batch, following
  feature-build rails including provenance and release gates. Capture raw command
  outputs with command, environment, exit code, executed/passed/failed/skipped
  counts and oracle evidence, not just your summary. Export relevant PR/CI/commit
  results locally when they support claims. Reviewer permissions are read-only;
  execute tests as the builder and give the peer raw output to inspect.
- Write a batch JSON (paths repository-relative):
  ```json
  {"id":"balance-explanation","scope":"AC-1 and AC-2 implementation and local verification","claims":["implemented","tested locally; not merged or deployed"],"assumptions":[],"evidence":["evidence/balance-tests.txt"],"resolutions":[]}
  ```
  On repair keep the same batch id; add resolutions with finding IDs, changes
  and evidence locations. Preserve all previous review rounds.
- Pause edits and test processes that mutate the source/evidence until the
  synchronous review returns. Run
  `node scripts/duo-build.cjs review <run-id> --batch .specflow/duo-batch.json`.
  Read the latest `round-*/review.json` and raw peer output. Findings return
  directly to you; no user copying or separate reviewer session is needed.
- `changes_required`: fix only evidenced blockers, collect new evidence and
  re-review. Maximum three repair rounds after the initial review per batch.
  Stop with a specific blocker if unchanged work/evidence repeats, the budget
  exhausts, or no useful progress is possible. Never rename a failed batch to
  evade its budget. Keep optional cleanup/adjacent defects separate.
- `blocked`: identify missing evidence, CLI access, permissions or environment;
  resolve if possible, otherwise report the concrete blocker and next action.
- `accepted`: this batch is peer-reviewed within scope. Continue the next batch
  until scoped acceptance AND the existing required gates pass. Local review
  never implies merged, deployed or customer-validated. If CI/release gates are
  outstanding, say so and preserve the existing human handoff.

Report one readable status: **Outcome advanced / Current blocker / Next action**,
plus the run identifier. Never report a batch complete before peer review.
