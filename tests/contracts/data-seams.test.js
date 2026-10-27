// Declared interface checker controls; API/runtime assertions are separate.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { dataFixture } = require('../helpers/data-seams');
const runner = require('../../scripts/specflow-runner.cjs');
test('DS001/005: typed endpoints in an unversioned array cannot be silently treated as zero seams', () => {
  expect(() => require('../../scripts/ticket-document.cjs').parseTicketDocument([{ id: 'producer', writes: [{ interface_id: 'calculation' }] }])).toThrow(/version:2/);
  expect(() => require('../../scripts/verify-seams.cjs').computeSeams([{ id: 'producer', writes: [{ interface_id: 'calculation' }] }])).toThrow(/version:2/);
});
const script = path.resolve(__dirname, '../../scripts/verify-seams.cjs');
const run = (env, phase = 'built') => cp.spawnSync(process.execPath, [script, env.root + '/tickets.json', '--repo-root', env.root, '--phase', phase, '--verification-contract', env.contractFile], { encoding: 'utf8', timeout: 30000 });
test('DS001/003: versioned compatible data declarations resolve without claiming runtime acceptance', () => {
  const env = dataFixture();
  try {
    const result = run(env);
    expect({ status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ runtime_status: 'unverified', data_seams: [{ id: 'S-calculation', compatibility: 'compatible' }] });
  } finally { env.remove(); }
});
test('DS001: shared GateB ADR reader preserves resolving-ADR/reuse validation with the typed envelope', () => {
  const env = dataFixture();
  try {
    fs.mkdirSync(env.root + '/docs/adr', { recursive: true }); fs.writeFileSync(env.root + '/docs/adr/ADR-1-service.md', '# Fixture service decision');
    const result = cp.spawnSync(process.execPath, [path.resolve(__dirname, '../../scripts/verify-adr.cjs'), env.root + '/tickets.json', '--repo-root', env.root], { encoding: 'utf8', timeout: 30000 });
    expect({ status: result.status, stderr: result.stderr }).toMatchObject({ status: 0 });
  } finally { env.remove(); }
});
test('DS003/004: existing GateB invokes planned data validation with the same parent contract', () => {
  const checks = runner.verifierCommandsForStage({ loop: 'spec-build', current_stage_or_rail: 'GATE_B', verification_contract_path: 'accepted.json' }, { specDir: 'docs/specs/example' });
  const seam = checks.find(c => c.name === 'verify-seams');
  expect(seam.command).toContain('--phase planned');
  expect(seam.command).toContain('--verification-contract');
  expect(seam.command).toContain('accepted.json');
});

