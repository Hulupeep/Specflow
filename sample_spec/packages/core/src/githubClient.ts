/**
 * GitHub API client for creating files
 * Contract: ARCH-001 - No browser APIs, uses generic fetch
 * Contract: ERR-001 - User-friendly errors without PAT exposure
 */

import type {
  GitHubRepoConfig,
  FileDescriptor,
  CaptureResult,
  GitHubCreateFileResponse,
} from './types'
import { GitHubError } from './types'

const GITHUB_API_BASE = 'https://api.github.com'
const MAX_RETRIES = 3

export interface FetchFunction {
  (url: string, init?: RequestInit): Promise<Response>
}

export class GitHubClient {
  private fetchFn: FetchFunction

  constructor(
    private token: string,
    fetchFn?: FetchFunction
  ) {
    // Use injected fetch or global fetch
    this.fetchFn = fetchFn || fetch.bind(globalThis)
  }

  /**
   * Create a file in a GitHub repo
   * Handles 409 conflicts by retrying with suffix
   */
  async createFile(
    config: GitHubRepoConfig,
    file: FileDescriptor
  ): Promise<CaptureResult> {
    const url = `${GITHUB_API_BASE}/repos/${config.owner}/${config.repo}/contents/${file.path}`

    const body = JSON.stringify({
      message: file.commitMessage,
      content: this.base64Encode(file.body),
      branch: config.defaultBranch,
    })

    const response = await this.makeRequest(url, 'PUT', body)

    if (response.ok) {
      const data = (await response.json()) as GitHubCreateFileResponse
      return {
        htmlUrl: data.content.html_url,
        path: data.content.path,
      }
    }

    // Handle errors (ERR-001: user-friendly messages)
    await this.handleError(response)

    // TypeScript requires this but handleError always throws
    throw new GitHubError('Unknown error', response.status)
  }

  /**
   * Create file with automatic collision handling
   */
  async createFileWithRetry(
    config: GitHubRepoConfig,
    file: FileDescriptor,
    maxAttempts: number = MAX_RETRIES
  ): Promise<CaptureResult> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const currentFile =
          attempt === 0
            ? file
            : this.addSuffixToPath(file, attempt)

        return await this.createFile(config, currentFile)
      } catch (error) {
        // Handle both 409 and 422 (GitHub returns 422 for duplicate files)
        if (error instanceof GitHubError && (error.status === 409 || error.status === 422)) {
          lastError = error
          continue
        }
        throw error
      }
    }

    throw lastError || new GitHubError('Max retries exceeded', 409)
  }

  private addSuffixToPath(
    file: FileDescriptor,
    suffix: number
  ): FileDescriptor {
    const newPath = file.path.replace('.md', `-${suffix}.md`)
    return { ...file, path: newPath }
  }

  private async makeRequest(
    url: string,
    method: string,
    body?: string
  ): Promise<Response> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }

    return this.fetchFn(url, { method, headers, body })
  }

  private async handleError(response: Response): Promise<never> {
    const status = response.status

    // Rate limit (ERR-001: friendly message)
    if (status === 403) {
      const rateLimitRemaining = response.headers.get('X-RateLimit-Remaining')
      if (rateLimitRemaining === '0') {
        throw new GitHubError(
          'Rate limit reached. Try again later.',
          403,
          true
        )
      }
      throw new GitHubError('Access denied. Check your token permissions.', 403)
    }

    // Not found
    if (status === 404) {
      throw new GitHubError(
        'Repository not found. Check owner and repo name.',
        404
      )
    }

    // Conflict (file exists) - GitHub may return 409 or 422
    if (status === 409 || status === 422) {
      throw new GitHubError('File already exists.', 409) // Normalize to 409 for retry logic
    }

    // Server errors
    if (status >= 500) {
      throw new GitHubError(
        'GitHub is having issues. Please try again.',
        status
      )
    }

    // Generic error
    throw new GitHubError(`Request failed with status ${status}`, status)
  }

  private base64Encode(str: string): string {
    // Use Buffer in Node.js or btoa in browser
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(str, 'utf-8').toString('base64')
    }
    return btoa(unescape(encodeURIComponent(str)))
  }
}
