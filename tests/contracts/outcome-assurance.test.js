const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const yaml = require('js-yaml');
const outcome = require('../../scripts/outcome-contract.cjs');
const runner = require('../../scripts/specflow-runner.cjs');
const graph = path.resolve(__dirname, '../../scripts/verify-graph.cjs');
const cli = path.resolve(__dirname, '../../bin/specflow.js');
const fixture = path.resolve(__dirname, '../fixtures/outcome-v1');
let root, runDir, contract;
function git(...args) { return cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function accept(vc = contract, options = {}) {
  runner.writeVerificationProposal({ runDir, journeyId: 'J-CLI', runtimeChecks: vc.runtime_checks });
  return runner.decideVerification({ runDir, root, decision: 'accept', verificationContract: vc, ...options });
}
function binding(options = {}) { return outcome.bind(contract, { root, configurationId: 'local', environment: 'isolated-node', ...options }); }
function documents(ids = ['C-CLI']) { return [{ file: 'feature.yml', document: { contract_meta: { id: 'cli', owner: 'cli-team', covers_reqs: ['O-CLI'], check_ids: ids } } }]; }
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'outcome-132-'));
  runDir = path.join(root, '.specflow/runs/cli');
  fs.cpSync(fixture, root, { recursive: true });
  fs.writeFileSync(path.join(root, '.gitignore'), '.specflow/\n');
  git('init', '-q'); git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'synthetic fixture');
  contract = {
    journey_id: 'J-CLI', maker_policy_id: 'maker', verifier_policy_id: 'independent-verifier', forbidden_evidence: ['maker self-review'],
    runtime_checks: [{ id: 'C-CLI', type: 'custom-script', required: true, command: 'node transform.cjs input.txt', verification_level: 'process', configuration_ids: ['local'], checker_paths: ['transform.cjs'], input_paths: ['input.txt'], rule_paths: [] }],
    outcome_contract: { version: 1, goal: 'Transform the agreed fixture exactly', configurations: [{ id: 'local', environment: 'isolated-node' }], assumptions: [], unknowns: [], non_goals: ['product financial calculations'], obligations: [{ id: 'O-CLI', required: true, oracle: { path: 'expected.json', sha256: require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root, 'expected.json'))).digest('hex') }, check_ids: ['C-CLI'], level: 'process', configuration_ids: ['local'] }] },
  };
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

test('OC001/003: real process transformation agrees with fixed reviewed CLI reference; wrong integrated 2400 is rejected despite green local substitutes', () => {
  const reference = JSON.parse(fs.readFileSync(path.join(root, 'expected.json')));
  const good = cp.spawnSync(process.execPath, ['transform.cjs', 'input.txt'], { cwd: root, encoding: 'utf8' });
  expect(good.status).toBe(0); expect(good.stdout).toBe(reference.transformed);
  const wrong = cp.spawnSync(process.execPath, ['-e', 'process.stdout.write("2400")'], { encoding: 'utf8' });
  expect(wrong.status).toBe(0);
  // Two child substitutes may pass; a fixed independent parent reference still rejects.
  expect(Number(wrong.stdout)).not.toBe(reference.balance);
  expect(reference.balance).toBe(900);
  expect(outcome.validate(contract).ok).toBe(true);
  expect(binding().status).toBe('bound'); // identity only, not executed acceptance
});

test.each([
  ['missing goal', c => delete c.outcome_contract.goal],
  ['unknown schema field', c => c.outcome_contract.claimed_pass = true],
  ['missing explicit unknowns', c => delete c.outcome_contract.unknowns],
  ['invalid requiredness', c => c.outcome_contract.obligations[0].required = 'false'],
  ['duplicate obligations', c => c.outcome_contract.obligations.push(c.outcome_contract.obligations[0])],
  ['duplicate configurations', c => c.outcome_contract.configurations.push(c.outcome_contract.configurations[0])],
  ['unknown configuration', c => c.outcome_contract.obligations[0].configuration_ids = ['other']],
  ['missing check', c => c.outcome_contract.obligations[0].check_ids = ['missing']],
  ['downgraded check', c => c.runtime_checks[0].required = false],
  ['wrong level', c => c.runtime_checks[0].verification_level = 'unit'],
  ['wrong supported check configuration', c => c.runtime_checks[0].configuration_ids = ['other']],
  ['missing checker', c => c.runtime_checks[0].checker_paths = []],
  ['invalid paths', c => c.runtime_checks[0].input_paths = ['../secret']],
  ['missing rules declaration', c => delete c.runtime_checks[0].rule_paths],
  ['duplicate check', c => c.runtime_checks.push(c.runtime_checks[0])],
  ['malformed inventory', c => c.runtime_checks = {}],
])('OC001 schema rejects %s', (_, mutate) => { mutate(contract); expect(outcome.validate(contract).ok).toBe(false); });

