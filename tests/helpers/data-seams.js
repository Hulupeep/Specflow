// Project-owned synthetic interface facts. Runtime/API qualification is added by
// individual tests; these declarations alone never prove an actual connection.
const fs = require('fs');
const crypto = require('crypto');
const { oracleFixture } = require('./oracle-execution');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function dataFixture() {
  const env = oracleFixture();
  const field = (type, extra = {}) => ({ type, required: true, nullable: false, unit: null, reference: null, effective: 'record-version', ...extra });
  const facts = { interface_id: 'calculation', revision: '1', supported_revisions: ['1'], fields: {
    amount: field('number', { unit: 'minutes' }),
    calculation_result_id: field('string', { reference: 'calculation-result' }), version: field('integer'),
  } };
  for (const file of ['expected-interface.json', 'producer.schema.json', 'consumer.schema.json']) fs.writeFileSync(env.root + '/' + file, JSON.stringify(facts));
  const endpoint = file => ({ interface_id: 'calculation', schema_ref: { adapter: 'json-interface-v1', path: file, pointer: '' } });
  const manifest = { version: 2, tickets: [
    { id: 'producer', writes: [endpoint('producer.schema.json')], reads: [], adrs: ['ADR-1'], reuses: ['existing-service'] },
    { id: 'consumer', writes: [], reads: [endpoint('consumer.schema.json')], adrs: ['ADR-1'], reuses: ['existing-service'] },
  ] };
  fs.writeFileSync(env.root + '/tickets.json', JSON.stringify(manifest));
  for (const c of env.contract.runtime_checks) { c.verification_level = 'integration'; c.boundaries = ['process:producer', 'process:consumer', 'filesystem']; }
  env.contract.runtime_checks[0].execution.seam_ids = ['S-calculation'];
  env.contract.outcome_contract.obligations[0].level = 'integration';
  env.contract.outcome_contract.data_seams = [{ id: 'S-calculation', required: true, manifest_path: 'tickets.json',
    producer_ids: ['producer'], consumer_ids: ['consumer'], obligation_ids: ['O-values'], check_ids: ['C-correctness'],
    expected_ref: { path: 'expected-interface.json', sha256: sha(fs.readFileSync(env.root + '/expected-interface.json')), pointer: '' } }];
  const contractFile = env.root + '/.specflow/proposed-verification.json';
  const save = () => fs.writeFileSync(contractFile, JSON.stringify(env.contract)); save();
  return { ...env, facts, manifest, contractFile, save, writeFacts: (file, value) => fs.writeFileSync(env.root + '/' + file, JSON.stringify(value)) };
}
module.exports = { dataFixture };

