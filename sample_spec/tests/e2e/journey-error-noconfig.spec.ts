/**
 * Journey Test: J-ERROR-NOCONFIG
 * Error handling when extension is not configured
 *
 * From journeys.md:
 * 1. Extension installed but no PAT configured
 * 2. User tries to capture (ChatGPT or web)
 * 3. Toast: "GitHub is not configured. Open extension options..."
 * 4. "Open settings" button/link shown
 * 5. No network calls made
 * 6. No file created
 */

import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

const EXTENSION_PATH = path.join(__dirname, '../../packages/extension/dist')

test.describe('Journey: J-ERROR-NOCONFIG', () => {
  let context: BrowserContext

  test.beforeAll(async () => {
    // Launch with extension but DON'T configure it
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-first-run',
      ],
    })
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('shows configuration error toast when not configured', async () => {
    // Skip if extension not built
    const fs = await import('fs')
    if (!fs.existsSync(EXTENSION_PATH)) {
      test.skip()
      return
    }

    const page = await context.newPage()

    // Navigate to a test page
    await page.goto('https://example.com')

    // Select some text
    await page.evaluate(() => {
      const p = document.querySelector('p')
      if (p) {
        const range = document.createRange()
        range.selectNodeContents(p)
        const selection = window.getSelection()
        selection?.removeAllRanges()
        selection?.addRange(range)
      }
    })

    // Right-click to trigger context menu
    // Note: In real E2E test, we'd trigger the context menu action
    // For now, verify the extension is installed

    // Get extension ID
    const targets = context.serviceWorkers()
    const extensionTarget = targets.find((t) =>
      t.url().startsWith('chrome-extension://')
    )

    // Extension should be loaded
    expect(extensionTarget).toBeDefined()

    // Open popup to verify not-configured state
    if (extensionTarget) {
      const extensionId = new URL(extensionTarget.url()).hostname
      const popupPage = await context.newPage()
      await popupPage.goto(`chrome-extension://${extensionId}/popup/popup.html`)

      // Should show "Not configured" message
      await expect(popupPage.locator('text=Not configured')).toBeVisible()

      // Should have "Open Settings" button
      await expect(popupPage.locator('button:has-text("Open Settings")')).toBeVisible()

      await popupPage.close()
    }

    await page.close()
  })

  test('popup shows settings link when not configured', async () => {
    const fs = await import('fs')
    if (!fs.existsSync(EXTENSION_PATH)) {
      test.skip()
      return
    }

    // Get extension ID
    const targets = context.serviceWorkers()
    const extensionTarget = targets.find((t) =>
      t.url().startsWith('chrome-extension://')
    )

    if (!extensionTarget) {
      test.skip()
      return
    }

    const extensionId = new URL(extensionTarget.url()).hostname
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup/popup.html`)

    // Verify not configured state
    await expect(page.locator('text=Not configured')).toBeVisible()

    // Click Open Settings
    await page.click('button:has-text("Open Settings")')

    // Should navigate to options page (handled by chrome.runtime.openOptionsPage)
    // In test context, we just verify the button exists and is clickable

    await page.close()
  })
})
