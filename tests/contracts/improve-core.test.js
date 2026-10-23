// IMPROVE-CORE (#171): slice 1 (#174 contract/evidence strength, #176 isolation and
// guardrails, minimum #173/#175/#178) and slice 2 (Duo-directed build rounds,
// evaluator-authored hidden holdout, oracle dispute, peer cannot rescue a failure).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const improve = require('../../scripts/specflow-improve.cjs');

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });
  if (r.status !== 0) throw new Error(r.stderr);
  return r.stdout.trim();
};
const quiet = (fn) => async (...a) => {
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  const err = jest.spyOn(console, 'error').mockImplementation(() => {});
  try { return await fn(...a); } finally { log.mockRestore(); err.mockRestore(); }
};

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'improve-'));
  const repo = path.join(root, 'product');
  fs.mkdirSync(path.join(repo, 'src'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'src', 'journey.json'), JSON.stringify({ steps: 4 }));
  fs.writeFileSync(path.join(repo, 'src', 'nav.json'), JSON.stringify({ items: ['home', 'today'] }));
  fs.writeFileSync(path.join(repo, 'README.md'), 'product');
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  const mission = path.join(root, 'mission.md');
  fs.writeFileSync(mission, 'Help a user resume work with minimal cognitive drag.');
  return { root, repo, mission, state: path.join(root, 'state'), worktrees: path.join(root, 'wt') };
}

function candidates(overrides = {}) {
  const base = {
    sources: [{ kind: 'runtime-walk', ref: 'journey capture' }],
    candidates: [
      {
        id: 'C1', title: 'Remove redundant confirmation step', kind: 'ux-refinement', status: 'selected',
        observation: 'Resuming a task takes 4 steps including a confirmation that repeats the previous screen.',
        user_impact: 'Users repeat a decision they already made and lose momentum.',
        mission_relevance: 'Resume work with minimal cognitive drag.',
        hypothesis: 'Dropping the repeated confirmation reduces the journey to 2 steps without losing safety.',
        evidence: [{ kind: 'runtime', ref: 'baseline walk' }],
        expected_value: 'medium', risk: 'low', reversibility: 'high', cost: 'S',
        evaluability: { best_level: 1, method: 'step count from journey definition' },
      },
      {
        id: 'C2', title: 'Redesign the whole dashboard', kind: 'redesign', status: 'opportunity', reason: 'unevaluable in one cycle',
        observation: 'The dashboard has many panels.', user_impact: 'Possibly slower orientation.', mission_relevance: 'Orientation.',
        hypothesis: 'A new layout might help.', evidence: [], expected_value: 'high', risk: 'high', reversibility: 'low', cost: 'L',
        evaluability: { best_level: 4, method: 'design judgment only' },
      },
      {
        id: 'C3', title: 'Rename internal variables', kind: 'cleanup', status: 'rejected', reason: 'no user-visible value',
        observation: 'Variable names are inconsistent.', user_impact: 'None visible.', mission_relevance: 'Indirect.',
        hypothesis: 'Cleaner code.', evidence: [], expected_value: 'low', risk: 'low', reversibility: 'high', cost: 'S',
        evaluability: { best_level: null, method: 'none' },
      },
    ],
    selection: {
      candidate_id: 'C1', rationale: 'Bounded, measurable, reversible and on the resume journey.',
      outranked: [{ id: 'C2', why: 'high value but unevaluable and high risk' }, { id: 'C3', why: 'no user value' }],
    },
  };
  return { ...base, ...overrides };
}

// Holdout (hidden, decides): at most 2 steps. Dev (practice): at most 3 steps,
// so a change can pass practice and still fail the holdout.
const stepCheck = (max) => `const fs=require('fs');const j=JSON.parse(fs.readFileSync(process.env.IMPROVE_WORKSPACE+'/src/journey.json'));console.log(JSON.stringify({steps:j.steps}));process.exit(j.steps<=${max}?0:1);`;
const NAV_GATE = ['node', '-e', "const fs=require('fs');const n=JSON.parse(fs.readFileSync('src/nav.json'));process.exit(n.items.includes('today')?0:1)"];

function contract(overrides = {}) {
  return {
    candidate_id: 'C1',
    observation: 'Resuming a task takes 4 steps.',
    user_problem: 'Users repeat a decision and lose momentum.',
    mission_relation: 'Resume work with minimal cognitive drag.',
    hypothesis: 'Removing the repeated confirmation shortens resume to 2 steps.',
    baseline: 'journey.json steps = 4',
    acceptance: [
      {
        id: 'AC-1', statement: 'Resume journey takes at most 2 steps', required_level: 1, mandatory: true, intent: 'gain', baseline_expectation: 'fail', dev_baseline_expectation: 'fail',
        check: { type: 'custom-script', level: 1, artifact: 'holdout/steps.cjs', command: ['node', '{artifact}'] },
        dev_check: { type: 'custom-script', level: 1, artifact: 'dev/steps.cjs', command: ['node', '{artifact}'] },
      },
      { id: 'AC-2', statement: 'Nothing else in the journey becomes harder to understand', required_level: 4, mandatory: false, baseline_expectation: 'n/a' },
    ],
    non_goals: ['Do not redesign navigation'],
    evaluation_method: 'Hidden holdout step count before and after; nav gate must not regress.',
    affected_journey: 'J-RESUME',
    scope: { allowed_paths: ['src/journey.json'], max_files: 2 },
    ux_profile: { preserve: ['navigation items', 'visual language'] },
    safety: { external_side_effects: 'none' },
    gates: [{ id: 'nav', command: NAV_GATE }],
    ...overrides,
  };
}

function peerStream(output, model = 'claude-opus-5-5', cost = 0.01) {
  return [
    JSON.stringify({ type: 'system', subtype: 'init', model }),
    JSON.stringify({ type: 'result', subtype: 'success', structured_output: output, total_cost_usd: cost }),
  ].join('\n');
}
// Fake Duo peer: returns queued outputs in order and records what it was shown.
function fakePeer(outputs) {
  const calls = [];
  const invoke = (req) => {
    calls.push({ ...req, files: fs.readdirSync(req.cwd, { recursive: true }) });
    const out = outputs[Math.min(calls.length - 1, outputs.length - 1)];
    return { status: 0, stdout: peerStream(out), stderr: '' };
  };
  invoke.calls = calls;
  return invoke;
}
const PURSUE = { verdict: 'pursue', reselect_to: null, challenges: ['value is modest'], contract_requirements: ['measure steps'], risks: ['none'] };
const direction = (assessment, steps = []) => ({ assessment, goal_connection: 'Shorter resume keeps momentum.', next_steps: steps, preserve: ['navigation'] });
const KEEP = { direction: direction('complete'), recommendation: 'keep', reason: 'practice checks pass; change is a removal' };
const CONTINUE = { direction: direction('redirect', [{ criterion: 'AC-1', owner: 'builder', action: 'Remove the second confirmation too', done_when: 'steps <= 2' }]), recommendation: 'continue', reason: 'still 3 steps' };
const REVERT_REC = { direction: direction('redirect', [{ criterion: 'AC-1', owner: 'builder', action: 'Restore confirmation', done_when: 'safety preserved' }]), recommendation: 'revert', reason: 'removing the confirmation drops a safety check users rely on' };

const FAKE_BUILDER = (extra = {}) => ({
  id: 'fake-builder', provider: 'fake', command: 'fake', timeout_seconds: 10, max_iterations: 1,
  transcript_path: 'x', output_path: 'y', never_without_human: ['git push'], fake_stdout: 'did it\nCLAIM: complete', ...extra,
});

