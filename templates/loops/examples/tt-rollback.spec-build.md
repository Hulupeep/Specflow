# Example — spec-build for TT-ROLLBACK (Import Backout & Rehearsal Mode)

A real, filled invocation of [`../prompts/spec-build.prompt.md`](../prompts/spec-build.prompt.md). The grounding is a Codex discovery thread, not a file — so the loop starts at `discover` and writes the PRD itself. **Run with the agent pointed at the timebreez repo** (where `QA/loops/spec-build.yaml`, `PRDs/`, and Timetastic live).

```
Goal:   SHIP the TT-ROLLBACK spec (Import Backout & Rehearsal Mode) — a mixed-tier backlog with scoped acceptance and journey evidence for the selected build-ready slice.
Path:   QA/loops/spec-build.yaml
Inputs: { slug: tt-rollback, grounding_ref: THIS THREAD — the rollback discussion above; no PRD exists yet }
Automation: thread automation — re-fire until the path's done_when is met.

Load the path and follow it — do not restate it. Each tick: render the path's progress_display, locate the current stage from committed artifacts (PRDs/tt-rollback-prd.md, PRDs/tt-rollback-verdict.md, the issues), advance ONE gate, persist, then stop/escalate per the path.

First tick (no artifacts) → start at `discover`: distill grounding from this thread —
  - the 6 Rollback-Import rules (show what changed; block if edited/approved/payroll-used/depended-on; delete created-only; revert updated via stored versions; rewind external_id_mappings; write an audit event),
  - the created-vs-updated-vs-balances distinctions (balances RECALCULATE from history/snapshot — never additive-inverse),
  - rehearsal-into-a-new-test-org for live import testing,
  - schema-hook oracle to verify against the real migrations: import_batches, source_import_run_id, record_provenance, external_id_mappings, timetastic_source_rows, timetastic_import_versions, reconciliation/gap tables —
then `draft` PRDs/tt-rollback-prd.md. Stop after that gate.

Hard rules: local thin backlog capture may precede review. GATE A gates selected-decision promotion and GitHub issue creation; require a scoped SHIP verdict and human approval before creating issues; never create tickets from a DO-NOT-SHIP PRD. Use initial + one repair and a no-new-evidence stop across sessions. Gate B/B.5 and executable journeys apply only to the selected build-ready slice. Preserve never_without_human.
```

## What a correct first tick looks like

- Prints the phase map: `DISCOVER ▶  PRD ·  ⛔A ·  TICKETS ·  B ·  B.5 ·`
- Writes a grounding distillation + `PRDs/tt-rollback-prd.md` (a draft, not yet hardened).
- **Stops before the adversary.** If it runs the whole pipeline in one shot, the "one gate per tick" rule isn't landing — tighten the YAML.
- Creates **no** GitHub issues (that's gated behind Gate A SHIP + human approval).

## Then continue

On the next invocation, inspect the shared tier record and review allowance. Local thin planning may finish here; selected contracted decisions receive bounded Gate A review and human approval precedes GitHub issue creation. Stop on no new evidence or an exhausted allowance. For a build handoff, `done_when` is a mixed-tier backlog with applicable Gate B/B.5 evidence for the selected build-ready slice. Only that slice is an input to [`../prompts/feature-build.prompt.md`](../prompts/feature-build.prompt.md).
