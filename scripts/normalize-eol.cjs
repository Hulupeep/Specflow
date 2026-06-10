#!/usr/bin/env node
/**
 * normalize-eol.cjs — run by `prepack` before npm packs/publishes.
 *
 * Shell scripts with CRLF break bash on Linux/Mac ("$'\r': command not found").
 * `npm publish` packs from the working tree, so publishing from a Windows checkout
 * (autocrlf) would ship CRLF. This strips CR from the shell scripts at pack time on
 * ANY OS (node is always available), so the tarball is always LF. Belt-and-suspenders
 * with .gitattributes (which fixes checkout).
 */
const { readFileSync, writeFileSync, readdirSync, existsSync } = require('fs');
const { join } = require('path');

const ROOT = join(__dirname, '..');
const targets = new Set();

// All *.sh in repo root + hooks/ + scripts/, plus the extension-less git hooks.
for (const dir of ['.', 'hooks', 'scripts']) {
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) continue;
  for (const f of readdirSync(abs)) {
    if (f.endsWith('.sh')) targets.add(join(dir, f));
  }
}
for (const hook of ['hooks/commit-msg', 'hooks/pre-push']) {
  if (existsSync(join(ROOT, hook))) targets.add(hook);
}

let fixed = 0;
for (const rel of targets) {
  const p = join(ROOT, rel);
  const before = readFileSync(p, 'utf8');
  const after = before.replace(/\r\n/g, '\n');
  if (after !== before) {
    writeFileSync(p, after);
    console.error(`normalize-eol: CRLF→LF  ${rel}`);
    fixed++;
  }
}
console.error(`normalize-eol: ${targets.size} shell file(s) checked, ${fixed} fixed`);

// Guard: abort loudly if any CR survives — better to fail the publish than ship CRLF.
const dirty = [...targets].filter(rel => readFileSync(join(ROOT, rel), 'utf8').includes('\r'));
if (dirty.length) {
  console.error(`normalize-eol: ERROR — CR still present in: ${dirty.join(', ')}`);
  process.exit(1);
}
