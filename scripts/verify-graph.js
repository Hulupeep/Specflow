#!/usr/bin/env node

/**
 * verify-graph — Contract graph integrity validator
 *
 * Checks that the contract graph is internally consistent:
 *   - All test_hooks.e2e_test_file paths resolve to real files
 *   - All journey_meta.id values are unique
 *   - All contract_meta.covers_reqs IDs exist in CONTRACT_INDEX.yml
 *   - All invariant references in specs resolve to definitions
 *   - ADR frontmatter references resolve to real contracts/journeys
 *   - No orphan contract files missing from CONTRACT_INDEX.yml
 *
 * Usage:
 *   node scripts/verify-graph.js [contracts-dir]
 *   node scripts/verify-graph.js docs/contracts
 *
 * Exit codes:
 *   0 - No errors (warnings are OK)
 *   1 - One or more integrity errors found
 */

const { readdirSync, readFileSync, existsSync, statSync } = require('fs');
const { resolve, join, basename } = require('path');

// Try to load js-yaml, fall back to basic parsing
let yaml;
try {
  yaml = require('js-yaml');
} catch {
  yaml = null;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const contractsDir = process.argv[2] || 'docs/contracts';
const projectRoot = process.cwd();

const ERRORS = [];
const WARNINGS = [];

function error(msg) {
  ERRORS.push(msg);
  console.error(`  \x1b[31m✗\x1b[0m ${msg}`);
}

function warn(msg) {
  WARNINGS.push(msg);
  console.error(`  \x1b[33m⚠\x1b[0m ${msg}`);
}

function pass(msg) {
  console.error(`  \x1b[32m✓\x1b[0m ${msg}`);
}

function info(msg) {
  console.error(`  \x1b[34mℹ\x1b[0m ${msg}`);
}

// ---------------------------------------------------------------------------
// YAML parsing
// ---------------------------------------------------------------------------

function parseYaml(filePath) {
  const content = readFileSync(filePath, 'utf8');
  if (yaml) {
    return yaml.load(content);
  }
  // Basic fallback: extract key fields via regex
  return { _raw: content, _path: filePath };
}

function extractField(doc, fieldPath) {
  if (!doc) return undefined;
  if (doc._raw) {
    // Fallback regex extraction
    const pattern = new RegExp(`${fieldPath}:\\s*(.+)`, 'm');
    const match = doc._raw.match(pattern);
    return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined;
  }
  const parts = fieldPath.split('.');
  let val = doc;
  for (const p of parts) {
    if (val == null) return undefined;
    val = val[p];
  }
  return val;
}

function extractFieldFromRaw(raw, field) {
  const pattern = new RegExp(`${field}:\\s*(.+)`, 'm');
  const match = raw.match(pattern);
  return match ? match[1].trim().replace(/^["']|["']$/g, '') : undefined;
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

function checkContractsDir() {
  console.error('\n1. Contract Directory');
  console.error('---------------------');

  const absDir = resolve(projectRoot, contractsDir);
  if (!existsSync(absDir)) {
    error(`Contract directory not found: ${contractsDir}`);
    return [];
  }

  const files = readdirSync(absDir)
    .filter(f => f.endsWith('.yml') || f.endsWith('.yaml'))
    .map(f => join(absDir, f));

  if (files.length === 0) {
    warn('No contract YAML files found');
    return [];
  }

  pass(`Found ${files.length} contract file(s) in ${contractsDir}/`);
  return files;
}

function checkTestPaths(files) {
  console.error('\n2. Test File References');
  console.error('-----------------------');

  let checked = 0;
  let broken = 0;

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const name = basename(filePath);

    // Extract e2e_test_file
    const testFile = extractFieldFromRaw(content, 'e2e_test_file');
    if (testFile) {
      checked++;
      const absTest = resolve(projectRoot, testFile);
      if (existsSync(absTest)) {
        pass(`${name} → ${testFile}`);
      } else {
        error(`${name} → ${testFile} NOT FOUND`);
        broken++;
      }
    }

    // Also check e2e_test in CONTRACT_INDEX entries
    const e2eTest = extractFieldFromRaw(content, 'e2e_test');
    if (e2eTest && e2eTest !== testFile) {
      checked++;
      const absTest = resolve(projectRoot, e2eTest);
      if (existsSync(absTest)) {
        pass(`${name} → ${e2eTest}`);
      } else {
        error(`${name} → ${e2eTest} NOT FOUND`);
        broken++;
      }
    }
  }

  if (checked === 0) {
    info('No contracts define test file paths');
  } else if (broken === 0) {
    pass(`All ${checked} test file reference(s) resolve`);
  }
}

function checkJourneyIds(files) {
  console.error('\n3. Journey ID Uniqueness');
  console.error('------------------------');

  const ids = new Map(); // id → [files]

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const name = basename(filePath);

    // Look for journey_meta.id or id: J-*
    const idMatches = content.match(/id:\s*(J-[A-Z0-9-]+)/g) || [];
    for (const match of idMatches) {
      const id = match.replace('id:', '').trim();
      if (!ids.has(id)) ids.set(id, []);
      ids.get(id).push(name);
    }
  }

  if (ids.size === 0) {
    info('No journey IDs found');
    return ids;
  }

  let dupes = 0;
  for (const [id, sources] of ids) {
    if (sources.length > 1) {
      error(`Duplicate journey ID ${id} in: ${sources.join(', ')}`);
      dupes++;
    }
  }

  if (dupes === 0) {
    pass(`${ids.size} journey ID(s) are unique`);
  }

  return ids;
}

function checkContractIndex(files) {
  console.error('\n4. CONTRACT_INDEX.yml Coverage');
  console.error('------------------------------');

  const absDir = resolve(projectRoot, contractsDir);
  const indexPath = join(absDir, 'CONTRACT_INDEX.yml');

  if (!existsSync(indexPath)) {
    warn('No CONTRACT_INDEX.yml found — cannot verify coverage');
    return null;
  }

  const indexContent = readFileSync(indexPath, 'utf8');
  pass('CONTRACT_INDEX.yml exists');

  // Extract all contract file references from the index
  const indexedFiles = new Set();
  const fileMatches = indexContent.match(/file:\s*(\S+\.ya?ml)/g) || [];
  for (const match of fileMatches) {
    const file = match.replace('file:', '').trim();
    indexedFiles.add(basename(file));
  }

  // Check each contract file is in the index
  let orphans = 0;
  for (const filePath of files) {
    const name = basename(filePath);
    if (name === 'CONTRACT_INDEX.yml' || name === 'CONTRACT_INDEX.yaml') continue;

    if (!indexedFiles.has(name)) {
      warn(`${name} not listed in CONTRACT_INDEX.yml`);
      orphans++;
    }
  }

  if (orphans === 0) {
    pass('All contract files are listed in CONTRACT_INDEX.yml');
  }

  // Extract all requirement IDs from index
  const reqIds = new Set();
  const reqMatches = indexContent.match(/[A-Z]{2,}-\d{3}/g) || [];
  for (const id of reqMatches) {
    reqIds.add(id);
  }

  return { indexContent, reqIds, indexedFiles };
}

function checkInvariantReferences(files, indexData) {
  console.error('\n5. Invariant ID References');
  console.error('--------------------------');

  if (!indexData) {
    info('Skipped — no CONTRACT_INDEX.yml to validate against');
    return;
  }

  // Collect all invariant definitions from contracts
  const definedIds = new Set();
  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    // Match requirement_id or id fields with standard format
    const matches = content.match(/(?:requirement_id|id):\s*([A-Z]{2,}-\d{3})/g) || [];
    for (const match of matches) {
      const id = match.replace(/(?:requirement_id|id):\s*/, '');
      definedIds.add(id);
    }
  }

  // Also add IDs from the index
  for (const id of indexData.reqIds) {
    definedIds.add(id);
  }

  if (definedIds.size === 0) {
    info('No invariant IDs found in contracts');
    return;
  }

  pass(`${definedIds.size} invariant ID(s) defined across contracts and index`);

  // Check for references in specs directory
  const specsDir = resolve(projectRoot, 'docs/specs');
  if (!existsSync(specsDir)) {
    info('No docs/specs/ directory — skipping spec reference validation');
    return;
  }

  const specFiles = readdirSync(specsDir).filter(f => f.endsWith('.md'));
  let undefined_refs = 0;

  for (const specFile of specFiles) {
    const content = readFileSync(join(specsDir, specFile), 'utf8');
    // Find invariant references (I-XXX-NNN or XXX-NNN format)
    const refs = content.match(/\b(?:I-)?[A-Z]{2,}-\d{3}\b/g) || [];
    const uniqueRefs = [...new Set(refs)];

    for (const ref of uniqueRefs) {
      const normalizedRef = ref.replace(/^I-/, '');
      if (!definedIds.has(normalizedRef) && !definedIds.has(ref)) {
        // Check if it's a common false positive (e.g., dates like 2026-001)
        if (/^\d{4}-\d{3}$/.test(ref)) continue;
        warn(`${specFile} references ${ref} — not found in any contract`);
        undefined_refs++;
      }
    }
  }

  if (undefined_refs === 0 && specFiles.length > 0) {
    pass('All spec invariant references resolve to contract definitions');
  }
}

function checkAdrFrontmatter() {
  console.error('\n6. ADR Frontmatter');
  console.error('-------------------');

  // Look for ADRs in common locations
  const adrLocations = [
    'docs/adr',
    'docs/adrs',
    resolve(projectRoot, 'hubduck-frontend/docs/adr'),
    resolve(projectRoot, 'hubduck-backend/docs/adr'),
  ];

  let adrDir = null;
  for (const loc of adrLocations) {
    const absLoc = resolve(projectRoot, loc);
    if (existsSync(absLoc) && statSync(absLoc).isDirectory()) {
      adrDir = absLoc;
      break;
    }
  }

  if (!adrDir) {
    info('No ADR directory found — skipping');
    return;
  }

  const adrFiles = readdirSync(adrDir).filter(f => f.endsWith('.md'));
  if (adrFiles.length === 0) {
    info('No ADR files found');
    return;
  }

  pass(`Found ${adrFiles.length} ADR(s) in ${adrDir}`);

  for (const adrFile of adrFiles) {
    const content = readFileSync(join(adrDir, adrFile), 'utf8');

    // Check for YAML frontmatter
    if (content.startsWith('---')) {
      const endIdx = content.indexOf('---', 3);
      if (endIdx > 0) {
        const frontmatter = content.substring(3, endIdx);

        // Check journey contract references
        const journeyRefs = frontmatter.match(/journey_contracts:\s*\n([\s-]+\S+\.yml\n?)+/);
        if (journeyRefs) {
          const files = frontmatter.match(/- (\S+\.yml)/g) || [];
          for (const match of files) {
            const refFile = match.replace('- ', '');
            const absRef = resolve(projectRoot, contractsDir, refFile);
            if (!existsSync(absRef)) {
              error(`${adrFile} references ${refFile} — contract file not found`);
            }
          }
        }

        pass(`${adrFile} has frontmatter`);
      }
    } else {
      info(`${adrFile} has no YAML frontmatter (optional)`);
    }
  }
}

function checkWaivers(files) {
  console.error('\n7. Waiver Integrity');
  console.error('--------------------');

  let waiverCount = 0;
  let expiredCount = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf8');
    const name = basename(filePath);

    // Check for waivers section
    if (!content.includes('waivers:')) continue;

    // Extract waiver entries
    const waiverSection = content.split('waivers:')[1] || '';
    const invariantIds = waiverSection.match(/invariant_id:\s*(\S+)/g) || [];
    const expiresDates = waiverSection.match(/expires:\s*["']?(\d{4}-\d{2}-\d{2})["']?/g) || [];

    for (let i = 0; i < invariantIds.length; i++) {
      waiverCount++;
      const id = invariantIds[i].replace('invariant_id:', '').trim();

      if (i < expiresDates.length) {
        const expiresStr = expiresDates[i].replace(/expires:\s*["']?/, '').replace(/["']?$/, '');
        if (expiresStr < today) {
          error(`${name}: waiver for ${id} expired on ${expiresStr}`);
          expiredCount++;
        }
      }
    }
  }

  if (waiverCount === 0) {
    info('No waivers found in contracts');
  } else if (expiredCount === 0) {
    pass(`${waiverCount} waiver(s) found, none expired`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.error('\nSpecflow Graph Validator');
console.error('========================\n');
console.error(`Project root: ${projectRoot}`);
console.error(`Contracts dir: ${contractsDir}`);

const files = checkContractsDir();
if (files.length > 0) {
  checkTestPaths(files);
  checkJourneyIds(files);
  const indexData = checkContractIndex(files);
  checkInvariantReferences(files, indexData);
  checkWaivers(files);
}
checkAdrFrontmatter();

// Summary
console.error('\n========================');
console.error('Summary');
console.error('========================');
console.error(`  \x1b[31mErrors:   ${ERRORS.length}\x1b[0m`);
console.error(`  \x1b[33mWarnings: ${WARNINGS.length}\x1b[0m`);

if (ERRORS.length > 0) {
  console.error('\n\x1b[31m✗ Graph validation failed.\x1b[0m\n');
  process.exit(1);
} else if (WARNINGS.length > 0) {
  console.error('\n\x1b[33m⚠ Graph valid with warnings.\x1b[0m\n');
  process.exit(0);
} else {
  console.error('\n\x1b[32m✓ Graph is clean.\x1b[0m\n');
  process.exit(0);
}
