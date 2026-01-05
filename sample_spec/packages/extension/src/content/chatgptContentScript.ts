/**
 * ChatGPT content script - injects buttons and handles captures
 * Contract: ARCH-002 - No direct GitHub API calls
 * Contract: UX-003 - Buttons only on assistant messages
 * Contract: UX-002 - Quick send shows no modal
 * Contract: ERR-002 - Handle empty content gracefully
 */

import {
  findAssistantMessages,
  getMessageContent,
  getConversationContext,
  hasInjectedButton,
  findButtonInjectionPoint,
} from './chatgptDom'
import {
  showSuccessToast,
  showErrorToast,
  showDomFailureToast,
} from './toast'
import type { CaptureResponse } from '../shared/messages'

const BUTTON_CLASS = 'chat2repo-send-btn'

/**
 * Create the "Send to repo" button
 */
function createSendButton(messageElement: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button')
  button.className = BUTTON_CLASS
  button.setAttribute('data-chat2repo-button', 'true')
  button.setAttribute('data-testid', 'send-to-repo')
  button.title = 'Send to repo'
  // Lucide send icon - paper airplane
  button.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/>
      <path d="m21.854 2.147-10.94 10.939"/>
    </svg>
  `

  // Detect dark mode
  const isDarkMode = () => {
    return document.documentElement.classList.contains('dark') ||
           document.body.classList.contains('dark') ||
           window.matchMedia('(prefers-color-scheme: dark)').matches ||
           getComputedStyle(document.body).backgroundColor.match(/^rgb\((\d+)/)?.[ 1] < '128'
  }

  const getColors = () => {
    const dark = isDarkMode()
    return {
      normal: dark ? '#a0a0a0' : '#6b7280',
      hover: dark ? '#ffffff' : '#1f2937',
      hoverBg: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'
    }
  }

  const colors = getColors()
  button.style.cssText = `
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: ${colors.normal};
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
    margin-left: 4px;
  `

  button.addEventListener('mouseenter', () => {
    const c = getColors()
    button.style.background = c.hoverBg
    button.style.color = c.hover
  })

  button.addEventListener('mouseleave', () => {
    const c = getColors()
    button.style.background = 'transparent'
    button.style.color = c.normal
  })

  button.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    handleButtonClick(messageElement)
  })

  return button
}

/**
 * Handle button click
 * Contract: ERR-002 - Check for empty content before capture
 */
async function handleButtonClick(messageElement: HTMLElement): Promise<void> {
  // Contract: ERR-002 - Check for empty/null content
  const content = getMessageContent(messageElement)

  if (!content) {
    // ERR-002: Show fallback toast, don't attempt capture
    showDomFailureToast()
    return
  }

  // Check configuration first
  const configStatus = await chrome.runtime.sendMessage({
    type: 'get-config-status',
  })

  if (!configStatus.configured) {
    // UX-001: Show toast with settings link
    showErrorToast(
      'GitHub is not configured. Open extension options to add your token and repo.',
      'not_configured'
    )
    return
  }

  // Check if we should show modal or quick send
  const quickDefaults = await chrome.runtime.sendMessage({
    type: 'get-quick-send-defaults',
  })

  if (quickDefaults?.dontAskAgain) {
    // UX-002: Quick send - no modal, just toast
    await performQuickSend(content)
  } else {
    // First time or user wants to customize - show modal
    // For now, do quick send until modal is implemented
    await performQuickSend(content)
  }
}

/**
 * Perform quick send capture
 * Contract: UX-002 - No modal, only toast feedback
 */
async function performQuickSend(content: string): Promise<void> {
  const context = getConversationContext()

  const response: CaptureResponse = await chrome.runtime.sendMessage({
    type: 'quick-capture',
    payload: {
      content,
      source: 'chatgpt',
      sourceUrl: window.location.href,
      sourceTitle: document.title,
      pageContext: context || undefined,
    },
  })

  if (response.success) {
    const path = response.result.path.split('/').pop() || 'note'
    showSuccessToast(
      `Saved: ${path}`,
      response.result.htmlUrl
    )
  } else {
    showErrorToast(response.error, response.errorType)
  }
}

/**
 * Inject buttons into all assistant messages
 * Contract: UX-003 - Only assistant messages
 */
function injectButtons(): void {
  const messages = findAssistantMessages()

  for (const message of messages) {
    if (hasInjectedButton(message)) {
      continue
    }

    const injectionPoint = findButtonInjectionPoint(message)
    if (injectionPoint) {
      const button = createSendButton(message)
      injectionPoint.appendChild(button)
    }
  }
}

/**
 * Observe DOM for new messages
 */
function observeMessages(): void {
  const observer = new MutationObserver(() => {
    // Debounce injection
    setTimeout(injectButtons, 100)
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Initial injection
  injectButtons()
}

/**
 * Handle messages from background (context menu)
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'context-menu-quick-send') {
    performQuickSend(message.payload.content)
    sendResponse({ received: true })
  }
  return true
})

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeMessages)
} else {
  observeMessages()
}
