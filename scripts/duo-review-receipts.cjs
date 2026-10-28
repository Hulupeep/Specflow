'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const digest = text => crypto.createHash('sha256').update(text).digest('hex');
// Deliberately small shell grammar: no expansions, pipelines, redirection or chains.
function words(command) {
  const tokens = []; let value = '', quote = null, active = false;
  for (let i = 0; i < command.length; i++) {
    const c = command[i];
    if (quote === "'") { if (c === "'") quote = null; else value += c; active = true; continue; }
    if (c === '\\') { if (++i >= command.length) return null; value += command[i]; active = true; continue; }
    if (quote === '"') { if (c === '"') quote = null; else if ('$`\n'.includes(c)) return null; else value += c; active = true; continue; }
    if (c === "'" || c === '"') { quote = c; active = true; }
    else if ('|;&<>$`()\n*?[]{}~'.includes(c)) return null;
    else if (/\s/.test(c)) { if (active) { tokens.push(value); value = ''; active = false; } }
    else { value += c; active = true; }
  }
  if (quote) return null;
  if (active) tokens.push(value);
  return tokens;
}
function commandRead(command) {
  let args = words(command); if (!args) return null;
  if (args.length === 3 && /^\/(?:usr\/)?bin\/(?:ba)?sh$/.test(args[0]) && ['-c', '-lc'].includes(args[1])) args = words(args[2]);
  if (!args) return null;
  let start = 1, end = Infinity;
  const exe = args.shift();
  if (exe === 'sed') {
    if (args.shift() !== '-n') return null;
    const range = /^(\d+)(?:,(\d+|\$))?p$/.exec(args.shift() || '');
    if (!range) return null;
    start = Number(range[1]); end = range[2] === '$' ? Infinity : Number(range[2] || range[1]);
    if (!start || end < start) return null;
  } else if (exe !== 'cat') return null;
  if (args[0] === '--') args.shift();
  if (!args.length || args.some(f => !f || f.startsWith('-'))) return null;
  return { files: args, start, end, tool: exe };
}
// Native Read renders the image. This checks its encoding, media/container
// identity and exact frozen bytes; it does not infer equivalent resized pixels.
function imageBytes(part, frozen) {
  const source = part?.source;
  if (source?.type !== 'base64' || typeof source.data !== 'string' || !source.data) return null;
  let mime = null;
  if (frozen.length >= 57 && frozen.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))
    && frozen.readUInt32BE(8) === 13 && frozen.subarray(12, 16).toString('ascii') === 'IHDR'
    && frozen.readUInt32BE(16) > 0 && frozen.readUInt32BE(20) > 0
    && frozen.subarray(-12).equals(Buffer.from('0000000049454e44ae426082', 'hex'))) mime = 'image/png';
  else if (frozen.length >= 16 && frozen[0] === 255 && frozen[1] === 216 && frozen[2] === 255 && frozen.subarray(-2).equals(Buffer.from('ffd9', 'hex'))) mime = 'image/jpeg';
  else if (frozen.length >= 14 && /^(GIF87a|GIF89a)$/.test(frozen.subarray(0, 6).toString('ascii'))
    && frozen.readUInt16LE(6) > 0 && frozen.readUInt16LE(8) > 0 && frozen[frozen.length - 1] === 59) mime = 'image/gif';
  else if (frozen.length >= 20 && frozen.subarray(0, 4).toString('ascii') === 'RIFF' && frozen.subarray(8, 12).toString('ascii') === 'WEBP'
    && ['VP8 ', 'VP8L', 'VP8X'].includes(frozen.subarray(12, 16).toString('ascii')) && frozen.readUInt32LE(4) + 8 === frozen.length) mime = 'image/webp';
  if (!mime || source.media_type !== mime || source.data.length !== 4 * Math.ceil(frozen.length / 3)) return null;
  const bytes = Buffer.from(source.data, 'base64');
  return bytes.toString('base64') === source.data && bytes.equals(frozen) ? bytes : null;
}
function collect(events, round, allowed, { coverage = false } = {}) {
  const receipts = [], calls = new Map(), allow = new Set(allowed), seen = new Set();
  const covered = new Map();
  const relative = file => path.relative(round, path.resolve(round, file)).split(path.sep).join('/');
  const add = (file, tool, callId, extent, output, ranges = []) => {
    const name = relative(file);
    if (!allow.has(name) || !fs.existsSync(path.join(round, name))) return;
    const key = JSON.stringify([name, tool, callId]);
    if (seen.has(key)) return;
    seen.add(key);
    receipts.push({ path: name, tool, callId, extent, outputHash: digest(output) });
    if (coverage) {
      const text = fs.readFileSync(path.join(round, name), 'utf8');
      const lines = text.length ? text.replace(/\n$/, '').split('\n') : [];
      const row = covered.get(name) || { lines: new Set(), total: lines.length, full: false };
      if (extent === 'full' || !text.length) row.full = true;
      if (tool === 'Read' && typeof output === 'string') {
        for (const match of output.matchAll(/^\s*(\d+)[\t→](.*)$/gm)) {
          const n = Number(match[1]); if (n > 0 && lines[n - 1] === match[2]) row.lines.add(n);
        }
      }
      for (const [start, end] of ranges) for (let n = start; n <= Math.min(end, row.total); n++) row.lines.add(n);
      covered.set(name, row);
    }
  };
  for (const event of events) {
    for (const block of event.message?.content || []) {
      if (event.type === 'assistant' && block.type === 'tool_use') calls.set(block.id, block);
      if (event.type !== 'user' || block.type !== 'tool_result' || block.is_error) continue;
      const call = calls.get(block.tool_use_id);
      const parts = Array.isArray(block.content) ? block.content : [];
      const output = typeof block.content === 'string' ? block.content : parts.filter(b => b?.type === 'text').map(b => b.text).join('\n');
      if (!call || /^\s*(?:Error:|<tool_use_error>)/.test(output)) continue;
      if (call.name === 'Read' && typeof call.input?.file_path === 'string') {
        const name = relative(call.input.file_path);
        if (!allow.has(name) || name === '..' || name.startsWith('../') || path.isAbsolute(name)) continue;
        const images = parts.filter(b => b?.type === 'image');
        if (images.length || /\.(png|jpe?g|gif|webp)$/i.test(name)) {
          // Never fall back to explanatory text for a missing/different image.
          if (images.length !== 1) continue;
          let bytes;
          try { bytes = imageBytes(images[0], fs.readFileSync(path.join(round, name))); } catch { continue; }
          if (bytes) add(call.input.file_path, 'Read', call.id, 'full', bytes);
          continue;
        }
        if (!output) continue;
        let extent = 'partial';
        try {
          const text = fs.readFileSync(path.join(round, relative(call.input.file_path)), 'utf8');
          const lines = text.replace(/\n$/, '').split('\n');
          const seen = new Map([...output.matchAll(/^\s*(\d+)[\t→](.*)$/gm)].map(m => [Number(m[1]), m[2]]));
          if (output === text || (seen.size === lines.length && lines.every((line, i) => seen.get(i + 1) === line))) extent = 'full';
        } catch { /* Unknown extent never means complete contents. */ }
        add(call.input.file_path, 'Read', call.id, extent, output);
      } else if (output && call.name === 'Grep' && call.input?.output_mode === 'content' && !/^No matches found/.test(output)) {
        const search = path.resolve(round, call.input.path || '.');
        if (allow.has(relative(search))) {
          add(search, 'Grep', call.id, 'partial', output);
        } else {
          // Directory searches return filename:line:content (or -line- context).
          // Credit only actual source lines that match an allowed frozen file.
          for (const line of output.split('\n')) {
            const match = /^(.*?)([:-])(\d+)\2(.*)$/.exec(line);
            if (!match) continue;
            const file = path.resolve(round, match[1]);
            if (!file.startsWith(search + path.sep) || !allow.has(relative(file))) continue;
            let source; try { source = fs.readFileSync(file, 'utf8').split('\n'); } catch { continue; }
            if (source[Number(match[3]) - 1] === match[4]) add(file, 'Grep', call.id, 'partial', output);
          }
        }
      }
    }
    const item = event.item;
    if (event.type !== 'item.completed' || item?.type !== 'command_execution' || item.status !== 'completed' || item.exit_code !== 0 || typeof item.aggregated_output !== 'string') continue;
    const read = commandRead(item.command); if (!read) continue;
    for (const file of read.files) {
      const name = relative(file); if (!allow.has(name)) continue;
      let text; try { text = fs.readFileSync(path.join(round, name), 'utf8'); } catch { continue; }
      const lines = text.match(/[^\n]*\n|[^\n]+$/g) || [];
      const expected = read.tool === 'cat' ? text : lines.slice(read.start - 1, read.end).join('');
      // A successful command without the requested content is not a read receipt.
      if (expected.length ? !item.aggregated_output.includes(expected) : text.length !== 0 || read.tool !== 'cat' || item.aggregated_output !== '') continue;
      add(file, read.tool, item.id, read.start === 1 && read.end >= lines.length ? 'full' : 'partial', item.aggregated_output, [[read.start, read.end]]);
    }
  }
  const result = { version: 1, mechanism: 'successful native tool results', receipts, inspected: [...new Set(receipts.map(r => r.path))].sort() };
  if (coverage) {
    result.coverage = Object.fromEntries([...covered].map(([name, r]) => [name, { totalLines: r.total, linesRead: r.full ? r.total : r.lines.size, complete: r.full || r.lines.size === r.total }]));
    result.complete = Object.keys(result.coverage).filter(name => result.coverage[name].complete).sort();
  }
  return result;
}
function apply(result, access, request) {
  const declared = result.inspected || [];
  if (!Array.isArray(declared) || declared.some(file => !access.inspected.includes(file))) throw Error('Peer cited inspection without a successful content-access receipt');
  if (request) {
    const references = [
      ...(result.assessments || []).filter(r => r.status === 'verified'),
      ...(result.resolutions || []).filter(r => r.status === 'closed'),
      ...(result.diagnostics || []),
    ].flatMap(r => r.evidence || []);
    for (const reference of references) {
      if (typeof reference !== 'string') throw Error('Invalid evidence citation');
      const plain = reference.replace(/:\d+(?:-\d+)?$/, '');
      const file = request.batch.evidence.includes(plain) ? `tree/${plain}` : plain;
      if (!access.inspected.includes(file)) throw Error('Peer judgment cites evidence without a successful content-access receipt');
    }
    // Inspection is mechanical metadata, not a second model judgment. Fill only
    // an empty duplicate list from this instruction's submitted, snapshot-bound
    // evidence that was actually read. Explicit/malformed claims remain intact
    // for actions.apply to reject; outcomes and evidence are never rewritten.
    for (const row of result.instruction_assessments || []) {
      if (!Array.isArray(row?.inspected) || row.inspected.length || !Array.isArray(row.evidence)) continue;
      row.inspected = [...new Set(row.evidence
        .filter(file => typeof file === 'string' && request.batch.evidence.includes(file))
        .map(file => `tree/${file}`)
        .filter(file => Object.hasOwn(request.instruction_review?.artifactHashes || {}, file) && access.inspected.includes(file)))];
    }
  }
  result.inspected = access.inspected;
  return result;
}
module.exports = { collect, apply, commandRead };
