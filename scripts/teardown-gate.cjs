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
 * `- J: <id>` (findings). Evidence refs = any `evidence/<name>.png` mention in the entry.
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
      const refs = [...sec.matchAll(/evidence\/[\w./-]+\.(?:png|jpg|jpeg|webp)/g)].map(m => m[0]);
      if (refs.length === 0) errs.push(`no evidence: findings for ${id} reference no evidence/*.png — "I walked it" is not evidence`);
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

module.exports = { sha256, extractJourneys, checkSignoff };

if (require.main === module) {
  const [, , cmd, target, ...rest] = process.argv;
  if (cmd === 'sign' && target) {
    const byIdx = rest.indexOf('--by');
    const by = byIdx !== -1 ? rest[byIdx + 1] : '';
    if (!by) { console.error('Usage: teardown-gate.cjs sign <file> --by "<your name>"'); process.exit(2); }
    sign(target, by);
  } else if (cmd === 'check' && target) {
    check(target);
  } else {
    console.error('Usage: teardown-gate.cjs sign <file> --by "<name>" | check <teardown-dir>');
    process.exit(2);
  }
}
