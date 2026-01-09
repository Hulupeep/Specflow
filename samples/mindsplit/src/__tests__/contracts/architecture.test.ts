/**
 * Contract Tests: Architecture
 * Scans source code for ARCH-001 through ARCH-004 violations
 */

import * as fs from 'fs'
import * as path from 'path'

// Simple glob implementation for testing
function globSync(pattern: string, baseDir: string): string[] {
  const files: string[] = []

  function walk(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walk(fullPath)
      } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        files.push(fullPath)
      }
    }
  }

  walk(baseDir)
  return files
}

const LIB_DIR = path.join(__dirname, '../../lib')

describe('Contract: feature_architecture', () => {
  describe('ARCH-001: Graph functions are pure', () => {
    // Graph functions are in graph.ts and mincut.ts directly in lib/
    const graphFiles = [
      path.join(LIB_DIR, 'graph.ts'),
      path.join(LIB_DIR, 'mincut.ts')
    ].filter(f => fs.existsSync(f))

    it('No console output in graph/mincut functions', () => {
      const violations: string[] = []

      for (const file of graphFiles) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')
        if (/console\.(log|warn|error)/.test(content)) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-001\n` +
            `Graph functions must be pure - no console output:\n` +
            violations.map((f) => `  - ${f}`).join('\n')
        )
      }
    })

    it('No network calls in graph/mincut functions', () => {
      const violations: string[] = []

      for (const file of graphFiles) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')
        if (/fetch\(|axios\.|http\./.test(content)) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-001\n` +
            `Graph functions must be pure - no network calls:\n` +
            violations.map((f) => `  - ${f}`).join('\n')
        )
      }
    })

    it('No file I/O in graph/mincut functions', () => {
      const violations: string[] = []

      for (const file of graphFiles) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')
        if (/fs\.(read|write|append)/.test(content)) {
          violations.push(file)
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-001\n` +
            `Graph functions must be pure - no file I/O:\n` +
            violations.map((f) => `  - ${f}`).join('\n')
        )
      }
    })
  })

  describe('ARCH-002: Embeddings cached in ruvector', () => {
    it('Embedding functions check cache before computing', () => {
      const embeddingFile = path.join(LIB_DIR, 'embeddings.ts')
      if (!fs.existsSync(embeddingFile)) {
        throw new Error('embeddings.ts not found')
      }

      const content = fs.readFileSync(embeddingFile, 'utf-8')

      // Must have cache check
      if (!/getCachedEmbedding|cache\.(get|has)|ruvector\.(get|retrieve)/.test(content)) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-002\n` +
            `File: ${embeddingFile}\n` +
            `Issue: Must check cache before computing embeddings\n` +
            `Fix: Add cache lookup before embed() call`
        )
      }

      // Must store in cache
      if (!/storeEmbeddings|cache\.set|ruvector\.(set|store)/.test(content)) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-002\n` +
            `File: ${embeddingFile}\n` +
            `Issue: Must store computed embeddings in cache\n` +
            `Fix: Add cache storage after embed() call`
        )
      }
    })
  })

  describe('ARCH-003: Deterministic output', () => {
    it('No unseeded Math.random in mincut', () => {
      const mincutFile = path.join(LIB_DIR, 'mincut.ts')
      if (!fs.existsSync(mincutFile)) {
        throw new Error('mincut.ts not found')
      }

      const content = fs.readFileSync(mincutFile, 'utf-8')
      const lines = content.split('\n')

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        // Check for bare Math.random() without seed context
        if (/Math\.random\(\)/.test(line) && !/seed|rng|seeded/i.test(line)) {
          throw new Error(
            `CONTRACT VIOLATION: ARCH-003\n` +
              `File: ${mincutFile}:${i + 1}\n` +
              `Issue: Math.random() without seed breaks determinism\n` +
              `Code: ${line.trim()}\n` +
              `Fix: Use createSeededRandom(seed) instead`
          )
        }
      }
    })

    it('Uses seeded random for randomized algorithms', () => {
      const mincutFile = path.join(LIB_DIR, 'mincut.ts')
      if (!fs.existsSync(mincutFile)) return

      const content = fs.readFileSync(mincutFile, 'utf-8')

      // If karger is implemented, it must use seeded random
      if (/karger/i.test(content) && !/createSeededRandom|seed.*number/.test(content)) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-003\n` +
            `File: ${mincutFile}\n` +
            `Issue: Karger's algorithm must use seeded random\n` +
            `Fix: Pass seed parameter and use createSeededRandom()`
        )
      }
    })
  })

  describe('ARCH-004: Atomic memory operations', () => {
    it('Memory operations use batch/transaction', () => {
      const memoryFile = path.join(LIB_DIR, 'memory.ts')
      if (!fs.existsSync(memoryFile)) {
        throw new Error('memory.ts not found')
      }

      const content = fs.readFileSync(memoryFile, 'utf-8')

      // Must have batch operation
      if (!/batch|transaction|atomic/i.test(content)) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-004\n` +
            `File: ${memoryFile}\n` +
            `Issue: Must support atomic batch operations\n` +
            `Fix: Implement batch() method for atomic writes`
        )
      }
    })

    it('No await in loop for storage operations', () => {
      const memoryFile = path.join(LIB_DIR, 'memory.ts')
      if (!fs.existsSync(memoryFile)) return

      const content = fs.readFileSync(memoryFile, 'utf-8')

      // Check for dangerous pattern: for loop with await store inside
      if (/for\s*\([^)]*\)\s*\{[^}]*await[^}]*\.(set|store|save)[^}]*\}/s.test(content)) {
        throw new Error(
          `CONTRACT VIOLATION: ARCH-004\n` +
            `File: ${memoryFile}\n` +
            `Issue: Await in loop breaks atomicity\n` +
            `Fix: Use batch() operation instead`
        )
      }
    })
  })
})
