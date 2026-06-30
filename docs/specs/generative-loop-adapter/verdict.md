# Generative Loop Adapter - Gate A Verdict

**Date:** 2026-06-30
**Loop:** spec-build
**Stage:** GATE_A
**PRD:** `docs/specs/generative-loop-adapter/prd.md`
**Adversary review:** `docs/specs/generative-loop-adapter/adversary-review.md`
**Falsification:** `docs/specs/generative-loop-adapter/falsification.md`
**Hops:** `docs/specs/generative-loop-adapter/hops.md`

## Verdict

SHIP_WITH_STIPULATIONS

## Why This Ships

The PRD captures the missing product step exposed by #77: controlled execution
of generative loop stages through operator-owned CLIs. It does not ask Specflow
to become a hosted agent fleet, and it does not let provider CLI success replace
Specflow gates.

## Stipulations

- Live Claude/Codex calls must be opt-in; CI must use fake adapters by default.
- `never_without_human` enforcement must live in Specflow's adapter controller,
  not only in prompts sent to the provider.
- Provider authentication remains owned by Claude/Codex CLIs; Specflow stores no
  subscription secrets.

