#!/usr/bin/env node
/**
 * provenance-gate.cjs — reusable source-provenance gate for feature-build.
 *
 * The gate rejects empty "trust me" evidence and obvious mock/literal laundering
 * in provenance notes. It is intentionally structural: feature-specific truth is
 * carried by source_provenance rows that name source and verification.
 */

const { readFileSync, existsSync } = require('fs');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function auditProvenance(doc) {
  const violations = [];
  const rows = doc && Array.isArray(doc.source_provenance) ? doc.source_provenance : [];
  if (!rows.length) violations.push('source_provenance must contain at least one row');
  rows.forEach((row, index) => {
    const prefix = `source_provenance[${index}]`;
    if (!row.claim) violations.push(`${prefix}.claim is required`);
    if (!row.source) violations.push(`${prefix}.source is required`);
    if (!row.verification) violations.push(`${prefix}.verification is required`);
    const text = `${row.claim || ''} ${row.source || ''} ${row.verification || ''}`;
    if (/\b(mock|fake|stub|fixture)\b/i.test(text) && !/fake provider|fixture.*default|contract-allowed|opt-in/i.test(text)) {
      violations.push(`${prefix} appears to rely on mock/fake/stub evidence without an explicit allowance`);
    }
  });
  if (doc.result && !/^pass|passed$/i.test(doc.result)) violations.push(`result is not pass: ${doc.result}`);
  return { ok: violations.length === 0, violations };
}

function main(argv = process.argv.slice(2)) {
  const path = argv[0];
  if (!path) {
    console.error('Usage: node scripts/provenance-gate.cjs <provenance.json>');
    return 2;
  }
  if (!existsSync(path)) {
    console.error(`✗ no such provenance file: ${path}`);
    return 2;
  }
  let result;
  try {
    result = auditProvenance(loadJson(path));
  } catch (e) {
    console.error(`✗ could not parse provenance: ${e.message}`);
    return 2;
  }
  if (result.ok) {
    console.error('✓ provenance gate passed');
    return 0;
  }
  console.error('✗ provenance gate failed:');
  result.violations.forEach((v) => console.error(`  - ${v}`));
  return 1;
}

module.exports = { auditProvenance };

if (require.main === module) process.exit(main());