const facts = require('../../scripts/data-seams.cjs');
const outcome = require('../../scripts/outcome-contract.cjs');
test.each(['unit', 'nullable', 'required', 'reference', 'effective', 'type', 'revision', 'rename'])('DS002: %s mismatch blocks equal-number schema metadata with both owners identified', kind => {
  const env = dataFixture();
  try {
    const changed = structuredClone(env.facts);
    if (kind === 'unit') changed.fields.amount.unit = 'days';
    if (kind === 'nullable') changed.fields.calculation_result_id.nullable = true;
    if (kind === 'required') changed.fields.calculation_result_id.required = false;
    if (kind === 'reference') changed.fields.calculation_result_id.reference = 'different-record';
    if (kind === 'effective') changed.fields.amount.effective = 'latest-only';
    if (kind === 'type') changed.fields.amount.type = 'string';
    if (kind === 'revision') changed.revision = '2';
    if (kind === 'rename') { changed.fields.total = changed.fields.amount; delete changed.fields.amount; }
    env.writeFacts('producer.schema.json', changed);
    const report = facts.inspect(env.contract, env.root);
    expect(report.ok).toBe(false); expect(report.runtime_status).toBe('unverified');
    expect(report.errors.join(' ')).toContain('S-calculation');
    expect(report.data_seams[0]).toMatchObject({ producer_ids: ['producer'], consumer_ids: ['consumer'], obligation_ids: ['O-values'], check_ids: ['C-correctness'] });
    expect(run(env).status).toBe(1);
  } finally { env.remove(); }
});
test('DS002: a stronger integer producer can satisfy a number consumer; presence and nullability stay directional', () => {
  const env = dataFixture();
  try {
    const producer = structuredClone(env.facts), consumer = structuredClone(env.facts);
    producer.fields.amount.type = 'integer'; consumer.fields.amount.nullable = true; consumer.fields.amount.required = false;
    expect(facts.compareFacts(env.facts, producer, consumer, 'fixture')).toEqual([]);
  } finally { env.remove(); }
});
test('DS003: future built reference may be planned but cannot become built by changing a label', () => {
  const env = dataFixture();
  try {
    fs.unlinkSync(env.root + '/producer.schema.json');
    const planned = run(env, 'planned'); expect(planned.status).toBe(0);
    expect(JSON.parse(planned.stdout).data_seams[0].compatibility).toBe('planned');
    expect(run(env, 'built').status).toBe(1);
    const consumer = structuredClone(env.facts); consumer.fields.amount.unit = 'days'; env.writeFacts('consumer.schema.json', consumer);
    expect(run(env, 'planned').status).toBe(1); // known contradictions still block
  } finally { env.remove(); }
});
test.each(['producer', 'consumer', 'duplicate', 'unknown-interface', 'adapter', 'field', 'symlink'])('DS005: missing/unsupported %s never becomes zero-seam success', kind => {
  const env = dataFixture();
  try {
    if (kind === 'producer') env.manifest.tickets.shift();
    if (kind === 'consumer') env.manifest.tickets.pop();
    if (kind === 'duplicate') env.manifest.tickets[0].writes.push(structuredClone(env.manifest.tickets[0].writes[0]));
    if (kind === 'unknown-interface') env.manifest.tickets[0].writes[0].interface_id = 'undeclared';
    if (kind === 'adapter') env.manifest.tickets[0].writes[0].schema_ref.adapter = 'sql-guess';
    if (kind === 'field') { const bad = structuredClone(env.facts); bad.fields.amount.magic_semantics = true; env.writeFacts('producer.schema.json', bad); }
    if (kind === 'symlink') { fs.unlinkSync(env.root + '/producer.schema.json'); fs.symlinkSync(env.root + '/consumer.schema.json', env.root + '/producer.schema.json'); }
    fs.writeFileSync(env.root + '/tickets.json', JSON.stringify(env.manifest));
    expect(run(env).status).not.toBe(0);
  } finally { env.remove(); }
});
test.each(['unit-expectation', 'requiredness', 'check', 'owners'])('DS006: accepted %s semantics cannot be weakened to repair failure', kind => {
  const env = dataFixture();
  try {
    env.accept();
    const seam = env.contract.outcome_contract.data_seams[0];
    if (kind === 'unit-expectation') seam.expected_ref.sha256 = '0'.repeat(64);
    if (kind === 'requiredness') seam.required = false;
    if (kind === 'check') { seam.check_ids = ['C-provenance']; env.contract.runtime_checks[0].execution.seam_ids = []; env.contract.runtime_checks[1].execution.seam_ids = ['S-calculation']; }
    if (kind === 'owners') seam.consumer_ids = ['different-consumer'];
    // Some changes also invalidate the declarations; either validation or the
    // existing protected amendment must prevent a new accepted goal.
    expect(() => env.accept()).toThrow();
  } finally { env.remove(); }
});
test.each(['missing-check', 'wrong-level', 'dropped-id', 'unknown-obligation', 'malformed-ids'])('DS004: %s required parent integration mapping is invalid', kind => {
  const env = dataFixture();
  try {
    const seam = env.contract.outcome_contract.data_seams[0], c = env.contract.runtime_checks[0];
    if (kind === 'missing-check') seam.check_ids = ['missing'];
    if (kind === 'wrong-level') { c.verification_level = 'unit'; env.contract.outcome_contract.obligations[0].level = 'unit'; }
    if (kind === 'dropped-id') c.execution.seam_ids = [];
    if (kind === 'unknown-obligation') seam.obligation_ids = ['O-missing'];
    if (kind === 'malformed-ids') c.execution.seam_ids = {};
    expect(outcome.validate(env.contract).ok).toBe(false);
  } finally { env.remove(); }
});
test('DS003: ignored schema bytes still participate in current outcome binding', () => {
  const env = dataFixture();
  try {
    fs.appendFileSync(env.root + '/.gitignore', '\nproducer.schema.json\nconsumer.schema.json\n');
    const first = outcome.bind(env.contract, { root: env.root, configurationId: 'local', environment: 'isolated-node' });
    expect(first.status).toBe('bound'); expect(Object.hasOwn(first.binding.files, 'producer.schema.json')).toBe(true);
    const producer = structuredClone(env.facts); producer.fields.amount.unit = 'days'; env.writeFacts('producer.schema.json', producer);
    const current = outcome.bind(env.contract, { root: env.root, configurationId: 'local', environment: 'isolated-node' });
    expect(current.binding.source_sha256).toBe(first.binding.source_sha256);
    expect(outcome.freshness(first.binding, current.binding).status).toBe('stale');
  } finally { env.remove(); }
});

