#!/usr/bin/env node
/**
 * verify-seams.cjs — seam-lite: compute integration seams from per-ticket surface declarations
 * (pipeline-hardening #61). Sibling of verify-ticket-journey.cjs; does NOT fork verify-graph.cjs.
 *
 * Epics slice vertically; coherence bugs live horizontally where slices share a surface. This
 * computes those seams mechanically so GATE D's walk hops are DERIVED, not remembered, and a
 * later seam failure names its owning slices.
 *
 * A "surface" is a route literal or a data-testid value, EXACTLY as it appears in code. Each
 * ticket declares which surfaces it `writes` and which it `reads`. A seam is a pair of slices
 * that touch the same surface where ≥1 writes it:
 *   - writer × writer  (both change it — classic collision, e.g. #681↔#686 on /my-leave)
 *   - writer × reader  (one changes what another depends on — rename/shape break)
 *
 * Honesty rule: every declared surface MUST resolve in the repo (grep). A surface that matches
 * nothing is an ERROR, not a silently-dropped seam — that was the whole "zero seams" failure mode.
 *
 * Usage:
 *   node scripts/verify-seams.cjs <tickets.json> [--repo-root .]      (resolve surfaces in repo)
 *   node scripts/verify-seams.cjs <tickets.json> --no-resolve         (skip repo grep; testing)
 * tickets.json: [{ id, writes: [surface...], reads: [surface...] }]
 * Exit 0 = computed clean, 1 = unresolved surface(s), 2 = usage/IO error.
 * Prints the seam list + derived hops as JSON to stdout (consumed by GATE D prep).
 */

const { readFileSync, existsSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

/**
 * Pure seam computation. No IO.
 * @param {Array<{id:string, writes?:string[], reads?:string[]}>} tickets
 * @returns {{seams: Array<{surface, writers:string[], readers:string[], pairs:string[][], kind}>, derivedHops: object[]}}
 */
function computeSeams(tickets) {
  const bySurface = new Map(); // surface → { writers:Set, readers:Set }
  for (const t of tickets) {
    for (const s of t.writes || []) {
      if (!bySurface.has(s)) bySurface.set(s, { writers: new Set(), readers: new Set() });
      bySurface.get(s).writers.add(t.id);
    }
    for (const s of t.reads || []) {
      if (!bySurface.has(s)) bySurface.set(s, { writers: new Set(), readers: new Set() });
      bySurface.get(s).readers.add(t.id);
    }
  }

  const seams = [];
  for (const [surface, { writers, readers }] of bySurface) {
    const W = [...writers].sort();
    const R = [...readers].filter(r => !writers.has(r)).sort(); // reader-only
    // A seam needs ≥1 writer AND ≥1 other slice (another writer, or a reader) on the surface.
    const others = W.length + R.length;
    if (W.length === 0 || others < 2) continue;
    const pairs = [];
    for (let i = 0; i < W.length; i++) {
      for (let j = i + 1; j < W.length; j++) pairs.push([W[i], W[j]]); // writer×writer
      for (const r of R) pairs.push([W[i], r]);                       // writer×reader
    }
    const kind = R.length === 0 ? 'writer-writer' : (W.length === 1 ? 'writer-reader' : 'mixed');
    seams.push({ surface, writers: W, readers: R, pairs, kind });
  }
  seams.sort((a, b) => a.surface.localeCompare(b.surface));

  // Derived must-have hops: one per seam surface — GATE D must walk it and re-read its value.
  const derivedHops = seams.map(s => ({
    surface: s.surface,
    why: `seam (${s.kind}) between ${[...new Set(s.pairs.flat())].join(', ')}`,
    assert: 're-read value on the merged tree — not element presence',
  }));

  return { seams, derivedHops };
}

/** Does `surface` (a route literal or data-testid) appear anywhere under root? */
function surfaceResolves(surface, root) {
  const needle = surface.replace(/^\//, ''); // route or testid substring
  const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next']);
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) { if (!SKIP.has(e.name)) stack.push(join(dir, e.name)); continue; }
      if (!/\.(tsx?|jsx?|vue|svelte|html|cjs|mjs)$/.test(e.name)) continue;
      try { if (readFileSync(join(dir, e.name), 'utf8').includes(needle)) return true; } catch { /* skip */ }
    }
  }
  return false;
}

function main(argv) {
  const args = argv.slice(2);
  const path = args.find(a => !a.startsWith('--'));
  if (!path) { console.error('Usage: node scripts/verify-seams.cjs <tickets.json> [--repo-root .] [--no-resolve]'); process.exit(2); }
  let tickets;
  try { tickets = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { console.error(`✗ ${e.message}`); process.exit(2); }

  const resolve = !args.includes('--no-resolve');
  const rootIdx = args.indexOf('--repo-root');
  const root = rootIdx !== -1 ? args[rootIdx + 1] : '.';

  if (resolve) {
    const declared = new Set();
    for (const t of tickets) { (t.writes || []).forEach(s => declared.add(s)); (t.reads || []).forEach(s => declared.add(s)); }
    const unresolved = [...declared].filter(s => !surfaceResolves(s, root));
    if (unresolved.length) {
      console.error('✗ declared surfaces not found in repo (declare them exactly as they appear in code):');
      for (const s of unresolved) console.error(`  - ${s}`);
      process.exit(1);
    }
  }

  const { seams, derivedHops } = computeSeams(tickets);
  console.error(`seam-lite: ${seams.length} seam(s) across ${tickets.length} tickets`);
  for (const s of seams) console.error(`  ⚠ ${s.surface} — ${s.kind}: ${s.pairs.map(p => p.join('↔')).join(', ')}`);
  process.stdout.write(JSON.stringify({ seams, derivedHops }, null, 2) + '\n');
  process.exit(0);
}

module.exports = { computeSeams, surfaceResolves };

if (require.main === module) main(process.argv);
