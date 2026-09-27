const fs = require('fs');
const os = require('os');
const path = require('path');
const { installAgentInstructions } = require('../../scripts/install-agent-instructions.cjs');

const template = path.join(__dirname, '../../templates/AGENTS.md');
const start = '<!-- specflow:work-routing:start -->';
const end = '<!-- specflow:work-routing:end -->';

describe('agent instruction upgrades', () => {
  let dir;
  let target;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-agent-instructions-'));
    target = path.join(dir, 'AGENTS.md');
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  test('fresh install writes the shipped template', () => {
    installAgentInstructions(template, target);
    expect(fs.readFileSync(target, 'utf8')).toBe(fs.readFileSync(template, 'utf8'));
  });

  test.each([
    '# Project rules\n\nUse pnpm and preserve accessibility.\n',
    '# Project rules\n\n## Specflow Loop Routing\nLegacy loop instructions.\n\n## Custom checks\nRun the billing tests.\n',
  ])('upgrades existing instructions without losing custom text and is idempotent', (original) => {
    fs.writeFileSync(target, original);
    installAgentInstructions(template, target);
    const upgraded = fs.readFileSync(target, 'utf8');
    expect(upgraded).toContain(original);
    expect(upgraded.split(start)).toHaveLength(2);
    expect(upgraded.split('## Specflow Loop Routing')).toHaveLength(2);
    installAgentInstructions(template, target);
    expect(fs.readFileSync(target, 'utf8')).toBe(upgraded);
  });

  test('refreshes stale managed content while preserving both surrounding sections', () => {
    const before = '# Team policy\nUse pnpm.\n\n';
    const after = '\n\n## Specflow Loop Routing\nCustom loop policy.\n';
    fs.writeFileSync(target, before + start + '\nOld managed policy\n' + end + after);
    installAgentInstructions(template, target);
    const shipped = fs.readFileSync(template, 'utf8');
    const policy = shipped.slice(shipped.indexOf(start), shipped.indexOf(end) + end.length);
    expect(fs.readFileSync(target, 'utf8')).toBe(before + policy + after);
  });

  test('malformed markers fail without overwriting user instructions', () => {
    const original = '# Project rules\n' + start + '\nUser text';
    fs.writeFileSync(target, original);
    expect(() => installAgentInstructions(template, target)).toThrow('incomplete work-routing markers');
    expect(fs.readFileSync(target, 'utf8')).toBe(original);
  });
});
