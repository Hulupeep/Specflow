'use strict';
// Shared #132 boundary. The existing runner owns execution/ledger; this module
// validates the declared goal and identities, never trusts a model's pass label.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
// Copied legacy projects need only their existing dependencies. Load the new
// schema dependency only when an outcome contract is actually selected.
let schemaSet;
function schemas() {
  if (schemaSet) return schemaSet;
let z;
  try { ({ z } = require('zod')); } catch { throw Error('outcome schema capability unavailable: install zod@4.6.7 in the copied project, or use the complete Specflow package'); }
const text = z.string().trim().min(1);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const localPath = text.refine(p => !path.isAbsolute(p) && !p.split(/[\\/]/).some(s => s === '..' || s === '.') && !p.includes('\\'), 'repository-relative file required');
const unique = schema => z.array(schema).refine(a => new Set(a).size === a.length, 'duplicate entry');
const level = z.enum(['unit', 'process', 'integration', 'journey']);
const obligationStateSchema = z.enum(['missing', 'failed', 'stale', 'unsupported', 'waived', 'passed']);
const comparisons = require('./oracle-comparison.cjs').schema(z);
const outcomeSchema = z.strictObject({
  version: z.literal(1), goal: text,
  configurations: z.array(z.strictObject({ id: text, environment: text })).min(1),
  assumptions: unique(text), unknowns: unique(text), non_goals: unique(text),
  obligations: z.array(z.strictObject({
    id: text, required: z.boolean(), oracle: z.strictObject({ path: localPath, sha256: digest,
      method: comparisons.method.optional(), comparisons: comparisons.comparisons.optional() }),
    value_bearing: z.boolean().optional(), required_claims: comparisons.claims.optional(),
    consistency_not_applicable_reason: text.optional(),
    check_ids: unique(text).refine(a => a.length > 0, 'check IDs required'),
    level, configuration_ids: unique(text).refine(a => a.length > 0, 'configuration IDs required'),
  })).min(1),
});
const bindingSchema = z.strictObject({
  version: z.literal(1), contract_sha256: digest, source_sha256: digest,
  configuration_id: text, environment: text, files: z.record(localPath, digest),
});
  return (schemaSet = { outcomeSchema, bindingSchema, obligationStateSchema, localPath, text, unique });
}
function validLocalPath(value) { return typeof value === 'string' && value.trim().length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]/).some(s => s === '..' || s === '.') && !value.includes('\\'); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, canonical(value[k])]));
  return value;
}
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashValue = value => hash(JSON.stringify(canonical(value)));
function contractHash(contract) {
  const { accepted_at, ...normative } = contract;
  return hashValue(normative);
}
function outcomeHash(contract) {
  return contract.outcome_contract ? hashValue(contract.outcome_contract) : null;
}
function validate(contract) {
  let set; try { set = schemas(); } catch (error) { return { ok: false, errors: [error.message] }; }
  const { outcomeSchema, unique, text, localPath } = set;
  const parsed = outcomeSchema.safeParse(contract.outcome_contract);
  const errors = parsed.success ? [] : parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
  if (!parsed.success) return { ok: false, errors };
  const outcome = parsed.data, configurations = new Map(), obligations = new Set(), checks = new Map();
  for (const c of outcome.configurations) {
    if (configurations.has(c.id)) errors.push(`duplicate configuration ${c.id}`);
    configurations.set(c.id, c);
  }
  if (!Array.isArray(contract.runtime_checks)) errors.push('runtime_checks must be an array');
  for (const c of Array.isArray(contract.runtime_checks) ? contract.runtime_checks : []) {
    if (!c || typeof c.id !== 'string' || !c.id.trim()) { errors.push('outcome runtime check needs stable id'); continue; }
    if (checks.has(c.id)) errors.push(`duplicate runtime check ${c.id}`);
    checks.set(c.id, c);
  }
  for (const o of outcome.obligations) {
    if (obligations.has(o.id)) errors.push(`duplicate obligation ${o.id}`);
    obligations.add(o.id);
    for (const id of o.configuration_ids) if (!configurations.has(id)) errors.push(`${o.id}: unknown configuration ${id}`);
    for (const id of o.check_ids) {
      const c = checks.get(id);
      if (!c) { errors.push(`${o.id}: missing check ${id}`); continue; }
      if (o.required && c.required !== true) errors.push(`${o.id}: ${id} must be required`);
      if (c.verification_level !== o.level) errors.push(`${o.id}: ${id} must use verification level ${o.level}`);
      const configs = unique(text).safeParse(c.configuration_ids);
      if (!configs.success || o.configuration_ids.some(config => !c.configuration_ids.includes(config)) || (configs.success && c.configuration_ids.some(config => !configurations.has(config)))) errors.push(`${o.id}: ${id} configuration coverage mismatch`);
      for (const field of ['checker_paths', 'input_paths', 'rule_paths']) {
        const result = unique(localPath).safeParse(c[field]);
        if (!result.success || (field === 'checker_paths' && !c[field].length)) errors.push(`${o.id}: ${id} invalid ${field}`);
      }
    }
  }
  require('./oracle-comparison.cjs').validateDeclarations({ ...contract, outcome_contract: outcome }, errors);
  return { ok: !errors.length, errors };
}
function coverage(contract, documents) {
  const validation = validate(contract);
  if (!validation.ok) return { ...validation, obligations: [] };
  const declared = new Map(contract.outcome_contract.obligations.map(o => [o.id, o]));
  const checks = new Set(contract.runtime_checks.map(c => c.id)), errors = [], covered = new Map();
  for (const { file, document } of documents) {
    for (const meta of [document?.contract_meta, document?.journey_meta].filter(Boolean)) {
      const refs = meta.covers_reqs || [], ids = meta.check_ids || [];
      if (!Array.isArray(refs) || !Array.isArray(ids) || new Set(refs).size !== refs.length || new Set(ids).size !== ids.length) { errors.push(`${file}: invalid/duplicate coverage references`); continue; }
      // Existing unrelated requirement IDs retain their existing validator.
      const parentRefs = refs.filter(id => declared.has(id) || /^O-/.test(id));
      if (!parentRefs.length && !ids.length) continue;
      if (typeof meta.owner !== 'string' || !meta.owner.trim()) errors.push(`${file}: planned parent coverage needs owner`);
      for (const id of ids) if (!checks.has(id)) errors.push(`${file}: unknown check ${id}`);
      for (const id of parentRefs) {
        const obligation = declared.get(id);
        if (!obligation) { errors.push(`${file}: unknown obligation ${id}`); continue; }
        const found = covered.get(id) || new Set();
        for (const check of ids) if (obligation.check_ids.includes(check)) found.add(check);
        covered.set(id, found);
      }
    }
  }
  const obligations = contract.outcome_contract.obligations.map(o => {
    const missing = o.check_ids.filter(id => !covered.get(o.id)?.has(id));
    if (o.required && missing.length) errors.push(`${o.id}: missing coverage for ${missing.join(', ')}`);
    return { id: o.id, required: o.required, status: 'missing', coverage_status: missing.length ? 'missing' : 'planned', missing_check_ids: missing };
  });
  return { ok: !errors.length, errors, obligations };
}
function fileHash(root, relative) {
  if (!validLocalPath(relative)) throw Error(`invalid binding path: ${relative}`);
  const base = path.resolve(root); let cursor = base;
  for (const part of relative.split('/')) {
    cursor = path.join(cursor, part);
    if (fs.lstatSync(cursor).isSymbolicLink()) throw Error(`binding symlink unsupported: ${relative}`);
  }
  if (!fs.statSync(cursor).isFile()) throw Error(`binding needs regular file: ${relative}`);
  return hash(fs.readFileSync(cursor));
}
function bind(contract, options = {}) {
  const valid = validate(contract);
  if (!valid.ok) return { status: 'blocked', errors: valid.errors };
  const configuration = contract.outcome_contract.configurations.find(c => c.id === options.configurationId);
  if (!configuration) return { status: 'unsupported', errors: ['select a declared configuration_id'] };
  if (configuration.environment !== options.environment) return { status: 'unsupported', errors: [`${configuration.id}: expected environment ${configuration.environment}`] };
  const root = path.resolve(options.root || process.cwd());
  try {
    const files = {};
    for (const o of contract.outcome_contract.obligations) {
      if (!o.configuration_ids.includes(configuration.id)) continue;
      files[o.oracle.path] = fileHash(root, o.oracle.path);
      if (files[o.oracle.path] !== o.oracle.sha256) throw Error(`${o.id}: accepted oracle bytes changed`);
      for (const id of o.check_ids) {
        const c = contract.runtime_checks.find(check => check.id === id);
        for (const name of [...c.checker_paths, ...c.input_paths, ...c.rule_paths]) files[name] = fileHash(root, name);
      }
    }
    const binding = { version: 1, contract_sha256: hashValue(contract), source_sha256: require('./duo-build.cjs').fingerprint(root), configuration_id: configuration.id, environment: options.environment, files };
    return { status: 'bound', binding: schemas().bindingSchema.parse(binding) };
  } catch (error) { return { status: 'blocked', errors: [error.message] }; }
}
function freshness(receiptBinding, currentBinding) {
  let bindingSchema; try { ({ bindingSchema } = schemas()); } catch (error) { return { status: 'missing', reason: error.message }; }
  if (!bindingSchema.safeParse(receiptBinding).success || !bindingSchema.safeParse(currentBinding).success) return { status: 'missing', reason: 'complete outcome binding required' };
  return hashValue(receiptBinding) === hashValue(currentBinding) ? { status: 'current' } : { status: 'stale', reason: 'accepted contract, source, input, oracle, checker or environment changed; rerun required checks' };
}
function authorizeRevision(root, previousOutcomeHash, contract, amendment) {
  const next = outcomeHash(contract);
  if (!previousOutcomeHash || previousOutcomeHash === next) return;
  if (!amendment?.record || !amendment.commentId || !amendment.signatureFile) throw Error('accepted outcome revision requires existing detached owner amendment authority');
  const specification = require('./specflow-specification.cjs');
  const proof = specification.ownerException(root, specification.read(root, amendment.record), amendment.commentId, { signatureFile: amendment.signatureFile });
  if (!proof.reason.includes(`outcome-amendment:${previousOutcomeHash}:${next || 'none'}`)) throw Error('owner amendment must name exact old/new outcome hashes');
}
// Projection only: callers must obtain check states through their owning
// verifier. This does not authenticate a report or grant parent acceptance.
function projectObligations(contract, options = {}) {
  const { obligationStateSchema } = schemas();
  const override = options.state && obligationStateSchema.safeParse(options.state);
  return contract.outcome_contract.obligations.map(o => {
    const states = o.check_ids.map(id => {
      const parsed = obligationStateSchema.safeParse(options.checkStates?.[id]);
      return parsed.success ? parsed.data : 'missing';
    });
    const status = override?.success ? override.data
      : ['failed', 'stale', 'unsupported', 'waived', 'missing'].find(s => states.includes(s)) || 'passed';
    return { id: o.id, required: o.required, status, check_ids: o.check_ids,
      next_action: status === 'passed' ? 'compose required parent evidence (#73)' : `execute ${o.check_ids.join(', ')} with owning case-level evidence (#44)` };
  });
}
function readiness(contract, options = {}) {
  const valid = contract?.outcome_contract ? validate(contract) : null;
  if (!valid) return { status: 'migration_required', reason: 'parent obligation/oracle/check mappings are unbound; accept outcome_contract v1' };
  if (!valid.ok) return { status: 'blocked', errors: valid.errors };
  return { status: 'unverified', obligations: projectObligations(contract, options) };
}
module.exports = { get outcomeSchema() { return schemas().outcomeSchema; }, get bindingSchema() { return schemas().bindingSchema; }, get obligationStateSchema() { return schemas().obligationStateSchema; }, validLocalPath, contractHash, outcomeHash, hashValue, validate, coverage, bind, freshness, authorizeRevision, projectObligations, readiness };
