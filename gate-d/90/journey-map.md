# Gate D Journey Map - Fable Loop Compounding

Pre-merge Gate D preparation for PR #90. This pack validates branch evidence only; the final Gate D must be rerun after PR #90 is merged to `main`.

- J: FABLE-ADAPTER-POLICY value-bearing — re-read adapter policy role, effort, requested/effective model, fallback, and transcript paths.
- J: FABLE-SPECFLOW-STATE value-bearing — re-read `.specflow/STATE.md`, lesson file, and generated prompt state digest behavior.
- J: FABLE-LEDGER-ADAPTER value-bearing — re-read `ledger.jsonl`-style adapter entry fields for requested/effective model, usage, cost, and gate rerun state.
- J: FABLE-RUN-CONTRACT value-bearing — re-read run contract storage and routine command target paths.
- J: FABLE-RUN-STATUS value-bearing — re-read `runStatus`/ledger summary counters for model and cost accounting.
- J: FABLE-GATEC-READBACK value-bearing — re-read PR #90 Gate C status.
