const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..');
const LOOP_FILES = [
  'templates/QA/loops/spec-build.yaml',
  'templates/QA/loops/feature-build.yaml',
  'templates/QA/loops/daily-use-teardown.yaml',
];

describe('loop YAML contracts', () => {
  test.each(LOOP_FILES)('%s parses as YAML', (rel) => {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    expect(() => yaml.load(content)).not.toThrow();
  });

  test('spec-build Gate B references runnable script paths', () => {
    const content = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/spec-build.yaml'), 'utf8');

    expect(content).toContain('node scripts/verify-seams.cjs <tickets.json> --repo-root .');
    expect(content).toContain('node scripts/verify-adr.cjs <tickets.json> --repo-root .');
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'verify-seams.cjs'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'scripts', 'verify-adr.cjs'))).toBe(true);
  });

  test('feature-build Gate D references the Gate D checker', () => {
    const content = fs.readFileSync(path.join(ROOT, 'templates/QA/loops/feature-build.yaml'), 'utf8');

    expect(content).toContain('node scripts/teardown-gate.cjs check-gate-d gate-d/<epic>/');
  });
});
