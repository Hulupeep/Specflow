/**
 * Background service worker entry point
 * Contract: MV3-001 - Service worker (not persistent page)
 * Contract: MV3-002 - No setInterval, no global mutable state
 * Contract: ARCH-002 - GitHub API calls happen here
 * Contract: SEC-001 - PAT accessed here only
 */

import { handleMessage } from './messageHandlers'
import { setupContextMenus, handleContextMenuClick } from './contextMenus'
import type { ExtensionRequest } from '../shared/messages'

// Set up context menus on install
chrome.runtime.onInstalled.addListener(() => {
  setupContextMenus()
})

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(handleContextMenuClick)

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener(
  (
    request: ExtensionRequest,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    // Handle async message
    handleMessage(request)
      .then(sendResponse)
      .catch((error) => {
        // Contract: ERR-001 - Don't expose internal errors
        sendResponse({
          success: false,
          error: 'Internal error occurred',
          errorType: 'network',
        })
      })

    // Return true to indicate async response
    return true
  }
)
