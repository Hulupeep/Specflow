/**
 * verify-adr.cjs — conditional ADR-conformance + reuse gate (#68).
 * Oracle: the gmh-docs convention (docs/ard/ADR-006-*.md → id "ADR-6"); ADR-006 ≡ ADR-6.
 */

const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('fs');
const { join } = require('path');
const { tmpdir } = require('os');
const {
  normalizeAdrId, adrIdFromFilename, auditAdrCompliance, detectAdrDir, adrIdsInDir,
} = require('../../scripts/verify-adr.cjs');

describe('id normalization', () => {
  test('ADR-006, ADR-6, and 0006-foo.md all normalize to ADR-6', () => {
    expect(normalizeAdrId('ADR-006')).toBe('ADR-6');
    expect(normalizeAdrId('ADR-6')).toBe('ADR-6');
    expect(adrIdFromFilename('ADR-006-entitlement-model.md')).toBe('ADR-6');
    expect(adrIdFromFilename('0006-use-postgres.md')).toBe('ADR-6');
  });
  test('non-ADR filenames yield null', () => {
    expect(adrIdFromFilename('README.md')).toBeNull();
    expect(adrIdFromFilename('index.md')).toBeNull();
  });
});

describe('auditAdrCompliance (pure)', () => {
  const adrIds = new Set(['ADR-1', 'ADR-6']);

  test('valid ticket: resolving ADR + reuse → pass', () => {
    const r = auditAdrCompliance(adrIds, [{ id: '1', adrs: ['ADR-006'], reuses: ['BalanceCard'] }]);
    expect(r).toEqual({ ok: true, violations: [] });
  });

  test('phantom citation: ADR id with no file → fail', () => {
    const r = auditAdrCompliance(adrIds, [{ id: '1', adrs: ['ADR-99'], reuses: ['x'] }]);
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('no matching file') && v.includes('ADR-99'))).toBe(true);
  });

  test('no ADR cited and no justification → fail', () => {
    const r = auditAdrCompliance(adrIds, [{ id: '1', reuses: ['x'] }]);
    expect(r.violations.some(v => v.includes('no ADR cited'))).toBe(true);
  });

  test('explicit adr:none reason is accepted', () => {
    const r = auditAdrCompliance(adrIds, [{ id: '1', adrNone: 'pure docs change', reuses: ['x'] }]);
    expect(r.ok).toBe(true);
  });

  test('no reuse and no new-component justification → fail', () => {
    const r = auditAdrCompliance(adrIds, [{ id: '1', adrs: ['ADR-1'] }]);
    expect(r.violations.some(v => v.includes('no reuse declared'))).toBe(true);
  });

  test('justified new component is accepted', () => {
    const r = auditAdrCompliance(adrIds, [{ id: '1', adrs: ['ADR-1'], newComponent: 'RolloverWidget — nothing like it exists' }]);
    expect(r.ok).toBe(true);
  });
});

describe('detection (conditional skip)', () => {
  let root;
  beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'adr-')); });
  afterEach(() => { rmSync(root, { recursive: true, force: true }); });

  test('no ADR dir → detectAdrDir returns null (caller skips)', () => {
    expect(detectAdrDir(root, null)).toBeNull();
  });

  test('docs/ard with ADR files → detected, ids extracted', () => {
    mkdirSync(join(root, 'docs/ard'), { recursive: true });
    writeFileSync(join(root, 'docs/ard/ADR-001-x.md'), '# ADR 1');
    writeFileSync(join(root, 'docs/ard/ADR-006-entitlement.md'), '# ADR 6');
    writeFileSync(join(root, 'docs/ard/README.md'), 'index'); // ignored
    const dir = detectAdrDir(root, null);
    expect(dir).not.toBeNull();
    expect([...adrIdsInDir(dir)].sort()).toEqual(['ADR-1', 'ADR-6']);
  });
});