test('OC002: owned planned coverage passes without requiring unbuilt implementation files', () => {
  expect(outcome.coverage(contract, documents())).toMatchObject({ ok: true, obligations: [{ id: 'O-CLI', status: 'missing', coverage_status: 'planned' }] });
});
test.each([
  ['dropped', docs => docs[0].document.contract_meta.covers_reqs = []],
  ['dangling', docs => docs[0].document.contract_meta.covers_reqs = ['O-UNKNOWN']],
  ['duplicated', docs => docs[0].document.contract_meta.covers_reqs.push('O-CLI')],
  ['missing owner', docs => delete docs[0].document.contract_meta.owner],
  ['wrong check', docs => docs[0].document.contract_meta.check_ids = ['unknown']],
])('OC002 rejects %s parent coverage', (_, mutate) => { const docs = documents(); mutate(docs); expect(outcome.coverage(contract, docs).ok).toBe(false); });
test('OC002: local children cannot replace required integration coverage', () => {
  contract.outcome_contract.obligations[0].level = 'integration';
  contract.outcome_contract.obligations[0].check_ids = ['C-INTEGRATED'];
  contract.runtime_checks.push({ ...contract.runtime_checks[0], id: 'C-INTEGRATED', verification_level: 'integration' });
  const result = outcome.coverage(contract, documents());
  expect(result.ok).toBe(false); expect(result.errors.join()).toContain('C-INTEGRATED');
});
test.each([graph, cli])('OC002: actual graph entry %s consumes required coverage and fails closed', entry => {
  const dir = path.join(root, 'contracts'); fs.mkdirSync(dir);
  const file = path.join(root, 'verification.json'); fs.writeFileSync(file, JSON.stringify(contract));
  const run = () => cp.spawnSync(process.execPath, [entry, ...(entry === cli ? ['graph'] : []), 'contracts', '--verification-contract', file], { cwd: root, encoding: 'utf8' });
  fs.writeFileSync(path.join(dir, 'feature.yml'), yaml.dump(documents()[0].document));
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(dir, 'feature.yml'), yaml.dump(documents([])[0].document));
  const rejected = run(); expect(rejected.status).not.toBe(0); expect(rejected.stderr).toContain('O-CLI: missing coverage');
});
test('OC002: existing Gate B registry invokes the same coverage consumer', () => {
  const checks = runner.verifierCommandsForStage({ loop: 'spec-build', current_stage_or_rail: 'GATE_B', verification_contract_path: 'accepted verification.json' }, { specDir: 'docs/specs/cli' });
  expect(checks.find(c => c.name === 'verify-outcome-coverage').command).toContain('--verification-contract');
});

