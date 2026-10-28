'use strict';
// Bounded declared-interface facts, consumed by the existing graph/native
// verifier. Compatibility is never runtime execution or parent acceptance.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { parseTicketDocument } = require('./ticket-document.cjs');
const { resolvePointer } = require('./oracle-comparison.cjs');
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const validPath = value => typeof value === 'string' && value && !path.isAbsolute(value) && !value.includes('\\') && !value.includes('\0') && !value.split('/').some(p => !p || p === '.' || p === '..' || p === '.git');
const validPointer = value => typeof value === 'string' && (value === '' || value.startsWith('/')) && !/~(?:[^01]|$)/.test(value);
let shapes;
function schemas(z = require('./vendor/zod/index.cjs').z) {
  if (shapes) return shapes;
  const text = z.string().trim().min(1), local = text.refine(validPath, 'repository-relative artifact path required');
  const ids = z.array(text).refine(a => new Set(a).size === a.length, 'duplicate id');
  const pointer = z.string().refine(validPointer, 'strict JSON Pointer required');
  const field = z.strictObject({ type: z.enum(['string', 'boolean', 'integer', 'number']), required: z.boolean(), nullable: z.boolean(),
    unit: text.nullable(), reference: text.nullable(), effective: text.nullable() });
  const facts = z.strictObject({ interface_id: text, revision: text, supported_revisions: ids.min(1), fields: z.record(text, field).refine(v => Object.keys(v).length > 0, 'relevant fields required') });
  const reference = z.strictObject({ path: local, sha256: z.string().regex(/^[a-f0-9]{64}$/), pointer });
  const endpoint = z.strictObject({ interface_id: text, schema_ref: z.strictObject({ adapter: text, path: local, pointer }) });
  const entry = z.strictObject({ id: text, required: z.boolean(), manifest_path: local, producer_ids: ids.min(1), consumer_ids: ids.min(1),
    obligation_ids: ids.min(1), check_ids: ids.min(1), expected_ref: reference });
  return (shapes = { facts, endpoint, entry });
}
function entriesSchema(z) { return z.array(schemas(z).entry).min(1); }
function validateDeclarations(contract, errors) {
  const entries = contract.outcome_contract.data_seams || [], seen = new Set();
  const checks = new Map((Array.isArray(contract.runtime_checks) ? contract.runtime_checks : []).filter(Boolean).map(c => [c.id, c]));
  for (const seam of entries) {
    if (seen.has(seam.id)) errors.push(`duplicate data seam ${seam.id}`); seen.add(seam.id);
    if (seam.producer_ids.some(id => seam.consumer_ids.includes(id))) errors.push(`${seam.id}: producer and consumer owners must be distinct`);
    for (const id of seam.obligation_ids) {
      const o = contract.outcome_contract.obligations.find(o => o.id === id);
      if (!o || (seam.required && !o.required) || seam.check_ids.some(c => !o.check_ids.includes(c))) errors.push(`${seam.id}: required obligation/check mapping unresolved: ${id}`);
    }
    for (const id of seam.check_ids) {
      const c = checks.get(id);
      if (!c || (seam.required && !c.required) || !['integration', 'journey'].includes(c.verification_level)
        || c.execution?.claim_kind !== 'correctness' || !c.execution?.comparison_ids?.length || !Array.isArray(c.execution?.seam_ids) || !c.execution.seam_ids.includes(seam.id)) errors.push(`${seam.id}: ${id} needs mapped owning integration correctness evidence`);
    }
  }
  for (const c of checks.values()) {
    if (c.execution?.seam_ids !== undefined && !Array.isArray(c.execution.seam_ids)) { errors.push(`${c.id}: seam_ids must be an array`); continue; }
    for (const id of c.execution?.seam_ids || []) if (!entries.some(s => s.id === id && s.check_ids.includes(c.id))) errors.push(`${c.id}: unbound data seam ${id}`);
  }
}
function readArtifact(root, relative) {
  if (!validPath(relative)) throw Error(`unsafe schema/manifest path: ${relative}`);
  let file = path.resolve(root);
  for (const part of relative.split('/')) { file = path.join(file, part); if (fs.lstatSync(file).isSymbolicLink()) throw Error(`schema/manifest symlink unsupported: ${relative}`); }
  const fd = fs.openSync(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0) | (fs.constants.O_NONBLOCK || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16 * 1024 * 1024) throw Error(`schema/manifest must be one bounded regular file: ${relative}`);
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
function parseFacts(value, label) {
  const parsed = schemas().facts.safeParse(value);
  if (!parsed.success) throw Error(`${label}: unsupported or incomplete json-interface-v1 facts: ${parsed.error.issues.map(i => i.path.join('.') + ': ' + i.message).join('; ')}`);
  return parsed.data;
}
function typeAccepts(producer, consumer) { return producer === consumer || producer === 'integer' && consumer === 'number'; }
function compareFacts(expected, producer, consumer, label) {
  const errors = [];
  if (producer.interface_id !== expected.interface_id || consumer.interface_id !== expected.interface_id) errors.push(`${label}: interface identity mismatch`);
  if (producer.revision !== expected.revision || !consumer.supported_revisions.includes(producer.revision)) errors.push(`${label}: unsupported revision producer=${producer.revision}, consumer=${consumer.revision}, accepted=${expected.revision}`);
  for (const [name, required] of Object.entries(expected.fields)) {
    const p = producer.fields[name], c = consumer.fields[name];
    if (!p || !c) { errors.push(`${label}: missing relevant built field ${name}`); continue; }
    if (!typeAccepts(p.type, required.type) || !typeAccepts(p.type, c.type)) errors.push(`${label}.${name}: type mismatch ${p.type} -> ${c.type}, accepted ${required.type}`);
    if (required.required && !p.required || c.required && !p.required) errors.push(`${label}.${name}: producer does not guarantee required presence`);
    if (!required.nullable && p.nullable || !c.nullable && p.nullable) errors.push(`${label}.${name}: nullable producer violates required non-null value`);
    for (const fact of ['unit', 'reference', 'effective']) if (p[fact] !== required[fact] || c[fact] !== required[fact]) errors.push(`${label}.${name}: ${fact} mismatch producer=${p[fact]}, consumer=${c[fact]}, accepted=${required[fact]}`);
  }
  for (const [name, c] of Object.entries(consumer.fields)) {
    const p = producer.fields[name];
    if (!p) { if (c.required) errors.push(`${label}.${name}: consumer-required field missing from producer`); continue; }
    if (!typeAccepts(p.type, c.type) || c.required && !p.required || !c.nullable && p.nullable) errors.push(`${label}.${name}: producer output does not satisfy consumer`);
    for (const fact of ['unit', 'reference', 'effective']) if (p[fact] !== c[fact]) errors.push(`${label}.${name}: producer/consumer ${fact} mismatch`);
  }
  return errors;
}
function inspect(contract, root, { phase = 'built', configurationId } = {}) {
  const errors = [], warnings = [], results = [], files = new Set(), manifests = new Map(), known = new Map();
  if (!['planned', 'built'].includes(phase)) throw Error('data seam phase must be planned|built');
  const selected = (contract.outcome_contract?.data_seams || []).filter(s => !configurationId || s.obligation_ids.some(id => contract.outcome_contract.obligations.find(o => o.id === id)?.configuration_ids.includes(configurationId)));
  for (const seam of selected) {
    let expected, document, localErrors = [], unresolved = false;
    const result = { id: seam.id, required: seam.required, producer_ids: seam.producer_ids, consumer_ids: seam.consumer_ids,
      obligation_ids: seam.obligation_ids, check_ids: seam.check_ids, runtime_status: 'unverified', compatibility: 'unverified' };
    try {
      const bytes = readArtifact(root, seam.expected_ref.path); files.add(seam.expected_ref.path);
      if (digest(bytes) !== seam.expected_ref.sha256) throw Error(`${seam.id}: accepted interface expectation bytes changed`);
      expected = parseFacts(resolvePointer(JSON.parse(bytes.toString('utf8')), seam.expected_ref.pointer), seam.id + ' expected');
      if (!manifests.has(seam.manifest_path)) {
        const bytes = readArtifact(root, seam.manifest_path); files.add(seam.manifest_path);
        const doc = parseTicketDocument(JSON.parse(bytes.toString('utf8')));
        if (doc.version !== 2) throw Error(`${seam.id}: typed data seams need version:2 manifest`);
        for (const t of doc.tickets) for (const role of ['writes', 'reads']) for (const ep of t[role] || []) if (typeof ep !== 'string') {
          const parsed = schemas().endpoint.safeParse(ep);
          if (!parsed.success) throw Error(`${t.id}: unsupported typed endpoint/adapter: ${parsed.error.issues.map(i => i.message).join('; ')}`);
        }
        manifests.set(seam.manifest_path, doc);
      }
      document = manifests.get(seam.manifest_path); const ids = known.get(seam.manifest_path) || new Set(); ids.add(expected.interface_id); known.set(seam.manifest_path, ids);
      const endpoints = role => document.tickets.flatMap(t => (t[role] || []).filter(ep => ep && typeof ep === 'object' && ep.interface_id === expected.interface_id).map(ep => ({ owner: t.id, ep })));
      const producers = endpoints('writes'), consumers = endpoints('reads');
      for (const [role, endpoints, owners] of [['producer', producers, seam.producer_ids], ['consumer', consumers, seam.consumer_ids]]) {
        if (endpoints.length !== owners.length || owners.some(id => endpoints.filter(e => e.owner === id).length !== 1)) localErrors.push(`${seam.id}: missing/duplicate/unexpected ${role} owner; expected ${owners.join(', ')}`);
      }
      const load = endpoint => {
        try { const ref = endpoint.ep.schema_ref; if (ref.adapter !== 'json-interface-v1') throw Error(`unsupported data adapter: ${ref.adapter}`); const bytes = readArtifact(root, ref.path); files.add(ref.path); return { ...endpoint, facts: parseFacts(resolvePointer(JSON.parse(bytes.toString('utf8')), ref.pointer), seam.id + ' ' + endpoint.owner) }; }
        catch (error) { if (phase === 'planned' && error.code === 'ENOENT') { unresolved = true; return null; } localErrors.push(`${seam.id} ${endpoint.owner}: ${error.message}`); return null; }
      };
      const pFacts = producers.map(load).filter(Boolean), cFacts = consumers.map(load).filter(Boolean);
      for (const p of pFacts) localErrors.push(...compareFacts(expected, p.facts, expected, `${seam.id} producer ${p.owner}`));
      for (const c of cFacts) localErrors.push(...compareFacts(expected, expected, c.facts, `${seam.id} consumer ${c.owner}`));
      for (const p of pFacts) for (const c of cFacts) localErrors.push(...compareFacts(expected, p.facts, c.facts, `${seam.id} ${p.owner}@${p.facts.revision} -> ${c.owner}@${c.facts.revision}`));
      result.interface_id = expected.interface_id;
      result.compatibility = localErrors.length ? localErrors.some(e => /unsupported/.test(e)) ? 'unsupported' : 'incompatible' : unresolved ? 'planned' : 'compatible';
      result.revisions = [...pFacts, ...cFacts].map(e => ({ owner: e.owner, revision: e.facts.revision }));
    } catch (error) { localErrors.push(`${seam.id}: ${error.message}`); result.compatibility = 'unsupported'; }
    result.errors = localErrors; result.next_action = localErrors.length ? 'repair named producer/consumer contract or use the authorised semantic amendment; then rerun the mapped integration check' : 'execute current mapped integration check; metadata compatibility is not runtime acceptance';
    (seam.required ? errors : warnings).push(...localErrors); results.push(result);
  }
  for (const [file, doc] of manifests) for (const t of doc.tickets) for (const role of ['writes', 'reads']) for (const ep of t[role] || []) if (ep && typeof ep === 'object' && !known.get(file)?.has(ep.interface_id)) errors.push(`${t.id}: typed interface ${ep.interface_id} missing from accepted required/optional inventory`);
  return { ok: !errors.length, scope: 'declared data interfaces; not whole-program dependency discovery', phase, runtime_status: 'unverified', errors, warnings,
    data_seams: results, files: [...files], derivedHops: results.map(s => ({ id: s.id, interface_id: s.interface_id, required: s.required, producer_ids: s.producer_ids, consumer_ids: s.consumer_ids, obligation_ids: s.obligation_ids, check_ids: s.check_ids, runtime_status: 'unverified' })) };
}
function selectedForCheck(contract, check, configurationId) {
  const ids = check.execution?.seam_ids || [], selected = (contract.outcome_contract?.data_seams || []).filter(s => s.check_ids.includes(check.id));
  if (selected.length !== ids.length || ids.some(id => !selected.some(s => s.id === id))) throw Error(`${check.id}: exact accepted data seam mapping required`);
  return configurationId ? selected.filter(s => s.obligation_ids.some(id => contract.outcome_contract.obligations.find(o => o.id === id).configuration_ids.includes(configurationId))) : selected;
}
module.exports = { entriesSchema, validateDeclarations, readArtifact, compareFacts, inspect, selectedForCheck, validPath };

// Projection only, like parent obligation states. The caller supplies current
// owning check states; this never authenticates a saved report or accepts a goal.
function project(contract, checkStates = {}, findings = [], override, configurationId) {
  const declared = contract?.outcome_contract?.data_seams;
  if (!Array.isArray(declared)) return [];
  const entries = declared.filter(s => !configurationId || s.obligation_ids.some(id => contract.outcome_contract.obligations.find(o => o.id === id)?.configuration_ids.includes(configurationId)));
  const state = value => require('./outcome-contract.cjs').obligationStateSchema.safeParse(value).success ? value : 'missing';
  return entries.map(seam => {
    const ids = Array.isArray(seam.check_ids) ? seam.check_ids : [], states = ids.map(id => state(checkStates[id]));
    const rows = findings.filter(f => ids.includes(f.check_id));
    const metadata = ids.map(id => rows.find(f => f.check_id === id)?.execution?.data_seams?.find(s => s.id === seam.id));
    const compatibility = metadata.length && metadata.every(s => s?.compatibility === 'compatible') ? 'compatible'
      : rows.some(f => /unsupported/.test(f.reason || '')) ? 'unsupported'
        : rows.some(f => /data seam compatibility blocked/.test(f.reason || '')) ? 'incompatible' : 'unverified';
    const runtime = override ? state(override) : ['failed', 'stale', 'unsupported', 'waived', 'missing'].find(s => states.includes(s))
      || (ids.length && compatibility === 'compatible' ? 'passed' : 'missing');
    return { id: seam.id, required: seam.required, producer_ids: seam.producer_ids, consumer_ids: seam.consumer_ids,
      obligation_ids: seam.obligation_ids, check_ids: ids, compatibility, runtime_status: runtime,
      reasons: rows.filter(f => f.reason).map(f => f.reason), next_action: runtime === 'passed' ? 'compose current parent evidence (#73)'
        : `repair named interface or execute ${ids.join(', ')} against current built references` };
  });
}
module.exports.project = project;
