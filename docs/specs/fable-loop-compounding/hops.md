# Fable-Class Loop Compounding Hops

| Journey | Surface | Entry | Required re-read assertion | Oracle |
|---|---|---|---|---|
| J-FABLE-MODEL-ROUTING | `adapter_policy` | safe policy templates | Ledger re-reads model role, effort, model id, fallback, budget cap, and planner/implementer split. | Contract tests |
| J-FABLE-STATE-MEMORY | `.specflow/STATE.md` | terminal loop stop | Next generated stage prompt references verified facts, last-session pointer, and relevant lesson file summaries. | Runner test |
| J-FABLE-INDEPENDENT-VERIFIER | `verifier` | provider output | Maker and verifier transcripts are separate, external review provider is recorded when used, and gate remains `gate_rerun_required`. | Adapter test |
| J-FABLE-WORKTREE-ISOLATION | `ledger.jsonl` | delegated work | Ledger re-reads worktree path, branch, and cleanup status. | Runner test |
| J-FABLE-ROUTINE-MANIFEST | `specflow run` | scaffolded manifest | Manifest command re-reads `/loop` interval where supported, `specflow run`, `never_without_human`, and spec-build routing for project-improvement proposals. | CLI test |
| J-FABLE-VISION-EVIDENCE | `teardown-gate` | Gate D/teardown evidence | Evidence file exists and value-bearing re-read remains mandatory. | teardown-gate test |
| J-FABLE-COST-ACCOUNTING | `ledger.jsonl` | adapter completion | Status re-reads model/cost counters without inventing missing usage. | Status test |

## Seam-Derived Hops (Gate B)

These hops were derived by `node scripts/verify-seams.cjs docs/specs/fable-loop-compounding/tickets.json --repo-root .`.

| Seam surface | Pair set | Kind | Required re-read assertion |
|---|---|---|---|
| `.specflow` | ROUTINE-01, STATE-01 | writer-writer | A scheduled/routine run and the memory writer agree on the same `.specflow` layout, without one hiding or overwriting the other's state. |
| `adapter_policy` | COST-01, MODEL-ROUTING-01, VERIFIER-01 | mixed | Adapter policy re-reads preserve model role, effort, fallback, budget, verifier, and external-review fields in one normalized policy shape. |
| `ledger.jsonl` | COST-01, MODEL-ROUTING-01, ROUTINE-01, STATE-01, VERIFIER-01, WORKTREE-01 | writer-writer | A merged run ledger records all new stage, model, verifier, routine, worktree, memory, and cost events as append-only structured entries. |
| `run_contract` | WORKTREE-01, ROUTINE-01, STATE-01 | writer-reader | Worktree and routine execution re-read the same run contract state that memory compaction uses to resume the next stage. |
| `runAdapter` | VERIFIER-01, COST-01, MODEL-ROUTING-01 | writer-reader | Adapter execution preserves maker/verifier separation while exposing enough normalized provider data for routing and cost accounting. |
| `runStatus` | COST-01, WORKTREE-01 | writer-reader | Status output re-reads cost counters and delegated worktree state without inventing missing provider usage. |
