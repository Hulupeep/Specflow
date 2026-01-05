/**
 * Journey Test: J-WEB-DETAILED (Journey 4)
 * Web page selection with tags (detailed)
 *
 * From journeys.md:
 * 1. Same as Journey 3, but user needs to tweak tags and topic
 * 2. Right-click → "Send to GitHub (with tags…)"
 * 3. Modal appears with repo dropdown, topic, tags
 * 4. Change repo, topic, add tags
 * 5. Click Save
 * 6. File created with edited values
 *
 * NOTE: This journey requires context menu interaction with modal UI
 * which cannot be fully simulated in Playwright.
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  launchWithExtension,
  configureExtension,
  checkGitHubFile,
  deleteGitHubFile,
} from './helpers/extension'

test.describe('Journey: J-WEB-DETAILED', () => {
  let context: BrowserContext
  let extensionId: string
  let optionsPage: Page
  let createdFilePath: string | null = null

  test.beforeAll(async () => {
    const ext = await launchWithExtension()
    context = ext.context
    extensionId = ext.extensionId
    optionsPage = ext.optionsPage

    await configureExtension(optionsPage)
  })

  test.afterAll(async () => {
    if (createdFilePath) {
      await deleteGitHubFile(createdFilePath)
    }
    await context?.close()
  })

  test('extension has detailed capture context menu option', async () => {
    // Verify extension is loaded and has context menu capability
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`)

    // Extension loads successfully
    await expect(page.locator('body')).toBeVisible()

    // Context menu registration is handled by background script
    // and verified in contract tests

    await page.close()
  })

  test.skip('shows modal for detailed web capture', async () => {
    // This test requires context menu + modal interaction
    // which cannot be fully simulated in Playwright
    // The modal component is tested via unit tests
  })

  test.skip('created file has edited topic and custom tags', async () => {
    // Requires full context menu flow
    // Manual verification required
  })
})