test.each(['input.txt', 'transform.cjs'])('OC004: same answer with changed %s bytes makes the old binding stale', file => {
  const first = binding().binding;
  fs.appendFileSync(path.join(root, file), file.endsWith('.cjs') ? '\n// revised checker\n' : '\n');
  expect(outcome.freshness(first, binding().binding).status).toBe('stale');
  expect(outcome.freshness(binding().binding, binding().binding).status).toBe('current');
});
test('OC004: ignored inputs/rules are hashed even though ordinary source snapshot excludes them', () => {
  fs.writeFileSync(path.join(root, '.gitignore'), '.specflow/\nlocal-rule.json\n');
  fs.writeFileSync(path.join(root, 'local-rule.json'), 'version A'); contract.runtime_checks[0].rule_paths = ['local-rule.json'];
  const first = binding().binding;
  fs.writeFileSync(path.join(root, 'local-rule.json'), 'version B');
  const next = binding().binding;
  expect(next.source_sha256).toBe(first.source_sha256);
  expect(outcome.freshness(first, next).status).toBe('stale');
});
test('OC004: source dirty tree, environment, configurations, oracle bytes and incomplete bindings cannot borrow a pass', () => {
  const first = binding().binding;
  fs.writeFileSync(path.join(root, 'new-source.js'), '// implementation');
  expect(outcome.freshness(first, binding().binding).status).toBe('stale');
  expect(binding({ environment: 'different' }).status).toBe('unsupported');
  expect(binding({ configurationId: 'windows' }).status).toBe('unsupported');
  expect(outcome.freshness({}, first).status).toBe('missing');
  fs.appendFileSync(path.join(root, 'expected.json'), '\n');
  expect(binding()).toMatchObject({ status: 'blocked', errors: [expect.stringContaining('oracle bytes changed')] });
});
test('OC004: missing files and symlinks do not acquire bindings', () => {
  fs.unlinkSync(path.join(root, 'transform.cjs')); expect(binding().status).toBe('blocked');
  fs.symlinkSync(path.join(root, 'input.txt'), path.join(root, 'transform.cjs')); expect(binding()).toMatchObject({ status: 'blocked', errors: [expect.stringContaining('symlink')] });
});
test('OC005: changing accepted expectations, requiredness, support or dropping parent contract cannot self-authorize', () => {
  accept();
  const original = JSON.parse(JSON.stringify(contract));
  for (const mutate of [c => c.outcome_contract.obligations[0].required = false, c => c.outcome_contract.configurations[0].environment = 'new', c => c.outcome_contract.obligations[0].oracle.path = 'another.json', c => delete c.outcome_contract]) {
    contract = JSON.parse(JSON.stringify(original)); mutate(contract);
    expect(() => accept()).toThrow(/owner amendment authority/);
  }
  // Source/input changes do not alter frozen acceptance; no extra owner checkpoint.
  contract = original; fs.appendFileSync(path.join(root, 'input.txt'), '\n'); expect(() => accept()).not.toThrow();
});
test('OC005: direct edits retaining accepted timestamp are not a revision authority bypass', () => {
  accept(); contract.outcome_contract.obligations[0].oracle.sha256 = 'a'.repeat(64);
  fs.writeFileSync(runner.verificationPaths({ runDir }).contractPath, JSON.stringify({ ...contract, accepted_at: '2026-10-27T00:00:00Z' }));
  expect(runner.requireAcceptedVerificationContract({ runDir }).accepted).toBe(false);
  expect(() => accept()).toThrow(/owner amendment authority/);
});
test('OC005/006: unbound legacy parent readiness is explicit, existing bounded slice remains available', () => {
  delete contract.outcome_contract;
  accept();
  expect(runner.requireAcceptedVerificationContract({ runDir }).accepted).toBe(true);
  expect(runner.verifierTrace({ runDir }).parent_outcome.status).toBe('migration_required');
});
test('OC006: required CLI obligations trigger verification without UI tags; identity is not owning execution', () => {
  accept();
  const result = runner.runVerifierStage({ runDir, root, configurationId: 'local', environment: 'isolated-node', sliceTags: ['cli'], requiredMode: 'never', runner: () => ({ executable: true, result: 'pass' }) });
  expect(result).toMatchObject({ required: true, gate: 'blocked', binding_status: 'bound', reason: expect.stringContaining('native') });
  expect(result.parent_outcome.obligations[0]).toMatchObject({ id: 'O-CLI', status: 'missing', check_ids: ['C-CLI'] });
});
test('OC006: contract JSON alone cannot manufacture parent acceptance without its owning lifecycle binding', () => {
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(runner.verificationPaths({ runDir }).contractPath, JSON.stringify({ ...contract, accepted_at: '2026-10-27T00:00:00Z' }));
  expect(runner.requireAcceptedVerificationContract({ runDir })).toMatchObject({ accepted: false, reason: expect.stringContaining('migration_required') });
});

