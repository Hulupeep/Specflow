/**
 * Self-compliance tests for the Specflow project.
 * Verifies that Specflow dogfoods its own methodology.
 *
 * Contract: docs/contracts/feature_specflow_project.yml
 * Rules: PROJ-001 through PROJ-004
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const ROOT = path.join(__dirname, '..', '..');

// Utility files that are NOT agent prompts
const AGENT_UTILITY_FILES = [
  'README.md',
  'PROTOCOL.md',
  'WORKFLOW.md',
  'agentlist.md',
  'agentnames.md',
  'team-names.md',
  'readme-audit.md',        // Claude Code skill, not a Specflow agent
  'readme-restructure.md',  // Claude Code skill, not a Specflow agent
  'builder-guidance.md',    // Decision framework doc, not an invocable agent
];

function listAgentFiles() {
  const agentsDir = path.join(ROOT, 'agents');
  return fs
    .readdirSync(agentsDir)
    .filter((f) => f.endsWith('.md') && !AGENT_UTILITY_FILES.includes(f));
}

function listTemplateContracts() {
  const dir = path.join(ROOT, 'templates', 'contracts');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
}

function listScripts() {
  const dir = path.join(ROOT, 'scripts');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js') || f.endsWith('.cjs'));
}

// ─── PROJ-001: Agent files must have required sections ──────────────────────

describe('PROJ-001: Agent files must have required sections', () => {
  const agentFiles = listAgentFiles();

  test('at least 10 agent files exist', () => {
    expect(agentFiles.length).toBeGreaterThanOrEqual(10);
  });

  describe.each(agentFiles)('%s', (filename) => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(path.join(ROOT, 'agents', filename), 'utf-8');
    });

    test('has "## Role" section', () => {
      expect(content).toMatch(/^## Role/m);
    });

    test('has "## Trigger Conditions" or "## Process" section', () => {
      const hasTrigger = /^## Trigger Conditions/m.test(content);
      const hasProcess = /^## Process/m.test(content);
      expect(hasTrigger || hasProcess).toBe(true);
    });

    test('has "# Agent:" header', () => {
      expect(content).toMatch(/^# Agent:/m);
    });
  });
});

// ─── PROJ-002: Template contracts must have valid schema ────────────────────

describe('PROJ-002: Template contracts must have valid schema', () => {
  const contractFiles = listTemplateContracts();

  test('at least 4 template contracts exist', () => {
    expect(contractFiles.length).toBeGreaterThanOrEqual(4);
  });

  describe.each(contractFiles)('%s', (filename) => {
    let contract;

    beforeAll(() => {
      const filepath = path.join(ROOT, 'templates', 'contracts', filename);
      const content = fs.readFileSync(filepath, 'utf-8');
      contract = yaml.load(content);
    });

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

    test('has llm_policy.enforce', () => {
      expect(contract.llm_policy).toBeDefined();
      expect(typeof contract.llm_policy.enforce).toBe('boolean');
    });

    test('has rules.non_negotiable as non-empty array', () => {
      expect(contract.rules).toBeDefined();
      expect(Array.isArray(contract.rules.non_negotiable)).toBe(true);
      expect(contract.rules.non_negotiable.length).toBeGreaterThan(0);
    });
  });
});

// ─── PROJ-003: Scripts must export for testability ──────────────────────────

describe('PROJ-003: Scripts must export for testability', () => {
  const scriptFiles = listScripts();

  test('at least 1 script exists', () => {
    expect(scriptFiles.length).toBeGreaterThanOrEqual(1);
  });

  describe.each(scriptFiles)('%s', (filename) => {
    let content;

    beforeAll(() => {
      content = fs.readFileSync(path.join(ROOT, 'scripts', filename), 'utf-8');
    });

    test('exports via module.exports', () => {
      expect(content).toContain('module.exports');
    });
  });
});

// ─── PROJ-004: Key directories must exist ───────────────────────────────────

describe('PROJ-004: Key directories must exist', () => {
  const requiredDirs = [
    'agents',
    'docs/contracts',
    'templates/contracts',
    'scripts',
    'tests',
    'hooks',
    'examples',
  ];

  test.each(requiredDirs)('%s/ directory exists', (dir) => {
    const fullPath = path.join(ROOT, dir);
    expect(fs.existsSync(fullPath)).toBe(true);
    expect(fs.statSync(fullPath).isDirectory()).toBe(true);
  });
});

// ─── Self-contract validation ───────────────────────────────────────────────

describe('Self-contract exists and is valid', () => {
  const contractPath = path.join(ROOT, 'docs', 'contracts', 'feature_specflow_project.yml');

  test('feature_specflow_project.yml exists', () => {
    expect(fs.existsSync(contractPath)).toBe(true);
  });

  test('parses as valid YAML with required fields', () => {
    const content = fs.readFileSync(contractPath, 'utf-8');
    const contract = yaml.load(content);
    expect(contract.contract_meta.id).toBe('feature_specflow_project');
    expect(contract.llm_policy.enforce).toBe(true);
    expect(contract.structural_rules.length).toBeGreaterThan(0);
  });
});

// ─── CLAUDE.md compliance ───────────────────────────────────────────────────

describe('CLAUDE.md has project context', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf-8');
  });

  test('has Repository field', () => {
    expect(content).toMatch(/\*\*Repository:\*\*/);
  });

  test('has Project Board field', () => {
    expect(content).toMatch(/\*\*Project Board:\*\*/);
  });

  test('has Board CLI field', () => {
    expect(content).toMatch(/\*\*Board CLI:\*\*/);
  });

  test('has Tech Stack field', () => {
    expect(content).toMatch(/\*\*Tech Stack:\*\*/);
  });

  test('has Active Contracts section', () => {
    expect(content).toMatch(/Active Contracts/);
  });

  test('has Override Protocol section', () => {
    expect(content).toMatch(/Override Protocol/);
  });
});

// ─── Package.json has required test scripts ─────────────────────────────────

describe('package.json has required test scripts', () => {
  let pkg;

  beforeAll(() => {
    pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
  });

  test('has "test" script', () => {
    expect(pkg.scripts.test).toBeDefined();
  });

  test('has "test:contracts" script', () => {
    expect(pkg.scripts['test:contracts']).toBeDefined();
  });

  test('has jest dependency', () => {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(deps.jest).toBeDefined();
  });
});
