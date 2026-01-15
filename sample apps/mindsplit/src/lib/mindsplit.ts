/**
 * MindSplit - Main Orchestrator
 *
 * Takes chaotic text → produces cleanly separated workstreams
 * using semantic similarity graph + min-cut algorithm
 */

import {
  Chunk,
  Graph,
  MinCutResult,
  Workstream,
  BleedingEdge,
  MindSplitConfig,
  Session,
  DEFAULT_CONFIG
} from './types'
import { parseToChunks, getChunkById } from './parser'
import { buildSimilarityGraph } from './graph'
import { minCutNWay, findBleedingEdges } from './mincut'
import { getChunkEmbeddings, SimpleEmbedding, EmbeddingModel } from './embeddings'
import {
  RuvectorMemory,
  InMemoryRuvector,
  storeSession,
  getSession
} from './memory'
import { deterministicId } from './random'

/**
 * MindSplit instance
 * Manages the full pipeline from text to workstreams
 */
export class MindSplit {
  private memory: RuvectorMemory
  private model: EmbeddingModel
  private config: MindSplitConfig

  constructor(
    memory?: RuvectorMemory,
    model?: EmbeddingModel,
    config?: Partial<MindSplitConfig>
  ) {
    this.memory = memory || new InMemoryRuvector()
    this.model = model || new SimpleEmbedding()
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Split text into N workstreams
   *
   * J-SPLIT-001: Main user journey
   * Returns cleanly separated workstreams with bleeding edges
   */
  async split(text: string, numStreams: number): Promise<SplitResult> {
    // FEAT-001: Parse into chunks
    const chunks = parseToChunks(text, this.config.chunkMethod)

    // FEAT-002: Get embeddings (with caching)
    const embeddings = await getChunkEmbeddings(chunks, this.memory, this.model)

    // FEAT-003: Build similarity graph
    const graph = buildSimilarityGraph(embeddings, this.config.similarityThreshold)

    // FEAT-004: Run min-cut
    const cutResult = minCutNWay(graph, numStreams, this.config.seed)

    // FEAT-005: Format as workstreams
    const workstreams = this.formatWorkstreams(chunks, graph, cutResult)

    // Create session for incremental operations
    const session: Session = {
      id: deterministicId(text, 'session'),
      chunks,
      embeddings,
      lastResult: cutResult,
      createdAt: Date.now()
    }
    await storeSession(this.memory, session)

    return {
      sessionId: session.id,
      workstreams,
      graph,
      cutResult,
      stats: {
        totalChunks: chunks.length,
        totalEdges: graph.edges.length,
        cutEdges: cutResult.cutEdges.length,
        cutWeight: cutResult.cutWeight
      }
    }
  }

  /**
   * Add content to existing session and re-split
   *
   * J-SPLIT-002: Incremental add
   * Reuses cached embeddings for existing chunks
   */
  async addAndResplit(
    sessionId: string,
    newText: string,
    numStreams: number
  ): Promise<SplitResult> {
    const existing = await getSession(this.memory, sessionId)
    if (!existing) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Parse new chunks
    const newChunks = parseToChunks(newText, this.config.chunkMethod)

    // Combine with existing (deduped by ID)
    const existingIds = new Set(existing.chunks.map((c) => c.id))
    const uniqueNewChunks = newChunks.filter((c) => !existingIds.has(c.id))
    const allChunks = [...existing.chunks, ...uniqueNewChunks]

    // Get embeddings - existing ones come from cache (ARCH-002)
    const embeddings = await getChunkEmbeddings(allChunks, this.memory, this.model)

    // Rebuild graph and re-cut
    const graph = buildSimilarityGraph(embeddings, this.config.similarityThreshold)
    const cutResult = minCutNWay(graph, numStreams, this.config.seed)
    const workstreams = this.formatWorkstreams(allChunks, graph, cutResult)

    // Update session
    const updatedSession: Session = {
      ...existing,
      chunks: allChunks,
      embeddings,
      lastResult: cutResult
    }
    await storeSession(this.memory, updatedSession)

    return {
      sessionId,
      workstreams,
      graph,
      cutResult,
      stats: {
        totalChunks: allChunks.length,
        totalEdges: graph.edges.length,
        cutEdges: cutResult.cutEdges.length,
        cutWeight: cutResult.cutWeight,
        newChunks: uniqueNewChunks.length,
        cachedEmbeddings: existing.chunks.length
      }
    }
  }

  /**
   * Get bleeding edges report
   *
   * J-SPLIT-003: Explore what connects workstreams
   */
  async getBleedingReport(sessionId: string): Promise<BleedingReport> {
    const session = await getSession(this.memory, sessionId)
    if (!session || !session.lastResult) {
      throw new Error(`Session not found or no result: ${sessionId}`)
    }

    const bleedingMap = findBleedingEdges(
      {
        nodes: session.chunks.map((c) => c.id),
        edges: session.lastResult.cutEdges
      },
      session.lastResult.partitions
    )

    const connections: BleedingConnection[] = []

    for (const [key, edges] of bleedingMap) {
      const [p1, p2] = key.split('-').map(Number)
      connections.push({
        workstream1: p1,
        workstream2: p2,
        edges: edges.map((e) => ({
          edge: e,
          sourceChunk: getChunkById(session.chunks, e.source)!,
          targetChunk: getChunkById(session.chunks, e.target)!
        }))
      })
    }

    return {
      sessionId,
      totalBleedingEdges: session.lastResult.cutEdges.length,
      totalCutWeight: session.lastResult.cutWeight,
      connections
    }
  }

  /**
   * Format min-cut result as workstreams
   * FEAT-005: Structured output with bleeding edges
   */
  private formatWorkstreams(
    chunks: Chunk[],
    graph: Graph,
    cutResult: MinCutResult
  ): Workstream[] {
    const chunkMap = new Map(chunks.map((c) => [c.id, c]))
    const partitionIndex = new Map<string, number>()
    cutResult.partitions.forEach((p, i) => p.forEach((id) => partitionIndex.set(id, i)))

    return cutResult.partitions.map((partition, index) => {
      const streamChunks = partition
        .map((id) => chunkMap.get(id))
        .filter((c): c is Chunk => c !== undefined)
        .sort((a, b) => a.sourceIndex - b.sourceIndex)

      // Find bleeding edges for this workstream
      const bleedingEdges: BleedingEdge[] = []
      for (const edge of cutResult.cutEdges) {
        const sourcePartition = partitionIndex.get(edge.source)
        const targetPartition = partitionIndex.get(edge.target)

        if (sourcePartition === index || targetPartition === index) {
          const connectedTo =
            sourcePartition === index ? targetPartition! : sourcePartition!
          bleedingEdges.push({
            edge,
            connectedTo: `workstream-${connectedTo}`,
            sourceChunk: chunkMap.get(edge.source)!,
            targetChunk: chunkMap.get(edge.target)!
          })
        }
      }

      return {
        id: `workstream-${index}`,
        name: this.generateWorkstreamName(streamChunks),
        chunks: streamChunks,
        bleedingEdges
      }
    })
  }

  /**
   * Generate a name for workstream based on content
   * Simple heuristic: use most frequent meaningful words
   */
  private generateWorkstreamName(chunks: Chunk[]): string {
    const words = new Map<string, number>()
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'must', 'shall',
      'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at',
      'by', 'from', 'as', 'into', 'through', 'during', 'before',
      'after', 'above', 'below', 'between', 'under', 'again',
      'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'so',
      'yet', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
      'such', 'no', 'not', 'only', 'same', 'than', 'too', 'very',
      'just', 'also', 'now', 'we', 'i', 'you', 'they', 'it', 'this',
      'that', 'these', 'those'
    ])

    for (const chunk of chunks) {
      const tokens = chunk.text
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .split(/\s+/)
        .filter((t) => t.length > 3 && !stopWords.has(t))

      for (const token of tokens) {
        words.set(token, (words.get(token) || 0) + 1)
      }
    }

    const sorted = [...words.entries()].sort((a, b) => b[1] - a[1])
    const topWords = sorted.slice(0, 2).map(([word]) => word)

    if (topWords.length === 0) return 'Workstream'
    return topWords.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  }
}

// Result types
export interface SplitResult {
  sessionId: string
  workstreams: Workstream[]
  graph: Graph
  cutResult: MinCutResult
  stats: {
    totalChunks: number
    totalEdges: number
    cutEdges: number
    cutWeight: number
    newChunks?: number
    cachedEmbeddings?: number
  }
}

export interface BleedingReport {
  sessionId: string
  totalBleedingEdges: number
  totalCutWeight: number
  connections: BleedingConnection[]
}

export interface BleedingConnection {
  workstream1: number
  workstream2: number
  edges: {
    edge: { source: string; target: string; weight: number }
    sourceChunk: Chunk
    targetChunk: Chunk
  }[]
}
