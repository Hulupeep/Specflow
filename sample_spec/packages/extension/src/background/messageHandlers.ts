/**
 * Message handlers for background service worker
 * Contract: ARCH-002 - GitHub API calls only from background
 * Contract: SEC-002 - PAT never exposed in responses
 * Contract: ERR-001 - User-friendly error messages
 */

import {
  CaptureOrchestrator,
  generateTopicFromContent,
  extractHashtags,
  GitHubError,
  ConfigurationError,
} from '@chat2repo/core'
import type {
  ExtensionRequest,
  ConfigStatusResponse,
  GetRepoConfigsResponse,
  CaptureResponse,
  QuickSendDefaults,
} from '../shared/messages'
import {
  getPAT,
  getRepoConfigs,
  findRepoConfig,
  getDefaultRepoId,
  getDefaultTags,
  getQuickSendDefaults,
  saveQuickSendDefaults,
  isConfigured,
} from './storage'

/**
 * Handle incoming messages from content scripts/popup
 */
export async function handleMessage(
  request: ExtensionRequest
): Promise<unknown> {
  switch (request.type) {
    case 'get-config-status':
      return handleGetConfigStatus()

    case 'get-repo-configs':
      return handleGetRepoConfigs()

    case 'perform-capture':
      return handlePerformCapture(request.payload)

    case 'quick-capture':
      return handleQuickCapture(request.payload)

    case 'get-quick-send-defaults':
      return handleGetQuickSendDefaults()

    case 'save-quick-send-defaults':
      return handleSaveQuickSendDefaults(request.payload)

    default:
      return { error: 'Unknown message type' }
  }
}

async function handleGetConfigStatus(): Promise<ConfigStatusResponse> {
  const { hasToken, hasRepos } = await isConfigured()
  const repos = await getRepoConfigs()
  const defaultRepoId = await getDefaultRepoId()
  const defaultRepo = repos.find(r => r.id === defaultRepoId) || repos[0]

  return {
    configured: hasToken && hasRepos,
    hasToken,
    hasRepos,
    defaultRepo: defaultRepo ? { owner: defaultRepo.owner, repo: defaultRepo.repo } : undefined,
  }
}

async function handleGetRepoConfigs(): Promise<GetRepoConfigsResponse> {
  const repos = await getRepoConfigs()
  const defaultRepoId = await getDefaultRepoId()

  // Contract: SEC-002 - Don't include PAT
  return {
    repos: repos.map((r) => ({
      id: r.id,
      label: r.label,
      owner: r.owner,
      repo: r.repo,
    })),
    defaultRepoId: defaultRepoId || repos[0]?.id,
  }
}

async function handlePerformCapture(payload: {
  repoId: string
  content: string
  topic: string
  tags: string[]
  source: 'chatgpt' | 'web' | 'other'
  sourceUrl: string
  sourceTitle: string
  pageContext?: string
}): Promise<CaptureResponse> {
  try {
    const orchestrator = new CaptureOrchestrator({
      findRepoConfig,
      getToken: getPAT,
    })

    const result = await orchestrator.performCapture({
      repoId: payload.repoId,
      content: payload.content,
      topic: payload.topic,
      tags: payload.tags,
      metadata: {
        source: payload.source,
        capturedAt: new Date().toISOString(),
        sourceUrl: payload.sourceUrl,
        sourceTitle: payload.sourceTitle,
        pageContext: payload.pageContext,
      },
    })

    return { success: true, result }
  } catch (error) {
    return handleCaptureError(error)
  }
}

async function handleQuickCapture(payload: {
  content: string
  source: 'chatgpt' | 'web' | 'other'
  sourceUrl: string
  sourceTitle: string
  pageContext?: string
}): Promise<CaptureResponse> {
  // Get quick send defaults or fallback to global defaults
  const quickDefaults = await getQuickSendDefaults()
  const defaultRepoId = quickDefaults?.repoId || (await getDefaultRepoId())
  const repos = await getRepoConfigs()

  if (!defaultRepoId || repos.length === 0) {
    return {
      success: false,
      error: 'GitHub is not configured. Open extension options.',
      errorType: 'not_configured',
    }
  }

  // Build tags: source tag + extracted hashtags + quick defaults + global defaults
  const defaultTags = await getDefaultTags()
  const quickTags = quickDefaults?.tags || []
  const extractedTags = extractHashtags(payload.content)
  const allTags = [
    payload.source,
    ...new Set([...extractedTags, ...quickTags, ...defaultTags]),
  ]

  // Generate topic from content
  const topic = generateTopicFromContent(payload.content)

  return handlePerformCapture({
    repoId: defaultRepoId,
    content: payload.content,
    topic,
    tags: allTags,
    source: payload.source,
    sourceUrl: payload.sourceUrl,
    sourceTitle: payload.sourceTitle,
    pageContext: payload.pageContext,
  })
}

async function handleGetQuickSendDefaults(): Promise<QuickSendDefaults | null> {
  return getQuickSendDefaults()
}

async function handleSaveQuickSendDefaults(
  defaults: QuickSendDefaults
): Promise<{ success: boolean }> {
  await saveQuickSendDefaults(defaults)
  return { success: true }
}

/**
 * Convert errors to user-friendly responses
 * Contract: ERR-001 - Friendly messages without PAT exposure
 */
function handleCaptureError(error: unknown): CaptureResponse {
  if (error instanceof ConfigurationError) {
    return {
      success: false,
      error: error.message,
      errorType: 'not_configured',
    }
  }

  if (error instanceof GitHubError) {
    if (error.rateLimited) {
      return {
        success: false,
        error: 'Rate limit reached. Try again later.',
        errorType: 'rate_limit',
      }
    }
    return {
      success: false,
      error: error.message,
      errorType: 'network',
    }
  }

  // Generic error - don't expose details
  return {
    success: false,
    error: 'Something went wrong. Please try again.',
    errorType: 'network',
  }
}
