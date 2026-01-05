/**
 * Contract Tests for chat2repo
 *
 * These tests scan source code for contract violations.
 * They enforce architectural invariants that unit tests cannot catch.
 *
 * Run: npm test -- contracts
 */

const fs = require('fs')
const path = require('path')

// Helper: recursively find files matching pattern
function findFiles(dir, pattern, ignore = []) {
  const results = []

  if (!fs.existsSync(dir)) {
    return results
  }

  const items = fs.readdirSync(dir, { withFileTypes: true })

  for (const item of items) {
    const fullPath = path.join(dir, item.name)
    const relativePath = fullPath

    // Check ignore patterns
    if (ignore.some(p => relativePath.includes(p))) {
      continue
    }

    if (item.isDirectory()) {
      results.push(...findFiles(fullPath, pattern, ignore))
    } else if (pattern.test(item.name)) {
      results.push(fullPath)
    }
  }

  return results
}

// Helper: get line number for match
function getLineNumber(content, match) {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(match)) {
      return i + 1
    }
  }
  return 1
}

// Helper: format violation error
function formatViolation(reqId, file, line, issue, pattern) {
  return [
    '',
    `❌ CONTRACT VIOLATION: ${reqId}`,
    '━'.repeat(50),
    '',
    `File: ${file}:${line}`,
    `Issue: ${issue}`,
    `Pattern: ${pattern}`,
    '',
    `See: sample_spec/contracts/ for contract details`,
    '',
    '━'.repeat(50),
    ''
  ].join('\n')
}

describe('Contract: feature_architecture', () => {

  describe('ARCH-001: Core package must be pure TypeScript', () => {
    it('core package must not use chrome.* APIs', () => {
      const coreDir = path.join(process.cwd(), 'packages/core')
      const files = findFiles(coreDir, /\.tsx?$/)
      const violations = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')

        if (/chrome\./.test(content)) {
          const match = content.match(/chrome\.\w+/)
          violations.push({
            file,
            line: getLineNumber(content, match[0]),
            pattern: match[0]
          })
        }

        if (/browser\./.test(content)) {
          const match = content.match(/browser\.\w+/)
          violations.push({
            file,
            line: getLineNumber(content, match[0]),
            pattern: match[0]
          })
        }
      }

      if (violations.length > 0) {
        const msg = violations.map(v =>
          formatViolation('ARCH-001', v.file, v.line,
            'Browser API not allowed in core package', v.pattern)
        ).join('\n')
        throw new Error(msg)
      }
    })
  })

  describe('ARCH-002: GitHub API calls only from background', () => {
    it('content scripts must not call GitHub API directly', () => {
      const contentDir = path.join(process.cwd(), 'packages/extension/src/content')
      const popupDir = path.join(process.cwd(), 'packages/extension/src/popup')
      const files = [
        ...findFiles(contentDir, /\.tsx?$/),
        ...findFiles(popupDir, /\.tsx?$/)
      ]
      const violations = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')

        if (/api\.github\.com/.test(content)) {
          violations.push({
            file,
            line: getLineNumber(content, 'api.github.com'),
            pattern: 'api.github.com'
          })
        }

        if (/new\s+GitHubClient/.test(content)) {
          violations.push({
            file,
            line: getLineNumber(content, 'GitHubClient'),
            pattern: 'new GitHubClient'
          })
        }
      }

      if (violations.length > 0) {
        const msg = violations.map(v =>
          formatViolation('ARCH-002', v.file, v.line,
            'GitHub API calls not allowed in content/popup', v.pattern)
        ).join('\n')
        throw new Error(msg)
      }
    })
  })
})

describe('Contract: feature_security', () => {

  describe('SEC-002: PAT never logged or exposed', () => {
    it('must not log tokens, PATs, or secrets', () => {
      const srcDir = path.join(process.cwd(), 'packages')
      const files = findFiles(srcDir, /\.tsx?$/, ['node_modules', '__tests__'])
      const violations = []

      const dangerousPatterns = [
        /console\.(log|info|debug|warn|error)\([^)]*(?:token|pat|secret)/i,
        /console\.(log|info|debug|warn|error)\([^)]*authorization/i
      ]

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')

        for (const pattern of dangerousPatterns) {
          if (pattern.test(content)) {
            const match = content.match(pattern)
            violations.push({
              file,
              line: getLineNumber(content, match[0]),
              pattern: match[0].substring(0, 50) + '...'
            })
          }
        }
      }

      if (violations.length > 0) {
        const msg = violations.map(v =>
          formatViolation('SEC-002', v.file, v.line,
            'Logging sensitive data is forbidden', v.pattern)
        ).join('\n')
        throw new Error(msg)
      }
    })
  })

  describe('SEC-003: host_permissions limited', () => {
    it('manifest must not have <all_urls>', () => {
      const manifestPath = path.join(process.cwd(), 'packages/extension/manifest.json')

      if (!fs.existsSync(manifestPath)) {
        // Skip if manifest doesn't exist yet
        return
      }

      const content = fs.readFileSync(manifestPath, 'utf-8')

      if (/<all_urls>/.test(content)) {
        throw new Error(formatViolation('SEC-003', manifestPath, getLineNumber(content, '<all_urls>'),
          '<all_urls> permission not allowed', '<all_urls>'))
      }

      if (/\*:\/\/\*\//.test(content)) {
        throw new Error(formatViolation('SEC-003', manifestPath, getLineNumber(content, '*://*/*'),
          'Wildcard host permission not allowed', '*://*/*'))
      }
    })
  })
})

