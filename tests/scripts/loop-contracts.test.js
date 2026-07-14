const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..');
const LOOP_FILES = [
  'templates/QA/loops/spec-build.yaml',
  'templates/QA/loops/feature-build.yaml',
  'templates/QA/loops/daily-use-teardown.yaml',
];

const ROUTING_FILES = [
  'templates/adapter-policies/claude-code-large-routing.yml',
  'templates/adapter-policies/codex-gpt56-sol-routing.yml',
];

describe('loop YAML contracts', () => {
  test.each(LOOP_FILES)('%s parses as YAML', (rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });

  test.each(ROUTING_FILES)('%s parses as YAML', (rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });

  test('Codex routing uses GPT-5.6 Sol for every routed policy', () => {
    const routing = yaml.load(fs.readFileSync(
      path.join(ROOT, 'templates/adapter-policies/codex-gpt56-sol-routing.yml'),
      'utf8'
    ));

    expect(routing.routing_profile).toEqual(expect.objectContaining({
      runtime: 'codex',
      template: 'codex-gpt56-sol-routing.yml',
    }));
    for (const entry of Object.values(routing.policies)) {
      expect(entry.adapter_policy.provider).toBe('codex-exec');
      expect(entry.adapter_policy.model).toBe('gpt-5.6-sol');
      expect(entry.adapter_policy.requested_model).toBe('gpt-5.6-sol');
      expect(entry.adapter_policy.args).toContain('approval_policy="never"');
      expect(entry.adapter_policy.args).not.toContain('--ask-for-approval');
    }
  });

  test('loop selector chooses routing by active runtime, not installed directories', () => {
    const skill = fs.readFileSync(
      path.join(ROOT, 'skills/specflow-loop-selector/SKILL.md'),
      'utf8'
    );

    expect(skill).toContain('Claude Code: use');
    expect(skill).toContain('claude-code-large-routing.yml');
    expect(skill).toContain('Codex: use');
    expect(skill).toContain('codex-gpt56-sol-routing.yml');
    expect(skill).toContain('never infer the');
  });

  test('spec-build Gate B references runnable script paths', () => {
    const content = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/spec-build.yaml'), 'utf8');

    expect(content).toContain('node scripts/verify-seams.cjs <tickets.json> --repo-root .');
    expect(content).toContain('node scripts/verify-adr.cjs <tickets.json> --repo-root .');
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'verify-seams.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'verify-adr.cjs'))).toBe(true);
  });

  test('spec-build contract requires continuation until block or handoff', () => {
    const content = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/spec-build.yaml'), 'utf8');
    const prompt = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/prompts/spec-build.prompt.md'), 'utf8');

    expect(content).toContain('advance through all unblocked gates');
    expect(content).toContain('stop only on HITL/block/done');
    expect(prompt).toContain('Advance through every unblocked gate');
    expect(prompt).not.toContain('Advance exactly ONE gate');
  });

  test('feature-build Gate D references the Gate D checker', () => {
    const content = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/feature-build.yaml'), 'utf8');

    expect(content).toContain('node scripts/teardown-gate.cjs check-gate-d gate-d/<epic>/');
  });

  test('feature-build contract requires continuation until HITL, CI wait, block, or done', () => {
    const content = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/feature-build.yaml'), 'utf8');
    const prompt = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/prompts/feature-build.prompt.md'), 'utf8');

    expect(content).toContain('advance all unblocked rails');
    expect(content).toContain('stop only on HITL/external CI wait/block/done');
    expect(prompt).toContain('Advance through every unblocked rail');
    expect(prompt).not.toContain('Advance exactly ONE rail');
  });
});
