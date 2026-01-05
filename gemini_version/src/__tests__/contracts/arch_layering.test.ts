
describe('Contract: arch_001_layering', () => {
  const fs = require('fs');
  const path = require('path');
  const glob = require('glob');

  it('Core package must be pure TypeScript (no browser APIs)', () => {
    const coreDir = path.resolve(__dirname, '../../../packages/core/src');
    if (!fs.existsSync(coreDir)) return; // Skip if not created yet

    const files = glob.sync(`${coreDir}/**/*.ts`);
    const forbidden = [/(window\.|document\.|chrome\.|localStorage\.|fetch\()/];

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      forbidden.forEach(pattern => {
        if (pattern.test(content)) {
          throw new Error(`CONTRACT VIOLATION: ${file} contains forbidden pattern ${pattern}`);
        }
      });
    });
  });

  it('No GitHub calls from content scripts', () => {
    const contentDir = path.resolve(__dirname, '../../../packages/extension/src/content');
    if (!fs.existsSync(contentDir)) return;

    const files = glob.sync(`${contentDir}/**/*.ts`);
    const forbidden = [/api\.github\.com/, /import.*GitHubClient/];

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      forbidden.forEach(pattern => {
        if (pattern.test(content)) {
          throw new Error(`CONTRACT VIOLATION: ${file} makes direct GitHub calls`);
        }
      });
    });
  });
});
