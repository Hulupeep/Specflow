/**
 * Capture orchestrator - coordinates markdown building and GitHub upload
 * Contract: ARCH-001 - No browser APIs allowed
 */

import type {
  CaptureRequest,
  CaptureResult,
  GitHubRepoConfig,
} from './types'
import { ConfigurationError } from './types'
import { GitHubClient } from './githubClient'
import { buildFileDescriptor } from './markdownBuilder'

export interface CaptureDependencies {
  findRepoConfig(repoId: string): Promise<GitHubRepoConfig | undefined>
  getToken(): Promise<string | null>
}

export class CaptureOrchestrator {
  constructor(private deps: CaptureDependencies) {}

  /**
   * Perform a capture: build markdown, upload to GitHub
   */
  async performCapture(request: CaptureRequest): Promise<CaptureResult> {
    // Validate configuration
    const token = await this.deps.getToken()
    if (!token) {
      throw new ConfigurationError('GitHub token not configured.')
    }

    const repoConfig = await this.deps.findRepoConfig(request.repoId)
    if (!repoConfig) {
      throw new ConfigurationError('Repository configuration not found.')
    }

    // Validate request
    this.validateRequest(request)

    // Build file descriptor
    const fileDescriptor = buildFileDescriptor(request, repoConfig)

    // Upload to GitHub with retry for collisions
    const client = new GitHubClient(token)
    return client.createFileWithRetry(repoConfig, fileDescriptor)
  }

  private validateRequest(request: CaptureRequest): void {
    if (!request.content || request.content.trim().length === 0) {
      throw new ConfigurationError('Content cannot be empty.')
    }

    if (!request.topic || request.topic.trim().length === 0) {
      throw new ConfigurationError('Topic cannot be empty.')
    }

    if (!Array.isArray(request.tags)) {
      throw new ConfigurationError('Tags must be an array.')
    }
  }
}
