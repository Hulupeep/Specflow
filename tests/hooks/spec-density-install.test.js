const fs = require('fs'), os = require('os'), path = require('path');
const { spawnSync } = require('child_process');
const source = path.resolve(__dirname, '../..');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'tier-install-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));
function install(host, denied = false) {
  fs.mkdirSync(path.join(root, 'target'), { recursive: true });
  const bin = path.join(root, 'bin'); fs.mkdirSync(bin, { recursive: true });
  const gh = path.join(bin, 'gh');
  fs.writeFileSync(gh, `#!/usr/bin/env node
const fs=require('fs'),p=require('path'),args=process.argv.slice(2),root=process.env.TIER_FIXTURE;
fs.appendFileSync(p.join(root,'calls.jsonl'),JSON.stringify(args)+'\\n');
if(process.env.TIER_DENIED==='1')process.exit(1);
if(args[0]!=='label')process.exit(1);
const file=p.join(root,'labels.json');const labels=JSON.parse(fs.readFileSync(file));
if(args[1]==='list')console.log(JSON.stringify(labels));
else if(args[1]==='create'){labels.push({name:args[2]});fs.writeFileSync(file,JSON.stringify(labels));}
else process.exit(1);
`, { mode: 0o755 });
  return spawnSync('bash', [path.join(source, 'install-hooks.sh'), path.join(root, 'target')], { encoding: 'utf8', timeout: 15000, env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, SPECFLOW_RUNTIME: host, TIER_FIXTURE: root, TIER_DENIED: denied ? '1' : '0' } });
}
test.each(['codex', 'claude-code'])('%s installed label setup is idempotent and preserves unrelated state', host => {
  const initial = [{ name: 'enhancement', color: 'aabbcc' }, { name: 'spec:thin', color: '123456' }];
  fs.writeFileSync(path.join(root, 'labels.json'), JSON.stringify(initial));
  for (let round = 0; round < 2; round++) {
    const result = install(host); expect(result.status).toBe(0);
    const calls = fs.readFileSync(path.join(root, 'calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    expect(calls.filter(a => a[0] === 'label' && a[1] === 'create').map(a => a[2])).toEqual(['spec:contracted', 'spec:build-ready']);
    expect(calls.some(a => a[0] === 'issue')).toBe(false);
  }
  expect(JSON.parse(fs.readFileSync(path.join(root, 'labels.json'))).slice(0, 2)).toEqual(initial);
  for (const route of ['board-auditor', 'waves-controller', 'sprint-executor', 'specflow-writer', 'specflow-uplifter', 'pre-flight-simulator']) {
    const prompt = fs.readFileSync(path.join(root, 'target/scripts/agents', route + '.md'), 'utf8');
    expect(prompt).toContain(`specflow-tier.cjs inspect <record.json> ${route}`);
    expect(prompt).toContain('exit 2');
    expect(prompt).toContain('build-ready');
    expect(prompt).not.toMatch(/MUST invoke pre-flight-simulator|EVERY write AND edit|After every uplift|Simulation \(MANDATORY/);
  }
  const skillRoot = host === 'codex' ? '.codex' : '.claude';
  for (const route of ['specflow-audit', 'specflow-simulate']) {
    const prompt = fs.readFileSync(path.join(root, 'target', skillRoot, 'skills', route, 'SKILL.md'), 'utf8');
    expect(prompt).toContain(`specflow-tier.cjs inspect <record.json> ${route} inspect`);
    expect(prompt).not.toMatch(/MUST invoke pre-flight-simulator|After every uplift|Simulation \(MANDATORY/);
  }
  for (const route of ['board-auditor','specflow-uplifter','sprint-executor','specflow-writer','waves-controller','ticket-closer','frontend-builder','test-runner','journey-enforcer']) {
    const prompt=fs.readFileSync(path.join(root,'target/scripts/agents',route+'.md'),'utf8');
    expect(prompt).toContain('specflow-publication.cjs');expect(prompt).toContain('non-zero exit');expect(prompt).not.toMatch(/gh issue (?:comment|create)/);
    for(const line of prompt.split('\n').filter(l=>l.includes('gh issue edit')))expect(line).toMatch(/--(?:add|remove)-label/);
  }
  // Scan all installed agents, including downstream wave workers, for alternate
  // content-publication syntax (e.g. close --comment) rather than only known routes.
  const targetAgents=path.join(root,'target/scripts/agents');
  for(const name of fs.readdirSync(targetAgents).filter(n=>n.endsWith('.md'))){
    const text=fs.readFileSync(path.join(targetAgents,name),'utf8');
    expect({name,unsafe:/gh (?:issue|pr) (?:comment|create)|gh (?:issue|pr) close[^\n]*(?:--comment|--body)|gh (?:issue|pr) edit[^\n]*--(?:body|title)/.test(text)}).toEqual({name,unsafe:false});
  }
  for (const rel of ['specflow-simulate/SKILL.md','specflow-simulate/references/simulation-method.md','specflow-audit/SKILL.md','specflow-audit/references/uplift-process.md']) {
    const prompt=fs.readFileSync(path.join(root,'target',skillRoot,'skills',rel),'utf8');
    expect(prompt).toContain('specflow-publication.cjs');expect(prompt).not.toContain('gh issue comment');
  }
  for (const rel of ['QA/spec-build.md','QA/spec-build-loop.md','QA/loops/spec-build.yaml']) {
    const text=fs.readFileSync(path.join(root,'target',rel),'utf8');expect(text).not.toMatch(/adversary ≤ 4|uplift ≤ 3|cycles ≤ 4|re-audits ≤ 3|Repeats until|do_until:/);
    expect(text).toContain('no-new-evidence');
  }
  const duo = fs.readFileSync(path.join(root, 'target', skillRoot, 'skills/duo-build/SKILL.md'), 'utf8');
  expect(duo).toContain('specflow-tier.cjs inspect <record.json> duo-build build');
  const feature = fs.readFileSync(path.join(root, 'target/QA/loops/feature-build.yaml'), 'utf8');
  expect(feature).toContain('specflow-tier.cjs inspect <record.json> feature-build build');
  expect(fs.readFileSync(path.join(root, 'target', skillRoot, 'skills/specflow-loop-selector/SKILL.md'), 'utf8')).not.toContain('simulation_required: true until');
  // Exercise the installed decision on fresh/resumed route calls. The host
  // runtime/installer is real; provider and GitHub boundaries are simulated.
  const target = path.join(root, 'target'), file = path.join(target, 'record.json');
  const execute = (record, route, operation) => {
    fs.writeFileSync(file, JSON.stringify(record));
    const r = spawnSync(process.execPath, [path.join(target, 'scripts/specflow-tier.cjs'), 'inspect', file, route, operation], { cwd: target, encoding: 'utf8' });
    return { code: r.status, ...JSON.parse(r.stdout) };
  };
  const thin = { issue: { number: 1, labels: [] } };
  for (const route of ['specflow-simulate', 'specflow-audit', 'specflow-writer', 'specflow-uplifter']) {
    expect(execute(thin, route, 'inspect')).toMatchObject({ code: 0, status: 'planning', tier: 'thin', simulation_required: false });
    expect(execute(thin, route, 'resume')).toMatchObject({ code: 0, status: 'planning', tier: 'thin' });
  }
  for (const route of ['waves-controller', 'sprint-executor', 'duo-build', 'feature-build']) {
    for (const operation of ['build', 'resume']) {
      expect(execute({ issue: { number: 1, labels: ['spec:build-ready'] } }, route, operation).code).toBe(2);
      expect(execute({ issue: { number: 1, labels: ['spec:build-ready', 'spec:thin'] } }, route, operation).code).toBe(2);
      const supplied = require('../helpers/spec-density').fixture(target);
      const ready = JSON.parse(fs.readFileSync(supplied.tier_record));
      ready.profile.artifacts.push({ id: 'database', role: 'database', applicable: false, reason: 'CLI only' });
      require('../helpers/spec-density').seedState(target,ready);
      expect(execute(ready, route, operation).code).toBe(0);
      ready.freshness.status = 'stale';
      expect(execute(ready, route, operation).code).toBe(2);
    }
  }
  // Real installed CLI/process boundaries; the synthetic sandbox probe is
  // explicitly a fixture, not proof of OS containment or a live model.
  const specPolicy=require('../../scripts/specflow-tier.cjs');
  fs.writeFileSync(path.join(target,'experiment-worker.cjs'),"if(process.argv.includes('--probe'))console.log(JSON.stringify({success:true,sandboxReady:true,simulated:true}));else if(process.argv[2]==='failed')process.exitCode=1;else if(process.argv[2]==='budget')setTimeout(()=>{},10000);else console.log(JSON.stringify({observed:true,synthetic:true}));");
  fs.writeFileSync(path.join(target,'approved-input.json'),'{}');
  const ref=file=>({path:file,sha256:specPolicy.sha(fs.readFileSync(path.join(target,file)))});
  const issue={number:700,body:'AC-1: learn before freezing future interfaces',labels:['spec:thin']};
  fs.writeFileSync(path.join(target,'experiment-issue.json'),JSON.stringify(issue));
  fs.writeFileSync(path.join(target,'experiment-record.json'),JSON.stringify({issue,source:{kind:'file',path:'experiment-issue.json'}}));
  const specification=(...args)=>spawnSync(process.execPath,[path.join(target,'scripts/specflow-specification.cjs'),...args],{cwd:target,encoding:'utf8',timeout:5000});
  for(const [mode,status]of [['observed','observed'],['failed','failed'],['unavailable','blocked'],['budget','budget_exhausted']]){
    const command=[process.execPath,'experiment-worker.cjs',mode],permission=[ref('experiment-worker.cjs')];
    fs.writeFileSync(path.join(target,'.specflow/experiment-policy.json'),JSON.stringify({adapters:{fixture:{sandboxed:true,command,probeCommand:[...command,'--probe'],permissionEvidence:permission,maxTimeoutMs:500,maxOutputBytes:4096}}}));
    const plan={id:mode,adapter:'fixture',question:'Observe '+mode,expectedObservation:'An honest bounded result',permissionEvidence:permission,code:permission,inputs:[mode==='unavailable'?{path:'missing-input',sha256:'0'.repeat(64)}:ref('approved-input.json')],command,timeoutMs:500,maxOutputBytes:4096};
    fs.writeFileSync(path.join(target,'experiment-plan.json'),JSON.stringify(plan));
    const result=specification('experiment','experiment-record.json','experiment-plan.json'),body=JSON.parse(result.stdout);
    expect({host,mode,code:result.status,status:body.status}).toEqual({host,mode,code:mode==='observed'?0:2,status});
    expect(body.productionAccepted).toBe(false);expect(fs.existsSync(path.join(target,body.evidence.path))).toBe(true);
    fs.writeFileSync(path.join(target,'collection.json'),JSON.stringify({outcome:mode==='observed'?'success':mode==='unavailable'?'blocked':'failed',discoveries:[]}));
    expect(specification('collect','experiment-record.json',body.batch,'collection.json').status).toBe(0);
    expect(execute({issue,source:{kind:'file',path:'experiment-issue.json'}},'duo-build','build').code).toBe(2);
    expect(specification('experiment','experiment-record.json','experiment-plan.json').status).toBe(2);
  }
  // Exercise the installed runner itself, including durable start/resume state.
  fs.writeFileSync(file, JSON.stringify(thin));
  const contract = path.join(target, 'run.yml');
  for (let round = 0; round < 2; round++) {
    const r = spawnSync(process.execPath, [path.join(target, 'scripts/specflow-runner.cjs'), 'spec-build', '--contract', contract, '--tier-record', file, '--no-adapter-routing'], { cwd: target, encoding: 'utf8', env: { ...process.env, NODE_PATH: path.join(source, 'node_modules') } });
    expect(r.status).toBe(0);
    expect(require('js-yaml').load(fs.readFileSync(contract, 'utf8')).run_contract).toMatchObject({ tier: 'thin', simulation_required: false });
  }
});
test.each(['codex', 'claude-code'])('%s reports conflicting legacy instructions without replacing custom text', host => {
  fs.mkdirSync(path.join(root, 'target'), { recursive: true });
  const file = path.join(root, 'target/AGENTS.md');
  const legacy = '# Specflow Loop Routing\nAlways generate full simulation for every ticket.\n';
  fs.writeFileSync(file, legacy); fs.writeFileSync(path.join(root, 'labels.json'), '[]');
  const result = install(host);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Reconcile legacy simulation instructions');
  expect(fs.readFileSync(file, 'utf8')).toContain(legacy);
  expect(fs.readFileSync(file, 'utf8')).toContain('Progressive specification policy');
});
test('denied GitHub access is visible and never claims labels installed', () => {
  fs.writeFileSync(path.join(root, 'labels.json'), '[]');
  const result = install('codex', true);
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('Tier labels unavailable');
  expect(JSON.parse(fs.readFileSync(path.join(root, 'labels.json')))).toEqual([]);
});

test.each(['codex', 'claude-code'])('%s full project setup installs tiered host process instructions', host => {
  const target = path.join(root, 'full-project'), bin = path.join(root, 'setup-bin');
  fs.mkdirSync(target); fs.mkdirSync(bin);
  // Exercise the real full installer, including its generated contract tests.
  // Only dependency download and GitHub access are replaced: use the already
  // installed packages, never update global skills or contact a real repository.
  fs.symlinkSync(path.join(source, 'node_modules'), path.join(target, 'node_modules'), 'dir');
  fs.writeFileSync(path.join(bin, 'npm'), `#!/usr/bin/env node
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
fs.appendFileSync(process.env.TIER_SETUP_CALLS,JSON.stringify(process.argv.slice(2))+'\\n');
if(process.argv[2]==='install'){console.log('Fixture: reuse installed dependencies; download simulated');process.exit(0);}
if(process.argv[2]!=='test')process.exit(2);
const r=spawnSync(process.execPath,[path.join(process.env.TIER_SOURCE,'node_modules/jest/bin/jest.js'),'--runInBand','--no-coverage'],{stdio:'inherit'});process.exit(r.status??2);
`, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'gh'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const result = spawnSync('bash', [path.join(source, 'setup-project.sh'), target, '--runtime', host, '--no-adversary'], {
    encoding: 'utf8', timeout: 30000,
    env: { ...process.env, PATH: bin + path.delimiter + process.env.PATH, SPECFLOW_RUNTIME: host, TIER_SOURCE: source, TIER_SETUP_CALLS: path.join(root, 'setup-calls.jsonl') }
  });
  expect({ code: result.status, failure: result.status === 0 ? null : result.stdout + result.stderr }).toEqual({ code: 0, failure: null });
  expect(result.stdout).toContain('Test Suites:');
  expect(fs.existsSync(path.join(target, '.specflow/duo/installer.lock'))).toBe(false);
  expect(fs.existsSync(path.join(target, '.claude/settings.json'))).toBe(true);
  expect(fs.readFileSync(path.join(target, 'SPECIFICATION.md'), 'utf8')).toBe(fs.readFileSync(path.join(source, 'templates/SPECIFICATION.md'), 'utf8'));
  expect(result.stdout).toContain('passed');
  expect(fs.readFileSync(path.join(root, 'setup-calls.jsonl'), 'utf8').trim().split('\n').map(JSON.parse)).toEqual([['install', '--quiet'], ['test']]);
  const violations = [];
  for (const name of ['PROCESS.md', 'PROCESS-CODEX.md', 'PROCESS-CLAUDE.md', 'PROCESS-GUIDE.md']) {
    const text = fs.readFileSync(path.join(target, name), 'utf8');
    const template = fs.readFileSync(path.join(source, name === 'PROCESS.md' ? 'templates/PROCESS.md' : 'templates/process/' + name), 'utf8');
    expect(text).toBe(template);
    expect(text).toContain('initial + one repair');
    expect(text).toContain('no-new-evidence');
    expect(text).toContain('never_without_human');
    expect(text.replace(/\s+/g, ' ')).toMatch(/thin backlog capture (?:can|may) precede (?:that )?review/i);
    expect(text).toContain('selected build-ready slice');
    const obsolete = /no tickets before|no SHIP verdict, no tickets|cannot write tickets until|through each (?:ticket|one)|wire every ticket|re-attacks|no ticket-writing starts|round after round|a single model can switch hats/i;
    if (obsolete.test(text)) violations.push(name);
  }
  expect(violations).toEqual([]);
  // Both install sources for PROCESS.md must agree, including the fallback
  // source setup-project.sh copies when no root file has been installed.
  expect(fs.readFileSync(path.join(source, 'templates/process/PROCESS.md'), 'utf8')).toBe(fs.readFileSync(path.join(source, 'templates/PROCESS.md'), 'utf8'));
});


test('hooks installer cannot borrow another process lock and does not remove it', () => {
  const target = path.join(root, 'locked-target'), lock = path.join(target, '.specflow/duo/installer.lock');
  fs.mkdirSync(lock, { recursive: true });
  fs.writeFileSync(path.join(lock, 'pid'), '0');
  const result = spawnSync('bash', [path.join(source, 'install-hooks.sh'), target, '--duo-lock-held'], { encoding: 'utf8', timeout: 5000 });
  expect(result.status).toBe(2);
  expect(result.stderr).toContain('not owned by the parent process');
  expect(fs.readFileSync(path.join(lock, 'pid'), 'utf8')).toBe('0');
  expect(fs.existsSync(path.join(target, '.claude/settings.json'))).toBe(false);
});