function apiFixture({ lyingRuntime = false } = {}) {
  const env = dataFixture();
  const source = (fn, options = {}) => 'const options=' + JSON.stringify(options) + ';\n(' + fn.toString() + ')();\n';
  fs.writeFileSync(env.root + '/producer.cjs', source(function () {
    const fs = require('fs'), http = require('http'), crypto = require('crypto');
    const facts = JSON.parse(fs.readFileSync(__dirname + '/producer.schema.json'));
    const server = http.createServer((req, res) => {
      const raw = fs.readFileSync(__dirname + '/input.json'), input = JSON.parse(raw);
      const source = crypto.createHash('sha256').update(raw).digest('hex');
      const rows = input.map(r => ({ amount: r.minutes * r.rate, unit: options.lyingRuntime ? 'days' : facts.fields.amount.unit,
        calculation_result_id: r.id, version: r.version, source }));
      for (const row of rows) for (const [name, rule] of Object.entries(facts.fields)) {
        if (rule.required && row[name] === undefined || !rule.nullable && row[name] === null) { res.writeHead(500); return res.end('producer schema violation'); }
      }
      res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ revision: facts.revision, rows }));
    });
    server.listen(0, '127.0.0.1', () => process.stdout.write(JSON.stringify({ port: server.address().port }) + '\n'));
  }, { lyingRuntime }));
  fs.writeFileSync(env.root + '/consumer.cjs', source(function () {
    const fs = require('fs'), http = require('http');
    const facts = JSON.parse(fs.readFileSync(__dirname + '/consumer.schema.json'));
    http.get(process.argv[2], res => {
      let raw = ''; res.on('data', data => raw += data); res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw Error('producer response rejected');
          const body = JSON.parse(raw);
          if (!facts.supported_revisions.includes(body.revision)) throw Error('unsupported actual revision');
          for (const row of body.rows) for (const [name, rule] of Object.entries(facts.fields)) {
            const value = row[name];
            if (value === undefined && rule.required || value === null && !rule.nullable) throw Error('missing/null actual field ' + name);
            if (value !== undefined && value !== null && (rule.type === 'integer' ? !Number.isInteger(value) : typeof value !== rule.type)) throw Error('actual type mismatch ' + name);
            if (!options.lyingRuntime && rule.unit && row.unit !== rule.unit) throw Error('actual unit mismatch');
          }
          fs.writeFileSync(process.argv[3], JSON.stringify(body)); process.stdout.write(JSON.stringify(body));
        } catch (error) { process.stderr.write(error.message); process.exitCode = 2; }
      });
    }).on('error', error => { process.stderr.write(error.message); process.exitCode = 2; });
  }, { lyingRuntime }));
  fs.writeFileSync(env.root + '/cli.test.js', String.raw`const fs=require('fs'),cp=require('child_process'),path=require('path'),crypto=require('crypto');
let producer,body,persisted;
beforeAll(async()=>{
 producer=cp.spawn(process.execPath,[__dirname+'/producer.cjs'],{stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{let raw='';producer.on('error',reject);producer.stdout.on('data',chunk=>{raw+=chunk;if(raw.includes('\n')){try{resolve(JSON.parse(raw.trim()).port);}catch(e){reject(e);}}});producer.on('exit',code=>reject(Error('producer exited '+code)));});
 const dir=path.dirname(process.env.SPECFLOW_OBSERVATIONS_PATH||process.env.PLAYWRIGHT_JSON_OUTPUT_FILE);persisted=path.join(dir,'consumer-output.json');
 const actual=cp.spawnSync(process.execPath,[__dirname+'/consumer.cjs','http://127.0.0.1:'+port+'/records',persisted],{encoding:'utf8',timeout:3000});expect({status:actual.status,stderr:actual.stderr}).toMatchObject({status:0});body=JSON.parse(actual.stdout);
});
afterAll(async()=>{if(producer&&producer.exitCode===null)await new Promise(resolve=>{producer.once('exit',resolve);producer.kill('SIGTERM');});});
test('C-values',()=>{if(process.env.SPECFLOW_OBSERVATIONS_PATH)fs.writeFileSync(process.env.SPECFLOW_OBSERVATIONS_PATH,JSON.stringify(body.rows.map((row,index)=>({comparison_id:index?'CV-second':'CV-first',actual:{amount:row.amount,unit:row.unit,calculation_result_id:row.calculation_result_id,version:row.version}}))));});
test('C-provenance',()=>{const raw=fs.readFileSync(__dirname+'/input.json'),input=JSON.parse(raw),source=crypto.createHash('sha256').update(raw).digest('hex');expect(body.rows.map(r=>({id:r.calculation_result_id,version:r.version,source:r.source}))).toEqual(input.map(r=>({id:r.id,version:r.version,source})));});
test('C-consistency',()=>{expect(JSON.parse(fs.readFileSync(persisted))).toEqual(body);});
`);
  const expected = { first: { amount: 900, unit: 'minutes', calculation_result_id: 'record-A', version: 1 }, second: { amount: 90, unit: 'minutes', calculation_result_id: 'record-B', version: 1 } };
  fs.writeFileSync(env.root + '/oracle.json', JSON.stringify(expected));
  env.contract.outcome_contract.obligations[0].oracle.sha256 = sha(fs.readFileSync(env.root + '/oracle.json'));
  env.contract.outcome_contract.obligations[0].oracle.method.reference = 'Independent fixed 900/90 matrix plus accepted minutes and immutable record-A/record-B version1; no call to implementation.';
  for (const c of env.contract.runtime_checks) { c.boundaries = ['http:producer', 'process:consumer', 'filesystem']; c.checker_paths = ['cli.test.js', 'producer.cjs', 'consumer.cjs']; }
  env.save();
  return env;
}
module.exports.apiFixture = apiFixture;
