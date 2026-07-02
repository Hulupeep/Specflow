# Fable Subordinate Controls Ticket Packet

**Source tickets:** #83 (MODEL-ROUTING), #89 (COST), #88 (VISION-GATE), #87 (ROUTINE)
**Loop:** spec-build

## Scope

Thin, enforced, disposable controls subordinate to the verifier/gate trust core. Same pattern as #101/#103: small enforced primitive, hostile fixture, full test coverage. None weakens the mechanical gate or human boundaries.

## Tickets

### MODEL-ROUTING-HONESTY-01 — A silent model downgrade is a failed contract

**Journey:** `J-MODEL-ROUTING-HONESTY`

Acceptance:
- Given a requested model, an effective/reported model that differs (or a fallback) without a recorded reason fails the contract.
- Requested model, effective model, and reason (or its absence) are recorded in the ledger.
- A recorded fallback/refusal reason makes the downgrade an honest, passing record.

### COST-ACCOUNTING-01 — Report cost per accepted change; missing usage is unknown

**Journey:** `J-COST-ACCOUNTING`

Acceptance:
- Cost accounting reports total cost, per-gate cost, accepted gates, and cost-per-accepted-change.
- Missing usage metadata is counted as `unknown`, never fabricated as zero.
- Exposed via `specflow run status`.

### VISION-EVIDENCE-01 — Vision finding is evidence only, never a gate pass

**Journey:** `J-VISION-EVIDENCE`

Acceptance:
- A vision finding names goal, screenshot, model/provider, verdict, and gaps, and carries `gate_result: pending`.
- A helper refuses to treat a vision verdict as a gate pass.

### ROUTINE-SAFETY-01 — Reject routine manifests that bypass specflow run or human gates

**Journey:** `J-ROUTINE-SAFETY`

Acceptance:
- A routine manifest whose command does not call `specflow run` is rejected.
- A manifest containing an auto human-gated action (push/PR/merge/--no-verify/override) is rejected.
- Portfolio-improvement routines must declare a spec-build proposal policy.
