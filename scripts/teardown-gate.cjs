#!/usr/bin/env node
/**
 * teardown-gate.cjs — mechanical gates for the daily-use-teardown loop.
 *
 * Closes the loop's two self-attestation holes (adversary findings F1/S1):
 *
 * 1. SIGN-OFF (the HITL gate, un-forgeable-by-edit):
 *      node scripts/teardown-gate.cjs sign <file> --by "<name>"
 *    Writes <file>.signoff.json containing the SHA-256 of <file> AT CONFIRMATION TIME.
 *    The agent must never run `sign` (never_without_human) — but even if discipline slips,
 *    the hash binding closes the worst attack: confirm-then-silently-edit. Any edit to the
 *    signed file after sign-off breaks the hash and the check below FAILS.
 *
 * 2. CHECK (completeness + evidence correspondence, no self-attestation):
 *      node scripts/teardown-gate.cjs check <teardown-dir>
 *    Verifies, mechanically:
 *      - journey-map.md has a valid, hash-matching signoff
 *      - every journey listed in the map appears in findings.md (none silently skipped)
 *      - every findings entry references >=1 evidence file that actually exists
 *      - if do-list.md exists, it too has a valid, hash-matching signoff
 *    Exit 0 = pass, 1 = gate fails, 2 = usage/IO error.
 *
 * Journeys are recognised by id lines like `- J: <id> — <purpose>` (map) and `## J: <id>` or
 * `- J: <id>` (findings). Evidence refs = any `evidence/<name>.(png|jpg|jpeg|webp|txt|json|md)`
 * mention in the entry — text/JSON included so value-bearing hops can attach the oracle
 * re-read output itself (GATE D, pipeline-hardening #60), not just a screenshot.
 *
 * 3. CHECK-SIGN (generic, single-file):
 *      node scripts/teardown-gate.cjs check-sign <file>
 *    Validates one hash-bound sign-off (exists, parses, hash matches, has signer).
 *    Used by GATE_A for the falsification PASS binding and by GATE D for hop-table
 *    amendments — same sign/check pattern, any artifact. Exit 0 = valid, 1 = invalid.
 *
 * 4. CHECK-GATE-D (epic integration gate, optional sign-off policy):
 *      node scripts/teardown-gate.cjs check-gate-d <gate-d-dir>
 *    Validates hop findings, evidence, value-bearing evidence, red-hop dispositions, and
 *    only enforces sign-offs when signoff-policy.json says they are required.
 */

const { createHash } = require('crypto');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join, dirname, basename } = require('path');

function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }

function sign(file, by) {
  if (!existsSync(file)) { console.error(`✗ no such file: ${file}`); process.exit(2); }
  const hash = sha256(readFileSync(file));
  const out = `${file}.signoff.json`;
  writeFileSync(out, JSON.stringify({ file: basename(file), sha256: hash, signed_by: by, signed_at: new Date().toISOString() }, null, 2) + '\n');
  console.error(`✓ signed ${basename(file)} (sha256 ${hash.slice(0, 12)}…) by ${by} → ${basename(out)}`);
  console.error(`  NOTE: any later edit to ${basename(file)} invalidates this sign-off.`);
}

function checkSignoff(file) {
  const so = `${file}.signoff.json`;
  if (!existsSync(file)) return `missing file: ${basename(file)}`;
  if (!existsSync(so)) return `missing sign-off: ${basename(so)} (human must run: teardown-gate sign)`;
  let rec;
  try { rec = JSON.parse(readFileSync(so, 'utf8')); } catch { return `unreadable sign-off: ${basename(so)}`; }
  if (rec.sha256 !== sha256(readFileSync(file))) return `STALE sign-off: ${basename(file)} was edited AFTER sign-off — re-confirm required`;
  if (!rec.signed_by || !String(rec.signed_by).trim()) return `sign-off has no signer`;
  return null;
}

