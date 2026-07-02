# Verifier Runtime Lifecycle - Adversary Review

**Date:** 2026-07-02
**Loop:** spec-build
**Source:** #100, #84, #92, `docs/specs/fable-loop-compounding/`
**Verdict:** SHIP_WITH_STIPULATIONS

## Findings

| Severity | Finding | Disposition |
|---|---|---|
| FATAL | If implemented as another reviewer prompt, this epic worsens the self-grading problem instead of fixing it. | Closed by requiring durable verifier contracts, separate verifier context, runtime evidence, and mechanical gate reruns. |
| SERIOUS | Verifier approval could be confused with gate pass. | Closed by `I-VERIFIER-001`: verifier output is evidence only; owning script/journey gate decides. |
| SERIOUS | Feeding maker reasoning trace to the verifier can launder the maker's delusion into the verifier context. | Closed by `I-VERIFIER-002`: verifier receives artifact/spec/rubric/runtime surface, not maker trace by default. |
| SERIOUS | Static contract checks alone will miss plausible UI/backend bugs from long-running agents. | Closed by `VERIFIER-RUNTIME-01`: runtime evidence path for UI/workflow changes. |
| SERIOUS | Trace output could summarize away the divergence operators need to inspect. | Closed by `VERIFIER-TRACE-01`: ledger must preserve maker claim, verifier finding, gate result, and evidence paths. |
| P1 | Vision evidence might be treated as proof of value-bearing behavior. | Closed by requiring value rereads/API/backend assertions when state matters. |
| P2 | This could overfit to Fable branding. | Closed by model-agnostic policy language; provider/model/effort fields are metadata only. |

## Required Stipulations

- Gate advance must remain impossible from provider output, verifier prose, model confidence, or provider exit code alone.
- Runtime verifier evidence must be executable where the slice has UI/workflow behavior.
- The verifier must not inherit maker reasoning trace unless a human explicitly approves the exception.
- #93 trace work must consume the ledger shape produced here.

## Gate A Result

SHIP_WITH_STIPULATIONS. The PRD is suitable for ticketing because the trust boundary is explicit and the implementation can be sliced into mechanical runtime surfaces.
