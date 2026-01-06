/**
 * Example Contract Test: API Authentication
 *
 * This test enforces the contract in examples/contract-example.yml
 * Copy and modify for your own contract tests.
 *
 * Location: src/__tests__/contracts/auth.test.ts
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'glob'

// Helper: Find all files matching scope patterns
function getFilesInScope(patterns: string[], basePath: string): string[] {
  const includes: string[] = []
  const excludes: string[] = []

  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      excludes.push(pattern.slice(1))
    } else {
      includes.push(pattern)
    }
  }

  const files: string[] = []
  for (const pattern of includes) {
    const matches = glob.sync(pattern, {
      cwd: basePath,
      absolute: true,
      ignore: excludes,
    })
    files.push(...matches)
  }

  return [...new Set(files)]
}

// Helper: Find pattern matches with line numbers
function findPatternViolations(
  content: string,
  pattern: RegExp,
  filePath: string
): Array<{ file: string; line: number; match: string }> {
  const violations: Array<{ file: string; line: number; match: string }> = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    if (pattern.test(line)) {
      violations.push({
        file: filePath,
        line: index + 1,
        match: line.trim(),
      })
    }
  })

  return violations
}

describe('Contract: feature_authentication', () => {
  const basePath = path.resolve(__dirname, '../../..')

  describe('AUTH-001: API routes require authMiddleware', () => {
    const scope = ['src/routes/**/*.ts', 'src/api/**/*.ts']
    const excludes = ['!src/routes/health.ts', '!src/routes/public/**']

    it('No API routes without authMiddleware', () => {
      const files = getFilesInScope([...scope, ...excludes], basePath)
      const violations: Array<{ file: string; line: number; match: string }> = []

      // Pattern: router.post('/api/...', async (req, res) => {
      // Missing: authMiddleware before the async handler
      const forbiddenPattern = /router\.(get|post|put|delete)\(['"]\/api\/.*['"]\s*,\s*async/

      for (const file of files) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')
        const matches = findPatternViolations(content, forbiddenPattern, file)
        violations.push(...matches)
      }

      if (violations.length > 0) {
        const message =
          `CONTRACT VIOLATION: AUTH-001\n` +
          `API routes missing authMiddleware:\n\n` +
          violations
            .map(
              (v) =>
                `  ${v.file.replace(basePath, '')}:${v.line}\n` +
                `    ${v.match}\n`
            )
            .join('\n') +
          `\nFix: Add authMiddleware before the handler:\n` +
          `  router.post('/api/users', authMiddleware, async (req, res) => { ... })\n\n` +
          `Contract: docs/contracts/feature_authentication.yml`

        throw new Error(message)
      }

      expect(violations).toHaveLength(0)
    })

    it('Route files import authMiddleware', () => {
      const files = getFilesInScope([...scope, ...excludes], basePath)
      const violations: string[] = []

      for (const file of files) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')

        const hasRoutes = /router\.(get|post|put|delete)/.test(content)
        const importsAuth = /import.*authMiddleware/.test(content)

        if (hasRoutes && !importsAuth) {
          violations.push(file.replace(basePath, ''))
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: AUTH-001\n` +
            `Files with routes but no authMiddleware import:\n` +
            violations.map((f) => `  - ${f}`).join('\n') +
            `\n\nFix: import { authMiddleware } from '../middleware/auth'\n\n` +
            `Contract: docs/contracts/feature_authentication.yml`
        )
      }
    })
  })

  describe('AUTH-002: Tokens in httpOnly cookies only', () => {
    const scope = ['src/**/*.ts', 'src/**/*.js']

    it('No localStorage for tokens', () => {
      const files = getFilesInScope(scope, basePath)
      const violations: Array<{ file: string; line: number; match: string }> = []

      const forbiddenPatterns = [
        { pattern: /localStorage\.setItem\([^)]*token/i, reason: 'token in localStorage' },
        { pattern: /localStorage\.setItem\([^)]*auth/i, reason: 'auth in localStorage' },
        { pattern: /sessionStorage\.setItem\([^)]*token/i, reason: 'token in sessionStorage' },
      ]

      for (const file of files) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')

        for (const { pattern } of forbiddenPatterns) {
          const matches = findPatternViolations(content, pattern, file)
          violations.push(...matches)
        }
      }

      if (violations.length > 0) {
        const message =
          `CONTRACT VIOLATION: AUTH-002\n` +
          `Tokens stored in localStorage/sessionStorage:\n\n` +
          violations
            .map(
              (v) =>
                `  ${v.file.replace(basePath, '')}:${v.line}\n` +
                `    ${v.match}\n`
            )
            .join('\n') +
          `\nFix: Use httpOnly cookies instead:\n` +
          `  res.cookie('token', jwt, { httpOnly: true, secure: true })\n\n` +
          `Contract: docs/contracts/feature_authentication.yml`

        throw new Error(message)
      }

      expect(violations).toHaveLength(0)
    })

    it('Auth cookies have httpOnly flag', () => {
      const files = getFilesInScope(scope, basePath)
      let foundHttpOnly = false

      // Check if httpOnly: true exists somewhere in auth-related code
      for (const file of files) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')

        if (/httpOnly\s*:\s*true/.test(content)) {
          foundHttpOnly = true
          break
        }
      }

      // This is a soft check - only fail if we find cookie-setting code without httpOnly
      const files2 = getFilesInScope(['src/auth/**/*.ts', 'src/controllers/auth/**/*.ts'], basePath)

      for (const file of files2) {
        if (!fs.existsSync(file)) continue
        const content = fs.readFileSync(file, 'utf-8')

        const setsCookie = /res\.cookie|setCookie/.test(content)
        const hasHttpOnly = /httpOnly\s*:\s*true/.test(content)

        if (setsCookie && !hasHttpOnly) {
          throw new Error(
            `CONTRACT VIOLATION: AUTH-002\n` +
              `Cookie set without httpOnly flag:\n` +
              `  File: ${file.replace(basePath, '')}\n\n` +
              `Fix: Add httpOnly: true to cookie options:\n` +
              `  res.cookie('token', jwt, { httpOnly: true, secure: true })\n\n` +
              `Contract: docs/contracts/feature_authentication.yml`
          )
        }
      }
    })
  })

  describe('Compliance Checklist', () => {
    it('Documents compliance questions', () => {
      // This test documents the compliance checklist for LLMs
      const checklist = [
        {
          question: 'Adding or modifying an API route?',
          action: 'Add authMiddleware as first parameter after the path',
        },
        {
          question: 'Storing auth tokens or credentials?',
          action: 'Use httpOnly cookies, never localStorage or sessionStorage',
        },
        {
          question: 'Creating a public endpoint?',
          action: 'Add to scope exclusions in contract (!src/routes/public/**)',
        },
      ]

      // Verify checklist is complete
      expect(checklist.length).toBeGreaterThan(0)
      checklist.forEach((item) => {
        expect(item.question).toBeDefined()
        expect(item.action).toBeDefined()
      })
    })
  })
})
