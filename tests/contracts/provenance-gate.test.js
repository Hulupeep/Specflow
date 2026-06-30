const { auditDiffText, auditProvenance } = require('../../scripts/provenance-gate.cjs');

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

  test('rejects suspicious diff literals without provenance allowance', () => {
    const result = auditDiffText([
      'diff --git a/src/pricing.js b/src/pricing.js',
      '+const payload = { region_code: "NOLA-LA" };', // contract-allowed negative scanner fixture
    ].join('\n'));

    expect(result.ok).toBe(false);
    expect(result.violations[0]).toContain('value-bearing literal');
  });

  test('allows explicitly contract-approved fake provider diff lines', () => {
    const result = auditDiffText('+const provider = "fake"; // fake provider opt-in smoke');
    expect(result.ok).toBe(true);
  });
});
