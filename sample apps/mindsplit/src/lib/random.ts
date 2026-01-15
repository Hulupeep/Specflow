/**
 * Seeded random number generator for ARCH-003 compliance
 * Ensures deterministic results for same input
 */

import { SeededRNG } from './types'
import { createHash } from 'crypto'

/**
 * Create a seeded random number generator
 * Uses mulberry32 algorithm for fast, deterministic PRNG
 *
 * ARCH-003: All randomness must be seeded for determinism
 */
export function createSeededRandom(seed: number): SeededRNG {
  let state = seed >>> 0

  const rng = function (): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  } as SeededRNG

  rng.seed = seed
  return rng
}

/**
 * Generate deterministic ID from content hash
 * ARCH-003: UUIDs must be content-based, not random
 */
export function deterministicId(content: string, prefix: string = 'chunk'): string {
  const hash = createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 12)
  return `${prefix}_${hash}`
}

/**
 * Shuffle array in place using seeded random
 * ARCH-003: Deterministic shuffling
 */
export function seededShuffle<T>(array: T[], rng: SeededRNG): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

/**
 * Pick random element from array using seeded random
 * ARCH-003: Deterministic selection
 */
export function seededPick<T>(array: T[], rng: SeededRNG): T {
  const index = Math.floor(rng() * array.length)
  return array[index]
}
