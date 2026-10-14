'use strict';
const fs = require('fs');
const MARKER = '.specflow-gitlink.json';

// Gitlinks are dependencies, not files. Never fetch missing source or imply
// it was inspected. Virtual descriptors are hashed and frozen like source.
function manifest(root, extras, { git, safe, hash, excluded }) {
  const entries = {};
  const omitted = name => excluded(name) || name.split('/').includes('node_modules') ||
    /(^|\/)\.specflow\/(duo|specification)\//.test(name) || /(^|\/)\.claude\/worktrees\//.test(name);
  function regular(name) {
    if (excluded(name)) throw Error('Sensitive file cannot be review evidence');
    const file = safe(root, name);
    if (!fs.statSync(file).isFile()) throw Error(`Expected regular file: ${name}`);
    entries[name] = { sha256: hash(fs.readFileSync(file)), mode: fs.statSync(file).mode & 0o777 };
  }
  function visit(repo, prefix = '') {
    const links = new Map();
    for (const row of git(repo, 'ls-files', '--stage', '-z').split('\0').filter(Boolean)) {
      const match = row.match(/^(\d+) ([a-f0-9]+) (\d)\t([\s\S]+)$/);
      if (!match) throw Error('Invalid Git index entry');
      const [, mode, commit, stage, name] = match;
      if (stage !== '0') throw Error(`Unmerged index entry: ${prefix}${name}`);
      if (mode === '160000') links.set(name, commit);
    }
    const names = [...new Set(git(repo, 'ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))].sort();
    for (const name of names) {
      const rel = prefix + name;
      if (links.has(name)) continue;
      if (name === MARKER && prefix) throw Error(`Reserved snapshot metadata path: ${rel}`);
      if (omitted(rel)) continue;
      const file = safe(root, rel);
      if (fs.existsSync(file)) regular(rel);
    }
    for (const [name, indexCommit] of links) {
      const rel = prefix + name, directory = safe(root, rel);
      if (omitted(rel)) throw Error(`Excluded submodule requires explicit review: ${rel}`);
      let initialized = false;
      if (fs.existsSync(directory)) {
        if (!fs.statSync(directory).isDirectory()) throw Error(`Expected submodule directory: ${rel}`);
        initialized = fs.existsSync(safe(root, `${rel}/.git`));
        if (!initialized && fs.readdirSync(directory).length) throw Error(`Nonempty uninitialized submodule: ${rel}`);
      }
      const descriptor = { path: rel, indexCommit, initialized, sourceAvailable: initialized };
      if (initialized) {
        if (fs.existsSync(safe(root, `${rel}/${MARKER}`))) throw Error(`Reserved snapshot metadata path: ${rel}/${MARKER}`);
        if (fs.realpathSync(git(directory, 'rev-parse', '--show-toplevel').trim()) !== fs.realpathSync(directory)) throw Error(`Submodule root mismatch: ${rel}`);
        descriptor.headCommit = git(directory, 'rev-parse', 'HEAD').trim();
        descriptor.indexHash = hash(git(directory, 'ls-files', '--stage', '-z'));
        descriptor.diffHash = hash(git(directory, 'diff', '--binary', 'HEAD'));
        descriptor.omittedPaths = visit(directory, `${rel}/`);
      }
      descriptor.reviewLimit = initialized ? 'Only frozen files are available; omitted paths are not reviewed.' : 'Source is unavailable. This gitlink cannot verify dependency behaviour.';
      const virtual = JSON.stringify(descriptor, null, 2) + '\n';
      entries[`${rel}/${MARKER}`] = { sha256: hash(virtual), mode: 0o644, virtual };
    }
    return names.filter(name => omitted(prefix + name)).map(name => prefix + name);
  }
  visit(root);
  for (const name of extras) if (!Object.hasOwn(entries, name)) regular(name);
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
}
function submodules(entries) {
  return Object.entries(entries).filter(([, e]) => e.virtual !== undefined).map(([evidence, e]) => {
    const value = JSON.parse(e.virtual);
    return { path: value.path, evidence, sourceAvailable: value.sourceAvailable };
  });
}
function fileManifest(entries) {
  return Object.fromEntries(Object.entries(entries).map(([name, { sha256, mode }]) => [name, { sha256, mode }]));
}
module.exports = { manifest, submodules, fileManifest };
