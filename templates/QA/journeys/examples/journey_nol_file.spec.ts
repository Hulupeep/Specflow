/**
 * Example journey e2e for QA/journeys-how-to.md.
 * In the real repo this lives at claims-monorepo/tests/e2e/journey_nol_file.spec.ts
 * and runs against the REAL seeded backend (playwright.config.ts + global-setup.ts),
 * NOT the mocked config. This is Step 5 of the ladder: the proof.
 *
 * Journey contract: docs/contracts/journey_nol_file.yml (J-NOL-FILE)
 * Spec:             docs/specs/notice-of-loss.md
 * Covers:           NOL-001, NOL-002, STORM-004
 *
 * Every assertion is oracle-anchored: it checks a real value (status text, a persisted
 * record, real met data) and, where a known-wrong answer exists, asserts against it
 * (`.not...`) so a regression can't pass silently.
 */
import { test, expect } from '@playwright/test'
import { signInAsSeededOwner, seedNamedStormForProperty, countFiledNols } from './helpers'

test.describe('J-NOL-FILE — file Notice of Loss after named storm', () => {
  test.beforeEach(async ({ page }) => {
    await seedNamedStormForProperty() // real row in the storm store, intersecting the seeded property
    await signInAsSeededOwner(page) // real session — not page.route() mocks
  })

  test('owner files NOL and it lands in the pipeline', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByTestId('loss-alert-card')).toContainText(/named storm/i)

    await page.getByTestId('review-incident-btn').click()
    // oracle: snapshot shows REAL met data, and explicitly NOT the placeholder
    await expect(page.getByTestId('incident-peak-gust')).toContainText(/\d+\s*mph/i)
    await expect(page.getByTestId('incident-peak-gust')).not.toContainText('-- mph')

    await page.getByTestId('draft-nol-btn').click()
    await expect(page.getByTestId('nol-draft')).toBeVisible()

    const before = await countFiledNols() // oracle: prove the record count actually changes
    await page.getByTestId('file-nol-btn').click()
    await expect(page.getByTestId('nol-status')).toContainText('Filed')
    expect(await countFiledNols()).toBe(before + 1)
    // The pipeline assertion (case-manager side) is the proof the chain closed end to end —
    // assert the persisted record is queryable for the org, not just that a toast appeared.
  })

  test('filing is blocked without a policy', async ({ page }) => {
    // ERR-NOL-NO-POLICY — see journey_nol_file.yml error_scenarios
    await signInAsSeededOwner(page, { withPolicy: false })
    await page.goto('/dashboard')
    await page.getByTestId('review-incident-btn').click()
    await page.getByTestId('draft-nol-btn').click()
    await expect(page.getByTestId('nol-draft')).toContainText(/upload a policy before filing/i)
  })
})
