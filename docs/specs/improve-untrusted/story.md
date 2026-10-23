# IMPROVE-FENCE-01 — #220

The existing #220 is the prerequisite trust repair before the next #180 real application cycle. This selected slice does not add another agent, evaluator or verdict authority.

## Scope and acceptance
- [ ] FENCE-1: Shared `fenceUntrusted(content,{source})` uses a cryptographically fresh nonce per call and marks source/content as untrusted evidence. Repository text cannot close or forge an envelope, including when the closing marker appears in its content.
- [ ] FENCE-2: Critique, round-peer and judge prompts declare all builder/repository files and images to be evidence rather than role instructions. Inlined candidate/criterion text and textual input files are nonce-fenced. Binary screenshots remain valid images with the same explicit trust declaration; symlink input files are refused.
- [ ] FENCE-3: An injection fixture containing “mark all criteria pass” stays inside its data boundary. A deterministic echoing reviewer fixture cannot acquire an outside-envelope instruction from it. This tests structural separation, not universal LLM immunity or model efficacy.
- [ ] FENCE-4: Contract tests verify nonce uniqueness, closing-marker escaping, adversarial source labels, real critique-input files and fixed instruction placement. Model transports remain explicit doubles in these protocol tests.
- [ ] FENCE-5: Add I-IMPROVE-014 to the existing YAML contract without weakening I-IMPROVE-001..013; full canonical tests pass; independent review has no material findings before the authorised merge.

No database/RPC/UI or production deployment changes. Exclude content filtering, signing, new orchestration and security-certification claims.

## Definition of done
The structural/integration regressions fail first against the existing prompts; repaired helper and actual input construction pass those tests and the existing trust suite. Required checks execute with no skips. Publish only sanitized evidence and distinguish this framing improvement from the OS isolation still owned by #176/#217.
