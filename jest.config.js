module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  modulePathIgnorePatterns: ['/.specflow/duo/', '/.claude/worktrees/'],
  testPathIgnorePatterns: ['/node_modules/', '/demo/', '/.claude/', '/.specflow/worktrees/', '/.specflow/duo/'],
};
