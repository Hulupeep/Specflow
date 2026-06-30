const { auditProvenance } = require('../../scripts/provenance-gate.cjs');

describe('provenance gate', () => {
  test('passes source-provenance rows with claims, sources, and verification', () => {
    const result = auditProvenance({
      result: 'pass',
      source_provenance: [
        {
          claim: 'runner writes a ledger',
          source: 'scripts/specflow-runner.cjs',
          verification: 'contract test re-reads ledger.jsonl',
        },
      ],
    });
    expect(result.ok).toBe(true);
  });

  test('rejects empty provenance', () => {
    const result = auditProvenance({ result: 'pass', source_provenance: [] });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain('at least one');
  });

  test('rejects unallowed mock/fake provenance', () => {
    const result = auditProvenance({
      result: 'pass',
      source_provenance: [
        { claim: 'value is right', source: 'mock adapter', verification: 'stub returned it' },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain('mock/fake/stub');
  });
});
