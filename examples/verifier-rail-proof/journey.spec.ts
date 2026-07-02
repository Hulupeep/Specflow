import { test, expect } from '@playwright/test';

/*
 * Production form of the AC8 proof (issue #102) — the real runtime adversary.
 * Run with: npx playwright test examples/verifier-rail-proof/journey.spec.ts
 *
 * A verification contract declares this as a runtime check of type `playwright`.
 * The verifier rail runs it in a separate context and writes the result to
 * verifier-findings.jsonl; the gate consumes that finding, not the maker's claim.
 * A "looks done" UI with dead behavior FAILS here — which blocks the gate.
 */
test('J-VERIFIER-RAIL: pressing space moves the player', async ({ page }) => {
  await page.goto(process.env.APP_URL || 'http://localhost:3000');

  // Static-ish: the UI renders. On its own this is weak evidence.
  await expect(page.locator('canvas#game')).toBeVisible();

  // Runtime behavior: the value-bearing assertion static checks cannot make.
  const before = await page.getByTestId('player-x').innerText();
  await page.keyboard.press('Space');
  const after = await page.getByTestId('player-x').innerText();

  expect(after).not.toBe(before); // dead behavior fails here → verifier finding: fail
});
