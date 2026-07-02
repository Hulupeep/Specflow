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
- **Feature-build maker:** proposes a slice-local verification contract before implementation. Gap checked: fine-grained HOW-verified criteria are negotiated inside feature-build, not front-loaded into spec-build.
- **Runtime adversary:** drives the built product through Playwright/log/screenshot/value evidence. Gap checked: runtime verifier findings are evidence only and cannot replace journey/mechanical gates.
- **Trace reviewer:** inspects a long-running loop after maker/verifier disagreement. Gap checked: transcript/provider summarization is opt-in; missing evidence is reported as missing.
- **Maintainer:** reviews stale provider effort/model/cost scaffolding after models improve. Gap checked: durable trust fields remain in the ledger while transient knobs can be removed.

## Gate Result

No CRITICAL design gap survives. Feature-build should implement the ten tickets as separate slices or a tightly staged epic, with #92/#93/#94 treated as the loop-talk adjustment layer before broad runtime automation.
