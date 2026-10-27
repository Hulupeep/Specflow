// Synthetic harness journeys: real native framework and CLI, no product proof.
const runner = require('../../scripts/specflow-runner.cjs');
const { fixture } = require('../helpers/native-execution');

test('PC001/005: a value-bearing native pass without independent comparison remains unproven', () => {
  const env = fixture();
  try {
    env.accept();
    const result = runner.runVerifierStage({ root: env.root, runDir: env.runDir, sliceTags: ['integration'], valueBearing: true, configurationId: 'local', environment: 'isolated-node' });
    expect(result.gate).toBe('blocked');
    expect(JSON.stringify(result)).toMatch(/independent.*comparison|value.bearing.*outcome/i);
  } finally { env.remove(); }
});

const { oracleFixture } = require('../helpers/oracle-execution');
const run = env => runner.runVerifierStage({ root: env.root, runDir: env.runDir, sliceTags: ['integration'], valueBearing: true, configurationId: 'local', environment: 'isolated-node' });
test.each(['normal', 'wrong', 'hardcoded'])('PC001/002/003/004: real-source %s output is judged independently from provenance and consistency', mode => {
  const env = oracleFixture({ mode });
  try {
    env.accept();
    const result = run(env);
    expect(result.gate).toBe(mode === 'normal' ? 'pass' : 'fail');
    const correctness = result.findings.find(f => f.check_id === 'C-correctness');
    expect(correctness.execution.comparisons.map(c => c.expected)).toEqual([900, 90]);
    expect(correctness.execution.comparisons.map(c => c.actual)).toEqual(mode === 'normal' ? [900, 90] : mode === 'wrong' ? [2400, 2400] : [900, 900]);
    for (const id of ['C-provenance', 'C-consistency']) expect(result.findings.find(f => f.check_id === id).verifier_result).toBe('pass');
  } finally { env.remove(); }
});

const comparison = require('../../scripts/oracle-comparison.cjs');
const outcome = require('../../scripts/outcome-contract.cjs');
const fs = require('fs');
test.each([
  [{ a: 1, b: null }, { b: null, a: 1 }, true],
  [[1, 2], [2, 1], false], [900, '900', false], [null, null, true],
  [{ '0': 1 }, [1], false], [0, false, false],
])('PC001/004: exact JSON comparison retains types and collection meaning (%#)', (expected, actual, passed) => {
  expect(comparison.compare(expected, actual, { operator: 'exact' })).toBe(passed);
});
test('PC006: explicit absolute tolerance has exact inclusive bounds and no coercion', () => {
  const rule = { operator: 'numeric', absolute_tolerance: 0.5 };
  expect(comparison.compare(900, 900.5, rule)).toBe(true);
  expect(comparison.compare(900, 900.5001, rule)).toBe(false);
  for (const value of ['900', Infinity, null]) expect(() => comparison.compare(900, value, rule)).toThrow(/finite|coercion/);
});
test('PC001: JSON Pointer supports escaping and distinguishes absent from present null', () => {
  const value = { 'a/b': { '~': null }, a: [1] };
  expect(comparison.resolvePointer(value, '/a~1b/~0')).toBeNull();
  expect(() => comparison.resolvePointer(value, '/a/01')).toThrow(/missing/);
  expect(() => comparison.resolvePointer(value, '/missing')).toThrow(/missing/);
  expect(() => comparison.resolvePointer(value, '/bad~2')).toThrow(/escape/);
});
test.each(['method', 'pointer', 'tolerance', 'mapping', 'unconsumed', 'claims'])('PC001/005: invalid %s declarations cannot qualify', kind => {
  const env = oracleFixture();
  try {
    const o = env.contract.outcome_contract.obligations[0], c = o.oracle.comparisons[0];
    if (kind === 'method') o.oracle.method.kind = 'same_implementation';
    if (kind === 'pointer') c.expected_pointer = '/bad~2';
    if (kind === 'tolerance') { c.operator = 'numeric'; c.absolute_tolerance = -1; }
    if (kind === 'mapping') c.case_id = 'foreign::case';
    if (kind === 'unconsumed') env.checks[0].execution.comparison_ids = ['CV-first'];
    if (kind === 'claims') o.required_claims = ['correctness'];
    expect(outcome.validate(env.contract).ok).toBe(false);
  } finally { env.remove(); }
});
test.each(['expected_pointer', 'absolute_tolerance', 'case_id'])('PC006: changing %s cannot bypass protected oracle amendment', field => {
  const env = oracleFixture();
  try {
    env.accept();
    const c = env.contract.outcome_contract.obligations[0].oracle.comparisons[0];
    if (field === 'expected_pointer') c.expected_pointer = '/second';
    if (field === 'absolute_tolerance') { c.operator = 'numeric'; c.absolute_tolerance = 5000; }
    if (field === 'case_id') c.case_id = 'cli.test.js::C-provenance';
    expect(() => env.accept()).toThrow(/owner amendment authority/);
  } finally { env.remove(); }
});
test.each(['missing', 'duplicate', 'unknown'])('PC005: actual native %s observations cannot be accepted', observations => {
  const env = oracleFixture({ observations });
  try { env.accept(); expect(run(env).gate).toBe('blocked'); } finally { env.remove(); }
});
test('PC005: editing a genuine current observation invalidates owning execution', () => {
  const env = oracleFixture(), executor = require('../../scripts/test-execution.cjs');
  try {
    const contract = env.accept().contract, check = contract.runtime_checks[0];
    const options = { root: env.root, runDir: env.runDir, verificationContract: contract, configurationId: 'local', environment: 'isolated-node' };
    const receipt = executor.execute(check, options);
    expect(receipt.result).toBe('pass');
    expect(executor.owns(receipt, check, contract, options)).toBe(true);
    fs.appendFileSync(receipt.artifacts.observations.path, ' ');
    expect(executor.owns(receipt, check, contract, options)).toBe(false);
  } finally { env.remove(); }
});
test('PC002/003/005: trace separates failed correctness from passing real provenance and consistency, then marks drift stale', () => {
  const env = oracleFixture({ mode: 'wrong' });
  try {
    env.accept(); const result = run(env);
    expect(result.proof_claims).toMatchObject({ correctness: 'failed', provenance: 'passed', consistency: 'passed' });
    expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).proof_claims).toEqual(result.proof_claims);
    fs.appendFileSync(env.root + '/input.json', '\n');
    expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).proof_claims.correctness).toBe('stale');
  } finally { env.remove(); }
});

