#!/usr/bin/env node

/**
 * specflow-compile — CSV journey compiler
 *
 * Reads a CSV file of journey definitions and produces:
 *   - docs/contracts/journey_*.yml  (one per journey_id)
 *   - tests/e2e/journey_*.spec.ts   (Playwright test stubs per journey_id)
 *
 * Usage:
 *   node scripts/specflow-compile.js <csv-file>
 *
 * The CSV must have the header:
 *   journey_id,journey_name,step,user_does,system_shows,critical,owner,notes
 */

const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const { resolve, basename } = require('path');

// ---------------------------------------------------------------------------
// CSV Parsing
// ---------------------------------------------------------------------------

const REQUIRED_HEADERS = [
  'journey_id', 'journey_name', 'step', 'user_does',
  'system_shows', 'critical', 'owner', 'notes',
];

const JOURNEY_ID_RE = /^J-[A-Z][A-Z0-9-]+$/;

/**
 * Parse a CSV line respecting quoted fields (handles commas inside quotes).
 */
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parse CSV text into an array of row objects keyed by header names.
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) {
    throw new Error('CSV file is empty');
  }

  const headers = parseCsvLine(lines[0]);

  // Validate required headers
  for (const h of REQUIRED_HEADERS) {
    if (!headers.includes(h)) {
      throw new Error(`Missing required CSV header: "${h}"`);
    }
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validate parsed rows. Throws on first validation error.
 */
function validateRows(rows) {
  if (rows.length === 0) {
    throw new Error('CSV has no data rows');
  }

  const seen = new Set();

  // Group by journey_id to check step sequencing
  const groups = new Map();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // 1-indexed, header is line 1

    // journey_id format
    if (!JOURNEY_ID_RE.test(row.journey_id)) {
      throw new Error(
        `Line ${lineNum}: journey_id "${row.journey_id}" must match /^J-[A-Z][A-Z0-9-]+$/`
      );
    }

    // owner non-empty
    if (!row.owner || row.owner.trim() === '') {
      throw new Error(`Line ${lineNum}: owner is required for journey "${row.journey_id}"`);
    }

    // critical must be yes or no
    const crit = row.critical.toLowerCase();
    if (crit !== 'yes' && crit !== 'no') {
      throw new Error(
        `Line ${lineNum}: critical must be "yes" or "no", got "${row.critical}"`
      );
    }

    // step must be integer
    const step = parseInt(row.step, 10);
    if (isNaN(step) || step < 1) {
      throw new Error(
        `Line ${lineNum}: step must be a positive integer, got "${row.step}"`
      );
    }

    // duplicate (journey_id, step) check
    const key = `${row.journey_id}:${step}`;
    if (seen.has(key)) {
      throw new Error(
        `Line ${lineNum}: duplicate (journey_id, step) pair: ${key}`
      );
    }
    seen.add(key);

    // Accumulate groups
    if (!groups.has(row.journey_id)) {
      groups.set(row.journey_id, []);
    }
    groups.get(row.journey_id).push({ step, lineNum });
  }

  // Check step sequencing per journey
  for (const [journeyId, steps] of groups) {
    steps.sort((a, b) => a.step - b.step);
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].step !== i + 1) {
        throw new Error(
          `Journey "${journeyId}": steps must be sequential starting at 1. ` +
          `Expected step ${i + 1} but found ${steps[i].step} at line ${steps[i].lineNum}`
        );
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Group rows by journey_id. Returns a Map of journeyId -> { meta, steps }.
 */
function groupByJourney(rows) {
  const journeys = new Map();

  for (const row of rows) {
    if (!journeys.has(row.journey_id)) {
      journeys.set(row.journey_id, {
        id: row.journey_id,
        name: row.journey_name,
        owner: row.owner,
        critical: row.critical.toLowerCase() === 'yes',
        steps: [],
        acceptance_criteria: [],
      });
    }

    const journey = journeys.get(row.journey_id);

    // Warn if criticality differs across rows of the same journey
    const rowCritical = row.critical.toLowerCase() === 'yes';
    if (rowCritical !== journey.critical) {
      console.warn(
        `Warning: journey "${row.journey_id}" has inconsistent critical values. ` +
        `Using "${journey.critical ? 'yes' : 'no'}" from first row.`
      );
    }

    journey.steps.push({
      step: parseInt(row.step, 10),
      user_does: row.user_does,
      system_shows: row.system_shows,
    });

    if (row.notes && row.notes.trim() !== '') {
      journey.acceptance_criteria.push(row.notes.trim());
    }
  }

  // Sort steps within each journey
  for (const journey of journeys.values()) {
    journey.steps.sort((a, b) => a.step - b.step);
  }

  return journeys;
}

// ---------------------------------------------------------------------------
// YAML Generation
// ---------------------------------------------------------------------------

/**
 * Escape a YAML string value. Wraps in quotes if it contains special chars.
 */
function yamlStr(s) {
  if (/[:#\[\]{}&*!|>'"`,@]/.test(s) || s.startsWith('-') || s.startsWith('?')) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

/**
 * Convert a journey_id like J-SIGNUP-FLOW to a filename slug: signup_flow
 */
function journeyIdToSlug(id) {
  return id
    .replace(/^J-/, '')
    .toLowerCase()
    .replace(/-/g, '_');
}

/**
 * Generate journey contract YAML string.
 * @param {object} journey - Journey object from groupByJourney
 * @param {string} [csvFilename] - Source CSV filename for from_spec field
 */
function generateYaml(journey, csvFilename) {
  const slug = journeyIdToSlug(journey.id);
  const criticality = journey.critical ? 'critical' : 'important';
  const today = new Date().toISOString().split('T')[0];
  const fromSpec = csvFilename || 'journeys.csv';

  let yaml = '';
  yaml += `journey_meta:\n`;
  yaml += `  id: ${journey.id}\n`;
  yaml += `  from_spec: "${fromSpec}"\n`;
  yaml += `  covers_reqs: []\n`;
  yaml += `  type: "e2e"\n`;
  yaml += `  dod_criticality: ${criticality}\n`;
  yaml += `  status: not_tested\n`;
  yaml += `  last_verified: "${today}"\n`;
  yaml += `  owner: ${yamlStr(journey.owner)}\n`;
  yaml += `\n`;

  yaml += `preconditions:\n`;
  yaml += `  - description: "None - journey starts from blank state"\n`;
  yaml += `    setup_hint: null\n`;
  yaml += `\n`;

  yaml += `steps:\n`;
  for (const step of journey.steps) {
    yaml += `  - step: ${step.step}\n`;
    yaml += `    name: ${yamlStr(step.user_does)}\n`;
    yaml += `    expected:\n`;
    yaml += `      - type: "element_visible"\n`;
    yaml += `        description: ${yamlStr(step.system_shows)}\n`;
  }
  yaml += `\n`;

  if (journey.acceptance_criteria.length > 0) {
    yaml += `acceptance_criteria:\n`;
    for (const ac of journey.acceptance_criteria) {
      yaml += `  - ${yamlStr(ac)}\n`;
    }
    yaml += `\n`;
  }

  yaml += `test_hooks:\n`;
  yaml += `  e2e_test_file: "tests/e2e/journey_${slug}.spec.ts"\n`;

  return yaml;
}

// ---------------------------------------------------------------------------
// Playwright Stub Generation
// ---------------------------------------------------------------------------

/**
 * Generate Playwright test stub for a journey.
 */
function generatePlaywright(journey) {
  let code = '';

  code += `import { test, expect } from '@playwright/test';\n`;
  code += `\n`;
  code += `test.describe('${journey.id}: ${journey.name}', () => {\n`;

  for (const step of journey.steps) {
    code += `  test('Step ${step.step}: ${step.user_does}', async ({ page }) => {\n`;
    code += `    // TODO: Implement\n`;
    code += `    // User does: ${step.user_does}\n`;
    code += `    // System shows: ${step.system_shows}\n`;
    code += `  });\n`;
    if (step !== journey.steps[journey.steps.length - 1]) {
      code += `\n`;
    }
  }

  code += `});\n`;

  return code;
}

// ---------------------------------------------------------------------------
// File Writing
// ---------------------------------------------------------------------------

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/**
 * Write all outputs for a set of journeys.
 * @param {Map} journeys - Map from groupByJourney
 * @param {string} rootDir - Project root (where docs/ and tests/ live)
 * @param {string} [csvFilename] - Source CSV filename for from_spec
 */
function writeOutputs(journeys, rootDir, csvFilename) {
  const contractDir = resolve(rootDir, 'docs', 'contracts');
  const testDir = resolve(rootDir, 'tests', 'e2e');
  ensureDir(contractDir);
  ensureDir(testDir);

  const written = { contracts: [], tests: [] };

  for (const journey of journeys.values()) {
    const slug = journeyIdToSlug(journey.id);

    const yamlPath = resolve(contractDir, `journey_${slug}.yml`);
    writeFileSync(yamlPath, generateYaml(journey, csvFilename), 'utf8');
    written.contracts.push(yamlPath);

    const testPath = resolve(testDir, `journey_${slug}.spec.ts`);
    writeFileSync(testPath, generatePlaywright(journey), 'utf8');
    written.tests.push(testPath);
  }

  return written;
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node scripts/specflow-compile.js <csv-file>');
    process.exit(1);
  }

  const csvPath = resolve(args[0]);
  let text;
  try {
    text = readFileSync(csvPath, 'utf8');
  } catch (err) {
    console.error(`Error reading file: ${csvPath}`);
    console.error(err.message);
    process.exit(1);
  }

  const rows = parseCsv(text);
  validateRows(rows);
  const journeys = groupByJourney(rows);

  const rootDir = process.cwd();
  const csvFilename = basename(csvPath);
  const written = writeOutputs(journeys, rootDir, csvFilename);

  console.log(`Compiled ${journeys.size} journey(s) from ${csvPath}`);
  for (const c of written.contracts) {
    console.log(`  Contract: ${c}`);
  }
  for (const t of written.tests) {
    console.log(`  Test:     ${t}`);
  }
}

// Exports for testing
module.exports = {
  parseCsv,
  validateRows,
  groupByJourney,
  generateYaml,
  generatePlaywright,
  journeyIdToSlug,
  writeOutputs,
};

// Run CLI when executed directly
if (require.main === module) {
  main();
}
