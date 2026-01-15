/**
 * Journey Tests: Split Meeting Notes
 * Tests the complete user journey J-SPLIT-001
 */

import { MindSplit } from '../../lib/mindsplit'

describe('Journey: J-SPLIT-001 - Split Meeting Notes', () => {
  const sampleNotes = `
We need to fix the login bug by Friday.
The dashboard redesign mockups are ready for review.
Q2 roadmap planning meeting is next Tuesday.
Auth tokens are expiring too quickly - related to login bug.
Dashboard should use the new design system colors.
Roadmap should include the auth overhaul.
`.trim()

  let mindsplit: MindSplit

  beforeEach(() => {
    mindsplit = new MindSplit()
  })

  it('Step 1-5: Complete split flow', async () => {
    const result = await mindsplit.split(sampleNotes, 3)

    // Verify all chunks accounted for
    const totalChunks = result.workstreams.reduce(
      (sum, ws) => sum + ws.chunks.length,
      0
    )
    expect(totalChunks).toBe(result.stats.totalChunks)

    // Verify we got at least 1 workstream (min-cut may not split if graph is sparse)
    expect(result.workstreams.length).toBeGreaterThanOrEqual(1)
    // And at most the requested number
    expect(result.workstreams.length).toBeLessThanOrEqual(3)

    // Verify each workstream has content
    for (const ws of result.workstreams) {
      expect(ws.chunks.length).toBeGreaterThan(0)
      expect(ws.id).toBeDefined()
      expect(ws.name).toBeDefined()
    }
  })

  it('Acceptance: All input chunks in exactly one workstream', async () => {
    const result = await mindsplit.split(sampleNotes, 3)

    // Collect all chunk IDs from workstreams
    const seenIds = new Set<string>()
    for (const ws of result.workstreams) {
      for (const chunk of ws.chunks) {
        // Check no duplicates
        expect(seenIds.has(chunk.id)).toBe(false)
        seenIds.add(chunk.id)
      }
    }

    // Check all chunks accounted for
    expect(seenIds.size).toBe(result.stats.totalChunks)
  })

  it('Acceptance: Cut edges are reported', async () => {
    const result = await mindsplit.split(sampleNotes, 3)

    // Cut edges should be defined
    expect(result.cutResult.cutEdges).toBeDefined()
    expect(Array.isArray(result.cutResult.cutEdges)).toBe(true)

    // Each workstream should have bleeding edges info
    for (const ws of result.workstreams) {
      expect(ws.bleedingEdges).toBeDefined()
      expect(Array.isArray(ws.bleedingEdges)).toBe(true)
    }
  })

  it('Acceptance: Deterministic output (ARCH-003)', async () => {
    // Run twice with same input
    const result1 = await mindsplit.split(sampleNotes, 3)

    // Create fresh instance but same seed
    const mindsplit2 = new MindSplit(undefined, undefined, { seed: 42 })
    const result2 = await mindsplit2.split(sampleNotes, 3)

    // Results should be identical
    expect(result1.workstreams.length).toBe(result2.workstreams.length)

    for (let i = 0; i < result1.workstreams.length; i++) {
      const ws1 = result1.workstreams[i]
      const ws2 = result2.workstreams[i]

      expect(ws1.chunks.map((c) => c.id).sort()).toEqual(
        ws2.chunks.map((c) => c.id).sort()
      )
    }
  })

  it('Acceptance: No chunk lost', async () => {
    const result = await mindsplit.split(sampleNotes, 3)

    // All chunk IDs from input should exist in output
    const outputIds = new Set<string>()
    for (const ws of result.workstreams) {
      for (const chunk of ws.chunks) {
        outputIds.add(chunk.id)
      }
    }

    // Should have the expected number of chunks
    expect(outputIds.size).toBe(result.stats.totalChunks)
  })
})

describe('Journey: J-SPLIT-002 - Incremental Add', () => {
  it('Reuses cached embeddings', async () => {
    const mindsplit = new MindSplit()

    const initialNotes = `
Fix the login bug.
Review dashboard mockups.
`.trim()

    const newNotes = `
Plan Q2 roadmap.
`.trim()

    // Initial split
    const result1 = await mindsplit.split(initialNotes, 2)

    // Add new content
    const result2 = await mindsplit.addAndResplit(result1.sessionId, newNotes, 3)

    // Stats should show cached embeddings
    expect(result2.stats.cachedEmbeddings).toBe(result1.stats.totalChunks)
    expect(result2.stats.newChunks).toBe(1)
  })
})

describe('Journey: J-SPLIT-003 - Bleeding Edges Report', () => {
  it('Reports connections between workstreams', async () => {
    const mindsplit = new MindSplit()

    const notes = `
Fix the auth bug quickly.
Dashboard needs new colors.
Roadmap includes auth work.
`.trim()

    const result = await mindsplit.split(notes, 2)
    const report = await mindsplit.getBleedingReport(result.sessionId)

    expect(report.sessionId).toBe(result.sessionId)
    expect(report.totalBleedingEdges).toBeDefined()
    expect(report.connections).toBeDefined()
    expect(Array.isArray(report.connections)).toBe(true)
  })
})
