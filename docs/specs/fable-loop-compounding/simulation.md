# Fable-Class Loop Compounding - Gate B.5 Simulation

**Date:** 2026-07-01
**Loop:** spec-build
**Stage:** GATE_B5
**Status:** PASS

## Persona Routes

- **Long-running orchestrator:** runs a Fable-class stage across multiple loop phases. Gap checked: state must be durable and prompts must consult state, not chat memory.
- **High-effort model router:** selects high/default effort for normal deep work and xhigh/ultracode only for explicitly complex orchestration. Gap checked: effort is policy metadata and not assumed supported by all providers.
- **Planner/implementer split:** Fable-class planner produces implementation tickets, Codex/GPT-class implementer later executes feature-build. Gap checked: provider role is ledgered and gates are unchanged.
- **External reviewer:** Oracle/GPT-style reviewer critiques a Fable plan. Gap checked: review is evidence only and cannot replace Gate A/B/B.5.
- **Cost-conscious operator:** routes heavy stages to high-capability models and routine work to lower-cost providers. Gap checked: budget caps and unknown usage handling.
- **Independent reviewer:** receives only artifact plus rubric. Gap checked: verifier must not consume maker reasoning trace as proof.
- **Parallel implementer:** maker and verifier run in separate worktrees. Gap checked: Specflow must not auto-merge or push delegated work.
- **UI reviewer:** screenshot plus vision finding enters Gate D. Gap checked: vision output is evidence only; teardown-gate remains the gate of record.
- **Platform scheduler:** `/loop`, cron, GitHub, or hosted trigger runs the same `specflow run` command. Gap checked: scheduled routines do not bypass human gates.

## Gate Result

No CRITICAL design gap survives. Feature-build should implement the seven tickets as separate slices or a tightly staged epic.
