#!/usr/bin/env node
/**
 * verify-adr.cjs — CONDITIONAL ADR-conformance + component-reuse gate (#68).
 * Sibling of verify-seams.cjs / verify-ticket-journey.cjs; does NOT fork verify-graph.cjs.
 *
 * Not all repos use ADRs — so this DETECTS an ADR folder and EXITS 0 SILENTLY when there isn't one.
 * When there IS one, each ticket must be built UNDER the decisions and by REUSING existing
 * components, not reinventing:
 *   - cite ≥1 ADR id that RESOLVES to a file in the ADR dir   (or `adr: none — <reason>`)
 *   - declare `reuses: [...]`                                  (or `new: <component> — <reason>`)
 * A cited ADR id that resolves to no file is an ERROR (no phantom citations — same honesty rule
 * as seam-lite's unresolved surfaces).
 *
 * Usage:
 *   node scripts/verify-adr.cjs <tickets.json> [--repo-root .] [--adr-dir <path>]
 * tickets.json: [{ id, adrs?:[ids], reuses?:[components], adrNone?:"reason", newComponent?:"reason" }]
 * Exit 0 = pass (incl. "no ADR dir → skip"), 1 = violations, 2 = usage/IO error.
 */

const { readFileSync, existsSync, readdirSync, statSync } = require('fs');
const { join } = require('path');

const KNOWN_ADR_DIRS = ['docs/adr', 'docs/adrs', 'docs/ard', 'docs/architecture/decisions', 'docs/architecture', 'adr', 'architecture/decisions'];

/** Normalize any ADR reference/filename to `ADR-<int>` (so ADR-006 ≡ ADR-6 ≡ 0006-foo.md). Pure. */
function normalizeAdrId(s) {
  const m = String(s).match(/(\d+)/);
  return m ? `ADR-${parseInt(m[1], 10)}` : null;
}

/** Extract an ADR id from a filename like ADR-006-foo.md or 0007-use-x.md. Pure. Returns null if none. */
function adrIdFromFilename(name) {
  if (/^adr[-_]?\d+/i.test(name) || /^\d{1,4}[-_]/.test(name)) return normalizeAdrId(name);
  return null;
}

/**
 * The audit. Pure — no IO.
 * @param {Set<string>} adrIds  normalized ADR ids present in the repo (empty Set ⇒ caller decided to enforce with none, treat as no-dir? caller guards)
 * @param {Array} tickets       [{id, adrs?, reuses?, adrNone?, newComponent?}]
 * @returns {{ok:boolean, violations:string[]}}
 */
function auditAdrCompliance(adrIds, tickets) {
  const v = [];
  for (const t of tickets) {
    const cited = (t.adrs || []).map(normalizeAdrId).filter(Boolean);
    const phantom = cited.filter(id => !adrIds.has(id));
    if (phantom.length) v.push(`ticket ${t.id}: cites ADR id(s) with no matching file: ${phantom.join(', ')}`);
    if (cited.length === 0 && !t.adrNone) {
      v.push(`ticket ${t.id}: no ADR cited and no "adr: none — <reason>" — this repo has ADRs; build under one`);
    }
    const reuses = t.reuses || [];
    if (reuses.length === 0 && !t.newComponent) {
      v.push(`ticket ${t.id}: no reuse declared and no "new: <component> — <reason>" — reuse existing components or justify a new one`);
    }
  }
  return { ok: v.length === 0, violations: v };
}

/** Find an ADR dir (configured wins; else first known dir that exists and holds ≥1 ADR-ish .md). IO. */
function detectAdrDir(root, configured) {
  const candidates = configured ? [configured, ...KNOWN_ADR_DIRS] : KNOWN_ADR_DIRS;
  for (const rel of candidates) {
    const abs = join(root, rel);
    if (!existsSync(abs) || !statSync(abs).isDirectory()) continue;
    const mds = readdirSync(abs).filter(f => f.endsWith('.md'));
    if (mds.some(adrIdFromFilename)) return abs;
  }
  return null;
}

/** ADR ids present in a dir. IO. */
function adrIdsInDir(dir) {
  const ids = new Set();
  for (const f of readdirSync(dir)) {
    const id = adrIdFromFilename(f);
    if (id) ids.add(id);
  }
  return ids;
}

function main(argv) {
  const args = argv.slice(2);
  const path = args.find(a => !a.startsWith('--'));
  if (!path) { console.error('Usage: node scripts/verify-adr.cjs <tickets.json> [--repo-root .] [--adr-dir <path>]'); process.exit(2); }
  const root = args.includes('--repo-root') ? args[args.indexOf('--repo-root') + 1] : '.';
  const configured = args.includes('--adr-dir') ? args[args.indexOf('--adr-dir') + 1] : null;

  const dir = detectAdrDir(root, configured);
  if (!dir) { console.error('verify-adr: no ADR folder detected — skipping (this repo does not use ADRs)'); process.exit(0); }

  let tickets;
  try { tickets = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { console.error(`✗ ${e.message}`); process.exit(2); }
  const adrIds = adrIdsInDir(dir);
  const { ok, violations } = auditAdrCompliance(adrIds, tickets);
  console.error(`verify-adr: ${adrIds.size} ADR(s) in ${dir}, ${tickets.length} ticket(s) checked`);
  if (ok) { console.error('✓ every ticket cites a resolving ADR (or justified none) and declares reuse'); process.exit(0); }
  console.error('✗ ADR-conformance gate FAILED:');
  for (const m of violations) console.error(`  - ${m}`);
  process.exit(1);
}

module.exports = { normalizeAdrId, adrIdFromFilename, auditAdrCompliance, detectAdrDir, adrIdsInDir };

if (require.main === module) main(process.argv);
