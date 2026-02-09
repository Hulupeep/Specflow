/**
 * Shared helper: parse YAML contract templates → extract patterns → compile regex.
 *
 * The key function is yamlPatternToRegex() which converts a YAML pattern string
 * like "/some_regex/i" into a JavaScript RegExp object.
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates', 'contracts');

/**
 * Convert a YAML pattern string like "/regex/flags" into a RegExp.
 * Handles edge cases: no flags, multiline, etc.
 */
function yamlPatternToRegex(patternStr) {
  // Strip leading/trailing whitespace
  const trimmed = patternStr.trim();

  // Expected format: /pattern/flags
  const match = trimmed.match(/^\/(.+)\/([gimsuy]*)$/s);
  if (!match) {
    throw new Error(`Invalid regex pattern format: ${trimmed}`);
  }

  return new RegExp(match[1], match[2]);
}

/**
 * Load and parse a contract YAML file.
 * Returns the full parsed object.
 */
function loadContract(filename) {
  const filepath = path.join(TEMPLATES_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  return yaml.load(content);
}

/**
 * Extract all rules from a contract, each with compiled regex patterns.
 * Returns array of { id, title, scope, patterns: [{ regex, message, raw }], example_violation, example_compliant }
 */
function extractRules(contract) {
  const rules = contract.rules?.non_negotiable || [];
  return rules.map((rule) => {
    const patterns = (rule.behavior?.forbidden_patterns || []).map((fp) => ({
      regex: yamlPatternToRegex(fp.pattern),
      message: fp.message,
      raw: fp.pattern,
    }));

    return {
      id: rule.id,
      title: rule.title,
      scope: rule.scope || [],
      patterns,
      example_violation: rule.behavior?.example_violation || '',
      example_compliant: rule.behavior?.example_compliant || '',
    };
  });
}

/**
 * Load a contract and extract all rules with compiled patterns.
 */
function loadContractRules(filename) {
  const contract = loadContract(filename);
  return {
    meta: contract.contract_meta,
    llm_policy: contract.llm_policy,
    rules: extractRules(contract),
    raw: contract,
  };
}

/**
 * List all contract template YAML files.
 */
function listContractFiles() {
  return fs.readdirSync(TEMPLATES_DIR).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}

module.exports = {
  yamlPatternToRegex,
  loadContract,
  extractRules,
  loadContractRules,
  listContractFiles,
  TEMPLATES_DIR,
};
