// Independently expected synthetic values; real CLI, persistence and native Jest.
const fs = require('fs');
const cp = require('child_process');
const { fixture } = require('./native-execution');
const { hashValue } = require('../../scripts/outcome-contract.cjs');
const crypto = require('crypto');
function oracleFixture({ mode = 'normal', observations = 'normal', skipRequired = false, retry = false } = {}) {
  const env = fixture();
  const inputs = [{ id: 'record-A', version: 1, minutes: 15, rate: 60 }, { id: 'record-B', version: 1, minutes: 1.5, rate: 60 }];
  fs.writeFileSync(env.root + '/input.json', JSON.stringify(inputs));
  fs.writeFileSync(env.root + '/oracle.json', JSON.stringify({ first: 900, second: 90 }));
  fs.writeFileSync(env.root + '/transform.cjs', `const fs=require('fs'),crypto=require('crypto');
const raw=fs.readFileSync(process.argv[2]),source=crypto.createHash('sha256').update(raw).digest('hex');
const records=JSON.parse(raw).map(r=>({id:r.id,version:r.version,source,amount:${mode === 'wrong' ? '2400' : mode === 'hardcoded' ? '900' : 'r.minutes*r.rate'}}));
fs.writeFileSync(process.argv[3],JSON.stringify(records));process.stdout.write(JSON.stringify(records));`);
  fs.writeFileSync(env.root + '/cli.test.js', `const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
let records,persisted,valueAttempts=0;${retry ? 'jest.retryTimes(1);' : ''}
beforeAll(()=>{const dir=path.dirname(process.env.SPECFLOW_OBSERVATIONS_PATH||process.env.PLAYWRIGHT_JSON_OUTPUT_FILE);persisted=path.join(dir,'product-output.json');const result=cp.spawnSync(process.execPath,[__dirname+'/transform.cjs',__dirname+'/input.json',persisted],{encoding:'utf8'});expect(result.status).toBe(0);records=JSON.parse(result.stdout);${skipRequired ? "if(process.env.SPECFLOW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,JSON.stringify([{comparison_id:'CV-first',actual:900},{comparison_id:'CV-second',actual:90}]));" : ''}});
test${skipRequired ? '.skip' : ''}('C-values',()=>{if(process.env.SPECFLOW_OBSERVATIONS_PATH){const rows=[{comparison_id:'CV-first',actual:records[0].amount},{comparison_id:'CV-second',actual:records[1].amount}];${observations === 'missing' ? '' : observations === 'duplicate' ? "rows.push(rows[0]);fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,JSON.stringify(rows));" : observations === 'unknown' ? "rows[0].comparison_id='foreign';fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,JSON.stringify(rows));" : observations === 'symlink' ? "fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH+'.target',JSON.stringify(rows));fs.symlinkSync(process.env.SPECFLOW_OBSERVATIONS_PATH+'.target',process.env.SPECFLOW_OBSERVATIONS_PATH);" : 'fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,JSON.stringify(rows));'}}${retry ? "expect(++valueAttempts).toBe(2);" : ''}});
test('C-provenance',()=>{const raw=fs.readFileSync(__dirname+'/input.json'),input=JSON.parse(raw),source=crypto.createHash('sha256').update(raw).digest('hex');expect(records.map(r=>({id:r.id,version:r.version,source:r.source}))).toEqual(input.map(r=>({id:r.id,version:r.version,source})));});
test('C-consistency',()=>{expect(JSON.parse(fs.readFileSync(persisted))).toEqual(records);});`);
  const base = JSON.parse(JSON.stringify(env.check));
  base.input_paths = ['input.json'];
  base.execution.required_case_ids = ['cli.test.js::C-values', 'cli.test.js::C-provenance', 'cli.test.js::C-consistency'];
  const checks = ['correctness', 'provenance', 'consistency'].map(kind => ({ ...JSON.parse(JSON.stringify(base)),
    id: 'C-' + kind, execution: { ...JSON.parse(JSON.stringify(base.execution)), claim_kind: kind, comparison_ids: kind === 'correctness' ? ['CV-first', 'CV-second'] : [] } }));
  env.contract.runtime_checks = checks;
  const oracleBytes = fs.readFileSync(env.root + '/oracle.json');
  env.contract.outcome_contract = {
    version: 1, goal: 'Independently correct synthetic duration/rate values across a real CLI and its persisted output',
    configurations: [{ id: 'local', environment: 'isolated-node' }], assumptions: ['Synthetic inputs; not a product or database qualification'], unknowns: [], non_goals: [],
    obligations: [{ id: 'O-values', required: true, value_bearing: true, required_claims: ['correctness', 'provenance', 'consistency'],
      check_ids: checks.map(c => c.id), level: 'process', configuration_ids: ['local'],
      oracle: { path: 'oracle.json', sha256: crypto.createHash('sha256').update(oracleBytes).digest('hex'),
        method: { kind: 'independent_fixture', reference: 'Hand-calculated fixed matrix: 15 times 60 = 900; 1.5 times 60 = 90; no call to the implementation.' },
        comparisons: ['first', 'second'].map(name => ({ id: 'CV-' + name, check_id: 'C-correctness', case_id: 'cli.test.js::C-values', expected_pointer: '/' + name, operator: 'exact' })) } }],
  };
  cp.execFileSync('git', ['add', '.'], { cwd: env.root });
  cp.execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'test: independently expected oracle fixture (#70)'], { cwd: env.root });
  return { ...env, checks, oracleDigest: hashValue(env.contract.outcome_contract) };
}
module.exports = { oracleFixture };
