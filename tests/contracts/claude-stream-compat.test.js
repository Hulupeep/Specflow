const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { buildAdapterCommand } = require('../../scripts/specflow-runner.cjs');

// #177 D1: current Claude rejects print + stream-json without --verbose.
// These commands retain the prompt/tool boundary and existing route policy.
const command = args => buildAdapterCommand({
  provider: 'claude-print', args, prompt: 'Reply OK',
  allowed_tools: ['Read'], denied_tools: ['Bash'],
  billing: 'subscription_cli', cost: 'ordinary',
});
test.each([
  ['default', []],
  ['explicit stream', ['-p', '--output-format', 'stream-json']],
  ['equals stream', ['-p', '--output-format=stream-json']],
])('%s streaming invocation is compatible and preserves boundaries', (_, args) => {
  const before = [...args];
  const result = command(args).args;
  expect(result.filter(a => a === '--verbose')).toHaveLength(1);
  expect(result.indexOf('--verbose')).toBeLessThan(result.indexOf('--'));
  expect(result.slice(-2)).toEqual(['--', 'Reply OK']);
  expect(result).toEqual(expect.arrayContaining(['--allowedTools', 'Read', '--disallowedTools', 'Bash']));
  expect(result).not.toContain('--max-budget-usd');
  expect(args).toEqual(before);
});
test('explicit verbose is not duplicated and non-stream output stays explicit', () => {
  expect(command(['-p', '--output-format', 'stream-json', '--verbose']).args.filter(a => a === '--verbose')).toHaveLength(1);
  expect(command(['-p', '--output-format', 'json']).args).not.toContain('--verbose');
});
test('shipped safe policy can be invoked directly by the current Claude CLI', () => {
  const p = yaml.load(fs.readFileSync(path.resolve(__dirname, '../../templates/adapter-policies/claude-print.safe.yml'), 'utf8')).adapter_policy;
  expect(p.args).toContain('--verbose');
  const result = buildAdapterCommand(p).args;
  expect(result.filter(a => a === '--verbose')).toHaveLength(1);
  expect(result).toEqual(expect.arrayContaining(['--permission-mode', 'default']));
});
