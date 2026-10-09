// #194: bounded research, not a production fix or independent-model test.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), crypto = require('crypto'), assert = require('assert');
const { createRequire } = require('module');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const testFile = path.join(root, 'tests/contracts/improve-core.test.js');
const source = fs.readFileSync(testFile, 'utf8');
const prefix = source.slice(0, source.indexOf("describe('IMPROVE-01"));
assert(prefix.length > 1000, 'Existing fixture prefix unavailable');
const context = { require: createRequire(testFile), process, console,
  expect: value => ({ toBe: expected => assert.strictEqual(value, expected) }) };
vm.createContext(context);
vm.runInContext(prefix + '\nglobalThis.api={fixture,prepare,contract,writeTmp,setSteps,fakePeer,KEEP,FAKE_BUILDER,candidates,PURSUE};', context);
const fns = context.api, improve = require(path.join(root, 'scripts/specflow-improve.cjs'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const outputs = [];
function cli(run, command) {
  const argv = [path.join(root, 'scripts/specflow-improve.cjs'), command, run];
  const r = spawnSync(process.execPath, argv, { encoding: 'utf8', timeout: 20000 });
  let result; try { result = JSON.parse(r.stdout); } catch { result = null; }
  return { command: [process.execPath, ...argv], exitCode: r.status, error: r.error?.code || null, stdout: r.stdout, stderr: r.stderr, result };
}
async function setup(name, doc = fns.contract()) {
  const f = fns.fixture();
  const prepared = await fns.prepare(f, { contractDoc: doc, runId: name });
  assert.strictEqual(prepared.frozen.status, 'frozen');
  return { ...f, run: prepared.runDir, ws: path.join(f.worktrees, name), calls: [] };
}
function call(f, command) { const r = cli(f.run, command); f.calls.push(r); return r; }
async function build(f, steps = 2) {
  // Existing test seams simulate model choices only. Git, checks, ledger,
  // contract selection and decision/finalization execute actual production code.
  return improve.build(f.run, { policy: fns.writeTmp(f, 'builder.json', fns.FAKE_BUILDER()),
    invokePeer: fns.fakePeer([fns.KEEP]), afterBuilderRound: ws => fns.setSteps(ws, steps) });
}
function evidence(f) {
  return { fixture: f.root, run: f.run, calls: f.calls, events: improve.events(f.run), ledgerIntegrity: improve.verifyLedger(f.run) };
}
async function q1(name, when) {
  const f = await setup(name);
  assert.strictEqual(call(f, 'baseline').result?.status, 'baseline_recorded');
  await build(f);
  const testedHash = sha(path.join(f.ws, 'src/journey.json'));
  assert.strictEqual(call(f, 'verify').result?.summary['AC-1'], 'pass');
  if (when === 'before-evaluate') fns.setSteps(f.ws, 9);
  const evaluatedHash = sha(path.join(f.ws, 'src/journey.json'));
  const decision = call(f, 'evaluate');
  if (when === 'after-evaluate') fns.setSteps(f.ws, 9);
  const finalHash = sha(path.join(f.ws, 'src/journey.json'));
  const final = call(f, 'finalize');
  let retained = null;
  if (final.result?.commit) {
    const r = spawnSync('git', ['show', `${final.result.commit}:src/journey.json`], { cwd: f.repo, encoding: 'utf8' });
    assert.strictEqual(r.status, 0); retained = JSON.parse(r.stdout);
  }
  outputs.push({ question: 'Q1', scenario: name, expected: when ? 'Mutation must not inherit prior passing verification' : 'Unchanged verified gain can KEEP',
    actual: { decision: decision.result?.decision, finalExit: final.exitCode, retained, testedHash, evaluatedHash, finalHash }, ...evidence(f) });
}
async function q2(name, fresh) {
  const f = await setup(name);
  assert.strictEqual(call(f, 'baseline').result?.status, 'baseline_recorded');
  const v2 = fns.contract();
  v2.acceptance[0].baseline_expectation = fresh === 'matching' ? 'fail' : 'pass';
  const frozen = improve.freezeContract(f.run, fns.writeTmp(f, 'v2.json', v2), { supersede: 'Controlled research: v2 baseline expectation' });
  assert.strictEqual(frozen.status, 'frozen');
  const baseline = fresh ? call(f, 'baseline') : null;
  let built, error = null;
  try { built = await build(f); } catch (e) { error = e.message; }
  const started = improve.events(f.run).find(e => e.event === 'implementation_started');
  outputs.push({ question: 'Q2', scenario: name, expected: fresh === 'matching' ? 'Build allowed with matching v2 baseline' : 'Build blocked without successful v2 baseline',
    actual: { freshBaseline: baseline?.result || null, implementationStarted: !!started, governingVersion: started?.contract_version, baselineBlockerAccepted: started?.baseline_blocker_accepted, buildStatus: built?.status, error }, ...evidence(f) });
}
async function q3(name, mode) {
  const doc = fns.contract();
  if (mode === 'preserve') {
    doc.acceptance[0].baseline_expectation = 'pass';
    doc.acceptance[0].statement = 'Resume journey remains at most four steps';
  }
  let f;
  if (mode === 'preserve') {
    const fixture = fns.fixture();
    const { runDir } = improve.startRun({ target: fixture.repo, mission: fixture.mission, runId: name, stateDir: fixture.state, worktreeRoot: fixture.worktrees });
    f = { ...fixture, run: runDir, ws: path.join(fixture.worktrees, name), calls: [] };
    improve.recordCandidates(f.run, fns.writeTmp(f, 'cands.json', fns.candidates()));
    improve.critique(f.run, { invokePeer: fns.fakePeer([fns.PURSUE]) });
    // New independent fixture, before baseline/build: author and freeze its own
    // preservation oracle. Never rewrite an already consumed holdout.
    const check = "const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.env.IMPROVE_WORKSPACE+'/src/journey.json'));console.log(JSON.stringify({steps:j.steps}));process.exit(j.steps<=4?0:1);";
    fs.mkdirSync(path.join(f.run, 'holdout'), { recursive: true });
    fs.mkdirSync(path.join(f.run, 'dev'), { recursive: true });
    fs.writeFileSync(path.join(f.run, 'holdout/preserve.cjs'), check);
    fs.writeFileSync(path.join(f.run, 'dev/preserve.cjs'), check);
    improve.recordOracle(f.run, { role: 'evaluator', executor: 'fake-evaluator', files: ['holdout/preserve.cjs'] });
    doc.acceptance[0].check.artifact = 'holdout/preserve.cjs';
    doc.acceptance[0].dev_check.artifact = 'dev/preserve.cjs';
    assert.strictEqual(improve.freezeContract(f.run, fns.writeTmp(f, 'preserve.json', doc)).status, 'frozen');
  } else f = await setup(name, doc);
  const baseline = call(f, 'baseline');
  assert.strictEqual(baseline.result?.status, 'baseline_recorded');
  if (mode === 'preserve') {
    await improve.build(f.run, { policy: fns.writeTmp(f, 'builder.json', fns.FAKE_BUILDER()), invokePeer: fns.fakePeer([fns.KEEP]),
      afterBuilderRound: ws => fs.writeFileSync(path.join(ws, 'src/journey.json'), JSON.stringify({ steps: 4, internalNote: 'unrelated metadata change' })) });
  } else await build(f, mode === 'regression' ? 3 : 2);
  const verified = call(f, 'verify'), decision = call(f, 'evaluate'), final = call(f, 'finalize');
  outputs.push({ question: 'Q3', scenario: name, expected: mode === 'gain' ? 'KEEP for evidenced gain' : mode === 'regression' ? 'REVERT for failed mandatory holdout' : 'No KEEP from preservation alone',
    actual: { baseline: baseline.result?.summary, after: verified.result?.summary, decision: decision.result?.decision, finalExit: final.exitCode, branchRetained: final.result?.branch_retained }, ...evidence(f) });
}
(async () => {
  for (const [name, fn] of [
    ['unchanged-gain', () => q1('unchanged-gain', null)],
    ['mutation-before-evaluate', () => q1('mutation-before-evaluate', 'before-evaluate')],
    ['mutation-after-evaluate', () => q1('mutation-after-evaluate', 'after-evaluate')],
    ['v2-no-new-baseline', () => q2('v2-no-new-baseline', null)],
    ['v2-mismatching-baseline', () => q2('v2-mismatching-baseline', 'mismatch')],
    ['v2-matching-baseline', () => q2('v2-matching-baseline', 'matching')],
    ['preservation-only', () => q3('preservation-only', 'preserve')],
    ['gain-control', () => q3('gain-control', 'gain')],
    ['regression-control', () => q3('regression-control', 'regression')],
  ]) {
    if (process.argv[2] && process.argv[2] !== name) continue;
    try { await fn(); } catch (e) { outputs.push({ scenario: name, unavailable: e.message }); }
  }
  console.log(JSON.stringify({ sourceHashes: { implementation: sha(path.join(root, 'scripts/specflow-improve.cjs')), fixture: sha(testFile), probe: sha(__filename) },
    transport: 'real isolated Git/worktrees/check subprocesses and lifecycle CLI; builder/peer/oracle-author identities are test fixtures',
    observations: outputs, limitations: ['No live model efficacy or backend/UI validation', 'No production code changed', 'Fixture identities do not establish independent oracle authorship in production'] }, null, 2));
  process.exitCode = outputs.some(o => o.unavailable) ? 2 : 0;
})().catch(e => { console.error(e.message); process.exitCode = 2; });
