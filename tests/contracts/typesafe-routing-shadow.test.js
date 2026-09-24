const fs = require('fs'), path = require('path'), os = require('os'), yaml = require('js-yaml'), { execFileSync } = require('child_process');
const routing = require('../../scripts/typesafe-routing.cjs'), bridge = require('../../scripts/typesafe-routing-bridge.cjs'), runner = require('../../scripts/specflow-runner.cjs');
const { setup, manifest, task, fetchImpl, answers } = require('../helpers/routing-study.cjs');
let f, key; beforeEach(() => { f = setup(); key = process.env.TYPESAFE_API_KEY; delete process.env.TYPESAFE_API_KEY; });
afterEach(() => { f.close(); if (key !== undefined) process.env.TYPESAFE_API_KEY = key; });
test.each(['missing', 'malformed', 'denied', 'timeout'])('AC-2: %s has no successful advice and visible unavailable provenance', async kind => {
  let transport;
  if (kind !== 'missing') process.env.TYPESAFE_API_KEY = 'fixture-key';
  if (kind === 'malformed') transport = async () => new Response('{}');
  if (kind === 'denied') transport = async () => new Response('', { status: 403 });
  if (kind === 'timeout') transport = () => new Promise(() => {});
  const r = await routing.observe(f.dir, task(), transport ? { fetchImpl: transport } : {});
  expect(r.status).toBe('unavailable');
  const row = routing.events(f.study).find(e => e.type === 'observation'); expect(row.proposed).toBeNull(); expect(row.reason).toBeTruthy();
});
test.each(['missing_credentials','recorded'])('J-TSAFE-ROUTING-SHADOW: installed helper off/on baseline and gates; outcome joined for %s', mode => {
  const priorNodeOptions = process.env.NODE_OPTIONS;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'routing-installed-')), source = path.resolve(__dirname, '../..'), old = process.cwd();
  try {
    execFileSync('git', ['init', '-q', root]); execFileSync('git', ['-C', root, 'remote', 'add', 'origin', 'https://github.com/test/one.git']);
    fs.writeFileSync(path.join(root, 'goal.md'), 'Count accurately.');
    require('../../scripts/duo-runtime.cjs').install(source, root);
    expect(fs.existsSync(path.join(root, 'scripts/typesafe-routing.cjs'))).toBe(true);
    // Installer copies the ordinary loop runner alongside the pinned helpers.
    fs.copyFileSync(path.join(source, 'scripts/specflow-runner.cjs'), path.join(root, 'scripts/specflow-runner.cjs'));
    const config = bridge.enable(root, f.dir, ['goal.md']); process.chdir(root);
    if (mode === 'recorded') {
      // Test-only HTTP transport preload, not a live TypeSafe proof. The child CLI and durable store are real.
      process.env.TYPESAFE_API_KEY = 'fixture-key';
      const preload=path.join(root,'preload.cjs'); fs.writeFileSync(preload, 'global.fetch = async () => new Response(' + JSON.stringify(JSON.stringify({model:'jev-1.13.0',answers:answers(),usage:{input_tokens:12,output_tokens:4}})) + ');');
      process.env.NODE_OPTIONS = '--require ' + preload;
    }
    const output = [];
    for (const on of [false, true]) {
      const dir = path.join(root, on ? 'on' : 'off'); fs.mkdirSync(dir);
      const contract = path.join(dir, 'contract.yml'), ledger = path.join(dir, 'ledger.jsonl'), policy = path.join(dir, 'policy.yml');
      fs.writeFileSync(contract, yaml.dump({ run_contract: { ...require('../helpers/spec-density').fixture(dir), loop: 'feature-build', run_id: 'run-' + on, goal: 'Count accurately', input_artifact: '#1', path: 'loop.yaml', current_stage_or_rail: '2_contract', next_gate: 'contract', durable_evidence: [contract, ledger], stop_condition: 'handoff', never_without_human: ['git push'], storage: { contract_path: contract, ledger_path: ledger }, ...(on ? { routing_shadow: config } : {}) } }));
      fs.writeFileSync(policy, yaml.dump({ adapter_policy: { id: 'baseline', provider: 'fake', command: 'fake', args: ['same'], role: 'implementer', requested_model: 'claude-opus-5-5', effort: 'medium', timeout_seconds: 10, max_iterations: 1, transcript_path: path.join(dir, 'transcript.jsonl'), output_path: path.join(dir, 'final.md'), never_without_human: ['git push'], fake_stdout: '{"type":"message","text":"built","model":"claude-opus-5-5"}' } }));
      const prompt = path.join(dir, 'prompt.md'); fs.writeFileSync(prompt, 'AC-1 count unique identities');
      const result = runner.runLoop({ loop: 'feature-build', contract, ledger, adapterPolicy: policy, prompt, noAdapterRouting: true });
      expect(result.status).toBe('gate_rerun_required');
      output.push(result.status);
      expect(runner.loadRunContract(contract).never_without_human).toEqual(['git push']);
      const rows = runner.readLedger(ledger);
      if (on) {
        expect(rows.find(r => r.event === 'routing_shadow_begin')).toMatchObject(mode === 'recorded' ? {status:'recorded'} : {status:'unavailable',reason:'missing_credentials'});
        expect(rows.find(r => r.event === 'routing_shadow_outcome')).toMatchObject({status:'recorded'});
        expect(routing.events(f.study).filter(e=>e.type==='outcome')).toHaveLength(1);
      }
      else expect(rows.some(r => r.event === 'routing_shadow_begin')).toBe(false);
      expect(fs.readFileSync(path.join(dir, 'final.md'), 'utf8')).toBe('built');
    }
    expect(output).toEqual(['gate_rerun_required', 'gate_rerun_required']);
    const result = bridge.begin(root, { ...config, cohortId: 'stale' }, task()); expect(result.status).toBe('unavailable');
  } finally { process.chdir(old); fs.rmSync(root, { recursive: true, force: true }); if(priorNodeOptions===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=priorNodeOptions; }
});
test('native effort flags bind exactly once and conflicts fail before execution (#128)', () => {
  const claude = runner.buildAdapterCommand({ provider: 'claude-print', model: 'claude-opus-5-5', effort: 'high', args: [] }); expect(claude.args).toEqual(expect.arrayContaining(['--effort', 'high']));
  const codex = runner.buildAdapterCommand({ provider: 'codex-exec', model: 'gpt-5.5', effort: 'medium', args: [] }); expect(codex.args).toEqual(expect.arrayContaining(['-c', 'model_reasoning_effort="medium"']));
  expect(() => runner.buildAdapterCommand({ provider: 'claude-print', effort: 'high', args: ['--effort=medium'] })).toThrow('Conflicting');
  expect(() => runner.buildAdapterCommand({ provider: 'codex-exec', effort: 'high', args: ['-c', 'model_reasoning_effort="medium"'] })).toThrow('Conflicting');
});
test('high-confidence recommendation remains private; failed persistence cannot claim recorded', async () => {
  process.env.TYPESAFE_API_KEY = 'fixture-key'; const r = await routing.observe(f.dir, task(), { fetchImpl });
  expect(r).not.toHaveProperty('proposed'); expect(r).not.toHaveProperty('answers');
  const cfg = { studyDir: f.dir, cohortId: f.study.manifest.cohortId, contextFiles: [] };
  expect(bridge.begin(process.cwd(), cfg, task(), { execute: () => ({ status: 2, stdout: '' }) }).status).toBe('unavailable');
});
test.each(['spec-build','feature-build'])('fresh %s enrollment is pinned and resume does not enroll an old run', loop => {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'routing-start-')), old=process.cwd();
  try {
    execFileSync('git',['init','-q',root]); execFileSync('git',['-C',root,'remote','add','origin','https://github.com/test/one']); process.chdir(root);
    const args={loop,slug:'before',noAdapterRouting:true}; runner.runLoop(args);
    const before=runner.loadRunContract('.specflow/runs/before/run-contract.yaml'); expect(before.routing_shadow).toBeNull();
    const cfg=bridge.enable(root,f.dir,[]); runner.runLoop(args);
    expect(runner.loadRunContract('.specflow/runs/before/run-contract.yaml').routing_shadow).toBeNull();
    runner.runLoop({...args,slug:'after'}); expect(runner.loadRunContract('.specflow/runs/after/run-contract.yaml').routing_shadow).toEqual(cfg);
  } finally {process.chdir(old);fs.rmSync(root,{recursive:true,force:true});}
});

