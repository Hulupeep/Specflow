/**
 * Pattern truth tests for production_readiness_defaults.yml
 * Tests PROD-001 through PROD-003 (17 forbidden patterns)
 */

const { loadContractRules } = require('../helpers/contract-loader');

const { rules } = loadContractRules('production_readiness_defaults.yml');

function getRule(id) {
  return rules.find((r) => r.id === id);
}

function getPattern(rule, index) {
  return rule.patterns[index];
}

// ─── PROD-001: No demo or mock data in production code ──────────────────────────

describe('PROD-001: No demo or mock data', () => {
  const rule = getRule('PROD-001');

  test('rule exists with 7 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(7);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: DEMO_USER', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['const user = DEMO_USER', true],
      ['if (DEMO_USER) {', true],
      ['const demoUser = getDemoUser()', false], // different casing
      ['// DEMO_USER comment', true],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: DEMO_PLAN', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['const plan = DEMO_PLAN', true],
      ['return DEMO_PLAN', true],
      ['const demoPlan = "free"', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 2: MOCK_ constants', () => {
    const p = getPattern(rule, 2);

    test.each([
      ['const data = MOCK_DATA', true],
      ['MOCK_USER_ID', true],
      ['MOCK_API_KEY', true],
      ['MOCK_AB', false], // less than 3 chars after MOCK_
      ['mockData', false], // lowercase
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 3: demo email/domain', () => {
    const p = getPattern(rule, 3);

    test.each([
      ['"demo@example.com"', true],
      ["'demo.user@test.com'", true],
      ['"demo.company.io"', true],
      ['"user@real.com"', false],
      ['"production@company.com"', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 4: test_user', () => {
    const p = getPattern(rule, 4);

    test.each([
      ['"test_user"', true],
      ["'test_user'", true],
      ["'Test_User'", true],
      ['testUser', false], // no quotes
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 5: fakeUser/fakeData etc', () => {
    const p = getPattern(rule, 5);

    test.each([
      ['const fakeUser = {}', true],
      ['fakeData = []', true],
      ['fakeAccount', true],
      ['fakeEmail', true],
      ['fakeName', true],
      ['FakeUser', true],
      ['faker.name()', false], // faker is a library
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 6: seedUser/seedData assignment', () => {
    const p = getPattern(rule, 6);

    test.each([
      ['seedUsers = [...]', true],
      ['seedData = { a: 1 }', true],
      ['seedAccount = {}', true],
      ['const seed = process.env.SEED', false],
      ['seedVersion = 1', false], // not User/Data/Account
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── PROD-002: Domain allowlist enforcement ─────────────────────────────────────

describe('PROD-002: Domain allowlist enforcement', () => {
  const rule = getRule('PROD-002');

  test('rule exists with 6 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(6);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: example.com', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['https://example.com/api', true],
      ['http://example.com', true],
      ['https://my-example.com', false], // not example.com itself
      ['process.env.API_URL', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: localhost', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['http://localhost:3000', true],
      ['http://localhost/', true],
      ['https://localhost"', true],
      ["http://localhost'", true],
      ['process.env.BASE_URL', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 2: 127.0.0.1', () => {
    const p = getPattern(rule, 2);

    test.each([
      ['http://127.0.0.1:8080', true],
      ['https://127.0.0.1', true],
      ['192.168.1.1', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 3: placeholder domain', () => {
    const p = getPattern(rule, 3);

    test.each([
      ['https://placeholder.com', true],
      ['http://PLACEHOLDER.io', true],
      ['real-domain.com', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 4: todo domain', () => {
    const p = getPattern(rule, 4);

    test.each([
      ['https://todo.example.com', true],
      ['http://TODO.mysite.io', true],
      ['real.domain.com', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 5: changeme domain', () => {
    const p = getPattern(rule, 5);

    test.each([
      ['https://changeme.com', true],
      ['http://CHANGEME.io', true],
      ['real.domain.com', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── PROD-003: No hardcoded IDs ─────────────────────────────────────────────────

describe('PROD-003: No hardcoded IDs', () => {
  const rule = getRule('PROD-003');

  test('rule exists with 4 patterns', () => {
    expect(rule).toBeDefined();
    expect(rule.patterns).toHaveLength(4);
  });

  test('example_violation matches at least one pattern', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_violation));
    expect(matches).toBe(true);
  });

  test('example_compliant matches no patterns', () => {
    const matches = rule.patterns.some((p) => p.regex.test(rule.example_compliant));
    expect(matches).toBe(false);
  });

  describe('pattern 0: hardcoded UUID', () => {
    const p = getPattern(rule, 0);

    test.each([
      ['"550e8400-e29b-41d4-a716-446655440000"', true],
      ["'a1b2c3d4-e5f6-7890-abcd-ef1234567890'", true],
      ['session.userId', false],
      ['"not-a-uuid"', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 1: hardcoded user_id', () => {
    const p = getPattern(rule, 1);

    test.each([
      ['user_id = "acme_corp_12345"', true],
      ['user_id: "long_user_id_value"', true],
      ['user_id = session.userId', false],
      ['user_id = "short"', false], // less than 10 chars
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 2: hardcoded tenant_id', () => {
    const p = getPattern(rule, 2);

    test.each([
      ['tenant_id = "acme_corp_12345"', true],
      ['tenant_id: "long_tenant_val_"', true],
      ['tenant_id = ctx.tenantId', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });

  describe('pattern 3: hardcoded org_id', () => {
    const p = getPattern(rule, 3);

    test.each([
      ['org_id = "organization_abc"', true],
      ['org_id: "long_org_id_val_"', true],
      ['org_id = session.orgId', false],
    ])('%s → %s', (input, shouldMatch) => {
      expect(p.regex.test(input)).toBe(shouldMatch);
    });
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────────

describe('PROD edge cases', () => {
  test('empty string matches no patterns in any rule', () => {
    for (const rule of rules) {
      for (const p of rule.patterns) {
        expect(p.regex.test('')).toBe(false);
      }
    }
  });
});