const { apiFixture } = require('../helpers/data-seams');
const verify = env => runner.runVerifierStage({ root: env.root, runDir: env.runDir, sliceTags: ['integration'], configurationId: 'local', environment: 'isolated-node' });
test.each([false, true])('DS004: actual HTTP producer→consumer is checked against independent metadata+values (lying runtime %s)', lyingRuntime => {
  const env = apiFixture({ lyingRuntime });
  try {
    env.accept(); const result = verify(env);
    expect(result.gate).toBe(lyingRuntime ? 'fail' : 'pass');
    expect(result.findings.find(f => f.check_id === 'C-correctness').execution.data_seams[0].compatibility).toBe('compatible');
    expect(result.proof_claims).toMatchObject({ correctness: lyingRuntime ? 'failed' : 'passed', provenance: 'passed', consistency: 'passed' });
  } finally { env.remove(); }
});
test('DS003/004: actual post-code consumer blocks incompatible schema before invoking the mapped native checker', () => {
  const env = apiFixture();
  try {
    env.accept(); const producer = structuredClone(env.facts); producer.fields.amount.unit = 'days'; env.writeFacts('producer.schema.json', producer);
    const result = verify(env);
    expect(result.gate).toBe('blocked'); expect(JSON.stringify(result)).toContain('unit mismatch');
    expect(result.findings.find(f => f.check_id === 'C-correctness').execution).toBeUndefined();
  } finally { env.remove(); }
});

test('DS003/006: current seam verdict names owners/checks and becomes stale after an ignored schema change', () => {
  const env = apiFixture();
  try {
    fs.appendFileSync(env.root + '/.gitignore', '\nproducer.schema.json\nconsumer.schema.json\n'); env.accept();
    const result = verify(env);
    expect(result.gate).toBe('pass');
    expect(result.data_seams).toEqual([expect.objectContaining({ id: 'S-calculation', producer_ids: ['producer'], consumer_ids: ['consumer'], compatibility: 'compatible', runtime_status: 'passed', check_ids: ['C-correctness'] })]);
    expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).data_seams[0].runtime_status).toBe('passed');
    fs.appendFileSync(env.root + '/producer.schema.json', '\n');
    expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).data_seams[0].runtime_status).toBe('stale');
  } finally { env.remove(); }
});
test('DS003/004: actual feature-build consumer blocks the incompatible data contract before advancing', () => {
  const env = apiFixture();
  try {
    const yaml = require('js-yaml'), contract = env.runDir + '/run-contract.yaml', ledger = env.runDir + '/ledger.jsonl';
    const tier = require('../helpers/spec-density').fixture(env.root); // supplied readiness only, never product proof
    fs.writeFileSync(contract, yaml.dump({ run_contract: { loop: 'feature-build', goal: 'compatible data connection', input_artifact: 'input.json', path: 'templates/QA/loops/feature-build.yaml', ...tier,
      current_stage_or_rail: '6_provenance', next_gate: 'provenance', durable_evidence: [contract], stop_condition: 'handoff', never_without_human: ['git push'], slice_tags: ['data_mutation'],
      storage: { contract_path: contract, ledger_path: ledger } } }));
    env.accept(); const producer = structuredClone(env.facts); producer.fields.amount.unit = 'days'; env.writeFacts('producer.schema.json', producer);
    const result = runner.runLoop({ slug: 'seam', contract, ledger, repoRoot: env.root, configurationId: 'local', environment: 'isolated-node' });
    expect(result).toMatchObject({ status: 'blocked_verifier_stage', verifier_stage: { gate: 'blocked' } });
    expect(JSON.stringify(result)).toContain('unit mismatch');
    expect(yaml.load(fs.readFileSync(contract)).run_contract.current_stage_or_rail).toBe('6_provenance');
  } finally { env.remove(); }
});