test('OC005: revision delegates authority to the existing verifier and binds exact predecessor/successor hashes', () => {
  const specification = require('../../scripts/specflow-specification.cjs');
  const old = outcome.outcomeHash(contract); contract.outcome_contract.goal += ' revised';
  const next = outcome.outcomeHash(contract);
  fs.writeFileSync(path.join(root, 'amendment-record.json'), JSON.stringify({ issue: { number: 1 } }));
  // Only the external authority boundary is substituted here; its detached
  // signature/owner-negative controls execute in spec-density-workflow.test.js.
  const spy = jest.spyOn(specification, 'ownerException').mockReturnValue({ reason: `outcome-amendment:${old}:${next}` });
  const amendment = { record: 'amendment-record.json', commentId: '1', signatureFile: 'owner-signed.json' };
  try {
    expect(() => outcome.authorizeRevision(root, old, contract, amendment)).not.toThrow();
    expect(spy).toHaveBeenCalledWith(root, { issue: { number: 1 } }, '1', { signatureFile: 'owner-signed.json' });
    spy.mockReturnValue({ reason: `outcome-amendment:${old}:wrong-scope` });
    expect(() => outcome.authorizeRevision(root, old, contract, amendment)).toThrow(/exact old\/new/);
    spy.mockImplementation(() => { throw Error('Invalid detached owner authorization'); });
    expect(() => outcome.authorizeRevision(root, old, contract, amendment)).toThrow(/Invalid detached/);
  } finally { spy.mockRestore(); }
});
test('OC001: optional context alone does not force a CLI runtime stage or manufacture parent acceptance', () => {
  contract.outcome_contract.obligations[0].required = false; contract.runtime_checks[0].required = false;
  accept();
  expect(runner.runVerifierStage({ runDir, sliceTags: ['cli'] }).status).toBe('not_required');
  expect(runner.verifierTrace({ runDir }).parent_outcome.status).toBe('unverified');
});

test('OC006: real feature-build rail cannot bypass a required CLI parent with mode never', () => {
  accept();
  const runContractPath = path.join(runDir, 'run-contract.yaml');
  fs.writeFileSync(runContractPath, yaml.dump({ run_contract: {
    ...require('../helpers/spec-density').fixture(root), loop: 'feature-build', goal: 'CLI outcome', input_artifact: '#132',
    path: 'templates/QA/loops/feature-build.yaml', current_stage_or_rail: '6_provenance', next_gate: 'provenance',
    durable_evidence: [runContractPath], stop_condition: 'handoff', never_without_human: ['git push'], slice_tags: ['cli'], verifier_required_mode: 'never',
  } }));
  const result = runner.runLoop({ contract: runContractPath, noAdapterRouting: true, repoRoot: root, configurationId: 'local', environment: 'isolated-node' });
  expect(result).toMatchObject({ status: 'blocked_verifier_stage', verifier_stage: { required: true, binding_status: 'bound', reason: expect.stringContaining('native') } });
});
test('OC002: Gate B contract reference is schema-validated as well as consumed', () => {
  const base = { loop: 'spec-build', goal: 'goal', input_artifact: '#132', path: 'loop.yml', current_stage_or_rail: 'GATE_B', next_gate: 'graph', durable_evidence: ['artifact'], stop_condition: 'handoff', never_without_human: ['git push'] };
  expect(runner.validateRunContract({ ...base, verification_contract_path: 'docs/accepted.json' }).ok).toBe(true);
  for (const value of [true, [], '', '../outside.json', '/tmp/outside.json']) expect(runner.validateRunContract({ ...base, verification_contract_path: value }).ok).toBe(false);
});

