# Generative Loop Adapter - GATE B.5 Simulation

**Date:** 2026-06-30
**Loop:** spec-build
**Stage:** GATE_B5
**Input artifacts:** `prd.md`, `contract.yml`, `tickets.md`, `hops.md`
**Method:** `skills/specflow-simulate/references/simulation-method.md`
**simulated_at:** 2026-06-30T07:41:09Z
**Status:** PASS after accepted ticket-contract addition. No CRITICAL or P1 gap survives.

## Simulation Findings

**Personas run:** subscription operator (stresses Claude Max/Pro local auth),
Codex operator (stresses provider parity), safety reviewer (stresses forbidden
actions), CI maintainer (stresses fake-provider/no-live-call behavior), cautious
operator (stresses dry-run inspection).

### Per-Persona Routes

- **Subscription operator - happy route:** `claude` is installed and
  authenticated; adapter policy invokes `claude -p`, writes transcript/final
  output, reruns owning gate. No surviving gap.
- **Subscription operator - divergent route:** `claude` is installed but not
  authenticated, or absent in a new codespace. Gap found: the ticket had generic
  failure handling but no explicit pre-invocation auth/readiness stop.
- **Codex operator - happy route:** `codex exec --json` runs with configured
  sandbox/approval/profile controls; ledger records provider and gate rerun. No
  surviving gap.
- **Safety reviewer - adversarial route:** provider output attempts `git push`.
  Existing AC-4 covers `blocked_human_required`; no surviving gap.
- **CI maintainer - divergent route:** CI lacks Claude/Codex auth. Existing
  fake-provider-by-default success metric covers this; live smoke tests remain
  opt-in. No surviving gap.
- **Cautious operator - happy route:** dry-run prints command/policy/artifact
  paths without invoking provider. No surviving gap.

### Accepted Additions

- [x] Add AC-5A for missing or unauthenticated provider CLI.
- [x] Add J-ADAPTER-AUTH-UNAVAILABLE.
- [x] Add provider readiness fixture to DoD.
- [x] Refresh falsification PRD hash after the PRD edit.

### Open Questions

- None blocking GATE_B5.

## Gate Result

GATE_B5 passes. The ticket packet is ready for feature-build handoff through
issue #80.