test('DS003: a later real check changing an ignored schema invalidates the earlier owning integration receipt', () => {
  const env = apiFixture(), executor = require('../../scripts/test-execution.cjs');
  try {
    fs.appendFileSync(env.root + '/.gitignore', '\nproducer.schema.json\nconsumer.schema.json\n'); env.accept();
    const result = runner.runVerifierStage({ root: env.root, runDir: env.runDir, sliceTags: ['integration'], configurationId: 'local', environment: 'isolated-node', runner: (check, options) => {
      const receipt = executor.execute(check, options);
      if (check.id === 'C-consistency') fs.appendFileSync(env.root + '/producer.schema.json', '\n');
      return receipt;
    } });
    expect(result.gate).toBe('blocked'); expect(result.findings[0].reason).toContain('stale owning receipt');
    expect(result.data_seams[0].runtime_status).toBe('stale');
  } finally { env.remove(); }
});
test('DS005: explicitly optional unsupported data proof stays visible without blocking a required compatible connection', () => {
  const env = apiFixture();
  try {
    const optionalFacts = { ...structuredClone(env.facts), interface_id: 'optional-calculation' };
    env.writeFacts('optional-expected.json', optionalFacts);
    const optionalChecks = env.contract.runtime_checks.map(c => {
      const clone = structuredClone(c); clone.id = 'optional-' + c.id; clone.required = false;
      clone.execution.comparison_ids = clone.execution.comparison_ids.map(id => 'optional-' + id);
      clone.execution.seam_ids = c.execution.seam_ids ? ['S-optional'] : undefined; return clone;
    });
    env.contract.runtime_checks.push(...optionalChecks);
    const optionalGoal = structuredClone(env.contract.outcome_contract.obligations[0]); optionalGoal.id = 'O-optional'; optionalGoal.required = false;
    optionalGoal.check_ids = optionalChecks.map(c => c.id);
    optionalGoal.oracle.comparisons.forEach(c => { c.id = 'optional-' + c.id; c.check_id = 'optional-' + c.check_id; });
    env.contract.outcome_contract.obligations.push(optionalGoal);
    env.contract.outcome_contract.data_seams.push({ id: 'S-optional', required: false, manifest_path: 'tickets.json', producer_ids: ['optional-producer'], consumer_ids: ['optional-consumer'],
      obligation_ids: ['O-optional'], check_ids: ['optional-C-correctness'], expected_ref: { path: 'optional-expected.json', sha256: require('crypto').createHash('sha256').update(fs.readFileSync(env.root + '/optional-expected.json')).digest('hex'), pointer: '' } });
    const endpoint = { interface_id: 'optional-calculation', schema_ref: { adapter: 'unsupported-optional', path: 'future.json', pointer: '' } };
    env.manifest.tickets.push({ id: 'optional-producer', writes: [endpoint], reads: [] }, { id: 'optional-consumer', writes: [], reads: [endpoint] });
    fs.writeFileSync(env.root + '/tickets.json', JSON.stringify(env.manifest)); env.accept();
    const result = verify(env);
    expect(result.gate).toBe('pass');
    expect(result.data_seams.find(s => s.id === 'S-calculation').runtime_status).toBe('passed');
    expect(result.data_seams.find(s => s.id === 'S-optional')).toMatchObject({ required: false, compatibility: 'unsupported', runtime_status: 'unsupported' });
  } finally { env.remove(); }
});
