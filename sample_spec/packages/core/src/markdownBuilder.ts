/**
 * Markdown builder for notes with YAML front-matter
 * Contract: MD-001, MD-002, MD-003 - Required fields, stable schema, tags array
 */

import type {
  CaptureRequest,
  GitHubRepoConfig,
  FileDescriptor,
} from './types'
import { createNotePath } from './pathUtils'

/**
 * Build YAML front-matter from metadata
 * Contract: MD-001 - Must include source, captured_at, tags
 * Contract: MD-003 - tags must always be present as array
 */
function buildFrontMatter(
  request: CaptureRequest,
  repoConfig: GitHubRepoConfig
): string {
  const { metadata, topic, tags } = request

  const lines: string[] = ['---']

  // Required fields (MD-001)
  lines.push(`source: ${metadata.source}`)
  lines.push(`captured_at: ${metadata.capturedAt}`)

  // Optional fields
  if (metadata.sourceUrl) {
    lines.push(`url: "${metadata.sourceUrl}"`)
  }
  if (metadata.sourceTitle) {
    lines.push(`page_title: "${escapeYamlString(metadata.sourceTitle)}"`)
  }
  if (metadata.pageContext) {
    lines.push(`page_context: "${escapeYamlString(metadata.pageContext)}"`)
  }

  lines.push(`repo_label: "${repoConfig.label}"`)
  lines.push(`topic: "${escapeYamlString(topic)}"`)

  // Tags - always present as array (MD-003)
  lines.push('tags:')
  if (tags.length === 0) {
    lines.push('  []')
  } else {
    for (const tag of tags) {
      lines.push(`  - ${tag}`)
    }
  }

  lines.push('---')
  return lines.join('\n')
}

/**
 * Escape special characters in YAML strings
 */
function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
}

/**
 * Build complete file descriptor from capture request
 */
export function buildFileDescriptor(
  request: CaptureRequest,
  repoConfig: GitHubRepoConfig
): FileDescriptor {
  const frontMatter = buildFrontMatter(request, repoConfig)
  const body = `${frontMatter}\n\n${request.content}`

  const path = createNotePath(
    repoConfig.basePath,
    request.topic,
    request.metadata.capturedAt
  )

  const commitMessage = `Add note: ${request.topic}`

  return {
    path,
    commitMessage,
    body,
  }
}

/**
 * Build file descriptor with collision suffix
 */
export function buildFileDescriptorWithSuffix(
  request: CaptureRequest,
  repoConfig: GitHubRepoConfig,
  suffix: number
): FileDescriptor {
  const base = buildFileDescriptor(request, repoConfig)

  const pathParts = base.path.split('/')
  const filename = pathParts.pop() || ''
  const newFilename = filename.replace('.md', `-${suffix}.md`)

  return {
    ...base,
    path: [...pathParts, newFilename].join('/'),
  }
}
