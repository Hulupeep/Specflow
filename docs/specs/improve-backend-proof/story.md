# #180 real-backend Improve proof — selected bounded slice

Epic: #171 · Story: IMPROVE-08 · Declared tier: `spec:thin`

## Outcome

Prove the single-cycle system on a real owned product: **HeyStax**, using the TabStax web-app repository.

The test must preserve explicit product and UI/UX oversight. The purpose is not to let an agent "redesign HeyStax"; it is to prove that Specflow can identify and verify a small, worthwhile product improvement while a sophisticated UX reviewer protects workflow quality, clarity and restraint.

## Product intent

HeyStax should help a user capture context, recover it quickly, understand what matters now, and move to the next useful action with minimal cognitive drag.

The dogfood run should inspect real workflows such as capture, re-entry, finding/recovering context, moving between related items, and choosing/continuing the next action. It must derive the selected slice from the actual current product rather than assuming one of those journeys is broken.

## UX/UI oversight

The improvement process must include a distinct UX/product-design review before the contract is frozen and again during independent evaluation.

The UX posture is:

- refine rather than redesign;
- remove friction before adding interface;
- preserve established visual/interaction language unless evidence justifies changing it;
- reduce clicks, choices, ambiguity and cognitive load;
- improve hierarchy, information timing, labels, defaults, recoverability and responsive behaviour where relevant;
- inspect loading, empty, error, success and mobile states when the affected journey touches them;
- reject aesthetic novelty without a user problem.

A subtle improvement is preferred to a wholesale visual change when it solves the observed problem.

## Scope

Choose one bounded product or subtle UX opportunity that can be evaluated without production mutation. Run the complete #171 journey against the real HeyStax/TabStax web-app branch/workspace. Preserve before/after evidence, UX review evidence, model/cost trace and the final decision.

The purpose is to validate the system, not to force a positive product change. REVERT or INCONCLUSIVE is a valid run outcome if truthful.

## Acceptance criteria

- [ ] AC-08-1: The run starts from HeyStax's actual mission, repository and current product state rather than a synthetic fixture only.
- [ ] AC-08-2: Candidate discovery exercises the relevant existing UI/workflows and includes explicit UX observations before selecting the improvement.
- [ ] AC-08-3: Candidate selection prefers a bounded, high-leverage product/UX refinement over gratuitous feature addition or redesign, and records why it matters to the user.
- [ ] AC-08-4: The chosen candidate receives a frozen ImprovementContract with user intent, current friction/baseline, acceptance, non-goals and the required evidence level before implementation.
- [ ] AC-08-5: A distinct UX/product-design evaluator reviews the affected journey against hierarchy, friction, information timing, consistency, accessibility/responsiveness and unnecessary UI; this judgment supports but does not replace executable evidence.
- [ ] AC-08-6: The normal builder/verifier/gate path executes the change, with real browser/runtime journey verification where applicable.
- [ ] AC-08-7: No production deployment/data mutation/outbound communication occurs.
- [ ] AC-08-8: The final report contains inspectable before/after product and UX evidence, total run cost, retained/reverted change refs and the human next decision.
- [ ] AC-08-9: Any claims of improvement are limited to what the executed evidence actually establishes; a visually plausible result is not automatically KEEP.

## Verification

This ticket requires one real HeyStax/TabStax web-app dogfood run. Synthetic/unit fixtures may support it but do not satisfy the proof.

For a UI-affecting change, the run must exercise the affected journey in the actual app and preserve runtime evidence. Screenshot/design judgment alone is insufficient where behaviour can be tested.

## Dependencies

Consumes #173–179. Do not treat this proof ticket as permission to bypass any incomplete core trust/safety story.

## Selected execution contract

A fresh independent C1 cycle consumes the #223 and #224 repairs. Current real baseline a8de4e92850e4ffe46da241e0bfd9c6703f792ae reproduces phone/tablet header overflow. Practice covers 1280/360/390/768 and real owner persistence plus a second user’s visible403 denied write with unchanged persisted state. Only DashboardHeader.tsx and an optional BurgerMenu test attribute may change. No production data, deployment, publication or merge by the core. A truthful REVERT/INCONCLUSIVE is acceptable.

Use the existing core, independent critique, independently authored fresh holdout, frozen contract, matched baseline, builder/peer rounds, one consumed deciding holdout, distinct screenshot-based UX evaluator and mechanical decision/finalization. CLI estimated dollars are usage telemetry, not subscription invoices.

## Existing service-planning acceptance (preserved)

- [ ] AC-PROOF-01: A unique test user completes the affected flow against the dedicated backend; unavailable backend is a named blocker, not success.
- [ ] AC-PROOF-02: The selected candidate has a bounded user benefit and independent before/after acceptance; a rejected candidate remains recorded.
- [ ] AC-PROOF-03: Raw executed/failed/skipped counts and revision/environment identities support the result; missing, skipped or unrun required journey remains CRITICAL.
- [ ] AC-PROOF-04: A regression vetoes KEEP even when the builder claims success; REVERT is valid proof of the rejection path.
- [ ] AC-PROOF-05: The owner can inspect before/after evidence and understand the result without reading provider transcripts.
- [ ] AC-PROOF-06: An unauthorised selected action fails visibly and a real backend read confirms no mutation. — from Authority/denied action.
- [ ] AC-PROOF-07: An interrupted baseline that mutated its fixture cannot produce candidate gain evidence until equivalent initial state is restored; otherwise report backend_state_mismatch. — from Returning operator/partially mutated seed.