function writeTmp(f, name, data) {
  const p = path.join(f.root, name);
  fs.writeFileSync(p, JSON.stringify(data));
  return p;
}
const setSteps = (ws, steps) => fs.writeFileSync(path.join(ws, 'src', 'journey.json'), JSON.stringify({ steps }));

// Everything up to a recorded baseline: candidates, Duo critique, evaluator-authored holdout, frozen contract.
async function prepare(f, { checkInput = 'src/journey.json', contractDoc = contract(), runId = 'improve-test', critique = PURSUE, holdoutPrefix = '' } = {}) {
  const { runDir } = improve.startRun({ target: f.repo, mission: f.mission, runId, stateDir: f.state, worktreeRoot: f.worktrees });
  expect(improve.recordCandidates(runDir, writeTmp(f, 'cands.json', candidates())).status).toBe('recorded');
  expect(improve.critique(runDir, { invokePeer: fakePeer([critique]) }).status).toBe('recorded');
  for (const [dir, max] of [['holdout', 2], ['dev', 3]]) {
    fs.mkdirSync(path.join(runDir, dir), { recursive: true });
    fs.writeFileSync(path.join(runDir, dir, 'steps.cjs'), (dir === 'holdout' ? holdoutPrefix : '') + stepCheck(max).replace('/src/journey.json', '/' + checkInput));
  }
  improve.recordOracle(runDir, { role: 'evaluator', executor: 'fake-evaluator', files: ['holdout/steps.cjs'] });
  const frozen = improve.freezeContract(runDir, writeTmp(f, 'contract.json', contractDoc));
  return { runDir, frozen };
}

async function runToImplementation(f, { contractDoc, edits = {}, peer = [KEEP], builder = FAKE_BUILDER(), holdoutPrefix = '' } = {}) {
  const { runDir, frozen } = await prepare(f, { contractDoc, holdoutPrefix });
  expect(frozen.status).toBe('frozen');
  expect((await improve.verifyPhase(runDir, 'baseline')).status).toBe('baseline_recorded');
  const invokePeer = fakePeer(peer);
  const built = await improve.build(runDir, {
    policy: writeTmp(f, 'builder.json', builder),
    invokePeer,
    afterBuilderRound: (ws, round) => { if (edits[round]) edits[round](ws); },
  });
  return { runDir, ws: path.join(f.worktrees, 'improve-test'), built, invokePeer };
}

describe('IMPROVE-01 candidate selection (#173/#175)', () => {
  test('bounded evaluable refinement is selectable; alternatives stay visible', () => {
    const r = improve.validateCandidates(candidates());
    expect(r.ok).toBe(true);
    expect(r.selected.id).toBe('C1');
  });

  test('a gratuitous redesign cannot be selected; it stays an opportunity', () => {
    const doc = candidates();
    doc.candidates[0].status = 'opportunity';
    doc.candidates[0].reason = 'deferred';
    doc.candidates[1].status = 'selected';
    doc.selection = { candidate_id: 'C2', rationale: 'big impact', outranked: [{ id: 'C1', why: 'smaller' }, { id: 'C3', why: 'none' }] };
    const r = improve.validateCandidates(doc);
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/redesign is not a refinement/);
    expect(r.errors.join('\n')).toMatch(/level 1 or 2/);
  });

  test('novelty language is not a user problem, and every alternative needs a reason it lost', () => {
    const doc = candidates();
    doc.candidates[0].hypothesis = 'A cleaner, more modern look will help.';
    doc.candidates[0].user_impact = 'Looks cleaner.';
    doc.selection.outranked = [{ id: 'C2', why: 'x' }];
    const r = improve.validateCandidates(doc);
    expect(r.errors.join('\n')).toMatch(/visual novelty/);
    expect(r.errors.join('\n')).toMatch(/explain why C3/);
  });

  test('unevaluable high-value work cannot be silently rejected', () => {
    const doc = candidates();
    doc.candidates[1].status = 'rejected';
    expect(improve.validateCandidates(doc).errors.join('\n')).toMatch(/stays an opportunity/);
  });
});

describe('IMPROVE-04 side-effect guardrails (#176)', () => {
  test.each([
    ['git push origin main', 'human_only'],
    ['vercel deploy --prod', 'production_deploy'],
    ['supabase db push', 'production_data'],
    ['curl -X POST https://api.telegram.org/bot/sendMessage', 'outbound_communication'],
    ['echo x > .env.local', 'secret_mutation'],
    ['gh pr merge 12', 'human_only'],
    ['terraform destroy', 'destructive_infra'],
  ])('%s is blocked before execution', (cmd, category) => {
    expect(improve.classifySideEffect(cmd)?.category).toBe(category);
  });

  test.each(['pnpm exec eslint src/app.tsx', 'node check.cjs', 'git diff --stat', 'npx next dev -p 3100'])('%s is allowed', (cmd) => {
    expect(improve.classifySideEffect(cmd)).toBeNull();
  });

  test('secrets are removed from command environments', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY_TEST = 'x';
    process.env.ANTHROPIC_TEST_KEY = 'y';
    const { env, removed } = improve.scrubbedEnv();
    expect(env.SUPABASE_SERVICE_ROLE_KEY_TEST).toBeUndefined();
    expect(removed).toContain('SUPABASE_SERVICE_ROLE_KEY_TEST');
    expect(improve.scrubbedEnv({}, { keepProvider: true }).env.ANTHROPIC_TEST_KEY).toBe('y');
    delete process.env.SUPABASE_SERVICE_ROLE_KEY_TEST;
    delete process.env.ANTHROPIC_TEST_KEY;
  });

  test('a blocked exec is recorded in the ledger and never runs', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 2) } });
    const code = await improve.cli(['exec', runDir, '--role', 'builder', '--', 'git', 'push', 'origin', 'main']);
    expect(code).toBe(3);
    const blocked = improve.events(runDir).filter((e) => e.event === 'side_effect_blocked');
    expect(blocked[0]).toMatchObject({ category: 'human_only', executed: false });
  }));

  test('contracts cannot declare prohibited commands', () => {
    const f = fixture();
    const { runDir } = improve.startRun({ target: f.repo, mission: f.mission, runId: 'improve-bad', stateDir: f.state, worktreeRoot: f.worktrees });
    const r = improve.validateContract(runDir, contract({ gates: [{ id: 'ship', command: ['vercel', 'deploy', '--prod'] }] }), null);
    expect(r.errors.join('\n')).toMatch(/prohibited side effect \(production_deploy\)/);
  });
});

