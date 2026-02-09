/**
 * Schema validation tests for all contract templates.
 * Verifies: valid YAML, required fields, regex compilability, structural integrity.
 */

const { loadContract, listContractFiles, yamlPatternToRegex } = require('../helpers/contract-loader');

const CONTRACT_FILES = listContractFiles();

describe('Contract Schema Validation', () => {
  test('at least one contract template exists', () => {
    expect(CONTRACT_FILES.length).toBeGreaterThan(0);
  });

  describe.each(CONTRACT_FILES)('%s', (filename) => {
    let contract;

    beforeAll(() => {
      contract = loadContract(filename);
    });

    // --- contract_meta ---

    test('parses as valid YAML', () => {
      expect(contract).toBeDefined();
      expect(typeof contract).toBe('object');
    });

    test('has contract_meta.id', () => {
      expect(contract.contract_meta).toBeDefined();
      expect(typeof contract.contract_meta.id).toBe('string');
      expect(contract.contract_meta.id.length).toBeGreaterThan(0);
    });

    test('has contract_meta.version', () => {
      expect(contract.contract_meta.version).toBeDefined();
    });

    test('has contract_meta.covers_reqs as non-empty array', () => {
      expect(Array.isArray(contract.contract_meta.covers_reqs)).toBe(true);
      expect(contract.contract_meta.covers_reqs.length).toBeGreaterThan(0);
    });

    test('has contract_meta.owner', () => {
      expect(typeof contract.contract_meta.owner).toBe('string');
    });

    // --- llm_policy ---

    test('has llm_policy.enforce', () => {
      expect(contract.llm_policy).toBeDefined();
      expect(typeof contract.llm_policy.enforce).toBe('boolean');
    });

    test('has llm_policy.llm_may_modify_non_negotiables', () => {
      expect(typeof contract.llm_policy.llm_may_modify_non_negotiables).toBe('boolean');
    });

    test('has llm_policy.override_phrase', () => {
      expect(typeof contract.llm_policy.override_phrase).toBe('string');
      expect(contract.llm_policy.override_phrase).toContain('override_contract:');
    });

    // --- rules ---

    test('has rules.non_negotiable as non-empty array', () => {
      expect(contract.rules).toBeDefined();
      expect(Array.isArray(contract.rules.non_negotiable)).toBe(true);
      expect(contract.rules.non_negotiable.length).toBeGreaterThan(0);
    });

    test('every rule has id and title', () => {
      for (const rule of contract.rules.non_negotiable) {
        expect(typeof rule.id).toBe('string');
        expect(rule.id.length).toBeGreaterThan(0);
        expect(typeof rule.title).toBe('string');
        expect(rule.title.length).toBeGreaterThan(0);
      }
    });

    test('every rule has scope array', () => {
      for (const rule of contract.rules.non_negotiable) {
        expect(Array.isArray(rule.scope)).toBe(true);
        expect(rule.scope.length).toBeGreaterThan(0);
      }
    });

    test('every rule has forbidden_patterns', () => {
      for (const rule of contract.rules.non_negotiable) {
        expect(rule.behavior).toBeDefined();
        expect(Array.isArray(rule.behavior.forbidden_patterns)).toBe(true);
        expect(rule.behavior.forbidden_patterns.length).toBeGreaterThan(0);
      }
    });

    // --- covers_reqs maps to rule IDs ---

    test('every covers_reqs ID maps to an actual rule ID', () => {
      const ruleIds = contract.rules.non_negotiable.map((r) => r.id);
      for (const reqId of contract.contract_meta.covers_reqs) {
        expect(ruleIds).toContain(reqId);
      }
    });

    // --- Pattern validity ---

    test('every forbidden_pattern compiles to a valid RegExp', () => {
      for (const rule of contract.rules.non_negotiable) {
        for (const fp of rule.behavior.forbidden_patterns) {
          expect(() => yamlPatternToRegex(fp.pattern)).not.toThrow();
        }
      }
    });

    test('every forbidden_pattern has a non-empty message', () => {
      for (const rule of contract.rules.non_negotiable) {
        for (const fp of rule.behavior.forbidden_patterns) {
          expect(typeof fp.message).toBe('string');
          expect(fp.message.length).toBeGreaterThan(0);
        }
      }
    });

    // --- Examples ---

    test('every rule has example_violation and example_compliant', () => {
      for (const rule of contract.rules.non_negotiable) {
        expect(typeof rule.behavior.example_violation).toBe('string');
        expect(rule.behavior.example_violation.trim().length).toBeGreaterThan(0);
        expect(typeof rule.behavior.example_compliant).toBe('string');
        expect(rule.behavior.example_compliant.trim().length).toBeGreaterThan(0);
      }
    });
  });
});