test('F-1: observed decision joins immutable outcome via the real bridge', async () => {
  process.env.TYPESAFE_API_KEY='fixture-key';const receipt=await routing.observe(f.dir,task(),{fetchImpl});
  const value={status:'completed',terminal:false,observed:{model:'claude-opus-5-5',effort:null},evidenceRefs:['actual-output.json']};
  const cfg={studyDir:f.dir};expect(bridge.end(cfg,receipt,value)).toMatchObject({status:'recorded'});
  expect(routing.events(f.study).find(e=>e.type==='outcome').value).toEqual(value);
  expect(bridge.end(cfg,receipt,value)).toMatchObject({status:'recorded'});
  expect(bridge.end(cfg,receipt,{...value,status:'failed'})).toMatchObject({status:'unavailable',reason:'Outcome is immutable'});
  expect(routing.events(f.study).filter(e=>e.type==='outcome')).toHaveLength(1);
});
test.each(['codex','claude-code'])('F-2: %s review/status surfaces actual write failure without changing peer result or required gates', async builder => {
  const fixture=require('../helpers/duo-action-fixture.cjs').fixture(builder);
  try {
    process.env.TYPESAFE_API_KEY='fixture-key';const receipt=await routing.observe(f.dir,task(),{fetchImpl});
    const cfg={mode:'shadow',studyDir:f.dir,cohortId:f.study.manifest.cohortId,repository:'https://github.com/test/one',contextFiles:[]};
    fixture.put('display.cjs','console.log(42)');const capture=fixture.capture();const state=fixture.state();
    state.routingShadow=cfg;state.routingReceipt=receipt;fixture.put('.specflow/duo/'+state.id+'/run.json',state);
    const reviewed=routing.lock(f.study,()=>fixture.review(fixture.batch(capture)));
    expect(reviewed.outcome).toBe('accepted');expect(reviewed.criteria['OWNER-GATE'].status).toBe('unverified');
    expect(reviewed.routingReceipt.outcome).toMatchObject({status:'unavailable'});
    let out=execFileSync(process.execPath,[path.join(fixture.root,'.specflow/duo',state.id,'runtime/scripts/duo-build.cjs'),'status',state.id],{cwd:fixture.root,encoding:'utf8'});
    expect(out).toContain('Routing collection unavailable: Study lock busy');expect(out).toContain('accepted within batch scope');
    const terminal=routing.lock(f.study,()=>bridge.terminal(cfg,'terminal-write','completed',[]));
    const next=fixture.state();delete next.routingReceipt;next.routingTerminal=terminal;fixture.put('.specflow/duo/'+state.id+'/run.json',next);
    out=execFileSync(process.execPath,[path.join(fixture.root,'.specflow/duo',state.id,'runtime/scripts/duo-build.cjs'),'status',state.id],{cwd:fixture.root,encoding:'utf8'});
    expect(out).toContain('Routing collection unavailable: Study lock busy');
  } finally {fixture.close();}
});
