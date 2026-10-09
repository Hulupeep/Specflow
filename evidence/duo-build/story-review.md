## Simulation Findings (proposed)

Target: #134. Method: /specflow-simulate, four behavioural personas.

- First-timer: feature text → existing spec-build preparation → ready ticket → feature-build → peer review. Divergence: no mission/goal → discover existing mission/contracts and write a referencing goal; do not invent supported jurisdictions. Proposed clarification to REQ-02: pin source references as well as goal text.
- Returning builder: batch → findings → correction → resume → re-review. Divergence: acceptance changed during absence → block pending explicit scope reconciliation. Proposed negative AC-2: reject changed pinned task/goal sources.
- Collaborator: uncommitted changes → frozen review → acceptance. Divergence: another editor changes the tree during review → reject stale acceptance. Proposed AC-4 clarification: compare source and review snapshot hashes before accepting.
- Restricted reviewer: installed/authenticated peer → independent artifact read → result. Divergence: missing read permission, missing execution evidence or recursive launch → blocked, no acceptance. Proposed AC-3/4 clarification: validate artifact inspection and reject malformed peer output.

These clarify existing acceptance without expanding scope. No unresolved product decisions.

## Specflow audit — gap analysis

Feature / CLI infrastructure; no browser UI or database.
Present: Story ID and related issues, personas, scope, requirements, acceptance, Gherkin, DoD.
Missing: data shape, interface applicability, invariant references, testid applicability, contract/test mapping, ADR applicability. Surgical additions follow; original request/criteria unchanged.

## Specflow Uplift: CLI artifacts and mapping

Data contract: local JSON records only; SQL/RLS N/A (no database).
Frontend interface and data-testid coverage: N/A (native agent skill and Node CLI, no browser components).

Batch input shape:
```json
{"id":"implementation","scope":"AC-1 through AC-7","claims":["implemented and locally tested"],"assumptions":[],"evidence":["evidence/tests.txt"],"resolutions":[]}
```
Review output shape: outcome = accepted | changes_required | blocked; summary; inspected file paths; findings (id, basis, evidence, action); unrelated suggestions separately. Run stores target, builder, goal/task source hashes, objective, finish condition and ordered review history.

Invariants referenced (new domain, no existing I-DUO identifiers):
- I-DUO-001: missing peer/evidence or changed snapshot never yields acceptance.
- I-DUO-002: reviewer is read-only and cannot recursively invoke duo-build.
- I-DUO-003: pinned acceptance and prior findings survive resume.

Contract mapping: docs/contracts/feature_specflow_project.yml (PROJ-003 script exports); behaviour acceptance REQ-01..07 / AC-1..7 maps to tests/scripts/duo-build.test.js and evidence/duo-build/live-cycle.md. CLI journeys J-DUO-REPAIR, J-DUO-RESUME, J-DUO-BLOCKED map to that test suite; the live-cycle record must distinguish real provider execution from simulated fixtures. No Playwright journey is required for this non-UI feature.
Relevant ADRs: no ADR directory; reuse existing QA/loops/spec-build.yaml and feature-build.yaml, existing script/skill installers, and native provider permissions. No new orchestration runtime.

## Pre-flight Findings

Scope: ticket readiness, not implementation acceptance. Walked all four Gherkin branches after uplift; enums match, paths fit the repo, all requirements have verification mapping. No schema/UI execution applicability.

**simulation_status:** passed
**scope:** ticket

### CRITICAL
None
### P1
None
### P2
None
**simulated_at:** 2026-09-16T15:58:18Z
