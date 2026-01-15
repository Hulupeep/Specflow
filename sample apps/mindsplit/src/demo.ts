/**
 * MindSplit Demo
 * Shows the full flow from chaotic notes to clean workstreams
 */

import { MindSplit } from './lib/mindsplit'

const SAMPLE_MEETING_NOTES = `
We need to fix the login bug by Friday - users are getting logged out randomly.

The dashboard redesign mockups are ready for review. Sarah put them in Figma.

Q2 roadmap planning meeting is next Tuesday at 2pm. Everyone should bring their top 3 priorities.

Auth tokens are expiring too quickly - this is related to the login bug. We should extend TTL to 24 hours.

Dashboard should use the new design system colors. The current purple doesn't match our brand anymore.

Roadmap should include the auth overhaul - we've been putting this off for too long.

Mobile app performance is getting complaints. Need to profile the feed loading.

The design system documentation needs updating before new hires start.

Feed optimization might need backend changes too - check with the API team.

New hire onboarding starts March 1st - make sure docs are ready.
`.trim()

async function main() {
  console.log('═'.repeat(60))
  console.log('  MindSplit Demo - Graph Min-Cut for Idea Separation')
  console.log('═'.repeat(60))
  console.log()

  console.log('📝 INPUT: Chaotic meeting notes')
  console.log('─'.repeat(60))
  console.log(SAMPLE_MEETING_NOTES)
  console.log()

  const mindsplit = new MindSplit()

  console.log('🔄 Processing...')
  console.log('  1. Parsing into semantic chunks')
  console.log('  2. Generating embeddings')
  console.log('  3. Building similarity graph')
  console.log('  4. Running min-cut algorithm')
  console.log()

  const result = await mindsplit.split(SAMPLE_MEETING_NOTES, 3)

  console.log('📊 STATS')
  console.log('─'.repeat(60))
  console.log(`  Total chunks:   ${result.stats.totalChunks}`)
  console.log(`  Graph edges:    ${result.stats.totalEdges}`)
  console.log(`  Cut edges:      ${result.stats.cutEdges}`)
  console.log(`  Cut weight:     ${result.stats.cutWeight.toFixed(3)}`)
  console.log()

  console.log('═'.repeat(60))
  console.log('  OUTPUT: Cleanly Separated Workstreams')
  console.log('═'.repeat(60))
  console.log()

  for (const ws of result.workstreams) {
    console.log(`\n🏷️  ${ws.name.toUpperCase()} (${ws.id})`)
    console.log('─'.repeat(60))

    for (const chunk of ws.chunks) {
      console.log(`  • ${chunk.text}`)
    }

    if (ws.bleedingEdges.length > 0) {
      console.log()
      console.log(`  ⚠️  Bleeding edges (${ws.bleedingEdges.length}):`)
      for (const be of ws.bleedingEdges.slice(0, 3)) {
        console.log(`     ↔ Connected to ${be.connectedTo}`)
        console.log(`       "${be.sourceChunk.text.slice(0, 50)}..."`)
      }
    }
  }

  console.log()
  console.log('═'.repeat(60))
  console.log('  Bleeding Edges Report (Cross-Stream Dependencies)')
  console.log('═'.repeat(60))
  console.log()

  const report = await mindsplit.getBleedingReport(result.sessionId)

  if (report.connections.length === 0) {
    console.log('  No bleeding edges - workstreams are completely independent!')
  } else {
    for (const conn of report.connections) {
      console.log(
        `  Workstream ${conn.workstream1} ↔ Workstream ${conn.workstream2}:`
      )
      for (const e of conn.edges) {
        console.log(`    • "${e.sourceChunk.text.slice(0, 40)}..."`)
        console.log(`      ↔ "${e.targetChunk.text.slice(0, 40)}..."`)
        console.log(`      (similarity: ${e.edge.weight.toFixed(3)})`)
      }
      console.log()
    }
  }

  console.log()
  console.log('✅ Done! The min-cut found the minimum shared context')
  console.log('   between workstreams. Assign each stream to different')
  console.log('   teams - bleeding edges show where coordination is needed.')
  console.log()
}

main().catch(console.error)
