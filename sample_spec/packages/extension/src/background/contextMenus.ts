/**
 * Context menu setup for web page selections
 * Contract: MV3-001 - Service worker compatible
 * Contract: ARCH-002 - GitHub API calls happen in background
 */

import { handleMessage } from './messageHandlers'

const MENU_QUICK_SEND = 'chat2repo-quick-send'

/**
 * Create context menus on extension install
 */
export function setupContextMenus(): void {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Quick send - only option for simplicity
    chrome.contextMenus.create({
      id: MENU_QUICK_SEND,
      title: 'Save to GitHub',
      contexts: ['selection'],
    })
  })
}

/**
 * Handle context menu clicks
 * Processes directly in background - no content script needed
 */
export async function handleContextMenuClick(
  info: chrome.contextMenus.OnClickData,
  tab?: chrome.tabs.Tab
): Promise<void> {
  if (!info.selectionText) {
    return
  }

  if (info.menuItemId === MENU_QUICK_SEND) {
    // Handle directly in background - no content script required
    try {
      const result = await handleMessage({
        type: 'quick-capture',
        payload: {
          content: info.selectionText,
          source: 'web',
          sourceUrl: tab?.url || '',
          sourceTitle: tab?.title || '',
        },
      } as any)

      // Show notification of result (cast result to check success)
      const captureResult = result as { success: boolean; error?: string }
      if (captureResult.success) {
        // Use chrome notifications API for feedback
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: 'chat2repo',
            message: 'Saved to GitHub!',
          })
        }
      } else {
        if (chrome.notifications) {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: chrome.runtime.getURL('icons/icon48.png'),
            title: 'chat2repo',
            message: captureResult.error || 'Failed to save',
          })
        }
      }
    } catch (error) {
      console.error('Context menu save failed:', error)
      if (chrome.notifications) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon48.png'),
          title: 'chat2repo',
          message: 'Failed to save. Check your settings.',
        })
      }
    }
  }
}
