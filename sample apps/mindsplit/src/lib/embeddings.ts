/**
 * Embedding Generation with Ruvector Caching
 * FEAT-002: Generate and cache embeddings
 * ARCH-002: Never compute same embedding twice
 */

import { Chunk } from './types'
import { RuvectorMemory, getCachedEmbedding, storeEmbeddings } from './memory'

/**
 * Embedding model interface
 * Allows swapping between different embedding providers
 */
export interface EmbeddingModel {
  embed(text: string): Promise<number[]>
  dimension: number
}

/**
 * Simple TF-IDF-like embedding for demo purposes
 * In production, use OpenAI, Cohere, or local models
 */
export class SimpleEmbedding implements EmbeddingModel {
  dimension = 128
  private vocabulary = new Map<string, number>()

  async embed(text: string): Promise<number[]> {
    const tokens = this.tokenize(text)
    const vector = new Array(this.dimension).fill(0)

    for (const token of tokens) {
      // Get or create vocabulary index
      if (!this.vocabulary.has(token)) {
        this.vocabulary.set(token, this.vocabulary.size)
      }

      // Simple hash-based feature extraction
      const idx = this.hashToIndex(token)
      vector[idx] += 1
    }

    // L2 normalize
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0))
    if (norm > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= norm
      }
    }

    return vector
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 2)
  }

  private hashToIndex(token: string): number {
    let hash = 0
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) % this.dimension
    }
    return hash
  }
}

/**
 * Get embeddings for chunks with caching
 *
 * FEAT-002: Use ruvector for storage
 * ARCH-002: Check cache first, store after
 */
export async function getChunkEmbeddings(
  chunks: Chunk[],
  memory: RuvectorMemory,
  model: EmbeddingModel
): Promise<Map<string, number[]>> {
  const embeddings = new Map<string, number[]>()
  const toCompute: Chunk[] = []

  // ARCH-002: Check cache first
  for (const chunk of chunks) {
    const cached = await getCachedEmbedding(memory, chunk.id)
    if (cached) {
      embeddings.set(chunk.id, cached)
    } else {
      toCompute.push(chunk)
    }
  }

  // Compute missing embeddings
  const newEmbeddings = new Map<string, number[]>()
  for (const chunk of toCompute) {
    const embedding = await model.embed(chunk.text)
    embeddings.set(chunk.id, embedding)
    newEmbeddings.set(chunk.id, embedding)
  }

  // ARCH-002: Store computed embeddings in cache
  if (newEmbeddings.size > 0) {
    await storeEmbeddings(memory, newEmbeddings)
  }

  return embeddings
}

/**
 * Compute similarity between two chunk embeddings
 * ARCH-001: Pure function
 */
export function embeddingSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match')
  }

  let dot = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
  }

  // Vectors are already normalized, so dot product = cosine similarity
  return dot
}
