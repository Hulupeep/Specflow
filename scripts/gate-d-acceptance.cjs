'use strict';
// Gate D composes the existing owning verifier; this is not another executor.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const lint = require('./teardown-gate.cjs');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function schema(z) {
  const text = z.string().trim().min(1), unique = value => z.array(value).min(1).refine(a => new Set(a).size === a.length, 'duplicate IDs');
  return z.strictObject({ hops: z.array(z.strictObject({ id: text.regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/), obligation_ids: unique(text) })).min(1), signoff_required: z.boolean().optional() });
}
function mappings(contract) {
  return contract.outcome_contract.acceptance?.hops || [{ id: contract.journey_id, obligation_ids: contract.outcome_contract.obligations.filter(o => o.required).map(o => o.id) }];
}
function validateDeclarations(contract, errors) {
  const policy = contract.outcome_contract.acceptance;
  if (!policy) return;
  const ids = new Set(), covered = new Set(), obligations = new Set(contract.outcome_contract.obligations.map(o => o.id));
  for (const hop of policy.hops) {
    if (ids.has(hop.id)) errors.push(`duplicate acceptance hop ${hop.id}`);
    ids.add(hop.id);
    for (const id of hop.obligation_ids) {
      if (!obligations.has(id)) errors.push(`${hop.id}: unknown obligation ${id}`);
      covered.add(id);
    }
  }
  for (const o of contract.outcome_contract.obligations) if (o.required && !covered.has(o.id)) errors.push(`acceptance hops omit required obligation ${o.id}`);
}
function safeRead(root, file) {
  const absolute = path.resolve(file), relative = path.relative(root, absolute);
  if (!relative || path.isAbsolute(relative) || relative.split(path.sep).some(p => p === '..' || p === '.git')) throw Error('report input must stay inside repository');
  for (let at = absolute; at !== root; at = path.dirname(at)) if (fs.lstatSync(at).isSymbolicLink()) throw Error(`report input must not follow symlinks: ${relative}`);
  const fd = fs.openSync(absolute, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || stat.size > 16 * 1024 * 1024) throw Error(`unsafe report input: ${relative}`);
    return fs.readFileSync(fd);
  } finally { fs.closeSync(fd); }
}
const states = new Set(['green', 'passed', 'red', 'failed', 'blocked', 'missing', 'skipped', 'stale', 'unsupported', 'waived']);
function report(contract, root, dir) {
  const errors = [], files = {}, contents = {};
  let legacyPolicy = null;
  const read = name => {
    if (!require('./outcome-contract.cjs').validLocalPath(name)) throw Error(`unsafe report reference ${name}`);
    const file = path.resolve(dir, name), bytes = safeRead(root, file);
    files[path.relative(root, file)] = hash(bytes); return bytes.toString('utf8');
  };
  try {
    for (const name of ['journey-map.md', 'findings.md']) contents[name] = read(name);
    if (fs.existsSync(path.join(dir, 'signoff-policy.json'))) {
      const parsed = JSON.parse(read('signoff-policy.json'));
      legacyPolicy = parsed.signoff_policy || parsed.signoffPolicy || {};
      if (legacyPolicy.required !== undefined && typeof legacyPolicy.required !== 'boolean') throw Error('legacy signoff required must be boolean; migrate the accepted policy');
    }
    const map = lint.extractJourneyDetails(contents['journey-map.md']), sections = lint.splitFindingSections(contents['findings.md']);
    for (const section of sections) for (const ref of lint.evidenceRefs(section.body)) read(ref);
    const structural = lint.lintGateD(dir, { signoff: false }); errors.push(...structural.errors);
    const expected = new Set(mappings(contract).map(h => h.id));
    for (const [kind, rows] of [['map', map], ['findings', sections]]) {
      const seen = new Set();
      for (const row of rows) {
        if (!expected.has(row.id)) errors.push(`unknown ${kind} hop ${row.id}`);
        if (seen.has(row.id)) errors.push(`duplicate ${kind} hop ${row.id}`);
        seen.add(row.id);
      }
      for (const id of expected) if (!seen.has(id)) errors.push(`missing ${kind} hop ${id}`);
    }
    const hops = sections.map(s => {
      const lines = [...s.body.matchAll(/^\s*(?:status|result)\s*:\s*([^\r\n]+)\s*$/gm)];
      const status = lines.length === 1 ? lines[0][1].trim() : null;
      if (!states.has(status)) errors.push(`${s.id}: one exact documented status/result required`);
      return { id: s.id, status };
    });
    return { report_validity: errors.length ? 'invalid' : 'valid', errors, files, hops, legacyPolicy };
  } catch (error) { errors.push(error.message); return { report_validity: 'invalid', errors, files, hops: [] }; }
}
function accept(options = {}) {
  const runner = require('./specflow-runner.cjs'), outcome = require('./outcome-contract.cjs');
  const root = path.resolve(options.root || process.cwd()), reportDir = path.resolve(root, options.reportDir || options.gateDDir || 'gate-d');
  const context = { root, runDir: options.verificationRunDir || options.runDir, requiredMode: 'always', sliceTags: ['integration'], makerClaim: 'gate_d_requested' };
  const paths = runner.verificationPaths(context), accepted = runner.requireAcceptedVerificationContract(context);
  const finish = result => {
    runner.appendLedger(paths.ledgerPath, { stage: 'GATE_D', event: 'gate_d_acceptance', ...result });
    return result;
  };
  if (!accepted.accepted || !accepted.contract?.outcome_contract) return finish({ report_validity: 'invalid', outcome_acceptance: 'blocked', errors: [accepted.reason || 'accepted parent outcome contract required'] });
  const contract = accepted.contract, valid = outcome.validate(contract);
  if (!valid.ok) return finish({ report_validity: 'invalid', outcome_acceptance: 'unsupported', errors: valid.errors });
  const before = report(contract, root, reportDir);
  if (before.errors.length) return finish({ report_validity: 'invalid', outcome_acceptance: 'blocked', errors: before.errors });
  if (before.legacyPolicy?.required === true && contract.outcome_contract.acceptance?.signoff_required === undefined) return finish({ report_validity: 'valid', outcome_acceptance: 'blocked', errors: ['legacy required signoff must be explicitly migrated to protected outcome_contract.acceptance.signoff_required; legacy hash attribution is not owner authority'] });
  const requiredHops = mappings(contract).filter(h => h.obligation_ids.some(id => contract.outcome_contract.obligations.some(o => o.id === id && o.required)));
  const bad = before.hops.filter(h => requiredHops.some(r => r.id === h.id) && !['green', 'passed'].includes(h.status));
  if (bad.length) return finish({ report_validity: 'valid', outcome_acceptance: bad.some(h => h.status === 'waived') ? 'waived' : bad.some(h => h.status === 'stale') ? 'stale' : 'failed', errors: bad.map(h => `${h.id}: required hop ${h.status}; disposition is not a passing result`), hops: bad, authority: 'report attribution only; no authenticated waiver inferred' });
  const required = contract.outcome_contract.obligations.filter(o => o.required);
  if (!required.length) return finish({ report_validity: 'valid', outcome_acceptance: 'blocked', errors: ['at least one required parent obligation needed'] });
  const ids = new Set(required.flatMap(o => o.configuration_ids));
  const configurations = contract.outcome_contract.configurations.filter(c => ids.has(c.id));
  const scopes = configurations.map(c => ({ configuration: c, bound: outcome.bind(contract, { root, configurationId: c.id, environment: c.environment }) }));
  const unsupported = scopes.find(s => s.bound.status !== 'bound');
  if (unsupported) return finish({ report_validity: 'valid', outcome_acceptance: 'unsupported', errors: unsupported.bound.errors });
  const approvalScope = outcome.hashValue({ contract: outcome.contractHash(contract), configurations: scopes.map(s => s.bound.binding), report: before.files });
  if (contract.outcome_contract.acceptance?.signoff_required === true) {
    try {
      const spec = require('./specflow-specification.cjs');
      const proof = spec.ownerException(root, spec.read(root, options.approvalRecord), options.approvalComment, { signatureFile: options.approvalSignature });
      if (!proof.reason.split(/\r?\n/).includes(`gate-d:${approvalScope}`)) throw Error('owner approval is stale or does not bind this Gate D scope');
    } catch (error) { return finish({ report_validity: 'valid', outcome_acceptance: 'blocked', errors: [`required detached owner approval: ${error.message}`], approval_scope: approvalScope }); }
  }
  const stages = configurations.map(c => ({ configuration: c, stage: runner.runVerifierStage({ ...context, configurationId: c.id, environment: c.environment }) }));
  const errors = [], obligations = [];
  for (const { configuration: c, stage } of stages) {
    const current = runner.revalidateVerifierStage(stage);
    for (const o of required.filter(o => o.configuration_ids.includes(c.id))) {
      const states = o.check_ids.map(id => stage.findings?.find(f => f.check_id === id)?.verifier_result);
      const passed = stage.gate === 'pass' && current.gate === 'pass' && states.every(s => s === 'pass');
      const status = passed ? 'passed' : current.status === 'stale' ? 'stale' : states.includes('fail') ? 'failed' : 'missing';
      obligations.push({ id: o.id, configuration_id: c.id, status, check_ids: o.check_ids });
      if (!passed) errors.push(`${o.id}/${c.id}: ${status}; ${stage.reason || current.reason || 'required current check missing'}`);
    }
  }
  const after = report(contract, root, reportDir), latest = runner.requireAcceptedVerificationContract(context);
  if (after.errors.length || outcome.hashValue(after.files) !== outcome.hashValue(before.files)) errors.push('report inputs changed or became invalid during acceptance');
  if (!latest.accepted || outcome.hashValue(latest.contract) !== outcome.hashValue(contract)) errors.push('latest verifier acceptance changed during Gate D');
  for (const scope of scopes) {
    const current = outcome.bind(contract, { root, configurationId: scope.configuration.id, environment: scope.configuration.environment });
    if (current.status !== 'bound' || outcome.freshness(scope.bound.binding, current.binding).status !== 'current') errors.push(`${scope.configuration.id}: normative scope changed during acceptance`);
  }
  return finish({ report_validity: after.errors.length ? 'invalid' : 'valid', outcome_acceptance: errors.length ? obligations.some(o => o.status === 'stale') ? 'stale' : 'failed' : 'passed', errors, obligations, approval_scope: approvalScope, contract_sha256: outcome.contractHash(contract), configuration_bindings: scopes.map(s => s.bound.binding), report_files: before.files, report_dir: reportDir });
}
module.exports = { schema, validateDeclarations, mappings, report, safeRead, accept };
