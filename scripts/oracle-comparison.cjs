'use strict';
// Independent expected-value adapter for the existing native executor. This is
// comparison/shape validation, never a second execution or acceptance authority.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const KINDS = ['behaviour', 'correctness', 'provenance', 'consistency'];
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function pointerTokens(pointer) {
  if (typeof pointer !== 'string' || (pointer && !pointer.startsWith('/'))) throw Error('expected_pointer must be a JSON Pointer');
  if (pointer === '') return [];
  return pointer.slice(1).split('/').map(part => {
    if (/~(?:[^01]|$)/.test(part)) throw Error('invalid JSON Pointer escape');
    return part.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}
function resolvePointer(value, pointer) {
  for (const token of pointerTokens(pointer)) {
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, token)
      || (Array.isArray(value) && !/^(0|[1-9][0-9]*)$/.test(token))) throw Error(`expected value missing at ${pointer}`);
    value = value[token];
  }
  return value;
}
function schema(z) {
  const text = z.string().trim().min(1);
  const comparison = z.strictObject({
    id: text, check_id: text, case_id: text,
    expected_pointer: z.string().refine(p => { try { pointerTokens(p); return true; } catch { return false; } }, 'strict JSON Pointer required'),
    operator: z.enum(['exact', 'numeric']), absolute_tolerance: z.number().finite().nonnegative().optional(),
  }).superRefine((c, ctx) => {
    if ((c.operator === 'numeric') !== (c.absolute_tolerance !== undefined)) ctx.addIssue({ code: 'custom', message: 'numeric requires explicit absolute_tolerance; exact forbids tolerance' });
  });
  return {
    method: z.strictObject({ kind: z.literal('independent_fixture'), reference: text }),
    comparisons: z.array(comparison).min(1),
    claims: z.array(z.enum(KINDS.slice(1))).min(1).refine(a => new Set(a).size === a.length, 'duplicate required claim'),
  };
}
function definitions(contract) {
  return (contract?.outcome_contract?.obligations || []).flatMap(o => (o.oracle.comparisons || []).map(c => ({ ...c, obligation_id: o.id, oracle: o.oracle })));
}
function validateDeclarations(contract, errors) {
  const all = definitions(contract), seen = new Set();
  const checks = new Map((Array.isArray(contract.runtime_checks) ? contract.runtime_checks : []).filter(c => c && typeof c === 'object').map(c => [c.id, c]));
  for (const o of contract.outcome_contract.obligations) {
    const where = o.id;
    if (o.oracle.comparisons && !o.value_bearing) errors.push(`${where}: comparisons require explicit value_bearing`);
    if (o.value_bearing) {
      if (!o.oracle.method || !o.oracle.comparisons?.length) errors.push(`${where}: independent oracle method/reference and comparison matrix required`);
      for (const kind of ['correctness', 'provenance']) if (!o.required_claims?.includes(kind)) errors.push(`${where}: required_claims must include ${kind}`);
      if (!o.required_claims?.includes('consistency') && !o.consistency_not_applicable_reason) errors.push(`${where}: declare consistency or its applicability reason`);
      for (const kind of o.required_claims || []) if (!o.check_ids.some(id => checks.get(id)?.execution?.claim_kind === kind)) errors.push(`${where}: missing executed ${kind} check mapping`);
    } else if (o.required_claims || o.consistency_not_applicable_reason || o.oracle.method) errors.push(`${where}: value-bearing metadata needs explicit value_bearing`);
    for (const c of o.oracle.comparisons || []) {
      if (seen.has(c.id)) errors.push(`duplicate comparison ${c.id}`);
      seen.add(c.id);
      const check = checks.get(c.check_id);
      if (!o.check_ids.includes(c.check_id) || !check) { errors.push(`${where}: comparison ${c.id} has unknown check`); continue; }
      if (check.execution?.claim_kind !== 'correctness' || !check.execution?.comparison_ids?.includes(c.id)
        || !check.execution?.required_case_ids?.includes(c.case_id)) errors.push(`${where}: comparison ${c.id} must map to an accepted required native correctness case`);
    }
  }
  for (const check of checks.values()) {
    const ids = check.execution?.comparison_ids || [];
    if (check.execution?.claim_kind === 'correctness' && !ids.length) errors.push(`${check.id}: correctness needs consumed comparisons`);
    if (ids.length && check.execution?.claim_kind !== 'correctness') errors.push(`${check.id}: comparisons require correctness claim_kind`);
    for (const id of ids) if (!all.some(c => c.id === id && c.check_id === check.id)) errors.push(`${check.id}: unbound comparison ${id}`);
  }
}
function select(contract, check, configurationId) {
  const ids = check.execution?.comparison_ids || [];
  const all = definitions(contract), selected = all.filter(c => c.check_id === check.id);
  if (selected.length !== ids.length || ids.some(id => !selected.some(c => c.id === id))) throw Error(`${check.id}: exact accepted parent comparison mapping required`);
  return configurationId ? selected.filter(c => contract.outcome_contract.obligations.find(o => o.id === c.obligation_id).configuration_ids.includes(configurationId)) : selected;
}
function canonical(value) {
  if (typeof value === 'number' && !Number.isFinite(value)) throw Error('non-finite JSON operand unsupported');
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.keys(value).sort().map(k => [k, canonical(value[k])]);
  return value;
}
function compare(expected, actual, definition) {
  canonical(expected); canonical(actual);
  if (definition.operator === 'numeric') {
    if (typeof expected !== 'number' || typeof actual !== 'number' || !Number.isFinite(expected) || !Number.isFinite(actual)) throw Error('numeric comparison requires finite numbers without coercion');
    return Math.abs(expected - actual) <= definition.absolute_tolerance;
  }
  // Keep object/array distinctions and value types while ignoring object order.
  const normalize = value => Array.isArray(value) ? value.map(normalize) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(k => [k, normalize(value[k])])) : value;
  return JSON.stringify(normalize(expected)) === JSON.stringify(normalize(actual));
}
function evaluate(root, selected, cases, bytes) {
  const rows = JSON.parse(bytes.toString('utf8')), errors = [], comparisons = [];
  if (!Array.isArray(rows)) throw Error('observations must be an array of {comparison_id, actual}');
  const observations = new Map();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(k => !['comparison_id', 'actual'].includes(k)) || !Object.hasOwn(row, 'actual') || typeof row.comparison_id !== 'string') throw Error('invalid observation shape; actual value required, no submitted verdict');
    if (observations.has(row.comparison_id)) throw Error(`duplicate observation ${row.comparison_id}`);
    if (!selected.some(c => c.id === row.comparison_id)) throw Error(`unknown observation ${row.comparison_id}`);
    observations.set(row.comparison_id, row.actual);
  }
  for (const c of selected) {
    const native = cases.find(item => item.id === c.case_id);
    const count = native?.attempt_statuses?.length ?? native?.invocations;
    if (!native || native.status !== 'passed') { errors.push(`${c.id}: required native comparison case not passed`); continue; }
    if (count !== 1) { errors.push(`${c.id}: ambiguous native retry observations; use a fresh single-invocation attempt`); continue; }
    if (!observations.has(c.id)) { errors.push(`${c.id}: required observation missing`); continue; }
    const oracleBytes = fs.readFileSync(path.resolve(root, c.oracle.path));
    if (digest(oracleBytes) !== c.oracle.sha256) throw Error(`${c.id}: accepted oracle bytes changed`);
    const expected = resolvePointer(JSON.parse(oracleBytes.toString('utf8')), c.expected_pointer), actual = observations.get(c.id);
    const passed = compare(expected, actual, c);
    comparisons.push({ id: c.id, obligation_id: c.obligation_id, case_id: c.case_id, expected, actual, operator: c.operator,
      ...(c.absolute_tolerance !== undefined ? { absolute_tolerance: c.absolute_tolerance } : {}), status: passed ? 'passed' : 'failed' });
  }
  return { comparisons, errors, result: comparisons.some(c => c.status === 'failed') ? 'fail' : errors.length || comparisons.length !== selected.length ? 'blocked' : 'pass' };
}
module.exports = { KINDS, schema, definitions, validateDeclarations, select, resolvePointer, compare, evaluate };
