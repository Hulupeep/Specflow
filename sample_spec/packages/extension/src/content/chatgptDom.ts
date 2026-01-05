/**
 * ChatGPT DOM utilities - selectors and content extraction
 * Contract: UX-003 - Only target assistant messages
 * Contract: ERR-002 - Handle DOM parsing failures gracefully
 */

// Selectors for ChatGPT DOM
const SELECTORS = {
  // Assistant messages only (UX-003)
  assistantMessage: '[data-message-author-role="assistant"]',
  messageContent: '.markdown',
  conversationTitle: 'h1',
  messageContainer: '[data-testid^="conversation-turn"]',
} as const

/**
 * Find all assistant messages in the DOM
 * Contract: UX-003 - Only assistant messages, not user messages
 */
export function findAssistantMessages(): HTMLElement[] {
  const messages = document.querySelectorAll<HTMLElement>(
    SELECTORS.assistantMessage
  )
  return Array.from(messages)
}

/**
 * Get the content of a message element
 * Contract: ERR-002 - Returns null if parsing fails
 */
export function getMessageContent(
  messageElement: HTMLElement
): string | null {
  try {
    // Find markdown content within the message
    const markdownEl = messageElement.querySelector(SELECTORS.messageContent)

    if (!markdownEl) {
      return null
    }

    // Get text content, preserving structure
    const content = extractTextContent(markdownEl)

    // ERR-002: Return null for empty content
    if (!content || content.trim().length === 0) {
      return null
    }

    return content.trim()
  } catch {
    // ERR-002: Return null on any parsing error
    return null
  }
}

/**
 * Extract text content from element, preserving markdown-like structure
 */
function extractTextContent(element: Element): string {
  const lines: string[] = []

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      lines.push(node.textContent || '')
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()

      if (tag === 'p') {
        lines.push(el.textContent || '')
        lines.push('')
      } else if (tag === 'pre') {
        const code = el.querySelector('code')
        const lang = code?.className.match(/language-(\w+)/)?.[1] || ''
        lines.push('```' + lang)
        lines.push(code?.textContent || el.textContent || '')
        lines.push('```')
        lines.push('')
      } else if (tag === 'ul' || tag === 'ol') {
        const items = el.querySelectorAll('li')
        items.forEach((li, i) => {
          const prefix = tag === 'ol' ? `${i + 1}. ` : '- '
          lines.push(prefix + (li.textContent || ''))
        })
        lines.push('')
      } else if (tag.match(/^h[1-6]$/)) {
        const level = parseInt(tag[1])
        lines.push('#'.repeat(level) + ' ' + (el.textContent || ''))
        lines.push('')
      } else {
        lines.push(el.textContent || '')
      }
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n')
}

/**
 * Get the conversation title/context
 */
export function getConversationContext(): string | null {
  try {
    const titleEl = document.querySelector(SELECTORS.conversationTitle)
    return titleEl?.textContent?.trim() || null
  } catch {
    return null
  }
}

/**
 * Check if an element already has our button injected
 */
export function hasInjectedButton(messageElement: HTMLElement): boolean {
  return messageElement.querySelector('[data-chat2repo-button]') !== null
}

/**
 * Find the best location to inject our button within a message
 */
export function findButtonInjectionPoint(
  messageElement: HTMLElement
): HTMLElement | null {
  // Look for the message actions area
  const actionsArea = messageElement.querySelector(
    '[class*="actions"], [class*="buttons"], [class*="toolbar"]'
  )

  if (actionsArea) {
    return actionsArea as HTMLElement
  }

  // Fallback to the message container itself
  return messageElement
}
