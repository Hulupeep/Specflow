#!/usr/bin/env node
/**
 * verify-falsification.cjs — model-free structural gate for a falsification artifact
 * (adversary-mandate@v2 / pipeline-hardening #62).
 *
 * GATE_A must not trust that PRDs/<slug>-falsification.md is complete — it checks. This verifies
 * the artifact has every required section, non-empty, and a recognized final verdict. It does NOT
 * judge content quality (that's the critic's job) — it stops a STUB from satisfying the gate.
 * Pair with `teardown-gate.cjs check-sign <prd>` for the hash-bound PASS binding.
 *
 * Usage:  node scripts/verify-falsification.cjs <falsification.md>
 * Exit 0 = structurally complete, 1 = incomplete/invalid, 2 = usage/IO error.
 */

const { readFileSync, existsSync } = require('fs');

const REQUIRED = [
  'Premise Attack',
  'Claim Inventory',
  'Dependency Audit',
  'Acceptance Gate Attack',
  'Source / Reality Ledger',
  'Overclaim / Scope Leakage',
  'Banned-Mode Self-Check',
  'Final Verdict',
];
const VERDICTS = ['PASS WITH STIPULATIONS', 'PASS', 'FAIL']; // longest first for matching

/** Pure. @returns {{ok:boolean, violations:string[]}} */
function validateFalsification(content) {
  const v = [];
  // Split into sections by H2 headings; map heading text → body.
  const parts = content.split(/^##\s+/m).slice(1);
  const sections = new Map();
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const heading = (nl === -1 ? p : p.slice(0, nl)).trim();
    const body = (nl === -1 ? '' : p.slice(nl + 1)).trim();
    sections.set(heading, body);
  }

  for (const req of REQUIRED) {
    if (!sections.has(req)) { v.push(`missing section: "## ${req}"`); continue; }
    if (req === 'Final Verdict') {
      const final = sections.get(req).toUpperCase();
      if (!VERDICTS.some(verd => final.includes(verd))) {
        v.push('Final Verdict has no recognized verdict (PASS / PASS WITH STIPULATIONS / FAIL)');
      }
      continue;
    }
    // Every other section is table-based: "filled" = a table with a header AND ≥1 data row,
    // i.e. >1 non-separator `|` row. Header+separator only (the template stub) fails.
    const lines = sections.get(req).split('\n').map(l => l.trim()).filter(Boolean);
    const nonSeparatorTableRows = lines.filter(l => l.startsWith('|') && !/^\|[\s|:.-]+\|?$/.test(l));
    if (nonSeparatorTableRows.length <= 1) {
      v.push(`empty section: "## ${req}" has only a header row — falsify, don't stub`);
    }
  }

  return { ok: v.length === 0, violations: v };
}

function main(argv) {
  const path = argv[2];
  if (!path) { console.error('Usage: node scripts/verify-falsification.cjs <falsification.md>'); process.exit(2); }
  if (!existsSync(path)) { console.error(`✗ no such file: ${path} — GATE_A requires the falsification artifact`); process.exit(2); }
  const { ok, violations } = validateFalsification(readFileSync(path, 'utf8'));
  if (ok) { console.error('✓ falsification artifact structurally complete'); process.exit(0); }
  console.error('✗ falsification artifact incomplete:');
  for (const m of violations) console.error(`  - ${m}`);
  process.exit(1);
}

module.exports = { validateFalsification, REQUIRED };

if (require.main === module) main(process.argv);
