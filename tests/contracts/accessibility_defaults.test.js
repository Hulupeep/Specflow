/**
 * Pattern truth tests for accessibility_defaults.yml
 * Tests A11Y-001 through A11Y-004 (4 forbidden patterns)
 */

const { loadContractRules } = require('../helpers/contract-loader');

const { rules } = loadContractRules('accessibility_defaults.yml');

function getRule(id) {
  return rules.find((r) => r.id === id);
}

function getPattern(rule, index) {
  return rule.patterns[index];
}

// ─── A11Y-001: Images must have alt text ────────────────────────────────────────

describe('A11Y-001: Images must have alt text', () => {
  const rule = getRule('A11Y-001');

  test('rule exists with 1 pattern', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(1);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: img without alt', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['<img src="/avatar.png" />', true],
      ['<img src="/photo.jpg">', true],
      ['<img src="/icon.svg" class="icon" />', true],
      ['<img src="/avatar.png" alt="User avatar" />', false],
      ['<img alt="" src="/decorative.png" />', false],
      ['<img alt="Profile photo" src="/photo.jpg" />', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── A11Y-002: Buttons must have accessible labels ──────────────────────────────

describe('A11Y-002: Icon-only buttons need aria-label', () => {
  const rule = getRule('A11Y-002');

  test('rule exists with 1 pattern', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(1);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: icon-only button', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['<button><svg viewBox="0 0 24 24" /></button>', true],
      ['<button><img src="/icon.svg" /></button>', true],
      ['<button><Icon /></button>', true],
      ['<button><TrashIcon /></button>', true],
      ['<button><DeleteIcon /></button>', true],
      ['<button className="btn"><EditIcon /></button>', true],
      ['<button aria-label="Delete"><TrashIcon /></button>', false],
      ['<button>Delete</button>', false],
      ['<button>Click <svg /></button>', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── A11Y-003: Form inputs must have labels ─────────────────────────────────────

describe('A11Y-003: Form inputs must have labels', () => {
  const rule = getRule('A11Y-003');

  test('rule exists with 1 pattern', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(1);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: input without label', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['<input type="email" placeholder="Email" />', true],
      ['<input type="text" name="search" />', true],
      ['<input type="email" aria-label="Email address" />', false],
      ['<input type="text" aria-labelledby="label1" />', false],
      ['<input type="text" id="search" />', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── A11Y-004: No positive tabindex ─────────────────────────────────────────────

describe('A11Y-004: No positive tabindex', () => {
  const rule = getRule('A11Y-004');

  test('rule exists with 1 pattern', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(1);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: positive tabIndex', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['tabIndex={5}', true],
      ['tabIndex={1}', true],
      ['tabIndex={99}', true],
      ['tabIndex = { 3 }', true],
      ['tabIndex={0}', false],
      ['tabIndex={-1}', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('A11Y edge cases', () => {
  test('empty string matches no patterns in any rule', () => {
    for (const rule of rules) {
      for (const p of rule.patterns) {
        expect(p.regex.test('')).toBe(false);
      }
    }
  });
});
