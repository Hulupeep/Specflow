#!/usr/bin/env node
'use strict';

// One applicability decision for native skills, the runner, Duo and waves.
// Labels describe planning depth. Only promotion evidence establishes readiness.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const TIERS = ['thin', 'contracted', 'build-ready'];
const BUILD_ROUTES = ['feature-build', 'duo-build', 'waves-controller', 'sprint-executor'];
const ROUTES = ['inspect', 'spec-build', 'specflow-loop-selector', 'specflow-audit', 'specflow-uplifter', 'specflow-writer', 'specflow-simulate', 'pre-flight-simulator', 'board-auditor', ...BUILD_ROUTES];
const OPERATIONS = ['inspect', 'promote', 'build', 'resume', 'finish', 'experiment'];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const digest = value => sha(JSON.stringify(value));

function tierOf(issue = {}) {
  const labels = (issue.labels || []).map(label => typeof label === 'string' ? label : label.name);
  const tiers = TIERS.filter(tier => labels.includes(`spec:${tier}`));
  if (tiers.length > 1) return { tier: null, errors: [`Conflicting tier labels: ${tiers.join(', ')}. Keep exactly one spec tier label.`], warnings: [] };
  return { tier: tiers[0] || 'thin', errors: [], warnings: tiers.length ? [] : ['No tier label: treating this ticket as thin; this does not establish build readiness.'] };
}

function issueHash(issue) {
  // Ordinary comments, labels and updatedAt are not evidence of changed scope.
  return digest({ number: issue.number, title: issue.title || '', body: issue.body || '' });
}

function inputHash(record) {
  return digest({ issue: issueHash(record.issue), source: record.source || null, profile: record.profile || {}, assumptions: record.assumptions || [], dependencies: record.dependencies || [] });
}

function localFile(root, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative)) throw Error('Evidence needs a repository-relative path');
  const absolute = path.resolve(root, relative), realRoot = fs.realpathSync(root);
  if (!absolute.startsWith(path.resolve(root) + path.sep)) throw Error(`Evidence escapes repository: ${relative}`);
  const real = fs.realpathSync(absolute);
  if (!real.startsWith(realRoot + path.sep) || !fs.statSync(real).isFile()) throw Error(`Evidence is not a repository file: ${relative}`);
  return real;
}

function referenceErrors(root, ref, label = 'Evidence') {
  if (!ref || !/^[a-f0-9]{64}$/.test(ref.sha256 || '')) return [`${label}: missing content hash`];
  try {
    const actual = sha(fs.readFileSync(localFile(root, ref.path)));
    return actual === ref.sha256 ? [] : [`${label}: changed evidence ${ref.path}`];
  } catch (error) { return [`${label}: ${error.message}`]; }
}

function artifactErrors(root, artifacts, requiredRoles) {
  const errors = [], seen = new Set();
  for (const item of artifacts) {
    if (!item.id || seen.has(item.id)) errors.push(`Artifact IDs must be unique: ${item.id || '(missing)'}`);
    seen.add(item.id);
    if (item.applicable === false || item.deferred === true) {
      if (!item.reason?.trim()) errors.push(`${item.id}: N/A needs a reason`);
    } else errors.push(...referenceErrors(root, item, item.id));
  }
  for (const role of requiredRoles) {
    if (!artifacts.some(item => item.role === role && item.applicable !== false && item.deferred !== true)) errors.push(`Missing applicable ${role} evidence; reuse an existing artifact where possible`);
  }
  return errors;
}

function requirements(record, targetTier) {
  const profile = record.profile || {}, roles = [];
  if (targetTier !== 'thin') {
    for (const seam of profile.materialSeams || []) roles.push(`decision:${seam.id}`);
    if (profile.ui === true) roles.push('persona-walkthrough');
  }
  if (targetTier === 'build-ready') roles.push('acceptance-checks', 'simulation', 'preflight');
  return [...new Set(roles)];
}

