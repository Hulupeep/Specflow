// Contract test - Catches violations that unit tests miss!
// This test scans source code for forbidden patterns from AUTH-001

const fs = require('fs')
const path = require('path')

describe('Contract: AUTH-001', () => {
  it('Session storage uses store with TTL, not localStorage', () => {
    const authPath = path.join(__dirname, '../auth.js')
    const content = fs.readFileSync(authPath, 'utf-8')

    // Check for forbidden patterns
    const localStorageMatch = content.match(/localStorage\.(get|set)Item/)
    const sessionStorageMatch = content.match(/sessionStorage\.(get|set)Item/)

    if (localStorageMatch || sessionStorageMatch) {
      const pattern = localStorageMatch ? 'localStorage' : 'sessionStorage'
      const lineNum = getLineNumber(content, localStorageMatch || sessionStorageMatch)
      const snippet = getLineSnippet(content, lineNum)

      const errorMsg = [
        '',
        '❌ CONTRACT VIOLATION: AUTH-001',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        `File: src/auth.js:${lineNum}`,
        `Issue: ${pattern} not allowed (violates AUTH-001)`,
        `Code: ${snippet}`,
        '',
        'Requirement AUTH-001:',
        '"Session storage MUST use Redis with TTL"',
        '',
        'Why: localStorage breaks in service workers and',
        '     can be disabled by browser policies',
        '',
        'See: docs/contract.yml',
        'Spec: docs/spec.md#AUTH-001',
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ''
      ].join('\n')

      throw new Error(errorMsg)
    }

    // Check for required pattern (store usage)
    const storeMatch = content.match(/(store\.set|store\.get)/)
    if (!storeMatch) {
      throw new Error([
        '',
        '❌ CONTRACT VIOLATION: AUTH-001',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '',
        'File: src/auth.js',
        'Issue: Missing required store.set/store.get usage',
        '',
        'Requirement AUTH-001 requires store with TTL',
        '',
        'See: docs/contract.yml',
        '',
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        ''
      ].join('\n'))
    }
  })
})

// Helper functions
function getLineNumber(content, match) {
  if (!match) return 1
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match[0])) {
      return i + 1
    }
  }
  return 1
}

function getLineSnippet(content, lineNum) {
  const lines = content.split('\n')
  if (lineNum > 0 && lineNum <= lines.length) {
    return lines[lineNum - 1].trim()
  }
  return ''
}
