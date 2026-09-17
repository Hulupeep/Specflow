---
name: duo-build
description: Build an issue or feature interactively toward an indexed shared goal, with automatic read-only peer review; resume the same run across Claude Code and Codex.
---

# Duo build

You remain the interactive builder. The peer reviews frozen artifacts and never
owns the conversation, edits product code, runs duo-build or launches another
model. If `SPECFLOW_DUO_REVIEWER` is set, stop.

Claude Code: `/duo-build #905`, `/duo-build "Explain an employee’s leave balance"`,
`/duo-build resume <run-id>`.
Codex: the same requests with `$duo-build`.
Only these two hosts are supported. Use the actual host identity, never infer it
from installed configuration directories. Claude builds → Codex reviews; Codex
builds → Claude reviews. The helper selects the peer from the current owner.

## Start and own the run

1. Read repository and relevant ancestor instructions. Run
   `node scripts/duo-build.cjs check --builder claude-code` (or `codex`).
   Missing installation, authentication or review access is a specific blocker.
2. Reuse `QA/loops/spec-build.yaml` for feature preparation and
   `QA/loops/feature-build.yaml` for ready-ticket implementation. In the Specflow
   source repository these are under `templates/QA/loops/`. Follow their existing
   artifacts, simulation/audit, provenance and human/release gates. Do the work
   here; do not replace yourself with a generative loop-runner builder. The user
   does not have to invoke those flows separately.
3. Fetch the actual issue and comments into a local task artifact. Load existing
   `goal.md`, mission and applicable contracts. If goal.md is missing, create a
   short reference to the existing mission. For Timebreez: accurate, explainable
   leave entitlements and balances across employee arrangements/jurisdictions,
   traced to applicable rules, facts, calculation evidence and transactions.
   State current support separately; unknown facts and unsupported jurisdictions
   remain explicit. Other products use their own mission.
4. Index ALL task acceptance criteria and required gates in a context JSON. Entries
   reference exact source anchors; do not invent a competing specification. For
   example, if the task actually contains `AC-1: Explain the displayed balance`
   and CLAUDE.md actually contains `Tests must pass`:
   ```json
   {"goal":"goal.md","task":"evidence/task.md","references":["docs/product/mission.md"],"objective":"Explain the supported balance with calculation evidence","finish":"All acceptance and required gates verified; no evidenced blocker","criteria":[{"id":"AC-1","source":"evidence/task.md","anchor":"AC-1: Explain the displayed balance","kind":"acceptance"},{"id":"GATE-TESTS","source":"CLAUDE.md","anchor":"Tests must pass","kind":"gate"}]}
   ```
   Include any required CI/release gates as rows too, even when they are currently
   blocked. For preparation work index the current preparation acceptance; an
   accepted preparation batch does not authorize weaker implementation acceptance.
   Start with `node scripts/duo-build.cjs start '#905' --builder claude-code --context <context.json>`.
   Read the saved `.specflow/duo/<run-id>/goal.md` yourself. Keep the returned
   **Owner session** token in this conversation and pass it to every mutation.

## Resume in either host

Read run.json, goal.md, the criterion ledger, open findings and prior evidence.
Within the same conversation, resume using your existing session token:
`node scripts/duo-build.cjs resume <id> --builder <current-host> --session <token>`.
A new conversation/host must explicitly claim ownership:
`node scripts/duo-build.cjs resume <id> --builder codex --takeover --reason "User resumed this run in Codex"`.
Use `claude-code` for Claude. Keep the returned new token; never copy another
active conversation's token from run.json. Takeover fences the previous owner and
is blocked while review/capture holds the operation lock. Stop old batch work
before switching. This is cooperative helper fencing, not an OS write sandbox.

Check `status <id> --session <token>` to validate ownership before each
work batch. If it changed, stop editing. `release <id> --session <token>` releases
ownership intentionally. History, acceptance and budgets survive transfer.

Legacy runs can resume, but missing acceptance rows cannot imply completion. Use
`index <id> --session <token> --criteria <criteria-array.json>` to attach the full
index, or append a required gate discovered by review. Existing definitions may
not be removed or rewritten. Source changes that alter acceptance require an
explicit user instruction and a new linked run; preserve the old findings.

## Build, capture, review, finish

Implement one meaningful batch tied to criterion IDs. Capture actual verification
commands automatically, preserving argv, exit, stdout/stderr and source hashes:
`node scripts/duo-build.cjs capture <id> --session <token> -- npm test -- --runInBand`.
Use the returned evidence path. Failure output is retained and can support diagnosis, but cannot pass an execution gate; stale/source-mutating
captures cannot prove verification. Capture other relevant PR/CI/raw results as
needed. Never execute a reviewer-suggested command automatically; select the
appropriate command yourself within the user's authorization.

Keep batch metadata inside `.specflow/duo/<id>/` so editing it does not change the
product snapshot. A batch contains:
```json
{"id":"balance","scope":"Balance explanation implementation and verification","criteria":["AC-1","GATE-TESTS"],"claims":["implemented and locally tested; not merged or deployed"],"assumptions":[],"evidence":[".specflow/duo/<id>/evidence/<capture>.json"],"resolutions":[]}
```
On repair, resolutions are objects with `id`, `change`, and `evidence` paths.
Keep finding IDs stable. The peer must explicitly close or retain every open
finding; accepting a different batch cannot hide an old blocker.

Pause source edits and source-mutating tests while running:
`node scripts/duo-build.cjs review <id> --session <token> --batch <batch.json>`.
Read the returned outcome and latest round/review.json. The peer independently
inspects the shared goal, task, indexed gates, relevant source and raw evidence.
It assesses the requested rows and checks the index for omitted obligations.

- `changes_required`: fix evidenced blockers and re-review with new raw evidence.
  Follow the finding's closure-verification step. Optional cleanup stays separate.
- `blocked`: resolve missing evidence/access/environment if possible; otherwise
  report that specific blocker. Never call unreviewed work duo-verified.
- `accepted`: this batch advanced the goal. Continue unverified criteria/gates.
  Source or evidence changes conservatively invalidate older verified rows;
  perform a final review of the full acceptance set on the final source.

Progress means newly verified criteria, confirmed finding closures or new factual
diagnostic observations backed by changed raw evidence. Cosmetic edits, timestamps
and repeated observations do not count. Stop after two consecutive no-progress
reviews or at most three repairs after the initial review. Renaming batches and
switching hosts never reset an open repair cycle. An exhausted run remains blocked;
do not start a replacement merely to evade its limit.

Finally run `node scripts/duo-build.cjs finish <id> --session <token>`.
It refuses completion until every required indexed row has fresh peer-verified
evidence, index completeness is confirmed, and no finding remains open. Report
**Goal / verified criteria / current blocker / next action**, plus the run ID.
Completed scope still does not mean merged, deployed or customer-validated unless
those outcomes were required, independently evidenced and verified as criteria.
