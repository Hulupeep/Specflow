#!/usr/bin/env node
/**
 * provenance-gate.cjs — reusable source-provenance gate for feature-build.
 *
 * Declaration lint rejects missing fields/statuses. Text scans are advisory
 * review signals; current owning native checks establish feature-specific truth.
 */

const { readFileSync, existsSync } = require('fs');
const { spawnSync } = require('child_process');

function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function auditProvenance(doc) {
  const violations = [];
  const signals = [];
  const rows = doc && Array.isArray(doc.source_provenance) ? doc.source_provenance : [];
  if (!rows.length) violations.push('source_provenance must contain at least one row');
  rows.forEach((row, index) => {
    const prefix = `source_provenance[${index}]`;
    if (!row.claim) violations.push(`${prefix}.claim is required`);
    if (!row.source) violations.push(`${prefix}.source is required`);
    if (!row.verification) violations.push(`${prefix}.verification is required`);
    const text = `${row.claim || ''} ${row.source || ''} ${row.verification || ''}`;
    if (/\b(mock|fake|stub|fixture)\b/i.test(text) && !/fake provider|fixture.*default|contract-allowed|opt-in/i.test(text)) {
      signals.push(`${prefix} mentions mock/fake/stub evidence without an explicit allowance; review the accepted runtime boundary`);
    }
  });
  if (!['pass', 'passed'].includes(doc?.result)) violations.push(`result must be exact pass|passed: ${String(doc?.result)}`);
  return { ok: violations.length === 0, violations, signals, scope: 'declaration-lint', behaviour: 'unverified' };
}

function auditDiffText(diffText, options = {}) {
  const violations = [];
  const signals = [];
  const allowPattern = /specflow-provenance-allow|contract-allowed|fake provider|fixture default|opt-in smoke/i;
  const suspiciousLiteral = /(region_code|price|amount|total|rate|email|phone|postal|zipcode|zip|address|apiKey|token)\s*[:=]\s*['"`][^'"`]+['"`]/i;
  let currentFile = null;
  String(diffText || '').split(/\r?\n/).forEach((line, index) => {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      return;
    }
    if (!line.startsWith('+') || line.startsWith('+++')) return;
    if (currentFile && /(^docs\/|^evidence\/|\.md$|\.mdx$)/i.test(currentFile)) return;
    if (allowPattern.test(line)) return;
    if (/\b(mock|fake|stub)\b/i.test(line)) { // specflow-provenance-allow: scanner owns banned term matching
      signals.push(`diff line ${index + 1} adds mock/fake/stub path without explicit allowance`); // specflow-provenance-allow: scanner diagnostic
    }
    if (suspiciousLiteral.test(line) && !/source_provenance|provenance|test|fixture/i.test(line)) {
      signals.push(`diff line ${index + 1} adds a value-bearing literal; review its purpose and accepted runtime proof`);
    }
  });
  if (options.requireDiff && !String(diffText || '').trim()) violations.push('diff audit requested but diff is empty');
  return { ok: violations.length === 0, violations, signals, scope: 'source-scan', behaviour: 'unverified' };
}

function gitDiffText({ staged = false } = {}) {
  const args = staged
    ? ['diff', '--cached', '--', '.', ':(exclude)**/node_modules/**']
    : ['diff', '--', '.', ':(exclude)**/node_modules/**'];
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stderr || 'git diff failed');
  return result.stdout || '';
}

function main(argv = process.argv.slice(2)) {
  const path = argv[0];
  if (!path) {
    console.error('Usage: node scripts/provenance-gate.cjs <provenance.json> [--diff <file>|--git-diff|--staged-diff]');
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
  const diffFlag = argv.findIndex((arg) => arg === '--diff');
  if (diffFlag !== -1) {
    const diffPath = argv[diffFlag + 1];
    if (!diffPath || !existsSync(diffPath)) {
      console.error(`✗ no such diff file: ${diffPath || '<missing>'}`);
      return 2;
    }
    const diffResult = auditDiffText(readFileSync(diffPath, 'utf8'), { requireDiff: true });
    result = { ...result, ok: result.ok && diffResult.ok, violations: [...result.violations, ...diffResult.violations], signals: [...result.signals, ...diffResult.signals] };
  }
  if (argv.includes('--git-diff') || argv.includes('--staged-diff')) {
    try {
      const diffResult = auditDiffText(gitDiffText({ staged: argv.includes('--staged-diff') }), { requireDiff: false });
      result = { ...result, ok: result.ok && diffResult.ok, violations: [...result.violations, ...diffResult.violations], signals: [...result.signals, ...diffResult.signals] };
    } catch (e) {
      result = { ok: false, violations: [...result.violations, e.message] };
    }
  }
  if (result.ok) {
    console.error('✓ provenance declarations valid; correctness remains unverified without owning runtime comparisons');
    for (const signal of result.signals || []) console.error(`Review signal: ${signal}`);
    return 0;
  }
  console.error('✗ provenance gate failed:');
  result.violations.forEach((v) => console.error(`  - ${v}`));
  return 1;
}

module.exports = { auditProvenance, auditDiffText, gitDiffText };

if (require.main === module) process.exit(main());
