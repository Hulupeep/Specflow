const fs = require('fs'), path = require('path'), { spawn } = require('child_process');
const routing = require('../../scripts/typesafe-routing.cjs');
const { setup, manifest, task, fetchImpl } = require('../helpers/routing-study.cjs');
let f, key;
beforeEach(() => { key = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = 'fixture-key'; f = setup(); });
afterEach(() => { f.close(); if (key === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = key; });
async function add(t) { const r = await routing.observe(f.dir, t, { fetchImpl }); routing.terminal(f.dir, t.runId, 'completed', ['raw.json'], t.repository); return r; }
test('J-TSAFE-ROUTING-RESUME / REPORT: 9 → retry → 10; pending presentation and ack survive replay without calls', async () => {
  for (let i = 0; i < 9; i++) await add(task(i));
  expect(routing.reports(f.dir)).toEqual([]);
  await add(task(1, { attempt: 1, runId: 'retry' }));
  expect(routing.summary(f.study).attemptedFamilies).toBe(9);
  const r = await add(task(9));
  const reports = routing.reports(f.dir); expect(reports).toHaveLength(1); expect(reports[0].delivery).toBe('pending');
  expect(routing.read(reports[0].file)).toMatchObject({ checkpoint: 'shadow-10', attemptedFamilies: 10, recommendation: 'insufficient_evidence' });
  const never = jest.fn(() => { throw Error('replay must not dispatch'); });
  await routing.observe(f.dir, task(9), { fetchImpl: never }); expect(never).not.toHaveBeenCalled();
  expect(routing.reports(f.dir)).toEqual(reports);
  routing.acknowledge(f.dir, reports[0].reportId);
  expect(routing.reports(f.dir)[0].delivery).toBe('delivered');
  await expect(routing.observe(f.dir, task(9, { acceptance: 'changed' }), { fetchImpl })).rejects.toThrow('changed');
  expect(r.decisionId).toBeTruthy();
});
test('30 attempted families disclose missing coverage and unavailable results; independent ambiguous labels are not wrong facts', async () => {
  for (let i = 0; i < 30; i++) await add(task(i));
  const first = routing.events(f.study).find(e => e.type === 'observation');
  routing.labels(f.dir, { decisionId: first.decisionId, inputHash: first.inputHash, reviewer: 'independent-fixture', blinded: true, evidenceRefs: ['label-review.txt'], labels: { ambiguity: null, coupling: 'local', risk: 'ordinary', evidence: 'sufficient', failure: 'none' } });
  const refs = routing.reports(f.dir, true), report = refs.map(r => routing.read(r.file)).find(r => r.checkpoint.startsWith('manual-'));
  expect(report.judgmentAccuracy).toMatchObject({ correct: 4, wrong: 0, ambiguous: 1, missing: 29 });
  expect(report).toMatchObject({ attemptedFamilies: 30, coverage: { sufficient: false }, recommendation: 'insufficient_evidence', benefit: null });
  expect(refs.map(r => routing.read(r.file).checkpoint)).toContain('shadow-30');
});
function contender(dir, key, repository) {
  const script = `const r=require(${JSON.stringify(path.resolve(__dirname, '../../scripts/typesafe-routing.cjs'))});try{console.log(JSON.stringify(r.reserve(r.load(process.argv[1]),'typesafe',process.argv[2],{repository:process.argv[3],runId:'shared'})));}catch(e){console.log(JSON.stringify({admitted:false,reason:e.message}));}`;
  return new Promise((resolve, reject) => { const p = spawn(process.execPath, ['-e', script, dir, key, repository]); let out = ''; p.stdout.on('data', b => out += b); p.on('error', reject); p.on('close', () => resolve(JSON.parse(out))); });
}
test('two projects racing last reservation cannot exceed cap; crash/unknown dispatch never refunds', async () => {
  f.close(); const m = manifest(['https://github.com/test/one', 'https://github.com/test/two']); m.budget.typesafe = 1; f = setup(m);
  const results = await Promise.all([contender(f.dir, 'a', m.projects[0]), contender(f.dir, 'b', m.projects[1])]);
  expect(results.filter(r => r.admitted)).toHaveLength(1);
  expect(routing.events(f.study).filter(e => e.type === 'reservation')).toHaveLength(1);
  expect(routing.reserve(f.study, 'typesafe', 'retry', { repository: m.projects[1], runId: 'retry' }).admitted).toBe(false);
  expect(routing.reports(f.dir).map(r => routing.read(r.file).checkpoint)).toContain('budget-stop');
});
test('zero caps, per-run caps, inaccessible lock and recursive calls fail closed', async () => {
  f.close(); const m = manifest(); m.budget.native = 0; m.maxPerRun.typesafe = 1; f = setup(m);
  expect(routing.reserve(f.study, 'native', 'zero').admitted).toBe(false);
  const t = task(1); await routing.observe(f.dir, t, { fetchImpl });
  expect(await routing.observe(f.dir, { ...t, attempt: 1 }, { fetchImpl })).toMatchObject({ status: 'unavailable', reason: 'budget_exhausted' });
  routing.lock(f.study, () => expect(() => routing.reserve(f.study, 'native', 'blocked')).toThrow('busy'));
  process.env.SPECFLOW_DUO_REVIEWER = '1';
  try { expect(() => routing.reserve(f.study, 'native', 'recursive')).toThrow('Reviewer'); await expect(routing.observe(f.dir, task(2))).rejects.toThrow('Reviewer'); } finally { delete process.env.SPECFLOW_DUO_REVIEWER; }
});
test('interrupted reservation is retained and replayed as unavailable, never redispatched', async () => {
  const t = task(2), id = require('../../scripts/typesafe-client.cjs').hash({ cohort: f.study.manifest.cohortId, repository: t.repository, run: t.runId, stage: t.stage, attempt: t.attempt, snapshot: t.snapshotHash });
  routing.reserve(f.study, 'typesafe', id, t);
  const never = jest.fn(); expect(await routing.observe(f.dir, t, { fetchImpl: never })).toMatchObject({ status: 'unavailable', reason: 'interrupted' }); expect(never).not.toHaveBeenCalled();
  routing.terminal(f.dir, t.runId, 'interrupted', [], t.repository);
  expect(routing.summary(f.study)).toMatchObject({ attemptedFamilies: 1, unavailableFamilies: 1, counts: { interrupted: 1 } });
});

test('canonical issue aliases cannot inflate family samples', async () => {
  await add(task(1,{taskFamilyId:'#42'})); await add(task(2,{taskFamilyId:'issue 42'})); await add(task(3,{taskFamilyId:'https://github.com/test/one/issues/42'}));
  expect(routing.summary(f.study).attemptedFamilies).toBe(1);
});

test('last available study reservation itself emits budget-stop, without requiring an extra call', () => {
  f.close();const m=manifest();m.budget.typesafe=1;f=setup(m);expect(routing.reserve(f.study,'typesafe','last').admitted).toBe(true);
  expect(routing.events(f.study).find(e=>e.type==='budget-stop')).toMatchObject({kind:'typesafe',used:1});
});
