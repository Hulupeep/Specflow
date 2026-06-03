# Uplift Process — gap analysis + surgical additions

Condensed from Specflow's `board-auditor.md` + `specflow-uplifter.md`. When the
full Specflow repo is present (dir containing `CONTRACT-SCHEMA.md`), prefer its
`agents/*.md` and `SPEC-FORMAT.md` / `CONTRACT-SCHEMA.md` / `USER-JOURNEY-CONTRACTS.md`.

## Full template — the sections a compliant story carries

A story/ticket is checked against these. Mark each PRESENT or MISSING.

1. **Parent FEAT / Story ID** — links to epic; stable ID (e.g. `BILL-RATE-002`).
2. **Personas / two-view framing** — who benefits; "Bob's view" + "Alice's view" or a Persona Simulation block (required for UI / workflow / permissions / agent / multi-actor features).
3. **Scope** — In Scope / Not In Scope (Out-of-Scope items listed as separate tickets).
4. **Requirements** — `REQ-NN (MUST|SHOULD)` lines, each atomic and testable.
5. **Data Contract** — executable `CREATE TABLE` / `CREATE FUNCTION` / RLS `CREATE POLICY` / triggers / views / RPCs. (N/A only for tickets with no schema/DB surface — state why.)
6. **Frontend Interface** — typed TypeScript hook/interface signatures.
7. **Invariants Referenced** — `I-<DOMAIN>-NNN` codes with one-line statements.
8. **Acceptance Criteria** — behaviour-only checkboxes, incl. negative paths.
9. **Gherkin Scenarios** — Feature / Scenario / Given-When-Then; ≥1 happy + key edge/error.
10. **Definition of Done** — checklist (tests, testids, manual repro).
11. **data-testid Coverage** — every interactive element the journey tests touch.
12. **SpecFlow Contract Mapping** — Contracts / Contract Tests / Journey Tests subsections with file paths.
13. **Relevant ADRs** — architecture decisions the work must honour.

