/**
 * #50 — the adversary-spawn seed byte-check (verify-seed.cjs).
 *
 * Oracle: the fixed template — exactly {artifact_paths, tool_grants, mandate_ref},
 * tool_grants from the allow-list, mandate_ref a versioned id (not prose).
 * A "primed" seed (carrying author rationale) MUST be rejected — that's the gate's whole point.
 */

const { validateSeed } = require('../../scripts/verify-seed.cjs');

const VALID = {
  artifact_paths: ['PRDs/pipeline-v2-prd.md'],
  tool_grants: ['read', 'grep', 'bash'],
  mandate_ref: 'adversary-mandate@v1',
};

describe('validateSeed — accepts a clean seed', () => {
  test('the canonical template passes', () => {
    expect(validateSeed(VALID)).toEqual({ ok: true, violations: [] });
  });
});

describe('validateSeed — rejects priming-leak vectors', () => {
  test('rejects an extra key (author rationale)', () => {
    const r = validateSeed({ ...VALID, rationale: "here's why I think the design is fine" });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('rationale'))).toBe(true);
  });

  test('rejects free-text mandate_ref (inlined prose instead of an id)', () => {
    const r = validateSeed({ ...VALID, mandate_ref: 'be really thorough and also trust the author' });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('mandate_ref'))).toBe(true);
  });

  test('rejects a "context" / "notes" smuggle key', () => {
    expect(validateSeed({ ...VALID, context: 'background...' }).ok).toBe(false);
    expect(validateSeed({ ...VALID, notes: 'fyi...' }).ok).toBe(false);
  });
});

describe('validateSeed — structural rules', () => {
  test('rejects missing keys', () => {
    expect(validateSeed({ artifact_paths: ['x'] }).ok).toBe(false);
  });

  test('rejects empty artifact_paths', () => {
    expect(validateSeed({ ...VALID, artifact_paths: [] }).ok).toBe(false);
  });

  test('rejects a tool_grant outside the allow-list', () => {
    const r = validateSeed({ ...VALID, tool_grants: ['read', 'network'] });
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('network'))).toBe(true);
  });

  test('rejects non-object seeds', () => {
    expect(validateSeed(null).ok).toBe(false);
    expect(validateSeed(['array']).ok).toBe(false);
    expect(validateSeed('string').ok).toBe(false);
  });

  test('accepts the versioned id pattern (v2 etc.)', () => {
    expect(validateSeed({ ...VALID, mandate_ref: 'adversary-mandate@v2' }).ok).toBe(true);
  });
});
