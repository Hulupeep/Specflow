# Fable-Class Loop Compounding Hops

| Journey | Surface | Entry | Required re-read assertion | Oracle |
|---|---|---|---|---|
| J-FABLE-MODEL-ROUTING | `adapter_policy` | safe policy templates | Ledger re-reads model role, effort, requested model id, effective/reported model id, fallback/refusal reason, budget cap, and planner/implementer split. | Contract tests |
| J-FABLE-STATE-MEMORY | `.specflow/STATE.md` | terminal loop stop | Next generated stage prompt references verified facts, last-session pointer, and relevant lesson file summaries. | Runner test |
| J-FABLE-INDEPENDENT-VERIFIER | `verifier` | provider output | Maker and verifier transcripts are separate, external review provider is recorded when used, and gate remains `gate_rerun_required`. | Adapter test |
| J-FABLE-WORKTREE-ISOLATION | `ledger.jsonl` | delegated work | Ledger re-reads worktree path, branch, and cleanup status. | Runner test |
| J-FABLE-ROUTINE-MANIFEST | `specflow run` | scaffolded manifest | Manifest command re-reads `/loop` interval where supported, `specflow run`, `never_without_human`, and spec-build routing for project-improvement proposals. | CLI test |
| J-FABLE-VISION-EVIDENCE | `teardown-gate` | Gate D/teardown evidence | Evidence file exists and value-bearing re-read remains mandatory. | teardown-gate test |
| J-FABLE-COST-ACCOUNTING | `ledger.jsonl` | adapter completion | Status re-reads requested/effective model and cost counters without inventing missing usage. | Status test |
| J-FABLE-VERIFIER-NEGOTIATION | `run_contract` | feature-build negotiation | Accepted slice-local verification contract exists before maker implementation; runtime verifier evidence is subordinate to mechanical gates. | Runner + journey test |
| J-FABLE-TRACE-REVIEW | `ledger.jsonl` | `specflow run trace` | Trace report re-reads ledger, transcript refs, provider events, verifier entries, and gate results without default provider summarization. | CLI trace test |
| J-FABLE-HARNESS-MINIMAL | `adapter_policy` | policy validation/status | Status distinguishes durable trust fields from transient provider knobs and flags stale/unknown fields without making them gates. | Policy/status test |

## Seam-Derived Hops (Gate B)

These hops were derived by `node scripts/verify-seams.cjs docs/specs/fable-loop-compounding/tickets.json --repo-root .`.

| Seam surface | Pair set | Kind | Required re-read assertion |
|---|---|---|---|
| `.specflow` | ROUTINE-01, STATE-01 | writer-writer | A scheduled/routine run and the memory writer agree on the same `.specflow` layout, without one hiding or overwriting the other's state. |
| `adapter_policy` | COST-01, HARNESS-MINIMAL-01, MODEL-ROUTING-01, VERIFIER-01, VERIFIER-02 | mixed | Adapter policy re-reads preserve model role, effort, requested/effective model, fallback/refusal reason, budget, verifier, transient provider knobs, and external-review fields in one normalized policy shape. |
| `ledger.jsonl` | COST-01, MODEL-ROUTING-01, ROUTINE-01, STATE-01, TRACE-01, VERIFIER-01, VERIFIER-02, WORKTREE-01, HARNESS-MINIMAL-01 | mixed | A merged run ledger records all stage, model, verifier, routine, worktree, memory, trace, harness-minimality, and cost events as append-only structured entries. |
| `run_contract` | VERIFIER-02, WORKTREE-01, ROUTINE-01, STATE-01, TRACE-01 | mixed | Worktree, routine, state, trace, and negotiated verifier execution re-read the same run contract state before advancing. |
| `runAdapter` | VERIFIER-01, VERIFIER-02, COST-01, HARNESS-MINIMAL-01, MODEL-ROUTING-01 | mixed | Adapter execution preserves maker/verifier separation while exposing enough normalized provider data to distinguish requested model, effective model, fallback/refusal reason, routing, cost, and stale scaffolding. |
| `runStatus` | COST-01, HARNESS-MINIMAL-01, TRACE-01, WORKTREE-01 | mixed | Status output re-reads cost counters, trace divergence, stale/unknown policy fields, and delegated worktree state without inventing missing provider usage. |
| `teardown-gate` | VISION-GATE-01, VERIFIER-02 | writer-reader | Runtime and vision verifier evidence re-read through Gate D/teardown evidence rules, with value-bearing evidence still mandatory. |
| `verifier` | VERIFIER-01, VERIFIER-02, TRACE-01 | mixed | Maker/verifier negotiation, independent verifier output, and trace review agree on artifact-plus-rubric evidence without exposing maker reasoning trace as verifier input. |
