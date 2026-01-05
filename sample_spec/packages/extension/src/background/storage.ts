/**
 * Storage utilities for background service worker
 * Contract: SEC-001 - PAT stored in chrome.storage.local, background only
 * Contract: MV3-002 - No global mutable state
 */

import type { GitHubRepoConfig } from '@chat2repo/core'
import type { QuickSendDefaults } from '../shared/messages'

const STORAGE_KEYS = {
  PAT: 'github_pat',
  REPOS: 'repo_configs',
  DEFAULT_REPO: 'default_repo_id',
  DEFAULT_TAGS: 'default_tags',
  QUICK_SEND_DEFAULTS: 'quick_send_defaults',
} as const

/**
 * Get GitHub PAT from storage
 * Contract: SEC-001 - Only called from background
 */
export async function getPAT(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.PAT)
  return result[STORAGE_KEYS.PAT] || null
}

/**
 * Save GitHub PAT to storage
 */
export async function savePAT(pat: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.PAT]: pat })
}

/**
 * Get all repo configurations
 */
export async function getRepoConfigs(): Promise<GitHubRepoConfig[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.REPOS)
  return result[STORAGE_KEYS.REPOS] || []
}

/**
 * Find a specific repo config by ID
 */
export async function findRepoConfig(
  repoId: string
): Promise<GitHubRepoConfig | undefined> {
  const repos = await getRepoConfigs()
  return repos.find((r) => r.id === repoId)
}

/**
 * Save repo configurations
 */
export async function saveRepoConfigs(
  configs: GitHubRepoConfig[]
): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.REPOS]: configs })
}

/**
 * Get default repo ID
 */
export async function getDefaultRepoId(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DEFAULT_REPO)
  return result[STORAGE_KEYS.DEFAULT_REPO] || null
}

/**
 * Save default repo ID
 */
export async function saveDefaultRepoId(repoId: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_REPO]: repoId })
}

/**
 * Get default tags
 */
export async function getDefaultTags(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DEFAULT_TAGS)
  return result[STORAGE_KEYS.DEFAULT_TAGS] || []
}

/**
 * Save default tags
 */
export async function saveDefaultTags(tags: string[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.DEFAULT_TAGS]: tags })
}

/**
 * Get quick send defaults
 */
export async function getQuickSendDefaults(): Promise<QuickSendDefaults | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.QUICK_SEND_DEFAULTS)
  return result[STORAGE_KEYS.QUICK_SEND_DEFAULTS] || null
}

/**
 * Save quick send defaults
 */
export async function saveQuickSendDefaults(
  defaults: QuickSendDefaults
): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.QUICK_SEND_DEFAULTS]: defaults,
  })
}

/**
 * Check if extension is configured
 */
export async function isConfigured(): Promise<{
  hasToken: boolean
  hasRepos: boolean
}> {
  const [pat, repos] = await Promise.all([getPAT(), getRepoConfigs()])
  return {
    hasToken: !!pat,
    hasRepos: repos.length > 0,
  }
}

/**
 * Clear all storage (for testing)
 */
export async function clearAllStorage(): Promise<void> {
  await chrome.storage.local.clear()
}
