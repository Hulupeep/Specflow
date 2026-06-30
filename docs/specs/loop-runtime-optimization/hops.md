# Loop Runtime Optimization - Hop Oracle

## Gate A Hops

| Journey | From | Required control | Expected value re-read | Oracle/source |
|---|---|---|---|---|
| J-LOOP-RUN-SPECBUILD | CLI invocation | `specflow run spec-build` | `run_contract.loop = spec-build` and ledger terminal state is not empty | `bin/specflow.js`, `templates/QA/loops/spec-build.yaml` |
| J-LOOP-RESUME | Existing run contract | Re-run same command | Current stage resumes from persisted contract instead of starting over | run contract schema and ledger |
| J-LOOP-INVALID-CONTRACT | Invalid contract file | schema validator | Error names missing field and leaves current stage unchanged | run contract validator |
| J-LOOP-POSITIONING | Installed docs | README and AGENTS instructions | Docs say contracted loop runtime, not hosted scheduler | README and templates/AGENTS.md |
| J-LOOP-INSTALL-DISCOVERY | Fresh codespace install | Skill files under agent homes | Loop selector skill is discoverable or AGENTS direct-read fallback tells agent where to load it | setup-project.sh skill install |

## Seam-Derived Hops (GATE B)

| Seam surface | Pair | Kind | Required re-read assertion |
|---|---|---|---|
| `feature-build` | LOOP-RUNTIME-01 -> LOOP-RUNTIME-02 | writer-reader | Feature-build readiness docs block on the same simulation state the runner writes. |
| `spec-build` | LOOP-RUNTIME-01 <-> LOOP-RUNTIME-02 | writer-writer | Runtime behavior and docs describe the same spec-build path and stop conditions. |
| `verify` | LOOP-RUNTIME-01 <-> LOOP-RUNTIME-02 | writer-writer | Install/readiness docs and runner gates distinguish default install verify from strict project readiness. |
