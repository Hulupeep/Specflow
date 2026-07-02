# Verifier Runtime Lifecycle - Hops

**Date:** 2026-07-02
**Purpose:** Pre-commit the integration oracle consumed by feature-build and Gate D.

## Persona Hops

| Journey | Persona | From | Required control | Expected value / reread | Oracle/source |
|---|---|---|---|---|---|
| J-VERIFIER-CONTRACT-LIFECYCLE | feature builder | accepted ticket contract | maker verification proposal | `verification-contract.json` exists before maker implementation starts | `.specflow/runs/<slug>/verification-contract.json` |
| J-VERIFIER-POLICY-ISOLATION | independent verifier | maker output artifact | verifier policy input | verifier input references artifact/spec/rubric and does not reference maker reasoning transcript | verifier ledger entry |
| J-VERIFIER-RUNTIME-EVIDENCE | runtime adversary | built UI/workflow slice | runtime verifier command | Playwright/API/log/reread evidence paths exist and missing executable surface blocks the run | `verifier-findings.jsonl` |
| J-VERIFIER-TRACE-DIVERGENCE | loop operator | run directory | trace/status command | maker claim, verifier result, mechanical gate result, and divergence are shown as separate fields | `ledger.jsonl` and trace output |

## Seam-Derived Hops

Derived by `node scripts/verify-seams.cjs docs/specs/verifier-runtime-lifecycle/tickets.json --repo-root .`.

| Seam surface | Pair / owner set | Kind | Required re-read assertion |
|---|---|---|---|
| `ledger.jsonl` | VERIFIER-CONTRACT-01, VERIFIER-POLICY-01, VERIFIER-RUNTIME-01, VERIFIER-TRACE-01 | writer-writer | A run with all verifier lifecycle stages re-reads ledger entries in order and preserves distinct maker proposal, verifier decision, runtime finding, and gate result events. |
| `output_path` | VERIFIER-POLICY-01 -> VERIFIER-RUNTIME-01 / VERIFIER-TRACE-01 | writer-reader | Verifier/runtime/trace consumers read the same output path written by the verifier policy stage, with missing refs reported as missing. |
| `run_contract` | VERIFIER-CONTRACT-01 -> VERIFIER-TRACE-01 | writer-reader | Trace/status re-read the accepted verification contract reference from the run contract or ledger before displaying divergence. |
| `runAdapter` | VERIFIER-POLICY-01 -> VERIFIER-CONTRACT-01 | writer-reader | Verifier policy execution uses the same adapter runner surface that contract negotiation validates. |
| `transcript_path` | VERIFIER-POLICY-01 -> VERIFIER-TRACE-01 | writer-reader | Trace/status show verifier transcript references as separate from maker transcript references without sending transcript content to a provider by default. |
