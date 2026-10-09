#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { currentMandate } = require('./adversary-mandate.cjs');

// templates/loops is canonical; templates/QA/loops is a generated shipping mirror.
function syncLoops(root = path.join(__dirname, '..'), check = false) {
  const canonical = path.join(root, 'templates/loops');
  const mirror = path.join(root, 'templates/QA/loops');
  const { ref } = currentMandate(path.join(canonical, 'adversary-mandate.md'));
  const version = ref.split('@')[1];
  const drift = [];
  function walk(dir) {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const source = path.join(dir, item.name);
      if (item.isDirectory()) { walk(source); continue; }
      const relative = path.relative(canonical, source);
      let content = fs.readFileSync(source, 'utf8');
      if (relative === 'spec-build.yaml') {
        content = content.replace(/adversary-mandate@v\d+/g, ref)
          .replace(/adversarial-prd-reviewer @v\d+/g, `adversarial-prd-reviewer @${version}`);
        if (content !== fs.readFileSync(source, 'utf8')) {
          drift.push(`canonical version: ${relative}`);
          if (!check) fs.writeFileSync(source, content);
        }
      }
      if (relative === 'falsification-template.md') {
        content = content.replace(/Required output of adversary-mandate@v\d+/, `Required output of ${ref}`);
        if (content !== fs.readFileSync(source, 'utf8')) {
          drift.push(`canonical version: ${relative}`);
          if (!check) fs.writeFileSync(source, content);
        }
      }
      const target = path.join(mirror, relative);
      if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
        drift.push(`mirror: ${relative}`);
        if (!check) { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }
      }
    }
  }
  walk(canonical);
  return drift;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  const drift = syncLoops(undefined, check);
  if (check && drift.length) { console.error(`Loop templates drifted:\n${drift.join('\n')}`); process.exitCode = 1; }
}
module.exports = { syncLoops };