const JOURNEY_ID = /^[-#]+\s*J:\s*([A-Za-z0-9][A-Za-z0-9_-]*)/;

function extractJourneys(content) {
  const ids = new Set();
  for (const line of content.split('\n')) {
    const m = line.trim().match(JOURNEY_ID);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function extractJourneyDetails(content) {
  const details = [];
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const m = trimmed.match(JOURNEY_ID);
    if (!m) continue;
    details.push({
      id: m[1],
      valueBearing: /\b(value[-_ ]bearing|oracle|re-read|expected value)\b/i.test(trimmed),
    });
  }
  return details;
}

function loadGateDPolicy(dir) {
  const policyPath = join(dir, 'signoff-policy.json');
  if (!existsSync(policyPath)) return { signoff_policy: { required: false, artifacts: [] } };
  let policy;
  try {
    policy = JSON.parse(readFileSync(policyPath, 'utf8'));
  } catch {
    return { error: 'signoff-policy.json is not valid JSON' };
  }
  const signoff = policy.signoff_policy || policy.signoffPolicy || {};
  return {
    signoff_policy: {
      required: signoff.required === true,
      artifacts: Array.isArray(signoff.artifacts) ? signoff.artifacts : [],
    },
  };
}

function splitFindingSections(content) {
  const sections = [];
  const re = /^#+\s*J:\s*([A-Za-z0-9][A-Za-z0-9_-]*)[^\n]*\n?/gm;
  const matches = [...content.matchAll(re)];
  matches.forEach((match, i) => {
    const start = match.index + match[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index : content.length;
    sections.push({ id: match[1], body: content.slice(start, end) });
  });
  return sections;
}

function evidenceRefs(body) {
  return [...body.matchAll(/evidence\/[\w./-]+\.(?:png|jpg|jpeg|webp|txt|json|md)/g)].map(m => m[0]);
}

function checkGateD(dir) {
  const map = join(dir, 'journey-map.md');
  const findings = join(dir, 'findings.md');
  const errs = [];

  if (!existsSync(map)) errs.push('journey-map.md missing');
  if (!existsSync(findings)) errs.push('findings.md missing');

  const policy = loadGateDPolicy(dir);
  if (policy.error) errs.push(policy.error);

  if (policy.signoff_policy?.required) {
    const artifacts = policy.signoff_policy.artifacts.length ? policy.signoff_policy.artifacts : ['journey-map.md', 'gate-d-result.md'];
    for (const artifact of artifacts) {
      const err = checkSignoff(join(dir, artifact));
      if (err) errs.push(`${artifact}: ${err}`);
    }
  }

  if (existsSync(map) && existsSync(findings)) {
    const mapContent = readFileSync(map, 'utf8');
    const mapHops = extractJourneyDetails(mapContent);
    const mapIds = new Set(mapHops.map(h => h.id));
    const valueBearing = new Set(mapHops.filter(h => h.valueBearing).map(h => h.id));
    const findContent = readFileSync(findings, 'utf8');
    const sections = splitFindingSections(findContent);
    const byId = new Map(sections.map(s => [s.id, s.body]));

    if (mapHops.length === 0) errs.push(`journey map defines no hops (expected lines like "- J: <id> — <purpose>")`);
    for (const id of mapIds) {
      if (!byId.has(id)) errs.push(`hop silently skipped: ${id} is in the map but has no findings entry`);
    }

    for (const { id, body } of sections) {
      const refs = evidenceRefs(body);
      if (refs.length === 0) errs.push(`no evidence: findings for ${id} reference no evidence/* file (png/jpg/webp/txt/json/md)`);
      for (const r of refs) if (!existsSync(join(dir, r))) errs.push(`dangling evidence: ${r} referenced for ${id} but file does not exist`);

      const hasVision = refs.some(r => /\.md$/.test(r)) || /\bvision[-_ ]verifier\b/i.test(body);
      if (hasVision && !refs.some(r => /\.(png|jpg|jpeg|webp)$/.test(r))) {
        errs.push(`vision evidence incomplete: ${id} references a vision verifier without screenshot evidence`);
      }

      if (valueBearing.has(id) && !refs.some(r => /\.(txt|json)$/.test(r))) {
        errs.push(`value evidence missing: ${id} is value-bearing and needs .txt/.json oracle re-read evidence`);
      }

      const isRed = /\b(status|result)\s*:\s*(red|broken|fail(?:ed|ure)?)\b/i.test(body) || /\b(red hop|broken|failed)\b/i.test(body);
      if (isRed && !/\bdisposition\s*:\s*(bug|stale-oracle)\b/i.test(body)) {
        errs.push(`missing disposition: red hop ${id} must declare disposition: bug or stale-oracle`);
      }
      if (/\bdisposition\s*:\s*stale-oracle\b/i.test(body) && !/\b(amendment|provenance|countersign|counter-sign)\s*:/i.test(body)) {
        errs.push(`stale-oracle incomplete: ${id} needs amendment/provenance path`);
      }
    }
  }

  if (errs.length === 0) { console.error('✓ Gate D checks pass: hops complete, evidence resolves, value evidence and dispositions valid'); process.exit(0); }
  console.error('✗ Gate D check FAILED:');
  for (const e of errs) console.error(`  - ${e}`);
  process.exit(1);
}

function check(dir) {
  const map = join(dir, 'journey-map.md');
  const findings = join(dir, 'findings.md');
  const dolist = join(dir, 'do-list.md');
  const errs = [];

  const soErr = checkSignoff(map);
  if (soErr) errs.push(`journey map: ${soErr}`);

  if (existsSync(map) && existsSync(findings)) {
    const mapJ = extractJourneys(readFileSync(map, 'utf8'));
    const findContent = readFileSync(findings, 'utf8');
    const findJ = extractJourneys(findContent);
    for (const j of mapJ) if (!findJ.has(j)) errs.push(`journey silently skipped: ${j} is in the map but has no findings entry`);
    if (mapJ.size === 0) errs.push(`journey map defines no journeys (expected lines like "- J: <id> — <purpose>")`);

    // evidence correspondence: each findings journey section must reference >=1 existing evidence file
    const sections = findContent.split(/^#+\s*J:/m).slice(1);
    sections.forEach(sec => {
      const id = (sec.match(/^\s*([A-Za-z0-9][A-Za-z0-9_-]*)/) || [])[1] || '?';
      const refs = evidenceRefs(sec);
      if (refs.length === 0) errs.push(`no evidence: findings for ${id} reference no evidence/* file (png/jpg/webp/txt/json/md) — "I walked it" is not evidence`);
      for (const r of refs) if (!existsSync(join(dir, r))) errs.push(`dangling evidence: ${r} referenced for ${id} but file does not exist`);
    });
  } else if (existsSync(map)) {
    errs.push('findings.md missing (deep dive not done or not persisted)');
  }

  if (existsSync(dolist)) {
    const dErr = checkSignoff(dolist);
    if (dErr) errs.push(`do-list: ${dErr}`);
  }

  if (errs.length === 0) { console.error('✓ teardown gates pass: signed map, complete findings, evidence resolves'); process.exit(0); }
  console.error('✗ teardown gate FAILED:');
  for (const e of errs) console.error(`  - ${e}`);
  process.exit(1);
}

module.exports = { sha256, extractJourneys, extractJourneyDetails, checkSignoff, loadGateDPolicy, splitFindingSections, evidenceRefs };

if (require.main === module) {
  const [, , cmd, target, ...rest] = process.argv;
  if (cmd === 'sign' && target) {
    const byIdx = rest.indexOf('--by');
    const by = byIdx !== -1 ? rest[byIdx + 1] : '';
    if (!by) { console.error('Usage: teardown-gate.cjs sign <file> --by "<your name>"'); process.exit(2); }
    sign(target, by);
  } else if (cmd === 'check' && target) {
    check(target);
  } else if (cmd === 'check-gate-d' && target) {
    checkGateD(target);
  } else if (cmd === 'check-sign' && target) {
    const err = checkSignoff(target);
    if (err) { console.error(`✗ ${err}`); process.exit(1); }
    console.error(`✓ valid sign-off for ${basename(target)} (hash matches current content)`);
    process.exit(0);
  } else {
    console.error('Usage: teardown-gate.cjs sign <file> --by "<name>" | check <teardown-dir> | check-gate-d <gate-d-dir> | check-sign <file>');
    process.exit(2);
  }
}
