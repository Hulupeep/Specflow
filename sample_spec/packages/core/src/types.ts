/**
 * Core types for chat2repo
 * Contract: ARCH-001 - No browser APIs allowed
 */

export type SourceType = 'chatgpt' | 'web' | 'other'

export interface GitHubRepoConfig {
  id: string
  label: string
  owner: string
  repo: string
  defaultBranch: string
  basePath: string
}

export interface CaptureMetadata {
  source: SourceType
  capturedAt: string
  sourceUrl?: string
  sourceTitle?: string
  pageContext?: string
  repoLabel?: string
}

export interface CaptureRequest {
  repoId: string
  content: string
  topic: string
  tags: string[]
  metadata: CaptureMetadata
}

export interface FileDescriptor {
  path: string
  commitMessage: string
  body: string
}

export interface CaptureResult {
  htmlUrl: string
  path: string
}

export interface GitHubCreateFileResponse {
  content: {
    html_url: string
    path: string
  }
}

export interface GitHubErrorResponse {
  message: string
  status?: number
}

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
    public rateLimited: boolean = false
  ) {
    super(message)
    this.name = 'GitHubError'
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConfigurationError'
  }
}
