# Spec — Notice of Loss (J-NOL-FILE)

> Example artifact for [`QA/journeys-how-to.md`](../../journeys-how-to.md). In the real repo this lives at
> `claims-monorepo/docs/specs/notice-of-loss.md`. It's **Step 2** of the ladder: the PM/architect turns the
> CSV row into an explicit, testable spec — narrative → Gherkin → oracle numbers → data-testids → e2e file.

## Narrative

An authenticated property owner who received a named-storm loss alert reviews the storm incident snapshot for
their property, drafts a Notice of Loss (NOL) pre-filled from their policy and the storm data, files it, and
sees it appear in their case manager's pipeline.

## Acceptance criteria (Gherkin)

```gherkin
Scenario: Owner files a Notice of Loss after a named storm
  Given I am a signed-in owner with a property that has an uploaded policy
  And a named storm intersected my property's location
  When I open the dashboard
  Then I see a loss alert for that property
  When I review the incident snapshot
  Then I see the storm's real peak gust and event window (not placeholders)
  When I draft and file the Notice of Loss
  Then its status reads "Filed"
  And a NOL record is persisted and appears in my case manager's pipeline

Scenario: Filing is blocked without a policy
  Given a property with no uploaded policy
  When I open the NOL drafter
  Then I see "Upload a policy before filing" and cannot file

Scenario: Duplicate filing is rejected
  Given I already filed a NOL for this storm + property
  When I try to file a second NOL for the same loss
  Then I see "already filed" and no second record is created
```

## Oracle numbers (what real value proves each clause)

| Claim | Oracle (the real value the test checks) |
|---|---|
| Loss alert shows | `loss-alert-card` visible, text contains "named storm" |
| Snapshot is real | `incident-peak-gust` matches `\d+ mph`, equals the storm-store row's peak gust, **not** `-- mph` |
| Filing persists | filed NOL row count for (property, storm) goes 0 → 1 |
| Reaches the pipeline | case-manager pipeline query for the org returns the new NOL |
| No-policy block | `error_message` contains "Upload a policy before filing"; NOL row count stays 0 |
| Duplicate block | second file attempt → `error_message` "already filed"; row count stays 1 |

## data-testids

`loss-alert-card`, `review-incident-btn`, `incident-snapshot`, `incident-peak-gust`,
`draft-nol-btn`, `nol-draft`, `file-nol-btn`, `nol-status`

## Shared rules (referenced, not restated)

- Storm-to-property matching: `docs/ard/ADR-NNN-named-storm-matching.md`
- Audit-row-on-state-transition: ADR-115 (`propertyActivityLog` + `caseEvents`)

## E2E

`tests/e2e/journey_nol_file.spec.ts`  ·  **Journey contract:** `docs/contracts/journey_nol_file.yml`
