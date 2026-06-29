#!/usr/bin/env node
/**
 * adversary-spawn.cjs — fresh-context adversary spawn PREPARATION (pipeline-v2 #49).
 *
 * "Fresh context" is only a real guarantee if the seed can't carry the author's reasoning.
 * This module makes that structural:
 *   - buildSeed() reads ONLY the three template slots — there is no parameter through which
 *     author rationale / chain-of-thought could be passed. Priming is prevented at construction.
 *   - assertSeedMatchesTemplate() byte-checks via the #50 gate (verify-seed) and THROWS before
 *     anything spawns — a primed or malformed seed cannot launch.
 *
 * The actual spawn (Claude `Workflow` agent / a Task subagent) is RUNTIME GLUE and lives in the
 * runtime bindings (PROCESS-CLAUDE.md / PROCESS-CODEX.md) — not here, and not unit-testable here.
 * This module delivers the runtime-agnostic, gated, rationale-free preparation the spawn consumes.
 */

const { validateSeed } = require('./verify-seed.cjs');

const DEFAULT_TOOL_GRANTS = ['read', 'grep', 'glob', 'bash']; // the adversary must re-ground claims
const DEFAULT_MANDATE_REF = 'adversary-mandate@v1';

/**
 * Build a template-conforming seed from ONLY the three allowed inputs.
 * Any other property on `inputs` is ignored by construction — the priming-leak vector
 * (rationale/context/notes) literally has no path into the seed.
 * @returns {{artifact_paths:string[], tool_grants:string[], mandate_ref:string}}
 */
function buildSeed(inputs = {}) {
  const artifact_paths = Array.isArray(inputs.artifactPaths) ? [...inputs.artifactPaths] : [];
  const tool_grants = Array.isArray(inputs.toolGrants) ? [...inputs.toolGrants] : [...DEFAULT_TOOL_GRANTS];
  const mandate_ref = typeof inputs.mandateRef === 'string' && inputs.mandateRef ? inputs.mandateRef : DEFAULT_MANDATE_REF;
  return { artifact_paths, tool_grants, mandate_ref };
}

/** Pre-spawn gate: throw if the seed doesn't match the template (the #50 byte-check). */
function assertSeedMatchesTemplate(seed) {
  const { ok, violations } = validateSeed(seed);
  if (!ok) throw new Error(`adversary seed rejected — cannot launch:\n  - ${violations.join('\n  - ')}`);
  return seed;
}

/**
 * Prepare a fresh-context adversary spawn: build the seed, gate it, return it ready for the runtime.
 * Throws before the caller can spawn if the seed is malformed/primed.
 * @param {string[]} artifactPaths  the ONLY context the adversary may see
 * @param {{toolGrants?:string[], mandateRef?:string}} [opts]
 */
function prepareAdversarySpawn(artifactPaths, opts = {}) {
  if (!Array.isArray(artifactPaths) || artifactPaths.length === 0) {
    throw new Error('prepareAdversarySpawn: artifactPaths must be a non-empty array');
  }
  const seed = buildSeed({ artifactPaths, toolGrants: opts.toolGrants, mandateRef: opts.mandateRef });
  return assertSeedMatchesTemplate(seed); // gated before it can reach any runtime spawn
}

module.exports = { buildSeed, assertSeedMatchesTemplate, prepareAdversarySpawn, DEFAULT_TOOL_GRANTS, DEFAULT_MANDATE_REF };
