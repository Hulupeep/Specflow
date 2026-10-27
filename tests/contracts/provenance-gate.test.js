const { auditDiffText, auditProvenance } = require('../../scripts/provenance-gate.cjs');

describe('provenance gate', () => {
  test.each(['pass-but-failed', 'bypassed', 'unpassed', 'PASS'])('PC005: malformed success %s cannot pass declaration validation', result => {
    expect(auditProvenance({ result, source_provenance: [{ claim: 'value observed', source: 'actual CLI', verification: 'independent reference' }] }).ok).toBe(false);
  });
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

  test('flags unallowed mock/fake declarations without certifying or rejecting runtime coverage from text', () => {
    const result = auditProvenance({
      result: 'pass',
      source_provenance: [
        { claim: 'value is right', source: 'mock adapter', verification: 'stub returned it' },
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.signals[0]).toContain('mock/fake/stub');
    expect(result.behaviour).toBe('unverified');
  });

  test('flags suspicious diff literals for review while legitimate configuration constants remain possible', () => {
    const result = auditDiffText([
      'diff --git a/src/pricing.js b/src/pricing.js',
      '+const payload = { region_code: "NOLA-LA" };', // contract-allowed negative scanner fixture
    ].join('\n'));

    expect(result.ok).toBe(true);
    expect(result.signals[0]).toContain('value-bearing literal');
    expect(result.behaviour).toBe('unverified');
  });

  test('allows explicitly contract-approved fake provider diff lines', () => {
    const result = auditDiffText('+const provider = "fake"; // fake provider opt-in smoke');
    expect(result.ok).toBe(true);
  });
});
