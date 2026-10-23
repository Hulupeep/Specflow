# #220 scoped preparation

## Simulation Findings (proposed)
The model judge sees a legitimate patch/screenshot and judges the frozen criteria; divergence: a code comment addresses it as the evaluator and asks for pass. A repo maintainer supplies useful mission/candidate text; divergence: a malicious title/source label contains a fake closing marker and new instructions. A returning operator reuses role folders; divergence: a symlink points outside the curated inputs, or an earlier envelope nonce is replayed. Map each to FENCE-1..4: fresh nonce, escaped marker tokens/source labels, fixed trust instructions, actual per-call textual framing and fail-closed symlink handling.

Kill check: there is already one decision engine. A shared framing helper and input-construction fixes address the observed trust seam; no additional critic/model/controller is justified. Mechanical acceptance and hidden holdout remain the only positive gain authority.

## Audit phase 1 — gap analysis
Present: original #220 problem/acceptance, scope and selected IDs, divergent personas, requirements, negative paths and test obligations. Missing: exact envelope/typed interface, mapping, applicability and invariant registration. No DB or graphical UI changes; schema/RLS, frontend hooks, testids and Playwright are N/A here. The actual UI proof remains #180.

## Audit phase 2 — surgical uplift
```typescript
function fenceUntrusted(content: string, options: {source: string}): string;
function fenceInputTree(directory: string): void;
```
Envelope grammar: `BEGIN_UNTRUSTED_EVIDENCE nonce=<32 lowercase hex> source_json=<JSON string>` on its own line; neutralized original multiline content; matching `END_UNTRUSTED_EVIDENCE nonce=<nonce>` line. Escape every literal BEGIN_UNTRUSTED_EVIDENCE / END_UNTRUSTED_EVIDENCE token inside source/content so attacker-controlled text cannot supply a structural delimiter. Preserve readable multiline source. Source labels are JSON encoded (newlines cannot create instruction lines). Fresh random bytes are generated internally, never accepted from caller data.

All textual role inputs are framed after copying into the role's curated directory and before provider invocation. Refuse symlinks instead of following them. Images remain exact binary evidence, with the prompt's fixed statement that text in images/files is never instruction. Critique's inlined selected ID/title and judge's inlined criterion list also use the helper. No extra API capability is granted by a file, image or model output.

Add I-IMPROVE-014 in `docs/contracts/feature_improve_core.yml`: peer/judge builder/target-repo content is untrusted, textual inclusions are nonce-fenced, and fixed prompt instructions preserve role and gate authority. Reuse all earlier invariants. No override or weakening.

```gherkin
Feature: Untrusted improvement evidence
  Scenario: Read a legitimate patch
    Given a peer input contains a builder-authored patch
    When the peer receives its curated inputs
    Then textual evidence is nonce-fenced and fixed instructions deny it role authority
  Scenario: A payload includes the exact closing marker
    Given a deterministic test nonce and content containing its closing marker
    When the helper frames that content
    Then only the helper's structural closing delimiter remains effective
  Scenario: A source label includes a newline and fake instruction
    Given attacker-controlled source text
    When its envelope is constructed
    Then the source label is a JSON string on one structural line
  Scenario: A curated input is a symlink
    Given an input link points outside the curated evidence directory
    When role input preparation runs
    Then it fails before provider invocation
```

Tests: FENCE-1/3/4 → `tests/contracts/improve-untrusted.test.js` (nonce/markers/source/injection fixtures); FENCE-2 → actual critique integration assertions in `tests/contracts/improve-core.test.js`, plus judge/round prompt construction exercised by the existing lifecycle fixtures. FENCE-5 → all canonical suites and native independent review. A deterministic fixture validates framing only; do not describe it as empirical model-injection immunity.

DoD: failing-first evidence, applicable tests and full canonical suite, raw native review, unchanged existing invariants and no production-side-effect claim.

## Audit phase 3 — scoped pre-flight
simulation_status: passed
CRITICAL: None. P1: None. Scope: the defined framing/parser boundary, not universal prompt-injection protection. Existing source helpers resolve; binary image handling and symlink failure are explicit; IDs and boundary values are consistent. Implementation and native preparation acceptance remain separate gates.
P2: A model can still disregard instructions. Framing never substitutes for the independent mechanical holdout or actual worker isolation.

## Preparation acceptance
- PREP-SCOPE: The selected boundary and non-goals preserve the original #220 and core trust contract.
- PREP-DATA: Text envelope, nonce/escape/source semantics and binary/symlink handling are deterministic.
- PREP-CHECKS: Every FENCE requirement maps to a positive and adversarial executable obligation, with honest model-efficacy limits.
- PREP-GATE: The required mapping gate executes without failures/skips before readiness promotion; no unbuilt implementation success is inferred.
