# IMPROVE-GAIN scoped preparation

## Simulation Findings (proposed)
simulated_at: 2026-10-14T10:04:18Z. Scope: CLI bug repair under #174/#178, not parent-ticket promotion.

| Persona and reason | Happy route | Divergent route and proposed addition |
|---|---|---|
| Repeat operator, optimizing known workflows | Declare binary gain, freeze, capture baseline, build, verify once, evaluate, retain | Makes an unrelated edit while every old check still passes. GAIN-1/3 must reject preservation-only authority and show explicit gain pairs. Already covered. |
| Oracle author, maintaining different practice/holdout inputs | Set distinct baseline expectations, freeze, confirm each set, independently verify | Two declared gains, only one has matched evidence; do not treat one gain as sufficient. GAIN-3 says every mandatory gain; add this negative regression. |
| Returning operator, inspecting older runs | Read a completed historical report without mutation | Evaluates an unfinished legacy run lacking gain intent, or tries to retrofit after seeing holdout. GAIN-5 must retain history, refuse KEEP, and keep the single-use holdout. Already covered; add a legacy fixture without fabricating production migration. |
| Maintainer investigating a green-looking report | Inspect holdout baseline/after evidence and gate results | Practice passes but holdout fails, or unrelated fresh evidence is appended after a bound receipt. GAIN-3/5 must select exact receipt evidence; report must not show the last practice result as the holdout baseline. Add report assertion. |

Open product questions: none for this bounded binary repair. Numeric improvement/noise thresholds remain explicitly outside scope. Kill check: Q3 reproduced a retained non-improvement; existing binding verifies input identity but does not supply gain semantics. A single explicit binary intent and paired evidence solve that gap without another model loop.

## Audit phase 1: gap analysis
Ticket type: bounded CLI bug/behaviour repair. Parent/story, scope, atomic requirements, behaviour acceptance, negative Gherkin and DoD: PRESENT. Persona routes: PRESENT above. Missing sections: interface shape, contract/test mapping, relevant architectural references and explicit UI/DB N/A. No DB or UI exists in this change; manufacturing SQL, selectors or a browser journey would not test it.

## Audit phase 2: surgical uplift
Supplement to story.md; original requirements unchanged. Simulation additions are implementation/test detail consistent with the requested repair.

Data contract: no DB/schema/RPC. The existing frozen JSON contract, receipts and append-only ledger remain the persistence surface. Newly frozen envelopes use `specflow.improvement-contract/v2`; historical v1 envelopes are readable without inferred intent.

CLI interface (shape only; implementation remains JavaScript):
```typescript
type BaselineExpectation = 'fail' | 'pass' | 'n/a';
interface ExecutableAcceptanceAddition {
  intent: 'gain' | 'preservation';
  baseline_expectation: 'fail' | 'pass'; // deciding holdout
  dev_baseline_expectation?: BaselineExpectation; // required when dev_check exists
}
interface GainEvidence {
  criterion: string;
  established: boolean;
  baseline_evidence: string | null;
  after_evidence: string | null;
  baseline: string;
  after: string;
  reason: string;
}
```

Contracts: `docs/contracts/feature_improve_core.yml`, existing I-IMPROVE-001/002/003/005/006/010/011/012 remain binding. Add I-IMPROVE-013 for matched declared gains and required gate success; no existing invariant is weakened. Requirements and actual enforced rule belong in that YAML.

Contract tests: `tests/contracts/improve-core.test.js`, GAIN-1 freeze rejection/positive gain, GAIN-2 independent baseline sets, GAIN-3 receipt pairing/environment/no-authority/partial gain, GAIN-4 gate failure, GAIN-5 legacy and retained-tree/report controls. Existing suite covers scope, dispute, peer veto, oracle exposure and evidence mutation. Commands: `npm test -- --runInBand tests/contracts/improve-core.test.js`, then `npm test -- --runInBand`.

Frontend interface, data-testid and UI journey: N/A; CLI/JSON decision behaviour only. No real-backend claim; #180 owns that proof. Architecture: reuse #194 research results and #201 binding receipts; no new controller, scoring model or override path. Runtime verification still uses real subprocesses and temporary Git worktrees; fake model transports prove protocol behaviour, not model efficacy.

## Audit phase 3: Pre-flight Findings
simulation_status: passed
simulated_at: 2026-10-14T10:04:18Z
scope: selected CLI repair, not all of #174/#178 and not build-ready promotion

CRITICAL: None. P1: None. P2: None.

Loaded all active YAML contracts and recorded their first fields in the local preparation receipt. Existing identifiers are resolved and I-IMPROVE-013 was unused. No schema, foreign-key or cross-repository resource is introduced. GAIN-1..5 map to the executable lifecycle suite. Value sets agree with the proposed interface. The positive path and legacy, ambiguous evidence, mismatch, gate failure and holdout retry paths have explicit outcomes. Implementation and execution evidence remain pending; this pre-flight result does not assert tests passed.
