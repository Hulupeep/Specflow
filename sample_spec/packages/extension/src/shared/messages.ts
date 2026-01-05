/**
 * Message types for extension communication
 * Contract: SEC-002 - PAT never sent in messages to content scripts
 */

import type { SourceType, CaptureResult } from '@chat2repo/core'

// Message types
export type MessageType =
  | 'get-config-status'
  | 'get-repo-configs'
  | 'perform-capture'
  | 'quick-capture'
  | 'get-quick-send-defaults'
  | 'save-quick-send-defaults'

// Request payloads (content script → background)
export interface GetConfigStatusRequest {
  type: 'get-config-status'
}

export interface GetRepoConfigsRequest {
  type: 'get-repo-configs'
}

export interface PerformCaptureRequest {
  type: 'perform-capture'
  payload: {
    repoId: string
    content: string
    topic: string
    tags: string[]
    source: SourceType
    sourceUrl: string
    sourceTitle: string
    pageContext?: string
  }
}

export interface QuickCaptureRequest {
  type: 'quick-capture'
  payload: {
    content: string
    source: SourceType
    sourceUrl: string
    sourceTitle: string
    pageContext?: string
  }
}

export interface GetQuickSendDefaultsRequest {
  type: 'get-quick-send-defaults'
}

export interface SaveQuickSendDefaultsRequest {
  type: 'save-quick-send-defaults'
  payload: {
    repoId: string
    tags: string[]
    dontAskAgain: boolean
  }
}

export type ExtensionRequest =
  | GetConfigStatusRequest
  | GetRepoConfigsRequest
  | PerformCaptureRequest
  | QuickCaptureRequest
  | GetQuickSendDefaultsRequest
  | SaveQuickSendDefaultsRequest

// Response payloads (background → content script)
// Contract: SEC-002 - Never include PAT in responses
export interface ConfigStatusResponse {
  configured: boolean
  hasToken: boolean
  hasRepos: boolean
  defaultRepo?: {
    owner: string
    repo: string
  }
}

export interface RepoConfigResponse {
  id: string
  label: string
  owner: string
  repo: string
  // Note: PAT is NOT included (SEC-002)
}

export interface GetRepoConfigsResponse {
  repos: RepoConfigResponse[]
  defaultRepoId?: string
}

export interface CaptureSuccessResponse {
  success: true
  result: CaptureResult
}

export interface CaptureErrorResponse {
  success: false
  error: string
  errorType: 'not_configured' | 'rate_limit' | 'network' | 'validation'
}

export type CaptureResponse = CaptureSuccessResponse | CaptureErrorResponse

export interface QuickSendDefaults {
  repoId: string
  tags: string[]
  dontAskAgain: boolean
}
