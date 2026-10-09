const fs = require('fs');
const path = require('path');

// The source kit and installed projects use the same header as the version authority.
function mandatePath() {
  const source = path.join(__dirname, '../templates/loops/adversary-mandate.md');
  return fs.existsSync(source) ? source : path.join(__dirname, '../QA/loops/adversary-mandate.md');
}

function currentMandate(file = mandatePath()) {
  const content = fs.readFileSync(file, 'utf8');
  const headings = content.match(/^# adversary-mandate@v\d+[ \t]*\r?$/gm) || [];
  if (headings.length !== 1 || !/^# adversary-mandate@v\d+[ \t]*\r?\n/.test(content)) {
    throw new Error('adversary mandate must have exactly one versioned header at the start');
  }
  return { ref: headings[0].trim().slice(2), path: file };
}

function resolveMandate(ref, file) {
  const current = currentMandate(file);
  if (ref !== current.ref) throw new Error(`mandate_ref does not resolve: ${ref}; installed mandate is ${current.ref}`);
  return current;
}

module.exports = { currentMandate, resolveMandate };