### Ticket-type pragmatism
- **Bug ticket**: Data Contract may be N/A (no schema change) — but still document the existing shape + the constraint/trigger being violated. Frontend Interface, Gherkin (happy + the bug's negative path), DoD, testids still required.
- **Journey ticket**: Persona Simulation + Gherkin + journey-test mapping are the core; lighter on schema.
- **Feature ticket**: all sections.

## Surgical additions — generate ONLY what's missing

Never duplicate or rewrite existing content. Each missing section gets executable, copy-pasteable artifacts.

### Missing Data Contract → executable SQL
```sql
CREATE TABLE zone (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES space(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  UNIQUE(space_id, name)
);
```
For functions, prefer `CREATE OR REPLACE FUNCTION ... SECURITY DEFINER SET search_path = public`. When replacing an existing function, **read its current body first** and preserve unrelated behaviour (notify inserts, audit rows, idempotency) — a rewrite that drops a sibling invariant is a regression.

### Missing RLS → join-through pattern (tables without a direct org/owner column)
```sql
-- direct owner column (simple)
USING (organization_id IN (SELECT organization_id FROM employees WHERE user_id = auth.uid()))

-- one-level join (space → site.org_id)
USING ((SELECT org_id FROM site WHERE id = space.site_id)
       IN (SELECT organization_id FROM employees WHERE user_id = auth.uid()))

-- two-level join (zone → space → site.org_id)
USING ((SELECT s.org_id FROM site s JOIN space sp ON sp.site_id = s.id
        WHERE sp.id = zone.space_id)
       IN (SELECT organization_id FROM employees WHERE user_id = auth.uid()))
```
RLS recursion warning: never write policy on A that subqueries B while B's policy subqueries A — Postgres returns HTTP 500 for all queries. Use `SECURITY DEFINER` helper functions that bypass RLS, and call those in policies.

### Missing Frontend Interface → typed signatures
```typescript
export interface UseZonesReturn {
  zones: Zone[];
  isLoading: boolean;
  error: Error | null;
  createZone: (input: CreateZoneInput) => Promise<Zone>;
  reorderZones: (orderedIds: string[]) => Promise<void>;
}
```

### Missing Invariants → registry codes
```markdown
## Invariants Referenced
- I-ADM-003: Every space must have at least one zone (auto-create trigger).
- I-ADM-004: Zone names unique within a space (UNIQUE constraint).
```
Reuse existing `I-<DOMAIN>-NNN` codes; for a genuinely new rule, take the next free number in that domain — grep the codebase/contracts first; never reuse or collide an existing code. Domain prefixes (extend as needed): `I-OPS` ops/rooms, `I-NTF` notifications, `I-SCH` scheduling, `I-PTO` leave, `I-PAY` payroll, `I-ENT` entitlements, `I-ADM` admin/config, `I-AUTH` auth, `I-BILL` billing, `I-TIME` time/timesheets.

### Missing Gherkin
```gherkin
Feature: <feature name>
  Scenario: <happy path>
    Given <precondition>
    When <action>
    Then <observable outcome>
  Scenario: <the negative/error path the ticket must handle>
    Given ...
    When ...
    Then <explicit error / no-op>
```

### Missing Acceptance Criteria — behaviour-only checkboxes
```markdown
- [ ] AC-1: <observable behaviour, not implementation detail>
- [ ] AC-2: <negative path — what must NOT happen / explicit error>
```

### Missing Definition of Done
```markdown
- [ ] Unit/contract tests added and passing
- [ ] data-testids present on all interactive elements
- [ ] Negative paths covered
- [ ] Manual repro on <surface/URL> clean
```

### Missing data-testid Coverage
```markdown
- `zone-list-{spaceId}` — list container
- `create-zone-btn` — create button
- `zone-name-input` — name field
```

### Missing SpecFlow Contract Mapping
```markdown
## SpecFlow Contract Mapping
### Contracts
- docs/contracts/feature_<name>.yml — REQ-NN..NN; invariant_<code>.yml
### Contract Tests
- src/__tests__/contracts/<name>_contract.test.ts — pins <what>
### Journey Tests
- tests/e2e/<journey>.spec.ts — J-<NAME>, Persona <name> end-to-end
```

### Missing / weak Journey (UI stories) — journey IS the Definition of Done
A UI story is done when a Playwright journey walks the user's steps and asserts
intent was reached. Uplift must add an **executable journey spec**, not prose.
Structure every journey as ordered steps, each with a success assertion:

```markdown
## Journey: J-<NAME> — <one-line outcome the user wants>
Persona: <who> · Surface: <url/route>

| # | Step (user action) | Success criterion (assertion) |
|---|--------------------|-------------------------------|
| 1 | Navigate to /billing | `billing-engagements-list` visible |
| 2 | Click engagement row | URL = /billing/{id}; `billing-period-view` visible |
| 3 | Select week, click Submit invoice | `invoice-line-units` shows "4 days × …" |
| 4 | Owner approves, then Mark Paid + ref | status badge = "paid"; `mark-paid-ref` persisted |

Done = this journey passes, OR a "varied because of <decision>" note explains a
legitimate divergence and why intent is still met.
```

```typescript
// tests/e2e/<journey>.spec.ts  (J-<NAME>)
import { test, expect } from '@playwright/test'
test('J-<NAME>: <outcome>', async ({ page }) => {
  await page.goto('/billing')
  await expect(page.getByTestId('billing-engagements-list')).toBeVisible()
  // ...one block per step, each ending in an assertion that proves the step...
})
```

Rules for the uplift:
- Every interactive step references a real `data-testid` (add any missing ones to the testid section).
- No `test.skip` / stub bodies — a skipped journey is not done.
- The DoD checklist must include: "Journey J-<NAME> executed and passing (or varied-with-reason recorded)."
- If the journey genuinely can't run yet, add a deferral line with a linked tracking issue — never a silent skip.

## Posting the uplift
- GitHub issue: one `gh issue comment <n> --body-file <tmp>` titled e.g. `## Specflow Uplift: <missing sections>`. Supplement; do not replace the body.
- File: append a clearly-marked block; do not rewrite existing sections.
- Batch (multiple issues in an epic): keep RLS join pattern, invariant registry, and naming consistent across them; run pre-flight per-ticket — never batch-mark compliant.
