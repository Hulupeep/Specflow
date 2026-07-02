# Fable Subordinate Controls PRD

**Date:** 2026-07-02
**Loop:** spec-build
**Slug:** `fable-subordinate-controls`
**Parent tickets:** #83 (MODEL-ROUTING), #89 (COST), #88 (VISION-GATE), #87 (ROUTINE)
**Goal:** Land the subordinate Fable-era controls as thin, enforced, disposable primitives — subordinate to the trust core (verifier rail, state, worktree already shipped).

## Problem

After the verifier rail (#102/#103), four lower-priority controls remain. Per `docs/specs/fable-enable.md` they are plumbing, not the trust boundary — so they must be **thin and enforce their one honesty rule**, never expand scope or become the product:

1. **Silent model downgrade.** A run may request one model and receive another (fallback/refusal). A silent downgrade is dishonest evidence.
2. **Fabricated cost.** Missing usage metadata must be recorded as unknown, not treated as zero.
3. **Vision-as-verdict.** A screenshot/vision verdict is evidence, never a gate pass.
4. **Unsafe routines.** Scheduled routines must call `specflow run`, preserve human gates, and route portfolio proposals through spec-build.

## Requirements

- `REQ-ROUTING-HONESTY-01` (MUST): An effective model that differs from the requested model (or a fallback) without a recorded reason is a failed contract, recorded in the ledger.
- `REQ-COST-01` (MUST): Cost accounting reports per-gate cost, accepted gates, and cost-per-accepted-change; missing usage is `unknown`, never fabricated as zero.
- `REQ-VISION-01` (MUST): A vision finding carries `gate_result: pending`; a vision verdict can never be treated as a gate pass.
- `REQ-ROUTINE-01` (MUST): A routine manifest is rejected unless its command calls `specflow run`, it contains no auto human-gated action, and portfolio proposals declare a spec-build proposal policy.

## Non-Goals

- Making model routing, cost, vision, or scheduling the product. They are subordinate to the verifier/gate trust core.
- Any provider-specific pricing or safety claim beyond what the run reports.
- Hosted/background scheduling in the local runner (manifests only).

## Success Criteria

- Each control has a small enforced primitive with a hostile fixture and full test coverage.
- None weakens the mechanical gate or the human-boundary rules.
