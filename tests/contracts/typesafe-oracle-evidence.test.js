const fs = require('fs');
const trial = require('../../scripts/typesafe-effort-trial.cjs');
const routing = require('../../scripts/typesafe-routing.cjs');
const { setup, manifest, fetchImpl, caseInput, nativeDouble } = require('../helpers/routing-study.cjs');
let f, key;
beforeEach(() => {
  key = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'fixture-key';
  const m = manifest(), c = caseInput();
  m.heldoutFamilies = [routing.familyKey(c.repository, c.taskFamilyId)];
  f = setup(m);
});
afterEach(() => {
  f.close();
  if (key === undefined) delete process.env.TYPESAFE_API_KEY;
  else process.env.TYPESAFE_API_KEY = key;
});
// All external boundaries here are explicit doubles. The effort-eval suite
// executes its fixture oracle with simulated transport; neither proves OS isolation.
const passed = () => ({ status: 0, stdout: JSON.stringify({ checks: [{ id: 'AC-1', status: 'passed' }] }), stderr: '' });
async function pair(oracleExecute = passed) {
  const r = await trial.trial(f.dir, caseInput(), { fetchImpl, execute: nativeDouble, oracleExecute });
  return routing.read(r.resultRef);
}
test('oracle receipt preserves actual per-check results and replay accepts valid simulated evidence', async () => {
  const p = await pair();
  const receipt = routing.read(p.arms.medium.oracleRef);
  expect(receipt).toMatchObject({ transport: 'simulated', checks: [{ id: 'AC-1', status: 'passed' }], executedChecks: 1, skipped: 0, passed: true });
  expect(trial.verifyEvidence(f.study, p).evidenceError).toBeUndefined();
});
test('an unavailable isolated oracle reports execution failure rather than provenance corruption', async () => {
  const p = await pair(() => ({ status: 1, error: { code: 'EPERM' }, stdout: '', stderr: 'sandbox unavailable' }));
  expect(p.arms.medium.accepted).toBe(false);
  expect(trial.verifyEvidence(f.study, p).evidenceError).toBe('oracle_execution_unavailable');
});
test('missing check array reports its exact receipt failure', async () => {
  const p = await pair(() => ({ status: 0, stdout: '{}', stderr: '' }));
  expect(trial.verifyEvidence(f.study, p).evidenceError).toBe('oracle_checks_missing_or_invalid');
});
test('replay binds parsed checks to the raw oracle output', async () => {
  const p = await pair();
  const receipt = routing.read(p.arms.medium.oracleRef);
  receipt.checks[0].status = 'failed';
  fs.writeFileSync(p.arms.medium.oracleRef, JSON.stringify(receipt));
  expect(trial.verifyEvidence(f.study, p).evidenceError).toBe('oracle_checks_output_mismatch');
});
test.each(['failed', 'skipped'])('a %s actual check remains non-accepting', async status => {
  const p = await pair(() => ({ status: status === 'failed' ? 1 : 0, stdout: JSON.stringify({ checks: [{ id: 'AC-1', status }] }), stderr: '' }));
  const verified = trial.verifyEvidence(f.study, p);
  expect(verified.evidenceError).toBeUndefined();
  expect(verified.arms.medium).toMatchObject({ accepted: false, executedChecks: status === 'failed' ? 1 : 0, skipped: status === 'skipped' ? 1 : 0 });
});
test('malformed check rows are retained as invalid evidence without crashing the writer', async () => {
  const p = await pair(() => ({ status: 0, stdout: JSON.stringify({ checks: [null] }), stderr: '' }));
  expect(routing.read(p.arms.medium.oracleRef)).toMatchObject({ checks: null, passed: false });
  expect(trial.verifyEvidence(f.study, p).evidenceError).toBe('oracle_checks_missing_or_invalid');
});
test('successful-looking output with a process error cannot pass', async () => {
  const p = await pair(() => ({ ...passed(), error: { code: 'EPERM' } }));
  expect(routing.read(p.arms.medium.oracleRef).passed).toBe(false);
  expect(trial.verifyEvidence(f.study, p).evidenceError).toBe('oracle_execution_unavailable');
});
