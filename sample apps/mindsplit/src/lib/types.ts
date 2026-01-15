/**
 * Core types for MindSplit
 * All types are defined here to ensure consistency across modules
 */

// FEAT-001: Chunk with unique ID
export interface Chunk {
  id: string
  text: string
  sourceIndex: number
}

// FEAT-003: Weighted edge for similarity graph
export interface Edge {
  source: string
  target: string
  weight: number // Cosine similarity [0, 1]
}

// FEAT-003: Graph structure
export interface Graph {
  nodes: string[]
  edges: Edge[]
}

// FEAT-004: Min-cut result
export interface MinCutResult {
  partitions: string[][] // Node IDs grouped by partition
  cutEdges: Edge[] // Edges that were cut (bleeding edges)
  cutWeight: number // Total weight of cut edges
}

// FEAT-005: Workstream output
export interface Workstream {
  id: string
  name: string
  chunks: Chunk[]
  bleedingEdges: BleedingEdge[]
}

export interface BleedingEdge {
  edge: Edge
  connectedTo: string // Other workstream ID
  sourceChunk: Chunk
  targetChunk: Chunk
}

// ARCH-003: Seeded random number generator
export interface SeededRNG {
  (): number
  seed: number
}

// Session for incremental operations
export interface Session {
  id: string
  chunks: Chunk[]
  embeddings: Map<string, number[]>
  lastResult?: MinCutResult
  createdAt: number
}

// Configuration
export interface MindSplitConfig {
  similarityThreshold: number // Default: 0.3
  seed: number // For deterministic results
  chunkMethod: 'paragraph' | 'bullet' | 'sentence'
}

export const DEFAULT_CONFIG: MindSplitConfig = {
  similarityThreshold: 0.3,
  seed: 42,
  chunkMethod: 'paragraph'
}
