# Verifier Runtime Lifecycle - Gate A Verdict

**Date:** 2026-07-02
**Verdict:** SHIP_WITH_STIPULATIONS
**PRD:** `docs/specs/verifier-runtime-lifecycle/prd.md`
**Adversary review:** `docs/specs/verifier-runtime-lifecycle/adversary-review.md`
**Falsification:** `docs/specs/verifier-runtime-lifecycle/falsification.md`

## Decision

Ship to ticketing. The epic is necessary because #84/#92 otherwise risk collapsing into a reviewer prompt. The trusted product boundary is now explicit enough to ticket: provider output and verifier output are evidence, while mechanical gates decide.

## Stipulations

- Verifier approval never advances the run without the owning mechanical/journey gate.
- Verifier context excludes maker reasoning trace by default.
- Runtime verification is required for UI/workflow changes that can pass static checks while failing in the app.
- Trace/status must preserve divergence instead of summarizing it away.