describe('Contract: feature_mv3', () => {

  describe('MV3-001: Background must be service worker', () => {
    it('manifest must use service_worker, not scripts', () => {
      const manifestPath = path.join(process.cwd(), 'packages/extension/manifest.json')

      if (!fs.existsSync(manifestPath)) {
        return
      }

      const content = fs.readFileSync(manifestPath, 'utf-8')

      if (/"persistent"\s*:\s*true/.test(content)) {
        throw new Error(formatViolation('MV3-001', manifestPath,
          getLineNumber(content, 'persistent'),
          'Persistent background not allowed in MV3', '"persistent": true'))
      }

      if (/"scripts"\s*:\s*\[/.test(content) && /"background"/.test(content)) {
        throw new Error(formatViolation('MV3-001', manifestPath,
          getLineNumber(content, '"scripts"'),
          'MV2 scripts array not allowed, use service_worker', '"scripts": ['))
      }
    })
  })

  describe('MV3-002: No long-lived polling in background', () => {
    it('background must not use setInterval', () => {
      const bgDir = path.join(process.cwd(), 'packages/extension/src/background')
      const files = findFiles(bgDir, /\.tsx?$/)
      const violations = []

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf-8')

        if (/setInterval\s*\(/.test(content)) {
          violations.push({
            file,
            line: getLineNumber(content, 'setInterval'),
            pattern: 'setInterval'
          })
        }
      }

      if (violations.length > 0) {
        const msg = violations.map(v =>
          formatViolation('MV3-002', v.file, v.line,
            'setInterval not allowed in service worker', v.pattern)
        ).join('\n')
        throw new Error(msg)
      }
    })
  })
})

describe('Contract: feature_markdown', () => {

  describe('MD-001/MD-003: Required front-matter fields', () => {
    it('markdownBuilder must output required fields', () => {
      const builderPath = path.join(process.cwd(), 'packages/core/src/markdownBuilder.ts')

      if (!fs.existsSync(builderPath)) {
        return
      }

      const content = fs.readFileSync(builderPath, 'utf-8')

      const requiredFields = ['source:', 'captured_at:', 'tags:']
      const missingFields = []

      for (const field of requiredFields) {
        if (!content.includes(field)) {
          missingFields.push(field)
        }
      }

      if (missingFields.length > 0) {
        throw new Error([
          '',
          '❌ CONTRACT VIOLATION: MD-001/MD-003',
          '━'.repeat(50),
          '',
          `File: ${builderPath}`,
          `Issue: Missing required front-matter fields`,
          `Missing: ${missingFields.join(', ')}`,
          '',
          'Required fields: source, captured_at, tags (as array)',
          '',
          '━'.repeat(50),
          ''
        ].join('\n'))
      }
    })
  })
})

describe('Contract: feature_ux', () => {

  describe('UX-003: Buttons only on assistant messages', () => {
    it('ChatGPT selectors must filter for assistant role', () => {
      const domPath = path.join(process.cwd(), 'packages/extension/src/content/chatgptDom.ts')

      if (!fs.existsSync(domPath)) {
        return
      }

      const content = fs.readFileSync(domPath, 'utf-8')

      // Check that assistant filtering exists
      if (!/assistant|data-message-author-role/i.test(content)) {
        throw new Error(formatViolation('UX-003', domPath, 1,
          'Must filter for assistant messages when injecting buttons',
          'missing assistant role filter'))
      }
    })
  })

  describe('ERR-002: Empty content check', () => {
    it('content script must check for empty content', () => {
      const scriptPath = path.join(process.cwd(), 'packages/extension/src/content/chatgptContentScript.ts')

      if (!fs.existsSync(scriptPath)) {
        return
      }

      const content = fs.readFileSync(scriptPath, 'utf-8')

      // Check for null/empty content handling
      if (!/!content|content\s*===?\s*null|content\s*===?\s*['"]|\.length\s*===?\s*0/.test(content)) {
        throw new Error(formatViolation('ERR-002', scriptPath, 1,
          'Must check for empty/null content before capture',
          'missing empty content check'))
      }
    })
  })
})

// Summary test
describe('Contract Summary', () => {
  it('lists all contracts being enforced', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  chat2repo Contract Summary                    ║
╠═══════════════════════════════════════════════════════════════╣
║ ARCH-001: Core package pure TypeScript (no browser APIs)      ║
║ ARCH-002: GitHub API calls only from background               ║
║ SEC-002:  PAT never logged or exposed                         ║
║ SEC-003:  host_permissions limited to specific domains        ║
║ MV3-001:  Background must be service worker                   ║
║ MV3-002:  No setInterval in service worker                    ║
║ MD-001:   Required front-matter fields                        ║
║ MD-003:   tags field always present as array                  ║
║ UX-003:   Buttons only on assistant messages                  ║
║ ERR-002:  Empty content check before capture                  ║
╚═══════════════════════════════════════════════════════════════╝
    `)
  })
})
