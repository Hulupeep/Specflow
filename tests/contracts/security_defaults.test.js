/**
 * Pattern truth tests for security_defaults.yml
 * Tests SEC-001 through SEC-005 (15 forbidden patterns)
 */

const { loadContractRules } = require('../helpers/contract-loader');

const { rules } = loadContractRules('security_defaults.yml');

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRule(id) {
  return rules.find((r) => r.id === id);
}

function getPattern(rule, index) {
  return rule.patterns[index];
}

// ─── SEC-001: No hardcoded secrets ─────────────────────────────────────────────

describe('SEC-001: No hardcoded secrets', () => {
  const rule = getRule('SEC-001');

  test('rule exists with 6 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(6);
  });

  // Level 1: example_violation must trigger at least one pattern
  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  // Level 2: Per-pattern synthetic fixtures
  describe('pattern 0: password/secret/api_key assignment', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['const password = "mysecretpassword123"', true],
      ['const secret = "abcdefghijklmnop"', true],
      ['api_key: "sk_live_abcdefg12345678"', true],
      ['const apikey = "longapikey12345678"', true],
      ['const token = "mytoken12345678901"', true],
      ['const API_KEY = process.env.API_KEY', false],
      ['const password = ""', false],
      ['const password = "short"', false], // less than 8 chars
      ['// password = "commented_out_secret"', true], // in-line, regex doesn't exclude comments
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: Stripe live key', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['const key = "sk_live_abcdefghijklmnopqrst"', true],
      ['sk_live_1234567890abcdefghij', true],
      ['sk_test_abcdefghijklmnopqrst', false],
      ['process.env.STRIPE_KEY', false],
      ['sk_live_short', false], // less than 20 chars
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 2: Stripe test key', () => {
    const p = getPattern(rule, 2);

    test.each([
      ['const key = "sk_test_abcdefghijklmnopqrst"', true],
      ['sk_test_1234567890abcdefghij', true],
      ['sk_live_abcdefghijklmnopqrst', false],
      ['sk_test_short', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 3: Private key header', () => {
    const p = getPattern(rule, 3);

    test.each([
      ['-----BEGIN PRIVATE KEY-----', true],
      ['-----BEGIN RSA PRIVATE KEY-----', true],
      ['-----BEGIN EC PRIVATE KEY-----', true],
      ['-----BEGIN PUBLIC KEY-----', false],
      ['// -----BEGIN PRIVATE KEY-----', true], // regex doesn't exclude comments
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 4: GitHub PAT', () => {
    const p = getPattern(rule, 4);

    test.each([
      ['ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij', true],
      ['ghp_123456789012345678901234567890123456', true],
      ['ghp_short', false],
      ['process.env.GITHUB_TOKEN', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 5: Slack bot token', () => {
    const p = getPattern(rule, 5);

    test.each([
      ['xoxb-' + '1234567890' + '-' + 'abcdefghijklmnopqrstuvwx', true],
      ['xoxb-' + '1234567890123' + '-' + 'ABCDEFGHIJKLMNOPQRSTx', true],
      ['xoxb-short-short', false],
      ['process.env.SLACK_TOKEN', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── SEC-002: No raw SQL string concatenation ──────────────────────────────────

describe('SEC-002: No raw SQL string concatenation', () => {
  const rule = getRule('SEC-002');

  test('rule exists with 3 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(3);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: template literal in query()', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['db.query(`SELECT * FROM users WHERE id = ${userId}`)', true],
      ["db.query('SELECT * FROM users WHERE id = $1', [userId])", false],
      ['query("static string")', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: string concat in query()', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['db.query("SELECT * FROM users WHERE id = " + userId)', true],
      ["db.query('SELECT * FROM users WHERE id = $1', [userId])", false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 2: template literal in execute()', () => {
    const p = getPattern(rule, 2);

    test.each([
      ['db.execute(`DELETE FROM users WHERE id = ${id}`)', true],
      ["db.execute('DELETE FROM users WHERE id = $1', [id])", false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── SEC-003: No innerHTML with unsanitized content ────────────────────────────

describe('SEC-003: No innerHTML with unsanitized content', () => {
  const rule = getRule('SEC-003');

  test('rule exists with 2 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(2);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: dangerouslySetInnerHTML without sanitize', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['dangerouslySetInnerHTML={{ __html: userInput }}', true],
      ['dangerouslySetInnerHTML={{ __html: rawHtml }}', true],
      ['dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }}', false],
      ['dangerouslySetInnerHTML={{ __html: sanitize(input) }}', false],
      ['dangerouslySetInnerHTML={{ __html: purify(input) }}', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: .innerHTML assignment', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['el.innerHTML = userInput', true],
      ['el.innerHTML = data', true],
      ['el.innerHTML = "<div>"', false],
      ["el.innerHTML = '<p>'", false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── SEC-004: No eval or Function constructor ──────────────────────────────────

describe('SEC-004: No eval or Function constructor', () => {
  const rule = getRule('SEC-004');

  test('rule exists with 2 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(2);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: eval()', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['eval(userExpression)', true],
      ['eval("code")', true],
      ['const result = eval(x)', true],
      ['JSON.parse(input)', false],
      ['// eval(x)', true], // regex doesn't exclude comments
      ['medieval(x)', false], // \b word boundary prevents this
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: new Function()', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['new Function("return " + code)', true],
      ['new Function(body)', true],
      ['const fn = new Function(x)', true],
      ['function myFunc() {}', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── SEC-005: No path traversal ────────────────────────────────────────────────

describe('SEC-005: No path traversal', () => {
  const rule = getRule('SEC-005');

  test('rule exists with 2 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(2);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: readFile without path.join', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['fs.readFileSync(req.params.filename)', true],
      ['fs.readFile(userPath, cb)', true],
      ['fs.readFileSync(path.join(__dirname, file))', false],
      ['fs.readFileSync(path.resolve(base, file))', false],
      ['fs.readFileSync(__dirname + "/file.txt")', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: writeFile without path.join', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['fs.writeFileSync(userPath, data)', true],
      ['fs.writeFile(req.body.path, content, cb)', true],
      ['fs.writeFileSync(path.join(__dirname, file), data)', false],
      ['fs.writeFileSync(path.resolve(dir, file), data)', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('SEC edge cases', () => {
  test('empty string matches no patterns in any rule', () => {
    for (const rule of rules) {
      for (const p of rule.patterns) {
        expect(p.regex.test('')).toBe(false);
      }
    }
  });
});
