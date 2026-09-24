const fs = require('fs'), os = require('os'), path = require('path');
const yaml = require('js-yaml');
const { runLoop, loopSequence } = require('../../scripts/specflow-runner.cjs');
const { fixture } = require('../helpers/spec-density');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'tier-runner-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function options(loop, extra = {}) {
  return { loop, slug: 'same-ticket', contract: path.join(root, 'run.yml'), ledger: path.join(root, 'ledger.jsonl'), repoRoot: root, noAdapterRouting: true, ...extra };
}
test.each(['codex', 'claude-code'])('%s fresh and resumed thin preparation records tier without requiring simulation', host => {
  const opts = options('spec-build', { runtime: host });
  runLoop(opts);
  expect(yaml.load(fs.readFileSync(opts.contract, 'utf8')).run_contract).toMatchObject({ tier: 'thin', simulation_required: false });
  const result = runLoop(opts);
  expect(result.status).not.toBe('blocked_specification');
  expect(yaml.load(fs.readFileSync(opts.contract, 'utf8')).run_contract.tier_warnings).toHaveLength(1);
});
test.each(['codex', 'claude-code'])('%s production start and legacy resume fail closed without evidence', host => {
  const opts = options('feature-build', { runtime: host });
  for (let n = 0; n < 2; n++) expect(runLoop(opts).status).toBe('blocked_specification');
});
test('conflicting labels block before a stage can execute', () => {
  const { tier_record: file } = fixture(root), record = JSON.parse(fs.readFileSync(file));
  record.issue.labels.push('spec:thin'); fs.writeFileSync(file, JSON.stringify(record));
  const result = runLoop(options('feature-build', { tierRecord: file }));
  expect(result.status).toBe('blocked_specification');
  expect(result.decision.errors.join(' ')).toContain('Conflicting tier labels');
});
test('resuming cannot reuse a previously recorded tier after the evidence changes', () => {
  const { tier_record: file } = fixture(root), opts = options('feature-build', { tierRecord: file });
  runLoop(opts);
  expect(yaml.load(fs.readFileSync(opts.contract, 'utf8')).run_contract).toMatchObject({ tier: 'build-ready', simulation_required: true });
  fs.writeFileSync(path.join(root, 'tier-preflight'), 'changed');
  expect(runLoop(opts).status).toBe('blocked_specification');
});
test('thin preparation skips automatic full adversary and pre-flight stages', () => {
  expect(loopSequence({ loop: 'spec-build', tier: 'thin' })).toEqual(['discover', 'draft', 'tickets', 'handoff']);
  expect(loopSequence({ loop: 'spec-build', tier: 'contracted' })).toEqual(['discover', 'draft', 'adversary', 'tickets', 'handoff']);
});
test.each(['codex','claude-code'])('%s spec-build cannot dispatch a third adversary or preflight review through an adapter',host=>{
 const reviews=require('../../scripts/specflow-reviews.cjs');
 for(const [stage,tier]of [['adversary','contracted'],['GATE_B5','build-ready']]){
  const {tier_record:file}=fixture(root);const r=JSON.parse(fs.readFileSync(file));
  for(let i=0;i<2;i++){r.profile.repair=i;const reservation=reviews.begin(root,r,tier,host);reviews.fail(root,reservation,'Simulated unavailable peer; attempt is retained');}
  fs.writeFileSync(file,JSON.stringify(r));
  const opts=options('spec-build',{runtime:host,tierRecord:file,contract:path.join(root,`${stage}.yml`),ledger:path.join(root,`${stage}.jsonl`)});
  runLoop(opts);const saved=yaml.load(fs.readFileSync(opts.contract,'utf8'));saved.run_contract.current_stage_or_rail=stage;fs.writeFileSync(opts.contract,yaml.dump(saved));
  const result=runLoop({...opts,adapterPolicy:'should-never-be-opened.json'});
  expect(result.status).toBe('scoped_review_required');expect(result.entry.attempts).toBe(2);expect(result.entry.next_action).toContain('budget exhausted');
  expect(reviews.load(root,r.issue.number).reviews[tier]).toHaveLength(2);
 }
});