describe('IMPROVE-02 frozen contract and evidence strength (#174)', () => {
  test('implementation cannot start without a contract and a baseline', async () => {
    const f = fixture();
    const { runDir } = improve.startRun({ target: f.repo, mission: f.mission, runId: 'improve-early', stateDir: f.state, worktreeRoot: f.worktrees });
    await expect(improve.build(runDir, { policy: writeTmp(f, 'b.json', FAKE_BUILDER()) })).rejects.toThrow(/without a frozen ImprovementContract/);
  });

  test('an unevaluable contract is rejected before freezing', quiet(async () => {
    const f = fixture();
    const { frozen } = await prepare(f, { contractDoc: contract({ acceptance: [contract().acceptance[1]] }) });
    expect(frozen.status).toBe('rejected');
    expect(frozen.errors.join('\n')).toMatch(/unevaluable/);
  }));

  test('acceptance edited after implementation is a new version that cannot rescue a failed change', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 3) }, peer: [KEEP] });
    const weakened = contract();
    weakened.acceptance[0] = { ...weakened.acceptance[0], statement: 'at most 3 steps', check: { ...weakened.acceptance[0].check, artifact: 'holdout/steps3.cjs' } };
    fs.writeFileSync(path.join(runDir, 'holdout', 'steps3.cjs'), stepCheck(3));
    // Too late: the oracle is authored before freezing, so the weakened check cannot even be recorded.
    expect(() => improve.recordOracle(runDir, { role: 'evaluator', executor: 'fake-evaluator', files: ['holdout/steps3.cjs'] })).toThrow(/before the contract is frozen/);
    const v2 = improve.freezeContract(runDir, writeTmp(f, 'weak.json', weakened), { supersede: 'relax after build' });
    expect(v2.status).toBe('rejected');
    expect(improve.governingContract(runDir).entry.version).toBe(1);
    await improve.verifyPhase(runDir, 'after');
    expect(improve.evaluate(runDir).decision).toBe('REVERT');
  }));

  test('judgment cannot satisfy a deterministic requirement: missing stays missing', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 2) } });
    // no holdout run: only a model judgment exists
    improve.append(runDir, 'verification_completed', { phase: 'after', note: 'simulated interruption before checks' });
    const j = improve.submitJudgment(runDir, { criterion: 'AC-1', level: 4, result: 'pass', producer_role: 'ux-evaluator', executor: 'judge', rationale: 'looks shorter' });
    expect(j.status).toBe('recorded');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('INCONCLUSIVE');
    const ac1 = d.criteria.find((c) => c.id === 'AC-1');
    expect(ac1.status).toBe('missing');
    expect(ac1.not_counted.map((n) => n.why).join(' ')).toMatch(/level 4 cannot satisfy level 1/);
  }));

  test('submitted evidence cannot claim level 1 and builder self-review is not counted', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f);
    expect(improve.submitJudgment(runDir, { criterion: 'AC-1', level: 1, result: 'pass', producer_role: 'x', executor: 'y', rationale: 'tests passed' }).status).toBe('rejected');
    expect(improve.submitJudgment(runDir, { criterion: 'AC-2', level: 4, result: 'pass', producer_role: 'builder', executor: 'fake-builder', rationale: 'mine is great' }).status).toBe('recorded_not_counted');
  }));
});

describe('IMPROVE slice 2: Duo peer, evaluator-authored holdout (#175/#178)', () => {
  test('freezing requires a Duo critique that says pursue', quiet(async () => {
    const f = fixture();
    const { frozen } = await prepare(f, { critique: { ...PURSUE, verdict: 'park' } });
    expect(frozen.status).toBe('rejected');
    expect(frozen.errors.join('\n')).toMatch(/critique verdict is park/);
  }));

  test('holdout checks must be hidden holdout artifacts written by a recorded oracle author', quiet(async () => {
    const f = fixture();
    const bad = contract();
    bad.acceptance[0].check = { ...bad.acceptance[0].check, artifact: 'dev/steps.cjs' };
    const r1 = await prepare(f, { contractDoc: bad, runId: 'improve-a' });
    expect(r1.frozen.errors.join('\n')).toMatch(/hidden from builder and peer/);
    const g = fixture();
    const { runDir } = improve.startRun({ target: g.repo, mission: g.mission, runId: 'improve-b', stateDir: g.state, worktreeRoot: g.worktrees });
    improve.recordCandidates(runDir, writeTmp(g, 'c.json', candidates()));
    improve.critique(runDir, { invokePeer: fakePeer([PURSUE]) });
    for (const [dir, max] of [['holdout', 2], ['dev', 3]]) {
      fs.mkdirSync(path.join(runDir, dir), { recursive: true });
      fs.writeFileSync(path.join(runDir, dir, 'steps.cjs'), stepCheck(max));
    }
    // written by the contract writer, never recorded as an oracle author
    const r2 = improve.freezeContract(runDir, writeTmp(g, 'k.json', contract()));
    expect(r2.errors.join('\n')).toMatch(/not authored by a recorded oracle step/);
    expect(() => improve.recordOracle(runDir, { role: 'builder', executor: 'x', files: ['holdout/steps.cjs'] })).toThrow(/evaluator role/);
  }));

  test('peer reuses the hardened duo reviewer invocation', () => {
    const args = improve.peerArgs({ type: 'object' }, 'opus');
    expect(args).toEqual(expect.arrayContaining(['--permission-mode', 'dontAsk', '--tools', 'Read,Glob,Grep', '--safe-mode', '--model', 'opus']));
    expect(args[args.indexOf('--json-schema') + 1]).toBe(JSON.stringify({ type: 'object' }));
  });

  test('peer redirects the builder between rounds and never sees the holdout', quiet(async () => {
    const f = fixture();
    const { runDir, built, invokePeer } = await runToImplementation(f, {
      edits: { 1: (ws) => setSteps(ws, 4), 2: (ws) => setSteps(ws, 2) },
      peer: [CONTINUE, KEEP],
    });
    expect(built.rounds.map((r) => r.recommendation)).toEqual(['continue', 'keep']);
    expect(built.rounds[0].dev).toEqual({ 'AC-1': 'fail' });
    const round2 = fs.readFileSync(path.join(runDir, 'adapters', 'builder-r2.prompt.md'), 'utf8');
    expect(round2).toMatch(/Remove the second confirmation too/);
    expect(round2).not.toMatch(/holdout\/steps/);
    for (const call of invokePeer.calls.slice(1)) {
      expect(call.files.join(' ')).not.toMatch(/holdout/);
      expect(call.input).toMatch(/goal-focused technical partner/); // duo-direction prompt reused
    }
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('KEEP');
    expect(d.peer_rounds[0].independence).toBe('same-vendor');
  }));

  test('peer keep while a practice check fails is invalid and cannot produce KEEP', quiet(async () => {
    const f = fixture();
    const { built } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 4) }, peer: [KEEP] });
    expect(built.stop_reason).toMatch(/keep recommended while a practice check fails/);
    expect(built.peer_recommendation).toBeNull();
  }));

  test('repair budget matches duo-build: 1 initial round + 3 repairs', quiet(async () => {
    const f = fixture();
    const { built } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 4) }, peer: [CONTINUE] });
    expect(built.rounds).toHaveLength(4);
    expect(built.stop_reason).toBe('repair budget exhausted');
  }));

  test('the hidden holdout decides, not the practice checks', quiet(async () => {
    const f = fixture();
    // 3 steps passes practice (<=3) and fails the holdout (<=2).
    const { runDir, built } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 3) }, peer: [KEEP] });
    expect(built.rounds[0].dev).toEqual({ 'AC-1': 'pass' });
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('REVERT'); // the peer's keep cannot rescue a failed holdout
    expect(d.reasons.join(' ')).toMatch(/mandatory criteria failed: AC-1/);
  }));

  test('the holdout is single use', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 2) } });
    await improve.verifyPhase(runDir, 'after');
    await expect(improve.verifyPhase(runDir, 'after')).rejects.toThrow(/already consumed/);
  }));

  test('a builder that reads the run directory exposes the holdout: INCONCLUSIVE', quiet(async () => {
    const f = fixture();
    const peek = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Read', input: { file_path: path.join(f.state, 'improve-test', 'holdout', 'steps.cjs') } }] } });
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 2) }, builder: FAKE_BUILDER({ fake_stdout: `${peek}\nCLAIM: complete` }) });
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('INCONCLUSIVE');
    expect(d.reasons.join(' ')).toMatch(/holdout exposed to builder/);
  }));

  test('peer disagreement withholds KEEP; a human decides', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 2) }, peer: [REVERT_REC] });
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('INCONCLUSIVE');
    expect(d.reasons.join(' ')).toMatch(/Duo peer recommends revert while the checks pass/);
  }));

  test('a failed run surfaces the peer\'s user-owned decision as the human next decision', quiet(async () => {
    const f = fixture();
    const ask = { direction: direction('redirect', [{ criterion: 'AC-1', owner: 'user', action: 'Choose whether the card may grow.', done_when: 'option named' }]), recommendation: 'revert', reason: 'conflicting non-goals' };
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 3) }, peer: [ask] });
    await improve.verifyPhase(runDir, 'after');
    expect(improve.evaluate(runDir).decision).toBe('REVERT');
    const report = fs.readFileSync(improve.finalize(runDir).report, 'utf8');
    expect(report).toMatch(/Choose whether the card may grow\. Done when: option named/);
  }));

  test('an oracle dispute on a mandatory criterion is INCONCLUSIVE, and the builder cannot raise one', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 2) } });
    expect(() => improve.dispute(runDir, { criterion: 'AC-1', reason: 'threshold wrong', role: 'builder', executor: 'fake-builder' })).toThrow(/builder cannot dispute/);
    improve.dispute(runDir, { criterion: 'AC-1', reason: 'the 2-step label assumed a flow users do not take', role: 'evaluator', executor: 'judge' });
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('INCONCLUSIVE');
    expect(d.reasons.join(' ')).toMatch(/oracle disputed for AC-1/);
  }));

  test('the builder may not be the oracle author', quiet(async () => {
    const f = fixture();
    const { runDir } = await prepare(f);
    await improve.verifyPhase(runDir, 'baseline');
    await expect(improve.build(runDir, { policy: writeTmp(f, 'b.json', FAKE_BUILDER({ id: 'fake-evaluator' })), invokePeer: fakePeer([KEEP]) })).rejects.toThrow(/authored the oracle/);
  }));
});