test('OC003: a demonstrated circular expected/actual report cannot replace the independent fixed oracle', () => {
  const circular = cp.spawnSync(process.execPath, ['-e', 'const actual=2400; console.log(JSON.stringify({expected:actual,actual}))'], { encoding: 'utf8' });
  expect(circular.status).toBe(0);
  const report = JSON.parse(circular.stdout), independent = JSON.parse(fs.readFileSync(path.join(root, 'expected.json')));
  expect(report.actual).toBe(report.expected); // The deliberately circular comparison would say green.
  expect(report.actual).not.toBe(independent.balance); // Independent fixed reference falsifies it.
});
test('OC004/006: existing trace consumes binding freshness without claiming a binding proves execution', () => {
  accept();
  runner.runVerifierStage({ runDir, root, configurationId: 'local', environment: 'isolated-node', sliceTags: ['cli'] });
  expect(runner.verifierTrace({ runDir, root }).parent_outcome).toMatchObject({ status: 'unverified', binding_status: 'current' });
  fs.appendFileSync(path.join(root, 'transform.cjs'), '\n// source change, same output\n');
  expect(runner.verifierTrace({ runDir, root }).parent_outcome).toMatchObject({ status: 'unverified', binding_status: 'stale', reason: expect.stringContaining('rerun required checks') });
  runner.runVerifierStage({ runDir, root, configurationId: 'local', environment: 'isolated-node', sliceTags: ['cli'] });
  expect(runner.verifierTrace({ runDir, root }).parent_outcome).toMatchObject({ status: 'unverified', binding_status: 'current' });
});

test('OC005: fresh independent acceptance of a changed execution command does not invent an owner checkpoint when obligations/oracles/support are unchanged', () => {
  accept();
  contract.runtime_checks[0].command = 'node transform.cjs input.txt --new-implementation';
  expect(() => accept()).not.toThrow();
  expect(runner.requireAcceptedVerificationContract({ runDir }).accepted).toBe(true);
});

test.each(['missing', 'failed', 'stale', 'unsupported', 'waived', 'passed'])('OC006: shared %s state stays distinct and a projection never grants parent acceptance', state => {
  const result = outcome.readiness(contract, { checkStates: { 'C-CLI': state } });
  expect(outcome.obligationStateSchema.safeParse(state).success).toBe(true);
  expect(result).toMatchObject({ status: 'unverified', obligations: [{ id: 'O-CLI', status: state }] });
});
test('OC006: one failed/stale required check cannot roll up to passed', () => {
  contract.outcome_contract.obligations[0].check_ids.push('C-OTHER');
  contract.runtime_checks.push({ ...contract.runtime_checks[0], id: 'C-OTHER' });
  for (const status of ['failed', 'stale', 'missing', 'unsupported', 'waived']) {
    expect(outcome.readiness(contract, { checkStates: { 'C-CLI': 'passed', 'C-OTHER': status } }).obligations[0].status).toBe(status);
  }
});
test('OC006: human skip is a visible waiver on the actual runner and trace, never passed parent evidence', () => {
  accept();
  const result = runner.runVerifierStage({ runDir, root, sliceTags: ['cli'], humanSkip: { approved_by: 'fixture-owner', reason: 'isolated test environment unavailable' } });
  expect(result).toMatchObject({ gate: 'skipped', parent_outcome: { status: 'unverified', obligations: [{ status: 'waived' }] } });
  expect(runner.verifierTrace({ runDir, root }).parent_outcome).toMatchObject({ status: 'unverified', obligations: [{ status: 'waived' }] });
});

test('OC002: mixed existing local requirement references are not reinterpreted as unknown parent obligations', () => {
  const docs = documents(); docs[0].document.contract_meta.covers_reqs.push('REQ-LOCAL-001');
  expect(outcome.coverage(contract, docs).ok).toBe(true);
});

test('OC001 migration: an actual isolated copy without the new schema dependency preserves legacy helpers and blocks parent readiness actionably', () => {
  fs.copyFileSync(path.resolve(__dirname, '../../scripts/outcome-contract.cjs'), path.join(root, 'standalone.cjs'));
  const result = cp.spawnSync(process.execPath, ['-e', "const o=require('./standalone.cjs');console.log(JSON.stringify({legacy:o.readiness({}),hash:o.contractHash({journey_id:'J'}),parent:o.validate({outcome_contract:{}})}))"], { cwd: root, encoding: 'utf8', env: { ...process.env, NODE_PATH: '' } });
  expect(result.status).toBe(0);
  const report = JSON.parse(result.stdout);
  expect(report.legacy.status).toBe('migration_required'); expect(report.hash).toMatch(/^[a-f0-9]{64}$/);
  expect(report.parent).toMatchObject({ ok: false, errors: [expect.stringContaining('install zod@4.6.7')] });
});
