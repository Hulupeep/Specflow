'use strict';
// Builtins only: this program also runs in the confined setup worker (#284).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const C = fs.constants;
const LIMITS = Object.freeze({ bytes: 1073741824, fileBytes: 512 * 1024 * 1024, entries: 100000,
  depth: 128, milliseconds: 300000, manifestBytes: 32 * 1024 * 1024 });
function reject(detail) { const e = Error('offline_input_changed'); e.code = 'offline_input_changed'; e.detail = detail; throw e; }
function need(ok, detail) { if (!ok) reject(detail); }
function canonical(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { need(Number.isSafeInteger(value), 'integer'); return String(value); }
  if (typeof value === 'string') { need(/^[\x00-\x7f]*$/.test(value), 'ascii'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  need(value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype, 'object');
  return '{' + Object.keys(value).sort().map(k => canonical(k) + ':' + canonical(value[k])).join(',') + '}';
}
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
function keys(value, fields) {
  need(value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === fields.sort().join('|'), 'fields');
}
function relative(name) {
  need(typeof name === 'string' && name.length <= 4096 && /^[\x20-\x7e]+$/.test(name) &&
    !name.includes('\\') && name.split('/').every(x => x && x !== '.' && x !== '..') &&
    name.split('/').length <= LIMITS.depth, 'path');
}
function validateManifest(m) {
  keys(m, ['schema', 'entries', 'bytes', 'entryCount']);
  need(m.schema === 'specflow.offline-cache/v1' && Array.isArray(m.entries) &&
    m.entries.length <= LIMITS.entries && m.entryCount === m.entries.length, 'manifest');
  let total = 0, previous = ''; const known = new Map();
  for (const e of m.entries) {
    need(e && typeof e === 'object', 'entry'); relative(e.path);
    need(e.path > previous, 'order'); previous = e.path;
    need(Number.isInteger(e.mode) && e.mode >= 0 && e.mode <= 0o777, 'mode');
    const parent = e.path.split('/').slice(0, -1).join('/');
    need(!parent || known.get(parent)?.kind === 'directory', 'parent');
    if (e.kind === 'directory') keys(e, ['path', 'kind', 'mode']);
    else {
      need(e.kind === 'file', 'kind'); keys(e, ['path', 'kind', 'mode', 'size', 'sha256', ...(e.sha512 ? ['sha512'] : [])]);
      need(Number.isSafeInteger(e.size) && e.size >= 0 && e.size <= LIMITS.fileBytes &&
        /^[a-f0-9]{64}$/.test(e.sha256), 'file');
      if (e.sha512 !== undefined) need(/^[a-f0-9]{128}$/.test(e.sha512), 'integrity');
      total += e.size; need(total <= LIMITS.bytes, 'bytes');
    }
    known.set(e.path, e);
  }
  need(Number.isSafeInteger(m.bytes) && m.bytes === total, 'total'); return m;
}
function parseManifest(raw, digest) {
  need(Buffer.isBuffer(raw) && raw.length <= LIMITS.manifestBytes && /^[a-f0-9]{64}$/.test(digest) &&
    sha256(raw) === digest, 'manifest_identity');
  let m; try { m = JSON.parse(raw.toString('utf8')); } catch { reject('json'); }
  // Exact canonical bytes also reject duplicate JSON keys, invalid UTF-8 and trailing material.
  need(raw.equals(Buffer.from(canonical(m))), 'canonical'); return validateManifest(m);
}
const signature = s => ['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs'].map(k => String(s[k])).join(':');
const stat = fd => fs.fstatSync(fd, { bigint: true });
function directory(name) {
  need(typeof name === 'string' && path.isAbsolute(name) && path.normalize(name) === name && name !== '/', 'directory');
  relative(name.slice(1)); let fd = fs.openSync('/', C.O_RDONLY | C.O_DIRECTORY);
  try {
    for (const part of name.slice(1).split('/')) {
      const next = fs.openSync(`/proc/self/fd/${fd}/${part}`, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
      fs.closeSync(fd); fd = next;
    }
    return fd;
  } catch (e) { fs.closeSync(fd); throw e; }
}
function readRegular(name, limit = LIMITS.manifestBytes) {
  const parent = directory(path.dirname(name)); let fd;
  try {
    fd = fs.openSync(`/proc/self/fd/${parent}/${path.basename(name)}`, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK);
    const before = stat(fd); need(before.isFile() && before.size <= BigInt(limit), 'regular');
    const chunks = []; let size = 0;
    while (true) {
      const b = Buffer.alloc(65536), n = fs.readSync(fd, b, 0, b.length, null);
      if (!n) break; size += n; need(size <= limit, 'read_limit'); chunks.push(b.subarray(0, n));
    }
    need(signature(before) === signature(stat(fd)) && before.size === BigInt(size), 'read_race');
    return Buffer.concat(chunks);
  } finally { if (fd !== undefined) fs.closeSync(fd); fs.closeSync(parent); }
}
// Source reads may have multiple links. No links, special files or privileged modes enter the result.
// All traversal stays relative to open directory descriptors, including destination writes.
function copyCache(source, destination, manifest) {
  validateManifest(manifest); const start = performance.now();
  const check = () => need(performance.now() - start <= LIMITS.milliseconds, 'deadline');
  const children = new Map([['', []]]);
  for (const e of manifest.entries) {
    const parent = e.path.split('/').slice(0, -1).join('/'); children.get(parent).push(e);
    if (e.kind === 'directory') children.set(e.path, []);
  }
  let sourceFd, parentFd, outputFd; let copied = 0;
  try {
    sourceFd = directory(source); parentFd = directory(path.dirname(destination));
    relative(path.basename(destination));
    fs.mkdirSync(`/proc/self/fd/${parentFd}/${path.basename(destination)}`, { mode: 0o700 });
    outputFd = fs.openSync(`/proc/self/fd/${parentFd}/${path.basename(destination)}`, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
    function walk(src, dst, prefix) {
      check(); const initial = stat(src), rows = children.get(prefix), names = fs.readdirSync(`/proc/self/fd/${src}`).sort();
      need(names.length <= LIMITS.entries && canonical(names) === canonical(rows.map(e => path.basename(e.path)).sort()), 'complete_directory');
      for (const e of rows) {
        check(); const name = path.basename(e.path), from = `/proc/self/fd/${src}/${name}`, to = `/proc/self/fd/${dst}/${name}`;
        const before = fs.lstatSync(from, { bigint: true });
        need(Number(before.mode & 0o7777n) === e.mode, 'source_mode');
        let input, output;
        try {
          input = fs.openSync(from, C.O_RDONLY | C.O_NOFOLLOW | C.O_NONBLOCK | (e.kind === 'directory' ? C.O_DIRECTORY : 0));
          need(signature(before) === signature(stat(input)), 'open_race');
          if (e.kind === 'directory') {
            need(before.isDirectory(), 'directory_kind'); fs.mkdirSync(to, { mode: 0o700 });
            output = fs.openSync(to, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW); walk(input, output, e.path);
          } else {
            need(before.isFile() && before.size === BigInt(e.size), 'file_kind');
            output = fs.openSync(to, C.O_WRONLY | C.O_CREAT | C.O_EXCL | C.O_NOFOLLOW, 0o600);
            const sha = crypto.createHash('sha256'), integrity = e.sha512 ? crypto.createHash('sha512') : null;
            let size = 0; const buffer = Buffer.alloc(65536);
            while (true) {
              check(); const n = fs.readSync(input, buffer, 0, buffer.length, null); if (!n) break;
              size += n; need(size <= e.size, 'file_grew'); sha.update(buffer.subarray(0, n)); integrity?.update(buffer.subarray(0, n));
              let offset = 0; while (offset < n) { const wrote = fs.writeSync(output, buffer, offset, n - offset); need(wrote > 0, 'write'); offset += wrote; }
            }
            need(size === e.size && sha.digest('hex') === e.sha256 && (!integrity || integrity.digest('hex') === e.sha512), 'digest');
            need(stat(output).nlink === 1n, 'output_links'); copied += size;
          }
          fs.fchmodSync(output, e.mode); fs.fsyncSync(output);
          need(signature(before) === signature(stat(input)) && signature(before) === signature(fs.lstatSync(from, { bigint: true })), 'source_race');
        } finally { if (input !== undefined) fs.closeSync(input); if (output !== undefined) fs.closeSync(output); }
      }
      need(signature(initial) === signature(stat(src)), 'directory_race'); fs.fsyncSync(dst);
    }
    walk(sourceFd, outputFd, ''); need(copied === manifest.bytes, 'copied_total');
    return { copiedBytes: copied, entryCount: manifest.entryCount, singleLinkCopies: true };
  } finally {
    for (const fd of [outputFd, parentFd, sourceFd]) if (fd !== undefined) fs.closeSync(fd);
  }
}
module.exports = { canonical, sha256, validateManifest, parseManifest, readRegular, directory, copyCache, LIMITS };
if (require.main === module) {
  try {
    const [file, digest, source, destination, ...extra] = process.argv.slice(2); need(!extra.length, 'arguments');
    console.log(JSON.stringify(copyCache(source, destination, parseManifest(readRegular(file), digest))));
  } catch (e) { console.error(JSON.stringify({ code: e.code || 'offline_input_changed', detail: e.detail || 'copy_failed' })); process.exitCode = 1; }
}
