# Gate D Findings - Fable Loop Compounding

## J: FABLE-ADAPTER-POLICY

status: green

The branch re-read normalized safe adapter policies for Claude and Codex. Claude is a planner role with `requested_model = sonnet`, `effective_model = unknown`, and `fallback_model = opus`; Codex is an implementer role with `requested_model = gpt-5` and unknown effective model until provider output reports it.

Evidence: evidence/adapter-policy-readback.json

## J: FABLE-SPECFLOW-STATE

status: green

The branch wrote `.specflow/STATE.md`, wrote one lesson file under `.specflow/lessons/`, and generated a stage prompt whose state-memory section re-read the verified fact and recent lesson summary.

Evidence: evidence/specflow-state-readback.json

## J: FABLE-LEDGER-ADAPTER

status: green

The branch re-read an adapter ledger entry that preserves `requested_model = claude-fable-5`, `effective_model = claude-opus-4-8`, token usage, estimated cost, and `stop_reason = gate_rerun_required`.

Evidence: evidence/ledger-adapter-readback.json

## J: FABLE-RUN-CONTRACT

status: green

The branch re-read routine/run-contract output paths and confirmed the generated routine command calls `npx @colmbyrne/specflow run spec-build ... --until-terminal` with human-gated actions preserved.

Evidence: evidence/run-contract-routine-readback.json

## J: FABLE-RUN-STATUS

status: green

The branch re-read status-accounting counters showing requested/effective model counts, unknown usage entries, known estimated cost, and cost per gate pass without inventing missing usage.

Evidence: evidence/runstatus-summary-readback.json

## J: FABLE-GATEC-READBACK

status: green

`specflow ci-status 90` read PR #90 through GitHub's status rollup and returned `gate_c = green` with zero failing and zero pending checks.

Evidence: evidence/gatec-readback.json
