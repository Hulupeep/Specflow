# SPIKE-IMPROVE-TRUST simulation

## Simulation Findings (proposed)

Scope: thin research/preparation packet; paper walkthrough, not runtime validation.
Simulated at: 2026-10-05T18:12:42Z.

| Persona and reason | Happy route | Divergent route and finding |
|---|---|---|
| Evidence-focused maintainer: needs a trustworthy next implementation decision | Read Q3, execute the pure probe, inspect input/output, compare preservation with regression and empty-diff controls, recommend gain semantics research. | Treats probe exit 0 as feature success. The probe explicitly reports desired_behavior_met and limits its scope; PREP-1/2 and AC-4 prohibit the inference. No missing rule. |
| Interrupted or collaborating maintainer: code/contract can change between steps | Record v1 baseline, verify unchanged patch, inspect receipt proposal and positive control. | Another actor changes code during verification or v2 is frozen before build. Q1/Q2 and REQ-02 name identity and concurrent edits, but the research must decide how to reject mid-check mutation. Proposed clarification below. |
| Constrained cloud operator: available tools differ from the local machine | Perform read-only inspection and in-process probe, preserve observations, submit preparation to Duo. | A child process or peer cannot launch. Dependencies and Gherkin require unavailable status, preserved raw error and no fake review. Do not consume repair rounds through blind retries; resume the same run when supported. No missing rule. |
| Product owner allocating effort: avoids an infrastructure epic disguised as a spike | Review one first-slice recommendation, its evidence and deferred opportunities. | Receipt research grows into a new sandbox/driver/memory system or a backend-free card tweak is presented as mission validation. Scope limits, REQ-04 and AC-3/4 reject both. Threshold and legacy trade-offs remain research decisions, not invented owner preferences. |

### Proposed additions

- Clarify REQ-02's investigation with a negative-path experiment: start a check on
  code A, mutate to B before it finishes, and determine whether both start/end
  digests are needed. From interrupted/collaborator route. This elaborates the
  existing concurrency question; it is not an applied new acceptance criterion.
- Add a research note under REQ-03 comparing a measurable but immaterial gain
  with the frozen minimum threshold. From product-owner route. No universal
  threshold is proposed; choosing one belongs to the actual improvement contract.

### Open questions for the spike

- Which generated/runtime files affect result validity, and which may be excluded
  from a tested-code identity without hiding a behavior change?
- Can a legacy run be assessed honestly without a receipt, or should it end
  INCONCLUSIVE and require a new explicitly linked run? No consumed holdout reuse.
- Which comparison semantics work for partially overlapping practice/holdout
  samples without inventing baseline failures or requiring all samples to fail?

No product implementation or new user-facing behavior is authorized by these
proposals. The open questions are the subject of the spike, not silently answered.
