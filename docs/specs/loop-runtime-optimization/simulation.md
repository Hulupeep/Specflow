# Loop Runtime Optimization - GATE B.5 Simulation

**Date:** 2026-06-30
**Loop:** spec-build
**Stage:** GATE_B5
**Input artifacts:** `prd.md`, `contract.yml`, `tickets.md`, `hops.md`
**Method:** `skills/specflow-simulate/references/simulation-method.md`
**simulated_at:** 2026-06-30T06:24:14Z
**Status:** PASS. No CRITICAL or P1 ticketization gap survives.

## Simulation Findings

**Personas run:** platform maintainer (stresses implementation surface),
fresh codespace agent (stresses install discovery), skeptical adopter (stresses
positioning honesty), cost-conscious operator (stresses stop/budget state), CI
maintainer (stresses invalid contract and verifier failure paths).

### Per-Persona Routes

- **Platform maintainer - happy route:** adds `specflow run` to the existing CLI,
  reuses loop YAML and verifier scripts, and stores a compact ledger. No
  surviving gap.
- **Platform maintainer - divergent route:** tries to implement a hosted daemon
  because "runtime" sounds like background execution. Gap closed in PRD and
  ticket non-goals: hosted scheduling is explicitly out of scope.
- **Fresh codespace agent - happy route:** reads AGENTS guidance, finds the local
  loop selector, emits a run_contract, and proceeds through gates. No surviving
  gap.
- **Fresh codespace agent - divergent route:** the skill registry omits the
  skill, so the agent only references YAML. Gap already covered by
  J-LOOP-INSTALL-DISCOVERY and AC-3 in LOOP-RUNTIME-02.
- **Skeptical adopter - happy route:** compares prompt-vs-loop language and sees
  the product boundary. No surviving gap.
- **Skeptical adopter - divergent route:** expects Specflow to run while the
  laptop is closed. Gap closed by the explicit local-runtime boundary.
- **Cost-conscious operator - divergent route:** worries the loop will run
  forever. Gap covered by run_contract budgets, terminal status, stop condition,
  and ledger stop reason.
- **CI maintainer - divergent route:** feeds an invalid run_contract. Gap covered
  by J-LOOP-INVALID-CONTRACT and AC-3.

### Accepted Additions

- [x] Add explicit non-goal for hosted scheduling/background execution.
- [x] Add budget and stop-reason fields to the run_contract/ledger story.
- [x] Add fresh-codespace discovery journey.
- [x] Add invalid-contract negative journey.

### Open Questions

- None blocking GATE_B5.

## Gate Result

GATE_B5 passes. The ticket packet is ready for feature-build handoff through
issues #77 and #78.
