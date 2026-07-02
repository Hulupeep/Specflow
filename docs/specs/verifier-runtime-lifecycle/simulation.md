# Verifier Runtime Lifecycle - Gate B.5 Simulation

**Date:** 2026-07-02
**Loop:** spec-build
**Stage:** GATE_B5
**Input artifacts:** `prd.md`, `contract.yml`, `tickets.md`, `hops.md`
**Status:** PASS. No CRITICAL ticketization gap survives.

## Persona Routes

- **Feature-build maker:** starts from #100 and tries to implement immediately. The ticket packet blocks this by requiring `verification-proposal.md` and accepted `verification-contract.json` before maker implementation.
- **Independent verifier:** receives maker output and asks for the maker reasoning transcript. The policy ticket blocks trace contamination by default and requires a human-recorded exception for any trace inclusion.
- **Runtime adversary:** tests a UI/workflow change that looks visually complete but has dead backend state. VERIFIER-RUNTIME-01 requires executable runtime evidence plus API/DB/custom reread when value-bearing state matters.
- **CLI-only implementer:** works on a pure runner/status slice with no app surface. The simulation checks that runtime evidence is not over-required; custom script or mechanical gate evidence is acceptable.
- **Missing-surface verifier:** cannot launch an app or find a runnable journey. The required behavior is a blocked verifier finding naming the missing executable surface, not fabricated evidence.
- **Trace reviewer:** investigates a long run where maker says done, verifier says pass, but the mechanical gate fails. VERIFIER-TRACE-01 requires maker claim, verifier finding, and gate result to be displayed as separate fields.
- **Vision-heavy reviewer:** inspects a screenshot and wants to approve. The packet keeps screenshot/vision evidence subordinate to runtime/value rereads and the owning gate.
- **Frontier-model planner:** tries to use Fable/Claude/Codex model quality as a gate. The invariants and ticket packet treat model/provider/effort as metadata only.

## Findings

| Finding | Severity | Disposition |
|---|---|---|
| Runtime verifier could be impossible in projects without a running app. | P1 if omitted | Covered by VERIFIER-RUNTIME-01: emit a blocked finding naming missing executable surface or use custom-script/mechanical evidence for non-UI slices. |
| Verifier could inherit maker trace for convenience. | CRITICAL if permitted by default | Covered by VERIFIER-POLICY-01 and I-VERIFIER-002. |
| Trace could flatten maker/verifier/gate into one summary. | P1 if omitted | Covered by VERIFIER-TRACE-01. |
| Accepted verification contract could be written but not read by later stages. | P1 if omitted | Covered by seam-derived hops for `run_contract`, `ledger.jsonl`, and `output_path`. |

## Gate Result

GATE_B5 passes. Feature-build should implement the four local tickets in order:

1. VERIFIER-CONTRACT-01
2. VERIFIER-POLICY-01
3. VERIFIER-RUNTIME-01
4. VERIFIER-TRACE-01

The first feature-build slice should stop after contract lifecycle and ledger separation are mechanically tested. Runtime Playwright evidence can be the second slice.
