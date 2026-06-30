# Generative Loop Adapter - Hop Oracle

## Gate A Hops

| Journey | From | Required control | Expected value re-read | Oracle/source |
|---|---|---|---|---|
| J-ADAPTER-CLAUDE-PRINT | agent_action_required stage | `claude -p` adapter policy | Ledger records provider `claude-print`, transcript path, exit code, and gate rerun result | `claude --help`, adapter policy |
| J-ADAPTER-CODEX-EXEC | agent_action_required stage | `codex exec` adapter policy | Ledger records provider `codex-exec`, transcript path, exit code, and gate rerun result | `codex exec --help`, adapter policy |
| J-ADAPTER-HUMAN-GATE-BLOCK | forbidden action attempt | `never_without_human` policy | Run stops with `blocked_human_required` and current stage unchanged | run contract policy |
| J-ADAPTER-FAILURE-EVIDENCE | timeout/malformed output | adapter runner | Run stops with `adapter_failed` and transcript path is persisted | ledger contract |
| J-ADAPTER-AUTH-UNAVAILABLE | missing or unauthenticated provider CLI | readiness check | No provider process is invoked; ledger records `adapter_unavailable` and remediation hint | provider readiness check |

## Seam-Derived Hops (GATE B)

| Seam surface | Pair | Kind | Required re-read assertion |
|---|---|---|---|
| `init` | GENERATIVE-ADAPTER-01 -> GENERATIVE-ADAPTER-02 | writer-reader | Install docs show where adapter policy templates are placed after init. |
| `verify` | GENERATIVE-ADAPTER-01 <-> GENERATIVE-ADAPTER-02 | writer-writer | Adapter implementation and docs both state that provider success is followed by Specflow verifier rerun. |
| `audit` | GENERATIVE-ADAPTER-01 -> GENERATIVE-ADAPTER-02 | writer-reader | Audit/help docs describe adapter evidence requirements consistently with the controller. |
