// J-OUTCOME-CORPUS: current installed whole-outcome acceptance, both host payloads.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { runCase, inventory } = require('../helpers/outcome-corpus');
const output = process.env.SPECFLOW_CORPUS_ARTIFACT_DIR || path.resolve('.specflow/corpus-results/' + crypto.randomUUID());
const cases = ['codex', 'claude-code'].flatMap(host => inventory.cases.map(row => [host, row.id, row]));
test.each(cases)('J-OUTCOME-CORPUS: %s / %s', (host, id, row) => {
  const r = runCase(row, host, output), signal = row.expected_signal;
  expect(r.provider_invoked).toBe(false);
  expect(r.exit_code).toBe(row.accepted ? 0 : 1);
  expect(r.actual.outcome_acceptance === 'passed').toBe(row.accepted);
  const nativeCases = r.native.flatMap(x => x.cases || []), comparisons = r.native.flatMap(x => x.comparisons || []);
  const noExecution = ['stale-oracle', 'missing-reference', 'parent-loss'].includes(row.mutation);
  expect(r.native.map(x => x.check_id).sort()).toEqual(noExecution ? [] : row.fixture === 'ledger' ? ['C-consistency', 'C-correctness', 'C-provenance'] : ['C-workflow']);
  expect(r.source_identity.inventory_sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname, '../fixtures/outcome-corpus-v1/cases.json'))).digest('hex'));
  expect(r.source_identity.fixture_sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(r.source_identity.core_bundle_sha256).toBe(r.package_identity.installed_bundle_sha256);
  if (row.fixed_actual) {
    const values = row.fixture === 'ledger' ? r.produced : r.cliOutputs;
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) expect(value).toEqual(row.fixed_actual);
  }
  if (signal.kind === 'accepted_obligation') {
    expect(r.actual.obligations).toContainEqual(expect.objectContaining({ id: signal.id, status: 'passed' }));
    if (signal.optional_case_id) expect(nativeCases).toContainEqual(expect.objectContaining({ id: signal.optional_case_id, status: 'skipped', native_status: signal.native_status }));
  } else if (signal.kind === 'comparison') {
    expect(comparisons).toContainEqual(expect.objectContaining({ id: signal.id, status: 'failed', actual: signal.actual }));
    if (signal.total !== undefined) for (const produced of r.produced) expect(produced.reduce((n, record) => n + record.amount, 0)).toBe(signal.total);
    // Independent value failure must survive green provenance and consistency.
    if (['wrong', 'offsetting'].includes(row.mutation)) {
      for (const kind of ['provenance', 'consistency']) expect(r.native.filter(x => x.claim_kind === kind).every(x => x.result === 'pass')).toBe(true);
    }
  } else if (signal.kind === 'native_case') {
    expect(nativeCases).toContainEqual(expect.objectContaining({ id: signal.id, status: signal.status }));
  } else if (signal.kind === 'native_required_skip') {
    expect(nativeCases).toContainEqual(expect.objectContaining({ id: signal.id, status: 'skipped', native_status: signal.status }));
    expect(r.native.some(x => (x.errors || []).some(e => e.includes(signal.reason)))).toBe(true);
    expect(r.actual.obligations).toContainEqual(expect.objectContaining({ id: 'O-values', status: 'blocked' }));
  } else if (signal.kind === 'comparison_error') {
    expect(r.native.some(x => (x.errors || []).some(e => e.includes(signal.id) && e.includes(signal.reason)))).toBe(true);
  } else if (signal.kind === 'gate_error') {
    expect(r.actual.outcome_acceptance).toBe(signal.outcome_acceptance);
    if (row.mutation === 'stale-input') {
      // The stable structured signal plus changed declared input proves the
      // cause; Gate D may surface the earlier check-specific stale reason.
      expect(r.input_after).not.toBe(r.input_before);
      expect(r.actual.errors.join(' ')).toMatch(/stale.*(?:receipt|binding|input)|(?:receipt|binding|input).*stale/i);
      expect(signal.reason).toContain('stale');
    } else {
      expect(r.actual.errors.join(' ')).toContain(signal.reason);
      if (signal.reference) expect(r.actual.errors.join(' ')).toContain(signal.reference);
    }
  } else throw Error('Unconsumed expected signal: ' + signal.kind);
  expect(r.elapsed_ms).toBeGreaterThan(0);
  expect(r.process_count.observed_driver_children).toBe(2);
  expect(r.monetary_cost).toBeNull(); expect(r.cost_status).toBe('unknown');
  expect(fs.existsSync(path.join(output, host + '-' + id, 'result.json'))).toBe(true);
  const rawGate = fs.readFileSync(path.join(output, host + '-' + id, 'gate-stdout.json'));
  expect(crypto.createHash('sha256').update(rawGate).digest('hex')).toBe(r.gate_output_sha256);
  expect(JSON.parse(rawGate)).toEqual(r.actual);
  for (const receipt of r.native) for (const artifact of Object.values(receipt.artifacts)) {
    if (!artifact.sha256) continue;
    const relative = path.relative(r.run_identity, artifact.path);
    expect(relative.startsWith('..')).toBe(false);
    const archived = fs.readFileSync(path.join(output, host + '-' + id, 'run', relative));
    expect(crypto.createHash('sha256').update(archived).digest('hex')).toBe(artifact.sha256);
  }
}, 180000);
