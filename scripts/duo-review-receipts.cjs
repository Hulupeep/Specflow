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
function collect(events, round, allowed) {
  const receipts = [], calls = new Map(), allow = new Set(allowed), seen = new Set();
  const relative = file => path.relative(round, path.resolve(round, file)).split(path.sep).join('/');
  const add = (file, tool, callId, extent, output) => {
    const name = relative(file);
    if (!allow.has(name) || !fs.existsSync(path.join(round, name))) return;
    const key = JSON.stringify([name, tool, callId]);
    if (seen.has(key)) return;
    seen.add(key);
    receipts.push({ path: name, tool, callId, extent, outputHash: digest(output) });
  };
  for (const event of events) {
    for (const block of event.message?.content || []) {
      if (event.type === 'assistant' && block.type === 'tool_use') calls.set(block.id, block);
      if (event.type !== 'user' || block.type !== 'tool_result' || block.is_error) continue;
      const call = calls.get(block.tool_use_id);
      const output = typeof block.content === 'string' ? block.content : (block.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
      if (!call || !output || /^\s*(?:Error:|<tool_use_error>)/.test(output)) continue;
      if (call.name === 'Read' && typeof call.input?.file_path === 'string') {
        let extent = 'partial';
        try {
          const text = fs.readFileSync(path.join(round, relative(call.input.file_path)), 'utf8');
          const lines = text.replace(/\n$/, '').split('\n');
          const seen = new Map([...output.matchAll(/^\s*(\d+)[\t→](.*)$/gm)].map(m => [Number(m[1]), m[2]]));
          if (output === text || (seen.size === lines.length && lines.every((line, i) => seen.get(i + 1) === line))) extent = 'full';
        } catch { /* Unknown extent never means complete contents. */ }
        add(call.input.file_path, 'Read', call.id, extent, output);
      } else if (call.name === 'Grep' && call.input?.output_mode === 'content' && !/^No matches found/.test(output)) {
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
      add(file, read.tool, item.id, read.start === 1 && read.end >= lines.length ? 'full' : 'partial', item.aggregated_output);
    }
  }
  return { version: 1, mechanism: 'successful native tool results', receipts, inspected: [...new Set(receipts.map(r => r.path))].sort() };
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
  }
  result.inspected = access.inspected;
  return result;
}
module.exports = { collect, apply, commandRead };
