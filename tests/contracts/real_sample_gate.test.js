// tabstax#1221: reader-facing stories carry the busy reader persona and the real-sample gate, and the loop selector
// routes message wording through simulate first. These pin the text the skills ship, so a later edit can't drop it.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

describe('real-sample gate (tabstax#1221)', () => {
  test('simulation method has the busy reader persona and the real-sample gate table', () => {
    const m = read('skills/specflow-simulate/references/simulation-method.md');
    expect(m).toMatch(/\*\*Busy reader\*\* \(MUST for reader-facing stories\)/);
    expect(m).toMatch(/Reader-facing stories: the real-sample gate \(MUST\)/);
    expect(m).toMatch(/\| # \| Producer shape \| First line the reader sees \| Pinged\? \| What must I do\? \| Pass \|/);
    expect(m).toMatch(/the producer writes in another shape/);
    expect(m).toMatch(/redacted or synthetic/);
  });

  test('the simulate skill names the gate up front', () => {
    expect(read('skills/specflow-simulate/SKILL.md')).toMatch(/## Reader-facing stories \(MUST\)/);
  });

  test('the loop selector routes message and notification wording through simulate first', () => {
    expect(read('skills/specflow-loop-selector/SKILL.md')).toMatch(/Message and notification wording routes through simulate first/);
  });

  test('SPEC-FORMAT carries the busy reader persona with the table', () => {
    const f = read('SPEC-FORMAT.md');
    expect(f).toMatch(/### Persona: Busy reader/);
    expect(f).toMatch(/real-sample gate/);
  });
});
