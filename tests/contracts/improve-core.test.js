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
        id: 'AC-1', statement: 'Resume journey takes at most 2 steps', required_level: 1, mandatory: true, baseline_expectation: 'fail',
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
async function prepare(f, { contractDoc = contract(), runId = 'improve-test', critique = PURSUE } = {}) {
  const { runDir } = improve.startRun({ target: f.repo, mission: f.mission, runId, stateDir: f.state, worktreeRoot: f.worktrees });
  expect(improve.recordCandidates(runDir, writeTmp(f, 'cands.json', candidates())).status).toBe('recorded');
  expect(improve.critique(runDir, { invokePeer: fakePeer([critique]) }).status).toBe('recorded');
  for (const [dir, max] of [['holdout', 2], ['dev', 3]]) {
    fs.mkdirSync(path.join(runDir, dir), { recursive: true });
    fs.writeFileSync(path.join(runDir, dir, 'steps.cjs'), stepCheck(max));
  }
  improve.recordOracle(runDir, { role: 'evaluator', executor: 'fake-evaluator', files: ['holdout/steps.cjs'] });
  const frozen = improve.freezeContract(runDir, writeTmp(f, 'contract.json', contractDoc));
  return { runDir, frozen };
}

async function runToImplementation(f, { contractDoc, edits = {}, peer = [KEEP], builder = FAKE_BUILDER() } = {}) {
  const { runDir, frozen } = await prepare(f, { contractDoc });
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
