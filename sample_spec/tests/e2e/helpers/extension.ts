/**
 * Playwright helpers for Chrome extension testing
 */

import { chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const EXTENSION_PATH = path.join(__dirname, '../../../packages/extension/dist')

export interface ExtensionContext {
  context: BrowserContext
  extensionId: string
  optionsPage: Page
}

/**
 * Launch browser with extension loaded
 */
export async function launchWithExtension(): Promise<ExtensionContext> {
  // Verify extension is built
  if (!fs.existsSync(EXTENSION_PATH)) {
    throw new Error(
      `Extension not built. Run: npm run build:extension\nExpected at: ${EXTENSION_PATH}`
    )
  }

  // Verify manifest exists
  const manifestPath = path.join(EXTENSION_PATH, 'manifest.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found at: ${manifestPath}`)
  }

  const context = await chromium.launchPersistentContext('', {
    headless: false, // Extensions require headed mode
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-first-run',
      '--disable-default-apps',
      '--disable-component-extensions-with-background-pages',
    ],
    slowMo: 100, // Slow down for extension loading
  })

  // Wait for extension to load and get ID - increased timeout
  let extensionId = ''
  let attempts = 0
  const maxAttempts = 30 // 15 seconds total

  // First, open a page to trigger extension activation
  const activationPage = await context.newPage()
  await activationPage.goto('chrome://extensions/')
  await new Promise((r) => setTimeout(r, 1000))

  while (!extensionId && attempts < maxAttempts) {
    await new Promise((r) => setTimeout(r, 500))

    // Check service workers
    const targets = context.serviceWorkers()
    const extensionTarget = targets.find((t) =>
      t.url().startsWith('chrome-extension://')
    )

    if (extensionTarget) {
      extensionId = new URL(extensionTarget.url()).hostname
    }

    // Also check background pages (fallback)
    if (!extensionId) {
      const bgPages = context.backgroundPages()
      const bgTarget = bgPages.find((t) =>
        t.url().startsWith('chrome-extension://')
      )
      if (bgTarget) {
        extensionId = new URL(bgTarget.url()).hostname
      }
    }

    attempts++
  }

  await activationPage.close()

  if (!extensionId) {
    // Last resort: try to read extension ID from chrome://extensions
    const debugPage = await context.newPage()
    await debugPage.goto('chrome://extensions/')
    await debugPage.waitForTimeout(2000)

    // Try to get extension ID from the page
    const pageContent = await debugPage.content()
    const idMatch = pageContent.match(/[a-z]{32}/)
    if (idMatch) {
      extensionId = idMatch[0]
    }
    await debugPage.close()
  }

  if (!extensionId) {
    throw new Error('Failed to get extension ID after 15 seconds')
  }

  // Open options page
  const optionsPage = await context.newPage()
  await optionsPage.goto(`chrome-extension://${extensionId}/options/options.html`)
  await optionsPage.waitForLoadState('networkidle')

  return { context, extensionId, optionsPage }
}

/**
 * Configure extension with test credentials from .env.local
 */
export async function configureExtension(page: Page): Promise<void> {
  const pat = process.env.Github_PAT
  const owner = process.env.github_owner
  const repo = process.env.github_repo
  const label = process.env.label || 'Test Repo'
  const branch = process.env.default_branch || 'main'
  const basePath = process.env.base_path || 'test-notes'
  const defaultTags = process.env.default_tags || ''

  if (!pat || !owner || !repo) {
    throw new Error(
      'Missing required environment variables: Github_PAT, github_owner, github_repo'
    )
  }

  // Fill in the options form
  await page.fill('input[type="password"]', pat)

  // Add repo
  await page.fill('input[placeholder="My Notes"]', label)
  await page.fill('input[placeholder="yourusername"]', owner)
  await page.fill('input[placeholder="my-notes"]', repo)
  await page.fill('input[placeholder="main"]', branch)
  await page.fill('input[placeholder="chat-notes"]', basePath)

  await page.click('button:has-text("Add Repository")')

  // Set default tags
  if (defaultTags) {
    await page.fill('input[placeholder="notes, ideas"]', defaultTags)
  }

  // Save settings
  await page.click('button:has-text("Save Settings")')

  // Wait for success message
  await page.waitForSelector('text=Settings saved!')
}

/**
 * Check if a file exists in the GitHub repo
 */
export async function checkGitHubFile(
  filePath: string
): Promise<{ exists: boolean; content?: string }> {
  const pat = process.env.Github_PAT
  const owner = process.env.github_owner
  const repo = process.env.github_repo

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (response.status === 404) {
    return { exists: false }
  }

  if (response.ok) {
    const data = await response.json()
    const content = Buffer.from(data.content, 'base64').toString('utf-8')
    return { exists: true, content }
  }

  throw new Error(`GitHub API error: ${response.status}`)
}

/**
 * Delete a file from GitHub repo (cleanup)
 */
export async function deleteGitHubFile(filePath: string): Promise<void> {
  const pat = process.env.Github_PAT
  const owner = process.env.github_owner
  const repo = process.env.github_repo
  const branch = process.env.default_branch || 'main'

  // First get the file SHA
  const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`
  const getResponse = await fetch(getUrl, {
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (getResponse.status === 404) {
    return // File doesn't exist, nothing to delete
  }

  const data = await getResponse.json()
  const sha = data.sha

  // Delete the file
  await fetch(getUrl, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: 'Test cleanup: delete test file',
      sha,
      branch,
    }),
  })
}
