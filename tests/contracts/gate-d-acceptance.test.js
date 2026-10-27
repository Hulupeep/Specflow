// J-GATE-D-OUTCOME: real process/runner controls with labelled synthetic inputs.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const runner = require('../../scripts/specflow-runner.cjs');
const { fixture } = require('../helpers/native-execution');
const gateScript = path.resolve(__dirname, '../../scripts/teardown-gate.cjs');
function report(env, status = 'green') {
  const dir = env.root + '/.specflow/gate-d'; fs.mkdirSync(dir + '/evidence', { recursive: true });
  fs.writeFileSync(dir + '/journey-map.md', '- J: J-CLI — value-bearing CLI outcome\n');
  fs.writeFileSync(dir + '/findings.md', `## J: J-CLI\nstatus: ${status}\n${status === 'red' ? 'disposition: bug\n' : ''}evidence/result.json\n`);
  fs.writeFileSync(dir + '/evidence/result.json', JSON.stringify({ expected: 900, actual: status === 'red' ? 2400 : 900 })); return dir;
}
function configFixture({ mutateEarlier = false } = {}) {
  const env = fixture(); fs.appendFileSync(env.root + '/.gitignore', '\nA-only.txt\nB-only.txt\n');
  for (const id of ['A', 'B']) fs.writeFileSync(env.root + '/' + id + '-only.txt', id);
  if (mutateEarlier) fs.appendFileSync(env.root + '/cli.test.js', "\nafterAll(()=>{if(process.env.SPECFLOW_CONFIGURATION_ID==='B')require('fs').appendFileSync(__dirname+'/A-only.txt','changed by B');});\n");
  env.contract.runtime_checks = ['A', 'B'].map(id => ({ ...structuredClone(env.check), id: 'C-' + id, configuration_ids: [id], input_paths: ['input.txt', id + '-only.txt'] }));
  env.contract.outcome_contract = { version: 1, goal: 'Every required configuration uses its own current input and check', configurations: ['A', 'B'].map(id => ({ id, environment: 'isolated-' + id })), assumptions: ['Synthetic CLI harness'], unknowns: [], non_goals: [], obligations: ['A', 'B'].map(id => ({ id: 'O-' + id, required: true, oracle: { path: 'expected.txt', sha256: crypto.createHash('sha256').update(fs.readFileSync(env.root + '/expected.txt')).digest('hex') }, check_ids: ['C-' + id], level: 'process', configuration_ids: [id] })) };
  return env;
}
test('GD001: valid red report is explicitly lint, never outcome acceptance', () => {
  const env = fixture(); try { const dir = report(env, 'red'), r = cp.spawnSync(process.execPath, [gateScript, 'check-gate-d', dir], { encoding: 'utf8' });
    expect(r.status).toBe(0); expect(r.stdout).toContain('"outcome_acceptance"'); expect(JSON.parse(r.stdout)).toMatchObject({ report_validity: 'valid', outcome_acceptance: 'not_evaluated' });
  } finally { env.remove(); }
});
test('GD007: actual gate-d run contract starts and sequences the epic acceptance stage', () => {
  const c = runner.createRunContract({ loop: 'gate-d', slug: 'acceptance', goal: 'Outcome', input: 'report', contractPath: '/tmp/contract.yml', ledgerPath: '/tmp/ledger.jsonl' }).run_contract;
  expect(c.current_stage_or_rail).toBe('GATE_D'); expect(runner.loopSequence(c)).toEqual(['GATE_D']);
});
test('GD003: selected A never executes or projects B-only proof under configuration A', () => {
  const env = configFixture(); try { env.accept(); const r = runner.runVerifierStage({ root: env.root, runDir: env.runDir, sliceTags: ['integration'], configurationId: 'A', environment: 'isolated-A' });
    expect(r.gate).toBe('pass'); expect(r.findings.map(f => f.check_id)).toEqual(['C-A']); expect(r.parent_outcome.obligations.map(o => o.id)).toEqual(['O-A']);
  } finally { env.remove(); }
});
const acceptance = require('../../scripts/gate-d-acceptance.cjs');
const { oracleFixture } = require('../helpers/oracle-execution');
function invoke(env, dir, more = []) {
  return cp.spawnSync(process.execPath, [gateScript, 'accept-gate-d', dir, '--run-dir', env.runDir, '--repo-root', env.root, ...more], { cwd: env.root, encoding: 'utf8', timeout: 90000 });
}
test.each(['normal', 'wrong', 'hardcoded'])('GD002/003: actual native CLI/persistence %s is independently judged, not report-green certified', mode => {
  const env = oracleFixture({ mode }); try { const dir = report(env); env.accept(); const r = invoke(env, dir), value = JSON.parse(r.stdout);
    expect({ exit: r.status, stderr: r.stderr }).toMatchObject({ exit: mode === 'normal' ? 0 : 1 });
    expect(value.report_validity).toBe('valid'); expect(value.outcome_acceptance === 'passed').toBe(mode === 'normal');
    expect(value.obligations).toEqual([expect.objectContaining({ id: 'O-values', configuration_id: 'local', status: mode === 'normal' ? 'passed' : 'failed' })]);
  } finally { env.remove(); }
});
test.each(['red', 'blocked', 'missing', 'skipped', 'stale', 'unsupported', 'waived'])('GD002/004/006: required %s remains non-passing despite resolving report evidence', status => {
  const env = oracleFixture(); try { const dir = report(env, status); if (status === 'stale') fs.appendFileSync(dir + '/findings.md', 'disposition: stale-oracle\namendment: already-approved.json\n'); env.accept();
    const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.report_validity).toBe('valid'); expect(r.outcome_acceptance).not.toBe('passed'); expect(r.errors.join(' ')).toContain('J-CLI');
    if (status === 'waived') expect(r).toMatchObject({ outcome_acceptance: 'waived', authority: expect.stringContaining('no authenticated waiver') });
  } finally { env.remove(); }
});
test.each(['unknown-status', 'duplicate-status', 'duplicate-hop', 'duplicate-map', 'unknown-hop', 'missing-hop', 'missing-evidence', 'symlink', 'escape'])('GD001/002: %s report input cannot replace protected coverage', defect => {
  const env = oracleFixture(); try { const dir = report(env), file = dir + '/findings.md';
    if (defect === 'unknown-status') fs.writeFileSync(file, '## J: J-CLI\nstatus: pass-but-failed\nevidence/result.json\n');
    if (defect === 'duplicate-status') fs.appendFileSync(file, 'result: failed\n');
    if (defect === 'duplicate-hop') fs.appendFileSync(file, fs.readFileSync(file));
    if (defect === 'duplicate-map') fs.appendFileSync(dir + '/journey-map.md', fs.readFileSync(dir + '/journey-map.md'));
    if (defect === 'unknown-hop') fs.appendFileSync(file, '## J: OTHER\nstatus: green\nevidence/result.json\n');
    if (defect === 'missing-hop') fs.writeFileSync(file, 'No findings');
    if (defect === 'missing-evidence') fs.unlinkSync(dir + '/evidence/result.json');
    if (defect === 'symlink') { fs.unlinkSync(dir + '/evidence/result.json'); fs.symlinkSync(env.root + '/oracle.json', dir + '/evidence/result.json'); }
    if (defect === 'escape') fs.appendFileSync(file, 'evidence/../../oracle.json\n');
    env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.report_validity).toBe('invalid'); expect(r.outcome_acceptance).not.toBe('passed');
  } finally { env.remove(); }
});
test('GD003: required native skip cannot be replaced by matching observations and a green report', () => {
  const env = oracleFixture({ skipRequired: true }); try { const dir = report(env); env.accept(); expect(acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }).outcome_acceptance).not.toBe('passed'); } finally { env.remove(); }
});
test('GD003: all required configurations get distinct current proof and native labels', () => {
  const env = configFixture(); try {
    fs.appendFileSync(env.root + '/cli.test.js', "\ntest('configuration labels',()=>{expect(['A','B']).toContain(process.env.SPECFLOW_CONFIGURATION_ID);expect(process.env.SPECFLOW_ENVIRONMENT).toBe('isolated-'+process.env.SPECFLOW_CONFIGURATION_ID);});\n");
    for (const check of env.contract.runtime_checks) check.execution.required_case_ids.push('cli.test.js::configuration labels');
    const dir = report(env); env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.outcome_acceptance).toBe('passed'); expect(r.obligations.map(o => [o.id, o.configuration_id, o.status])).toEqual([['O-A', 'A', 'passed'], ['O-B', 'B', 'passed']]);
  } finally { env.remove(); }
});
test('GD003: later B mutation of ignored A-only input invalidates earlier A proof', () => {
  const env = configFixture({ mutateEarlier: true }); try { const dir = report(env); env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.outcome_acceptance).toBe('stale'); expect(r.obligations).toContainEqual(expect.objectContaining({ id: 'O-A', configuration_id: 'A', status: 'stale' })); } finally { env.remove(); }
});
test('GD003: copied stage JSON and a changed native failure verdict cannot become owning proof', () => {
  const env = fixture({ broken: true }); try { env.accept(); const r = runner.runVerifierStage({ root: env.root, runDir: env.runDir, sliceTags: ['integration'] }); expect(r.gate).toBe('fail'); expect(runner.revalidateVerifierStage(JSON.parse(JSON.stringify(r))).gate).toBe('blocked'); for (const f of r.findings) f.verifier_result = 'pass'; expect(runner.revalidateVerifierStage(r).gate).not.toBe('pass'); } finally { env.remove(); }
});
test('GD005: protected required signoff rejects local downgrade and freely editable signed_by', () => {
  const env = oracleFixture(); try { env.contract.outcome_contract.acceptance = { hops: [{ id: 'J-CLI', obligation_ids: ['O-values'] }], signoff_required: true }; const dir = report(env); env.accept();
    fs.writeFileSync(dir + '/signoff-policy.json', JSON.stringify({ signoff_policy: { required: false } })); fs.writeFileSync(dir + '/findings.md.signoff.json', JSON.stringify({ signed_by: 'owner', sha256: crypto.createHash('sha256').update(fs.readFileSync(dir + '/findings.md')).digest('hex') }));
    const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r).toMatchObject({ outcome_acceptance: 'blocked', approval_scope: expect.stringMatching(/^[a-f0-9]{64}$/) }); expect(r.errors.join(' ')).toContain('required detached owner approval');
  } finally { env.remove(); }
});
test.each(['unknown', 'missing', 'duplicate'])('GD003/005: %s protected hop mapping is rejected by the shared schema', kind => {
  const env = oracleFixture(); try { env.contract.outcome_contract.acceptance = { hops: kind === 'missing' ? [{ id: 'J-CLI', obligation_ids: ['O-absent'] }] : kind === 'unknown' ? [{ id: 'J-CLI', obligation_ids: ['O-values', 'O-absent'] }] : [{ id: 'J-CLI', obligation_ids: ['O-values'] }, { id: 'J-CLI', obligation_ids: ['O-values'] }] }; expect(require('../../scripts/outcome-contract.cjs').validate(env.contract).ok).toBe(false); } finally { env.remove(); }
});
test.each(['green', 'red'])('GD007: actual specflow run gate-d %s invokes acceptance before generic evidence and needs no provider', status => {
  const env = oracleFixture(); try { const dir = report(env, status); env.accept(); const command = [path.resolve(__dirname, '../../bin/specflow.js'), 'run', 'gate-d', '--slug', 'gate-d-test', '--goal', 'Accept actual synthetic outcome', '--input', dir, '--run-dir', env.root + '/.specflow/runs/gate-d', '--verification-run-dir', env.runDir, '--repo-root', env.root, '--stage-evidence', dir + '/evidence/result.json'];
    const r = cp.spawnSync(process.execPath, command, { cwd: env.root, encoding: 'utf8', timeout: 90000 }); expect({ exit: r.status, stderr: r.stderr, stdout: r.stdout.slice(0, 200) }).toMatchObject({ exit: status === 'green' ? 0 : 1 }); const result = JSON.parse(r.stdout); expect(result.status).toBe(status === 'green' ? 'gate_d_passed' : 'blocked_gate_d'); expect(result.acceptance.outcome_acceptance).toBe(status === 'green' ? 'passed' : 'failed'); expect(fs.readFileSync(path.resolve(env.root, result.promptPath), 'utf8')).toContain('GATE_D');
  } finally { env.remove(); }
});
test('GD005: actual detached owner authority binds stable scope across fresh reruns and rejects changed report', () => {
  const env = oracleFixture(); try {
    env.contract.outcome_contract.acceptance = { hops: [{ id: 'J-CLI', obligation_ids: ['O-values'] }], signoff_required: true }; const dir = report(env); env.accept();
    const pending = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); const authority = require('../helpers/gate-d-owner').signedGateD(env.root, pending.approval_scope);
    const run = () => cp.spawnSync(process.execPath, [gateScript, 'accept-gate-d', dir, '--run-dir', env.runDir, '--repo-root', env.root, ...authority.args], { cwd: env.root, encoding: 'utf8', timeout: 90000, env: { ...process.env, PATH: authority.bin + path.delimiter + process.env.PATH } });
    for (let i = 0; i < 2; i++) { const r = run(); expect({ exit: r.status, stderr: r.stderr, stdout: r.stdout.slice(0, 400) }).toMatchObject({ exit: 0 }); expect(JSON.parse(r.stdout)).toMatchObject({ outcome_acceptance: 'passed', approval_scope: pending.approval_scope }); }
    const signatureFile = env.root + '/.specflow/gate-d-signed.json', original = fs.readFileSync(signatureFile); const forged = JSON.parse(original); forged.signature = Buffer.from('forged signature').toString('base64'); fs.writeFileSync(signatureFile, JSON.stringify(forged));
    const invalid = run(); expect(invalid.status).toBe(1); expect(JSON.parse(invalid.stdout).errors.join(' ')).toContain('Invalid detached owner authorization'); fs.writeFileSync(signatureFile, original);
    fs.appendFileSync(dir + '/findings.md', '\nchanged report input\n'); const stale = run(); expect(stale.status).toBe(1); expect(JSON.parse(stale.stdout).errors.join(' ')).toContain('stale');
  } finally { env.remove(); }
});
test('GD003: missing B-only input prevents all-parent acceptance even when A can pass', () => {
  const env = configFixture(); try { const dir = report(env); env.accept(); fs.unlinkSync(env.root + '/B-only.txt'); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.outcome_acceptance).not.toBe('passed'); } finally { env.remove(); }
});
test('GD003: a later configuration tampering earlier native stdout invalidates genuine earlier proof', () => {
  const env = configFixture(); try {
    fs.appendFileSync(env.root + '/cli.test.js', `\nafterAll(()=>{if(process.env.SPECFLOW_CONFIGURATION_ID!=='B')return;const fs=require('fs'),path=require('path'),base=path.dirname(path.dirname(process.env.PLAYWRIGHT_JSON_OUTPUT_FILE));for(const item of fs.readdirSync(base)){const dir=path.join(base,item),file=dir+'/execution.json';if(fs.existsSync(file)&&JSON.parse(fs.readFileSync(file)).binding_before.configuration_id==='A')fs.appendFileSync(dir+'/stdout.txt','tampered by B');}});\n`);
    const dir = report(env); env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.outcome_acceptance).toBe('stale'); expect(r.obligations).toContainEqual(expect.objectContaining({ id: 'O-A', status: 'stale' }));
  } finally { env.remove(); }
});
test('GD003: shared value check selects only independently mapped comparisons for the active configuration', () => {
  const env = oracleFixture(); try {
    const outcome = env.contract.outcome_contract, original = structuredClone(outcome.obligations[0]);
    outcome.configurations = ['A', 'B'].map(id => ({ id, environment: 'isolated-' + id }));
    outcome.obligations = ['A', 'B'].map(id => ({ ...structuredClone(original), id: 'O-' + id, configuration_ids: [id], oracle: { ...structuredClone(original.oracle), comparisons: original.oracle.comparisons.map(c => ({ ...c, id: c.id + '-' + id })) } }));
    for (const check of env.contract.runtime_checks) { check.configuration_ids = ['A', 'B']; if (check.id === 'C-correctness') check.execution.comparison_ids = outcome.obligations.flatMap(o => o.oracle.comparisons.map(c => c.id)); }
    let test = fs.readFileSync(env.root + '/cli.test.js', 'utf8'); test = test.replaceAll("comparison_id:'CV-first'", "comparison_id:'CV-first-'+process.env.SPECFLOW_CONFIGURATION_ID").replaceAll("comparison_id:'CV-second'", "comparison_id:'CV-second-'+process.env.SPECFLOW_CONFIGURATION_ID"); fs.writeFileSync(env.root + '/cli.test.js', test);
    const dir = report(env); env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.outcome_acceptance).toBe('passed'); expect(r.obligations.map(o => o.status)).toEqual(['passed', 'passed']);
  } finally { env.remove(); }
});
test.each(['normal', 'wrong-unit'])('GD003: final acceptance consumes actual integrated HTTP data seam %s', mode => {
  const env = require('../helpers/data-seams').apiFixture({ lyingRuntime: mode === 'wrong-unit' }); try { const dir = report(env); env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r.outcome_acceptance === 'passed').toBe(mode === 'normal'); } finally { env.remove(); }
});
test('GD007: trace separates historical accepted outcome from fresh acceptance and diagnoses changed report', () => {
  const env = oracleFixture(); try { const dir = report(env); env.accept(); expect(acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }).outcome_acceptance).toBe('passed');
    expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).gate_d).toMatchObject({ recorded_outcome: 'passed', scope_status: 'current', outcome_acceptance: 'not_evaluated' });
    fs.appendFileSync(dir + '/findings.md', '\nchanged\n'); expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).gate_d.scope_status).toBe('stale');
    runner.decideVerification({ root: env.root, runDir: env.runDir, decision: 'reject', missingCheck: 'new required coverage' }); expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).gate_d.scope_status).toBe('stale');
  } finally { env.remove(); }
});
test('GD004: actual signed fixture oracle amendment cannot reuse old pass or avoid a fresh failing comparison', () => {
  const env = oracleFixture(); try { const dir = report(env); env.accept(); expect(acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }).outcome_acceptance).toBe('passed');
    const outcome = require('../../scripts/outcome-contract.cjs'), old = outcome.outcomeHash(env.contract); env.contract.outcome_contract.obligations[0].oracle.comparisons[0].expected_pointer = '/second';
    const signed = require('../helpers/oracle-owner').signedAmendment(env.root, old, outcome.outcomeHash(env.contract)); runner.writeVerificationProposal({ runDir: env.runDir, journeyId: env.contract.journey_id, runtimeChecks: env.contract.runtime_checks });
    const file = env.root + '/.specflow/request.json'; fs.writeFileSync(file, JSON.stringify({ root: env.root, runDir: env.runDir, decision: 'accept', verificationContract: env.contract, amendment: signed.amendment }));
    const code = `require(${JSON.stringify(require.resolve('../../scripts/specflow-runner.cjs'))}).decideVerification(JSON.parse(require('fs').readFileSync(process.argv[1])));`;
    const changed = cp.spawnSync(process.execPath, ['-e', code, file], { encoding: 'utf8', timeout: 30000, env: { ...process.env, PATH: signed.bin + path.delimiter + process.env.PATH } }); expect({ exit: changed.status, stderr: changed.stderr }).toMatchObject({ exit: 0 });
    expect(runner.verifierTrace({ root: env.root, runDir: env.runDir }).gate_d.scope_status).toBe('stale'); const fresh = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(fresh.outcome_acceptance).toBe('failed'); expect(fresh.obligations[0].status).toBe('failed');
  } finally { env.remove(); }
});
test.each(['codex', 'claude-code'])('GD007: actual hook installer ships the same rejecting Gate D helper for %s', runtime => {
  const env = oracleFixture(); try {
    const dir = report(env, 'red'), bin = env.root + '/.specflow/no-network-bin'; fs.mkdirSync(bin);
    // Only remote label setup is unavailable; no host/model process may run.
    fs.writeFileSync(bin + '/gh', '#!/bin/sh\nexit 1\n', { mode: 0o700 });
    for (const provider of ['codex', 'claude']) fs.writeFileSync(bin + '/' + provider, `#!/bin/sh\necho invoked > '${bin}/provider-called'\nexit 99\n`, { mode: 0o700 });
    const installed = cp.spawnSync('bash', [path.resolve(__dirname, '../../install-hooks.sh'), env.root, '--runtime', runtime], { cwd: env.root, encoding: 'utf8', timeout: 60000, env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, SPECFLOW_RUNTIME: runtime } });
    expect({ exit: installed.status, stderr: installed.stderr, stdout: installed.stdout.slice(-500) }).toMatchObject({ exit: 0 }); expect(fs.existsSync(bin + '/provider-called')).toBe(false);
    for (const name of ['gate-d-acceptance.cjs', 'teardown-gate.cjs', 'specflow-runner.cjs']) expect(fs.readFileSync(env.root + '/scripts/' + name)).toEqual(fs.readFileSync(path.resolve(__dirname, '../../scripts/' + name)));
    env.accept(); const r = cp.spawnSync(process.execPath, [env.root + '/scripts/teardown-gate.cjs', 'accept-gate-d', dir, '--run-dir', env.runDir, '--repo-root', env.root], { cwd: env.root, encoding: 'utf8', timeout: 30000 }); expect(r.status).toBe(1); expect(JSON.parse(r.stdout)).toMatchObject({ report_validity: 'valid', outcome_acceptance: 'failed' });
  } finally { env.remove(); }
});
test('GD005: legacy configured required signoff cannot silently disappear during migration', () => {
  const env = oracleFixture(); try { const dir = report(env); fs.writeFileSync(dir + '/signoff-policy.json', JSON.stringify({ signoff_policy: { required: true } })); env.accept();
    const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }); expect(r).toMatchObject({ report_validity: 'valid', outcome_acceptance: 'blocked' }); expect(r.errors.join(' ')).toContain('explicitly migrated');
  } finally { env.remove(); }
});
test('GD005: explicit protected optional policy supersedes legacy attribution without adding a signature checkpoint', () => {
  const env = oracleFixture(); try { env.contract.outcome_contract.acceptance = { hops: [{ id: 'J-CLI', obligation_ids: ['O-values'] }], signoff_required: false }; const dir = report(env); fs.writeFileSync(dir + '/signoff-policy.json', JSON.stringify({ signoff_policy: { required: true } })); env.accept(); expect(acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir }).outcome_acceptance).toBe('passed'); } finally { env.remove(); }
});
test('GD006: a waived report retains evidence, claimed authority and risk without authenticating or passing it', () => {
  const env = oracleFixture(); try { const dir = report(env, 'waived'); fs.appendFileSync(dir + '/findings.md', 'authority: owner decision in evidence/result.json\nrisk: required calculation is not proved\n'); env.accept(); const r = acceptance.accept({ root: env.root, runDir: env.runDir, reportDir: dir });
    expect(r).toMatchObject({ outcome_acceptance: 'waived', report_dir: dir, execution_status: 'not_run' }); expect(Object.hasOwn(r.report_files, '.specflow/gate-d/evidence/result.json')).toBe(true); expect(r.hops[0]).toMatchObject({ id: 'J-CLI', status: 'waived', evidence_refs: ['evidence/result.json'], declared_authority: 'owner decision in evidence/result.json', risk: 'required calculation is not proved', authority_status: 'unverified' });
  } finally { env.remove(); }
});
