// Synthetic process fixtures for the existing acceptance engine, not product rules.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const { oracleFixture } = require('./oracle-execution');
const { fixture } = require('./native-execution');
const inventory = require('../fixtures/outcome-corpus-v1/cases.json');
const ROOT = process.env.SPECFLOW_TEST_PACKAGE_ROOT || path.resolve(__dirname, '../..');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fields = ['id', 'version', 'amount', 'unit', 'period', 'events'];
function ledger(row) {
  const env = oracleFixture();
  const input = JSON.parse(fs.readFileSync(env.root + '/input.json'));
  input.forEach((r, i) => Object.assign(r, { unit: 'synthetic-credit', period: 'fixture-period-' + (i ? 'B' : 'A'), events: ['event-' + (i ? 'B' : 'A')] }));
  fs.writeFileSync(env.root + '/input.json', JSON.stringify(input));
  // Faults are applied to a real input-derived producer. Never copy fixed_actual
  // or the independent oracle into the implementation's output.
  const faults = {
    wrong: 'records.forEach(r=>r.amount=2400);',
    offsetting: 'records[0].amount+=10;records[1].amount-=10;',
    identity: '[records[0].id,records[1].id]=[records[1].id,records[0].id];',
    unit: "records[0].unit='wrong-unit';",
    period: "records[0].period='wrong-period';",
    event: 'records[0].events.push(records[0].events[0]);',
  };
  fs.writeFileSync(env.root + '/transform.cjs', `const fs=require('fs'),crypto=require('crypto');const raw=fs.readFileSync(process.argv[2]),source=crypto.createHash('sha256').update(raw).digest('hex');const records=JSON.parse(raw).map(r=>({id:r.id,version:r.version,amount:r.minutes*r.rate,unit:r.unit,period:r.period,events:[...r.events],source}));${faults[row.mutation] || ''}fs.writeFileSync(process.argv[3],JSON.stringify(records));process.stdout.write(JSON.stringify(records));`);
  fs.writeFileSync(env.root + '/oracle.json', JSON.stringify({ records: inventory.ledger_expected }));
  const comparisons = inventory.ledger_expected.flatMap((r, i) => fields.map(field => ({ id: `CV-${i ? 'B' : 'A'}-${field}`, check_id: 'C-correctness', case_id: 'cli.test.js::C-values', expected_pointer: `/records/${i}/${field}`, operator: 'exact' })));
  const obligation = env.contract.outcome_contract.obligations[0];
  obligation.oracle.sha256 = digest(fs.readFileSync(env.root + '/oracle.json'));
  obligation.oracle.comparisons = comparisons;
  obligation.oracle.method.reference = inventory.oracle_method + ' Record identity, units, periods and event arrays are fixed in the independently reviewed corpus.';
  env.contract.runtime_checks[0].execution.comparison_ids = comparisons.map(c => c.id);
  const writeRows = `const rows=records.flatMap((r,i)=>${JSON.stringify(fields)}.map(field=>({comparison_id:'CV-'+(i?'B':'A')+'-'+field,actual:r[field]})));if(process.env.SPECFLOW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,JSON.stringify(rows));`;
  const skipped = ['required-skip', 'forged'].includes(row.mutation);
  fs.writeFileSync(env.root + '/cli.test.js', `const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');let records,persisted;beforeAll(()=>{const dir=path.dirname(process.env.SPECFLOW_OBSERVATIONS_PATH||process.env.PLAYWRIGHT_JSON_OUTPUT_FILE);persisted=dir+'/product-output.json';const p=cp.spawnSync(process.execPath,[__dirname+'/transform.cjs',__dirname+'/input.json',persisted],{encoding:'utf8'});expect(p.status).toBe(0);records=JSON.parse(p.stdout);${skipped ? writeRows : ''}});test${skipped ? '.skip' : ''}('C-values',()=>{${row.mutation === 'missing-observation' ? "if(process.env.SPECFLOW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,'[' + ']');" : writeRows}});test('C-provenance',()=>{const raw=fs.readFileSync(__dirname+'/input.json'),input=JSON.parse(raw),source=crypto.createHash('sha256').update(raw).digest('hex');expect(records.map(r=>({id:r.id,version:r.version,source:r.source}))).toEqual(input.map(r=>({id:r.id,version:r.version,source})));});test('C-consistency',()=>expect(JSON.parse(fs.readFileSync(persisted))).toEqual(records));${row.mutation === 'stale-input' ? "afterAll(()=>fs.appendFileSync(__dirname+'/input.json','\\n'));" : ''}`);
  return env;
}
function cli(row) {
  const env = fixture({ broken: row.mutation === 'wrong', optionalSkip: row.mutation === 'optional-skip' });
  const file = env.root + '/cli.test.js';
  fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('expect(r.status)', "fs.writeFileSync(require('path').dirname(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE)+'/actual-output.txt',r.stdout);expect(r.status)"));
  env.contract.outcome_contract = { version: 1, goal: 'Uppercase the fixed nonfinancial CLI input exactly', configurations: [{ id: 'local', environment: 'isolated-node' }], assumptions: ['Synthetic process fixture'], unknowns: [], non_goals: ['product or financial qualification'], obligations: [{ id: 'O-cli', required: true, oracle: { path: 'expected.txt', sha256: digest(fs.readFileSync(env.root + '/expected.txt')) }, check_ids: [env.check.id], level: 'process', configuration_ids: ['local'] }] };
  return env;
}
function filesUnder(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesUnder(path.join(dir, e.name)) : [path.join(dir, e.name)]);
}
function runCase(row, runtime, outputDir) {
  const started = Date.now(), env = row.fixture === 'ledger' ? ledger(row) : cli(row);
  const sourceInput = row.fixture === 'ledger' ? 'input.json' : 'input.txt';
  const before = digest(fs.readFileSync(env.root + '/' + sourceInput));
  let directCalls = 0;
  try {
    const bin = env.root + '/fixture-bin'; fs.mkdirSync(bin);
    const npm = cp.execFileSync('which', ['npm'], { encoding: 'utf8' }).trim();
    fs.writeFileSync(bin + '/npm', `#!/bin/sh\nif [ "$1" = install ]; then exit 0; fi\nexec '${npm}' "$@"\n`, { mode: 0o700 });
    fs.writeFileSync(bin + '/gh', '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    for (const name of ['codex', 'claude']) fs.writeFileSync(bin + '/' + name, `#!/bin/sh\necho called > '${env.root}/provider-called'\nexit 99\n`, { mode: 0o700 });
    const processEnv = { ...process.env, PATH: bin + path.delimiter + process.env.PATH };
    directCalls++;
    const install = cp.spawnSync(process.execPath, [ROOT + '/bin/specflow.js', 'update', env.root, '--runtime', runtime], { env: processEnv, encoding: 'utf8', timeout: 90000, maxBuffer: 8 * 1024 * 1024 });
    if (install.status !== 0) throw Error('Fixture installation unavailable: ' + install.stderr + install.stdout);
    const bundle = require(ROOT + '/scripts/duo-runtime.cjs').bundle(ROOT);
    for (const [file, bytes] of Object.entries(bundle)) if (digest(fs.readFileSync(env.root + '/' + file)) !== digest(bytes)) throw Error('Installed helper differs: ' + file);
    env.accept();
    if (row.mutation === 'stale-oracle') fs.appendFileSync(env.root + '/oracle.json', '\n');
    if (row.mutation === 'missing-reference') fs.unlinkSync(env.root + '/oracle.json');
    if (row.mutation === 'parent-loss') {
      const file = require(ROOT + '/scripts/specflow-runner.cjs').verificationPaths({ runDir: env.runDir }).contractPath;
      const accepted = JSON.parse(fs.readFileSync(file)); accepted.outcome_contract.obligations = []; fs.writeFileSync(file, JSON.stringify(accepted));
    }
    if (row.mutation === 'forged') {
      fs.mkdirSync(env.runDir + '/runtime-evidence', { recursive: true });
      fs.writeFileSync(env.runDir + '/runtime-evidence/forged.json', JSON.stringify({ gate: 'pass', executed: 3, skipped: 0 }));
      fs.writeFileSync(env.runDir + '/verifier-findings.jsonl', JSON.stringify({ check_id: 'C-correctness', verifier_result: 'pass', execution: { result: 'pass', summary: { passed: 3, skipped: 0 } } }) + '\n');
    }
    const reportDir = env.root + '/.specflow/gate-d'; fs.mkdirSync(reportDir + '/evidence', { recursive: true });
    fs.writeFileSync(reportDir + '/journey-map.md', '- J: J-CLI — synthetic whole-outcome proof\n');
    fs.writeFileSync(reportDir + '/findings.md', '## J: J-CLI\nstatus: green\nevidence/report.json\n');
    fs.writeFileSync(reportDir + '/evidence/report.json', JSON.stringify({ note: 'Intentionally green report is not an oracle or acceptance authority' }));
    const request = env.root + '/.specflow/corpus-payload.json'; fs.writeFileSync(request, JSON.stringify({ target: env.root, runDir: env.runDir, reportDir }));
    const host = require('js-yaml').load(fs.readFileSync(ROOT + '/docs/contracts/feature_install_ux.yml', 'utf8')).capability_boundary.host_roots[runtime];
    directCalls++;
    const result = cp.spawnSync(process.execPath, [ROOT + '/' + host + '/scripts/gate.cjs', request], { env: processEnv, cwd: env.root, encoding: 'utf8', timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
    if (result.error) throw result.error;
    let actual; try { actual = JSON.parse(result.stdout); } catch { throw Error('Gate did not produce its result: ' + result.stderr + result.stdout); }
    const evidenceFiles = filesUnder(env.runDir), native = evidenceFiles.filter(f => path.basename(f) === 'execution.json').map(f => JSON.parse(fs.readFileSync(f)));
    const produced = evidenceFiles.filter(f => path.basename(f) === 'product-output.json').map(f => JSON.parse(fs.readFileSync(f)).map(r => Object.fromEntries(fields.map(field => [field, r[field]]))));
    const cliOutputs = evidenceFiles.filter(f => path.basename(f) === 'actual-output.txt').map(f => fs.readFileSync(f, 'utf8'));
    const destination = path.join(outputDir, runtime + '-' + row.id); fs.mkdirSync(destination, { recursive: true });
    fs.cpSync(env.runDir, destination + '/run', { recursive: true, filter: source => path.basename(source) !== 'cache' });
    fs.writeFileSync(destination + '/gate-stdout.json', result.stdout);
    fs.writeFileSync(destination + '/gate-stderr.txt', result.stderr);
    for (const name of ['input.json', 'input.txt', 'oracle.json', 'expected.txt', 'transform.cjs', 'cli.test.js', 'jest.config.cjs']) if (fs.existsSync(env.root + '/' + name)) fs.copyFileSync(env.root + '/' + name, destination + '/' + name);
    const sourceDir = path.resolve(__dirname, '../..');
    const git = args => cp.spawnSync('git', args, { cwd: sourceDir, encoding: 'utf8' });
    const revision = git(['rev-parse', 'HEAD']);
    const status = git(['status', '--porcelain', '--', 'tests/helpers/outcome-corpus.js', 'tests/contracts/outcome-corpus.test.js', 'tests/fixtures/outcome-corpus-v1/cases.json']);
    const sourceIdentity = { commit: revision.status === 0 ? revision.stdout.trim() : null, suite_worktree: status.status === 0 ? (status.stdout.trim() ? 'uncommitted' : 'clean') : 'unavailable', fixture_sha256: digest(fs.readFileSync(__filename)), journey_sha256: digest(fs.readFileSync(path.join(__dirname, '../contracts/outcome-corpus.test.js'))), inventory_sha256: digest(fs.readFileSync(path.join(__dirname, '../fixtures/outcome-corpus-v1/cases.json'))), core_bundle_sha256: digest(JSON.stringify(bundle)) };
    const value = { case_id: row.id, host: runtime, source_identity: sourceIdentity, package_identity: { version: JSON.parse(fs.readFileSync(ROOT + '/package.json')).version, manifest_sha256: digest(fs.readFileSync(ROOT + '/package.json')), installed_bundle_sha256: digest(JSON.stringify(bundle)), gate_sha256: digest(fs.readFileSync(env.root + '/scripts/teardown-gate.cjs')) }, run_identity: env.runDir, test_kind: 'synthetic real Node CLI/native Jest/installed host payload', expected: row, actual, gate_output_sha256: digest(result.stdout), exit_code: result.status, produced, cliOutputs, native, input_before: before, input_after: digest(fs.readFileSync(env.root + '/' + sourceInput)), provider_invoked: fs.existsSync(env.root + '/provider-called'), elapsed_ms: Date.now() - started, process_count: { observed_driver_children: directCalls, native_checker_invocations: native.length, note: 'Not a census of installer descendants or producer grandchildren' }, monetary_cost: null, cost_status: 'unknown', operator_interventions: 0, limitations: ['Dependencies pre-provisioned; npm install fetch is shimmed, generated native tests are real', 'Synthetic fixtures do not qualify a product or jurisdiction', 'Payload execution is not native plugin loading or publication', 'Archived receipts are evidence, not owning live stage handles'], archival_map: { original_prefix: env.runDir, archived_prefix: destination + '/run' } };
    fs.writeFileSync(destination + '/result.json', JSON.stringify(value, null, 2));
    return value;
  } finally { env.remove(); }
}
module.exports = { runCase, inventory, ROOT };
