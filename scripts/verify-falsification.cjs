#!/usr/bin/env node
/**
 * verify-falsification.cjs — model-free structural gate for a falsification artifact
 * (adversary-mandate@v2 / pipeline-hardening #62).
 *
 * GATE_A must not trust that PRDs/<slug>-falsification.md is complete — it checks. This verifies
 * the artifact has every required section, non-empty, and a recognized final verdict. It does NOT
 * judge content quality (that's the critic's job) — it stops a STUB from satisfying the gate.
 * Pair `--require-pass` with `--binds-prd <prd.md>` for the hash-bound Gate A proof.
 *
 * Usage:
 *   node scripts/verify-falsification.cjs <falsification.md>
 *   node scripts/verify-falsification.cjs <falsification.md> --require-pass --binds-prd <prd.md>
 * Exit 0 = structurally complete, 1 = incomplete/invalid, 2 = usage/IO error.
 */

const { createHash } = require('crypto');
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

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

function extractFinalVerdict(content) {
  const parts = content.split(/^##\s+/m).slice(1);
  for (const p of parts) {
    const nl = p.indexOf('\n');
    const heading = (nl === -1 ? p : p.slice(0, nl)).trim();
    if (heading !== 'Final Verdict') continue;
    const body = (nl === -1 ? '' : p.slice(nl + 1)).trim().toUpperCase();
    for (const verdict of VERDICTS) if (body.includes(verdict)) return verdict;
  }
  return null;
}

function extractBoundPrdHash(content) {
  const patterns = [
    /\bPRD\s+SHA-?256\s*:\s*([a-f0-9]{64})\b/i,
    /\bPRD_HASH\s*:\s*([a-f0-9]{64})\b/i,
    /\bprd_sha256\s*:\s*([a-f0-9]{64})\b/i,
    /\breviewed_prd_sha256\s*:\s*([a-f0-9]{64})\b/i,
  ];
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return null;
}

/** Pure. @returns {{ok:boolean, violations:string[], finalVerdict:string|null, boundPrdHash:string|null}} */
function validateFalsification(content, options = {}) {
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

  const finalVerdict = extractFinalVerdict(content);
  if (options.requirePass && !['PASS WITH STIPULATIONS', 'PASS'].includes(finalVerdict)) {
    v.push('Final Verdict must be PASS or PASS WITH STIPULATIONS for Gate A');
  }

  const boundPrdHash = extractBoundPrdHash(content);
  if (options.prdHash) {
    if (!boundPrdHash) {
      v.push('missing PRD hash binding (expected "PRD SHA-256: <hash>" or reviewed_prd_sha256)');
    } else if (boundPrdHash !== options.prdHash) {
      v.push(`stale PRD hash binding: falsification reviewed ${boundPrdHash.slice(0, 12)} but current PRD is ${options.prdHash.slice(0, 12)}`);
    }
  }

  return { ok: v.length === 0, violations: v, finalVerdict, boundPrdHash };
}

function main(argv) {
  const args = argv.slice(2);
  const path = args.find(a => !a.startsWith('--'));
  if (!path) {
    console.error('Usage: node scripts/verify-falsification.cjs <falsification.md> [--require-pass] [--binds-prd <prd.md>]');
    process.exit(2);
  }
  if (!existsSync(path)) { console.error(`✗ no such file: ${path} — GATE_A requires the falsification artifact`); process.exit(2); }

  const bindIdx = args.indexOf('--binds-prd');
  let prdHash = null;
  if (bindIdx !== -1) {
    const prd = args[bindIdx + 1];
    if (!prd) { console.error('✗ --binds-prd requires a PRD path'); process.exit(2); }
    if (!existsSync(prd)) { console.error(`✗ no such PRD file: ${prd}`); process.exit(2); }
    prdHash = sha256(readFileSync(prd));
  }

  const { ok, violations } = validateFalsification(readFileSync(path, 'utf8'), {
    requirePass: args.includes('--require-pass'),
    prdHash,
  });
  if (ok) {
    console.error(prdHash ? '✓ falsification artifact structurally complete, PASS verdict, PRD hash matches' : '✓ falsification artifact structurally complete');
    process.exit(0);
  }
  console.error('✗ falsification artifact incomplete:');
  for (const m of violations) console.error(`  - ${m}`);
  process.exit(1);
}

module.exports = { validateFalsification, extractFinalVerdict, extractBoundPrdHash, sha256, REQUIRED };

if (require.main === module) main(process.argv);
