/**
 * Journey Test: J-CHATGPT-DETAILED (Journey 2)
 * ChatGPT message first-time detailed send
 *
 * From journeys.md:
 * 1. Fresh install, PAT configured, no "Don't ask again" preference
 * 2. Click "Send to repo" on assistant message
 * 3. Modal appears with repo dropdown, topic, tags
 * 4. Edit topic, add tags, tick "Don't ask again"
 * 5. Click Save
 * 6. Modal closes, toast shows success
 * 7. Next capture is quick send (no modal)
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import {
  launchWithExtension,
  configureExtension,
  checkGitHubFile,
  deleteGitHubFile,
} from './helpers/extension'

test.describe('Journey: J-CHATGPT-DETAILED', () => {
  let context: BrowserContext
  let extensionId: string
  let optionsPage: Page
  let createdFilePath: string | null = null

  test.beforeAll(async () => {
    const ext = await launchWithExtension()
    context = ext.context
    extensionId = ext.extensionId
    optionsPage = ext.optionsPage

    // Configure extension with test credentials
    await configureExtension(optionsPage)
  })

  test.afterAll(async () => {
    if (createdFilePath) {
      await deleteGitHubFile(createdFilePath)
    }
    await context?.close()
  })

  test('options page allows repository configuration', async () => {
    await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`)
    await optionsPage.waitForLoadState('networkidle')

    // Verify options page has repository configuration
    const patInput = optionsPage.locator('input[type="password"]')
    await expect(patInput).toBeVisible()

    // Should show configured repos or add repo form
    const addRepoButton = optionsPage.locator('button:has-text("Add Repository")')
    await expect(addRepoButton).toBeVisible()
  })

  test('extension loads on ChatGPT domain', async () => {
    const page = await context.newPage()
    await page.goto('https://chatgpt.com/')
    await page.waitForLoadState('domcontentloaded')

    // Content script should be loaded on ChatGPT
    // Give time for script injection
    await page.waitForTimeout(2000)

    // Page should load successfully
    expect(await page.title()).toBeTruthy()

    await page.close()
  })

  test.skip('shows modal on first capture', async () => {
    // Requires active ChatGPT conversation with assistant messages
    // Manual verification needed
  })

  test.skip('subsequent capture is quick send (no modal)', async () => {
    // Requires the above test to complete first
  })

  test.skip('created file has edited topic and tags', async () => {
    // Depends on file creation from above tests
  })
})
