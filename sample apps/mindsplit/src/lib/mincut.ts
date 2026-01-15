/**
 * Min-Cut Algorithm Implementation
 * FEAT-004: Find optimal split points in similarity graph
 *
 * Uses Stoer-Wagner algorithm for minimum cut
 * Falls back to Karger's for large graphs
 *
 * ARCH-001: Pure functions only
 * ARCH-003: Deterministic via seeded random
 */

import { Graph, Edge, MinCutResult, SeededRNG } from './types'
import { createSeededRandom, seededPick } from './random'
import { contractNodes, totalWeight, getConnectedComponents } from './graph'

/**
 * Stoer-Wagner algorithm for minimum cut
 * O(VE + V² log V) - exact, deterministic
 *
 * ARCH-001: Pure function
 * ARCH-003: Deterministic (no randomness needed)
 */
export function stoerWagnerMinCut(graph: Graph): MinCutResult {
  if (graph.nodes.length < 2) {
    return {
      partitions: [graph.nodes],
      cutEdges: [],
      cutWeight: 0
    }
  }

  let bestCut: { nodes: string[]; weight: number } | null = null
  let workingGraph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] }

  // Track which original nodes are merged into which super-nodes
  const nodeMapping = new Map<string, string[]>()
  for (const node of graph.nodes) {
    nodeMapping.set(node, [node])
  }

  while (workingGraph.nodes.length > 1) {
    // Run minimum cut phase
    const { s, t, cutWeight } = minimumCutPhase(workingGraph)

    // Check if this is the best cut so far
    if (bestCut === null || cutWeight < bestCut.weight) {
      bestCut = {
        nodes: nodeMapping.get(t) || [t],
        weight: cutWeight
      }
    }

    // Merge s and t for next iteration
    const mergedId = `${s}+${t}`
    const mergedNodes = [
      ...(nodeMapping.get(s) || [s]),
      ...(nodeMapping.get(t) || [t])
    ]
    nodeMapping.delete(s)
    nodeMapping.delete(t)
    nodeMapping.set(mergedId, mergedNodes)

    workingGraph = contractNodes(workingGraph, s, t)
  }

  // Build result
  const cutSide = new Set(bestCut!.nodes)
  const partitionA = graph.nodes.filter((n) => cutSide.has(n))
  const partitionB = graph.nodes.filter((n) => !cutSide.has(n))

  const cutEdges = graph.edges.filter(
    (e) =>
      (cutSide.has(e.source) && !cutSide.has(e.target)) ||
      (!cutSide.has(e.source) && cutSide.has(e.target))
  )

  return {
    partitions: [partitionA, partitionB],
    cutEdges,
    cutWeight: totalWeight(cutEdges)
  }
}

/**
 * Single phase of Stoer-Wagner
 * Returns the last two nodes and the cut weight
 */
function minimumCutPhase(graph: Graph): { s: string; t: string; cutWeight: number } {
  const added = new Set<string>()
  const weights = new Map<string, number>()

  // Initialize weights
  for (const node of graph.nodes) {
    weights.set(node, 0)
  }

  let s = ''
  let t = ''
  let cutWeight = 0

  while (added.size < graph.nodes.length) {
    // Find node with maximum weight to added set
    let maxWeight = -Infinity
    let maxNode = ''

    for (const node of graph.nodes) {
      if (!added.has(node) && weights.get(node)! > maxWeight) {
        maxWeight = weights.get(node)!
        maxNode = node
      }
    }

    s = t
    t = maxNode
    cutWeight = maxWeight

    added.add(maxNode)

    // Update weights
    for (const edge of graph.edges) {
      if (edge.source === maxNode && !added.has(edge.target)) {
        weights.set(edge.target, weights.get(edge.target)! + edge.weight)
      }
      if (edge.target === maxNode && !added.has(edge.source)) {
        weights.set(edge.source, weights.get(edge.source)! + edge.weight)
      }
    }
  }

  return { s, t, cutWeight }
}

/**
 * Karger's randomized min-cut algorithm
 * O(V² E) - probabilistic, needs multiple runs
 *
 * ARCH-001: Pure function
 * ARCH-003: Deterministic via seeded random
 */
export function kargerMinCut(graph: Graph, seed: number): MinCutResult {
  const rng = createSeededRandom(seed)
  let workingGraph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] }

  // Contract until 2 nodes remain
  while (workingGraph.nodes.length > 2) {
    // Pick random edge
    if (workingGraph.edges.length === 0) break
    const edge = seededPick(workingGraph.edges, rng)
    workingGraph = contractNodes(workingGraph, edge.source, edge.target)
  }

  // The remaining edges are the cut
  // Extract original node IDs from merged super-nodes
  const partitions = workingGraph.nodes.map((superNode) =>
    superNode.split('+').filter((id) => graph.nodes.includes(id))
  )

  const partitionSet = new Set(partitions[0])
  const cutEdges = graph.edges.filter(
    (e) =>
      (partitionSet.has(e.source) && !partitionSet.has(e.target)) ||
      (!partitionSet.has(e.source) && partitionSet.has(e.target))
  )

  return {
    partitions,
    cutEdges,
    cutWeight: totalWeight(cutEdges)
  }
}

/**
 * N-way min-cut using recursive bisection
 *
 * FEAT-004: Split graph into N partitions
 * ARCH-001: Pure function
 * ARCH-003: Deterministic via seed
 */
export function minCutNWay(
  graph: Graph,
  n: number,
  seed: number
): MinCutResult {
  if (n <= 1 || graph.nodes.length <= 1) {
    return {
      partitions: [graph.nodes],
      cutEdges: [],
      cutWeight: 0
    }
  }

  if (n === 2) {
    // Base case: simple 2-way cut
    return stoerWagnerMinCut(graph)
  }

  // Recursive case: bisect, then recursively split larger partition
  const bisection = stoerWagnerMinCut(graph)

  // Sort partitions by size (split larger one first)
  const sorted = bisection.partitions.sort((a, b) => b.length - a.length)

  // Build subgraph for larger partition
  const largerSet = new Set(sorted[0])
  const subgraphEdges = graph.edges.filter(
    (e) => largerSet.has(e.source) && largerSet.has(e.target)
  )
  const subgraph: Graph = {
    nodes: sorted[0],
    edges: subgraphEdges
  }

  // Recursively split
  const subResult = minCutNWay(subgraph, n - 1, seed + 1)

  // Combine results
  const allPartitions = [...subResult.partitions, sorted[1]]
  const allCutEdges = [...bisection.cutEdges, ...subResult.cutEdges]

  return {
    partitions: allPartitions,
    cutEdges: allCutEdges,
    cutWeight: totalWeight(allCutEdges)
  }
}

/**
 * Find bleeding edges between specific partitions
 * ARCH-001: Pure function
 */
export function findBleedingEdges(
  graph: Graph,
  partitions: string[][]
): Map<string, Edge[]> {
  const partitionMap = new Map<string, number>()
  partitions.forEach((p, i) => p.forEach((n) => partitionMap.set(n, i)))

  const bleeding = new Map<string, Edge[]>()

  for (const edge of graph.edges) {
    const pSource = partitionMap.get(edge.source)
    const pTarget = partitionMap.get(edge.target)

    if (pSource !== undefined && pTarget !== undefined && pSource !== pTarget) {
      const key = `${Math.min(pSource, pTarget)}-${Math.max(pSource, pTarget)}`
      if (!bleeding.has(key)) {
        bleeding.set(key, [])
      }
      bleeding.get(key)!.push(edge)
    }
  }

  return bleeding
}
