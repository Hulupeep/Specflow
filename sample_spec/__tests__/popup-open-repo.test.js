/**
 * TDD Tests for Popup "Open Repo" Button
 *
 * Requirements:
 * - Footer has "Open Repo" button (not "Settings" twice)
 * - "Open Repo" is disabled/greyed out when not configured
 * - "Open Repo" is enabled when configured
 * - Clicking "Open Repo" opens the GitHub repo URL in a new tab
 */

const fs = require('fs')
const path = require('path')

const POPUP_PATH = path.join(__dirname, '../packages/extension/src/popup/Popup.tsx')

describe('Popup Open Repo Button', () => {
  let popupContent

  beforeAll(() => {
    popupContent = fs.readFileSync(POPUP_PATH, 'utf-8')
  })

  describe('Button Existence', () => {
    test('footer contains "Open Repo" button', () => {
      // Should have a button with "Open Repo" text
      expect(popupContent).toMatch(/Open Repo/i)
    })

    test('footer does NOT have duplicate Settings button', () => {
      // The footer should only have one settings-related element
      // Currently has: settingsButton in footer
      // Should be replaced with Open Repo button
      const footerMatch = popupContent.match(/<footer[^>]*>[\s\S]*?<\/footer>/i)
      expect(footerMatch).not.toBeNull()

      const footer = footerMatch[0]
      // Footer should NOT have "Settings" button - only "Open Repo" and "Help & Docs"
      const settingsInFooter = (footer.match(/Settings/g) || []).length
      expect(settingsInFooter).toBe(0)
    })

    test('Open Repo button has data-testid attribute', () => {
      expect(popupContent).toMatch(/data-testid=["']open-repo-button["']/)
    })
  })

  describe('Disabled State (Not Configured)', () => {
    test('Open Repo button is disabled when status.configured is false', () => {
      // Button should have disabled attribute tied to !status?.configured
      expect(popupContent).toMatch(/disabled=\{!status\?\.configured\}/)
    })

    test('Open Repo button has disabled styling when not configured', () => {
      // Should apply disabled/greyed out styles - check for openRepoButtonDisabled style
      expect(popupContent).toMatch(/openRepoButtonDisabled/)
    })

    test('disabled style has reduced opacity', () => {
      // Disabled style should have opacity < 1
      expect(popupContent).toMatch(/openRepoButtonDisabled[\s\S]*?opacity:\s*0\.[45]/)
    })
  })

  describe('Enabled State (Configured)', () => {
    test('Open Repo button is enabled when configured', () => {
      // The disabled condition should allow enabled state when configured
      expect(popupContent).toMatch(/disabled=\{!status\?\.configured\}/)
    })
  })

  describe('Click Handler', () => {
    test('has openRepo function defined', () => {
      expect(popupContent).toMatch(/function\s+openRepo\s*\(\)/)
    })

    test('openRepo function opens new tab with repo URL', () => {
      // Should use chrome.tabs.create to open repo
      expect(popupContent).toMatch(/chrome\.tabs\.create/)
    })

    test('openRepo constructs GitHub URL from repo config', () => {
      // Should build URL like https://github.com/{owner}/{repo}
      expect(popupContent).toMatch(/github\.com\/\$\{owner\}\/\$\{repo\}/)
    })

    test('Open Repo button onClick calls openRepo', () => {
      expect(popupContent).toMatch(/onClick=\{openRepo\}/)
    })
  })

  describe('Repo URL in Status', () => {
    test('requests repo info in status check', () => {
      // The status response should include repo URL or owner/repo info
      // Check that ConfigStatusResponse type includes repo info
      const messagesPath = path.join(__dirname, '../packages/extension/src/shared/messages.ts')
      const messagesContent = fs.readFileSync(messagesPath, 'utf-8')

      // ConfigStatusResponse should have repoUrl or owner/repo fields
      expect(messagesContent).toMatch(/ConfigStatusResponse[\s\S]*?(repoUrl|defaultRepo)/)
    })
  })
})