test.each([{ skipRequired: true }, { retry: true }, { observations: 'symlink' }])('PC005: matching values cannot rescue skipped, ambiguous retry or unsafe observation (%#)', options => {
  const env = oracleFixture(options);
  try {
    env.accept(); const result = run(env);
    expect(result.gate).toBe('blocked');
    expect(JSON.stringify(result)).toMatch(options.skipRequired ? /required_case_skipped/ : options.retry ? /ambiguous native retry/ : /symlink/);
  } finally { env.remove(); }
});
test('PC006: oracle bytes changed after acceptance cannot borrow a previous expected result', () => {
  const env = oracleFixture();
  try {
    env.accept(); fs.writeFileSync(env.root + '/oracle.json', JSON.stringify({ first: 2400, second: 2400 }));
    expect(run(env)).toMatchObject({ gate: 'blocked', reason: expect.stringContaining('oracle bytes changed') });
  } finally { env.remove(); }
});

test('PC006: a genuinely signed fixture amendment without rerun leaves old native proof stale', () => {
  const env = oracleFixture();
  try {
    env.accept(); expect(run(env).gate).toBe('pass');
    const oldHash = outcome.outcomeHash(env.contract);
    env.contract.outcome_contract.obligations[0].oracle.comparisons[0].expected_pointer = '/second';
    const signed = require('../helpers/oracle-owner').signedAmendment(env.root, oldHash, outcome.outcomeHash(env.contract));
    runner.writeVerificationProposal({ runDir: env.runDir, journeyId: 'J-CLI', runtimeChecks: env.contract.runtime_checks });
    // Real child environment: Jest's process.env proxy does not change the
    // parent process's native default spawn environment. Only GitHub is a fixture.
    const request = env.root + '/.specflow/amendment-request.json';
    fs.writeFileSync(request, JSON.stringify({ root: env.root, runDir: env.runDir, decision: 'accept', verificationContract: env.contract, amendment: signed.amendment }));
    const modulePath = require.resolve('../../scripts/specflow-runner.cjs');
    const code = `const fs=require('fs');require(${JSON.stringify(modulePath)}).decideVerification(JSON.parse(fs.readFileSync(process.argv[1])));`;
    const accepted = require('child_process').spawnSync(process.execPath, ['-e', code, request], {
      encoding: 'utf8', timeout: 30000, env: { ...process.env, PATH: signed.bin + require('path').delimiter + process.env.PATH },
    });
    expect({ status: accepted.status, stderr: accepted.stderr }).toMatchObject({ status: 0 });
    const trace = runner.verifierTrace({ root: env.root, runDir: env.runDir });
    expect(trace.parent_outcome.binding_status).toBe('stale');
    expect(trace.proof_claims.correctness).toBe('stale');
  } finally { env.remove(); }
});

test('PC005: actual feature-build consumer stops on real-source wrong answer before declaration lint', () => {
  const env = oracleFixture({ mode: 'wrong' });
  try {
    const yaml = require('js-yaml'), contract = env.runDir + '/run-contract.yaml', ledger = env.runDir + '/ledger.jsonl';
    // Only pre-existing readiness state is supplied; native code, process and
    // comparison execution are real. This is not a live promotion/product proof.
    const tier = require('../helpers/spec-density').fixture(env.root);
    fs.writeFileSync(contract, yaml.dump({ run_contract: {
      loop: 'feature-build', goal: 'Independently correct amounts', input_artifact: 'input.json', path: 'templates/QA/loops/feature-build.yaml',
      ...tier, current_stage_or_rail: '6_provenance', next_gate: 'provenance', durable_evidence: [contract],
      stop_condition: 'handoff', never_without_human: ['git push'], slice_tags: ['data_mutation'], maker_claim: 'complete',
      storage: { contract_path: contract, ledger_path: ledger },
    } }));
    env.accept();
    const result = runner.runLoop({ slug: 'oracle', contract, ledger, repoRoot: env.root, configurationId: 'local', environment: 'isolated-node' });
    expect(result).toMatchObject({ status: 'blocked_verifier_stage', verifier_stage: { gate: 'fail', proof_claims: { correctness: 'failed', provenance: 'passed', consistency: 'passed' } } });
    expect(yaml.load(fs.readFileSync(contract)).run_contract.current_stage_or_rail).toBe('6_provenance');
  } finally { env.remove(); }
});
