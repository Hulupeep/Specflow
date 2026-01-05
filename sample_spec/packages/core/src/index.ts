/**
 * Core package exports
 * Contract: ARCH-001 - No browser APIs allowed in this package
 */

// Types
export type {
  SourceType,
  GitHubRepoConfig,
  CaptureMetadata,
  CaptureRequest,
  FileDescriptor,
  CaptureResult,
  GitHubCreateFileResponse,
  GitHubErrorResponse,
} from './types'

export { GitHubError, ConfigurationError } from './types'

// Path utilities
export {
  slugify,
  parseDateParts,
  createNotePath,
  createNotePathWithSuffix,
  generateTopicFromContent,
  extractHashtags,
} from './pathUtils'

// Markdown builder
export {
  buildFileDescriptor,
  buildFileDescriptorWithSuffix,
} from './markdownBuilder'

// GitHub client
export { GitHubClient } from './githubClient'
export type { FetchFunction } from './githubClient'

// Orchestrator
export { CaptureOrchestrator } from './captureOrchestrator'
export type { CaptureDependencies } from './captureOrchestrator'
