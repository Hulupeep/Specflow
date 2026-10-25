/**
 * verify-falsification.cjs — structural gate for the falsification artifact (#62).
 * Oracle: the shipped template (templates/loops/falsification-template.md) is a STUB and must
 * FAIL; a filled artifact must PASS; missing sections / missing verdict must FAIL.
 */

const { readFileSync } = require('fs');
const { join } = require('path');
const { validateFalsification, extractFinalVerdict, REQUIRED } = require('../../scripts/verify-falsification.cjs');

const TEMPLATE = join(__dirname, '../../templates/loops/falsification-template.md');

// A minimal FILLED artifact: every table section has ≥1 data row + a verdict.
function filled() {
  const row = '| x | y | z | w | v | u | t |';
  return [
    '## Premise Attack', '| P | S | could be false | FAIL | fix |', '|---|---|---|---|---|', row,
    '## Claim Inventory', row, '|---|---|---|---|---|---|---|', row,
    '## Dependency Audit', '| A→B | reason | risk | ok | - |', '|---|---|---|---|---|', row,
    '## Acceptance Gate Attack', '| g | gamed | oracle | fix |', '|---|---|---|---|', row,
    '## Source / Reality Ledger', '| claim | file:1 | yes | quote |', '|---|---|---|---|', row,
    '## Overclaim / Scope Leakage', '| text | why | replace |', '|---|---|---|', row,
    '## Banned-Mode Self-Check', '| blanket dependency | no | - |', '|---|---|---|', '| nearby-proof | no | - |',
    '## Final Verdict', 'PASS WITH STIPULATIONS — owner: Colm',
  ].join('\n');
}

describe('validateFalsification', () => {
  test('the shipped template is a stub → REJECTED (empty table sections)', () => {
    const r = validateFalsification(readFileSync(TEMPLATE, 'utf8'));
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('empty section'))).toBe(true);
  });

  test('a filled artifact → PASS', () => {
    expect(validateFalsification(filled())).toEqual({ ok: true, violations: [] });
  });

  test('missing a required section → REJECTED naming it', () => {
    const doc = filled().replace('## Dependency Audit', '## Something Else');
    const r = validateFalsification(doc);
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('Dependency Audit'))).toBe(true);
  });

  test('no recognized verdict → REJECTED', () => {
    const doc = filled().replace('PASS WITH STIPULATIONS — owner: Colm', 'looks good to me');
    const r = validateFalsification(doc);
    expect(r.ok).toBe(false);
    expect(r.violations.some(v => v.includes('Final Verdict'))).toBe(true);
  });

  test('a pending current verdict cannot inherit a historical pass mentioned in its prose', () => {
    const doc = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'REVIEW PENDING — The previous PASS WITH STIPULATIONS applied to another PRD and is withdrawn.',
    );
    expect(extractFinalVerdict(doc)).toBeNull();
    const result = validateFalsification(doc, { requirePass: true });
    expect(result.ok).toBe(false);
    expect(result.finalVerdict).toBeNull();
  });

  test('the first verdict line wins over historical prose', () => {
    const fail = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'FAIL — Prior review said PASS WITH STIPULATIONS; that result is withdrawn.',
    );
    expect(extractFinalVerdict(fail)).toBe('FAIL');
    expect(validateFalsification(fail, { requirePass: true }).ok).toBe(false);

    const pass = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS — Previous draft failed; the current review closed it.',
    );
    expect(extractFinalVerdict(pass)).toBe('PASS');
    expect(validateFalsification(pass, { requirePass: true }).ok).toBe(true);
  });

  test('the verdict line cannot declare a conflicting current result', () => {
    const doc = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS — previous verdict, now withdrawn; current verdict: FAIL.',
    );
    expect(extractFinalVerdict(doc)).toBeNull();
    expect(validateFalsification(doc, { requirePass: true }).ok).toBe(false);
  });

  test('a later explicit current verdict cannot leave an earlier PASS active', () => {
    const doc = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS — previous verdict.\nCurrent verdict: FAIL.',
    );
    expect(extractFinalVerdict(doc)).toBeNull();
    expect(validateFalsification(doc, { requirePass: true }).ok).toBe(false);
  });

  test('a later prose withdrawal cannot leave an earlier PASS active', () => {
    const doc = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS — previous verdict.\nThis PASS is withdrawn pending a new review.',
    );
    expect(extractFinalVerdict(doc)).toBeNull();
    const comma = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS — previous verdict, now withdrawn.',
    );
    expect(extractFinalVerdict(comma)).toBeNull();
  });

  test('a PASS stipulation may name a FAIL test case', () => {
    const doc = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS WITH STIPULATIONS. Owner: implementer must preserve FAIL test coverage.',
    );
    expect(extractFinalVerdict(doc)).toBe('PASS WITH STIPULATIONS');
  });

  test('ordinary no longer wording is not a verdict withdrawal', () => {
    const doc = filled().replace(
      'PASS WITH STIPULATIONS — owner: Colm',
      'PASS WITH STIPULATIONS. The runner no longer caches stale results.',
    );
    expect(extractFinalVerdict(doc)).toBe('PASS WITH STIPULATIONS');
  });

  test('period-delimited verdicts in checked-in artifacts still parse', () => {
    const doc = readFileSync(join(__dirname, '../../docs/specs/genuine-looper/falsification.md'), 'utf8');
    expect(extractFinalVerdict(doc)).toBe('PASS WITH STIPULATIONS');
  });

  test('the template verdict choice list is not a current verdict', () => {
    expect(extractFinalVerdict(readFileSync(TEMPLATE, 'utf8'))).toBeNull();
  });

  test('duplicate final-verdict sections cannot hide a pending current review', () => {
    const doc = `${filled()}\n## Final Verdict\nREVIEW PENDING — previous result is withdrawn.`;
    expect(extractFinalVerdict(doc)).toBeNull();
    expect(validateFalsification(doc, { requirePass: true }).ok).toBe(false);
  });

  test('Markdown heading variants cannot hide a second verdict section', () => {
    const variants = ['## Final Verdict ##\nFAIL', '  ## Final Verdict ##\nFAIL', '# Final Verdict\nFAIL', '### Final Verdict\nFAIL', 'Final Verdict\n-------------\nFAIL'];
    for (const variant of variants) {
      const doc = `${filled()}\n${variant}`;
      expect(extractFinalVerdict(doc)).toBeNull();
      expect(validateFalsification(doc, { requirePass: true }).ok).toBe(false);
    }
  });

  test('a later example cannot change the current verdict', () => {
    const doc = `${filled()}\n## Regression Cases\nVerdict: FAIL (expected for the negative case).`;
    expect(extractFinalVerdict(doc)).toBe('PASS WITH STIPULATIONS');
  });

  test('a fenced example heading is not a duplicate verdict', () => {
    const doc = `${filled()}\n\`\`\`markdown\n## Final Verdict\nFAIL\n\`\`\``;
    expect(extractFinalVerdict(doc)).toBe('PASS WITH STIPULATIONS');
  });

  test('all 8 required sections are present in the shipped template', () => {
    const content = readFileSync(TEMPLATE, 'utf8');
    for (const req of REQUIRED) expect(content).toContain(`## ${req}`);
  });
});
