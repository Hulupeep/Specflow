/**
 * Example Contract Verification Tests: API Authentication
 *
 * This is a REAL, WORKING example test suite that demonstrates:
 * - How to scan source code for contract violations
 * - How to write clear violation messages
 * - How to structure contract tests
 * - How to document compliance for LLMs
 *
 * Use this as a reference when creating your own contract tests.
 *
 * Contract: docs/contracts/templates/contract-example.yml
 * Contract ID: api_authentication_required
 * Status: immutable (non-negotiable)
 */

import { describe, it, expect } from '@jest/globals'

describe('Contract: api_authentication_required', () => {
  describe('Rule: auth_001_require_middleware', () => {
    it('LLM CHECK: all API routes have authMiddleware', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const glob = await import('glob')

      // Find all route files (adjust pattern for your project)
      const routeFiles = glob.sync('src/api/routes/**/*.{ts,js}', {
        cwd: path.resolve(__dirname, '../../..'),
        absolute: true,
      })

      const violations: Array<{ file: string; line: number; code: string }> = []

      for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        // Check for routes without authMiddleware
        lines.forEach((line, index) => {
          // Match: router.post('/path', async (req, res) => {
          // Missing: authMiddleware before handler
          const routeWithoutAuth = /router\.(get|post|put|delete|patch)\([^,]+,\s*(?!authMiddleware)/.test(
            line
          )

          if (routeWithoutAuth && !line.includes('authMiddleware')) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: index + 1,
              code: line.trim(),
            })
          }
        })
      }

      if (violations.length > 0) {
        const errorMessage =
          `CONTRACT VIOLATION: auth_001_require_middleware\n` +
          `Found ${violations.length} route(s) missing authMiddleware:\n\n` +
          violations
            .map(
              ({ file, line, code }) =>
                `  ${file}:${line}\n` + `    ${code}\n` + `    ❌ Missing authMiddleware\n`
            )
            .join('\n') +
          `\nFix: Add authMiddleware as first parameter:\n` +
          `  router.post('/path', authMiddleware, async (req, res) => { ... })\n\n` +
          `See: docs/contracts/templates/contract-example.yml`

        throw new Error(errorMessage)
      }

      // If we get here, all routes have authMiddleware
      expect(violations.length).toBe(0)
    })

    it('LLM CHECK: route files import authMiddleware', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const glob = await import('glob')

      const routeFiles = glob.sync('src/api/routes/**/*.{ts,js}', {
        cwd: path.resolve(__dirname, '../../..'),
        absolute: true,
      })

      const violations: string[] = []

      for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf-8')

        // Check if file uses router methods but doesn't import authMiddleware
        const hasRoutes = /router\.(get|post|put|delete|patch)/.test(content)
        const importsAuth = /import.*authMiddleware.*from/.test(content)

        if (hasRoutes && !importsAuth) {
          violations.push(file.replace(process.cwd(), ''))
        }
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: auth_001_require_middleware\n` +
            `Files with routes but missing authMiddleware import:\n` +
            violations.map(f => `  - ${f}`).join('\n') +
            `\n\nAdd import:\n` +
            `  import { authMiddleware } from '../middleware/auth'\n\n` +
            `See: docs/contracts/templates/contract-example.yml`
        )
      }
    })

    it('LLM CHECK: no direct req.body access without auth', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const glob = await import('glob')

      const routeFiles = glob.sync('src/api/**/*.{ts,js}', {
        cwd: path.resolve(__dirname, '../../..'),
        absolute: true,
      })

      const violations: Array<{ file: string; line: number; code: string }> = []

      for (const file of routeFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          // Check for handlers that access req.body without authMiddleware
          // This is a simplified check - adjust regex for your codebase
          const hasReqBodyAccess = /async\s*\(\s*req\s*,\s*res\s*\)\s*=>/.test(line) &&
            content.includes('req.body') &&
            !content.includes('authMiddleware')

          if (hasReqBodyAccess) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: index + 1,
              code: line.trim(),
            })
          }
        })
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: auth_001_require_middleware\n` +
            `Found handler(s) accessing req.body without authentication:\n\n` +
            violations
              .map(
                ({ file, line, code }) =>
                  `  ${file}:${line}\n` + `    ${code}\n` + `    ❌ Accesses req.body without auth\n`
              )
              .join('\n') +
            `\nSee: docs/contracts/templates/contract-example.yml`
        )
      }
    })
  })

  describe('Rule: auth_002_no_auth_bypass', () => {
    it('LLM CHECK: no skipAuth flags exist', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const glob = await import('glob')

      const apiFiles = glob.sync('src/api/**/*.{ts,js}', {
        cwd: path.resolve(__dirname, '../../..'),
        absolute: true,
      })

      const violations: Array<{ file: string; line: number; code: string }> = []

      for (const file of apiFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          if (/skipAuth/i.test(line)) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: index + 1,
              code: line.trim(),
            })
          }
        })
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: auth_002_no_auth_bypass\n` +
            `Found skipAuth flag(s):\n\n` +
            violations
              .map(
                ({ file, line, code }) =>
                  `  ${file}:${line}\n` + `    ${code}\n` + `    ❌ skipAuth is forbidden\n`
              )
              .join('\n') +
            `\nAuthentication cannot be skipped or made optional.\n` +
            `See: docs/contracts/templates/contract-example.yml`
        )
      }
    })

    it('LLM CHECK: no conditional auth bypass', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const glob = await import('glob')

      const apiFiles = glob.sync('src/api/**/*.{ts,js}', {
        cwd: path.resolve(__dirname, '../../..'),
        absolute: true,
      })

      const forbiddenPatterns = [
        {
          pattern: /if\s*\(.*!authRequired.*\)/,
          message: 'Conditional auth bypass detected',
        },
        {
          pattern: /if\s*\(.*NODE_ENV.*===.*development.*\).*skip/i,
          message: 'Development environment auth bypass detected',
        },
        {
          pattern: /process\.env\.DISABLE_AUTH/,
          message: 'Environment variable to disable auth detected',
        },
      ]

      const violations: Array<{ file: string; line: number; code: string; reason: string }> = []

      for (const file of apiFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          for (const { pattern, message } of forbiddenPatterns) {
            if (pattern.test(line)) {
              violations.push({
                file: file.replace(process.cwd(), ''),
                line: index + 1,
                code: line.trim(),
                reason: message,
              })
            }
          }
        })
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: auth_002_no_auth_bypass\n` +
            `Found authentication bypass pattern(s):\n\n` +
            violations
              .map(
                ({ file, line, code, reason }) =>
                  `  ${file}:${line}\n` +
                  `    ${code}\n` +
                  `    ❌ ${reason}\n`
              )
              .join('\n') +
            `\nAuthentication must always be enforced - no bypasses allowed.\n` +
            `See: docs/contracts/templates/contract-example.yml`
        )
      }
    })

    it('LLM CHECK: no comments about removing auth', async () => {
      const fs = await import('fs')
      const path = await import('path')
      const glob = await import('glob')

      const apiFiles = glob.sync('src/api/**/*.{ts,js}', {
        cwd: path.resolve(__dirname, '../../..'),
        absolute: true,
      })

      const violations: Array<{ file: string; line: number; code: string }> = []

      for (const file of apiFiles) {
        const content = fs.readFileSync(file, 'utf-8')
        const lines = content.split('\n')

        lines.forEach((line, index) => {
          if (/\/\/\s*TODO:?\s*remove auth/i.test(line)) {
            violations.push({
              file: file.replace(process.cwd(), ''),
              line: index + 1,
              code: line.trim(),
            })
          }
        })
      }

      if (violations.length > 0) {
        throw new Error(
          `CONTRACT VIOLATION: auth_002_no_auth_bypass\n` +
            `Found comment(s) about removing authentication:\n\n` +
            violations
              .map(
                ({ file, line, code }) =>
                  `  ${file}:${line}\n` +
                  `    ${code}\n` +
                  `    ❌ Comments indicating intention to remove auth are forbidden\n`
              )
              .join('\n') +
            `\nAuthentication is non-negotiable and cannot be removed.\n` +
            `See: docs/contracts/templates/contract-example.yml`
        )
      }
    })
  })

  describe('Logging Contract', () => {
    it('LLM CHECK: authMiddleware logs authentication failures', async () => {
      const fs = await import('fs')
      const path = await import('path')

      // Check authMiddleware implementation
      const authFiles = [
        'src/middleware/auth.ts',
        'src/api/middleware/auth.ts',
        'src/auth/middleware.ts',
      ]

      let authFileContent = ''
      let authFilePath = ''

      for (const file of authFiles) {
        const fullPath = path.resolve(__dirname, '../../..', file)
        if (fs.existsSync(fullPath)) {
          authFileContent = fs.readFileSync(fullPath, 'utf-8')
          authFilePath = file
          break
        }
      }

      if (!authFileContent) {
        // Auth middleware file not found - skip check or warn
        console.warn('Auth middleware file not found - skipping logging check')
        return
      }

      // Check for logging on auth failure
      const logsOnFailure =
        /console\.warn|logger\.warn|log\.warn/.test(authFileContent) ||
        /Authentication failed/.test(authFileContent)

      if (!logsOnFailure) {
        throw new Error(
          `CONTRACT VIOLATION: auth logging contract\n` +
            `authMiddleware (${authFilePath}) does not log authentication failures\n` +
            `Required: Log "Authentication failed for [endpoint]" at warn level\n\n` +
            `See: docs/contracts/templates/contract-example.yml`
        )
      }
    })
  })

  describe('Compliance Checklist', () => {
    it('LLM CHECK: documents compliance questions for route additions', () => {
      // This test documents the compliance checklist from contract
      const complianceQuestions = [
        {
          question: 'Does this route have authMiddleware as first parameter?',
          expected: 'YES',
          violation: 'auth_001_require_middleware',
        },
        {
          question: 'Does this route need to be public?',
          if_yes: 'Document why and get security team approval',
        },
        {
          question: 'Does this change remove or weaken authentication?',
          expected: 'NO',
          violation: 'contract violation',
        },
      ]

      // Verify checklist is complete
      complianceQuestions.forEach(check => {
        expect(check.question).toBeDefined()
        expect(check.expected || check.if_yes).toBeDefined()
      })
    })
  })

  describe('Example Patterns', () => {
    it('Documents violation vs compliant patterns', () => {
      const violation = `
        // ❌ WRONG - No authentication
        router.post('/api/users/delete', async (req, res) => {
          await User.delete(req.body.userId)
        })
      `

      const compliant = `
        // ✅ CORRECT - Authentication required
        router.post('/api/users/delete', authMiddleware, async (req, res) => {
          await User.delete(req.body.userId)
        })
      `

      expect(violation).toContain('❌ WRONG')
      expect(compliant).toContain('✅ CORRECT')
      expect(compliant).toContain('authMiddleware')
    })
  })
})
