/**
 * Text parser for MindSplit
 * FEAT-001: Parse input into semantic chunks with unique IDs
 *
 * ARCH-001: Pure function - no side effects
 */

import { Chunk, MindSplitConfig } from './types'
import { deterministicId } from './random'

/**
 * Parse text into semantic chunks
 *
 * FEAT-001: Each chunk gets unique ID
 * ARCH-001: Pure function, no side effects
 */
export function parseToChunks(
  text: string,
  method: MindSplitConfig['chunkMethod'] = 'paragraph'
): Chunk[] {
  const lines = text.trim().split('\n')
  const chunks: Chunk[] = []
  let currentChunk = ''
  let sourceIndex = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()

    if (shouldStartNewChunk(line, currentChunk, method)) {
      if (currentChunk.trim()) {
        chunks.push(createChunk(currentChunk.trim(), sourceIndex))
        sourceIndex++
      }
      currentChunk = line
    } else {
      currentChunk += (currentChunk ? '\n' : '') + line
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk.trim(), sourceIndex))
  }

  return chunks
}

/**
 * Determine if we should start a new chunk
 * Handles paragraph, bullet, and sentence boundaries
 */
function shouldStartNewChunk(
  line: string,
  currentChunk: string,
  method: MindSplitConfig['chunkMethod']
): boolean {
  if (!currentChunk) return true

  switch (method) {
    case 'paragraph':
      // New paragraph on empty line or significant indent change
      return line === '' || /^[-*•]\s/.test(line)

    case 'bullet':
      // Each bullet point is its own chunk
      return /^[-*•]\s/.test(line) || /^\d+\.\s/.test(line)

    case 'sentence':
      // New chunk when previous ends with sentence-ending punctuation
      return /[.!?]\s*$/.test(currentChunk)

    default:
      return false
  }
}

/**
 * Create a chunk with deterministic ID
 * FEAT-001: Unique ID per chunk
 * ARCH-003: ID is content-based (deterministic)
 */
function createChunk(text: string, sourceIndex: number): Chunk {
  return {
    id: deterministicId(text, 'chunk'),
    text,
    sourceIndex
  }
}

/**
 * Merge chunks back into text (for verification)
 * ARCH-001: Pure function
 */
export function chunksToText(chunks: Chunk[]): string {
  return chunks
    .sort((a, b) => a.sourceIndex - b.sourceIndex)
    .map((c) => c.text)
    .join('\n\n')
}

/**
 * Get chunk by ID from array
 * ARCH-001: Pure function
 */
export function getChunkById(chunks: Chunk[], id: string): Chunk | undefined {
  return chunks.find((c) => c.id === id)
}
