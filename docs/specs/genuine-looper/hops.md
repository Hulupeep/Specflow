# Genuine Looper Hops

| Journey | Surface | Entry | Required re-read assertion | Oracle |
|---|---|---|---|---|
| J-LOOP-UNTIL-TERMINAL | `runUntilTerminal` | `specflow run --until-terminal` | Ledger contains more than one entry when a mechanical gate advances into a generative stop. | `tests/contracts/loop-run-contract.test.js` |
| J-LOOP-YAML-SEQUENCE | `loopSequence` | `run_contract.path` | Stage sequence matches `templates/QA/loops/spec-build.yaml`. | Contract test |
| J-GEN-STAGE-PROMPT | `materializeStagePrompt` | generative stop | Prompt file contains current stage and `never_without_human`. | Contract test |
| J-GEN-SESSION-RESUME | `buildAdapterCommand` | provider policy | Claude/Codex argv includes session resume value. | Contract test |
| J-PROVENANCE-DIFF | `auditDiffText` | provenance CLI | Suspicious diff line fails. | Provenance gate test |
| J-INSTALL-LOOP-COMPLETE | `verify-setup.sh` | fresh project verify | Missing adapter policies fail install health. | Installer test |

## Seam-Derived Hops (Gate B)

| Seam surface | Pair | Kind | Required re-read assertion |
|---|---|---|---|
| `ledger.jsonl` | LOOP-RUNTIME-04 -> LOOP-RUNTIME-06 | writer-reader | A run-until-terminal pass writes compact ledger entries that `specflow run status` re-reads in order. |
| `nextStage` | LOOP-RUNTIME-05 -> LOOP-RUNTIME-04 | writer-reader | YAML-derived next-stage calculation is the value consumed by bounded continuation before every iteration. |
