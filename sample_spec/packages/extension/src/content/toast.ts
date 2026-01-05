/**
 * Toast notification system for in-page feedback
 * Contract: UX-001 - Show toast for unconfigured state
 * Contract: UX-002 - Quick send shows only toast, no modal
 */

const TOAST_CONTAINER_ID = 'chat2repo-toast-container'
const TOAST_DURATION = 5000

interface ToastOptions {
  type: 'success' | 'error' | 'info'
  message: string
  action?: {
    label: string
    onClick: () => void
  }
  link?: {
    label: string
    url: string
  }
}

/**
 * Get or create the toast container
 */
function getToastContainer(): HTMLElement {
  let container = document.getElementById(TOAST_CONTAINER_ID)

  if (!container) {
    container = document.createElement('div')
    container.id = TOAST_CONTAINER_ID
    container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `
    document.body.appendChild(container)
  }

  return container
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
  const container = getToastContainer()

  const toast = document.createElement('div')
  toast.setAttribute('data-testid', 'toast')
  toast.style.cssText = `
    background: ${options.type === 'error' ? '#dc3545' : options.type === 'success' ? '#28a745' : '#17a2b8'};
    color: white;
    padding: 12px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    display: flex;
    align-items: center;
    gap: 12px;
    max-width: 400px;
    pointer-events: auto;
    animation: slideIn 0.3s ease;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
  `

  // Message
  const messageEl = document.createElement('span')
  messageEl.textContent = options.message
  messageEl.style.flex = '1'
  toast.appendChild(messageEl)

  // Action button
  if (options.action) {
    const actionBtn = document.createElement('button')
    actionBtn.textContent = options.action.label
    actionBtn.style.cssText = `
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    `
    actionBtn.onclick = options.action.onClick
    toast.appendChild(actionBtn)
  }

  // Link
  if (options.link) {
    const linkEl = document.createElement('a')
    linkEl.textContent = options.link.label
    linkEl.href = options.link.url
    linkEl.target = '_blank'
    linkEl.rel = 'noopener noreferrer'
    linkEl.style.cssText = `
      color: white;
      text-decoration: underline;
      font-size: 13px;
    `
    toast.appendChild(linkEl)
  }

  // Close button
  const closeBtn = document.createElement('button')
  closeBtn.textContent = '×'
  closeBtn.style.cssText = `
    background: none;
    border: none;
    color: white;
    font-size: 20px;
    cursor: pointer;
    padding: 0 4px;
    opacity: 0.7;
  `
  closeBtn.onclick = () => toast.remove()
  toast.appendChild(closeBtn)

  container.appendChild(toast)

  // Auto-remove after duration
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease'
    setTimeout(() => toast.remove(), 300)
  }, TOAST_DURATION)
}

/**
 * Show success toast with GitHub link
 */
export function showSuccessToast(message: string, githubUrl: string): void {
  showToast({
    type: 'success',
    message,
    link: {
      label: 'Open',
      url: githubUrl,
    },
  })
}

/**
 * Show error toast
 * Contract: UX-001 - Include settings action for not_configured errors
 */
export function showErrorToast(
  message: string,
  errorType?: string
): void {
  const options: ToastOptions = {
    type: 'error',
    message,
  }

  // UX-001: Show settings link for configuration errors
  if (errorType === 'not_configured') {
    options.action = {
      label: 'Open settings',
      onClick: () => {
        chrome.runtime.sendMessage({ type: 'open-options' })
      },
    }
  }

  showToast(options)
}

/**
 * Show fallback toast for DOM parsing failure
 * Contract: ERR-002
 */
export function showDomFailureToast(): void {
  showToast({
    type: 'info',
    message:
      "Couldn't detect message content. Select the text and use 'Quick send to GitHub' instead.",
  })
}

// Add animation styles
const style = document.createElement('style')
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  @keyframes slideOut {
    from { transform: translateX(0); opacity: 1; }
    to { transform: translateX(100%); opacity: 0; }
  }
`
document.head.appendChild(style)
