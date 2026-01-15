/**
 * Ruvector Memory Integration
 * ARCH-002: All embeddings cached in ruvector
 * ARCH-004: Atomic memory operations
 */

import { Chunk, Session } from './types'
import { createHash } from 'crypto'

/**
 * Memory interface for ruvector
 * Abstracts the storage layer for testability
 */
export interface RuvectorMemory {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T): Promise<void>
  batch(ops: BatchOp[]): Promise<void>
  has(key: string): Promise<boolean>
  delete(key: string): Promise<void>
  search(query: number[], topK: number): Promise<SearchResult[]>
}

export interface BatchOp {
  op: 'set' | 'delete'
  key: string
  value?: unknown
}

export interface SearchResult {
  key: string
  score: number
  value: unknown
}

/**
 * In-memory implementation of RuvectorMemory
 * For local development and testing
 */
export class InMemoryRuvector implements RuvectorMemory {
  private store = new Map<string, unknown>()
  private embeddings = new Map<string, number[]>()

  async get<T>(key: string): Promise<T | null> {
    const value = this.store.get(key)
    return value !== undefined ? (value as T) : null
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value)
    // If it's an embedding, store separately for search
    if (Array.isArray(value) && typeof value[0] === 'number') {
      this.embeddings.set(key, value as unknown as number[])
    }
  }

  // ARCH-004: Atomic batch operations
  async batch(ops: BatchOp[]): Promise<void> {
    // All or nothing - simulate atomic operation
    const backup = new Map(this.store)
    try {
      for (const op of ops) {
        if (op.op === 'set') {
          this.store.set(op.key, op.value)
        } else if (op.op === 'delete') {
          this.store.delete(op.key)
        }
      }
    } catch (error) {
      // Rollback on failure
      this.store = backup
      throw error
    }
  }

  async has(key: string): Promise<boolean> {
    return this.store.has(key)
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key)
    this.embeddings.delete(key)
  }

  async search(query: number[], topK: number): Promise<SearchResult[]> {
    const results: SearchResult[] = []

    for (const [key, embedding] of this.embeddings) {
      const score = cosineSim(query, embedding)
      results.push({ key, score, value: this.store.get(key) })
    }

    return results.sort((a, b) => b.score - a.score).slice(0, topK)
  }
}

/**
 * Simple cosine similarity for search
 */
function cosineSim(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Generate cache key for embedding
 * ARCH-002: Cache key = hash of text content
 */
export function embeddingCacheKey(text: string): string {
  const hash = createHash('sha256').update(text).digest('hex').slice(0, 16)
  return `embed:${hash}`
}

/**
 * Store session atomically
 * ARCH-004: All chunks stored or none
 */
export async function storeSession(
  memory: RuvectorMemory,
  session: Session
): Promise<void> {
  const ops: BatchOp[] = [
    { op: 'set', key: `session:${session.id}`, value: session },
    ...session.chunks.map((chunk) => ({
      op: 'set' as const,
      key: `chunk:${session.id}:${chunk.id}`,
      value: chunk
    }))
  ]

  // ARCH-004: Atomic batch operation
  await memory.batch(ops)
}

/**
 * Retrieve session
 */
export async function getSession(
  memory: RuvectorMemory,
  sessionId: string
): Promise<Session | null> {
  return memory.get<Session>(`session:${sessionId}`)
}

/**
 * Store embeddings atomically
 * ARCH-002: Cache embeddings
 * ARCH-004: Atomic operation
 */
export async function storeEmbeddings(
  memory: RuvectorMemory,
  embeddings: Map<string, number[]>
): Promise<void> {
  const ops: BatchOp[] = []

  for (const [id, embedding] of embeddings) {
    ops.push({ op: 'set', key: `embed:${id}`, value: embedding })
  }

  // ARCH-004: Atomic batch operation
  await memory.batch(ops)
}

/**
 * Get cached embedding or null
 * ARCH-002: Check cache before computing
 */
export async function getCachedEmbedding(
  memory: RuvectorMemory,
  chunkId: string
): Promise<number[] | null> {
  return memory.get<number[]>(`embed:${chunkId}`)
}
