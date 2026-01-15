/**
 * Graph operations for MindSplit
 * FEAT-003: Build weighted similarity graph
 *
 * ARCH-001: All functions are PURE - no side effects
 */

import { Graph, Edge } from './types'

/**
 * Compute cosine similarity between two vectors
 * ARCH-001: Pure function
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same dimension')
  }

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB)
  if (magnitude === 0) return 0

  return dotProduct / magnitude
}

/**
 * Build similarity graph from embeddings
 *
 * FEAT-003: Weighted edges based on cosine similarity
 * FEAT-003: Filter by similarity threshold
 * ARCH-001: Pure function
 */
export function buildSimilarityGraph(
  embeddings: Map<string, number[]>,
  threshold: number = 0.3
): Graph {
  const nodes = [...embeddings.keys()]
  const edges: Edge[] = []

  // Compare all pairs (upper triangle to avoid duplicates)
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const id1 = nodes[i]
      const id2 = nodes[j]
      const vec1 = embeddings.get(id1)!
      const vec2 = embeddings.get(id2)!

      const similarity = cosineSimilarity(vec1, vec2)

      // FEAT-003: Only create edges above threshold
      if (similarity >= threshold) {
        edges.push({
          source: id1,
          target: id2,
          weight: similarity
        })
      }
    }
  }

  return { nodes, edges }
}

/**
 * Get edges connected to a node
 * ARCH-001: Pure function
 */
export function getNodeEdges(graph: Graph, nodeId: string): Edge[] {
  return graph.edges.filter(
    (e) => e.source === nodeId || e.target === nodeId
  )
}

/**
 * Get neighbors of a node
 * ARCH-001: Pure function
 */
export function getNeighbors(graph: Graph, nodeId: string): string[] {
  const neighbors = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.source === nodeId) neighbors.add(edge.target)
    if (edge.target === nodeId) neighbors.add(edge.source)
  }
  return [...neighbors]
}

/**
 * Contract two nodes into one (for Karger's algorithm)
 * Returns new graph with merged node
 *
 * ARCH-001: Pure function - returns NEW graph
 */
export function contractNodes(
  graph: Graph,
  nodeA: string,
  nodeB: string
): Graph {
  const mergedId = `${nodeA}+${nodeB}`

  // New nodes: remove A and B, add merged
  const nodes = graph.nodes
    .filter((n) => n !== nodeA && n !== nodeB)
    .concat(mergedId)

  // Update edges
  const edges: Edge[] = []
  for (const edge of graph.edges) {
    // Skip self-loops (edges between A and B)
    if (
      (edge.source === nodeA && edge.target === nodeB) ||
      (edge.source === nodeB && edge.target === nodeA)
    ) {
      continue
    }

    // Redirect edges to merged node
    let source = edge.source
    let target = edge.target

    if (source === nodeA || source === nodeB) source = mergedId
    if (target === nodeA || target === nodeB) target = mergedId

    // Skip self-loops created by merge
    if (source === target) continue

    edges.push({ source, target, weight: edge.weight })
  }

  return { nodes, edges }
}

/**
 * Get connected components of a graph
 * ARCH-001: Pure function
 */
export function getConnectedComponents(graph: Graph): string[][] {
  const visited = new Set<string>()
  const components: string[][] = []

  for (const node of graph.nodes) {
    if (visited.has(node)) continue

    const component: string[] = []
    const stack = [node]

    while (stack.length > 0) {
      const current = stack.pop()!
      if (visited.has(current)) continue

      visited.add(current)
      component.push(current)

      for (const neighbor of getNeighbors(graph, current)) {
        if (!visited.has(neighbor)) {
          stack.push(neighbor)
        }
      }
    }

    components.push(component)
  }

  return components
}

/**
 * Calculate total edge weight
 * ARCH-001: Pure function
 */
export function totalWeight(edges: Edge[]): number {
  return edges.reduce((sum, e) => sum + e.weight, 0)
}