function evaluate(record, { root = process.cwd(), route = 'inspect', operation = 'inspect', targetTier } = {}) {
  if (!record?.issue) return { status: 'blocked', tier: 'thin', errors: ['Missing current issue snapshot. Import the issue before evaluating readiness.'], warnings: [], next_action: 'Load current scope and tier labels.' };
  const declared = tierOf(record.issue), tier = targetTier || declared.tier;
  const errors = [...declared.errors], warnings = [...declared.warnings];
  if (!ROUTES.includes(route)) errors.push(`Unknown route ${route}; use one of: ${ROUTES.join(', ')}`);
  if (!OPERATIONS.includes(operation)) errors.push(`Unknown operation ${operation}; use one of: ${OPERATIONS.join(', ')}`);
  if (targetTier && !TIERS.includes(targetTier)) errors.push(`Unknown target tier: ${targetTier}`);
  const production = operation === 'build' || operation === 'finish' || (operation === 'resume' && BUILD_ROUTES.includes(route));
  const deepen = operation === 'promote' || production;
  const required = requirements(record, tier);
  const artifacts = record.profile?.artifacts || [];
  if (deepen) {
    if (!record.profile || typeof record.profile.ui !== 'boolean') errors.push('Record whether this slice changes a UI; unknown applicability blocks promotion');
    if (!Array.isArray(record.profile?.materialSeams)) errors.push('Assess material ownership/privacy/interface seams before promotion');
    errors.push(...artifactErrors(root, artifacts, required));
    if (record.freshness?.status !== 'current') errors.push('Required freshness source is missing, stale or unavailable');
    for (const discovery of record.discoveries || []) {
      if (discovery.status !== 'resolved') errors.push(`Unresolved discovery ${discovery.id}: ${discovery.status || 'open'}`);
    }
  }
  if (production) {
    if (declared.tier !== 'build-ready') errors.push(`Production building requires build-ready evidence; current tier is ${declared.tier || 'conflicted'}`);
    const receipt = record.readiness;
    if (!receipt || receipt.tier !== 'build-ready' || receipt.inputHash !== inputHash(record)) errors.push('No current verified promotion receipt; a label or old review is insufficient');
    if (receipt) {
      if (!receipt.gates?.length || receipt.gates.some(g => g.status !== 'passed' || g.skipped || !g.executed)) errors.push('Required promotion gates are absent, skipped or not passed');
      for (const gate of receipt.gates || []) errors.push(...referenceErrors(root, gate.evidence, `Gate ${gate.id}`));
      if (!receipt.review || !['passed', 'passed_with_warnings'].includes(receipt.review.outcome)) errors.push('Promotion requires an evidenced scoped review, not an override or an ungraded fix');
      else errors.push(...referenceErrors(root, receipt.review.evidence, 'Scoped review'));
    }
  }
  // Preparation commands may inspect partially specified work. Missing build
  // artifacts are only blockers for an actual promotion/build request.
  const next = errors.length ? errors[0] : production ? 'Proceed with the selected slice; implementation tests and release gates still apply.' : tier === 'thin' ? 'Keep future work thin. Select the next justified slice or a bounded learning experiment.' : tier === 'contracted' ? 'Review applicable irreversible decisions and UI walkthrough; deepen only the selected slice when dependencies justify it.' : 'Validate current promotion evidence before production work.';
  return { status: errors.length ? 'blocked' : production ? 'eligible' : operation === 'experiment' ? 'experiment_plan_required' : 'planning', tier, simulation_required: tier === 'build-ready', review_scope: required, errors, warnings, next_action: operation === 'experiment' && !errors.length ? 'Define a bounded experiment; no production readiness or acceptance is granted.' : next, implementation_status: record.implementation_status || 'not_established' };
}

function installLabels(root, run = spawnSync) {
  const colors = ['D4C5F9', 'BFD4F2', '0E8A16'];
  const existing = run('gh', ['label', 'list', '--limit', '1000', '--json', 'name'], { cwd: root, encoding: 'utf8' });
  if (existing.status !== 0) return { status: 'blocked', error: 'Cannot read GitHub labels; check gh authentication and repository access.' };
  let labels;
  try { labels = JSON.parse(existing.stdout); } catch { return { status: 'blocked', error: 'Invalid GitHub labels response' }; }
  const created = [];
  for (const [index, tier] of TIERS.entries()) {
    const name = `spec:${tier}`;
    if (labels.some(label => label.name === name)) continue;
    const result = run('gh', ['label', 'create', name, '--color', colors[index], '--description', `Specification depth: ${tier}; labels alone do not prove readiness`], { cwd: root, encoding: 'utf8' });
    if (result.status !== 0) return { status: 'blocked', created, error: `Cannot create ${name}; check GitHub label permissions and retry.` };
    created.push(name);
  }
  return { status: 'installed', created };
}

function cli(argv = process.argv.slice(2)) {
  try {
    const [command, file, route = 'inspect', operation = 'inspect'] = argv;
    let result;
    if (command === 'install-labels') result = installLabels(process.cwd());
    else if (command === 'inspect' && file) result = require('./specflow-specification.cjs').boundary(process.cwd(), JSON.parse(fs.readFileSync(file, 'utf8')), { route, operation });
    else throw Error('Usage: specflow tier inspect <record.json> [route] [inspect|promote|build|resume|finish] | install-labels');
    console.log(JSON.stringify(result, null, 2));
    return result.status === 'blocked' ? 2 : 0;
  } catch (error) { console.error(error.message); return 2; }
}

module.exports = { TIERS, BUILD_ROUTES, ROUTES, OPERATIONS, sha, digest, tierOf, issueHash, inputHash, localFile, referenceErrors, artifactErrors, requirements, evaluate, installLabels, cli };
if (require.main === module) process.exitCode = cli();
