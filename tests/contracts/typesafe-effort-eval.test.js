const fs = require('fs'), path = require('path');
const routing = require('../../scripts/typesafe-routing.cjs'), trial = require('../../scripts/typesafe-effort-trial.cjs'), analysis = require('../../scripts/typesafe-effort-analysis.cjs');
const { setup, manifest, fetchImpl, caseInput, nativeDouble } = require('../helpers/routing-study.cjs');
let f, key;
beforeEach(() => { key = process.env.TYPESAFE_API_KEY; process.env.TYPESAFE_API_KEY = 'fixture-key'; const c = caseInput(), m = manifest(); m.heldoutFamilies = [routing.familyKey(c.repository, c.taskFamilyId)]; f = setup(m); });
afterEach(() => { f.close(); if (key === undefined) delete process.env.TYPESAFE_API_KEY; else process.env.TYPESAFE_API_KEY = key; });
test('J-TSAFE-EFFORT-EVAL: actual isolated oracle; native transport doubles clearly labelled, blinded read receipts, replay without more calls', async () => {
  const calls = []; const execute = (cmd, args, opts) => { calls.push({ cmd, args, input: opts.input }); return nativeDouble(cmd, args, opts); };
  const receipt = await trial.trial(f.dir, caseInput(), { fetchImpl, execute });
  const result = routing.read(receipt.resultRef);
  expect(result.transport).toBe('simulated'); expect(calls).toHaveLength(4);
  for (const effort of ['medium', 'high']) {
    const arm = result.arms[effort]; expect(arm).toMatchObject({ requestedEffort: effort, observedEffort: effort, accepted: true, requiredChecks: 1, executedChecks: 1, skipped: 0, repairRounds: 0, reviewRounds: 1 });
    const peer = routing.read(arm.reviewRef); expect(peer.access.receipts[0].extent).toBe('full');
    expect(peer.input).not.toHaveProperty('effort'); expect(peer.input).not.toHaveProperty('proposed');
    expect(routing.read(arm.oracleRef).transport).toBe('live');
  }
  const before = calls.length; expect(await trial.trial(f.dir, caseInput(), { fetchImpl, execute })).toMatchObject({ status: 'replay' }); expect(calls.length).toBe(before);
  expect(analysis.analyze(f.study.manifest, [result], routing.events(f.study).filter(e => e.type === 'observation'))).toMatchObject({ attemptedFamilies: 1, comparableFamilies: 0, recommendation: 'insufficient_evidence' });
  await expect(trial.trial(f.dir, { ...caseInput(), acceptance: 'relaxed' }, { fetchImpl, execute })).rejects.toThrow('frozen');
});
test('effective settings missing, fallback and clamps are not inferred from requested flags', () => {
  expect(trial.metadata({ stdout: JSON.stringify({ type: 'system', subtype: 'init', model: 'claude-opus-5-5' }) })).toMatchObject({ observedEffort: null });
  expect(trial.metadata({ stdout: [{ type: 'system', subtype: 'init', model: 'claude-opus-5-5', effort: 'medium' }, { type: 'assistant', message: { model: 'substitute' } }].map(JSON.stringify).join('\n') })).toMatchObject({ observedModel: null, observedEffort: 'medium' });
});
test('missing independent content receipts and green skipped tests cannot imply acceptance', async () => {
  const execute = (cmd, args, opts) => { const r = nativeDouble(cmd, args, opts); if (cmd === 'codex') r.stdout = r.stdout.split('\n').slice(1).join('\n'); return r; };
  const oracleExecute = () => ({ status: 0, stdout: JSON.stringify({ checks: [{ id: 'AC-1', status: 'skipped' }] }), stderr: '' });
  const r = await trial.trial(f.dir, caseInput(), { fetchImpl, execute, oracleExecute }); const pair = routing.read(r.resultRef);
  expect(pair.arms.medium).toMatchObject({ accepted: false, skipped: 1, status: 'unavailable' });
});
test('arm failure or zero native budget keeps both attempts and unknown billing', async () => {
  f.close(); const m = manifest(); const c = caseInput(); m.heldoutFamilies = [routing.familyKey(c.repository, c.taskFamilyId)]; m.budget.native = 0; f = setup(m);
  const execute = jest.fn(); const r = await trial.trial(f.dir, c, { fetchImpl, execute });
  expect(execute).not.toHaveBeenCalled(); expect(Object.values(routing.read(r.resultRef).arms).map(a => a.reason)).toEqual(['budget_exhausted', 'budget_exhausted']);
  expect(routing.reports(f.dir).some(r => routing.read(r.file).checkpoint === 'budget-stop')).toBe(true);
});
function synthetic(n) {
  const m = manifest(['one', 'two', 'three']); const pairs = [], observations = [];
  for (let i = 0; i < n; i++) {
    const repository = m.projects[i % 3], taskFamilyId = 'f-' + i, loop = i % 2 ? 'feature-build' : 'spec-build', id = 'd-' + i;
    m.heldoutFamilies.push(routing.familyKey(repository, taskFamilyId));
    const arm = { status: 'completed', observedModel: m.model, snapshotHash: 'snap', acceptanceHash: 'acceptance', oracleRef: 'oracle', reviewRef: 'review', receiptHash: 'receipt', requiredChecks: 1, executedChecks: 1, skipped: 0, accepted: true, materialViolation: false, elapsedMs: 100 };
    pairs.push({ repository, taskFamilyId, loop, decisionId: id, snapshotHash: 'snap', acceptanceHash: 'acceptance', startedAt: '2026-09-22T02:00:00Z', transport: 'live', independentUnit: true, blindedReview: true, arms: { medium: { ...arm, observedEffort: 'medium', requestedEffort: 'medium' }, high: { ...arm, observedEffort: 'high', requestedEffort: 'high', elapsedMs: 75 } } });
    observations.push({ repository, taskFamilyId, snapshotHash: 'snap', decisionId: id, at: '2026-09-22T01:00:00Z', status: 'recorded', transport: 'live', proposed: { effort: 'high' }, overheadMs: 5 });
  }
  return { m, pairs, observations };
}
test('analysis math only: 30 perfect synthetic pairs cannot confirm; 100 meets frozen thresholds; deterministic replay', () => {
  const a = synthetic(30); expect(analysis.analyze(a.m, a.pairs, a.observations).recommendation).toBe('insufficient_evidence');
  const b = synthetic(100), result = analysis.analyze(b.m, b.pairs, b.observations);
  expect(result).toMatchObject({ recommendation: 'candidate_for_limited_adoption', comparableFamilies: 100, benefit: { estimate: .19999999999999996 } });
  expect(result.regressionUpper95).toBeCloseTo(1 - Math.pow(.05, 1 / 100), 10);
  expect(analysis.analyze(b.m, b.pairs, b.observations)).toEqual(result);
});
test.each(['same arm', 'regression', 'material', 'missing', 'clamped', 'correlated', 'calibration', 'stale', 'duplicate'])('counterfactual guards: %s cannot manufacture benefit', kind => {
  const a = synthetic(100);
  if (kind === 'same arm') a.observations.forEach(o => o.proposed.effort = 'medium');
  if (kind === 'regression') a.pairs[0].arms.high.accepted = false;
  if (kind === 'material') a.pairs[0].arms.high.materialViolation = true;
  if (kind === 'missing') delete a.pairs[0].arms.high;
  if (kind === 'clamped') a.pairs[0].arms.high.observedEffort = 'medium';
  if (kind === 'correlated') a.pairs[0].independentUnit = false;
  if (kind === 'calibration') a.m.heldoutFamilies.shift();
  if (kind === 'stale') a.observations[0].snapshotHash = 'stale';
  if (kind === 'duplicate') a.pairs[99] = a.pairs[0];
  const r = analysis.analyze(a.m, a.pairs, a.observations);
  expect(r.recommendation).not.toBe('candidate_for_limited_adoption');
  if (kind === 'same arm') expect(r.benefit.estimate).toBeLessThan(0);
});
test('production replay rejects missing raw evidence and stale snapshot identities', async () => {
  const r = await trial.trial(f.dir, caseInput(), { fetchImpl, execute: nativeDouble }); const pair = routing.read(r.resultRef);
  expect(trial.verifyEvidence(f.study, pair).evidenceError).toBeUndefined();
  const changed = structuredClone(pair); changed.snapshotHash = 'changed'; expect(trial.verifyEvidence(f.study, changed).evidenceError).toBeTruthy();
  fs.unlinkSync(pair.arms.high.oracleRef); expect(trial.verifyEvidence(f.study, pair).evidenceError).toBeTruthy();
});
test('paired checkpoints retain attempted denominators even when all raw pair evidence is absent', () => {
  for (let i=0;i<100;i++) routing.put(f.study, 'pair-start', 'p'+i, { value: { repository: 'https://github.com/test/one', taskFamilyId:'attempt'+i, loop:i%2?'spec-build':'feature-build', stage:'implementation', caseHash:'missing', independentUnit:true, startedAt:'2026-09-22' } });
  const refs=routing.reports(f.dir), reports=refs.map(r=>routing.read(r.file));
  for(const n of [30,100]) expect(reports.find(r=>r.checkpoint==='paired-'+n).effort).toMatchObject({attemptedFamilies:n,comparableFamilies:0,recommendation:'insufficient_evidence'});
});