describe('IMPROVE-GAIN (#174/#178)', () => {
  test.each(['preservation', 'optional-gain', 'undeclared'])('GAIN-1: %s cannot authorize a new improvement contract', quiet(async (kind) => {
    const f = fixture();
    try {
      const doc = contract();
      if (kind === 'preservation') Object.assign(doc.acceptance[0], { intent: 'preservation', baseline_expectation: 'pass' });
      if (kind === 'optional-gain') doc.acceptance[0].mandatory = false;
      if (kind === 'undeclared') delete doc.acceptance[0].intent;
      const { frozen } = await prepare(f, { contractDoc: doc });
      expect(frozen.status).toBe('rejected');
      expect(frozen.errors.join(' ')).toMatch(/mandatory.*gain/);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test('GAIN-2: a practice baseline mismatch names its set and blocks build', quiet(async () => {
    const f = fixture();
    try {
      const doc = contract(); doc.acceptance[0].dev_baseline_expectation = 'pass';
      const { runDir } = await prepare(f, { contractDoc: doc });
      const result = await improve.verifyPhase(runDir, 'baseline');
      expect(result).toMatchObject({ status: 'baseline_blocked', mismatches: [{ set: 'dev', criterion: 'AC-1', expected: 'pass', observed: 'fail' }] });
      await expect(improve.build(runDir, { policy: writeTmp(f, 'b.json', FAKE_BUILDER()), invokePeer: fakePeer([KEEP]) })).rejects.toThrow(/baseline/i);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test('GAIN-2: holdout preservation and practice improvement may differ without counting practice as gain', quiet(async () => {
    const f = fixture();
    try {
      const doc = contract();
      doc.acceptance.push({ ...doc.acceptance[0], id: 'PRESERVE', intent: 'preservation', baseline_expectation: 'pass',
        check: { ...doc.acceptance[0].check, command: ['node', '-e', 'process.exit(0)'] } });
      const { runDir } = await runToImplementation(f, { contractDoc: doc, edits: { 1: w => setSteps(w, 2) } });
      await improve.verifyPhase(runDir, 'after');
      const d = improve.evaluate(runDir);
      expect(d.decision).toBe('KEEP');
      expect(d.gains.map(g => g.criterion)).toEqual(['AC-1']);
      expect(d.gains[0]).toMatchObject({ established: true, baseline: 'fail', after: 'pass' });
      const report = fs.readFileSync(improve.finalize(runDir).report, 'utf8');
      expect(report).toMatch(/Declared gains/);
      expect(report).toContain(d.gains[0].baseline_evidence);
      expect(report).toMatch(/PRESERVE.*\| pass \| pass \|/);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test('GAIN-3: a different verifier environment cannot establish a matched gain', quiet(async () => {
    const f = fixture(), old = process.env.IMPROVE_GAIN_TEST_SETTING;
    try {
      const { runDir } = await runToImplementation(f, { edits: { 1: w => setSteps(w, 2) } });
      process.env.IMPROVE_GAIN_TEST_SETTING = 'different-after-baseline';
      await improve.verifyPhase(runDir, 'after');
      const d = improve.evaluate(runDir);
      expect(d.decision).toBe('INCONCLUSIVE');
      expect(d.reasons.join(' ')).toMatch(/verifier.*baseline/i);
      expect(improve.finalize(runDir).branch_retained).toBe(false);
    } finally {
      if (old === undefined) delete process.env.IMPROVE_GAIN_TEST_SETTING; else process.env.IMPROVE_GAIN_TEST_SETTING = old;
      fs.rmSync(f.root, { recursive: true, force: true });
    }
  }));

  test('GAIN-4: a pre-existing required gate failure vetoes KEEP despite a real gain', quiet(async () => {
    const f = fixture();
    try {
      const doc = contract({ gates: [{ id: 'broken', command: ['node', '-e', 'process.exit(1)'] }] });
      const { runDir } = await runToImplementation(f, { contractDoc: doc, edits: { 1: w => setSteps(w, 2) } });
      await improve.verifyPhase(runDir, 'after');
      const d = improve.evaluate(runDir);
      expect(d.decision).toBe('REVERT');
      expect(d.reasons.join(' ')).toMatch(/required gates failed: broken/);
      expect(improve.finalize(runDir).branch_retained).toBe(false);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test.each(['pass', 'unavailable'])('GAIN-3: every mandatory gain needs matched evidence (second gain %s)', quiet(async (outcome) => {
    const f = fixture();
    try {
      const doc = contract();
      doc.acceptance.push({ ...doc.acceptance[0], id: 'GAIN-SECOND',
        check: { ...doc.acceptance[0].check, command: ['node', '-e', `process.exit(process.env.IMPROVE_PHASE==='baseline'?1:${outcome === 'pass' ? 0 : 2})`] } });
      const { runDir } = await runToImplementation(f, { contractDoc: doc, edits: { 1: w => setSteps(w, 2) } });
      await improve.verifyPhase(runDir, 'after');
      const d = improve.evaluate(runDir);
      expect(d.gains[0].established).toBe(true);
      expect(d.gains[1].established).toBe(outcome === 'pass');
      expect(d.decision).toBe(outcome === 'pass' ? 'KEEP' : 'INCONCLUSIVE');
      if (outcome !== 'pass') expect(d.reasons.join(' ')).toMatch(/gain GAIN-SECOND not established/);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test.each(['acceptance', 'gate'])('GAIN-4: input drift cannot erase a demonstrated %s failure', quiet(async (failure) => {
    const f = fixture();
    try {
      const doc = contract({ scope: { allowed_paths: ['src/**'] } });
      const { runDir, ws } = await runToImplementation(f, { contractDoc: doc, edits: { 1: w => {
        setSteps(w, failure === 'acceptance' ? 3 : 2);
        if (failure === 'gate') fs.writeFileSync(path.join(w, 'src/nav.json'), JSON.stringify({ items: ['home'] }));
      } } });
      await improve.verifyPhase(runDir, 'after');
      fs.writeFileSync(path.join(ws, 'src/unrelated.txt'), 'new input after verification');
      const d = improve.evaluate(runDir);
      expect(d.decision).toBe('REVERT');
      expect(d.reasons.join(' ')).toMatch(failure === 'gate' ? /required gates failed: nav/ : /mandatory criteria failed: AC-1/);
      expect(improve.finalize(runDir).branch_retained).toBe(false);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test('GAIN-5: a rejected late baseline command does not invalidate an admitted run', quiet(async () => {
    const f = fixture();
    try {
      const { runDir } = await runToImplementation(f, { edits: { 1: w => setSteps(w, 2) } });
      const attempts = improve.events(runDir).filter(e => e.event === 'baseline_attempted').length;
      await expect(improve.verifyPhase(runDir, 'baseline')).rejects.toThrow(/before implementation/);
      expect(improve.events(runDir).filter(e => e.event === 'baseline_attempted')).toHaveLength(attempts);
      await improve.verifyPhase(runDir, 'after');
      expect(improve.evaluate(runDir).decision).toBe('KEEP');
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));

  test.each(['gain', 'preservation'])('GAIN-5: legacy %s evidence cannot gain KEEP authority and is never rewritten', quiet(async (kind) => {
    const f = fixture();
    try {
      const { runDir } = await prepare(f);
      // Construct a historical v1 fixture BEFORE any baseline/build/checks.
      // This is test fixture synthesis, never a supported run-migration path.
      const crypto = require('crypto'), runner = require('../../scripts/specflow-runner.cjs');
      const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
      const file = improve.governingContract(runDir).entry.path;
      const frozen = JSON.parse(fs.readFileSync(file, 'utf8'));
      frozen.schema = 'specflow.improvement-contract/v1';
      for (const a of frozen.contract.acceptance) { delete a.intent; delete a.dev_baseline_expectation; }
      if (kind === 'preservation') {
        frozen.contract.acceptance[0].baseline_expectation = 'pass';
        frozen.contract.acceptance[0].check.command = ['node', '-e', 'process.exit(0)'];
      }
      fs.writeFileSync(file, JSON.stringify(frozen, null, 2) + '\n');
      const original = fs.readFileSync(file, 'utf8');
      const ledger = runner.verificationPaths({ runDir }).ledgerPath;
      const rows = fs.readFileSync(ledger, 'utf8').trim().split('\n').map(JSON.parse), lines = [];
      for (const [i, e] of rows.entries()) {
        if (e.event === 'contract_frozen') e.contract_sha256 = hash(original);
        if (e.stage === 'improve') { e.seq = i; e.prev_sha256 = i ? hash(lines[i - 1]) : null; }
        lines.push(JSON.stringify(e));
      }
      fs.writeFileSync(ledger, lines.join('\n') + '\n');
      expect(improve.verifyLedger(runDir).ok).toBe(true);
      expect((await improve.verifyPhase(runDir, 'baseline')).status).toBe('baseline_recorded');
      await improve.build(runDir, { policy: writeTmp(f, 'b.json', FAKE_BUILDER()), invokePeer: fakePeer([KEEP]), afterBuilderRound: w => {
        if (kind === 'gain') setSteps(w, 2);
        else fs.writeFileSync(path.join(w, 'src/journey.json'), JSON.stringify({ steps: 4, note: 'unrelated metadata' }));
      } });
      await improve.verifyPhase(runDir, 'after');
      const evidenceBefore = fs.readFileSync(path.join(runDir, 'evidence.jsonl'), 'utf8');
      const d = improve.evaluate(runDir);
      expect(d.decision).toBe('INCONCLUSIVE');
      expect(d.reasons.join(' ')).toMatch(/no mandatory executable gain declared/);
      expect(fs.readFileSync(file, 'utf8')).toBe(original);
      expect(fs.readFileSync(path.join(runDir, 'evidence.jsonl'), 'utf8')).toBe(evidenceBefore);
      await expect(improve.verifyPhase(runDir, 'after')).rejects.toThrow(/already consumed/);
      expect(improve.finalize(runDir).branch_retained).toBe(false);
    } finally { fs.rmSync(f.root, { recursive: true, force: true }); }
  }));
});

describe('IMPROVE-06 decision (#178) and reversibility (#176)', () => {
  test('true improvement: KEEP retains an identifiable commit on an isolated branch; base untouched', quiet(async () => {
    const f = fixture();
    const baseCommit = git(f.repo, 'rev-parse', 'main');
    const { runDir, ws } = await runToImplementation(f, { edits: { 1: (w) => setSteps(w, 2) } });
    expect((await improve.verifyPhase(runDir, 'after')).summary).toMatchObject({ 'AC-1': 'pass', 'gate:nav': 'pass' });
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('KEEP');
    const applied = improve.finalize(runDir);
    expect(applied.branch_retained).toBe(true);
    expect(git(f.repo, 'rev-parse', 'main')).toBe(baseCommit);
    expect(git(f.repo, 'show', `${applied.commit}:src/journey.json`)).toContain('"steps":2');
    expect(fs.existsSync(ws)).toBe(false);
    const report = fs.readFileSync(applied.report, 'utf8');
    expect(report).toMatch(/— KEEP/);
    expect(report).toMatch(/Improvement established/);
    expect(report).toMatch(/Duo rounds/);
    expect(report).toMatch(/consumed once for the decision/);
    expect(improve.status(runDir)).toMatchObject({ terminal: true, decision: 'KEEP' });
  }));

  test('regression: REVERT leaves no product diff but preserves patch and evidence', quiet(async () => {
    const f = fixture();
    const baseCommit = git(f.repo, 'rev-parse', 'main');
    const { runDir } = await runToImplementation(f, {
      contractDoc: contract({ scope: { allowed_paths: ['src/**'] } }),
      edits: { 1: (ws) => { setSteps(ws, 2); fs.writeFileSync(path.join(ws, 'src', 'nav.json'), JSON.stringify({ items: ['home'] })); } },
    });
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('REVERT');
    expect(d.reasons.join(' ')).toMatch(/gates regressed from baseline: nav/);
    expect(d.divergence).toBe('builder_claimed_complete_but_decision_differs');
    const applied = improve.finalize(runDir);
    expect(applied.branch_retained).toBe(false);
    expect(git(f.repo, 'branch', '--list', 'specflow/improve-test')).toBe('');
    expect(git(f.repo, 'rev-parse', 'main')).toBe(baseCommit);
    expect(git(f.repo, 'status', '--porcelain', '--untracked-files=no')).toBe('');
    expect(fs.readFileSync(path.join(runDir, 'workspace.patch'), 'utf8')).toMatch(/nav\.json/);
    expect(fs.readFileSync(applied.report, 'utf8')).toMatch(/— REVERT/);
  }));

  test('changes outside the frozen scope are reverted even when checks pass', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => { setSteps(ws, 2); fs.writeFileSync(path.join(ws, 'README.md'), 'rewritten'); } } });
    await improve.verifyPhase(runDir, 'after');
    const d = improve.evaluate(runDir);
    expect(d.decision).toBe('REVERT');
    expect(d.scope.outside_scope).toEqual(['README.md']);
  }));

  test('interrupted run is never terminal and a workspace mutated after evaluation cannot be applied', quiet(async () => {
    const f = fixture();
    const { runDir, ws } = await runToImplementation(f, { edits: { 1: (w) => setSteps(w, 2) } });
    expect(improve.status(runDir)).toMatchObject({ terminal: false, decision: null });
    await improve.verifyPhase(runDir, 'after');
    improve.evaluate(runDir);
    setSteps(ws, 1);
    expect(() => improve.finalize(runDir)).toThrow(/changed after evaluation/);
    expect(improve.status(runDir).terminal).toBe(false);
  }));

  test('a frozen check edited after freezing blocks verification', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f, { edits: { 1: (ws) => setSteps(ws, 3) } });
    fs.writeFileSync(path.join(runDir, 'holdout', 'steps.cjs'), 'process.exit(0)');
    expect((await improve.verifyPhase(runDir, 'after')).status).toBe('blocked');
  }));
});

describe('IMPROVE-07 ledger (#179)', () => {
  test('editing or dropping a ledger line breaks the chain', quiet(async () => {
    const f = fixture();
    const { runDir } = await runToImplementation(f);
    expect(improve.verifyLedger(runDir).ok).toBe(true);
    const ledger = path.join(runDir, 'ledger.jsonl');
    const lines = fs.readFileSync(ledger, 'utf8').split('\n').filter(Boolean);
    lines.splice(2, 1);
    fs.writeFileSync(ledger, `${lines.join('\n')}\n`);
    expect(improve.verifyLedger(runDir).ok).toBe(false);
  }));
});

describe('IMPROVE-BIND #201 evidence freshness', () => {
  test('Q1: a candidate changed after passing verification cannot KEEP', quiet(async () => {
    const f=fixture();
    try {
      const {runDir,ws}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});
      await improve.verifyPhase(runDir,'after');setSteps(ws,9);
      expect(improve.evaluate(runDir).decision).not.toBe('KEEP');
    } finally {fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('Q2: a superseding contract cannot reuse a baseline from the old version', quiet(async () => {
    const f=fixture();
    try {
      const {runDir}=await prepare(f);await improve.verifyPhase(runDir,'baseline');
      const updated=contract({hypothesis:'Current contract must have its own baseline evidence.'});
      expect(improve.freezeContract(runDir,writeTmp(f,'contract-next.json',updated),{supersede:'Refined expectations before build'}).status).toBe('frozen');
      await expect(improve.build(runDir,{policy:writeTmp(f,'builder.json',FAKE_BUILDER()),invokePeer:fakePeer([KEEP])})).rejects.toThrow(/baseline/i);
    } finally {fs.rmSync(f.root,{recursive:true,force:true});}
  }));
});

describe('IMPROVE-BIND #201 negative routes and retention',()=>{
  test.each(['untracked','ignored','mode','deleted','environment'])('%s input changes invalidate passing verification',quiet(async kind=>{
    const f=fixture(),saved=process.env.SPECFLOW_BIND_FIXTURE;
    try {
      fs.writeFileSync(path.join(f.repo,'.gitignore'),'cache.dat\n');git(f.repo,'add','.gitignore');git(f.repo,'commit','-m','ignore generated cache');
      const {runDir,ws}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});
      if(kind==='ignored')fs.writeFileSync(path.join(ws,'cache.dat'),'before');
      await improve.verifyPhase(runDir,'after');
      if(kind==='untracked')fs.writeFileSync(path.join(ws,'new-input.txt'),'after');
      if(kind==='ignored')fs.writeFileSync(path.join(ws,'cache.dat'),'after');
      if(kind==='mode')fs.chmodSync(path.join(ws,'src/journey.json'),0o755);
      if(kind==='deleted')fs.unlinkSync(path.join(ws,'src/nav.json'));
      if(kind==='environment')process.env.SPECFLOW_BIND_FIXTURE='changed-after-verification';
      const result=improve.evaluate(runDir);expect(result.decision).not.toBe('KEEP');expect(result.binding_errors.length).toBeGreaterThan(0);
    }finally{if(saved===undefined)delete process.env.SPECFLOW_BIND_FIXTURE;else process.env.SPECFLOW_BIND_FIXTURE=saved;fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test.each([2,3])('edit-and-restore during a holdout invalidates positive evidence but preserves failures (steps %s)',quiet(async steps=>{
    const f=fixture();try{
      const prefix="if(process.env.IMPROVE_PHASE==='after'){const fs=require('fs'),p=process.env.IMPROVE_WORKSPACE+'/src/journey.json',b=fs.readFileSync(p);fs.writeFileSync(p,'changed');fs.writeFileSync(p,b);}";
      const {runDir}=await runToImplementation(f,{edits:{1:w=>setSteps(w,steps)},holdoutPrefix:prefix});
      expect((await improve.verifyPhase(runDir,'after')).status).toBe('blocked');
      expect(improve.events(runDir).filter(e=>e.event==='holdout_consumed')).toHaveLength(1);
      await expect(improve.verifyPhase(runDir,'after')).rejects.toThrow(/already consumed/);
      expect(improve.evaluate(runDir).decision).toBe(steps===2?'INCONCLUSIVE':'REVERT');
      const report=fs.readFileSync(improve.writeReport(runDir),'utf8');
      expect(report).toContain(steps===2?'| fail | - | **missing**':'| fail | fail | **failed**');
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test.each(['external','dangling'])('%s symlinks fail before consuming the holdout',quiet(async kind=>{
    const f=fixture();try{
      const {runDir,ws}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});
      fs.symlinkSync(kind==='external'?f.mission:path.join(f.root,'missing'),path.join(ws,'link'));
      expect((await improve.verifyPhase(runDir,'after')).status).toBe('blocked');expect(improve.events(runDir).some(e=>e.event==='holdout_consumed')).toBe(false);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test.each(['missing','tampered','swapped-evidence'])('%s receipt/evidence cannot satisfy KEEP',quiet(async kind=>{
    const f=fixture();try{
      const {runDir}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});await improve.verifyPhase(runDir,'after');
      const receipt=improve.events(runDir).filter(e=>e.event==='verification_receipt'&&e.phase==='after').at(-1);
      if(kind==='missing')fs.unlinkSync(receipt.path);
      if(kind==='tampered')fs.appendFileSync(receipt.path,' ');
      if(kind==='swapped-evidence'){
        const p=path.join(runDir,'evidence.jsonl'),rows=fs.readFileSync(p,'utf8').trim().split('\n').map(JSON.parse);const after=rows.find(e=>e.phase==='after'&&e.set==='holdout');after.contract_version=999;fs.writeFileSync(p,rows.map(JSON.stringify).join('\n')+'\n');
      }
      expect(improve.evaluate(runDir).decision).toBe('INCONCLUSIVE');await expect(improve.verifyPhase(runDir,'after')).rejects.toThrow(/already consumed/);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('newer failed baseline attempt prevents fallback to earlier successful evidence',quiet(async()=>{
    const f=fixture();try{
      const {runDir}=await prepare(f);await improve.verifyPhase(runDir,'baseline');
      const baseline=improve.events(runDir).find(e=>e.event==='workspace_prepared'&&e.kind==='baseline');
      setSteps(path.join(f.worktrees,'improve-test-baseline'),2);expect((await improve.verifyPhase(runDir,'baseline')).status).toBe('baseline_blocked');
      await expect(improve.build(runDir,{policy:writeTmp(f,'builder.json',FAKE_BUILDER()),invokePeer:fakePeer([KEEP])})).rejects.toThrow(/Baseline/);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('KEEP retains the verified tree without executing commit hooks',quiet(async()=>{
    const f=fixture();try{
      const {runDir,ws}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});await improve.verifyPhase(runDir,'after');
      const decision=improve.evaluate(runDir);expect(decision.decision).toBe('KEEP');
      const hooks=path.join(f.repo,'.git','hooks');fs.writeFileSync(path.join(hooks,'pre-commit'),'#!/bin/sh\necho unverified > src/journey.json\ngit add src/journey.json\n',{mode:0o755});
      const applied=improve.finalize(runDir);expect(git(f.repo,'rev-parse',applied.commit+'^{tree}')).toBe(decision.workspace.verified_git.tree);expect(JSON.parse(git(f.repo,'show',applied.commit+':src/journey.json')).steps).toBe(2);expect(applied.base.unchanged).toBe(true);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('ignored input mutation after evaluation refuses final retention',quiet(async()=>{
    const f=fixture();try{
      fs.writeFileSync(path.join(f.repo,'.gitignore'),'cache.dat\n');git(f.repo,'add','.gitignore');git(f.repo,'commit','-m','ignore generated input');
      const {runDir,ws}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});fs.writeFileSync(path.join(ws,'cache.dat'),'before');await improve.verifyPhase(runDir,'after');expect(improve.evaluate(runDir).decision).toBe('KEEP');fs.writeFileSync(path.join(ws,'cache.dat'),'after');expect(()=>improve.finalize(runDir)).toThrow(/binding/i);expect(improve.status(runDir).terminal).toBe(false);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
});

test('IMPROVE-BIND: explicit current baseline blocker still caps a passing candidate at INCONCLUSIVE',quiet(async()=>{
  const f=fixture();try{
    const doc=contract();doc.acceptance[0].dev_baseline_expectation='pass';
    const {runDir}=await prepare(f,{contractDoc:doc});expect((await improve.verifyPhase(runDir,'baseline')).status).toBe('baseline_blocked');
    await improve.build(runDir,{policy:writeTmp(f,'builder.json',FAKE_BUILDER()),invokePeer:fakePeer([KEEP]),acceptBaselineBlocker:'Owner accepts current baseline limitation',afterBuilderRound:w=>setSteps(w,2)});
    await improve.verifyPhase(runDir,'after');expect(improve.evaluate(runDir).decision).toBe('INCONCLUSIVE');
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
}));

test('IMPROVE-BIND: legacy interrupted after-verification cannot expose the holdout again',quiet(async()=>{
  const f=fixture();try{
    const {runDir}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});improve.append(runDir,'verification_started',{phase:'after',contract_version:1});
    await expect(improve.verifyPhase(runDir,'after')).rejects.toThrow(/Legacy.*holdout/);expect(improve.evaluate(runDir).decision).toBe('INCONCLUSIVE');
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
}));
test('IMPROVE-BIND: repaired prerequisite may retry before holdout consumption',quiet(async()=>{
  const f=fixture();try{
    const {runDir,ws}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)}});fs.symlinkSync(f.mission,path.join(ws,'bad-link'));
    expect((await improve.verifyPhase(runDir,'after')).status).toBe('blocked');fs.unlinkSync(path.join(ws,'bad-link'));expect((await improve.verifyPhase(runDir,'after')).status).toBe('verified');expect(improve.evaluate(runDir).decision).toBe('KEEP');expect(improve.events(runDir).filter(e=>e.event==='holdout_consumed')).toHaveLength(1);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
}));

describe('IMPROVE-04 RUNTIME scalable input identity (#176)',()=>{
  const binding=require('../../scripts/improve-binding.cjs');
  const big=(dir,mb)=>{fs.mkdirSync(path.join(dir,'node_modules','dep'),{recursive:true});const chunk=Buffer.alloc(1024*1024,7);const fd=fs.openSync(path.join(dir,'node_modules','dep','blob.bin'),'w');for(let i=0;i<mb;i++)fs.writeSync(fd,chunk);fs.closeSync(fd);};
  const runtime=(identity,extra={})=>({...contract(),runtime:{identity,...extra}});
  test('RUNTIME-01: the default cap still rejects a >256 MiB tree; a declared bound seals it without exclusion',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt01-'));try{
      big(root,260);
      expect(()=>binding.workspace(root)).toThrow(/exceeds 256 MiB/);
      const id=binding.workspace(root,{limits:{max_bytes:1024*1024*1024}});
      expect(id.entries.some(e=>e.path==='node_modules/dep/blob.bin'&&e.sha256)).toBe(true);
      expect(id.bytes).toBeGreaterThan(256*1024*1024);
      expect(()=>binding.workspace(root,{limits:{max_bytes:300*1024*1024,max_entries:3}})).toThrow(/exceeds 3 entries/);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test('RUNTIME-02: a changed dependency byte or a restored mtime still changes identity',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'rt02-'));try{
      big(root,2);const file=path.join(root,'node_modules','dep','blob.bin');
      const before=binding.workspace(root).sha256,st=fs.statSync(file);
      const fd=fs.openSync(file,'r+');fs.writeSync(fd,Buffer.from([9]),0,1,1024);fs.closeSync(fd);fs.utimesSync(file,st.atime,st.mtime);
      expect(binding.workspace(root).sha256).not.toBe(before);
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test('RUNTIME-03: equivalent workspace-local executables compare equal across worktrees; changed bytes do not',()=>{
    const roots=[0,1].map(i=>fs.mkdtempSync(path.join(os.tmpdir(),`rt03-${i}-`)));try{
      for(const r of roots){fs.mkdirSync(path.join(r,'bin'));fs.writeFileSync(path.join(r,'bin','tool'),'#!/bin/sh\nexit 0\n',{mode:0o755});}
      const c={acceptance:[{check:{command:['bin/tool']}}]},env={PATH:'/usr/bin:/bin'};
      expect(binding.verifier(c,roots[0],env,[])).toBe(binding.verifier(c,roots[1],env,[]));
      fs.writeFileSync(path.join(roots[1],'bin','tool'),'#!/bin/sh\nexit 1\n',{mode:0o755});
      expect(binding.verifier(c,roots[0],env,[])).not.toBe(binding.verifier(c,roots[1],env,[]));
    }finally{for(const r of roots)fs.rmSync(r,{recursive:true,force:true});}
  });
  test('RUNTIME-03: disposable outputs must be untracked, non-symlink and disjoint',()=>{
    const f=fixture();try{
      fs.mkdirSync(path.join(f.repo,'out'));fs.writeFileSync(path.join(f.repo,'out','x'),'1');
      expect(binding.workspace(f.repo,{outputs:['out']}).entries.find(e=>e.path==='out/x').kind).toBe('file');
      expect(()=>binding.workspace(f.repo,{outputs:['src']})).toThrow(/tracked inputs/);
      expect(()=>binding.workspace(f.repo,{outputs:['../x']})).toThrow(/unsafe/);
      expect(()=>binding.workspace(f.repo,{outputs:['out','out/x']})).toThrow(/overlap/);
      fs.rmSync(path.join(f.repo,'out'),{recursive:true});fs.symlinkSync(path.join(f.repo,'src'),path.join(f.repo,'out'));
      expect(()=>binding.workspace(f.repo,{outputs:['out']})).toThrow(/symlink/);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  });
  test('RUNTIME: invalid identity declarations are rejected before freezing',quiet(async()=>{
    const f=fixture();try{
      const {frozen}=await prepare(f,{contractDoc:runtime({max_bytes:-1,disposable_outputs:['/abs','src/journey.json']})});
      expect(frozen.status).not.toBe('frozen');
      const text=JSON.stringify(frozen);expect(text).toMatch(/max_bytes/);expect(text).toMatch(/unsafe path \/abs/);expect(text).toMatch(/overlaps the change scope/);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('RUNTIME: a pre-planted output is wiped before setup, outputs created or churned during checks do not block, and KEEP holds',quiet(async()=>{
    const f=fixture();try{
      fs.writeFileSync(path.join(f.repo,'.gitignore'),'.out/\ngen.info\n');git(f.repo,'add','.gitignore');git(f.repo,'commit','-m','ignore outputs');
      const holdoutPrefix="{const fs=require('fs'),p=process.env.IMPROVE_WORKSPACE+'/.out';if(fs.existsSync(p+'/planted'))process.exit(3);fs.mkdirSync(p,{recursive:true});fs.writeFileSync(p+'/churn',String(Math.random()));fs.writeFileSync(process.env.IMPROVE_WORKSPACE+'/gen.info',String(Math.random()));}";
      const doc=runtime({max_bytes:64*1024*1024,disposable_outputs:['.out'],mutable_outputs:['.out/churn','gen.info']},{setup:[['node','-e',"require('fs').mkdirSync('.out',{recursive:true});require('fs').writeFileSync('.out/build','x')"]]});
      const {runDir,ws}=await runToImplementation(f,{contractDoc:doc,holdoutPrefix,edits:{1:w=>{setSteps(w,2);fs.mkdirSync(path.join(w,'.out'),{recursive:true});fs.writeFileSync(path.join(w,'.out','planted'),'builder build');}}});
      expect((await improve.verifyPhase(runDir,'after')).status).toBe('verified');
      expect(fs.existsSync(path.join(ws,'.out','planted'))).toBe(false);
      expect(improve.evaluate(runDir).decision).toBe('KEEP');
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
});

test('IMPROVE-04 RUNTIME: a blocked verification names the inputs that changed',quiet(async()=>{
  const f=fixture();try{
    const prefix="if(process.env.IMPROVE_PHASE==='after')require('fs').writeFileSync(process.env.IMPROVE_WORKSPACE+'/stray.txt','x');";
    const {runDir}=await runToImplementation(f,{edits:{1:w=>setSteps(w,2)},holdoutPrefix:prefix});
    const r=await improve.verifyPhase(runDir,'after');
    expect(r.status).toBe('blocked');expect(r.reason).toMatch(/workspace \(\d+\): .*stray\.txt/);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
}));


describe('IMPROVE runtime integrity repair (#222)',()=>{
  const binding=require('../../scripts/improve-binding.cjs');
  const generated=()=>contract({runtime:{identity:{disposable_outputs:['.out']},setup:[['node','-e',"const fs=require('fs');fs.mkdirSync('.out',{recursive:true});fs.copyFileSync('src/journey.json','.out/generated.json')"]]}});
  async function builtGenerated(f,prefix='') {
    const {runDir,frozen}=await prepare(f,{contractDoc:generated(),checkInput:'.out/generated.json',holdoutPrefix:prefix});
    expect(frozen.status).toBe('frozen');const base=await improve.verifyPhase(runDir,'baseline');if(base.status!=='baseline_recorded')throw Error(JSON.stringify(base));
    await improve.build(runDir,{policy:writeTmp(f,'builder.json',FAKE_BUILDER()),invokePeer:fakePeer([KEEP]),afterBuilderRound:ws=>setSteps(ws,2)});
    return {runDir,ws:path.join(f.worktrees,'improve-test')};
  }
  const ignored=f=>{fs.writeFileSync(path.join(f.repo,'.gitignore'),'.out/\n');git(f.repo,'add','.gitignore');git(f.repo,'commit','-m','ignore output');};
  test('FIX-1: reject every symlink ancestor before deleting output',()=>{
    const f=fixture();try{
      const external=path.join(f.root,'external');fs.mkdirSync(path.join(external,'cache'),{recursive:true});fs.writeFileSync(path.join(external,'cache','canary'),'owned elsewhere');fs.symlinkSync(external,path.join(f.repo,'link'));
      expect(()=>binding.wipeOutputs(f.repo,['link/cache'])).toThrow(/symlink|escape/i);
      expect(fs.readFileSync(path.join(external,'cache','canary'),'utf8')).toBe('owned elsewhere');
      expect(()=>binding.wipeOutputs(f.repo,['link/missing/cache'])).toThrow(/symlink|escape/i);
    }finally{fs.rmSync(f.root,{recursive:true,force:true});}
  });
  test('FIX-2: generated input changed after verification invalidates KEEP',quiet(async()=>{
    const f=fixture();try{ignored(f);const {runDir,ws}=await builtGenerated(f);expect((await improve.verifyPhase(runDir,'after')).status).toBe('verified');fs.writeFileSync(path.join(ws,'.out','generated.json'),'{"steps":99}');expect(improve.evaluate(runDir).decision).not.toBe('KEEP');}finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('FIX-2: generated input changed during checks blocks the bound receipt',quiet(async()=>{
    const f=fixture();try{ignored(f);const prefix="if(process.env.IMPROVE_PHASE==='after')require('fs').writeFileSync(process.env.IMPROVE_WORKSPACE+'/.out/generated.json','{\"steps\":99}');";const {runDir}=await builtGenerated(f,prefix);expect((await improve.verifyPhase(runDir,'after')).status).toBe('blocked');expect(improve.events(runDir).filter(e=>e.event==='holdout_consumed')).toHaveLength(1);}finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('FIX-2: generated input changed after evaluation cannot be retained',quiet(async()=>{
    const f=fixture();try{ignored(f);const {runDir,ws}=await builtGenerated(f);expect((await improve.verifyPhase(runDir,'after')).status).toBe('verified');expect(improve.evaluate(runDir).decision).toBe('KEEP');fs.writeFileSync(path.join(ws,'.out','generated.json'),'{"steps":99}');expect(()=>improve.finalize(runDir)).toThrow(/binding|input/i);}finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
  test('FIX-4: unignored generated output verifies and is not retained as product',quiet(async()=>{
    const f=fixture();try{const {runDir}=await builtGenerated(f);expect((await improve.verifyPhase(runDir,'after')).status).toBe('verified');expect(improve.evaluate(runDir).decision).toBe('KEEP');const kept=improve.finalize(runDir);expect(git(f.repo,'ls-tree','-r','--name-only',kept.commit)).not.toMatch(/\.out/);}finally{fs.rmSync(f.root,{recursive:true,force:true});}
  }));
});

test('FIX-3: mutable declarations cannot hide dependencies, sealed outputs or scope',quiet(async()=>{
 const f=fixture();try{
  const base=contract({runtime:{identity:{disposable_outputs:['.out/build'],mutable_outputs:['.out','node_modules','src/log']}}});
  const {frozen}=await prepare(f,{contractDoc:base});expect(frozen.status).not.toBe('frozen');expect(JSON.stringify(frozen)).toMatch(/hide dependencies/);expect(JSON.stringify(frozen)).toMatch(/hide a sealed output/);
 }finally{fs.rmSync(f.root,{recursive:true,force:true});}
}));

test('FIX-4: stage a path list exceeding the default subprocess buffer',()=>{
  const f=fixture();try{
    const parts=Array.from({length:8},(_,i)=>'d'+i+'x'.repeat(178));
    const dir=path.join(f.repo,...parts);fs.mkdirSync(dir,{recursive:true});
    for(let i=0;i<700;i++)fs.writeFileSync(path.join(dir,String(i).padStart(4,'0')+'f'.repeat(186)),String(i));
    const names=spawnSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:f.repo,encoding:'utf8',maxBuffer:4*1024*1024});
    expect(Buffer.byteLength(names.stdout)).toBeGreaterThan(1024*1024);
    const tree=require('../../scripts/improve-binding.cjs').tree(f.repo);
    expect(tree.tree).toMatch(/^[a-f0-9]{40}$/);
    const staged=spawnSync('git',['ls-files','-z','--cached'],{cwd:f.repo,encoding:'utf8',maxBuffer:4*1024*1024});expect(staged.status).toBe(0);expect(staged.stdout.split('\0').filter(Boolean)).toHaveLength(703);
  }finally{fs.rmSync(f.root,{recursive:true,force:true});}
});
