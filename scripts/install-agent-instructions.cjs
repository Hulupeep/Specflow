#!/usr/bin/env node
// Refresh only the managed routing policy; preserve project-owned instructions.
const fs = require('fs');
const path = require('path');

function installAgentInstructions(templatePath, targetPath) {
  const template = fs.readFileSync(templatePath, 'utf8');
  const start = '<!-- specflow:work-routing:start -->';
  const end = '<!-- specflow:work-routing:end -->';
  const policy = template.slice(template.indexOf(start), template.indexOf(end) + end.length);
  if (!template.includes(start) || !template.includes(end)) {
    throw new Error('Agent template is missing work-routing markers');
  }
  let content = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : '';
  if (!content) {
    content = template;
  } else {
    const from = content.indexOf(start);
    const to = content.indexOf(end);
    if ((from === -1) !== (to === -1) || (from !== -1 && to < from)) {
      throw new Error('AGENTS.md has incomplete work-routing markers; repair them before updating');
    }
    if (from !== -1) {
      content = content.slice(0, from) + policy + content.slice(to + end.length);
    } else {
      // Prepend so old automatically-enter-loop guidance has explicit scope.
      content = policy + '\n\n' + content;
    }
    if (!content.includes('## Specflow Loop Routing')) {
      content += '\n\n' + template.slice(template.indexOf('## Specflow Loop Routing'));
    }
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, content);
}

if (require.main === module) {
  installAgentInstructions(process.argv[2], process.argv[3]);
}

module.exports = { installAgentInstructions };
