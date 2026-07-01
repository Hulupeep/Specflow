# Fable-Class Loop Compounding - Adversary Review

## Findings

| Severity | Finding | Disposition |
|---|---|---|
| SERIOUS | The PRD could become Anthropic-specific product chasing. | Non-goal added: no Anthropic-only requirement; provider capability is runtime metadata. |
| SERIOUS | Stronger model output could be treated as a gate. | Stipulation: provider/verifier output never advances a gate without mechanical rerun. |
| SERIOUS | Self-improvement could silently mutate skills. | Skill changes are proposed artifacts only until reviewed. |
| SERIOUS | Routines could run unattended into human-gated actions. | Routine ticket requires inherited `never_without_human`. |
| SERIOUS | Cost tracking could invent or estimate misleading values. | Missing provider usage is recorded as unknown, not fabricated. |
| SERIOUS | Provider-specific effort names could be hardcoded as universal API guarantees. | Effort is policy metadata validated against the active provider surface. |
| SERIOUS | Fable-class provider could be used for implementation churn where planning was the intended value. | Model routing ticket requires planner/implementer role separation. |
| SERIOUS | External reviewer services could be treated as authority. | Verifier ticket records external review as evidence only; mechanical gates remain authoritative. |
| SERIOUS | Long prompts could degrade capable-model performance by restating every process document. | Stage prompt shape requires short goal/request/output/constraints with links to durable artifacts. |
| P2 | Vision verification could become aesthetic self-attestation. | Vision finding is evidence; teardown-gate still validates evidence paths and value re-reads. |

## Verdict

SHIP_WITH_STIPULATIONS.
