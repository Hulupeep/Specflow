#!/usr/bin/env node
/**
 * verify-seed.cjs — the independence GATE for the adversary spawn (pipeline-v2 #50 / N2).
 *
 * "Fresh context" is honour-system unless the seed is auditable. So the spawn seed must match a
 * FIXED template — exactly three slots, no free text — and is byte-checked here BEFORE the adversary
 * is spawned. A primed seed (one carrying the author's rationale/chain-of-thought) fails this check
 * and cannot launch. This, not the fresh window alone, is what makes the adversary independent.
 *
 *   seed = {
 *     artifact_paths: ["PRDs/foo-prd.md", ...],   // non-empty array of strings
 *     tool_grants:    ["read","grep","bash"],      // subset of the allow-list below
 *     mandate_ref:    "adversary-mandate@v1"        // id of a versioned static mandate, NOT prose
 *   }
 *
 * No other keys are permitted — `rationale`, `context`, `notes`, `why`, etc. are exactly the
 * priming-leak vectors this gate exists to reject.
 *
 * Usage:  node scripts/verify-seed.cjs <seed.json>     (exit 0 = valid, 1 = rejected, 2 = IO error)
 */

const { readFileSync } = require('fs');

const ALLOWED_KEYS = ['artifact_paths', 'tool_grants', 'mandate_ref'];
const TOOL_ALLOWLIST = ['read', 'grep', 'glob', 'bash'];
const MANDATE_REF = /^[a-z][a-z0-9-]*@v\d+$/; // e.g. adversary-mandate@v1 — an id, never free text

/**
 * Pure validator. No IO.
 * @returns {{ok:boolean, violations:string[]}}
 */
function validateSeed(seed) {
  const v = [];

  if (seed === null || typeof seed !== 'object' || Array.isArray(seed)) {
    return { ok: false, violations: ['seed must be a JSON object'] };
  }

  // Exactly the three allowed keys — extra keys are the priming-leak vector.
  const keys = Object.keys(seed);
  for (const k of keys) {
    if (!ALLOWED_KEYS.includes(k)) v.push(`disallowed key: "${k}" (only ${ALLOWED_KEYS.join(', ')} permitted)`);
  }
  for (const k of ALLOWED_KEYS) {
    if (!keys.includes(k)) v.push(`missing key: "${k}"`);
  }

  // artifact_paths — non-empty array of non-empty strings.
  if ('artifact_paths' in seed) {
    const ap = seed.artifact_paths;
    if (!Array.isArray(ap) || ap.length === 0) v.push('artifact_paths must be a non-empty array');
    else if (!ap.every(p => typeof p === 'string' && p.trim().length > 0)) v.push('artifact_paths must be non-empty strings');
  }

  // tool_grants — array drawn only from the allow-list.
  if ('tool_grants' in seed) {
    const tg = seed.tool_grants;
    if (!Array.isArray(tg)) v.push('tool_grants must be an array');
    else for (const t of tg) if (!TOOL_ALLOWLIST.includes(t)) v.push(`tool_grant not allowed: "${t}" (allow-list: ${TOOL_ALLOWLIST.join(', ')})`);
  }

  // mandate_ref — an id matching the versioned pattern, NOT inlined prose.
  if ('mandate_ref' in seed) {
    const m = seed.mandate_ref;
    if (typeof m !== 'string' || !MANDATE_REF.test(m)) {
      v.push('mandate_ref must be a versioned id like "adversary-mandate@v1" (an id, not prose)');
    }
  }

  return { ok: v.length === 0, violations: v };
}

function main(argv) {
  const path = argv[2];
  if (!path) {
    console.error('Usage: node scripts/verify-seed.cjs <seed.json>');
    process.exit(2);
  }
  let seed;
  try {
    seed = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`✗ could not read/parse ${path}: ${e.message}`);
    process.exit(2);
  }
  const { ok, violations } = validateSeed(seed);
  if (ok) {
    console.error('\x1b[32m✓\x1b[0m seed matches the template — adversary may launch');
    process.exit(0);
  }
  console.error('\x1b[31m✗\x1b[0m seed rejected — a primed seed cannot launch:');
  for (const msg of violations) console.error(`  - ${msg}`);
  process.exit(1);
}

module.exports = { validateSeed, ALLOWED_KEYS, TOOL_ALLOWLIST, MANDATE_REF };

if (require.main === module) main(process.argv);
