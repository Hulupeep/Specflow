'use strict';
const { hash } = require('./typesafe-client.cjs');
const routing = require('./typesafe-routing.cjs');
function rng(seed) { let x = seed >>> 0; return () => { x = (Math.imul(1664525, x) + 1013904223) >>> 0; return x / 4294967296; }; }
function binomialUpper(k, n, alpha = .05) {
  if (!n || k === n) return 1;
  function cdf(p) {
    let term = Math.pow(1 - p, n), total = term;
    for (let i = 1; i <= k; i++) { term *= (n - i + 1) / i * p / (1 - p); total += term; }
    return total;
  }
  let low = 0, high = 1;
  for (let i = 0; i < 80; i++) { const mid = (low + high) / 2; if (cdf(mid) > alpha) low = mid; else high = mid; }
  return high;
}
function interval(pairs, seed, resamples) {
  if (!pairs.length) return { estimate: null, lower: null, upper: null };
  const benefit = rows => 1 - rows.reduce((n, r) => n + r.policy, 0) / rows.reduce((n, r) => n + r.baseline, 0);
  const random = rng(seed), values = [];
  for (let i = 0; i < resamples; i++) values.push(benefit(pairs.map(() => pairs[Math.floor(random() * pairs.length)])));
  values.sort((a, b) => a - b);
  return { estimate: benefit(pairs), lower: values[Math.floor(.025 * resamples)], upper: values[Math.ceil(.975 * resamples) - 1] };
}
function analyze(manifest, pairs, observations) {
  const seen = new Set(), heldout = new Set(manifest.heldoutFamilies), details = [], times = [];
  let comparable = 0, regressions = 0, material = 0;
  for (const pair of pairs) {
    const key = routing.familyKey(pair.repository, pair.taskFamilyId), observation = observations.find(o => o.decisionId === pair.decisionId);
    if (seen.has(key)) { details.push({ key, excluded: 'duplicate_family' }); continue; }
    seen.add(key);
    let reason = pair.evidenceError || (!heldout.has(key) ? 'not_heldout' : !observation ? 'missing_pre_outcome_decision' : null);
    if (observation && (observation.repository !== pair.repository || observation.taskFamilyId !== pair.taskFamilyId || observation.snapshotHash !== pair.snapshotHash || observation.at > pair.startedAt || observation.status !== 'recorded')) reason = 'unmatched_decision';
    if (observation && (!Number.isFinite(observation.overheadMs) || observation.overheadMs < 0 || !['medium','high'].includes(observation.proposed?.effort))) reason ||= 'missing_policy_accounting';
    const arms = pair.arms || {};
    for (const effort of ['medium', 'high']) {
      const a = arms[effort];
      if (!a || a.status !== 'completed' || a.observedModel !== manifest.model || a.observedEffort !== effort || a.requestedEffort !== effort || a.deviation || a.snapshotHash !== pair.snapshotHash || a.acceptanceHash !== pair.acceptanceHash || !a.oracleRef || !a.reviewRef || !a.receiptHash || a.skipped !== 0 || a.requiredChecks < 1 || a.executedChecks !== a.requiredChecks || typeof a.accepted !== 'boolean' || typeof a.materialViolation !== 'boolean' || !Number.isFinite(a.elapsedMs) || a.elapsedMs <= 0) reason ||= 'missing_or_noncomparable_arm';
    }
    if (pair.transport !== 'live' || observation?.transport !== 'live') reason ||= 'simulated';
    if (!pair.independentUnit || !pair.blindedReview) reason ||= 'unverified_analysis_unit';
    if (reason) { details.push({ key, excluded: reason }); continue; }
    comparable++;
    const baselineEffort = manifest.baseline[pair.loop], proposedEffort = observation.proposed?.effort || baselineEffort;
    const baseline = arms[baselineEffort], policy = arms[proposedEffort];
    if (!baseline || !policy) throw Error('Unapproved policy arm');
    if (baseline.accepted && !policy.accepted) regressions++;
    if (policy.materialViolation && !baseline.materialViolation) material++;
    if (baseline.accepted && policy.accepted) times.push({ baseline: baseline.elapsedMs, policy: policy.elapsedMs + observation.overheadMs });
    details.push({ key, baselineEffort, proposedEffort, accepted: policy.accepted, baselineAccepted: baseline.accepted });
  }
  const coverage = routing.coverage(pairs.filter((p, i, all) => all.findIndex(r => r.repository === p.repository && r.taskFamilyId === p.taskFamilyId) === i));
  const uncertainty = { regressionUpper95: binomialUpper(regressions, comparable), benefit: interval(times, manifest.seed, manifest.resamples) };
  const candidate = seen.size === 100 && comparable === 100 && coverage.sufficient && !material && uncertainty.regressionUpper95 < .05 && times.length === comparable && uncertainty.benefit.estimate >= .1 && uncertainty.benefit.lower > 0;
  return { attemptedFamilies: seen.size, comparableFamilies: comparable, excludedFamilies: details.filter(d => d.excluded).length, regressions, materialViolations: material, coverage, ...uncertainty, recommendation: material || regressions ? 'not_supported' : candidate ? 'candidate_for_limited_adoption' : 'insufficient_evidence', details, analysisHash: hash({ pairs, observations, manifest }), scope: 'Only the registered held-out task families, stages and projects; never automatic adoption.' };
}
module.exports = { rng, binomialUpper, interval, analyze };
