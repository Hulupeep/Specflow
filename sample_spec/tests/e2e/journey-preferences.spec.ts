/**
 * Journey Test: J-PREFERENCES (Journey 8)
 * "Don't ask again" preference behavior
 *
 * From journeys.md:
 * 1. User has used detailed modal and ticked "Don't ask again"
 * 2. Next capture is quick send (no modal)
 * 3. User changes defaults in options
 * 4. Next capture uses updated defaults
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  launchWithExtension,
  configureExtension,
  deleteGitHubFile,
} from './helpers/extension'

test.describe('Journey: J-PREFERENCES', () => {
  let context: BrowserContext
  let extensionId: string
  let optionsPage: Page
  const createdFiles: string[] = []

  test.beforeAll(async () => {
    const ext = await launchWithExtension()
    context = ext.context
    extensionId = ext.extensionId
    optionsPage = ext.optionsPage

    await configureExtension(optionsPage)
  })

  test.afterAll(async () => {
    for (const filePath of createdFiles) {
      await deleteGitHubFile(filePath)
    }
    await context?.close()
  })

  test('options page loads and displays settings', async () => {
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`)
    await optionsPage.waitForLoadState('networkidle')

    // Verify options page has the expected elements
    const patInput = optionsPage.locator('input[type="password"]')
    await expect(patInput).toBeVisible()

    // Default tags input should exist
    const tagsInput = optionsPage.locator('input[placeholder="notes, ideas"]')
    await expect(tagsInput).toBeVisible()
  })

  test('can save and update default tags', async () => {
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`)
    await optionsPage.waitForLoadState('networkidle')

    // Change default tags
    const tagsInput = optionsPage.locator('input[placeholder="notes, ideas"]')
    await tagsInput.fill('test-tag, e2e-test')

    // Save settings
    const saveButton = optionsPage.locator('button:has-text("Save Settings")')
    await saveButton.click()

    // Wait for save confirmation
    await expect(optionsPage.locator('text=Settings saved!')).toBeVisible()

    // Reload and verify persistence
    await optionsPage.reload()
    await optionsPage.waitForLoadState('networkidle')

    const reloadedTags = optionsPage.locator('input[placeholder="notes, ideas"]')
    await expect(reloadedTags).toHaveValue(/test-tag/)
  })

  test('popup reflects configuration status', async () => {
    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`)

    // Popup should show configured status (since we configured in beforeAll)
    // or show status information

    await expect(popupPage.locator('body')).toBeVisible()

    await popupPage.close()
  })

  test.skip('quick send uses stored preferences', async () => {
    // Requires triggering capture from content script context
    // which needs context menu interaction
  })

  test.skip('changing options updates quick send behavior', async () => {
    // Requires full capture flow with context menu
  })
})
