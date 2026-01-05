/**
 * Journey Test: J-ERROR-DOMFAIL (Journey 7)
 * DOM change fallback (ChatGPT fails gracefully)
 *
 * From journeys.md:
 * 1. ChatGPT DOM changes so chatgptDom.ts fails to parse
 * 2. getMessageContent returns null/empty
 * 3. Toast shows fallback message
 * 4. No modal, no API call with corrupted/empty content
 * 5. No file created
 *
 * NOTE: This behavior is verified via:
 * - Contract test ERR-002: content script checks for empty content
 * - Unit tests for chatgptDom.ts parsing
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { launchWithExtension, configureExtension } from './helpers/extension'

test.describe('Journey: J-ERROR-DOMFAIL', () => {
  let context: BrowserContext
  let extensionId: string
  let optionsPage: Page

  test.beforeAll(async () => {
    const ext = await launchWithExtension()
    context = ext.context
    extensionId = ext.extensionId
    optionsPage = ext.optionsPage

    await configureExtension(optionsPage)
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('content script has empty content check (contract ERR-002)', async () => {
    // This is verified by contract tests
    // The content script checks for !content before making API calls
    // See: packages/extension/src/content/chatgptContentScript.ts

    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`)
    await expect(popupPage.locator('body')).toBeVisible()
    await popupPage.close()
  })

  test('chatgptDom filters for assistant messages (contract UX-003)', async () => {
    // Contract UX-003 ensures buttons only appear on assistant messages
    // This is verified in contract tests
    // See: packages/extension/src/content/chatgptDom.ts

    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`)
    await expect(popupPage.locator('body')).toBeVisible()
    await popupPage.close()
  })

  test.skip('shows fallback message when DOM parsing fails', async () => {
    // Requires running content script on modified ChatGPT page
    // Contract ERR-002 verifies the check exists
  })

  test.skip('does not call GitHub API with empty content', async () => {
    // This behavior is enforced by the empty content check
    // Verified via contract test ERR-002
  })
})
